# Refined TODO: Vaporwave Sunset (GBA Glitch Edition) [COMPLETED]

This style is a fusion of late-80s aesthetics and early-2000s handheld hardware limitations. It prioritizes high-contrast neon palettes, sharp geometry, and intentional digital "corruption" that feels like a failing GameBoy Advance cartridge.

---

## 🎨 Visual Identity & Architecture

### 1. The "Silicon" Sun [DONE]
- [x] **Visual**: A massive, vibrant sphere with a neon rim and a series of horizontal transparent "slats" that grow wider toward the horizon.
- [x] **GBA Twist**: The sun shouldn't use smooth gradients. It should use **Dithered Stepped Gradients** (3-4 discrete colors) to mimic the GBA's limited color depth.
- [x] **Data Link**: 
    - [x] `hh:mm`: The vertical position (Y-axis). 
    - [x] `bp` (Battery): The "integrity" of the sun. At <20% battery, the sun should "tear" horizontally.

### 2. The Infinite Perspective Grid [DONE]
- [x] **Visual**: A neon grid receding into a dark void. 
- [x] **GBA Twist**: The grid lines should be 1-2 pixels wide with no anti-aliasing.
- [x] **Animation**: The grid scrolls toward the viewer. The speed is tied to `pt` (Ping)—higher latency makes the world "lag" or scroll faster in bursts.

### 3. Procedural Glitch Palm Trees [DONE]
- [x] **Visual**: Silhouette trees that look like "sprites." 
- [x] **Trunk**: A series of stacked rectangles with a slight sine-wave wobble.
- [x] **Fronds**: Sharp, angular lines (angular, not curved).
- [x] **Glitch Mechanic**: Trees should occasionally "flicker" or be drawn with a vertical offset (GBA sprite-overflow effect).

---

## 🛠️ Phase-by-Phase implementation

### Phase 1: Core Rendering & Geometry [DONE]
- [x] **Class Scaffold**: `VaporwaveSunsetStyle` in `src/styles/`.
- [x] **The "Dithered" Palette**: 
    - [x] Use `colorUtils` to pick a "Hero" color (e.g., `#ff00ff`) and its "Hardware Limit" counterpart (e.g., `#00ffff`).
- [x] **Grid Implementation**: 
    - [x] Draw horizontal lines with increasing spacing (perspective).
    - [x] Draw vertical lines converging at a "Vanishing Point" at the horizon.
- [x] **Sun Implementation**:
    - [x] Draw a circle filled with a `LinearGradient` that has sharp color stops (no smooth transitions).
    - [x] Use `ctx.clearRect` or a clipping mask to create the horizontal slats.

### Phase 2: Handheld Hardware Artifacts (The "GBA" Pass) [DONE]
- [x] **VRAM Corruption (Tile Shifting)**:
    - [x] Randomly select 32x32 pixel "tiles" on the canvas and swap their positions or mirror them.
    - [x] **Trigger**: Tied to `fm` (Free Memory). Low memory = more tile corruption.
- [x] **Scanline "Jitter"**:
    - [x] Select a random range of Y-coordinates and offset the `ctx.drawImage` of the canvas for just those lines by 5-20 pixels.
    - [x] This mimics the GBA's DMA transfer errors.
- [x] **Chroma Wrap**:
    - [x] When a certain data threshold is met, invert the colors of a specific horizontal band of the screen.

### Phase 3: VR "Pixel Stretch" (The "Smear" Zoom) [DONE]
- [x] **The Smear Logic**:
    - [x] After the main render, capture the center 80% of the canvas.
    - [x] Loop 5-10 times:
        - [x] Draw the captured area scaled up by 1.05x.
        - [x] **Critical**: Use `imageSmoothingEnabled = false` to ensure pixels stay sharp and "streaky" rather than blurry.
        - [x] Use a low `globalAlpha` (0.2) to let the layers accumulate into a "light trail."
- [x] **Data Link**: 
    - [x] `up` (Uptime): Controls the "Zoom Depth." Long uptime = more reality-warping smear.

### Phase 4: Integration & Optimization [DONE]
- [x] **Path2D Optimization**: 
    - [x] Cache the Palm Tree "Sprite" paths as `Path2D` objects to keep the FPS high even with glitches.
- [x] **Main.js Registration**:
    - [x] Add the style to the engine's registry.
- [x] **Validation**: 
    - [x] Run `node main.js --style vaporwave` and verify the GBA artifacts look "crunchy" and not just blurry.

---

## 📈 Data Mapping Summary [DONE]
| Data Point | Visual Mapping | Status |
| :--- | :--- | :--- |
| **Battery (bp)** | Sun integrity and Grid "glow" intensity. | [OK] |
| **Free Memory (fm)** | Frequency of "Tile Corruption" (VRAM glitches). | [OK] |
| **Ping (pt)** | Grid scroll speed and "Scanline Jitter" frequency. | [OK] |
| **Uptime (up)** | Intensity of the "VR Pixel Stretch" smear. | [OK] |
| **Time (hh:mm)** | Sun elevation and sky gradient phase. | [OK] |
