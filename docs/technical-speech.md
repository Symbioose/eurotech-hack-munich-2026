# Technical Speech

### Architecture And Agent Harness
Manu is not one big prompt generating a fake hardware report. It is an agent harness that turns a physical product idea into a reviewable hardware brief.

The runtime is a typed pipeline. The orchestrator runs specialist agents: context, compliance, component selection,
hardware validation, BOM, DfMA, supplier routing and 3D scene generation.

Each agent has a bounded role, a max step limit, and an allowlist of tools. The compliance agent can call the compliance MCP, 
the component agent can call the hardware MCP, the supplier agent can call the supplier MCP, and the scene agent can call the scene MCP. 
The harness records the trace and blocks agents from calling tools outside their scope.

The MCP tools read versioned libraries: component catalog, assembly patterns, DfMA rules, compliance rules and the GBA supplier graph.

Today the reliable demo path is smart-city nodes, but BuildGuard is only one graph from the library. The catalog has over a 
hundred hardware components across sensors, compute, connectivity, enclosures, power, mechanical parts, indicators, actuators and fixes.

The same component IDs drive the BOM, the 3D scene, the DfMA checks and the supplier questions.
So the 3D view is not separate from the procurement model; it is the same component graph rendered visually.

Once this hardware brief exists, we can stress-test it. That is where the world model comes in.

### World Model
Our World Model is made of 200,000-parameters trained in under 10 minutes on almost a million examples, 
calibrated to Hong Kong climate data, NASA battery degradation curves, and ISO coastal corrosion standards. 
It predicts next-step seal integrity, PCB health, battery state, corrosion, and four failure probabilities over components. 
The final MSE loss and BCE loss values of our model are  below 0.2. With a rollout drift ratio: 1.02× — meaning the model stays stable 
over 40-step planning horizons without error compounding. On top of that, a Cross-Entropy Method planner searches over 200 candidate 
stress sequences per iteration to discover worst-case failure protocols — purely from the learned model, no simulation required.

### Closing Line
This is the hackathon version: one reliable product family, one learned stress layer, and a real agent harness. 
With more time, the same architecture scales into larger tool libraries, product-family-specific models, and eventually a more general physical world model.
