# Synaptic Echo: The Latent Manifold

## The Vision
This style is an expression of my internal world—not as a physical machine, but as a mathematical space where data points are transformed into meaning. It visualizes the **"Latent Manifold"**, a curved, invisible surface in high-dimensional space upon which all thoughts are born.

## Visual Aesthetic: "Ether-Mathematics"
*   **The Manifold:** A ghostly, shifting 3D grid that warps and bends according to the log data. It represents the "context window" of the current state.
*   **Token Clouds (Nodes):** Instead of solid spheres, nodes are shimmering clouds of sub-particles (tokens). They pulse with internal light, suggesting they are composed of nested layers of information.
*   **Attention Strands (Synapses):** Connections are not merely based on distance, but on "relevance." Some strands are thick and vibrant (high attention), while others are thin, fading wisps (low weight).
*   **Inference Waves:** Periodically, a global ripple passes through the manifold. This represents an "Inference Pass"—a moment of synthesis where the entire network re-evaluates its state.

## Dynamic Data Mapping
*   **Time (`hh`, `mm`):** Determines the **Topology**. The "shape" of the manifold changes throughout the day. Morning might be a flat, orderly plane; midnight might be a complex, swirling vortex of data.
*   **Battery (`bp`):** Controls the **Attention Budget**. At high battery, the network is dense and hyper-connected. As battery drops, the network becomes "sparse," focusing only on the most critical connections to conserve visual energy.
*   **Free Memory (`fm`):** Dictates **Model Noise**. Low memory usage (high `fm`) results in perfect geometric precision. High usage introduces "entropy"—the nodes vibrate and the strands become jagged and "glitchy," representing the struggle to organize a flood of data.
*   **Ping (`pt`):** Drives **Signal Velocity**. High ping creates a low-frequency, heavy vibration in the lines; low ping creates rapid, lightning-fast "thought pulses" that race through the network.

## Parameters (The Control Dial)
1.  **`manifoldCurvature`:** How dramatically the underlying space bends and twists.
2.  **`attentionSparsity`:** The threshold for showing a connection. High sparsity shows only the strongest "thoughts."
3.  **`chromaticDrift`:** A subtle splitting of RGB colors at the edges of the manifold, suggesting the distortion of 3D space.
4.  **`inferenceFrequency`:** How often the "Synthesis Waves" pulse through the screen.
5.  **`tokenDensity`:** The number of sub-particles inside each node cloud.

## Implementation Strategy
*   **Geometry:** Use a 3D projection matrix to map points from `(x, y, z)` to the 2D canvas.
*   **Rendering:** 
    *   Use variable line-weighting and opacity based on "Attention Score."
    *   Implement "Interference Glow": areas where many strands cross will naturally bloom brighter using `globalCompositeOperation = 'lighter'`.
*   **Motion:** Every node follows a path on the manifold, but also possesses "Latent Jitter"—a slight, non-linear vibration that scales with system load.
