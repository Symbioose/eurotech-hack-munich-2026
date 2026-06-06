"""
Visualise synthetic BuildGuard Node trajectories to sanity-check the
data generator before training.

Generates 30 trajectories per regime (normal / stressed / catastrophic)
and plots the environmental drivers, component degradation, and failure
probabilities on a single figure.

Run: uv run python3 plot_trajectories.py
Output: trajectory_check.png
"""
import random
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from matplotlib.lines import Line2D

from training import SimConfig, simulate_trajectory

# ── Config ───────────────────────────────────────────────────────────────────

N_TRAJ   = 30          # trajectories per regime
TIMESTEPS = 100
ALPHA     = 0.25       # line transparency for individual traces
REGIMES   = ["normal", "stressed", "catastrophic"]
COLORS    = {"normal": "#2196F3", "stressed": "#FF9800", "catastrophic": "#F44336"}

cfg = SimConfig(n_trajectories=N_TRAJ, n_timesteps=TIMESTEPS)

# ── Generate trajectories ─────────────────────────────────────────────────────

print("Generating trajectories for visualisation…")
data: dict[str, list] = {r: [] for r in REGIMES}
for regime in REGIMES:
    for _ in range(N_TRAJ):
        env_s, comp_s, acts, fails = simulate_trajectory(cfg, regime)
        data[regime].append((env_s, comp_s, acts, fails))
    print(f"  {regime}: {N_TRAJ} trajectories done")

steps = np.arange(TIMESTEPS)

# ── Helper: extract variable across trajectories ──────────────────────────────

def extract(trajs, source: str, idx: int) -> np.ndarray:
    """Return (N_TRAJ, TIMESTEPS) array."""
    rows = []
    for env_s, comp_s, acts, fails in trajs:
        if source == "env":
            rows.append([t[idx] for t in env_s])
        elif source == "comp":
            rows.append([t[idx] for t in comp_s])
        elif source == "fail":
            rows.append([t[idx] for t in fails])
    return np.array(rows)


# ── Layout ────────────────────────────────────────────────────────────────────
# Rows:  temperature | humidity | seal | pcb | battery | p_moisture | p_seal | p_bracket
# Cols:  normal | stressed | catastrophic

ROW_SPECS = [
    ("Temperature (°C)",         "env",  0, (8, 42)),
    ("Humidity (RH)",            "env",  1, (0.40, 1.0)),
    ("Rainfall (mm/day)",        "env",  2, (0, 200)),
    ("Wind speed (m/s)",         "env",  3, (0, 60)),
    ("Seal integrity",           "comp", 0, (0, 1)),
    ("PCB health",               "comp", 1, (0, 1)),
    ("Battery SoH",              "comp", 2, (0, 1)),
    ("Bracket corrosion",        "comp", 3, (0, 1)),
    ("P(moisture ingress)",      "fail", 0, (0, 1)),
    ("P(thermal runaway)",       "fail", 1, (0, 1)),
    ("P(seal failure)",          "fail", 2, (0, 1)),
    ("P(bracket failure)",       "fail", 3, (0, 1)),
]

N_ROWS = len(ROW_SPECS)
N_COLS = len(REGIMES)

fig, axes = plt.subplots(
    N_ROWS, N_COLS,
    figsize=(18, N_ROWS * 2.2),
    dpi=120,
    sharex=True,
)
fig.patch.set_facecolor("#0f1117")

for ax_row in axes:
    for ax in ax_row:
        ax.set_facecolor("#1a1d27")
        ax.tick_params(colors="#aaaaaa", labelsize=7)
        ax.spines[:].set_color("#333344")
        ax.xaxis.label.set_color("#aaaaaa")
        ax.yaxis.label.set_color("#aaaaaa")

# ── Plot ──────────────────────────────────────────────────────────────────────

for col_idx, regime in enumerate(REGIMES):
    trajs = data[regime]
    color = COLORS[regime]

    for row_idx, (label, source, var_idx, ylim) in enumerate(ROW_SPECS):
        ax = axes[row_idx][col_idx]
        mat = extract(trajs, source, var_idx)   # (N_TRAJ, T)

        # Individual traces
        for i in range(N_TRAJ):
            ax.plot(steps, mat[i], color=color, alpha=ALPHA, linewidth=0.7)

        # Mean ± 1 std
        mean = mat.mean(axis=0)
        std  = mat.std(axis=0)
        ax.plot(steps, mean, color=color, linewidth=1.8, zorder=5)
        ax.fill_between(steps, mean - std, mean + std,
                        color=color, alpha=0.18, zorder=4)

        ax.set_ylim(ylim)
        ax.set_xlim(0, TIMESTEPS - 1)
        ax.grid(axis="y", color="#2a2a3a", linewidth=0.5, linestyle="--")

        # Y-label only on leftmost column
        if col_idx == 0:
            ax.set_ylabel(label, fontsize=7.5, color="#cccccc")

        # Column title on top row
        if row_idx == 0:
            ax.set_title(
                regime.upper(),
                fontsize=11, fontweight="bold",
                color=color, pad=8,
            )

        # X-label on bottom row
        if row_idx == N_ROWS - 1:
            ax.set_xlabel("Timestep (weeks)", fontsize=8, color="#aaaaaa")

        # Annotate hidden trigger zone on seal row (row_idx == 4)
        if source == "comp" and var_idx == 0:
            ax.axhline(0.40, color="#ff4444", linewidth=0.9,
                       linestyle=":", alpha=0.8, zorder=6)
            if col_idx == 2:
                ax.text(2, 0.42, "hidden trigger threshold",
                        color="#ff4444", fontsize=6.5, va="bottom")

        # Mark 80 % SoH threshold on battery row
        if source == "comp" and var_idx == 2:
            ax.axhline(0.80, color="#ffaa00", linewidth=0.9,
                       linestyle=":", alpha=0.8, zorder=6)
            if col_idx == 0:
                ax.text(2, 0.81, "80 % SoH (NASA PCOE ref.)",
                        color="#ffaa00", fontsize=6.5, va="bottom")

# ── Legend ────────────────────────────────────────────────────────────────────

legend_elements = [
    Line2D([0], [0], color=COLORS["normal"],        linewidth=2, label="Normal (50 %)"),
    Line2D([0], [0], color=COLORS["stressed"],      linewidth=2, label="Stressed (20 %)"),
    Line2D([0], [0], color=COLORS["catastrophic"],  linewidth=2, label="Catastrophic (30 %)"),
    Line2D([0], [0], color="#ff4444", linewidth=1, linestyle=":",
           label="Hidden trigger threshold (seal < 0.40)"),
    Line2D([0], [0], color="#ffaa00", linewidth=1, linestyle=":",
           label="80 % SoH NASA PCOE reference"),
]
fig.legend(
    handles=legend_elements,
    loc="lower center",
    ncol=3,
    fontsize=8,
    facecolor="#1a1d27",
    edgecolor="#333344",
    labelcolor="#cccccc",
    bbox_to_anchor=(0.5, -0.012),
)

# ── Summary stats ─────────────────────────────────────────────────────────────

stats_lines = []
for regime in REGIMES:
    trajs = data[regime]
    seal_end = np.array([[c[0] for c in comp_s][-1] for _, comp_s, _, _ in trajs])
    batt_end = np.array([[c[2] for c in comp_s][-1] for _, comp_s, _, _ in trajs])
    max_pm   = np.array([max(f[0] for f in fails) for _, _, _, fails in trajs])
    hidden   = sum(
        sum(1 for t in range(TIMESTEPS)
            if env_s[t][1] > 0.85 and comp_s[t][0] < 0.40 and env_s[t][5] > 0.30)
        for env_s, comp_s, _, _ in trajs
    )
    stats_lines.append(
        f"{regime:14s}  seal_end={seal_end.mean():.3f}±{seal_end.std():.3f}  "
        f"batt_end={batt_end.mean():.3f}±{batt_end.std():.3f}  "
        f"max_p_moisture={max_pm.mean():.3f}  "
        f"hidden_trigger_total={hidden}"
    )

fig.text(
    0.01, 0.995,
    "BuildGuard Node — Synthetic Trajectory Validation\n"
    "Solid line = mean across 30 trajectories  |  Shaded = ±1 std  |  Thin lines = individual traces\n"
    "Environmental state sampled from HK Observatory monthly normals (1991-2020)  |  "
    "Battery decay: Arrhenius Ea=0.60 eV (NASA PCOE calibration)\n"
    + "\n".join(stats_lines),
    transform=fig.transFigure,
    fontsize=7,
    color="#888899",
    va="top",
    fontfamily="monospace",
)

plt.tight_layout(rect=[0, 0.03, 1, 0.94])

outpath = "trajectory_check.png"
plt.savefig(outpath, dpi=120, bbox_inches="tight", facecolor=fig.get_facecolor())
print(f"Plot saved → {outpath}")
