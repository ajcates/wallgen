import { createCanvas } from 'canvas';
import fs from 'fs/promises';
import path from 'path';

const WIDTH = 1200;
const HEIGHT = 800;
const LOG_PATH = '/sdcard/Tasker/bbb.log';
const OUTPUT_DIR = './';

// Functional helpers
const mapRange = (val, inMin, inMax, outMin, outMax) =>
  ((val - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;

const distance = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

// Parse log line
const parseLine = line => {
  const match = line.match(
    /TIME=(\d+)\.(\d+).*BP=(\d+).*FM=(\d+).*UP=(\d+).*PT=(\d+)/
  );
  if (!match) return null;
  const [, hh, mm, bp, fm, up, pt] = match.map(Number);
  return { hh, mm, bp, fm, up, pt };
};

// Create a flowing curve for each log entry
const curveFromLog = ({ hh, mm, bp, fm, up, pt }, _lastPoint = null, steps = 50) => {
  const _startX = mapRange(mm, 0, 59, 0, WIDTH);
  const startY = mapRange(hh, 0, 23, 0, HEIGHT);
  const wiggleFreq = mapRange(pt, 0, 1000, 0.05, 0.3);
  const waveHeight = mapRange(fm, 0, 100, 2, 20);
  const lineWidth = mapRange(bp, 0, 100, 1, 6);
  const colorHue = mapRange(up, 0, 86400, 200, 360);

  const points = Array.from({ length: steps }, (_, i) => {
    const t = i / steps;
    const x = mapRange(mm + t, 0, 59, 0, WIDTH);
    const y = startY + Math.sin(i * wiggleFreq * Math.PI * 2) * waveHeight;
    return { x, y, alpha: 1, lineWidth, colorHue, neighborRadius: mapRange(pt, 0, 1000, 20, 80), vx: 0, vy: 0 };
  });
  return { points, lastPoint: points[points.length - 1] };
};

// CA step with dynamic neighbor radius
const caStep = nodes =>
  nodes.map(node => {
    const neighbors = nodes.filter(
      n => n !== node && distance(n, node) < node.neighborRadius
    );
    const force = neighbors.reduce(
      (acc, n) => {
        acc.vx += (n.x - node.x) * 0.01;
        acc.vy += (n.y - node.y) * 0.01;
        return acc;
      },
      { vx: 0, vy: 0 }
    );

    const newX = node.x + node.vx + force.vx + (Math.random() - 0.5) * 0.5;
    const newY = node.y + node.vy + force.vy + (Math.random() - 0.5) * 0.5;
    return { ...node, x: newX, y: newY, alpha: node.alpha * 0.97 };
  });

// Draw curves
const renderCurves = (ctx, curves) =>
  curves.forEach(curve => {
    ctx.beginPath();
    const { points } = curve;
    const start = points[0];
    ctx.moveTo(start.x, start.y);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = `hsl(${points[0].colorHue}, 80%, 50%)`;
    ctx.lineWidth = points[0].lineWidth;
    ctx.stroke();
  });

// Render nodes for CA glow
const renderNodes = (ctx, nodes) =>
  nodes.forEach(n => {
    ctx.beginPath();
    ctx.fillStyle = `hsla(${n.colorHue}, 80%, 50%, ${n.alpha})`;
    ctx.arc(n.x, n.y, n.lineWidth, 0, Math.PI * 2);
    ctx.fill();
  });

// Determine next available filename
const getNextFilename = async dir => {
  const files = await fs.readdir(dir);
  const numbers = files
    .map(f => f.match(/^genwallpaper(\d+)\.png$/))
    .filter(Boolean)
    .map(m => +m[1]);
  const nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1;
  return path.join(dir, `genwallpaper${nextNumber}.png`);
};

// Main wallpaper generation
const generateWallpaper = async () => {
  let lines;
  try {
    const logContent = await fs.readFile(LOG_PATH, 'utf-8');
    lines = logContent.split('\n').map(parseLine).filter(Boolean);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`[INFO] No log found at ${LOG_PATH}. Using synthetic data.`);
      lines = Array.from({ length: 50 }, (_, i) => ({
        hh: Math.floor((i / 50) * 24) % 24,
        mm: (i * 7) % 60,
        bp: 100 - i,
        fm: 40 + i,
        up: i * 3600,
        pt: 20 + Math.floor(Math.random() * 200)
      }));
    } else {
      throw err;
    }
  }

  if (lines.length === 0) {
    console.error('No data to render.');
    return;
  }

  let lastPoint = null;
  const curves = lines.map(log => {
    const curve = curveFromLog(log, lastPoint);
    lastPoint = curve.lastPoint;
    return curve;
  });

  // Flatten all nodes for CA layer
  let allNodes = curves.flatMap(c => c.points);

  // Apply multiple CA steps for interaction
  for (let i = 0; i < 10; i++) {
    allNodes = caStep(allNodes);
  }

  // Canvas setup
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Render curves first
  renderCurves(ctx, curves);

  // Overlay CA glow nodes
  renderNodes(ctx, allNodes);

  // Save
  const outputFile = await getNextFilename(OUTPUT_DIR);
  await fs.writeFile(outputFile, canvas.toBuffer());
  console.log(`Wallpaper saved to ${outputFile}`);
};

generateWallpaper();
