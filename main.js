import { loadLogs, generateSyntheticLogs, parsePartialEvent } from './src/data/logParser.js';
import { WallpaperEngine } from './src/core/WallpaperEngine.js';
import { loadStyleClass } from './src/styles/styleCatalog.js';

const LOG_PATH = '/sdcard/Tasker/bbb.log';

const getArg = (name, defaultValue) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : defaultValue;
};

const hasArg = (name) => process.argv.includes(`--${name}`);

async function main() {
  const styleName = getArg('style', 'curves');
  const width = parseInt(getArg('width', '1080'), 10);
  const height = parseInt(getArg('height', '2400'), 10);
  const outputDir = getArg('output', './wallpapers');
  const eventStr = getArg('event', null);
  const noSmoothing = hasArg('no-smoothing');

  const engine = new WallpaperEngine({
    width, height, outputDir,
    filenamePrefix: `wall_${styleName}_`,
    imageSmoothingEnabled: !noSmoothing
  });

  let logData;
  if (eventStr) {
    logData = [parsePartialEvent(eventStr)];
  } else {
    const data = (styleName === 'shapes') ? [] : await loadLogs(LOG_PATH);
    logData = data.length === 0 ? generateSyntheticLogs(20) : data;
  }

  // Parse arbitrary style parameters
  const styleConfig = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('--') && !['--style', '--width', '--height', '--output', '--event', '--no-smoothing'].includes(arg)) {
      const key = arg.replace(/^--/, '').replace(/-([a-z])/g, g => g[1].toUpperCase());
      const nextArg = process.argv[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        // Try parsing as number, otherwise keep as string
        const numVal = Number(nextArg);
        styleConfig[key] = isNaN(numVal) ? nextArg : numVal;
        i++; // Skip the value
      } else {
        styleConfig[key] = true; // Flag without value
      }
    }
  }

  const { StyleClass } = await loadStyleClass(styleName);

  const style = new StyleClass(styleConfig);
  await engine.run(style, logData);
}

main().catch(console.error);
