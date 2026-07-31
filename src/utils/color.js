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
  const schemeType = Math.floor(Math.random() * 3);
  let secH, terH;

  if (schemeType === 0) { // Analogous
    secH = baseHue + 35;
    terH = baseHue - 35 + 360;
  } else if (schemeType === 1) { // Split-Complementary
    secH = baseHue + 150;
    terH = baseHue + 210;
  } else { // Triadic
    secH = baseHue + 120;
    terH = baseHue + 240;
  }

  // Add small random noise for variety
  secH = (secH + randomRange(-10, 10)) % 360;
  terH = (terH + randomRange(-10, 10)) % 360;
  const s = Math.max(80, saturation); // Keep it highly saturated/vibrant

  return [
    { h: baseHue, s: s, l: isLightMode ? 50 : 65, name: 'primary' },
    { h: secH, s: s - 5, l: isLightMode ? 60 : 75, name: 'secondary' },
    { h: terH, s: s, l: isLightMode ? 45 : 70, name: 'tertiary' },
    { h: baseHue, s: 15, l: isLightMode ? 96 : 8, name: 'neutral' } 
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
