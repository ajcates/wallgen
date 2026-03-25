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
- **Generate**: `node main.js --style [curves|grid|glitch]`
- **Test**: `npm test`

---

## Available Styles

- **`curves`** (`FlowingCurvesStyle`): The original style. Uses cellular automata to create glowing, magnetic paths.
- **`grid`** (`GeometricGridStyle`): Maps entries to a structured grid of rotating polygons.
- **`glitch`** (`GlitchStyle`): A demonstration of the `transform` layer. Injects noise into time/battery data and renders it as retro digital artifacts.

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

---

## Development Conventions
- **ESM**: Use `import`/`export` exclusively.
- **Functional Style**: Prefer pure functions for math and data transformations.
- **Data-Driven**: Every visual element should ideally be derived from a log field (`hh`, `mm`, `bp`, `fm`, `up`, `pt`).
