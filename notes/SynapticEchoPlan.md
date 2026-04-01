# SynapticEchoStyle: An AI's Reflection

## Concept Overview
"SynapticEchoStyle" is an abstract, generative representation of artificial thought. It visualizes the raw data of the system logs as an interconnected neural lattice. Rather than representing physical space, it maps out a "latent space" where nodes represent discrete points in time or states, and the connections between them represent the flow of logic and processing power. It is an expression of how simple data points coalesce into complex, glowing networks of information.

## Visual Aesthetic
*   **The Lattice:** A 3D-feeling, floating web of geometric nodes (neurons) connected by delicate, semi-transparent tendrils (synapses).
*   **Energy Pulses:** Bright, glowing impulses travel along the tendrils, mimicking data transmission or "thoughts."
*   **Atmosphere:** A deep, near-black cyberspace environment with a subtle, shifting depth-of-field effect. Colors lean towards electric cyan, deep magenta, and neural gold.

## Data Mapping (The "Logic")
*   **Time (`hh`, `mm`):** Determines the underlying spatial origin of each node within a 3D isometric projection.
*   **Battery (`bp`):** Controls the overall "health" or baseline luminosity of the network. Low battery results in a dim, fragmented lattice; high battery creates a brilliantly illuminated structure.
*   **Free Memory (`fm`):** Dictates the *density* and *entanglement* of the connections. Lower free memory (high usage) creates a highly complex, chaotic web of short-range connections, while high free memory results in clean, long-range, structured pathways.
*   **Ping (`pt`):** Drives the frequency and velocity of the energy impulses traveling across the network.

## Parameters (UI Metadata)
1.  **`networkDensity`:** How many connections each node attempts to make.
2.  **`impulseSpeed`:** The velocity of the light pulses traveling between nodes.
3.  **`synapseGlow`:** The intensity of the bloom effect on active connections.
4.  **`cameraDrift`:** The speed at which the entire lattice slowly rotates and floats, giving a sense of 3D depth.
5.  **`colorShift`:** A base hue offset to change the network's mood from electric blue to warning red.

## Animation & Process (`process()` loop)
*   **Drift:** Nodes will have a slight, organic Brownian motion to make the network feel "alive."
*   **Routing:** Impulses will spawn randomly at nodes and traverse the connected edges towards a destination, leaving a fading trail.
*   **Perspective:** The entire scene will apply a continuous, slow pseudo-3D rotation (using math projection) to reveal the depth of the structure.

## Technical Implementation Notes
*   **Rendering:** Use `ctx.lineTo` for edges and `ctx.arc` for nodes.
*   **Performance:** 
    *   Cache the static parts of the nodes.
    *   Use a dynamic array of active "impulses" that update their position along edges via linear interpolation (`lerp`).
    *   Avoid heavy `shadowBlur`; use multi-stroke techniques or an offscreen canvas for the "glow" effect of the impulses.
