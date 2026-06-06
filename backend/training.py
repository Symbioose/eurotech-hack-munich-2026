"""
Synthetic data generation and training for the BuildGuard Node world model.

Physics calibration sources:
  - HK Observatory monthly climate normals (1991-2020): temperature, humidity,
    rainfall, UV index, wind speed.
  - Li-ion Arrhenius degradation model (Ea = 0.60 eV), calibrated against
    NASA PCOE battery dataset capacity-fade curves (datasets B0005-B0018).
    At 25 °C the model predicts ~80 % SoH at 2.5 years — consistent with the
    PCOE measured median for NMC cells cycled at room temperature.
  - EPDM seal photodegradation rates derived from subtropical outdoor exposure
    literature (ISO 4892-2, HK equivalent UV dose).
  - Bracket corrosion calibrated to ISO 9223 category C4/C5 (coastal urban HK).

Timescale: 1 timestep = 1 week of field deployment (100 steps ≈ 2 years).
Dataset  : 10 000 trajectories × 100 timesteps = 1 000 000 transitions.
Stratified: 50 % normal / 20 % stressed / 30 % catastrophic.
"""
from __future__ import annotations

import math
import random
import pathlib
import json
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

from model import (
    WorldModel,
    build_input,
    total_loss,
    physics_loss,
    device_failure_prob,
    ACTION_NAMES,
    ENV_DIM,
    COMPONENT_DIM,
    FAILURE_DIM,
    INPUT_DIM,
    IDX_SEAL, IDX_PCB, IDX_BATTERY, IDX_CORROSION,
    IDX_MOISTURE_DRIFT, IDX_CRACK_DRIFT, IDX_TILT_DRIFT,
    IDX_TEMP, IDX_HUMIDITY, IDX_RAINFALL, IDX_WIND, IDX_UV, IDX_VIB,
)

MODEL_PATH        = pathlib.Path(__file__).parent / "world_model.pt"
TRAINING_LOG_PATH = pathlib.Path(__file__).parent / "training_log.json"
DEMO_DATASET_PATH = pathlib.Path(__file__).parent / "demo_dataset.npz"

# Number of trajectories per regime stored in the demo dataset.
# 100 × 3 regimes × 100 steps × float16 ≈ 300–500 KB compressed.
DEMO_N_PER_REGIME = 100


# ---------------------------------------------------------------------------
# HK Observatory monthly climate normals (1991-2020)
# Source: Hong Kong Observatory, Climatological Normals of Hong Kong 1991-2020
#
# Each row: (temp_mean °C, temp_std °C,
#            humidity_mean fraction, humidity_std fraction,
#            rainfall_mmday_mean,
#            uv_index_mean, wind_ms_mean, wind_ms_std)
# ---------------------------------------------------------------------------

HK_MONTHLY_CLIMATE = [
    (16.3, 2.5, 0.72, 0.08,  0.74, 3.5, 3.2, 0.8),  # Jan
    (16.8, 2.5, 0.80, 0.06,  1.71, 4.0, 2.9, 0.8),  # Feb
    (19.1, 2.5, 0.82, 0.05,  2.16, 5.0, 2.8, 0.8),  # Mar
    (22.9, 2.0, 0.83, 0.05,  4.57, 7.0, 2.6, 0.7),  # Apr
    (26.2, 1.8, 0.83, 0.04,  9.42, 8.5, 2.5, 0.7),  # May
    (28.4, 1.5, 0.82, 0.04, 13.13, 9.5, 2.8, 0.9),  # Jun
    (29.0, 1.3, 0.81, 0.04, 12.29,10.0, 3.0, 1.0),  # Jul
    (28.6, 1.3, 0.81, 0.04, 11.84, 9.5, 3.0, 1.0),  # Aug
    (27.9, 1.5, 0.78, 0.05,  8.57, 8.0, 3.1, 1.0),  # Sep
    (25.4, 1.8, 0.72, 0.06,  3.23, 6.5, 3.5, 0.9),  # Oct
    (21.4, 2.0, 0.70, 0.07,  1.23, 4.5, 3.7, 0.8),  # Nov
    (17.6, 2.5, 0.68, 0.08,  0.68, 3.0, 3.6, 0.8),  # Dec
]

# Probability that any given week contains a significant typhoon event, by month.
# Derived from HK Observatory typhoon statistics (1961-2020 averages).
HK_TYPHOON_WEEKLY_PROB = [
    0.000,  # Jan
    0.000,  # Feb
    0.000,  # Mar
    0.002,  # Apr
    0.012,  # May
    0.040,  # Jun
    0.060,  # Jul
    0.070,  # Aug — historical peak
    0.060,  # Sep — historical peak
    0.040,  # Oct
    0.012,  # Nov
    0.002,  # Dec
]


# ---------------------------------------------------------------------------
# Arrhenius battery degradation — calibrated to NASA PCOE dataset
# Ea = 0.60 eV (NMC Li-ion), reference temperature 25 °C.
# k0 chosen so that at 25 °C, battery reaches 80 % SoH after ~133 weeks
# (~2.5 years), matching the NASA PCOE median for NMC cells under
# standard cycling conditions in a room-temperature environment.
# ---------------------------------------------------------------------------

_BATT_EA_EV  = 0.60
_BATT_KB_EV  = 8.617e-5   # Boltzmann constant in eV/K
_BATT_T_REF  = 298.15     # 25 °C in Kelvin
_BATT_K0     = 1.50e-3    # capacity loss per week at T_ref


def _batt_decay_rate(temp_c: float) -> float:
    """Arrhenius capacity-loss rate (fraction per week)."""
    T_K = temp_c + 273.15
    exponent = (-_BATT_EA_EV / _BATT_KB_EV) * (1.0 / T_K - 1.0 / _BATT_T_REF)
    return _BATT_K0 * math.exp(exponent)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def _gauss(mean: float, std: float) -> float:
    return random.gauss(mean, std)


def _rand(lo: float, hi: float) -> float:
    return lo + random.random() * (hi - lo)


# ---------------------------------------------------------------------------
# Environmental state sampling and dynamics
# ---------------------------------------------------------------------------

def _sample_env5_for_month(month: int) -> list[float]:
    """
    Sample [temp, humidity, rainfall_mmday, wind_ms, uv_index] from the
    HK Observatory distribution for the given month.
    Vibration is deployment-site-specific and handled separately.
    """
    temp_m, temp_s, hum_m, hum_s, rain_m, uv_m, wind_m, wind_s = HK_MONTHLY_CLIMATE[month]

    temp     = _clamp(_gauss(temp_m, temp_s), 8.0, 42.0)
    humidity = _clamp(_gauss(hum_m, hum_s), 0.40, 0.99)
    # Rainfall is log-ish distributed; clip a Gaussian at zero
    rainfall = max(0.0, _gauss(rain_m, rain_m * 0.65))
    wind     = max(0.0, _gauss(wind_m, wind_s))
    uv       = _clamp(_gauss(uv_m, 1.0), 0.0, 12.0)

    return [temp, humidity, rainfall, wind, uv]


def _apply_typhoon_to_env5(env5: list[float]) -> list[float]:
    """Superimpose typhoon conditions: max wind, intense rain, high humidity, low UV."""
    temp, humidity, rainfall, wind, uv = env5
    wind     = _clamp(wind + _rand(22, 42), 0.0, 60.0)
    rainfall = _clamp(rainfall + _rand(65, 155), 0.0, 220.0)
    humidity = _clamp(humidity + _rand(0.04, 0.12), 0.0, 0.99)
    uv       = _clamp(uv * 0.25, 0.0, 12.0)  # heavy cloud cover reduces UV
    return [temp, humidity, rainfall, wind, uv]


def _apply_action_to_env5(env5: list[float], action_name: Optional[str]) -> list[float]:
    """Modify env state according to the applied stress action."""
    if not action_name or action_name == "none":
        return env5
    temp, humidity, rainfall, wind, uv = env5
    if action_name == "typhoon_load":
        return _apply_typhoon_to_env5(env5)
    elif action_name == "heat_cycle":
        temp = _clamp(temp + _rand(5, 13), 8.0, 48.0)
    elif action_name == "humidity_soak":
        humidity = _clamp(humidity + _rand(0.06, 0.18), 0.0, 0.99)
        rainfall = _clamp(rainfall + _rand(8, 35), 0.0, 220.0)
    elif action_name == "UV_exposure":
        uv = _clamp(uv + _rand(2, 4), 0.0, 12.0)
    # vibration_burst does not affect env5; handled in component degradation
    return [temp, humidity, rainfall, wind, uv]


def _drift_env5(env5: list[float], month: int) -> list[float]:
    """
    Mean-reverting weekly drift: env state pulls back toward seasonal normal
    with added Gaussian noise.  Mean-reversion coefficient 0.25 per week.
    """
    temp_m, temp_s, hum_m, hum_s, rain_m, uv_m, wind_m, wind_s = HK_MONTHLY_CLIMATE[month]
    temp, humidity, rainfall, wind, uv = env5
    k = 0.25  # reversion speed

    temp     = _clamp(temp * (1 - k) + temp_m * k + _gauss(0, temp_s * 0.35), 8.0, 42.0)
    humidity = _clamp(humidity * (1 - k) + hum_m * k + _gauss(0, hum_s * 0.30), 0.40, 0.99)
    rainfall = max(0.0, rainfall * 0.55 + rain_m * 0.45 * _rand(0.2, 1.8))
    wind     = max(0.0, wind * 0.65 + wind_m * 0.35 + _gauss(0, wind_s * 0.35))
    uv       = _clamp(uv * 0.75 + uv_m * 0.25 + _gauss(0, 0.5), 0.0, 12.0)

    return [temp, humidity, rainfall, wind, uv]


# ---------------------------------------------------------------------------
# Component degradation physics
# ---------------------------------------------------------------------------

def _degrade_components(
    comp: list[float],
    env5: list[float],
    vibration: float,
    action_name: Optional[str],
) -> tuple[list[float], list[float]]:
    """
    Apply one week of physical degradation.

    Returns:
        next_comp  : updated [seal, pcb, battery, corrosion,
                              moist_drift, crack_drift, tilt_drift]
        fail_probs : [p_moisture, p_thermal, p_seal, p_bracket]
    """
    seal, pcb, battery, corrosion, moist_drift, crack_drift, tilt_drift = comp
    temp, humidity, rainfall, wind, uv = env5

    # Hidden failure trigger: the core non-linear interaction
    # Individually each stressor causes moderate damage.
    # Together they produce catastrophic moisture ingress.
    hidden_trigger = (humidity > 0.85) and (seal < 0.40) and (vibration > 0.30)

    # ── Enclosure seal (EPDM rubber) ─────────────────────────────────────────
    # Three degradation mechanisms:
    #   1. UV photodegradation (chain scission): rate ∝ UV dose
    #      Calibrated so UV=10 (HK summer) drives seal from 1.0→0.55 in ~300 weeks
    #   2. Hygroscopic cycling: repeated swelling/shrinkage at high RH
    #   3. Rainfall mechanical washing of lubricants + micro-crack propagation
    seal_uv   = 1.30e-4 * uv
    seal_hum  = 7.50e-4 * max(0.0, humidity - 0.60)
    seal_rain = 1.10e-3 * (rainfall / 150.0)
    seal_decay = seal_uv + seal_hum + seal_rain
    if action_name == "UV_exposure":
        seal_decay *= 1.90  # sustained UV irradiance compounds photodegradation
    seal = _clamp(seal - seal_decay)

    # ── PCB health ────────────────────────────────────────────────────────────
    # Electrochemical migration driven by humidity²; thermal stress at high temp.
    # Catastrophic collapse on hidden trigger (moisture ingress through failed seal).
    pcb_hum_decay  = 8.50e-4 * humidity ** 2
    pcb_heat_decay = 6.00e-4 * max(0.0, (temp - 30.0) / 8.0)
    pcb_decay      = pcb_hum_decay + pcb_heat_decay
    if hidden_trigger:
        # Moisture ingress: ionic contamination → leakage current → PCB collapse
        pcb_decay += 0.055 * (1.0 - seal) * humidity
    pcb = _clamp(pcb - pcb_decay)

    # ── Battery SoH (Li-ion, Arrhenius) ──────────────────────────────────────
    # At 25 °C: ~80 % SoH at 2.5 years (133 weeks) — matches NASA PCOE median.
    # At 38 °C (HK summer peak): ~2.7× faster than at 25 °C.
    # At 16 °C (HK winter): ~0.60× rate.
    batt_decay = _batt_decay_rate(temp)
    battery    = _clamp(battery - batt_decay)

    # ── Bracket corrosion (ISO 9223 C4/C5 coastal) ────────────────────────────
    # Monotonically increasing. Driven by humidity (electrochemical) + rainfall
    # (chloride deposition proxy for coastal HK environment).
    corr_gain = 1.55e-3 * humidity + 8.50e-4 * (rainfall / 150.0)
    corrosion = _clamp(corrosion + corr_gain, 0.0, 1.0)

    # ── Sensor drift ──────────────────────────────────────────────────────────
    # Moisture sensor drift: hygroscopic film on sensing element; accelerated
    # when seal is compromised (water path to PCB surface).
    moist_drift = _clamp(moist_drift + 1.70e-3 * humidity * (1.0 + 0.8 * (1.0 - seal)))
    # Crack sensor drift: vibration fatigue of bonding wires.
    crack_drift = _clamp(crack_drift + 1.40e-3 * vibration)
    # Tilt sensor drift: mounting stress from wind load + vibration.
    tilt_drift  = _clamp(tilt_drift  + 7.00e-4 * vibration + 4.00e-4 * (wind / 45.0))

    next_comp = [seal, pcb, battery, corrosion, moist_drift, crack_drift, tilt_drift]

    # ── Failure probabilities ─────────────────────────────────────────────────

    # p_moisture: seal failure × humidity exposure.
    # Non-linear in seal (accelerates sharply near 0).
    seal_factor = (1.0 - seal) ** 1.5
    hum_factor  = max(0.0, (humidity - 0.55) / 0.44)
    p_moisture  = _clamp(seal_factor * hum_factor * (2.2 if hidden_trigger else 1.0))

    # p_thermal: internal overheating given sealed enclosure.
    # Enclosure ΔT estimated from worldmodel.md formula ΔT = P / (k·A):
    # rough proxy: internal_temp ≈ ambient + 15 °C under degraded thermal path.
    internal_temp = temp + 15.0 * (1.0 - pcb)
    temp_factor   = max(0.0, (internal_temp - 45.0) / 20.0)
    p_thermal     = _clamp(temp_factor * (1.0 - battery) * 2.5)

    # p_seal: probability seal fails this week given current integrity.
    p_seal = _clamp((1.0 - seal) ** 1.8 + 0.07 * (uv / 11.0))

    # p_bracket: corrosion × wind loading (quadratic — structural dynamics).
    wind_load = (wind / 45.0) ** 2
    p_bracket = _clamp(corrosion ** 1.2 * wind_load * 3.2)

    fail_probs = [
        _clamp(p_moisture),
        _clamp(p_thermal),
        _clamp(p_seal),
        _clamp(p_bracket),
    ]
    return next_comp, fail_probs


# ---------------------------------------------------------------------------
# Event-based action sampler
# ---------------------------------------------------------------------------

_ACTION_MAP = {name: i for i, name in enumerate(ACTION_NAMES)}


@dataclass
class _Event:
    action_name: Optional[str]
    remaining: int


def _sample_event(
    regime: str,
    month: int,
    dominant_action: Optional[str],
) -> _Event:
    """
    Sample the next stress event (action + duration) for a trajectory.

    Durations are physically motivated:
      typhoon_load   : 1–3 weeks  (realistic HK typhoon influence period)
      heat_cycle     : 2–8 weeks  (heat wave duration)
      humidity_soak  : 2–6 weeks  (monsoon spell)
      vibration_burst: 1–4 weeks  (sustained MTR proximity vibration)
      UV_exposure    : 2–8 weeks  (clear-sky summer period)
      none (idle)    : 1–5 weeks
    """
    # Regime B: one dominant action type holds for most of the trajectory
    if regime == "stressed" and dominant_action is not None:
        if random.random() < 0.78:
            return _Event(dominant_action, random.randint(3, 10))
        return _Event(None, random.randint(1, 3))

    is_wet_season = month in (4, 5, 6, 7, 8, 9)   # May–Oct
    is_hot_season = month in (5, 6, 7, 8, 9)        # Jun–Oct
    typhoon_prob  = HK_TYPHOON_WEEKLY_PROB[month] * 7  # scale to ~event horizon

    weights: dict[str, float] = {
        "none":            0.38 if regime == "normal" else 0.08,
        "typhoon_load":    min(0.45, typhoon_prob),
        "heat_cycle":      0.14 if is_hot_season else 0.04,
        "humidity_soak":   0.18 if is_wet_season else 0.07,
        "vibration_burst": 0.10 if regime == "catastrophic" else 0.05,
        "UV_exposure":     0.12 if is_hot_season else 0.04,
    }

    if regime == "catastrophic":
        # Bias toward the hidden interaction: humidity + vibration
        weights["humidity_soak"]   *= 2.6
        weights["vibration_burst"] *= 2.6
        weights["typhoon_load"]    *= 1.9

    total  = sum(weights.values())
    keys   = list(weights.keys())
    probs  = [weights[k] / total for k in keys]
    chosen = random.choices(keys, weights=probs, k=1)[0]

    durations: dict[str, int] = {
        "none":            random.randint(1, 5),
        "typhoon_load":    random.randint(1, 3),
        "heat_cycle":      random.randint(2, 8),
        "humidity_soak":   random.randint(2, 6),
        "vibration_burst": random.randint(1, 4),
        "UV_exposure":     random.randint(2, 8),
    }
    action = chosen if chosen != "none" else None
    return _Event(action, durations[chosen])


# ---------------------------------------------------------------------------
# Initial component state per regime
# ---------------------------------------------------------------------------

def _initial_component_state(regime: str) -> list[float]:
    if regime == "normal":
        return [
            _rand(0.85, 1.00),   # seal: new/good
            _rand(0.90, 1.00),   # pcb
            _rand(0.88, 1.00),   # battery
            _rand(0.00, 0.05),   # corrosion: minimal
            _rand(0.00, 0.03),   # moist_drift
            _rand(0.00, 0.03),   # crack_drift
            _rand(0.00, 0.03),   # tilt_drift
        ]
    elif regime == "stressed":
        return [
            _rand(0.55, 0.85),   # seal: partially degraded
            _rand(0.75, 0.95),   # pcb
            _rand(0.70, 0.90),   # battery
            _rand(0.05, 0.22),   # corrosion: visible
            _rand(0.02, 0.10),   # moist_drift
            _rand(0.02, 0.10),   # crack_drift
            _rand(0.01, 0.08),   # tilt_drift
        ]
    else:  # catastrophic — seal near or below hidden-trigger threshold
        return [
            _rand(0.12, 0.45),   # seal: critically degraded (trigger zone: < 0.40)
            _rand(0.58, 0.90),   # pcb: partially degraded
            _rand(0.50, 0.85),   # battery: degraded
            _rand(0.15, 0.42),   # corrosion: significant
            _rand(0.05, 0.22),   # moist_drift
            _rand(0.05, 0.22),   # crack_drift
            _rand(0.03, 0.16),   # tilt_drift
        ]


# ---------------------------------------------------------------------------
# Trajectory simulation
# ---------------------------------------------------------------------------

@dataclass
class SimConfig:
    n_trajectories: int   = 10_000
    n_timesteps:    int   = 100
    lambda_physics: float = 0.1


def simulate_trajectory(cfg: SimConfig, regime: str = "normal"):
    """
    Simulate one BuildGuard Node trajectory.

    1 timestep = 1 week of outdoor field deployment in Hong Kong.
    Environmental state follows HK Observatory monthly normals with
    mean-reverting noise.  Degradation physics use Arrhenius (battery),
    photodegradation (seal), ISO 9223 C4/C5 (corrosion).

    Args:
        cfg    : simulation configuration
        regime : 'normal' | 'stressed' | 'catastrophic'

    Returns:
        (env_states, component_states, action_indices, failure_labels)
        — each a list of length n_timesteps.
        env_states[t]       : [temp, hum, rain, wind, uv, vib] at step t
        component_states[t] : [seal, pcb, batt, corr, md, cd, td] at step t
        action_indices[t]   : int | None
        failure_labels[t]   : [p_moisture, p_thermal, p_seal, p_bracket]
    """
    # Deployment location: MTR proximity determines base vibration.
    # Reflects installation context; fixed for the life of a trajectory.
    proximity = random.random()
    if proximity < 0.20:
        base_vib = _rand(0.15, 0.50)   # on or adjacent to MTR structure
    elif proximity < 0.65:
        base_vib = _rand(0.03, 0.15)   # typical urban HK building
    else:
        base_vib = _rand(0.01, 0.03)   # quiet residential / hillside location

    # Stressed regime: one dominant action type biases the whole trajectory
    dominant_action: Optional[str] = None
    if regime == "stressed":
        dominant_action = random.choice(ACTION_NAMES)

    # Starting month.  Catastrophic regime biased toward typhoon season.
    if regime == "catastrophic":
        month = random.choices(
            range(12),
            weights=[1, 1, 1, 1, 2, 4, 5, 5, 4, 3, 2, 1],
            k=1,
        )[0]
    else:
        month = random.randint(0, 11)

    comp = _initial_component_state(regime)
    env5 = _sample_env5_for_month(month)  # 5-element: no vibration yet

    env_states:       list = []
    component_states: list = []
    action_indices:   list = []
    failure_labels:   list = []

    event = _sample_event(regime, month, dominant_action)

    for step in range(cfg.n_timesteps):
        # Advance calendar: 1 month ≈ 4 weeks
        if step > 0 and step % 4 == 0:
            month = (month + 1) % 12

        # Event state machine
        if event.remaining <= 0:
            event = _sample_event(regime, month, dominant_action)
        action_name = event.action_name
        event.remaining -= 1

        # Effective vibration this week
        if action_name == "vibration_burst":
            effective_vib = _clamp(base_vib + _rand(0.35, 1.20), 0.0, 2.5)
        else:
            effective_vib = _clamp(base_vib + _gauss(0.0, 0.008), 0.0, 2.5)

        # Apply stress action to environment
        env5_stressed = _apply_action_to_env5(list(env5), action_name)

        # Full 6-element env state for this timestep
        env_full = env5_stressed + [effective_vib]

        # Record state BEFORE degradation (input to model at this step)
        env_states.append(list(env_full))
        component_states.append(list(comp))
        action_idx = _ACTION_MAP.get(action_name) if action_name else None
        action_indices.append(action_idx)

        # Degrade components, compute failure probabilities
        next_comp, fail_probs = _degrade_components(
            list(comp), env5_stressed, effective_vib, action_name
        )
        failure_labels.append(fail_probs)

        # Prepare next step
        env5 = _drift_env5(env5_stressed, month)
        comp = next_comp

    return env_states, component_states, action_indices, failure_labels


# ---------------------------------------------------------------------------
# Dataset generation — stratified 50 / 20 / 30
# ---------------------------------------------------------------------------

def generate_dataset(cfg: SimConfig) -> dict:
    """
    Generate the full training dataset with stratified regime sampling.

    Regime split:
      50 % normal      — baseline dynamics, slow degradation
      20 % stressed    — one dominant stressor for the full trajectory
      30 % catastrophic — seal pre-degraded into hidden-trigger zone;
                          events biased toward compound stressors.

    The 30 % catastrophic oversample is critical: without it the model
    almost never trains on the non-linear interaction zone and cannot
    learn to predict the catastrophic failure mode.
    """
    n_normal  = int(0.50 * cfg.n_trajectories)
    n_stressed= int(0.20 * cfg.n_trajectories)
    n_catast  = cfg.n_trajectories - n_normal - n_stressed

    regime_schedule = (
        [("normal",       n_normal)]
        + [("stressed",   n_stressed)]
        + [("catastrophic", n_catast)]
    )

    all_inputs:       list = []
    all_env_targets:  list = []
    all_comp_targets: list = []
    all_fail_targets: list = []

    traj_idx = 0
    for regime, count in regime_schedule:
        print(f"  Generating {count} '{regime}' trajectories…")
        for _ in range(count):
            env_s, comp_s, act_idxs, fail_lbls = simulate_trajectory(cfg, regime)
            T = cfg.n_timesteps

            inputs:    list = []
            env_tgts:  list = []
            comp_tgts: list = []
            fail_tgts: list = []

            for t in range(T - 1):
                env_t  = torch.tensor(env_s[t],   dtype=torch.float32)
                comp_t = torch.tensor(comp_s[t],  dtype=torch.float32)
                x      = build_input(env_t, comp_t, act_idxs[t])
                inputs.append(x)
                env_tgts.append(torch.tensor(env_s[t + 1],   dtype=torch.float32))
                comp_tgts.append(torch.tensor(comp_s[t + 1], dtype=torch.float32))
                fail_tgts.append(torch.tensor(fail_lbls[t + 1], dtype=torch.float32))

            all_inputs.append(torch.stack(inputs))
            all_env_targets.append(torch.stack(env_tgts))
            all_comp_targets.append(torch.stack(comp_tgts))
            all_fail_targets.append(torch.stack(fail_tgts))

            traj_idx += 1
            if traj_idx % 1000 == 0:
                print(f"    {traj_idx}/{cfg.n_trajectories} trajectories generated")

    return {
        "inputs":       torch.stack(all_inputs),
        "env_targets":  torch.stack(all_env_targets),
        "comp_targets": torch.stack(all_comp_targets),
        "fail_targets": torch.stack(all_fail_targets),
    }


# ---------------------------------------------------------------------------
# Dataset / DataLoader
# ---------------------------------------------------------------------------

class TrajectoryDataset(Dataset):
    def __init__(self, data: dict):
        self.inputs       = data["inputs"]
        self.env_targets  = data["env_targets"]
        self.comp_targets = data["comp_targets"]
        self.fail_targets = data["fail_targets"]

    def __len__(self):
        return len(self.inputs)

    def __getitem__(self, idx):
        return (
            self.inputs[idx],
            self.env_targets[idx],
            self.comp_targets[idx],
            self.fail_targets[idx],
        )


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

@dataclass
class TrainConfig:
    n_epochs:       int   = 50
    batch_size:     int   = 256
    lr:             float = 1e-3
    lambda_physics: float = 0.1
    device:         str   = "cpu"
    patience:       int   = 7       # early stopping: epochs without val improvement
    val_fraction:   float = 0.10    # fraction of dataset held out for validation
    sim: SimConfig        = field(default_factory=SimConfig)


_training_status: dict = {
    "state":        "idle",
    "epoch":        0,
    "total_epochs": 0,
    "loss":         None,
    "val_loss":     None,
    "loss_history": [],
    "error":        None,
}


def get_training_status() -> dict:
    return dict(_training_status)


def _compute_losses(
    model: WorldModel,
    loader: DataLoader,
    device: torch.device,
    lambda_physics: float,
) -> dict[str, float]:
    """Evaluate all loss heads on a dataloader without gradient computation."""
    model.eval()
    totals = dict(total=0.0, env=0.0, comp=0.0, fail=0.0, physics=0.0)
    n = 0
    with torch.no_grad():
        for inputs, env_tgt, comp_tgt, fail_tgt in loader:
            inputs   = inputs.to(device)
            env_tgt  = env_tgt.to(device)
            comp_tgt = comp_tgt.to(device)
            fail_tgt = fail_tgt.to(device)

            env_pred, comp_pred, fail_pred, _ = model(inputs)

            env_l   = nn.functional.mse_loss(env_pred, env_tgt).item()
            comp_l  = nn.functional.mse_loss(comp_pred, comp_tgt).item()
            fail_l  = nn.functional.binary_cross_entropy(fail_pred, fail_tgt).item()
            phys_l  = physics_loss(comp_pred, env_pred, comp_tgt, lambda_physics).item()

            totals["env"]     += env_l
            totals["comp"]    += comp_l
            totals["fail"]    += fail_l
            totals["physics"] += phys_l
            totals["total"]   += env_l + comp_l + fail_l + phys_l
            n += 1

    return {k: v / n for k, v in totals.items()}


def _plot_training_curves(history: dict, best_epoch: int, stopped_epoch: int) -> None:
    """Save training_curves.png with all tracked loss components."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    epochs = list(range(1, len(history["train_total"]) + 1))

    fig, axes = plt.subplots(2, 2, figsize=(14, 9), dpi=120)
    fig.patch.set_facecolor("#0f1117")

    panels = [
        (axes[0][0], "Total loss",          "train_total",   "val_total"),
        (axes[0][1], "Component state MSE", "train_comp",    "val_comp"),
        (axes[1][0], "Failure prob BCE",    "train_fail",    "val_fail"),
        (axes[1][1], "Physics penalty",     "train_physics", "val_physics"),
    ]

    for ax, title, train_key, val_key in panels:
        ax.set_facecolor("#1a1d27")
        ax.tick_params(colors="#aaaaaa", labelsize=8)
        ax.spines[:].set_color("#333344")
        ax.grid(color="#2a2a3a", linewidth=0.5, linestyle="--")

        ax.plot(epochs, history[train_key], color="#2196F3", linewidth=1.8, label="Train")
        ax.plot(epochs, history[val_key],   color="#FF9800", linewidth=1.8,
                linestyle="--", label="Validation")

        ax.axvline(best_epoch,    color="#4CAF50", linewidth=1.2,
                   linestyle=":", label=f"Best epoch ({best_epoch})")
        if stopped_epoch < len(epochs):
            ax.axvline(stopped_epoch, color="#F44336", linewidth=1.2,
                       linestyle=":", label=f"Early stop ({stopped_epoch})")

        ax.set_title(title, fontsize=10, color="#cccccc", pad=6)
        ax.set_xlabel("Epoch", fontsize=8, color="#aaaaaa")
        ax.legend(fontsize=7.5, facecolor="#1a1d27", edgecolor="#333344",
                  labelcolor="#cccccc")

    fig.suptitle(
        f"BuildGuard World Model — Training curves\n"
        f"Best val loss at epoch {best_epoch}  |  "
        f"Early stop at epoch {stopped_epoch}  |  "
        f"Patience {stopped_epoch - best_epoch} epochs",
        fontsize=10, color="#888899",
    )
    plt.tight_layout()
    out = pathlib.Path(__file__).parent / "training_curves.png"
    fig.savefig(out, dpi=120, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"Training curves saved → {out}")


def train(cfg: TrainConfig | None = None) -> WorldModel:
    global _training_status
    if cfg is None:
        cfg = TrainConfig()

    device = torch.device(
        "cuda" if torch.cuda.is_available() and cfg.device != "cpu" else "cpu"
    )

    _training_status = {
        "state":        "generating",
        "epoch":        0,
        "total_epochs": cfg.n_epochs,
        "loss":         None,
        "val_loss":     None,
        "loss_history": [],
        "error":        None,
    }

    try:
        print("Generating synthetic dataset (stratified HK environment)…")
        data    = generate_dataset(cfg.sim)
        dataset = TrajectoryDataset(data)

        # Train / validation split
        n_val   = max(1, int(len(dataset) * cfg.val_fraction))
        n_train = len(dataset) - n_val
        train_ds, val_ds = torch.utils.data.random_split(
            dataset, [n_train, n_val],
            generator=torch.Generator().manual_seed(42),
        )
        train_loader = DataLoader(train_ds, batch_size=cfg.batch_size,
                                  shuffle=True,  num_workers=0)
        val_loader   = DataLoader(val_ds,   batch_size=cfg.batch_size,
                                  shuffle=False, num_workers=0)

        model     = WorldModel().to(device)
        optimizer = torch.optim.Adam(model.parameters(), lr=cfg.lr)

        # Per-head loss history for plotting
        history: dict[str, list] = {
            "train_total": [], "train_env": [], "train_comp": [],
            "train_fail":  [], "train_physics": [],
            "val_total":   [], "val_env":   [], "val_comp":   [],
            "val_fail":    [], "val_physics":   [],
        }

        best_val_loss  = float("inf")
        best_epoch     = 1
        patience_count = 0
        stopped_epoch  = cfg.n_epochs   # updated if early stopping fires

        _training_status["state"] = "training"
        print(
            f"Training {n_train} / val {n_val} trajectories, "
            f"up to {cfg.n_epochs} epochs, patience={cfg.patience}, device={device}…"
        )

        for epoch in range(1, cfg.n_epochs + 1):
            # ── Train pass ──────────────────────────────────────────────────
            model.train()
            t_env = t_comp = t_fail = t_phys = 0.0
            n = 0

            for inputs, env_tgt, comp_tgt, fail_tgt in train_loader:
                inputs   = inputs.to(device)
                env_tgt  = env_tgt.to(device)
                comp_tgt = comp_tgt.to(device)
                fail_tgt = fail_tgt.to(device)

                optimizer.zero_grad()
                env_pred, comp_pred, fail_pred, _ = model(inputs)

                env_l  = nn.functional.mse_loss(env_pred, env_tgt)
                comp_l = nn.functional.mse_loss(comp_pred, comp_tgt)
                fail_l = nn.functional.binary_cross_entropy(fail_pred, fail_tgt)
                phys_l = physics_loss(comp_pred, env_pred, comp_tgt, cfg.lambda_physics)
                loss   = env_l + comp_l + fail_l + phys_l

                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optimizer.step()

                t_env  += env_l.item();  t_comp += comp_l.item()
                t_fail += fail_l.item(); t_phys += phys_l.item()
                n += 1

            train_losses = {
                "total":   (t_env + t_comp + t_fail + t_phys) / n,
                "env":     t_env  / n,
                "comp":    t_comp / n,
                "fail":    t_fail / n,
                "physics": t_phys / n,
            }

            # ── Validation pass ─────────────────────────────────────────────
            val_losses = _compute_losses(model, val_loader, device, cfg.lambda_physics)

            # ── Record ──────────────────────────────────────────────────────
            for k in ("total", "env", "comp", "fail", "physics"):
                history[f"train_{k}"].append(train_losses[k])
                history[f"val_{k}"].append(val_losses[k])

            _training_status["epoch"]   = epoch
            _training_status["loss"]    = train_losses["total"]
            _training_status["val_loss"]= val_losses["total"]
            _training_status["loss_history"].append(train_losses["total"])

            print(
                f"  Epoch {epoch:>3}/{cfg.n_epochs} — "
                f"train={train_losses['total']:.4f}  "
                f"val={val_losses['total']:.4f}  "
                f"(env={val_losses['env']:.3f} "
                f"comp={val_losses['comp']:.3f} "
                f"fail={val_losses['fail']:.3f} "
                f"phys={val_losses['physics']:.4f})"
            )

            # ── Early stopping ───────────────────────────────────────────────
            if val_losses["total"] < best_val_loss:
                best_val_loss  = val_losses["total"]
                best_epoch     = epoch
                patience_count = 0
                torch.save(model.state_dict(), MODEL_PATH)   # save best checkpoint
            else:
                patience_count += 1
                if patience_count >= cfg.patience:
                    stopped_epoch = epoch
                    print(
                        f"\n  Early stopping at epoch {epoch} "
                        f"(best val loss {best_val_loss:.4f} at epoch {best_epoch})"
                    )
                    break

        # If we exhausted all epochs without early stop, save the last model
        # only if it wasn't already saved as the best
        if patience_count < cfg.patience:
            stopped_epoch = cfg.n_epochs
            if best_epoch != cfg.n_epochs:
                # Last epoch was not the best; best already saved
                pass

        # Reload best weights
        model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu", weights_only=True))
        model.eval()

        with open(TRAINING_LOG_PATH, "w") as f:
            json.dump({"train": history["train_total"], "val": history["val_total"]}, f)

        _plot_training_curves(history, best_epoch, stopped_epoch)

        print("Saving demo dataset…")
        save_demo_dataset()

        _training_status["state"] = "done"
        print(f"Best model (epoch {best_epoch}) saved → {MODEL_PATH}")
        return model

    except Exception as exc:
        _training_status["state"] = "error"
        _training_status["error"] = str(exc)
        raise


def save_demo_dataset(n_per_regime: int = DEMO_N_PER_REGIME) -> None:
    """
    Generate and persist a compact representative dataset for frontend use.

    Stores n_per_regime trajectories for each of the three regimes
    (normal / stressed / catastrophic) as float16 arrays in a single
    compressed npz file.  Actions are stored as int8 (−1 = no action).

    Output keys:
        {regime}_env     : (N, T, 6)  float16  — environmental state
        {regime}_comp    : (N, T, 7)  float16  — component state
        {regime}_fail    : (N, T, 4)  float16  — failure probabilities
        {regime}_actions : (N, T)     int8     — action indices, −1 = none
    """
    cfg = SimConfig(n_trajectories=n_per_regime, n_timesteps=100)
    arrays: dict[str, np.ndarray] = {}

    for regime in ("normal", "stressed", "catastrophic"):
        env_list, comp_list, act_list, fail_list = [], [], [], []
        for _ in range(n_per_regime):
            env_s, comp_s, acts, fails = simulate_trajectory(cfg, regime)
            env_list.append(env_s)
            comp_list.append(comp_s)
            act_list.append([-1 if a is None else a for a in acts])
            fail_list.append(fails)

        arrays[f"{regime}_env"]     = np.array(env_list,  dtype=np.float16)   # (N, T, 6)
        arrays[f"{regime}_comp"]    = np.array(comp_list, dtype=np.float16)   # (N, T, 7)
        arrays[f"{regime}_fail"]    = np.array(fail_list, dtype=np.float16)   # (N, T, 4)
        arrays[f"{regime}_actions"] = np.array(act_list,  dtype=np.int8)      # (N, T)

    np.savez_compressed(DEMO_DATASET_PATH, **arrays)
    size_kb = DEMO_DATASET_PATH.stat().st_size / 1024
    print(f"Demo dataset saved → {DEMO_DATASET_PATH}  ({size_kb:.1f} KB)")


def load_or_train(force_retrain: bool = False) -> WorldModel:
    model = WorldModel()
    if MODEL_PATH.exists() and not force_retrain:
        model.load_state_dict(
            torch.load(MODEL_PATH, map_location="cpu", weights_only=True)
        )
        print(f"Loaded model from {MODEL_PATH}")
        _training_status["state"] = "done"
    else:
        model = train()
    model.eval()
    return model


# ---------------------------------------------------------------------------
# CEM Planner
# ---------------------------------------------------------------------------

@dataclass
class CEMConfig:
    horizon:      int = 40
    n_samples:    int = 200
    n_elites:     int = 20
    n_iterations: int = 5
    device:       str = "cpu"


def cem_plan(
    model: WorldModel,
    env_state_0: list,
    comp_state_0: list,
    cfg: CEMConfig | None = None,
) -> list:
    """
    Cross Entropy Method planner.

    Searches over action sequences of length cfg.horizon to find the
    protocol that maximises component failure probabilities and minimises
    time-to-failure.  Uses the world model as a differentiable forward
    simulator — no RL, no environment interaction.

    Returns best action sequence (list[int | None]) of length cfg.horizon.
    """
    if cfg is None:
        cfg = CEMConfig()

    device = torch.device(cfg.device)
    model.eval()
    model.to(device)

    T      = cfg.horizon
    N      = cfg.n_samples
    K      = cfg.n_elites
    n_iter = cfg.n_iterations
    n_opts = len(ACTION_NAMES) + 1   # +1 for "none"

    env0  = torch.tensor(env_state_0,  dtype=torch.float32, device=device)
    comp0 = torch.tensor(comp_state_0, dtype=torch.float32, device=device)

    # Uniform initial distribution over actions
    action_probs = torch.ones(T, n_opts, device=device) / n_opts

    best_sequence: list = [None] * T
    best_score = -float("inf")

    with torch.no_grad():
        for _it in range(n_iter):
            # Sample N candidate action sequences
            samples = torch.zeros(N, T, dtype=torch.long, device=device)
            for t in range(T):
                samples[:, t] = torch.multinomial(
                    action_probs[t].unsqueeze(0).expand(N, -1),
                    num_samples=1,
                ).squeeze(1)

            scores = torch.zeros(N, device=device)
            env_t  = env0.unsqueeze(0).expand(N, -1).clone()
            comp_t = comp0.unsqueeze(0).expand(N, -1).clone()
            h      = None

            for t in range(T):
                act_idxs    = samples[:, t]
                action_vecs = torch.zeros(N, len(ACTION_NAMES), device=device)
                mask        = act_idxs < len(ACTION_NAMES)
                if mask.any():
                    valid = act_idxs[mask]
                    action_vecs[mask, valid] = 1.0

                x_t = torch.cat([env_t, comp_t, action_vecs], dim=-1)
                env_next, comp_next, fail_next, h = model.step(x_t, h)

                dev_fail  = device_failure_prob(fail_next)
                scores   += fail_next.sum(dim=-1) + dev_fail * 2.0

                env_t  = env_next
                comp_t = comp_next

            # Elite selection
            elite_idxs = torch.topk(scores, k=K).indices
            elite_seqs = samples[elite_idxs]

            top_score = scores[elite_idxs[0]].item()
            if top_score > best_score:
                best_score    = top_score
                best_sequence = [
                    (
                        int(elite_seqs[0, t].item())
                        if int(elite_seqs[0, t].item()) < len(ACTION_NAMES)
                        else None
                    )
                    for t in range(T)
                ]

            # Refit sampling distribution from elite set
            for t in range(T):
                counts           = torch.bincount(elite_seqs[:, t], minlength=n_opts).float()
                action_probs[t]  = (counts + 1.0) / (counts.sum() + n_opts)

    return best_sequence


if __name__ == "__main__":
    print("Starting training…")
    train()
    print("Done.")
