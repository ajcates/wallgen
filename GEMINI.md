# Generative Wallpaper Framework (GWF)

`wallgen` is a framework for creating generative wallpapers from Android Tasker logs. It abstracts the data parsing and rendering pipeline, allowing you to focus on creating unique visual "styles."

## Architecture & Lifecycle

Every style in GWF extends the base `Style` class and follows a strict lifecycle managed by the `WallpaperEngine`:

1.  **`transform(data)`**: *Optional*. Modify or inject noise into the raw log data before it reaches the style's state.
2.  **`init(data)`**: Set up the initial state of the style (e.g., creating curves or grid positions).
3.  **`process()`**: *Optional*. Run simulation steps (e.g., physics, cellular automata) to evolve the state.
4.  **`render(ctx, width, height)`**: Use the standard HTML5 Canvas API (via `@napi-rs/canvas`) to draw the wallpaper.

---

## Project Structure

```text
/
├── main.js                 # Entry point (CLI)
├── src/
│   ├── core/               # Framework engine and base classes
│   ├── data/               # Log parsing logic
│   ├── styles/             # Individual style implementations
│   └── utils/              # Shared math and color helpers
└── tests/                  # Unit tests for core logic
```

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- Termux dependencies: `pkg install cairo pango libjpeg-turbo libpixman xorgproto`

### Commands
- **Install**: `npm install`
- **Generate**: `node main.js --style [curves|grid|glitch|smoke|nebula|fractal|...]`
- **Test**: `npm test`

---

## Available Styles

- **`curves`** (`FlowingCurvesStyle`): The original style. Uses cellular automata to create glowing, magnetic paths.
- **`grid`** (`GeometricGridStyle`): Maps entries to a structured grid of rotating polygons.
- **`glitch`** (`GlitchStyle`): A demonstration of the `transform` layer. Injects noise into time/battery data and renders it as retro digital artifacts.
- **`smoke`** (`CrystalSmokeStyle`): A style featuring 3D shards and volumetric smoke effects.
- **`smoke2`** (`CrystalSmoke2Style`): A variation of CrystalSmokeStyle for experimentation.
- **`nebula`** (`NebulaConstellationStyle`): Deep space nebulae with glowing stars and gas clouds.
- **`fractal`** (`FractalGeometryStyle`): Recursive geometric patterns with kaleidoscopic symmetry.
- **`zigzag`** (`ZigZagFractalStyle`): Angular, sharp-edged fractals with high-contrast gradients.
- **`expressive`** (`ExpressiveMaterialStyle`): Bold, painterly strokes with fluid transitions.
- **`shapes`** (`ExpressiveShapesStyle`): Material 3 geometric primitives like squarcles, stadiums, and flowers.
- **`helix`** (`DoubleHelixFractalStyle`): Intertwining spiral structures with organic movement.
- **`circuit`** (`CyberCircuitStyle`): A high-tech aesthetic with glowing traces and data nodes.
- **`energy`** (`EnergyFlowStyle`): Abstract energy flows and iridescent oil-in-water effects with orbiting particles.
- **`synapse`** (`SynapticEchoStyle`): A high-tech neural web representing data transmission with interconnected nodes and synaptic pulses.
- **`trill`** (`TrillStyle`): A postmodern abstract arrangement of shapes with gradients, borders, ghost trailing effects, and dynamic camera depth-of-field blur.
- **`ribbon`** (`FlowingRibbonsStyle`): Smooth, overlapping ribbon trails with dynamic shading and flowing motion.
- **`vortex`** (`QuantumVortexStyle`): Swirling particles forming gravitational wells and event horizons based on data density.
- **`iso`** (`IsometricDataStyle`): 3D isometric projections of log data as towers, grids, and geometric monoliths.
- **`vaporwave`** (`VaporwaveSunsetStyle`): Retro 80s aesthetic with wireframe horizons, neon suns, and chromatic aberration.
- **`liquidsteel`** (`LiquidSteelStyle`): Cinematic swirling liquid metal with iridescent oil-on-water highlights.
- **`mandala`** (`MandalaKaleidoscopeStyle`): Intricate, 2.5D radial mandala patterns with data-driven symmetry, harmonious palettes, global drop shadows, and gradient highlights.
- **`trap`** (`TrapStyle`): A high-energy combination of Trill's postmodern geometry and Smoke's volumetric atmosphere and crystalline shards.
- **`lichen`** (`LichenBloomStyle`): Organic, fractal growth patterns mimicking lichen and moss using Diffusion-Limited Aggregation.
- **`oil`** (`OilSlickStyle`): Fluid, iridescent oil-on-water thin-film interference simulation optimized for AMOLED black backgrounds.
- **`beveled`** (`BeveledCircuitsStyle`): A premium 3D circuit board design with beveled traces, woven fiberglass core textures, isolated ground plane copper pours, discrete SMD resistors and transistors, glowing electroluminescent data pulses, and display-list background caching.

---

## Adding a New Style

1.  Create a new file in `src/styles/YourStyle.js`.
2.  Extend the `Style` class:
    ```javascript
    import { Style } from '../core/Style.js';
    export class YourStyle extends Style {
      render(ctx, width, height) {
        // Your drawing logic here
      }
    }
    ```
3.  Register it in `main.js`.

### New Style Checklist (Files to update)
- `src/styles/YourStyle.js`: Implementation of the style class.
- `main.js`: Add the style mapping to `styleMap`.
- `GEMINI.md`: Add a description to the "Available Styles" list.
- `config.env`: Update the documentation comments and optionally set as default.
- `configure.sh`: Add the style to the interactive menu options.
- `web/server.js`: Add the style mapping to `STYLE_MAP` for server-side rendering support.

> **Note:** The web gallery (`app.js`) now dynamically imports styles listed in the server's `STYLE_MAP`, so manual registration in `app.js` is no longer required for styles that have a browser-compatible port.

---

## Development Conventions
- **ESM**: Use `import`/`export` exclusively.
- **Functional Style**: Prefer pure functions for math and data transformations.
- **Data-Driven**: Every visual element should ideally be derived from a log field (`hh`, `mm`, `bp`, `fm`, `up`, `pt`).
