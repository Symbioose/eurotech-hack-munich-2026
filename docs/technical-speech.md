# Technical Speech

### Architecture And Agent Harness
The part worth checking in the repo is the agent harness. Manu is not one big prompt that writes a fake report. It runs a typed pipeline: context, compliance, component selection, hardware validation, BOM, DfMA, supplier routing and 3D scene generation.

Each agent has a bounded role, a max-step limit and an allowlist of tools. The harness records the trace, and if an agent tries to call a tool outside its scope, it is blocked.

The tools are MCP servers, not hidden prompts: compliance MCP, hardware MCP, supplier MCP and scene MCP. They read versioned libraries: the component catalog, component-selection rules, assembly patterns, DfMA rules, compliance rules and the GBA supplier graph.

That is the technical core: one shared ComponentGraph drives the BOM, the DfMA checks, the supplier questions and the 3D scene. BuildGuard is only one graph from a catalog of over a hundred hardware components. Today the reliable path is smart-city nodes; the architecture scales by adding more component families, rules and scene patterns.

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
