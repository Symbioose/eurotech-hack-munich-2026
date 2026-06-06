"""
World model for BuildGuard Node degradation under HK environmental conditions.

Architecture:
- 2-layer GRU, hidden size 128
- Input: [env_state | component_state | stress_action_onehot]
- Output heads: next_env_state, next_component_state, failure_probs
- Physics-informed loss
"""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Optional

# ── Dimension constants ──────────────────────────────────────────────────────

ENV_DIM = 6          # temperature_c, humidity_rh, rainfall_intensity, wind_speed_ms, UV_index, vibration_g
COMPONENT_DIM = 7    # enclosure_seal_integrity, pcb_health, battery_soc,
                     # bracket_corrosion, moisture_sensor_drift, crack_sensor_drift, tilt_sensor_drift
N_ACTIONS = 5        # typhoon_load, heat_cycle, humidity_soak, vibration_burst, UV_exposure
FAILURE_DIM = 4      # moisture_ingress_prob, thermal_runaway_prob, seal_failure_prob, bracket_failure_prob

INPUT_DIM = ENV_DIM + COMPONENT_DIM + N_ACTIONS   # 18
HIDDEN_SIZE = 128
N_LAYERS = 2

# Action name → index mapping
ACTION_INDEX = {
    "typhoon_load": 0,
    "heat_cycle": 1,
    "humidity_soak": 2,
    "vibration_burst": 3,
    "UV_exposure": 4,
    "none": None,  # no stress applied this step — zero vector
}
ACTION_NAMES = ["typhoon_load", "heat_cycle", "humidity_soak", "vibration_burst", "UV_exposure"]

# Column indices within the component state vector
IDX_SEAL = 0
IDX_PCB = 1
IDX_BATTERY = 2
IDX_CORROSION = 3
IDX_MOISTURE_DRIFT = 4
IDX_CRACK_DRIFT = 5
IDX_TILT_DRIFT = 6

# Column indices within env state vector
IDX_TEMP = 0
IDX_HUMIDITY = 1
IDX_RAINFALL = 2
IDX_WIND = 3
IDX_UV = 4
IDX_VIB = 5


class WorldModel(nn.Module):
    """
    GRU-based world model that predicts next-step degradation state and
    per-component failure probabilities given current state + stress action.
    """

    def __init__(self, input_dim: int = INPUT_DIM, hidden_size: int = HIDDEN_SIZE, n_layers: int = N_LAYERS):
        super().__init__()
        self.hidden_size = hidden_size
        self.n_layers = n_layers

        self.gru = nn.GRU(
            input_size=input_dim,
            hidden_size=hidden_size,
            num_layers=n_layers,
            batch_first=True,
        )

        # Output heads
        self.head_env = nn.Sequential(
            nn.Linear(hidden_size, 64),
            nn.ReLU(),
            nn.Linear(64, ENV_DIM),
        )
        self.head_component = nn.Sequential(
            nn.Linear(hidden_size, 64),
            nn.ReLU(),
            nn.Linear(64, COMPONENT_DIM),
        )
        self.head_failure = nn.Sequential(
            nn.Linear(hidden_size, 64),
            nn.ReLU(),
            nn.Linear(64, FAILURE_DIM),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor, h: Optional[torch.Tensor] = None):
        """
        x: (batch, seq_len, INPUT_DIM)
        h: (n_layers, batch, hidden_size) or None

        Returns:
            env_pred:       (batch, seq_len, ENV_DIM)
            component_pred: (batch, seq_len, COMPONENT_DIM)
            failure_pred:   (batch, seq_len, FAILURE_DIM)   [0,1]
            h_next:         (n_layers, batch, hidden_size)
        """
        gru_out, h_next = self.gru(x, h)          # (B, T, H)
        env_pred = self.head_env(gru_out)
        component_pred = self.head_component(gru_out)
        failure_pred = self.head_failure(gru_out)
        return env_pred, component_pred, failure_pred, h_next

    def step(self, x_t: torch.Tensor, h: Optional[torch.Tensor] = None):
        """
        Single-step forward (seq_len=1).
        x_t: (batch, INPUT_DIM)
        Returns same shapes as forward but squeezed on seq dim.
        """
        x_t = x_t.unsqueeze(1)                     # (B, 1, D)
        env_p, comp_p, fail_p, h_next = self.forward(x_t, h)
        return env_p.squeeze(1), comp_p.squeeze(1), fail_p.squeeze(1), h_next


def build_input(env_state: torch.Tensor, component_state: torch.Tensor, action_idx: Optional[int]) -> torch.Tensor:
    """
    Concatenate env + component + one-hot action into a single input vector.
    Supports batched (B, D) or unbatched (D,) inputs.
    """
    action_vec = torch.zeros(*env_state.shape[:-1], N_ACTIONS, device=env_state.device, dtype=env_state.dtype)
    if action_idx is not None:
        action_vec[..., action_idx] = 1.0
    return torch.cat([env_state, component_state, action_vec], dim=-1)


def device_failure_prob(failure_probs: torch.Tensor) -> torch.Tensor:
    """
    Derive overall device failure probability from per-component probabilities.
    device_failure = 1 - Π(1 - p_i)
    failure_probs: (..., FAILURE_DIM)
    Returns: (...,)
    """
    return 1.0 - torch.prod(1.0 - failure_probs, dim=-1)


# ── Physics-informed loss ────────────────────────────────────────────────────

def physics_loss(
    comp_pred: torch.Tensor,   # (B, T, COMPONENT_DIM)
    env_pred: torch.Tensor,    # (B, T, ENV_DIM)
    comp_target: torch.Tensor, # (B, T, COMPONENT_DIM)  — ground truth for reference
    lambda_physics: float = 0.1,
    temp_jump_threshold: float = 5.0,     # max realistic single-step °C delta
) -> torch.Tensor:
    """
    Physics constraint penalties added to prediction loss:
    1. Wear monotonicity: seal, pcb, battery must not spontaneously recover.
    2. Corrosion monotonicity: bracket_corrosion must not decrease.
    3. Temperature smoothness: no impossible single-step jumps.
    """
    loss = torch.tensor(0.0, device=comp_pred.device)

    if comp_pred.shape[1] < 2:
        return loss

    # 1. Wear monotonicity (these should decrease or stay the same)
    for idx in [IDX_SEAL, IDX_PCB, IDX_BATTERY]:
        delta = comp_pred[:, 1:, idx] - comp_pred[:, :-1, idx]   # positive = recovered (bad)
        loss = loss + torch.mean(torch.clamp(delta, min=0.0))

    # 2. Corrosion monotonicity (should increase or stay the same)
    corr_delta = comp_pred[:, 1:, IDX_CORROSION] - comp_pred[:, :-1, IDX_CORROSION]  # negative = decreased (bad)
    loss = loss + torch.mean(torch.clamp(-corr_delta, min=0.0))

    # 3. Temperature smoothness
    temp_delta = torch.abs(env_pred[:, 1:, IDX_TEMP] - env_pred[:, :-1, IDX_TEMP])
    loss = loss + torch.mean(torch.clamp(temp_delta - temp_jump_threshold, min=0.0))

    return lambda_physics * loss


def total_loss(
    env_pred: torch.Tensor,
    env_target: torch.Tensor,
    comp_pred: torch.Tensor,
    comp_target: torch.Tensor,
    fail_pred: torch.Tensor,
    fail_target: torch.Tensor,
    lambda_physics: float = 0.1,
) -> torch.Tensor:
    pred_loss = (
        F.mse_loss(env_pred, env_target)
        + F.mse_loss(comp_pred, comp_target)
        + F.binary_cross_entropy(fail_pred, fail_target)
    )
    phys_loss = physics_loss(comp_pred, env_pred, comp_target, lambda_physics)
    return pred_loss + phys_loss