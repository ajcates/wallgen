// Math and geometry helpers for generative art
export const mapRange = (val, inMin, inMax, outMin, outMax) =>
  ((val - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;

export const distance = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

export const randomRange = (min, max) => Math.random() * (max - min) + min;

export const dot = (x1, y1, x2, y2) => (x1 * x2) + (y1 * y2);

export const lerp = (a, b, t) => a + (b - a) * t;

export const getQuadraticBezier = (t, p1, p2, p3) => ({
  x: (1 - t) ** 2 * p1.x + 2 * (1 - t) * t * p2.x + t ** 2 * p3.x,
  y: (1 - t) ** 2 * p1.y + 2 * (1 - t) * t * p2.y + t ** 2 * p3.y
});

export const getCubicBezier = (t, p) => {
  const cx = 3 * (p[1].x - p[0].x), bx = 3 * (p[2].x - p[1].x) - cx, ax = p[3].x - p[0].x - cx - bx;
  const cy = 3 * (p[1].y - p[0].y), by = 3 * (p[2].y - p[1].y) - cy, ay = p[3].y - p[0].y - cy - by;
  return { x: ax * (t ** 3) + bx * (t ** 2) + cx * t + p[0].x, y: ay * (t ** 3) + by * (t ** 2) + cy * t + p[0].y };
};
