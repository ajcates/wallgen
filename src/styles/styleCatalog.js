import fs from 'node:fs';
import { URL } from 'node:url';

const catalogUrl = new URL('../../style_catalog.json', import.meta.url);

export const STYLE_CATALOG = Object.freeze(
  JSON.parse(fs.readFileSync(catalogUrl, 'utf8')).map(style => Object.freeze(style))
);

const STYLE_LOOKUP = new Map(STYLE_CATALOG.map(style => [style.id, style]));

export const getStyleEntry = (styleId) => STYLE_LOOKUP.get(styleId);

export const loadStyleClass = async (styleId, fallbackId = 'curves') => {
  const entry = getStyleEntry(styleId) || getStyleEntry(fallbackId);
  if (!entry) {
    throw new Error(`Unknown wallpaper style: ${styleId}`);
  }

  const styleModule = await import(new URL(`../../${entry.module.replace(/^\.\//, '')}`, import.meta.url));
  const StyleClass = styleModule[entry.class];
  if (typeof StyleClass !== 'function') {
    throw new Error(`Style class ${entry.class} is not exported by ${entry.module}`);
  }

  return { entry, StyleClass };
};
