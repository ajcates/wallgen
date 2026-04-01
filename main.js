import { WallpaperEngine } from './src/core/WallpaperEngine.js';
import { FlowingCurvesStyle } from './src/styles/FlowingCurvesStyle.js';
import { GeometricGridStyle } from './src/styles/GeometricGridStyle.js';
import { GlitchStyle } from './src/styles/GlitchStyle.js';
import { CrystalSmokeStyle } from './src/styles/CrystalSmokeStyle.js';
import { NebulaConstellationStyle } from './src/styles/NebulaConstellationStyle.js';
import { FractalGeometryStyle } from './src/styles/FractalGeometryStyle.js';
import { ZigZagFractalStyle } from './src/styles/ZigZagFractalStyle.js';
import { ExpressiveMaterialStyle } from './src/styles/ExpressiveMaterialStyle.js';
import { DoubleHelixFractalStyle } from './src/styles/DoubleHelixFractalStyle.js';
import { CyberCircuitStyle } from './src/styles/CyberCircuitStyle.js';
import { EnergyFlowStyle } from './src/styles/EnergyFlowStyle.js';
import { SynapticEchoStyle } from './src/styles/SynapticEchoStyle.js';
import { loadLogs } from './src/data/logParser.js';

import { mkdir } from 'fs/promises';

const LOG_PATH = '/sdcard/Tasker/bbb.log';

// Helper to get CLI arguments
const getArg = (name, defaultValue) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : defaultValue;
};

const hasArg = (name) => process.argv.includes(`--${name}`);

function showHelp() {
  console.log(`
Generative Wallpaper Framework (GWF) CLI
Usage: node main.js [options]

Options:
  --style <name>   The visual style to use.
                   Available: curves (default), grid, glitch, smoke, nebula, fractal, zigzag, expressive, helix, circuit, energy, synapse
  --noise <0.0-1.0> Noise level for glitch style (default: 1.0)
  --width <px>     Canvas width (default: 1080)
  --height <px>    Canvas height (default: 2400)
  --output <path>  Directory to save the generated wallpaper (default: ./wallpapers)
  --help           Show this help message

Example:
  node main.js --style smoke --width 1080 --height 2400
`);
}

async function main() {
  if (hasArg('help')) {
    showHelp();
    return;
  }

  const styleName = getArg('style', 'curves');
  const width = parseInt(getArg('width', '1080'), 10);
  const height = parseInt(getArg('height', '2400'), 10);
  const outputDir = getArg('output', './wallpapers');

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  const engine = new WallpaperEngine({
    width,
    height,
    outputDir,
    filenamePrefix: `wall_${styleName}_`
  });

  // Load data
  const data = await loadLogs(LOG_PATH);
  
  // Use fallback if log file is missing or empty
  const logData = data.length > 0 ? data : Array.from({ length: 50 }, (_, i) => ({
    hh: Math.floor(i / 2),
    mm: (i * 12) % 60,
    bp: 100 - (i * 2),
    fm: 40 + (i % 20),
    up: i * 1000,
    pt: (i * 15) % 1000
  }));

  let style;
  if (styleName === 'grid') {
    style = new GeometricGridStyle({ columns: 10, rows: 5 });
  } else if (styleName === 'glitch') {
    const noise = parseFloat(getArg('noise', '1.0'));
    style = new GlitchStyle({ noiseLevel: noise });
  } else if (styleName === 'smoke') {
    style = new CrystalSmokeStyle();
  } else if (styleName === 'nebula') {
    style = new NebulaConstellationStyle();
  } else if (styleName === 'fractal') {
    style = new FractalGeometryStyle();
  } else if (styleName === 'zigzag') {
    style = new ZigZagFractalStyle();
  } else if (styleName === 'expressive') {
    style = new ExpressiveMaterialStyle();
  } else if (styleName === 'helix') {
    style = new DoubleHelixFractalStyle();
  } else if (styleName === 'circuit') {
    style = new CyberCircuitStyle();
  } else if (styleName === 'energy') {
    style = new EnergyFlowStyle();
  } else if (styleName === 'synapse') {
    style = new SynapticEchoStyle();
  } else {
    style = new FlowingCurvesStyle({ steps: 30, caSteps: 15 });
  }

  // Run the selected style
  await engine.run(style, logData);
}

main().catch(err => {
  console.error('Framework failed to run:', err);
});
