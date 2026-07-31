/**
 * Canvas drawing utilities for generative styles.
 */

/**
 * Draws an organic, blob-like shape using quadratic curves.
 * @param {CanvasRenderingContext2D} ctx 
 * @param {Object[]} points - Array of {x, y} coordinates.
 */
export function drawOrganicShape(ctx, points) {
  if (points.length < 3) return;
  
  ctx.beginPath();
  let xc1 = (points[points.length - 1].x + points[0].x) / 2;
  let yc1 = (points[points.length - 1].y + points[0].y) / 2;
  ctx.moveTo(xc1, yc1);

  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const xc = (p1.x + p2.x) / 2;
    const yc = (p1.y + p2.y) / 2;
    ctx.quadraticCurveTo(p1.x, p1.y, xc, yc);
  }
  ctx.closePath();
}

/**
 * Builds a path for a rounded "pill" shape.
 */
export function drawPill(ctx, x, y, width, height, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  ctx.roundRect(-width / 2, -height / 2, width, height, height / 2);
  ctx.closePath();
  ctx.restore();
}

/**
 * Builds a path for a multi-pointed star.
 */
export function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
  let rot = Math.PI / 2 * 3;
  let x, y;
  let step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
}

/**
 * Builds a path for a crescent moon shape.
 * Solid implementation: uses two overlapping arcs.
 */
export function drawCrescent(ctx, x, y, radius) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  // Outer arc
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  // Inner arc (counter-clockwise) to "cut" the shape
  ctx.arc(radius * 0.6, -radius * 0.3, radius, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.restore();
}

let noiseTile = null;

/**
 * Applies a grainy texture over the canvas using a pre-rendered noise tile for speed.
 */
export async function drawGrain(ctx, width, height, density = 400, alpha = 0.05) {
  if (!noiseTile) {
    const { createCanvas } = await import('@napi-rs/canvas');

    noiseTile = createCanvas(128, 128);
    const nctx = noiseTile.getContext('2d');
    nctx.globalAlpha = 0.5;
    const dotCount = (density / 400) * 2000;
    for (let i = 0; i < dotCount; i++) {
      const x = Math.random() * 128;
      const y = Math.random() * 128;
      nctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
      nctx.fillRect(x, y, 1, 1);
    }
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'overlay';
  const pattern = ctx.createPattern(noiseTile, 'repeat');
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
