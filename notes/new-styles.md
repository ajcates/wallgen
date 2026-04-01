# Potential New Generative Styles for GWF

This document outlines 10 conceptual styles for the Generative Wallpaper Framework, focusing on high-visual impact and deep data integration.

---

## 1. Lichen Bloom (Organic Growth)
**Aesthetic**: Mimics the slow, fractal growth of crustose lichen and moss on a stone-textured background. It features rough edges, intricate branching, and earthy tones with neon "spores."
- **Data Mapping**:
    - `up` (Uptime): Determines the "age" and total spread of the lichen colonies.
    - `bp` (Battery): Controls the "health" or vibrancy—lower battery results in dry, desaturated patches; high battery yields lush, glowing edges.
    - `fm` (Free Memory): Dictates the complexity of the branching algorithms (L-systems).
- **Implementation**: Uses a Diffusion-Limited Aggregation (DLA) or a modified Cellular Automata to "grow" the path over several simulation steps in `process()`.

## 2. Prism Shifting (Light Refraction)
**Aesthetic**: A minimalist style featuring thick glass slabs and prisms that refract a single beam of light into a spectrum. It uses heavy Gaussian blurs and chromatic aberration.
- **Data Mapping**:
    - `hh:mm` (Time): Determines the "angle of the sun," shifting the direction of light beams and the resulting rainbow dispersion.
    - `pt` (Ping): Higher latency adds "impurities" or frosted glass effects to the prisms.
- **Implementation**: Utilizes `globalCompositeOperation = 'screen'` and multiple offset render passes to simulate light splitting through geometric `Path2D` shapes.

## 3. Data Topography (Isometric Terrain)
**Aesthetic**: A 3D isometric wireframe or shaded terrain map. It looks like a digital scan of a mountain range or a futuristic city grid.
- **Data Mapping**:
    - `bp` (Battery): Maps directly to the "peak height" or elevation. Low battery results in a flat, desolate plain; high battery creates towering peaks.
    - `fm` (Free Memory): Controls the "resolution" of the terrain mesh.
- **Implementation**: Calculates a 2D Perlin or Simplex noise heightmap in `init()`. `render()` uses isometric projection (transform matrices) to draw the grid lines.

## 4. Vaporwave Sunset (Retro Synthwave)
**Aesthetic**: A 1980s retro-futuristic aesthetic featuring a massive low-poly sun, a glowing perspective grid, and distant silhouettes of mountains.
- **Data Mapping**:
    - `hh` (Hour): The sun's vertical position and the sky's gradient color (shifting from purple to deep orange/red).
    - `up` (Uptime): Adds "scanlines" or VHS-style glitch artifacts that increase in frequency over time.
- **Implementation**: Uses a radial gradient for the sun with a custom clipping mask to create the "sliced" look. The grid is drawn with a perspective transform.

## 5. Magnetic Sand (Chladni Patterns)
**Aesthetic**: Thousands of tiny particles that behave like iron filings on a vibrating metal plate, forming symmetrical geometric patterns (Chladni figures).
- **Data Mapping**:
    - `pt` (Ping): Determines the "frequency" of vibration, which fundamentally changes the shape of the patterns.
    - `bp` (Battery): Controls the "magnetism" or how tightly particles clump together.
- **Implementation**: Particle physics simulation in `process()`. Particles are attracted to nodal lines defined by trigonometric functions derived from the log data.

## 6. Stained Glass (Voronoi Tessellation)
**Aesthetic**: A classic cathedral-style stained glass window where each pane is procedurally generated and glows from "internal" light.
- **Data Mapping**:
    - `fm` (Free Memory): The number of Voronoi sites (more memory = more intricate, smaller panes).
    - `hh:mm` (Time): Changes the "light-leak" direction and the color palette of the glass.
- **Implementation**: Computes a Voronoi diagram in `init()`. `render()` fills each cell with a gradient that mimics the uneven thickness of handmade glass.

## 7. Bioluminescent Deep (Abyssal Life)
**Aesthetic**: A dark, midnight-blue background with pulsing, translucent jellyfish-like entities. They leave trails of glowing "plankton" as they drift.
- **Data Mapping**:
    - `bp` (Battery Charging): When charging, the entities pulse rapidly and glow bright white. On discharge, they fade to deep blue/green.
    - `up` (Uptime): Increases the number of entities and the length of their trails.
- **Implementation**: Uses `ctx.shadowBlur` extensively for the glow. `process()` evolves the "tentacles" using inverse kinematics or simple sine-wave oscillations.

## 8. Auroral Veil (Solar Winds)
**Aesthetic**: Flowing, ethereal curtains of light resembling the Aurora Borealis, shifting and folding across a starry sky.
- **Data Mapping**:
    - `fm` (Free Memory): Determines the "height" and vertical span of the light curtains.
    - `pt` (Ping): Controls the speed of the "wind" or the frequency of the wave ripples.
- **Implementation**: Uses many thin, vertical lines or polygons with varying opacities and gradients. `process()` shifts the noise offsets to simulate movement.

## 9. Origami Fold (Paper Geometry)
**Aesthetic**: A 3D-feeling simulation of paper being folded and creased into complex geometric shapes. It features sharp shadows and "paper" textures.
- **Data Mapping**:
    - `bp` (Battery): The "complexity" of the fold. High battery = a complex crane or dragon; low battery = a simple triangle or square.
    - `hh` (Hour): Shifts the light source, changing how shadows fall across the creases.
- **Implementation**: Uses a set of "crease patterns" that are interpolated based on data. Each face of the "paper" is a polygon with a slightly different shade of the theme color.

## 10. Tectonic Drift (Magma & Crust)
**Aesthetic**: Dark, rocky plates that slowly drift apart, revealing glowing, incandescent magma in the cracks.
- **Data Mapping**:
    - `up` (Uptime): The "age" of the planet—more uptime results in more cracks and cooling crust.
    - `bp` (Battery): The "thermal energy"—high battery makes the magma glow bright yellow/white; low battery makes it a dull, cooling red.
- **Implementation**: A cracked-cell Voronoi approach where cells are slightly offset from each other. The "gaps" are filled with a multi-layered glow to simulate heat.
