# Potential New Generative Styles for GWF

This document outlines 30 conceptual styles for the Generative Wallpaper Framework. The first 10 focus on organic and digital hybrids. The newly added 20 (styles 11-30) are heavily focused on **pure abstraction, extreme stylistic uniqueness, and mix-and-match modularity**. They are driven almost entirely by abstract relationships to `Time of Day` and `Battery Life` to create tension, balance, and rhythm.

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

---

### Abstract Mechanics: Time & Battery Integration (Styles 11-30)

*These concepts treat "Time" as a driver of position, proportion, cycle, or phase, and "Battery" as a driver of energy, tension, weight, or density.*

## 11. Tension Strings (Structural Integrity)
**Aesthetic**: A sparse void traversed by razor-thin, taut lines connecting unseen anchor points, resembling an abstract loom or suspension bridge.
- **Data Mapping**:
    - `bp` (Battery): Dictates the "tension" of the system. 100% means perfectly straight, rigid, vibrating lines. 10% means sagging, disconnected, or snapping strings.
    - `hh:mm` (Time): Shifts the anchor points along the edges of the canvas, causing the loom to slowly twist, intersect, and cross over itself throughout the day.

## 12. Sediment Compression (Accumulation)
**Aesthetic**: Horizontal or concentric bands of abstract texture, stripping away realism to look like minimalist cross-sections of geological strata or tree rings.
- **Data Mapping**:
    - `hh:mm` (Time): Determines the hue offset and the sequential generation of new micro-layers. Over a 24-hour cycle, a full 'ring' or 'block' of gradient is completed.
    - `bp` (Battery): Dictates the visual "weight" or compression of the layers. A high battery yields thick, expansive layers; low battery yields paper-thin, crushed, dense lines.

## 13. Chromatic Bleed (Viscous Diffusion)
**Aesthetic**: Colors that seep into each other across abstract boundaries, like wet ink spreading on damp watercolor paper, completely devoid of hard edges.
- **Data Mapping**:
    - `bp` (Battery): Controls the "viscosity" of the color fields. High battery creates contained, tense boundaries; low battery results in blurry, uncontrollable, bleeding washes that overtake the screen.
    - `hh:mm` (Time): Controls the color palettes (temperature shifts from warm to cool) and the direction of the fluid bleed (a shifting gravity vector).

## 14. Negative Space Carving (Erosion)
**Aesthetic**: A solid, monolithic block of color where abstract geometric shapes have been violently carved out, leaving behind a skeletal frame of negative space.
- **Data Mapping**:
    - `bp` (Battery): Determines how much "mass" remains. 100% is mostly solid; 5% is a fragile, lace-like remnant of the original shape teetering on collapse.
    - `hh:mm` (Time): Determines the shape of the cutting tool. Morning uses smooth, sweeping bezier curves; midnight uses harsh, jagged polygonal cuts.

## 15. Typographic Noise (Information Texture)
**Aesthetic**: Abstract, illegible glyphs or typographic blocks of varying weights overlaid to create a pure texture map, stripping letters of their meaning.
- **Data Mapping**:
    - `bp` (Battery): Controls the typographic weight (bold, ultra-black blocks when full; wispy, hairline strokes when empty).
    - `hh:mm` (Time): Dictates the grid alignment and kerning. Structured, rigid grids at noon; chaotic, scattered, overlapping layers at midnight.

## 16. Thermal Plumes (Viscous Flow)
**Aesthetic**: Large, unidentifiable blobs that slowly rise or sink, resembling a lava lamp but stripped down to pure minimalist geometry and high-contrast gradients.
- **Data Mapping**:
    - `bp` (Battery): Controls the "heat" or turbulence. High battery causes rapid, fragmented splitting of blobs; low battery results in slow, massive, lazy coalescing forms.
    - `hh:mm` (Time): Controls the gravity vector (rising during the day, sinking at night) and the color mapping of the temperature gradient.

## 17. Granular Entropy (Disintegration)
**Aesthetic**: Massive, solid geometric primitives (circles, triangles) that are breaking apart into thousands of tiny, drifting dust particles at their trailing edges.
- **Data Mapping**:
    - `bp` (Battery): Dictates the cohesion of the shapes. High battery equals solid primitives with crisp edges. Low battery leaves mostly clouds of drifting dust.
    - `hh:mm` (Time): Determines the "wind" direction carrying the dust and the rotation angle of the base shapes.

## 18. Moiré Interference (Waveforms)
**Aesthetic**: Overlapping, tightly packed geometric lines (sine/cosine waves or straight grids) creating complex, pulsating optical illusions (moiré patterns).
- **Data Mapping**:
    - `bp` (Battery): Dictates the amplitude, line thickness, and frequency density of the base waves.
    - `hh:mm` (Time): Dictates the phase shift and the angle of intersection between the overlapping wave groups, fundamentally altering the emergent optical pattern over 24 hours.

## 19. Monolithic Scale (Proportion)
**Aesthetic**: A single, massive abstract shape (like a sheer rectangular cliff face or a massive sphere) dominating the canvas, pushing all other visual elements to the extreme margins.
- **Data Mapping**:
    - `bp` (Battery): Dictates the scale of the monolith. 100% fills almost the entire screen, suffocating the margins. 1% shrinks it to a tiny, isolated speck in a sea of empty space.
    - `hh:mm` (Time): Dictates the rotation, internal texture, and the anchor point of the monolith within the frame.

## 20. Asymmetric Equilibrium (Balance)
**Aesthetic**: Two opposing abstract forces or shapes balancing each other precariously, relying on extreme asymmetry to create visual tension.
- **Data Mapping**:
    - `bp` (Battery): Controls the visual weight (color darkness/saturation and literal size) of the primary, grounding shape.
    - `hh:mm` (Time): Controls the position and pivot point of the counter-balancing secondary shapes, keeping the composition mathematically balanced but visually uneasy.

## 21. Light and Void (Ambient Occlusion)
**Aesthetic**: Stark, harsh, simulated lighting falling across completely invisible geometry. The shapes are only perceived through the cast shadows and ambient occlusion they create.
- **Data Mapping**:
    - `bp` (Battery): Controls the intensity and sharpness of the light. High battery equals a harsh, high-contrast spotlight. Low battery equals a dim, soft, muddy ambient glow.
    - `hh:mm` (Time): Controls the angle and elevation of the virtual light source, casting long, dramatic shadows at dawn/dusk and short, tight shadows at midday.

## 22. Digital Decay (Artifacting)
**Aesthetic**: Pure, flat geometry subjected to intentional, abstract data corruption, pixel sorting, and block displacement.
- **Data Mapping**:
    - `bp` (Battery): Controls the severity of the databending. 100% is pristine, perfect geometry; 10% is heavily corrupted, glitched, and stretched beyond recognition.
    - `hh:mm` (Time): Dictates the *type* of glitch applied (e.g., horizontal chromatic shifting in the morning, vertical pixel melting at night).

## 23. Emergent Colonies (Rule-based Automata)
**Aesthetic**: A grid of tiny geometric cells living, dying, and leaving "ghost" trails based on abstract mathematical rules, devoid of any organic biological context.
- **Data Mapping**:
    - `bp` (Battery): Controls the survival threshold/density of the cells. High battery encourages blooming, chaotic colonies. Low battery forces sparse, dying, isolated cells.
    - `hh:mm` (Time): Shifts the underlying ruleset (e.g., transitioning from Conway's Game of Life to Brian's Brain) every few hours, changing the emergent behavior.

## 24. Folded Dimensions (Perspective Distortion)
**Aesthetic**: 2D planes folded into simulated 3D space, creating impossible, Escher-like geometry that breaks logical perspective.
- **Data Mapping**:
    - `bp` (Battery): Controls the number of folds and the depth of the extrusion. Low battery unfolds the shape back into a flat, boring 2D plane.
    - `hh:mm` (Time): Dictates the camera angle or perspective projection matrix, continuously warping the perception of the folds.

## 25. Magnetic Attractors (Force Fields)
**Aesthetic**: Invisible nodes scattered across the canvas pulling and pushing a dense field of thousands of fine lines, revealing an invisible magnetic topography.
- **Data Mapping**:
    - `bp` (Battery): Controls the strength of the magnetic nodes. Low battery means the lines barely deviate from a straight, parallel path.
    - `hh:mm` (Time): Controls the coordinates and polarity of the attractor nodes, completely altering the topography of the lines over 24 hours.

## 26. Resonant Echoes (Decay)
**Aesthetic**: A single, bold shape repeated outwards infinitely, with each "echo" decaying in opacity, thickness, and structural integrity.
- **Data Mapping**:
    - `bp` (Battery): Controls the number of echoes and their physical spacing. Low battery means only one or two faint echoes remain.
    - `hh:mm` (Time): Controls the distortion, rotation, or scaling factor applied to each successive echo, morphing the overall shape.

## 27. Material Phase Shift (State Change)
**Aesthetic**: A visual representation of transitioning between solid, liquid, and gaseous states using purely abstract textures (e.g., hard polygons vs. bezier waves vs. noisy static).
- **Data Mapping**:
    - `bp` (Battery): Dictates the state. 100% = sharp, crystalline solid. 50% = viscous, overlapping liquid forms. 10% = ethereal, noisy, sparse gas.
    - `hh:mm` (Time): Dictates the color palette temperature and the speed/frequency of the internal noise within the current phase.

## 28. Fractured Tessellation (Shattered Glass)
**Aesthetic**: The entire canvas is split into sharp, irregular polygonal shards, resembling an abstract cracked mirror.
- **Data Mapping**:
    - `bp` (Battery): Dictates the number of shards and their separation distance. Low battery creates massive gaps between fewer shards.
    - `hh:mm` (Time): Controls the internal gradients within each shard and the angle of the underlying "fracture" algorithm (e.g., Voronoi seed distribution).

## 29. Orbital Rhythm (Mechanics)
**Aesthetic**: Dozens of abstract shapes revolving around invisible, moving center points, leaving thick, sweeping trails that map their trajectory.
- **Data Mapping**:
    - `bp` (Battery): Controls the orbital speed and the eccentricity of the ellipses. Low battery leads to slow, perfectly circular, lazy orbits.
    - `hh:mm` (Time): Controls the number of orbiting bodies, their size, and the shifting location of the invisible center points.

## 30. Dissonant Misalignment (Grids)
**Aesthetic**: Multiple structured grids overlaid on top of each other with slight, uncomfortable misalignments, creating a feeling of vibration and dissonance.
- **Data Mapping**:
    - `bp` (Battery): Dictates the opacity and stroke width of the grids. High battery yields thick, aggressive, high-contrast grids.
    - `hh:mm` (Time): Controls the angle of rotation and the scale of the individual grid cells, constantly shifting the nodes of intersection.
