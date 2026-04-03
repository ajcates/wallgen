import { randomRange } from './math.js';

/**
 * Color and Palette utilities for Material Design styles.
 */

/**
 * Generates a Material 3 inspired expressive palette.
 * @param {number} baseHue - Base hue (0-360)
 * @param {number} saturation - Saturation (0-100)
 * @param {boolean} isLightMode - Whether to generate light or dark tones
 */
export function generateMaterialPalette(baseHue, saturation, isLightMode) {
  return [
    { h: (baseHue + randomRange(-15, 15)) % 360, s: saturation, l: isLightMode ? 45 : 65, name: 'primary' },
    { h: (baseHue + randomRange(30, 70)) % 360, s: saturation - 10, l: isLightMode ? 55 : 55, name: 'secondary' },
    { h: (baseHue + randomRange(160, 220)) % 360, s: saturation, l: isLightMode ? 40 : 70, name: 'tertiary' },
    { h: 0, s: 0, l: isLightMode ? 98 : 0, name: 'neutral' } 
  ];
}

/**
 * Determines if a hue and lightness combination is "Warm" or "Bright".
 */
export function isPerceptuallyBright(h, l) {
  const isWarm = (h >= 0 && h < 100) || (h > 300);
  const isBright = l > 55;
  return isBright || (isWarm && l > 45);
}

/**
 * Returns an adaptive contrast HSL string for text or patterns on a color.
 */
export function getAdaptiveContrast(h, s, l) {
  const useDark = isPerceptuallyBright(h, l);
  const patternL = useDark ? 10 : 98;
  const patternAlpha = useDark ? 0.25 : 0.45; 
  return `hsla(${h}, 100%, ${patternL}%, ${patternAlpha})`;
}
