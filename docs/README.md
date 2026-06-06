# Physical Cursor Docs

This folder contains the clean project context for the EuroTech Hong Kong Hackathon.

It is intended to be safe for:

- the build team
- teammates' AI agents
- mentors
- judges

It should not include internal competitor intelligence, private playbooks, or broad brainstorming history.

## Project

**Physical Cursor for Smart City Nodes**

Track:

> **Smart City**

Current demo object:

> **BuildGuard Node**

Core flow (user-facing):

> **Problem -> Deployment Context -> 3D Smart City Node -> X-Ray -> Fix -> GBA Supplier Route**

Backend (current runtime pipeline):

> **Prompt -> Context Gate -> Context Agent -> Compliance MCP -> Component Agent -> Hardware MCP -> BOM Resolver -> DfMA Engine -> Risk Checkpoint -> Apply Fix -> Supplier MCP -> Scene MCP**

Important runtime rule:

> The final 3D scene is generated through `scene.generate_scene_graph` on the local Scene MCP. It is required, not silently faked by a fallback scene.

## Files

- `hackathon-context.md` - event context, tracks, deliverables, judging criteria.
- `product-brief.md` - what Physical Cursor is and why it should win.
- `multi-agent-pipeline.md` - multi-agent architecture, schemas, catalog rules and orchestration.
- `runtime-and-defaults-audit.md` - exhaustive audit of defaults, checked-in data, fallback policy and hardcode boundaries.
- `buildguard-node.md` - the demo object, components, risk, fix and supplier route.
- `demo-and-build-plan.md` - exact user flow, 2-minute videos and MVP build scope.
- `worldmodel.md` - DfMA / simulation layer (implemented as the DFMA Engine in the pipeline).
- `jury-audience-context.md` - Smart City judge audience context and pitch implications.
- `agent-prompt.md` - copy-paste prompt for an AI agent working on this repo.

## Short Pitch

Smart cities need physical infrastructure, but every new sensor, safety node or edge-AI device gets blocked by hardware expertise, deployment constraints, sourcing and pilot planning before it can even be tested.

Physical Cursor turns a dense-city problem into a reviewable hardware brief via a multi-agent + MCP pipeline:

> Context Gate → Context Agent → Compliance MCP → Component Agent (catalog-only) → Hardware MCP → deterministic BOM + DfMA → risk checkpoint → Apply Fix → Supplier MCP → required Scene MCP.

Outputs: deployment context, component graph, BOM, DfMA warning, Apply Fix and Hong Kong/GBA supplier route.

For this hackathon, we show it with **BuildGuard Node**:

> a low-maintenance facade sensor node for aging Hong Kong residential buildings between Mandatory Building Inspection cycles.
