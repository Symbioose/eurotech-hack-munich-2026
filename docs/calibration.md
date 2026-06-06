# World Model — Calibration and Benchmark

Last updated: **2026-06-06**

---

## The Core Question

> "When your model says the node overheats or the seal fails — is that actually true, or trust us?"

Short answer: the failure predictions come from a simulator whose physical constants are derived from published standards and public datasets. The model is a learned compression of that simulator, validated to reproduce it with a mean absolute error of 1.5 % per component per timestep.

---

## Calibration Chain

```
Real-world published data
        │
        ▼
Physics-calibrated simulator
(degradation rules with traceable constants)
        │
        ▼
1 000 000 synthetic transitions
(10 000 trajectories × 100 timesteps)
        │
        ▼
Trained GRU world model
(learns degradation dynamics from data)
        │
        ▼
CEM planner
(finds worst-case stress sequences using the model)
```

The model does **not** invent physics. It learns the shape of degradation dynamics from a simulator whose parameters we can trace to sources.

---

## 1. Environmental Data — HK Observatory

**Source:** Hong Kong Observatory, Climatological Normals 1991–2020.

The simulator samples temperature, humidity, rainfall, UV index and wind speed from monthly distributions fitted to the 30-year HK Observatory dataset.

| Month | Temp (°C) | Humidity | Rainfall (mm/day) | UV index |
|---|---|---|---|---|
| Jan | 16.3 | 0.72 | 0.74 | 3.5 |
| Jun | 28.4 | 0.82 | 13.13 | 9.5 |
| Aug | 28.6 | 0.81 | 11.84 | 9.5 |

Typhoon weekly probabilities derived from HK Observatory typhoon statistics 1961–2020. Peak: August at 7.0 % per week, with an expected 0.30 significant typhoon events per season (June–November).

---

## 2. Battery Degradation — Arrhenius + NASA PCOE

**Source:** NASA Prognostics Center of Excellence (PCOE), battery datasets B0005–B0018. NMC Li-ion cells cycled at controlled temperatures.

**Model:** Arrhenius capacity-fade law.

```
rate(T) = k₀ × exp(−Eₐ / kB × (1/T − 1/T_ref))

Eₐ   = 0.60 eV     (NMC Li-ion activation energy)
kB   = 8.617×10⁻⁵ eV/K
T_ref = 298.15 K   (25 °C reference)
k₀   = 1.50×10⁻³  (capacity loss per week at 25 °C)
```

**Verification against NASA PCOE:**

| Temperature | Decay rate (per week) | Weeks to 80 % SoH | Acceleration factor |
|---|---|---|---|
| 16 °C (HK winter) | 7.25×10⁻⁴ | 276 wks (5.3 yr) | 0.48× |
| **25 °C (reference)** | **1.50×10⁻³** | **133 wks (2.6 yr)** | **1.00×** |
| 30 °C (HK spring/autumn) | 2.20×10⁻³ | 91 wks (1.7 yr) | 1.47× |
| 38 °C (HK summer peak) | 3.98×10⁻³ | 50 wks (1.0 yr) | 2.65× |

The 25 °C reference point (80 % SoH at ~133 weeks = 2.5 years) matches the NASA PCOE measured median for NMC cells under standard cycling.

---

## 3. Enclosure Seal Degradation — EPDM + ISO 4892-2

**Source:** ISO 4892-2 (plastics — methods of exposure to laboratory light sources), subtropical outdoor exposure literature for EPDM rubber.

**Three degradation mechanisms in the simulator:**

```python
seal_uv   = 1.30e-4 × UV_index          # photodegradation (chain scission)
seal_hum  = 7.50e-4 × max(0, RH − 0.60) # hygroscopic cycling
seal_rain = 1.10e-3 × (rainfall / 150)  # mechanical washing + micro-cracking
```

**Verification:**

Under typical HK summer conditions (UV = 10, RH = 0.82, rainfall = 13 mm/day):

- UV contribution: 1.30×10⁻³ per week
- Humidity contribution: 1.65×10⁻⁴ per week
- Rainfall contribution: 9.5×10⁻⁵ per week
- **Total: ~1.56×10⁻³ per week**

At this rate, a new seal (integrity = 1.0) degrades to 0.55 in **~288 weeks (5.5 years)**.

This is consistent with published EPDM outdoor service life in subtropical environments: typically 5–8 years before gasket replacement is recommended, matching IEC 60529 re-certification intervals for outdoor IP67 enclosures deployed in high-UV coastal climates.

**Accelerated UV_exposure action:** applies a 1.90× multiplier to seal decay, consistent with UV aging chamber protocols (ISO 4892-2 uses 500–1000 W/m² xenon arc, roughly 2× natural subtropical irradiance).

---

## 4. Bracket Corrosion — ISO 9223 C4/C5

**Source:** ISO 9223 (corrosion of metals — corrosivity of atmospheres). HK coastal urban classified as C4 (high) to C5 (very high) depending on proximity to sea and industrial zones.

```python
corr_gain = 1.55e-3 × humidity + 8.50e-4 × (rainfall / 150)
```

The formula captures two dominant electrochemical mechanisms:
- **Humidity term:** time-of-wetness drives electrochemical dissolution
- **Rainfall term:** chloride deposition proxy (coastal HK airborne salinity)

**Verification:**

| Season | Corrosion gain/week | Annual equivalent | 2-year total |
|---|---|---|---|
| Jun (wet season) | 1.35×10⁻³ | 7.0 % | 14.0 % |
| Jan (dry season) | 1.12×10⁻³ | 5.8 % | — |

ISO 9223 C4 category specifies first-year steel corrosion rates of 25–50 µm/year (unprotected mild steel in coastal urban). Our 0–1 normalized scale is not directly comparable in µm, but the relative seasonal variation and humidity-driven dynamics are physically consistent.

---

## 5. Hidden Failure Interaction

The simulator encodes one non-linear interaction not visible from individual component curves:

```
humidity_rh > 0.85
AND enclosure_seal_integrity < 0.40
AND vibration_g > 0.30
```

When all three hold simultaneously, moisture ingress probability spikes by 2.2× and PCB health collapses non-linearly.

**Physical basis:**
- Seal integrity < 0.40 means micro-cracks have propagated enough that the IP67 barrier is broken
- RH > 0.85 combined with temperature cycling drives condensation inside the enclosure
- Vibration > 0.30 g (MTR-adjacent or typhoon) pumps the moisture through the micro-cracks

This interaction is not derivable from any single stressor curve. Neither a periodic inspection nor a single-variable stress test would find it. The CEM planner discovers it because it optimises over the joint sequence.

---

## 6. Model Fidelity vs Simulator

The GRU world model is evaluated against a held-out test set of 150 trajectories (50 per regime: normal / stressed / catastrophic) generated by the same simulator.

**Teacher-forced (single-step prediction):**

| Component | MAE |
|---|---|
| Enclosure seal integrity | 0.0086 |
| PCB health | 0.0128 |
| Battery SoC | 0.0107 |
| Bracket corrosion | 0.0110 |
| Sensor drift (average) | 0.021 |
| **Overall component MAE** | **0.015** |
| Failure probability MAE | 0.021 |

**Autoregressive (100-step open-loop rollout):**

| Regime | Component MAE |
|---|---|
| Normal | 0.028 |
| Stressed | 0.047 |
| Catastrophic | 0.054 |
| **Overall** | **0.044** |
| Drift ratio (AR / teacher-forced) | **2.99×** |

A drift ratio of ~3× over a 100-step rollout is expected for a GRU world model without recurrent correction. It does not invalidate planning: the CEM planner re-runs inference at each timestep and does not accumulate open-loop error.

---

## 7. What We Claim and What We Do Not

**We claim:**

- The simulator's physical constants are derived from published standards (ISO 4892-2, ISO 9223, NASA PCOE, HK Observatory).
- The world model faithfully represents the simulator (teacher-forced MAE = 1.5 %).
- The CEM planner discovers stress sequences that the simulator confirms are more damaging than random or standard protocols.
- The hidden failure interaction is physically grounded: seal breach + condensation + vibration-driven pumping is a documented failure mode for outdoor IP67 enclosures in high-humidity environments.

**We do not claim:**

- Predictions validated against deployed BuildGuard hardware (no such hardware exists yet).
- Generalisation to arbitrary sensor nodes without recalibration.
- Replacement of formal IP-rating certification or structural analysis.
- Final CAD or certified engineering.

**The correct framing:**

> Physical Cursor generates the first reviewable hardware brief. The world model stress layer shows *which* failure modes are most likely and *which* environmental interactions cause them. A hardware engineer reviewing this brief knows exactly what to validate in a real environmental chamber — and does not start from a blank page.
