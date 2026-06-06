"""
FastAPI backend for BuildGuard Node world model.

Endpoints:
  POST /train              — generate synthetic data + train model
  POST /plan               — run CEM planner, return best protocol as JSON
  GET  /model/status       — training status + loss history
  WebSocket /ws/stress-test — stream discovered stress protocol step by step
"""
from __future__ import annotations

import asyncio
import json
import threading
from contextlib import asynccontextmanager
from typing import Any, List, Optional

import torch
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from model import (
    WorldModel,
    build_input,
    device_failure_prob,
    normalize_env,
    denormalize_env,
    ACTION_INDEX,
    ACTION_NAMES,
    ENV_DIM,
    COMPONENT_DIM,
)
from training import (
    CEMConfig,
    SimConfig,
    TrainConfig,
    cem_plan,
    get_training_status,
    load_or_train,
    simulate_trajectory,
    train,
)

# ---------------------------------------------------------------------------
# Default HK starting conditions (mid-range, device freshly deployed)
# ---------------------------------------------------------------------------

DEFAULT_ENV_STATE = [
    26.0,   # temperature_c
    0.78,   # humidity_rh
    10.0,   # rainfall_intensity mm/hr
    8.0,    # wind_speed_ms
    6.0,    # UV_index
    0.15,   # vibration_g
]

DEFAULT_COMP_STATE = [
    0.95,   # enclosure_seal_integrity
    0.97,   # pcb_health
    0.93,   # battery_soc
    0.03,   # bracket_corrosion
    0.02,   # moisture_sensor_drift
    0.02,   # crack_sensor_drift
    0.01,   # tilt_sensor_drift
]

# Fixed comp state (post-fix: improved parameters)
FIXED_COMP_STATE = [
    0.99,   # better gasket seal
    0.97,
    0.93,
    0.01,   # less corrosion after treatment
    0.01,
    0.01,
    0.005,
]

# Scenario presets for the three demo lanes.
#
# These are not scripted outcomes. They are physically plausible starting
# conditions passed into the same learned world model. "Catastrophic" starts
# with an aged seal near the moisture-ingress vulnerability zone, which is the
# credible state for a 52-year-old facade node between inspection cycles.
SCENARIO_PRESETS: dict[str, dict[str, Any]] = {
    "normal": {
        "label": "Normal field deployment",
        "description": "Fresh node under ordinary Hong Kong outdoor conditions; no artificial stress protocol.",
        "env_state": DEFAULT_ENV_STATE,
        "comp_state": DEFAULT_COMP_STATE,
        "fixed_comp_state": FIXED_COMP_STATE,
        "objective": "control",
        "uses_planner": False,
    },
    "stressed": {
        "label": "Accelerated stress test",
        "description": "Moderately aged node exposed to a standard accelerated humidity, UV, heat, vibration and typhoon protocol.",
        "env_state": [
            30.0,   # warm wet-season ambient
            0.84,   # high RH, below catastrophic trigger by itself
            22.0,   # heavy rain week
            12.0,   # exposed facade wind
            8.0,    # summer UV
            0.22,   # urban/MTR-adjacent vibration
        ],
        "comp_state": [
            0.68,   # aged but not near hidden-trigger threshold
            0.92,
            0.86,
            0.12,
            0.06,
            0.06,
            0.04,
        ],
        "fixed_comp_state": [
            0.86,   # gasket/membrane replacement improves seal state
            0.94,
            0.88,
            0.06,
            0.03,
            0.04,
            0.025,
        ],
        "objective": "standard_stress",
        "uses_planner": False,
    },
    "catastrophic": {
        "label": "Compound moisture-ingress failure",
        "description": "Aged seal close to vulnerability zone; CEM searches for humidity, rain and vibration interactions.",
        "env_state": [
            31.0,
            0.88,
            35.0,
            14.0,
            8.0,
            0.32,
        ],
        "comp_state": [
            0.45,   # vulnerable, but not already below the documented 0.40 trigger
            0.90,
            0.85,
            0.12,
            0.05,
            0.05,
            0.03,
        ],
        "fixed_comp_state": [
            0.72,   # repair improves seal/bracket but does not make device invincible
            0.92,
            0.86,
            0.06,
            0.03,
            0.04,
            0.025,
        ],
        "objective": "moisture_ingress",
        "uses_planner": True,
    },
}

SUPPORTED_SCENARIOS = tuple(SCENARIO_PRESETS.keys())

# ---------------------------------------------------------------------------
# App lifecycle: load model at startup
# ---------------------------------------------------------------------------

_model: WorldModel | None = None
_model_lock = threading.Lock()
_training_thread: threading.Thread | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model
    print("Loading/training world model at startup...")
    _model = load_or_train()
    print("World model ready.")
    yield


app = FastAPI(title="BuildGuard World Model", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _state_to_dict(
    timestep: int,
    env_vec: list[float],
    comp_vec: list[float],
    fail_vec: list[float],
    action_idx: int | None,
) -> dict:
    dev_fail = 1.0 - ((1 - fail_vec[0]) * (1 - fail_vec[1]) * (1 - fail_vec[2]) * (1 - fail_vec[3]))
    action_name = ACTION_NAMES[action_idx] if action_idx is not None else "none"
    return {
        "timestep":                 timestep,
        "temperature_c":            round(env_vec[0], 2),
        "humidity_rh":              round(env_vec[1], 3),
        "rainfall_intensity":       round(env_vec[2], 2),
        "wind_speed_ms":            round(env_vec[3], 2),
        "UV_index":                 round(env_vec[4], 2),
        "vibration_g":              round(env_vec[5], 3),
        "enclosure_seal_integrity": round(comp_vec[0], 3),
        "pcb_health":               round(comp_vec[1], 3),
        "battery_soc":              round(comp_vec[2], 3),
        "bracket_corrosion":        round(comp_vec[3], 3),
        "moisture_sensor_drift":    round(comp_vec[4], 3),
        "crack_sensor_drift":       round(comp_vec[5], 3),
        "tilt_sensor_drift":        round(comp_vec[6], 3),
        "moisture_ingress_prob":    round(fail_vec[0], 3),
        "thermal_runaway_prob":     round(fail_vec[1], 3),
        "seal_failure_prob":        round(fail_vec[2], 3),
        "bracket_failure_prob":     round(fail_vec[3], 3),
        "device_failure_prob":      round(dev_fail, 3),
        "active_stress_action":     action_name,
    }


def _rollout(
    model: WorldModel,
    env_state_0: list[float],
    comp_state_0: list[float],
    action_sequence: list[int | None],
) -> list[dict]:
    """Roll out a fixed action sequence through the model and collect per-step state."""
    model.eval()
    results = []

    # Model operates in normalised env space; comp already in [0,1].
    env_t  = normalize_env(torch.tensor(env_state_0, dtype=torch.float32)).unsqueeze(0)
    comp_t = torch.tensor(comp_state_0, dtype=torch.float32).unsqueeze(0)
    h      = None

    with torch.no_grad():
        for t, action_idx in enumerate(action_sequence):
            x_t = build_input(env_t.squeeze(0), comp_t.squeeze(0), action_idx).unsqueeze(0)  # (1,18)
            env_next, comp_next, fail_next, h = model.step(x_t, h)  # (1,6), (1,7), (1,4)

            # env_next is normalised — convert back to physical units for the client
            env_phys = denormalize_env(env_next.squeeze(0)).tolist()  # (6,) flat

            results.append(_state_to_dict(
                t + 1,
                env_phys,
                comp_next.squeeze(0).tolist(),
                fail_next.squeeze(0).tolist(),
                action_idx,
            ))
            env_t  = env_next      # (1,6) normalised — fed back in next iter
            comp_t = comp_next

    return results


def _scenario_or_default(scenario: str | None) -> str:
    scenario_name = (scenario or "stressed").strip().lower()
    if scenario_name not in SCENARIO_PRESETS:
        raise ValueError(
            f"unsupported scenario '{scenario_name}'. "
            f"Use one of: {', '.join(SUPPORTED_SCENARIOS)}"
        )
    return scenario_name


def _resolve_demo_inputs(
    scenario: str | None,
    env_state: Optional[List[float]],
    comp_state: Optional[List[float]],
    fixed: bool,
    objective: Optional[str] = None,
) -> tuple[str, dict[str, Any], list[float], list[float], str, bool]:
    scenario_name = _scenario_or_default(scenario)
    preset = SCENARIO_PRESETS[scenario_name]

    env0 = list(env_state or preset["env_state"])
    if fixed:
        comp0 = list(preset["fixed_comp_state"])
    else:
        comp0 = list(comp_state or preset["comp_state"])

    objective_name = (objective or preset["objective"]).strip().lower()
    uses_planner = (
        objective_name in {"device_failure", "moisture_ingress"}
        and bool(preset["uses_planner"])
    )
    return scenario_name, preset, env0, comp0, objective_name, uses_planner


def _standard_stress_sequence(horizon: int) -> list[int | None]:
    """
    Plausible accelerated-lab protocol for the "stressed" lane.

    It is intentionally not failure-optimised: it alternates humidity, UV, heat
    and vibration, with an occasional typhoon load. The learned model still
    determines the degradation response.
    """
    cycle = [
        None,
        ACTION_INDEX["humidity_soak"],
        None,
        ACTION_INDEX["UV_exposure"],
        None,
        ACTION_INDEX["heat_cycle"],
        None,
        ACTION_INDEX["vibration_burst"],
        None,
        None,
        ACTION_INDEX["typhoon_load"],
        None,
    ]
    return [cycle[t % len(cycle)] for t in range(horizon)]


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

class TrainRequest(BaseModel):
    n_epochs: int = 10
    n_trajectories: int = 10_000
    force_retrain: bool = False


class PlanRequest(BaseModel):
    scenario: str = "stressed"                  # normal | stressed | catastrophic
    env_state: Optional[List[float]] = None      # defaults to DEFAULT_ENV_STATE
    comp_state: Optional[List[float]] = None     # defaults to DEFAULT_COMP_STATE
    horizon: int = 40
    n_samples: int = 200
    n_elites: int = 20
    n_iterations: int = 5
    fixed: bool = False  # if True use FIXED_COMP_STATE (post-fix scenario)
    objective: Optional[str] = None              # control | standard_stress | device_failure | moisture_ingress


@app.get("/model/status")
def model_status():
    status = get_training_status()
    status["model_ready"] = _model is not None
    return status


@app.get("/scenarios")
def scenarios():
    return {
        "scenarios": [
            {
                "name": name,
                "label": preset["label"],
                "description": preset["description"],
                "objective": preset["objective"],
                "uses_planner": preset["uses_planner"],
                "env_state": preset["env_state"],
                "component_state": preset["comp_state"],
                "fixed_component_state": preset["fixed_comp_state"],
            }
            for name, preset in SCENARIO_PRESETS.items()
        ]
    }


@app.post("/train")
def trigger_training(req: TrainRequest):
    global _model, _training_thread

    def _run():
        global _model
        cfg = TrainConfig(
            n_epochs=req.n_epochs,
            sim=SimConfig(n_trajectories=req.n_trajectories),
        )
        m = train(cfg)
        with _model_lock:
            _model = m

    if _training_thread and _training_thread.is_alive():
        return {"status": "already_training"}

    _training_thread = threading.Thread(target=_run, daemon=True)
    _training_thread.start()
    return {"status": "training_started"}


@app.post("/plan")
def run_plan(req: PlanRequest):
    if _model is None:
        return {"error": "model not ready — call POST /train first"}

    try:
        scenario_name, preset, env0, comp0, objective_name, uses_planner = _resolve_demo_inputs(
            req.scenario,
            req.env_state,
            req.comp_state,
            req.fixed,
            req.objective,
        )
    except ValueError as exc:
        return {"error": str(exc)}

    cem_cfg = CEMConfig(
        horizon=req.horizon,
        n_samples=req.n_samples,
        n_elites=req.n_elites,
        n_iterations=req.n_iterations,
        objective=objective_name,
    )

    with _model_lock:
        if uses_planner:
            action_sequence = cem_plan(_model, env0, comp0, cem_cfg)
        elif objective_name == "standard_stress":
            action_sequence = _standard_stress_sequence(req.horizon)
        else:
            action_sequence = [None] * req.horizon
        results         = _rollout(_model, env0, comp0, action_sequence)

    return {
        "scenario": scenario_name,
        "label": preset["label"],
        "objective": objective_name,
        "uses_planner": uses_planner,
        "fixed": req.fixed,
        "initial_env_state": env0,
        "initial_component_state": comp0,
        "action_sequence": [ACTION_NAMES[a] if a is not None else "none" for a in action_sequence],
        "steps": results,
    }


# ---------------------------------------------------------------------------
# WebSocket: /ws/stress-test
# ---------------------------------------------------------------------------

@app.websocket("/ws/stress-test")
async def stress_test_ws(websocket: WebSocket):
    """
    Streams a CEM-planned stress protocol step by step.
    Accepts optional JSON config message on connect; otherwise uses defaults.

    Client can send:
      { "scenario": "catastrophic", "horizon": 40, "fixed": false }

    Server streams per-timestep JSON frames, then sends {"done": true}.
    """
    await websocket.accept()

    try:
        # Try to receive an initial config message (with 2s timeout)
        try:
            raw = await asyncio.wait_for(websocket.receive_text(), timeout=2.0)
            config = json.loads(raw)
        except (asyncio.TimeoutError, Exception):
            config = {}

        horizon    = int(config.get("horizon", 40))
        fixed      = bool(config.get("fixed", False))
        n_samples  = int(config.get("n_samples", 200))
        n_elites   = int(config.get("n_elites", 20))
        n_iters    = int(config.get("n_iterations", 5))

        try:
            scenario_name, _preset, env0, comp0, objective_name, uses_planner = _resolve_demo_inputs(
                config.get("scenario", "stressed"),
                config.get("env_state"),
                config.get("comp_state"),
                fixed,
                config.get("objective"),
            )
        except ValueError as exc:
            await websocket.send_json({"error": str(exc)})
            await websocket.close()
            return

        if _model is None:
            await websocket.send_json({"error": "model not ready"})
            await websocket.close()
            return

        # Run CEM in executor to avoid blocking event loop
        loop = asyncio.get_event_loop()
        cem_cfg = CEMConfig(
            horizon=horizon,
            n_samples=n_samples,
            n_elites=n_elites,
            n_iterations=n_iters,
            objective=objective_name,
        )

        def _plan_and_rollout():
            with _model_lock:
                if uses_planner:
                    seq = cem_plan(_model, env0, comp0, cem_cfg)
                elif objective_name == "standard_stress":
                    seq = _standard_stress_sequence(horizon)
                else:
                    seq = [None] * horizon
                results = _rollout(_model, env0, comp0, seq)
            return seq, results

        action_sequence, steps = await loop.run_in_executor(None, _plan_and_rollout)

        # Stream steps one by one with a small delay for visual effect
        for step in steps:
            step["scenario"] = scenario_name
            step["objective"] = objective_name
            await websocket.send_json(step)
            await asyncio.sleep(0.05)   # 50 ms between frames → smooth 3D animation

        await websocket.send_json({
            "done": True,
            "scenario": scenario_name,
            "objective": objective_name,
            "uses_planner": uses_planner,
            "total_steps": len(steps),
            "action_sequence": [
                ACTION_NAMES[a] if a is not None else "none"
                for a in action_sequence
            ],
        })

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_json({"error": str(exc)})
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Run directly for development
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
