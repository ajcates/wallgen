import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { loadLogs as _loadLogs, generateSyntheticLogs } from '../src/data/logParser.js';
import { WallpaperEngine } from '../src/core/WallpaperEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PRERENDER_DIR = path.join(PUBLIC_DIR, 'prerendered');

// Ensure prerender directory exists
try {
  await fs.mkdir(PRERENDER_DIR, { recursive: true });
} catch (_err) {
  // Ignore error if directory already exists or cannot be created
}

const app = express();
const PORT = process.env.PORT || 6464;

// Middleware
app.use(express.static(PUBLIC_DIR));
app.use('/my_wallpapers', express.static(path.join(PROJECT_ROOT, 'wallpapers')));

const STYLE_MAP = {
  'curves': '../src/styles/FlowingCurvesStyle.js',
  'grid': '../src/styles/GeometricGridStyle.js',
  'glitch': '../src/styles/GlitchStyle.js',
  'smoke': '../src/styles/CrystalSmokeStyle.js',
  'smoke2': '../src/styles/CrystalSmoke2Style.js',
  'nebula': '../src/styles/NebulaConstellationStyle.js',
  'fractal': '../src/styles/FractalGeometryStyle.js',
  'zigzag': '../src/styles/ZigZagFractalStyle.js',
  'expressive': '../src/styles/ExpressiveMaterialStyle.js',
  'shapes': '../src/styles/ExpressiveShapesStyle.js',
  'ribbon': '../src/styles/FlowingRibbonsStyle.js',
  'vortex': '../src/styles/QuantumVortexStyle.js',
  'iso': '../src/styles/IsometricDataStyle.js',
  'circuit': '../src/styles/CyberCircuitStyle.js',
  'energy': '../src/styles/EnergyFlowStyle.js',
  'synapse': '../src/styles/SynapticEchoStyle.js',
  'helix': '../src/styles/DoubleHelixFractalStyle.js',
  'trill': '../src/styles/TrillStyle.js',
  'vaporwave': '../src/styles/VaporwaveSunsetStyle.js',
  'liquidsteel': '../src/styles/LiquidSteelStyle.js',
  'mandala': '../src/styles/MandalaKaleidoscopeStyle.js',
  'symmetry': '../src/styles/SymmetryStyle.js',
  'trap': '../src/styles/TrapStyle.js',
  'oil': '../src/styles/OilSlickStyle.js',
  'beveled': '../src/styles/BeveledCircuitsStyle.js',
  'plasmo': '../src/styles/PlasmoStyle.js'
};

// API: List all available styles
app.get('/api/styles', (req, res) => {
  res.json(Object.keys(STYLE_MAP));
});

// API: Render a specific style
app.get('/api/render/:style', async (req, res) => {
  const { style: styleName } = req.params;
  const force = req.query.force === 'true';

  if (!STYLE_MAP[styleName]) {
    return res.status(404).json({ error: 'Style not found' });
  }

  const cachePath = path.join(PRERENDER_DIR, `${styleName}.png`);
  
  // Check cache unless force requested
  if (!force) {
    try {
      await fs.access(cachePath);
      return res.sendFile(cachePath);
    } catch (_err) {
      // Not cached, continue to render
    }
  }

  try {
    const { [Object.keys(await import(STYLE_MAP[styleName]))[0]]: StyleClass } = await import(STYLE_MAP[styleName]);
    
    // Set up engine for a smaller "gallery" size to be faster, but still high quality
    const engine = new WallpaperEngine({
      width: 540,
      height: 1200,
      outputDir: PRERENDER_DIR,
      filenamePrefix: `tmp_${styleName}_`
    });

    const logData = generateSyntheticLogs(20);
    const style = new StyleClass();
    
    // engine.run returns the full path, so we don't need to join it with PRERENDER_DIR again
    const fullPath = await engine.run(style, logData);
    
    // Rename to standard cache name
    await fs.rename(fullPath, cachePath);
    
    res.sendFile(cachePath);
  } catch (err) {
    console.error(`Render error for ${styleName}:`, err);
    res.status(500).json({ error: 'Failed to render style', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log('\x1b[36m%s\x1b[0m', 'WallGen Gallery Server is live!');
  console.log('\x1b[32m%s\x1b[0m', `URL: http://localhost:${PORT}`);
  console.log(`Available styles: ${Object.keys(STYLE_MAP).length}`);
});
