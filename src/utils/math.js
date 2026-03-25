// Math and geometry helpers for generative art
export const mapRange = (val, inMin, inMax, outMin, outMax) =>
  ((val - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;

export const distance = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

export const randomRange = (min, max) => Math.random() * (max - min) + min;

export const dot = (x1, y1, x2, y2) => (x1 * x2) + (y1 * y2);

export const lerp = (a, b, t) => a + (b - a) * t;
