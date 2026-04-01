# Browser-Based Generative Wallpaper Plan

## Phase 1: Backend (Koa.js)
1.  **Server (`web/server.js`):**
    *   Initialize a Koa application.
    *   Use `@koa/static` to serve `web/public/`.
    *   Create an endpoint `GET /api/logs` to serve the Tasker log data (or mock data if needed).
    *   Create an endpoint `GET /api/styles` to list available style names and their icons.

## Phase 2: Core Refactor (Browser-Compatible)
1.  **Base Class (`web/public/js/core/Style.js`):**
    *   Migrate existing `src/core/Style.js` to a browser-native ESM module.
    *   **New Feature:** Add `static get controls()` to define UI-mappable parameters (e.g., `{ name: 'segments', type: 'range', min: 2, max: 20 }`).
2.  **Engine (`web/public/js/core/WallpaperEngine.js`):**
    *   Modify to render to an on-screen `<canvas>`.
    *   Implement a high-performance `requestAnimationFrame` loop for real-time interaction.
3.  **Styles (`web/public/js/styles/*.js`):**
    *   Port `ZigZagFractalStyle`, `CrystalSmokeStyle`, etc.
    *   Update them to use the new `controls` definition for live updates.

## Phase 3: UI Implementation (Material Design)
1.  **Sidebar (Left - Effect Selector):**
    *   Trigger: Hamburger/Button in the upper-left.
    *   Content: A list of available visual styles with preview thumbnails (generated on-the-fly or static).
    *   Function: Switches the active style in the `WallpaperEngine`.
2.  **Settings Pane (Right - Parameter Control):**
    *   Trigger: Gear icon in the upper-right.
    *   Content: Auto-generated sliders/toggles based on the active style's `controls` metadata.
    *   Function: Updates the style's `config` in real-time.
3.  **Canvas Container:**
    *   A full-screen responsive container for the canvas.

## Phase 4: Integration & UX
1.  **Live Updates:** Ensure parameter changes instantly trigger a re-render or state update.
2.  **State Persistence:** Save the last used style and parameters in `localStorage`.
3.  **Mobile Friendly:** Ensure the sidebars work well on touch devices.

## File Structure
```text
web/
├── server.js               # Koa server
└── public/
    ├── index.html          # Main UI
    ├── css/
    │   └── main.css        # Material styles & layouts
    └── js/
        ├── app.js          # UI Logic & glue code
        ├── core/           # Engine & Base Style
        ├── styles/         # Ported Styles
        └── utils/          # Math & Color helpers
```
