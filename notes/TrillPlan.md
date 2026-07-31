# Trill Style Implementation Plan (Refined)

"Trill" is a postmodern abstract style characterized by geometric complexity, rich textures, and a balanced but asymmetrical composition.

## Visual Characteristics
- **Geometry**: Postmodern arrangement of shapes (squarcles, polygons, abstract blobs).
- **Styling**: 
    - Complex gradients (linear, radial, conic).
    - Diverse border styles (dashed, double, variable thickness, glow).
    - Drop shadows and inner shadows for depth.
    - Emboss/deboss effects using highlight/shadow overlays.
- **Atmosphere**:
    - Subtle patterns (noise, dots, grids) within shapes.
    - Motion blur effects via directional scaling and alpha fading.
    - "Ghost images": Faded, trailing copies of primary elements with "melting" properties (distortion).
- **Composition**:
    - Vertically centered.
    - Slightly above the horizontal center (golden ratio or rule of thirds influence).
    - Asymmetrical but carefully balanced weight.

## Technical Implementation

### 1. Data Mapping (`init` & `transform`)
- **Vibrance**: Battery percentage (`bp`) maps to color saturation and gradient intensity. [DONE]
- **Ghosting Direction**: Hour (`hh`) and minute (`mm`) determine the angle and length of trailing "ghost" effects. [DONE]
- **Complexity**: Free memory (`fm`) controls the density of shapes and pattern complexity. [DONE]

### 2. Color Scheme Generation
- Procedural generator creating harmonized "Postmodern" palettes (mixing high-contrast accents with muted base tones). [DONE]

### 3. Shape Engine
- Library of primitives: Squarcles, N-gons, Blobs, and compound shapes. [DONE]
- Collision-aware layout to ensure "consistent spacing" while maintaining asymmetry. [DONE]

### 4. Effects Pipeline
- **Layered Rendering**: Background -> Ghost Trails -> Shadow Layer -> Main Shapes -> Patterns -> Overlays. [DONE]
- **Advanced Borders**: Implementation of "Double" and "Dashed" stroke logic. [DONE]

## Comprehensive TODO List

### Phase 1: Core Architecture
- [x] Create `src/styles/TrillStyle.js`.
- [x] Register `trill` in `main.js`.
- [x] Implement base `init` with data-driven palette generation.

### Phase 2: Geometry & Composition
- [x] Implement "Postmodern" shape generator (Squircles, Blobs, Polygons).
- [x] Develop composition algorithm (Vertically centered, Y-offset at 0.45).
- [x] **Refinement**: Implement a "Spring-based" or "Grid-jitter" layout to ensure shapes don't overlap awkwardly while remaining asymmetrical.

### Phase 3: Visual Polish & Effects
- [x] Implement Gradient Fills and Base Borders.
- [x] Add Drop Shadows and basic Emboss effects.
- [x] Implement basic Ghost Trailing.
- [x] **Refinement**: Add "Melting" effect to ghosts (slight skew/scale per ghost step).
- [x] **Refinement**: Add "Double Border" support (rendering two strokes with different widths).
- [x] **Refinement**: Enhance patterns with "Noise" or "Grain" textures specific to individual shapes.

### Phase 4: Final Optimization
- [x] **Path Caching**: Pre-calculate and store `Path2D` objects in `init` to avoid re-generating them during the `render` call.
- [x] **Pattern Pre-rendering**: Create off-screen canvases for patterns once and reuse them as `CanvasPattern` objects.
- [x] **State Management**: Minimize `ctx.save()` and `ctx.restore()` calls by grouping operations by style/border type.
- [x] **Memory Management**: Clear any temporary pattern canvases or caches after the render is complete.
- [x] **Asset Minification**: Ensure the generated wallpaper file size is optimized if using high-density grain effects.
