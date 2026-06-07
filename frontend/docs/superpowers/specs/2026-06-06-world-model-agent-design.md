# World Model Agent Design

## Goal

Integrate the world-model simulation as a real decision-making agent in the product flow, not as a static animation or chat summary. After a simulation run, the app should automatically analyze the output, explain the field failure risk, propose a credible hardware correction, and let the user apply the correction through the existing pipeline.

The demo must feel like: "Manu caught a latent field failure, explained why it happens, and patched the hardware before manufacturing."

## Product Flow

1. The user generates or loads a hardware design.
2. The chat offers `Run Simulation`.
3. The world model runs and animates the 3D node.
4. The center `Reports` tab stores and visualizes the telemetry evidence.
5. When the rollout completes, the app automatically calls a World Model Agent.
6. The agent posts a verdict card in the chat:
   - `pass`: no intervention required.
   - `warning`: field risk found; hardening is optional but recommended.
   - `critical`: build should be blocked until a resilience fix is applied.
7. The user can apply the recommended fix.
8. The pipeline re-resolves BOM, RFQ, sourcing, scene, and reports.
9. The chat prompts the user to run the simulation again to show reduced risk.

The center panel remains the evidence surface. The chat remains the decision and action surface.

## Architecture

Add a dedicated world-model analysis layer rather than folding the simulation result into the DfMA engine.

- `lib/world-model/agent.ts`
  - Pure deterministic analysis of a `SimulationReport`.
  - Computes severity, failure mode, peak week, root cause, evidence, affected components, and a recommended fix.
  - Contains configurable thresholds and generic failure-mode rules.
  - Does not mutate app state.

- `app/api/world-model/analyze/route.ts`
  - Receives `{ pipelineState, report, previousReports }`.
  - Calls the deterministic agent.
  - Returns a typed verdict.
  - Can later wrap the deterministic verdict with an LLM explanation, but the demo must not depend on the LLM.

- `lib/world-model-simulation.ts`
  - Keeps responsibility for running `/api/world-model/plan`, animating steps, and storing `SimulationReport`.
  - After the final frame, calls `/api/world-model/analyze`.
  - Adds a tool-call message for the analysis step.
  - Adds a world-model verdict card to the chat.

- `components/right/WorldModelVerdictCard.tsx`
  - Displays verdict, failure mode, evidence, root cause, and actions.
  - Uses the existing chat card style, but distinguishes field-risk findings from DfMA findings.
  - Primary action: apply recommended resilience fix.
  - Secondary action: run simulation again after a fix.

- `app/api/world-model/apply-fix/route.ts`
  - Applies the verdict's recommended fix.
  - If the fix maps to an existing DfMA warning/fix, reuse `applyPipelineFix`.
  - Otherwise apply a structured component edit through the existing edit pipeline.

## Data Model

Introduce world-model-specific types in `lib/types.ts`.

- `WorldModelVerdict`
  - `id`
  - `severity`: `pass | warning | critical`
  - `scenario`
  - `fixed`
  - `failureMode`
  - `title`
  - `summary`
  - `rootCause`
  - `evidence`
  - `affectedComponents`
  - `recommendedAction`

- `WorldModelEvidence`
  - `peakDeviceRisk`
  - `peakWeek`
  - `peakComponentId`
  - `peakComponentRisk`
  - `dominantFailureHead`
  - `dominantFailureProbability`
  - `triggerAction`

- `WorldModelRecommendedAction`
  - `kind`: `none | dfma_fix | component_edit`
  - `label`
  - `dfmaWarningId?`
  - `editOps?`
  - `explanation`

Add a new chat message type for world-model verdicts rather than overloading DfMA warning cards. This keeps DfMA and field-degradation concepts separate while preserving a unified chat flow.

## Verdict Rules

Thresholds live in `lib/world-model/agent.ts` and are easy to tune.

- `pass`
  - peak device risk < 20%
  - and peak component risk < 35%
  - and dominant failure probability < 25%

- `warning`
  - peak device risk from 20% to 50%
  - or peak component risk >= 35%
  - or dominant failure probability >= 25%

- `critical`
  - peak device risk >= 50%
  - or dominant failure probability >= 45%
  - or a trained critical component exceeds 60% risk

The agent always returns a verdict. Low-risk runs should still produce a concise `pass` verdict so the user sees that the world model was used.

## Failure Modes And Fix Mapping

The system should avoid hardcoded one-off output. The agent uses generic failure-mode families derived from model output fields.

- Moisture ingress / seal cascade
  - Signals: high `moisture_ingress_prob`, high `seal_failure_prob`, low `enclosure_seal_integrity`, high enclosure or moisture-sensor risk.
  - Preferred fix: map to existing IP/weatherproofing DfMA fix if available.
  - Fallback edit: add or upgrade gasket, membrane vent, weatherproof enclosure, corrosion-resistant fasteners.

- Thermal / battery stress
  - Signals: high `thermal_runaway_prob`, low `battery_soc`, high battery or compute risk.
  - Preferred fix: component edit for thermal isolation, heat spreader, safer battery module, or enclosure ventilation.

- Bracket fatigue / corrosion
  - Signals: high `bracket_failure_prob`, high `bracket_corrosion`, high bracket risk, vibration-triggered peak.
  - Preferred fix: component edit for vibration-isolating bracket, 316L stainless fasteners, or anti-corrosion coating.

- Sensor drift / calibration risk
  - Signals: high `moisture_sensor_drift`, `crack_sensor_drift`, or `tilt_sensor_drift`.
  - Preferred fix: component edit for calibration reference, redundant sensing, or higher-grade sensor package.

The Hong Kong facade-node demo should map cleanly to the existing IP/weatherproofing fix, but the mapping must be data-driven by failure-mode signals, not by checking a demo prompt string.

## UI Behavior

The chat card should be concise and action-oriented.

Critical example:

```text
World Model blocked this design
Moisture ingress cascade at week 38

Evidence
Peak device risk: 74%
Highest component: enclosure, 68%
Trigger: humidity soak + vibration burst

Root cause
The enclosure seal degrades under humidity and vibration, then moisture risk propagates into compute/radio components.

[Apply Resilience Fix]
```

After applying a fix:

- The card changes to show the fix was applied.
- The chat adds a `Run Simulation Again` action.
- The Reports tab can compare previous unfixed and fixed reports if both exist.

The Reports tab remains for charts and evidence. It should not become the main action surface.

## Robustness Requirements

- The demo must not depend on an LLM call for the verdict.
- The agent must handle empty or malformed reports with an error verdict that does not crash the UI.
- Applying a fix must be idempotent: applying the same verdict twice should not duplicate components.
- If no actionable fix is known, the card should explain the risk and mark the action as unavailable.
- Backend failures from `/api/world-model/plan` must keep the existing error handling.
- `/api/world-model/analyze` should not call external services in v1.

## Anti-Hardcoding Rules

Allowed:

- Named failure-mode families based on world-model output fields.
- Tunable numeric thresholds.
- A mapping from failure-mode family to existing fix mechanisms.
- Demo-specific copy only in README/demo documentation.

Not allowed:

- Checking for the demo prompt text.
- Checking for "Hong Kong" as the reason to create a fix.
- Hardcoded final chat output independent of the actual simulation report.
- Applying a fix without reading the current `PipelineState`.
- Fake supplier/BOM changes outside the existing pipeline.

## Testing Strategy

Unit tests should cover `lib/world-model/agent.ts` with synthetic reports:

- pass verdict for low-risk reports.
- warning verdict for medium device risk.
- critical verdict for high moisture ingress.
- thermal risk maps to component edit, not DfMA IP fix.
- moisture/seal risk maps to DfMA fix when the current pipeline can support it.
- malformed or empty report returns a safe non-crashing verdict.

Integration tests should cover:

- `startWorldModelSimulation` calls analysis after final frame.
- a world-model verdict message is added to chat.
- applying a verdict fix rehydrates pipeline state.
- README documents the world-model agent flow and local backend requirement.

## Documentation Updates

Implementation must update `README.md` in the same branch. The README should document:

- the new World Model Agent flow;
- local backend expectations for `/api/world-model/plan`;
- the distinction between DfMA risk checkpoint and World Model field-risk verdict;
- how to run tests/build after changing the world-model integration;
- the demo flow: generate design, apply DfMA fix, run simulation, receive verdict, apply resilience fix, rerun simulation.

## Success Criteria

- The world model produces a chat decision, not only telemetry.
- The warning/fix flow feels native to the existing product.
- The Hong Kong demo produces a strong moisture-ingress "build blocked" moment.
- The implementation remains generic enough for other product prompts.
- Tests, lint, and production build pass.
- README is updated.
