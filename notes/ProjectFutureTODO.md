# GWF Future TODO: Architectural & Feature Roadmap

This document outlines high-priority and long-term improvements for the Generative Wallpaper Framework (GWF).

---

## 🛠️ Framework Core & Performance
- [ ] **Path2D Migration for All Styles**: Following the `expressive` style's success, migrate `curves`, `smoke`, and `nebula` to use cached `Path2D` objects to drastically reduce render times.
- [ ] **Global Error Boundaries**: Implement a more robust error handling system in `WallpaperEngine.js` that can fallback to a "Safe Style" if a custom style fails during `render`.
- [ ] **Sub-pixel Anti-aliasing Control**: Add a flag to `main.js` to toggle `imageSmoothingEnabled` globally for styles that require sharp pixel-perfect artifacts (like `vaporwave`).
- [ ] **Canvas Profiler**: Add a `--profile` flag to `main.js` that outputs timing data for each lifecycle step (`init`, `process`, `render`, `save`).

## 🎨 Styles & Aesthetics
- [ ] **Implement the "Lichen Bloom" Style**: Start building the DLA-based growth style from `new-styles.md`.
- [ ] **Implement "Vaporwave Sunset" Improvements**:
    - [ ] Add more "Tile Corruption" patterns.
    - [ ] Implement a specific "GBA Palette" constraint to enforce 15-bit color look.
- [ ] **Style Parameter Injection**: Allow overriding style-specific variables (e.g., `--num-blobs`, `--grid-density`) via CLI arguments.
- [ ] **Post-Processing Pipeline**: Implement a generic shader-like post-processing layer for effects like grain, bloom, and chromatic aberration that can be applied to any style.

## 🧮 Utilities & Math
- [ ] **Advanced Color Theory**: Expand `src/utils/color.js` with:
    - [ ] `Complementary`, `Triadic`, and `Analogous` palette generators.
    - [ ] Perceptual luminance sorting for better contrast in complex patterns.
- [ ] **Noise Library**: Add a `src/utils/noise.js` with Simplex and Perlin noise implementations to replace `Math.random()` in organic styles.
- [ ] **Physics Engine Lite**: Add a lightweight Verlet integration or particle-spring helper for styles like `energy` or `helix`.

## 📊 Data & Integration
- [ ] **Tasker Event Injection**: Allow `main.js` to accept a single "Current Event" via CLI (`--event "BP=20;PT=800"`) to allow real-time reactive wallpaper updates without reading log files.
- [ ] **JSON Data Source**: Support reading from a standard `.json` data source instead of just the specific Tasker log format.
- [ ] **Data Smoothing**: Implement a "Data Interpolator" that can smooth out jittery log data (like spikes in `pt` or `fm`) before passing it to the styles.

## 🌐 User Experience & Tooling
- [ ] **Web Dashboard**:
    - [ ] Finish the `web/server.js` implementation to provide a local UI for previewing wallpapers.
    - [ ] Allow users to "test" different data values (e.g., "What does this look like at 1% battery?") via sliders.
- [ ] **Automated Gallery Generation**: Add a script that generates a 10x10 grid of thumbnails for all styles to help with visual debugging.
- [ ] **Git Hook for Styles**: Add a pre-commit hook that runs `npm test` and a "Smoke Render" to ensure no style is broken before a commit.

---

## 📅 High-Priority (Next 3 Items)
1. **`Lichen Bloom` Implementation**: A high-impact organic style.
2. **`Tasker Event Injection`**: For better real-time responsiveness.
3. **`Path2D Migration`**: Performance parity for older styles.
