# World Model — Stress Test Layer

Last updated: **2026-06-06**

Status: **in build for the hackathon**

---

## Scope

The world model lives entirely in `/backend`. It owns:

- Synthetic data generation
- Model definition and training
- Inference and planning

The frontend consumes the output stream. It has no knowledge of the model internals.

---

## What This Is

A learned simulation of how a BuildGuard Node degrades under Hong Kong environmental conditions. The model is trained on synthetic trajectories generated from handcrafted degradation rules, then used at inference time by a CEM planner to automatically discover the stress sequences that cause failure fastest.

The output is not a set of deterministic checks. There is no rule engine. The model learns the degradation dynamics from data and generalises to combinations of stresses that the data generator did not explicitly encode.

---

## Why It Matters

Standard inspection cycles and manual stress protocols explore only a small fraction of possible operating conditions. The world model simulates thousands of possible futures and finds the ones that kill the hardware fastest — including non-obvious interactions between stressors that a rule-based system cannot express.

The core demo claim:

> Humidity alone: moderate damage. Vibration alone: moderate damage. Humidity + vibration + prior heat cycle: catastrophic seal failure in a fraction of the time. The planner finds this. A human protocol misses it.

---

## Data Generation

### Synthetic Environment Simulator

Generates trajectories using handcrafted degradation rules calibrated to Hong Kong deployment conditions. The simulator does not need to be realistic — it needs to produce diverse, physically plausible trajectories that teach the model the shape of degradation dynamics.

**Environmental state:**

| Variable | Unit | HK Range |
|---|---|---|
| `temperature_c` | °C | 15 – 38 |
| `humidity_rh` | 0–1 | 0.55 – 0.97 |
| `rainfall_intensity` | mm/hr | 0 – 150 (typhoon) |
| `wind_speed_ms` | m/s | 0 – 45 (typhoon) |
| `UV_index` | 0–11 | 0 – 11 |
| `vibration_g` | g | 0 – 2.5 (MTR proximity) |

**Component state:**

| Variable | Range | Notes |
|---|---|---|
| `enclosure_seal_integrity` | 0–1 | degrades with humidity cycles and UV |
| `pcb_health` | 0–1 | sensitive to moisture ingress and heat |
| `battery_soc` | 0–1 | degrades with temperature extremes |
| `bracket_corrosion` | 0–1 | driven by humidity and coastal air |
| `moisture_sensor_drift` | 0–1 | increases with condensation events |
| `crack_sensor_drift` | 0–1 | increases with vibration fatigue |
| `tilt_sensor_drift` | 0–1 | increases with mounting stress |

**Stress actions (what the planner sequences):**

| Action | Effect |
|---|---|
| `typhoon_load` | max wind + rainfall simultaneously |
| `heat_cycle` | rapid temperature swing |
| `humidity_soak` | sustained high RH |
| `vibration_burst` | sustained mechanical vibration |
| `UV_exposure` | sustained UV, degrades seal polymer |

### Hidden Failure Interaction

This is the key mechanism for the demo.

Each stressor alone causes moderate, gradual degradation. The following combination triggers catastrophic joint failure:

```
humidity_rh > 0.85
AND enclosure_seal_integrity < 0.4
AND vibration_g > 0.3
```

When all three conditions hold simultaneously, moisture ingress probability spikes and PCB health collapses non-linearly. Neither a rule-based check nor a single-variable stress test would find this path. The CEM planner discovers it automatically.

### Dataset Size

```
10,000 trajectories × 100 timesteps = 1,000,000 transitions
```

Generation time: minutes. More than sufficient for a hackathon-scale GRU.

---

## Model Architecture

### Backbone

```
Input: [env_state | component_state | stress_action]
       (concatenated flat vector)

2-layer GRU
hidden size: 128
```

The GRU maintains a hidden state across timesteps, allowing the model to capture temporal dependencies in degradation (e.g. a heat cycle yesterday makes today's humidity more damaging).

### Output Heads

**Environmental state head** — predicts next-timestep env state:

```
temperature_c, humidity_rh, rainfall_intensity,
wind_speed_ms, UV_index, vibration_g
```

**Component degradation head** — predicts next-timestep component state:

```
enclosure_seal_integrity, pcb_health, battery_soc,
bracket_corrosion, moisture_sensor_drift,
crack_sensor_drift, tilt_sensor_drift
```

**Failure probability head** — predicts per-component failure probabilities:

```
moisture_ingress_prob
thermal_runaway_prob
seal_failure_prob
bracket_failure_prob
```

Component-level failure probabilities are more informative than a single device scalar: more realistic, more explainable, better visuals, more credible to a hardware-literate jury.

**Device failure probability** is derived from component probabilities:

```
device_failure = 1 - Π(1 - component_failure_i)
```

If any critical component fails, overall device risk rises.

### Physics-Informed Loss

The loss function combines prediction error with physics constraint penalties:

```
loss = prediction_loss + λ_physics × physics_loss
```

**Wear monotonicity** — degradation variables cannot spontaneously recover:

```
penalty = mean(max(0, state_t - state_t+1))
  for: enclosure_seal_integrity, pcb_health, battery_soc
```

**Corrosion monotonicity** — corrosion cannot decrease:

```
penalty = mean(max(0, bracket_corrosion_t+1 - bracket_corrosion_t) × -1)
```

**Temperature smoothness** — prevents impossible single-step jumps:

```
penalty = mean(max(0, |temp_t+1 - temp_t| - threshold))
```

**Enclosure thermal constraint** — derived from the steady-state formula:

```
ΔT = P_total / (k × A_surface)
```

The model is penalised for predicting internal temperatures that violate this physical bound given the enclosure geometry.

---

## Planner

### Method: Cross Entropy Method (CEM)

Not reinforcement learning. The planner is a black-box optimiser that uses the world model as a forward simulator.

### How It Works

```
1. Sample N candidate stress action sequences
   (each sequence: T timesteps of stress actions)

2. Roll out each sequence through the world model

3. Score each sequence:
   maximize: component failure probabilities
   maximize: device_failure
   minimize: time-to-failure

4. Keep the top-K sequences (elite set)

5. Refit sampling distribution to elite set

6. Repeat for M iterations

7. Return best discovered protocol
```

### Output

The planner returns the stress protocol that reaches the highest failure probability in the fewest timesteps. This is streamed to the frontend step by step.

---

## Backend Interface

### Endpoint

```
WebSocket: /ws/stress-test
```

### Stream Format (per timestep)

```json
{
  "timestep": 14,
  "temperature_c": 38.2,
  "humidity_rh": 0.91,
  "enclosure_seal_integrity": 0.38,
  "pcb_health": 0.61,
  "battery_soc": 0.74,
  "bracket_corrosion": 0.29,
  "moisture_ingress_prob": 0.74,
  "thermal_runaway_prob": 0.12,
  "seal_failure_prob": 0.68,
  "bracket_failure_prob": 0.21,
  "device_failure_prob": 0.83,
  "active_stress_action": "typhoon_load"
}
```

### Additional Endpoints

```
GET  /health         — liveness check; returns model_ready flag
POST /train          — trigger synthetic data generation + training
POST /plan           — run CEM planner, return best protocol
POST /compare        — AI / random / MBIS curves for unfixed + fixed node
GET  /demo/compare   — pre-baked simulator curves (always correct for demo)
GET  /scenarios      — list demo scenarios and starting assumptions
GET  /model/status   — training status and loss history
```

### Demo Scenarios

The backend exposes three demo scenarios. These are not scripted output paths:
each scenario is a starting condition and protocol passed through the same
learned world model.

| Scenario | Protocol | Purpose |
|---|---|---|
| `normal` | no artificial stress actions | healthy field deployment baseline |
| `stressed` | standard accelerated humidity / UV / heat / vibration / typhoon protocol | meaningful degradation without forcing immediate failure |
| `catastrophic` | CEM planner with moisture-ingress objective | discover the compound humidity + vibration + aged-seal failure path |

Example request:

```json
{
  "scenario": "catastrophic",
  "horizon": 50,
  "n_samples": 300,
  "n_elites": 30,
  "n_iterations": 6
}
```

### /compare response shape

```json
{
  "unfixed": {
    "ai":     [ ...steps ],
    "random": [ ...steps ],
    "mbis":   [ ...steps ]
  },
  "fixed": {
    "ai":     [ ...steps ],
    "random": [ ...steps ],
    "mbis":   [ ...steps ]
  },
  "action_sequences": {
    "unfixed_ai": [ "humidity_soak", "vibration_burst", ... ],
    "fixed_ai":   [ "humidity_soak", "typhoon_load", ... ]
  }
}
```

Each step is the standard state dict (same format as `/ws/stress-test`).

---

## Demo Flow

1. User selects **Normal**, **Stressed** or **Catastrophic**
2. Backend runs the scenario protocol:
   - Normal: no artificial stress control rollout
   - Stressed: standard accelerated stress protocol
   - Catastrophic: CEM planner searches for fastest moisture-ingress failure
3. WebSocket streams the discovered protocol step by step
4. Frontend 3D BuildGuard Node degrades in real time:
   - Enclosure seal: green → yellow → red
   - PCB: heat glow intensifies
   - Bracket: corrosion texture increases
   - Sensors: drift indicators appear
5. Comparison chart updates in real time:
   - AI protocol curve
   - Random stress protocol curve
   - Standard MBIS inspection cycle curve
   - AI reaches critical failure first — that is the proof
6. User clicks **Apply Fix** (gasket + drainage + thermal vent)
7. Component states reset with improved parameters
8. Stress test reruns — AI now takes significantly longer to find failure
9. That final step closes the loop: the fix is validated against the model, not just asserted

---

## What This Is Not

- Not a physics engine
- Not a rule-based check system
- Not a real-time hardware-in-the-loop simulator
- Not DreamerV3, not RL, not Isaac Sim, not MuJoCo

The credible framing:

> A lightweight learned world model trained on synthetic degradation trajectories calibrated to Hong Kong deployment conditions. It simulates thousands of possible futures and discovers the stress combinations that expose hardware failures fastest.
