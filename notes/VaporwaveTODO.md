# Refined TODO: Vaporwave Sunset (GBA Glitch Edition)

This style is a fusion of late-80s aesthetics and early-2000s handheld hardware limitations. It prioritizes high-contrast neon palettes, sharp geometry, and intentional digital "corruption" that feels like a failing GameBoy Advance cartridge.

---

## 🎨 Visual Identity & Architecture

### 1. The "Silicon" Sun
- **Visual**: A massive, vibrant sphere with a neon rim and a series of horizontal transparent "slats" that grow wider toward the horizon.
- **GBA Twist**: The sun shouldn't use smooth gradients. It should use **Dithered Stepped Gradients** (3-4 discrete colors) to mimic the GBA's limited color depth.
- **Data Link**: 
    - `hh:mm`: The vertical position (Y-axis). 
    - `bp` (Battery): The "integrity" of the sun. At <20% battery, the sun should "tear" horizontally.

### 2. The Infinite Perspective Grid
- **Visual**: A neon grid receding into a dark void. 
- **GBA Twist**: The grid lines should be 1-2 pixels wide with no anti-aliasing.
- **Animation**: The grid scrolls toward the viewer. The speed is tied to `pt` (Ping)—higher latency makes the world "lag" or scroll faster in bursts.

### 3. Procedural Glitch Palm Trees
- **Visual**: Silhouette trees that look like "sprites." 
- **Trunk**: A series of stacked rectangles with a slight sine-wave wobble.
- **Fronds**: Sharp, angular lines (angular, not curved).
- **Glitch Mechanic**: Trees should occasionally "flicker" or be drawn with a vertical offset (GBA sprite-overflow effect).

---

## 🛠️ Phase-by-Phase implementation

### Phase 1: Core Rendering & Geometry
- [ ] **Class Scaffold**: `VaporwaveSunsetStyle` in `src/styles/`.
- [ ] **The "Dithered" Palette**: 
    - Use `colorUtils` to pick a "Hero" color (e.g., `#ff00ff`) and its "Hardware Limit" counterpart (e.g., `#00ffff`).
- [ ] **Grid Implementation**: 
    - Draw horizontal lines with increasing spacing (perspective).
    - Draw vertical lines converging at a "Vanishing Point" at the horizon.
- [ ] **Sun Implementation**:
    - Draw a circle filled with a `LinearGradient` that has sharp color stops (no smooth transitions).
    - Use `ctx.clearRect` or a clipping mask to create the horizontal slats.

### Phase 2: Handheld Hardware Artifacts (The "GBA" Pass)
- [ ] **VRAM Corruption (Tile Shifting)**:
    - Randomly select 32x32 pixel "tiles" on the canvas and swap their positions or mirror them.
    - **Trigger**: Tied to `fm` (Free Memory). Low memory = more tile corruption.
- [ ] **Scanline "Jitter"**:
    - Select a random range of Y-coordinates and offset the `ctx.drawImage` of the canvas for just those lines by 5-20 pixels.
    - This mimics the GBA's DMA transfer errors.
- [ ] **Chroma Wrap**:
    - When a certain data threshold is met, invert the colors of a specific horizontal band of the screen.

### Phase 3: VR "Pixel Stretch" (The "Smear" Zoom)
- [ ] **The Smear Logic**:
    - After the main render, capture the center 80% of the canvas.
    - Loop 5-10 times:
        - Draw the captured area scaled up by 1.05x.
        - **Critical**: Use `imageSmoothingEnabled = false` to ensure pixels stay sharp and "streaky" rather than blurry.
        - Use a low `globalAlpha` (0.2) to let the layers accumulate into a "light trail."
- [ ] **Data Link**: 
    - `up` (Uptime): Controls the "Zoom Depth." Long uptime = more reality-warping smear.

### Phase 4: Integration & Optimization
- [ ] **Path2D Optimization**: 
    - Cache the Palm Tree "Sprite" paths as `Path2D` objects to keep the FPS high even with glitches.
- [ ] **Main.js Registration**:
    - Add the style to the engine's registry.
- [ ] **Validation**: 
    - Run `node main.js --style vaporwave` and verify the GBA artifacts look "crunchy" and not just blurry.

---

## 📈 Data Mapping Summary
| Data Point | Visual Mapping |
| :--- | :--- |
| **Battery (bp)** | Sun integrity and Grid "glow" intensity. |
| **Free Memory (fm)** | Frequency of "Tile Corruption" (VRAM glitches). |
| **Ping (pt)** | Grid scroll speed and "Scanline Jitter" frequency. |
| **Uptime (up)** | Intensity of the "VR Pixel Stretch" smear. |
| **Time (hh:mm)** | Sun elevation and sky gradient phase. |
