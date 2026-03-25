Project Objective:
Create a Node.js project that generates generative wallpapers based on phone unlock logs. Each wallpaper visualizes the phone’s statistics as flowing curves with a dynamic, magnetic, glowing cellular-automata overlay.
1️⃣ Inputs
Log file: /sdcard/Tasker/bbb.log
Format per line:
Copy code

TIME=${HH.MM}; BP=${battery percent}; FM=${free memory}; UP=${uptime in seconds}; PT=${last ping time}
Each new line is added on phone unlock.
2️⃣ Data-to-Visual Mapping
Log Field
Visual Mapping
HH (hour)
y-axis for curve starting point
MM (minute)
x-axis for curve starting point
PT (ping time)
wiggle frequency along curve, and neighbor radius for CA nodes
FM (free memory)
amplitude of curve wiggles
BP (battery %)
line thickness for curves
UP (uptime)
line color hue
Last curve endpoint
Next curve starts at previous curve endpoint (continuous flow)
3️⃣ Visual Requirements
Curves:
Smooth flowing curves representing each unlock event.
Wiggle frequency based on ping time.
Wave height based on free memory.
Thickness and color vary by battery and uptime.
Curves fade gradually over time if redrawn.
Cellular Automata Overlay:
Each curve generates a set of nodes along its path.
Nodes attract each other within a dynamic neighbor radius (based on ping time).
Nodes decay alpha over time to fade older states.
Nodes drawn as semi-transparent circles for a glowing, “liquid magnetic” effect.
Nodes can interact across curves, creating emergent networks and flowing patterns.
Rendering:
Draw curves first, then overlay CA nodes.
Black background.
Curves and CA nodes visually distinguishable but harmonious.
4️⃣ Technical Requirements
Use Node.js with node-canvas.
Functional programming style preferred:
Pure functions, mapping, immutability where possible.
Pipelines: map/filter/reduce for transformations.
Auto-increment output filenames: genwallpaper1.png, genwallpaper2.png, etc.
Configurable parameters for CA steps, wiggle frequency range, wave height range.
Script reads the log file, generates a wallpaper image, and saves it to disk.
Optional: code structured to allow extension for animation over multiple frames.
5️⃣ Example Functional Pipeline
Read log file.
Parse each line into a structured object.
Map each line to a curve object with start point, wave properties, line width, and color.
Generate curve points along each curve.
Flatten curve points into CA nodes.
Run multiple CA iterations to create magnetic interactions.
Render curves to canvas.
Render CA nodes over curves with glowing alpha effect.
Save PNG to next available incremental filename.
6️⃣ Constraints & Recommendations
Canvas size: 1200x800 (configurable).
Fading: alpha decay ~0.97 per CA step.
Wiggle amplitude: map free memory (FM) to range 2–20 px.
Wiggle frequency: map ping (PT) to range 0.05–0.3 cycles per step.
CA neighbor radius: dynamic, map ping (PT) to 20–80 px.
Use HSL colors for curves and nodes for easy hue manipulation.
7️⃣ Deliverables for the LLM
A single Node.js script that produces one wallpaper image per run.
Well-structured code in functional style.
Auto-incremented filenames for sequential runs.
Clear comments describing each mapping and step.
Modular enough for future extension (animation, live wallpaper).
This prompt ensures that an LLM understands both the data-driven visual logic and the technical implementation requirements, while leaving room for creative interpretation for things like the glow effect and CA behavior.

