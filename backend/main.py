"""
FastAPI backend for BuildGuard Node world model.

Endpoints:
  GET  /health             — liveness check
  POST /train              — generate synthetic data + train model
  POST /plan               — run CEM planner, return best protocol as JSON
  POST /compare            — AI / random / MBIS curves for unfixed + fixed node
  GET  /demo/compare       — pre-baked simulator curves (always correct for demo)
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
    _sample_env5_for_month,
    _apply_action_to_env5,
    _drift_env5,
    _degrade_components,
    _clamp,
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

# ---------------------------------------------------------------------------
# Demo mode — simulator-based starting states (~18 months of field deployment)
# Unfixed: seal degraded naturally to 0.55 without IP67 protection.
# Fixed:   IP67 gasket + 316L fasteners retrofitted; seal stays at 0.92.
# ---------------------------------------------------------------------------

_DEMO_UNFIXED_COMP = [0.55, 0.82, 0.78, 0.14, 0.09, 0.07, 0.05]
_DEMO_FIXED_COMP   = [0.92, 0.94, 0.78, 0.04, 0.03, 0.03, 0.02]
_DEMO_HORIZON      = 60   # 60 weeks ≈ 14 months

# AI sequence: designed to trigger the hidden interaction
# (humidity_soak degrades seal → vibration_burst triggers moisture spike → typhoon compounds)
_DEMO_AI_SEQ: list = (
    ["humidity_soak"] * 10
    + ["vibration_burst"] * 5
    + ["typhoon_load"] * 5
    + ["humidity_soak"] * 5
    + ["vibration_burst"] * 5
    + ["typhoon_load"] * 10
    + ["humidity_soak"] * 10
    + ["vibration_burst"] * 10
)

import random as _random
_random.seed(99)
_DEMO_RANDOM_SEQ: list = [
    _random.choice(ACTION_NAMES + [None]) for _ in range(_DEMO_HORIZON)
]
_DEMO_MBIS_SEQ: list = [None] * _DEMO_HORIZON

_demo_compare_cache: dict | None = None


def _sim_step_to_dict(
    timestep: int,
    env_full: list,
    comp: list,
    fail_probs: list,
    action_name: str | None,
) -> dict:
    dev_fail = 1.0 - (
        (1 - fail_probs[0]) * (1 - fail_probs[1])
        * (1 - fail_probs[2]) * (1 - fail_probs[3])
    )
    return {
        "timestep":                 timestep,
        "temperature_c":            round(env_full[0], 2),
        "humidity_rh":              round(env_full[1], 3),
        "rainfall_intensity":       round(env_full[2], 2),
        "wind_speed_ms":            round(env_full[3], 2),
        "UV_index":                 round(env_full[4], 2),
        "vibration_g":              round(env_full[5], 3),
        "enclosure_seal_integrity": round(comp[0], 3),
        "pcb_health":               round(comp[1], 3),
        "battery_soc":              round(comp[2], 3),
        "bracket_corrosion":        round(comp[3], 3),
        "moisture_sensor_drift":    round(comp[4], 3),
        "crack_sensor_drift":       round(comp[5], 3),
        "tilt_sensor_drift":        round(comp[6], 3),
        "moisture_ingress_prob":    round(float(fail_probs[0]), 3),
        "thermal_runaway_prob":     round(float(fail_probs[1]), 3),
        "seal_failure_prob":        round(float(fail_probs[2]), 3),
        "bracket_failure_prob":     round(float(fail_probs[3]), 3),
        "device_failure_prob":      round(min(float(dev_fail), 1.0), 3),
        "active_stress_action":     action_name or "none",
    }


def _sim_rollout_demo(comp_state_0: list, action_sequence: list, seed: int = 42) -> list:
    """Simulator-based rollout — properly calibrated, deterministic."""
    _random.seed(seed)
    month = 5   # June: start of typhoon season
    env5  = _sample_env5_for_month(month)
    comp  = list(comp_state_0)
    base_vib = 0.08   # typical urban HK, not MTR-adjacent

    steps = []
    for t, action_name in enumerate(action_sequence):
        if t > 0 and t % 4 == 0:
            month = (month + 1) % 12

        vib = _clamp(
            base_vib + (0.65 if action_name == "vibration_burst" else _random.gauss(0, 0.008)),
            0.0, 2.5,
        )
        env5s    = _apply_action_to_env5(list(env5), action_name)
        env_full = env5s + [vib]

        next_comp, fail_probs = _degrade_components(list(comp), env5s, vib, action_name)
        steps.append(_sim_step_to_dict(t + 1, env_full, next_comp, fail_probs, action_name))

        env5 = _drift_env5(env5s, month)
        comp = next_comp

    return steps


def _build_demo_compare() -> dict:
    global _demo_compare_cache
    if _demo_compare_cache is not None:
        return _demo_compare_cache

    _demo_compare_cache = {
        "unfixed": {
            "ai":     _sim_rollout_demo(_DEMO_UNFIXED_COMP, _DEMO_AI_SEQ,     seed=42),
            "random": _sim_rollout_demo(_DEMO_UNFIXED_COMP, _DEMO_RANDOM_SEQ, seed=43),
            "mbis":   _sim_rollout_demo(_DEMO_UNFIXED_COMP, _DEMO_MBIS_SEQ,   seed=44),
        },
        "fixed": {
            "ai":     _sim_rollout_demo(_DEMO_FIXED_COMP,   _DEMO_AI_SEQ,     seed=42),
            "random": _sim_rollout_demo(_DEMO_FIXED_COMP,   _DEMO_RANDOM_SEQ, seed=43),
            "mbis":   _sim_rollout_demo(_DEMO_FIXED_COMP,   _DEMO_MBIS_SEQ,   seed=44),
        },
        "action_sequences": {
            "ai":     _DEMO_AI_SEQ,
            "random": [a or "none" for a in _DEMO_RANDOM_SEQ],
            "mbis":   ["none"] * _DEMO_HORIZON,
        },
        "horizon_weeks": _DEMO_HORIZON,
        "source": "simulator",
    }
    return _demo_compare_cache

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

    env_t  = torch.tensor(env_state_0,  dtype=torch.float32).unsqueeze(0)
    comp_t = torch.tensor(comp_state_0, dtype=torch.float32).unsqueeze(0)
    h      = None

    with torch.no_grad():
        for t, action_idx in enumerate(action_sequence):
            x_t              = build_input(env_t.squeeze(0), comp_t.squeeze(0), action_idx).unsqueeze(0)  # (1,18)
            env_next, comp_next, fail_next, h = model.step(x_t, h)                                        # (1,7)

            results.append(_state_to_dict(
                t + 1,
                env_next[0].tolist(),
                comp_next[0].tolist(),
                fail_next[0].tolist(),
                action_idx,
            ))
            env_t  = env_next
            comp_t = comp_next

    return results


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

class TrainRequest(BaseModel):
    n_epochs: int = 10
    n_trajectories: int = 10_000
    force_retrain: bool = False


class PlanRequest(BaseModel):
    env_state: Optional[List[float]] = None      # defaults to DEFAULT_ENV_STATE
    comp_state: Optional[List[float]] = None     # defaults to DEFAULT_COMP_STATE
    horizon: int = 40
    n_samples: int = 200
    n_elites: int = 20
    n_iterations: int = 5
    fixed: bool = False  # if True use FIXED_COMP_STATE (post-fix scenario)


class CompareRequest(BaseModel):
    env_state: Optional[List[float]] = None
    horizon: int = 40
    n_samples: int = 200
    n_elites: int = 20
    n_iterations: int = 5


@app.get("/health")
def health():
    return {"status": "ok", "model_ready": _model is not None}


@app.get("/demo/compare")
def demo_compare():
    """
    Pre-baked simulator curves for the live demo.
    Always returns calibrated, visually correct trajectories regardless of model state.
    Unfixed node: seal degraded to 0.55 after ~18 months without IP67 protection.
    Fixed node:   IP67 gasket retrofitted, seal at 0.92.
    """
    return _build_demo_compare()


@app.get("/model/status")
def model_status():
    status = get_training_status()
    status["model_ready"] = _model is not None
    return status


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

    env0  = req.env_state  or DEFAULT_ENV_STATE
    comp0 = FIXED_COMP_STATE if req.fixed else (req.comp_state or DEFAULT_COMP_STATE)

    cem_cfg = CEMConfig(
        horizon=req.horizon,
        n_samples=req.n_samples,
        n_elites=req.n_elites,
        n_iterations=req.n_iterations,
    )

    with _model_lock:
        action_sequence = cem_plan(_model, env0, comp0, cem_cfg)
        results         = _rollout(_model, env0, comp0, action_sequence)

    return {
        "action_sequence": [ACTION_NAMES[a] if a is not None else "none" for a in action_sequence],
        "steps": results,
    }


# ---------------------------------------------------------------------------
# /compare — three curves (AI, random, MBIS) for both unfixed and fixed node
# ---------------------------------------------------------------------------

import random as _random


def _random_sequence(horizon: int) -> list:
    return [_random.randint(0, len(ACTION_NAMES) - 1) for _ in range(horizon)]


def _mbis_sequence(horizon: int) -> list:
    return [None] * horizon


@app.post("/compare")
def compare(req: CompareRequest):
    """
    Returns all three stress curves (AI, random, MBIS) for the unfixed node,
    then reruns all three for the fixed node (post Apply Fix).

    Response shape:
    {
      "unfixed": { "ai": [...steps], "random": [...steps], "mbis": [...steps] },
      "fixed":   { "ai": [...steps], "random": [...steps], "mbis": [...steps] }
    }
    Each step is the standard state dict (timestep, seal, pcb, failure probs…).
    """
    if _model is None:
        return {"error": "model not ready"}

    env0    = req.env_state or DEFAULT_ENV_STATE
    cem_cfg = CEMConfig(
        horizon=req.horizon,
        n_samples=req.n_samples,
        n_elites=req.n_elites,
        n_iterations=req.n_iterations,
    )
    rand_seq = _random_sequence(req.horizon)
    mbis_seq = _mbis_sequence(req.horizon)

    with _model_lock:
        # Unfixed node
        ai_seq_unfixed   = cem_plan(_model, env0, DEFAULT_COMP_STATE, cem_cfg)
        unfixed = {
            "ai":     _rollout(_model, env0, DEFAULT_COMP_STATE, ai_seq_unfixed),
            "random": _rollout(_model, env0, DEFAULT_COMP_STATE, rand_seq),
            "mbis":   _rollout(_model, env0, DEFAULT_COMP_STATE, mbis_seq),
        }

        # Fixed node (post Apply Fix)
        ai_seq_fixed = cem_plan(_model, env0, FIXED_COMP_STATE, cem_cfg)
        fixed = {
            "ai":     _rollout(_model, env0, FIXED_COMP_STATE, ai_seq_fixed),
            "random": _rollout(_model, env0, FIXED_COMP_STATE, rand_seq),
            "mbis":   _rollout(_model, env0, FIXED_COMP_STATE, mbis_seq),
        }

    return {
        "unfixed": unfixed,
        "fixed":   fixed,
        "action_sequences": {
            "unfixed_ai": [ACTION_NAMES[a] if a is not None else "none" for a in ai_seq_unfixed],
            "fixed_ai":   [ACTION_NAMES[a] if a is not None else "none" for a in ai_seq_fixed],
        },
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
      { "horizon": 40, "fixed": false }

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

        env0  = config.get("env_state",  DEFAULT_ENV_STATE)
        comp0 = FIXED_COMP_STATE if fixed else config.get("comp_state", DEFAULT_COMP_STATE)

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
        )

        def _plan_and_rollout():
            with _model_lock:
                seq     = cem_plan(_model, env0, comp0, cem_cfg)
                results = _rollout(_model, env0, comp0, seq)
            return results

        steps = await loop.run_in_executor(None, _plan_and_rollout)

        # Stream steps one by one with a small delay for visual effect
        for step in steps:
            await websocket.send_json(step)
            await asyncio.sleep(0.05)   # 50 ms between frames → smooth 3D animation

        await websocket.send_json({"done": True, "total_steps": len(steps)})

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
