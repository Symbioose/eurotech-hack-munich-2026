"""
Model evaluation script for the BuildGuard Node world model.

Generates a held-out test set (never seen during training), then evaluates
the model in two modes:

  1. Teacher-forced  — ground-truth state fed at every step; measures
                       single-step prediction accuracy per component.
  2. Autoregressive  — model's own predictions fed as the next input;
                       measures multi-step rollout drift (the mode the
                       CEM planner actually uses).

Logs a per-component error table to stdout and saves:
  eval_teacher.png   — predicted vs actual for each component (teacher-forced)
  eval_autoregressive.png — rollout drift across 100 steps per regime

Run:
  uv run python3 evaluate.py
"""
from __future__ import annotations

import sys
import torch
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from model import (
    WorldModel, build_input, device_failure_prob, normalize_env,
    ACTION_NAMES,
)
from training import (
    MODEL_PATH, SimConfig, simulate_trajectory,
)

# ── Config ────────────────────────────────────────────────────────────────────

N_TEST_PER_REGIME = 50          # held-out trajectories per regime
REGIMES = ["normal", "stressed", "catastrophic"]
COLORS  = {"normal": "#2196F3", "stressed": "#FF9800", "catastrophic": "#F44336"}

COMP_NAMES = [
    "seal_integrity",
    "pcb_health",
    "battery_soc",
    "bracket_corrosion",
    "moist_drift",
    "crack_drift",
    "tilt_drift",
]
FAIL_NAMES = [
    "p_moisture",
    "p_thermal",
    "p_seal",
    "p_bracket",
]

# ── Load model ────────────────────────────────────────────────────────────────

if not MODEL_PATH.exists():
    print(f"[ERROR] No trained model found at {MODEL_PATH}")
    print("        Run: uv run python3 training.py")
    sys.exit(1)

print(f"Loading model from {MODEL_PATH} …")
model = WorldModel()
model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu", weights_only=True))
model.eval()
print("Model loaded.\n")

# ── Generate test set ─────────────────────────────────────────────────────────

print(f"Generating held-out test set ({N_TEST_PER_REGIME} trajectories × {len(REGIMES)} regimes) …")
cfg = SimConfig(n_trajectories=N_TEST_PER_REGIME, n_timesteps=100)

test_data: dict[str, list] = {r: [] for r in REGIMES}
for regime in REGIMES:
    for _ in range(N_TEST_PER_REGIME):
        env_s, comp_s, acts, fails = simulate_trajectory(cfg, regime)
        test_data[regime].append((env_s, comp_s, acts, fails))
    print(f"  {regime}: {N_TEST_PER_REGIME} trajectories")

T = cfg.n_timesteps


# ── Evaluation helpers ────────────────────────────────────────────────────────

def teacher_forced_rollout(env_s, comp_s, acts):
    """
    Feed ground-truth state at every step.
    Returns predicted (comp T×7, fail T×4) for steps 1..T
    (one-step-ahead predictions).
    """
    pred_comp = []
    pred_fail = []
    h = None
    with torch.no_grad():
        for t in range(T - 1):
            env_t  = normalize_env(torch.tensor(env_s[t], dtype=torch.float32))
            comp_t = torch.tensor(comp_s[t],  dtype=torch.float32)
            x      = build_input(env_t, comp_t, acts[t]).unsqueeze(0)  # (1, 18)
            _, comp_next, fail_next, h = model.step(x, h)              # (1,7), (1,4)
            pred_comp.append(comp_next.squeeze(0).numpy())
            pred_fail.append(fail_next.squeeze(0).numpy())
    return np.array(pred_comp), np.array(pred_fail)   # (T-1, 7), (T-1, 4)


def autoregressive_rollout(env_s, comp_s, acts):
    """
    Feed the model's own predictions as the next input (no teacher forcing).
    Returns predicted (comp T×7, fail T×4) for steps 1..T.
    Ground-truth env is still used (we don't model the action-env coupling here).
    """
    pred_comp = []
    pred_fail = []
    h = None

    # Work with 1D tensors throughout; only add batch dim for model call
    comp_vec = torch.tensor(comp_s[0], dtype=torch.float32)  # (7,)

    with torch.no_grad():
        for t in range(T - 1):
            env_vec = normalize_env(torch.tensor(env_s[t], dtype=torch.float32))  # (6,) normalised
            x       = build_input(env_vec, comp_vec, acts[t]).unsqueeze(0)  # (1, 18)
            _, comp_next, fail_next, h = model.step(x, h)                   # (1,7), (1,4)

            comp_vec = comp_next.squeeze(0)   # (7,) — fed back as next input
            pred_comp.append(comp_vec.numpy().copy())
            pred_fail.append(fail_next.squeeze(0).numpy().copy())

    return np.array(pred_comp), np.array(pred_fail)


# ── Teacher-forced evaluation ─────────────────────────────────────────────────

print("\n" + "=" * 72)
print("MODE 1 — TEACHER-FORCED  (single-step prediction accuracy)")
print("=" * 72)

header = f"{'Component':<22}" + "".join(f"{r:>18}" for r in REGIMES) + f"{'  OVERALL':>12}"
print(header)
print("-" * len(header))

tf_mae_all: dict[str, dict[str, list]] = {
    "comp": {r: [] for r in REGIMES},
    "fail": {r: [] for r in REGIMES},
}

# Per-component MAE across regimes
comp_mae_by_regime: dict[str, np.ndarray] = {}  # regime → (7,)
fail_mae_by_regime: dict[str, np.ndarray] = {}
fail_pred_by_regime: dict[str, np.ndarray] = {}
fail_gt_by_regime: dict[str, np.ndarray] = {}
fail_pred_seq_by_regime: dict[str, np.ndarray] = {}
fail_gt_seq_by_regime: dict[str, np.ndarray] = {}

for regime in REGIMES:
    comp_errors = []  # list of (T-1, 7) arrays
    fail_errors = []
    fail_preds = []
    fail_gts = []
    for env_s, comp_s, acts, fails in test_data[regime]:
        pred_comp, pred_fail = teacher_forced_rollout(env_s, comp_s, acts)
        gt_comp = np.array(comp_s[1:])      # (T-1, 7)
        gt_fail = np.array(fails[1:])       # (T-1, 4)
        comp_errors.append(np.abs(pred_comp - gt_comp))
        fail_errors.append(np.abs(pred_fail - gt_fail))
        fail_preds.append(pred_fail)
        fail_gts.append(gt_fail)
    comp_mae_by_regime[regime] = np.concatenate(comp_errors, axis=0).mean(axis=0)  # (7,)
    fail_mae_by_regime[regime] = np.concatenate(fail_errors, axis=0).mean(axis=0)  # (4,)
    fail_pred_by_regime[regime] = np.concatenate(fail_preds, axis=0)
    fail_gt_by_regime[regime] = np.concatenate(fail_gts, axis=0)
    fail_pred_seq_by_regime[regime] = np.stack(fail_preds, axis=0)  # (N, T-1, 4)
    fail_gt_seq_by_regime[regime] = np.stack(fail_gts, axis=0)      # (N, T-1, 4)

# Print component table
for i, name in enumerate(COMP_NAMES):
    row = f"{name:<22}"
    vals = []
    for regime in REGIMES:
        v = comp_mae_by_regime[regime][i]
        row += f"{v:>18.5f}"
        vals.append(v)
    overall = np.mean(vals)
    row += f"{overall:>12.5f}"
    print(row)

print()
print(f"{'Failure prob':<22}" + "".join(f"{r:>18}" for r in REGIMES) + f"{'  OVERALL':>12}")
print("-" * len(header))
for i, name in enumerate(FAIL_NAMES):
    row = f"{name:<22}"
    vals = []
    for regime in REGIMES:
        v = fail_mae_by_regime[regime][i]
        row += f"{v:>18.5f}"
        vals.append(v)
    overall = np.mean(vals)
    row += f"{overall:>12.5f}"
    print(row)

# Overall summary
print()
all_comp = np.concatenate([comp_mae_by_regime[r] for r in REGIMES])
all_fail = np.concatenate([fail_mae_by_regime[r] for r in REGIMES])
print(f"Overall component MAE : {all_comp.mean():.5f}")
print(f"Overall failure   MAE : {all_fail.mean():.5f}")


# ── Failure probability calibration ───────────────────────────────────────────

print("\n" + "=" * 72)
print("FAILURE PROBABILITY LEVELS  (teacher-forced predicted vs ground truth)")
print("=" * 72)
print("Values below are probabilities, not errors. p95 shows the upper-tail risk.")

for regime in REGIMES:
    pred = fail_pred_by_regime[regime]
    gt   = fail_gt_by_regime[regime]

    print(f"\n{regime.upper()}")
    print(
        f"{'Failure head':<14}"
        f"{'pred_mean':>11}{'gt_mean':>10}{'bias':>9}"
        f"{'pred_p95':>11}{'gt_p95':>9}"
        f"{'pred_max':>11}{'gt_max':>9}"
    )
    print("-" * 84)

    for i, name in enumerate(FAIL_NAMES):
        pred_mean = pred[:, i].mean()
        gt_mean   = gt[:, i].mean()
        row = (
            f"{name:<14}"
            f"{pred_mean:>11.3f}{gt_mean:>10.3f}{(pred_mean - gt_mean):>9.3f}"
            f"{np.percentile(pred[:, i], 95):>11.3f}{np.percentile(gt[:, i], 95):>9.3f}"
            f"{pred[:, i].max():>11.3f}{gt[:, i].max():>9.3f}"
        )
        print(row)


# ── Failure probability rollout evolution ────────────────────────────────────

def _device_failure_np(fail_probs: np.ndarray) -> np.ndarray:
    """Device failure = 1 - product(1 - component failure_i)."""
    return 1.0 - np.prod(1.0 - fail_probs, axis=-1)


print("\n" + "=" * 72)
print("FAILURE PROBABILITY EVOLUTION  (mean predicted/ground truth by week)")
print("=" * 72)
print("Each cell is pred/gt. Weeks are one-step-ahead predictions for t+1.")

checkpoints = [1, 10, 20, 30, 40, 50, 75, T - 1]

for regime in REGIMES:
    pred_seq = fail_pred_seq_by_regime[regime]  # (N, T-1, 4)
    gt_seq   = fail_gt_seq_by_regime[regime]    # (N, T-1, 4)
    pred_dev = _device_failure_np(pred_seq)
    gt_dev   = _device_failure_np(gt_seq)

    print(f"\n{regime.upper()}")
    print(
        f"{'week':>5}"
        f"{'device':>15}"
        f"{'moisture':>15}"
        f"{'thermal':>15}"
        f"{'seal':>15}"
        f"{'bracket':>15}"
    )
    print("-" * 80)

    for week in checkpoints:
        idx = week - 1
        row = f"{week:>5}"
        row += f"{pred_dev[:, idx].mean():>7.3f}/{gt_dev[:, idx].mean():<7.3f}"
        for i in range(len(FAIL_NAMES)):
            row += f"{pred_seq[:, idx, i].mean():>7.3f}/{gt_seq[:, idx, i].mean():<7.3f}"
        print(row)


# ── Autoregressive evaluation ─────────────────────────────────────────────────

print("\n" + "=" * 72)
print("MODE 2 — AUTOREGRESSIVE  (multi-step rollout drift)")
print("=" * 72)
print(f"{'Component':<22}" + "".join(f"{r:>18}" for r in REGIMES) + f"{'  OVERALL':>12}")
print("-" * len(header))

ar_mae_by_regime: dict[str, np.ndarray] = {}

for regime in REGIMES:
    comp_errors = []
    for env_s, comp_s, acts, fails in test_data[regime]:
        pred_comp, _ = autoregressive_rollout(env_s, comp_s, acts)
        gt_comp      = np.array(comp_s[1:])
        comp_errors.append(np.abs(pred_comp - gt_comp))
    ar_mae_by_regime[regime] = np.concatenate(comp_errors, axis=0).mean(axis=0)

for i, name in enumerate(COMP_NAMES):
    row = f"{name:<22}"
    vals = []
    for regime in REGIMES:
        v = ar_mae_by_regime[regime][i]
        row += f"{v:>18.5f}"
        vals.append(v)
    overall = np.mean(vals)
    row += f"{overall:>12.5f}"
    print(row)

ar_all = np.concatenate([ar_mae_by_regime[r] for r in REGIMES])
print(f"\nOverall autoregressive MAE: {ar_all.mean():.5f}")
print(f"Drift ratio (AR / TF)     : {ar_all.mean() / all_comp.mean():.2f}x")


# ── Plot 1: Teacher-forced predicted vs actual (one trajectory per regime) ───

print("\nGenerating plots …")
fig, axes = plt.subplots(
    len(COMP_NAMES), len(REGIMES),
    figsize=(18, len(COMP_NAMES) * 2.4),
    dpi=110,
    sharex=True,
)
fig.patch.set_facecolor("#0f1117")
steps = np.arange(T - 1)

for col, regime in enumerate(REGIMES):
    # Use first trajectory of this regime for the example plot
    env_s, comp_s, acts, fails = test_data[regime][0]
    pred_comp, _ = teacher_forced_rollout(env_s, comp_s, acts)
    gt_comp = np.array(comp_s[1:])

    for row, name in enumerate(COMP_NAMES):
        ax = axes[row][col]
        ax.set_facecolor("#1a1d27")
        ax.tick_params(colors="#aaaaaa", labelsize=7)
        ax.spines[:].set_color("#333344")

        c = COLORS[regime]
        ax.plot(steps, gt_comp[:, row],   color=c,        linewidth=1.5, label="Ground truth")
        ax.plot(steps, pred_comp[:, row], color="#ffffff", linewidth=1.0,
                linestyle="--", alpha=0.85, label="Predicted")

        # MAE annotation
        mae = np.abs(pred_comp[:, row] - gt_comp[:, row]).mean()
        ax.text(0.98, 0.05, f"MAE={mae:.4f}",
                transform=ax.transAxes, fontsize=6.5,
                ha="right", color="#aaaaaa")

        if col == 0:
            ax.set_ylabel(name, fontsize=7.5, color="#cccccc")
        if row == 0:
            ax.set_title(regime.upper(), fontsize=10, fontweight="bold",
                         color=c, pad=6)
        if row == len(COMP_NAMES) - 1:
            ax.set_xlabel("Step (weeks)", fontsize=7.5, color="#aaaaaa")

        ax.grid(axis="y", color="#2a2a3a", linewidth=0.4, linestyle="--")

fig.suptitle(
    "Teacher-forced evaluation — predicted vs ground truth (one trajectory per regime)\n"
    "White dashed = model prediction  |  Coloured solid = simulator ground truth",
    fontsize=9, color="#888899", y=1.002,
)
plt.tight_layout()
fig.savefig("eval_teacher.png", dpi=110, bbox_inches="tight",
            facecolor=fig.get_facecolor())
print("  eval_teacher.png saved")


# ── Plot 2: Autoregressive rollout drift across all test trajectories ─────────

fig2, axes2 = plt.subplots(
    len(COMP_NAMES), len(REGIMES),
    figsize=(18, len(COMP_NAMES) * 2.4),
    dpi=110,
    sharex=True,
)
fig2.patch.set_facecolor("#0f1117")

for col, regime in enumerate(REGIMES):
    trajs = test_data[regime]

    # Collect absolute error per step across all test trajectories
    per_step_errors = np.zeros((N_TEST_PER_REGIME, T - 1, len(COMP_NAMES)))
    for i, (env_s, comp_s, acts, _) in enumerate(trajs):
        pred_comp, _ = autoregressive_rollout(env_s, comp_s, acts)
        gt_comp      = np.array(comp_s[1:])
        per_step_errors[i] = np.abs(pred_comp - gt_comp)

    for row, name in enumerate(COMP_NAMES):
        ax = axes2[row][col]
        ax.set_facecolor("#1a1d27")
        ax.tick_params(colors="#aaaaaa", labelsize=7)
        ax.spines[:].set_color("#333344")

        c = COLORS[regime]
        err = per_step_errors[:, :, row]     # (N_TEST, T-1)
        mean_err = err.mean(axis=0)
        std_err  = err.std(axis=0)

        ax.plot(steps, mean_err, color=c, linewidth=1.8)
        ax.fill_between(steps, mean_err - std_err, mean_err + std_err,
                        color=c, alpha=0.20)
        ax.set_ylim(bottom=0)

        if col == 0:
            ax.set_ylabel(name, fontsize=7.5, color="#cccccc")
        if row == 0:
            ax.set_title(regime.upper(), fontsize=10, fontweight="bold",
                         color=c, pad=6)
        if row == len(COMP_NAMES) - 1:
            ax.set_xlabel("Step (weeks)", fontsize=7.5, color="#aaaaaa")

        ax.grid(axis="y", color="#2a2a3a", linewidth=0.4, linestyle="--")

        final_mae = mean_err[-1]
        ax.text(0.98, 0.92, f"final MAE={final_mae:.4f}",
                transform=ax.transAxes, fontsize=6.5,
                ha="right", va="top", color="#aaaaaa")

fig2.suptitle(
    "Autoregressive rollout drift — MAE vs ground truth over 100 steps (mean ± 1 std across 50 test trajectories)\n"
    "Rising error = accumulation of rollout drift; flat = model stays calibrated",
    fontsize=9, color="#888899", y=1.002,
)
plt.tight_layout()
fig2.savefig("eval_autoregressive.png", dpi=110, bbox_inches="tight",
             facecolor=fig2.get_facecolor())
print("  eval_autoregressive.png saved")

print("\nDone.")
