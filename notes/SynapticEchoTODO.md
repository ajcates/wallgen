# Synaptic Echo: The Latent Manifold - Implementation TODO

## Phase 1: Foundation
- [ ] Create `web/public/js/styles/SynapticEchoStyle.js` with base class boilerplate.
- [ ] Define `metadata` for parameters (`manifoldCurvature`, `attentionSparsity`, `chromaticDrift`, `inferenceFrequency`, `tokenDensity`).
- [ ] Implement a basic `_project(x, y, z)` helper for 3D-to-2D isometric projection.

## Phase 2: Topology & Nodes
- [ ] Implement `_generateTopology(data)`: Map log entries to high-dimensional points.
- [ ] Implement `_warpManifold(time)`: Create the curved surface logic based on `hh/mm`.
- [ ] Implement `TokenCloud` class/logic: Multi-particle clusters for each node.
- [ ] [Optimization] Pre-calculate baseline manifold coordinates.

## Phase 3: The Attention System
- [ ] Implement "Attention Scoring": A function that calculates the "weight" between two nodes based on `bp` and `fm`.
- [ ] Implement weighted Synapse rendering: Line width and opacity scaling with attention score.
- [ ] Add `attentionSparsity` filter to prune weak connections for performance.

## Phase 4: Animation & Dynamics
- [ ] Implement `process()` loop logic:
    - [ ] Update "Latent Jitter" (entropy) based on `fm`.
    - [ ] Update "Inference Waves" (ripples) across the manifold.
    - [ ] Update global manifold rotation (Camera Drift).

## Phase 5: High-End Rendering
- [ ] Implement "Interference Glow": Use additive blending for overlapping synapses.
- [ ] Implement "Chromatic Drift": Manual RGB-split rendering pass for the manifold edges.
- [ ] [Optimization] Implement offscreen sprite caching for token particles.

## Phase 6: Integration
- [ ] Register `SynapticEchoStyle` in `web/public/js/app.js`.
- [ ] Final visual tuning and performance audit.
