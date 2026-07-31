const canvas = document.querySelector('#mandala');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

const FAMILIES = [
  ['stained glass', 'glass'], ['neon wire', 'neon'], ['paper cut', 'paper'],
  ['celestial ink', 'ink'], ['chrome op-art', 'chrome'], ['botanical', 'botanical'],
  ['crystal mosaic', 'crystal'], ['desert weave', 'weave']
];
const EFFECTS = ['radial wave', 'twist', 'bloom', 'echo', 'split', 'prism', 'shape shift', 'surface cycle'];
const SYMMETRIES = [4, 5, 6, 7, 8, 9, 10, 12, 14, 16];
const MAX_MOTIFS = 24;
let size = { width: 0, height: 0, dpr: 1 };
let current = createGenome();
const evolutionHistory = [current];
let evolutionIndex = 0;
let previous = null;
let transitionAt = 0;
let pointerStart = null;

function random(min, max) { return min + Math.random() * (max - min); }
function pick(items) { return items[Math.floor(Math.random() * items.length)]; }
function shuffle(items) { return [...items].sort(() => Math.random() - .5); }
function hsl(h, s, l) { return `hsl(${h} ${s}% ${l}%)`; }
function lerp(from, to, amount) { return from + (to - from) * amount; }
function lerpHue(from, to, amount) { return (from + (((to - from + 540) % 360) - 180) * amount + 360) % 360; }
function smoothstep(amount) { return amount * amount * (3 - 2 * amount); }

function createGenome({ symmetry: forcedSymmetry } = {}) {
  const [familyName, treatment] = pick(FAMILIES);
  const hue = Math.floor(random(0, 360));
  const symmetry = forcedSymmetry || pick(SYMMETRIES);
  const paletteHsl = Array.from({ length: 5 }, (_, index) => ({ h: (hue + index * random(38, 103)) % 360, s: random(52, 100), l: random(47, 74) }));
  const palette = paletteHsl.map(color => hsl(color.h, color.s, color.l));
  const effects = shuffle(EFFECTS).slice(0, Math.floor(random(3, 7))).map(name => ({ name, strength: random(.35, 1), phase: random(0, Math.PI * 2) }));
  const shapeSet = treatment === 'botanical' ? ['leaf', 'vine', 'petal']
    : treatment === 'neon' ? ['ray', 'arc', 'orb']
      : treatment === 'glass' || treatment === 'crystal' ? ['diamond', 'shard', 'star']
        : ['petal', 'diamond', 'star', 'arc', 'ray'];
  const base = Array.from({ length: Math.floor(random(6, 14)) }, (_, index) => ({
    kind: pick(shapeSet), radius: .10 + index / 15 * .78, size: random(.042, .13), stretch: random(.48, 1.7),
    rotation: Math.random() > .5 ? 0 : Math.PI / symmetry, colorIndex: Math.floor(random(0, palette.length)),
    surface: 'solid', signal: Math.random(), detail: Math.random(),
    life: {
      phase: random(0, Math.PI * 2), radialAmplitude: random(.004, .026), breatheAmount: random(.06, .22),
      bendAmount: random(.04, .3), orbitRate: random(-.00032, .00032), breathRate: random(.00055, .0021)
    }
  }));
  const motifs = applyDna(base, effects, { palette, symmetry, shapeSet });
  const backgroundHsl = treatment === 'ink' ? { h: 232, s: 44, l: 6 } : { h: (hue + 205) % 360, s: treatment === 'neon' ? 46 : 25, l: treatment === 'paper' ? 14 : 7 };
  return { familyName, treatment, hue, symmetry, paletteHsl, palette, backgroundHsl, effects, motifs };
}

function applyDna(motifs, genes, env) {
  const sector = Math.PI * 2 / env.symmetry;
  return genes.reduce((list, gene) => {
    let evolved = list;
    if (gene.name === 'radial wave') evolved = list.map((m, i) => ({ ...m, radius: Math.max(.04, m.radius + Math.sin(i * 1.6 + gene.phase) * .055 * gene.strength), signal: m.signal + gene.strength }));
    if (gene.name === 'twist') evolved = list.map(m => ({ ...m, rotation: m.rotation + Math.sin(m.radius * 13 + gene.phase) * sector * .33 * gene.strength }));
    if (gene.name === 'bloom') evolved = list.map((m, i) => ({ ...m, size: m.size * (.7 + gene.strength * .8 + (i % 2) * .16), stretch: m.stretch * (.75 + gene.strength * .55) }));
    if (gene.name === 'echo') evolved = list.flatMap(m => [{ ...m, radius: m.radius * .87, size: m.size * .58, rotation: m.rotation - sector * .13 * gene.strength }, { ...m, radius: m.radius * 1.09, size: m.size * .4, rotation: m.rotation + sector * .13 * gene.strength, surface: 'outline' }]);
    if (gene.name === 'split') evolved = list.flatMap(m => [{ ...m, size: m.size * .72, rotation: m.rotation - sector * .16 * gene.strength }, { ...m, size: m.size * .72, rotation: m.rotation + sector * .16 * gene.strength, surface: 'cutout' }]);
    if (gene.name === 'prism') evolved = list.map((m, i) => ({ ...m, colorIndex: (m.colorIndex + 1 + Math.floor(i * gene.strength)) % env.palette.length }));
    if (gene.name === 'shape shift') evolved = list.map((m, i) => ({ ...m, kind: env.shapeSet[Math.abs(Math.floor(m.radius * 18 + m.signal * 8 + i * gene.strength)) % env.shapeSet.length] }));
    if (gene.name === 'surface cycle') evolved = list.map((m, i) => ({ ...m, surface: ['solid', 'outline', 'cutout', 'hatch'][Math.floor(i + m.signal * 7 + gene.phase) % 4] }));
    return compactMotifs(evolved);
  }, motifs);
}

function compactMotifs(motifs) {
  if (motifs.length <= MAX_MOTIFS) return motifs;
  return Array.from({ length: MAX_MOTIFS }, (_, index) => motifs[Math.round(index * (motifs.length - 1) / (MAX_MOTIFS - 1))]);
}

function resize() {
  // A modest backing-store cap avoids a 4x pixel fill cost on high-DPI phones.
  size = { width: innerWidth, height: innerHeight, dpr: Math.min(devicePixelRatio || 1, 1.35) };
  canvas.width = size.width * size.dpr; canvas.height = size.height * size.dpr;
  canvas.style.width = `${size.width}px`; canvas.style.height = `${size.height}px`;
  ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
}

function draw(time) {
  ctx.clearRect(0, 0, size.width, size.height);
  const progress = previous ? Math.min(1, (time - transitionAt) / 900) : 1;
  const genome = previous ? morphGenome(previous, current, smoothstep(progress)) : current;
  drawGenome(genome, time);
  if (progress === 1) previous = null;
  requestAnimationFrame(draw);
}

function morphGenome(from, to, amount) {
  const paletteHsl = from.paletteHsl.map((color, index) => {
    const target = to.paletteHsl[index];
    return { h: lerpHue(color.h, target.h, amount), s: lerp(color.s, target.s, amount), l: lerp(color.l, target.l, amount) };
  });
  const backgroundHsl = {
    h: lerpHue(from.backgroundHsl.h, to.backgroundHsl.h, amount),
    s: lerp(from.backgroundHsl.s, to.backgroundHsl.s, amount),
    l: lerp(from.backgroundHsl.l, to.backgroundHsl.l, amount)
  };
  const motifCount = Math.max(from.motifs.length, to.motifs.length);
  const motifs = Array.from({ length: motifCount }, (_, index) => morphMotif(from.motifs[index], to.motifs[index], amount, from.paletteHsl, to.paletteHsl));
  return {
    ...to, hue: lerpHue(from.hue, to.hue, amount),
    treatment: amount < .58 ? from.treatment : to.treatment,
    paletteHsl, palette: paletteHsl.map(color => hsl(color.h, color.s, color.l)), backgroundHsl, motifs
  };
}

function morphMotif(from, to, amount, fromPalette, toPalette) {
  const source = from || { ...to, size: .002, detail: 0 };
  const target = to || { ...from, size: .002, detail: 0 };
  const sourceColor = fromPalette[source.colorIndex];
  const targetColor = toPalette[target.colorIndex];
  const color = hsl(lerpHue(sourceColor.h, targetColor.h, amount), lerp(sourceColor.s, targetColor.s, amount), lerp(sourceColor.l, targetColor.l, amount));
  const rotationDelta = ((target.rotation - source.rotation + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return {
    ...target, color, radius: lerp(source.radius, target.radius, amount), size: lerp(source.size, target.size, amount),
    stretch: lerp(source.stretch, target.stretch, amount), rotation: source.rotation + rotationDelta * amount,
    signal: lerp(source.signal, target.signal, amount), detail: lerp(source.detail, target.detail, amount),
    kind: amount < .56 ? source.kind : target.kind, surface: amount < .66 ? source.surface : target.surface,
    life: Object.fromEntries(Object.keys(source.life).map(key => [key, lerp(source.life[key], target.life[key], amount)]))
  };
}

function drawGenome(genome, time) {
  const { width, height } = size; const scale = Math.min(width, height) * .47;
  ctx.save(); ctx.fillStyle = backgroundFor(genome); ctx.fillRect(0, 0, width, height);
  ctx.translate(width / 2, height / 2);
  drawField(genome, scale, time);
  for (const motif of genome.motifs) {
    const life = motif.life;
    const ringTurn = Math.sin(time * life.orbitRate + life.phase) * .16;
    for (let sector = 0; sector < genome.symmetry; sector++) {
      ctx.save();
      ctx.rotate(sector * Math.PI * 2 / genome.symmetry + motif.rotation + ringTurn);
      drawMotif(genome, motif, scale, time);
      ctx.restore();
    }
  }
  const core = scale * (.1 + Math.sin(time * .0015) * .006);
  const coreGradient = ctx.createRadialGradient(0, 0, 1, 0, 0, core);
  coreGradient.addColorStop(0, '#fff'); coreGradient.addColorStop(.26, genome.palette[0]); coreGradient.addColorStop(1, genome.palette[2]);
  ctx.fillStyle = coreGradient; ctx.shadowColor = genome.palette[0]; ctx.shadowBlur = genome.treatment === 'neon' ? 28 : 10;
  ctx.beginPath(); ctx.arc(0, 0, core, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

function backgroundFor(genome) { return hsl(genome.backgroundHsl.h, genome.backgroundHsl.s, genome.backgroundHsl.l); }
function drawField(genome, scale, time) {
  ctx.save(); ctx.strokeStyle = genome.treatment === 'neon' ? `${genome.palette[1]}55` : 'rgba(255,255,255,.09)'; ctx.lineWidth = 1;
  for (let r = scale * .2; r < scale; r += scale / 5) { ctx.beginPath(); ctx.arc(0, 0, r + Math.sin(time * .0007 + r) * 2.4, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}

function drawMotif(genome, motif, scale, time) {
  const { life } = motif;
  const pulse = Math.sin(time * life.breathRate + life.phase);
  const radius = (motif.radius + pulse * life.radialAmplitude) * scale;
  const shapeSize = motif.size * scale * (1 + pulse * life.breatheAmount);
  const stretch = motif.stretch * (1 + Math.cos(time * life.breathRate * .73 + life.phase) * life.breatheAmount * .44);
  const wobble = Math.sin(time * life.breathRate * 1.6 + life.phase) * life.bendAmount;
  const color = motif.color || genome.palette[motif.colorIndex];
  ctx.save();
  if (genome.treatment === 'neon') { ctx.globalCompositeOperation = 'screen'; if (motif.detail > .7) { ctx.shadowColor = color; ctx.shadowBlur = 10; } }
  if ((genome.treatment === 'paper' || genome.treatment === 'weave') && motif.detail > .78) { ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 5; }
  ctx.globalAlpha *= .72 + (pulse + 1) * .14;
  pathFor(motif.kind, radius, shapeSize, stretch, wobble);
  if (genome.treatment === 'glass' || genome.treatment === 'crystal' || genome.treatment === 'chrome') {
    const gradient = ctx.createLinearGradient(-shapeSize, radius - shapeSize, shapeSize, radius + shapeSize);
    gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(.28, color); gradient.addColorStop(1, genome.treatment === 'chrome' ? '#15151a' : 'rgba(0,0,0,.32)'); ctx.fillStyle = gradient;
  } else ctx.fillStyle = color;
  if (motif.surface !== 'outline') ctx.fill();
  ctx.strokeStyle = genome.treatment === 'neon' ? color : 'rgba(255,255,255,.48)'; ctx.lineWidth = genome.treatment === 'neon' ? 1.5 : .85; ctx.stroke();
  if (motif.surface === 'cutout') { ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = .4; ctx.fill(); }
  if (motif.surface === 'hatch' && motif.detail > .68) { ctx.globalAlpha = .5; for (let y = -shapeSize; y < shapeSize; y += Math.max(5, shapeSize * .42)) { ctx.beginPath(); ctx.moveTo(-shapeSize, radius + y); ctx.lineTo(shapeSize, radius + y - shapeSize * .7); ctx.stroke(); } }
  if (motif.detail > .76) {
    const speckRadius = radius + Math.sin(time * life.breathRate * 1.35 + life.phase) * shapeSize * .6;
    ctx.globalCompositeOperation = genome.treatment === 'neon' ? 'screen' : 'source-over';
    ctx.fillStyle = '#fff'; ctx.globalAlpha = .35 + (pulse + 1) * .24;
    ctx.beginPath(); ctx.arc(Math.sin(time * life.orbitRate * 1.8 + life.phase) * shapeSize * .42, speckRadius, Math.max(1.1, shapeSize * .055), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function pathFor(kind, radius, s, stretch, wobble) {
  ctx.beginPath();
  if (kind === 'arc') { ctx.lineWidth = s * (.4 + wobble * .12); ctx.arc(0, 0, radius, -.24 - wobble * .12, .24 + wobble * .12); return; }
  if (kind === 'orb') { ctx.arc(0, radius, s * .48, 0, Math.PI * 2); return; }
  if (kind === 'ray') { ctx.moveTo(-s * (.16 + wobble * .07), radius - s); ctx.lineTo(s * (.16 + wobble * .07), radius - s); ctx.lineTo(s * (.28 - wobble * .1), radius + s * (1 + stretch)); ctx.lineTo(-s * (.28 - wobble * .1), radius + s * (1 + stretch)); ctx.closePath(); return; }
  if (kind === 'diamond' || kind === 'shard') { ctx.moveTo(0, radius - s); ctx.lineTo(s * (.62 + wobble * .2), radius); ctx.lineTo(0, radius + s * stretch); ctx.lineTo(-s * (.62 - wobble * .2), radius); ctx.closePath(); return; }
  if (kind === 'star') { for (let i = 0; i < 10; i++) { const angle = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? s * (.42 + wobble * .12) : s * (1 + wobble * .12); i ? ctx.lineTo(Math.cos(angle) * r, radius + Math.sin(angle) * r) : ctx.moveTo(Math.cos(angle) * r, radius + Math.sin(angle) * r); } ctx.closePath(); return; }
  if (kind === 'vine') { ctx.lineWidth = Math.max(1, s * .12); ctx.moveTo(0, radius - s); ctx.bezierCurveTo(s * (1 + wobble), radius - s * .3, -s * (1 - wobble), radius + s * .35, 0, radius + s * stretch); return; }
  ctx.moveTo(0, radius - s); ctx.bezierCurveTo(s * stretch * (1 + wobble), radius - s * .35, s * .68, radius + s * .5, 0, radius + s * stretch); ctx.bezierCurveTo(-s * .68, radius + s * .5, -s * stretch * (1 - wobble), radius - s * .35, 0, radius - s); ctx.closePath();
}

function transitionTo(genome) {
  previous = current; current = genome; transitionAt = performance.now();
  navigator.vibrate?.(12);
}

function nextEvolution() {
  if (evolutionIndex < evolutionHistory.length - 1) {
    evolutionIndex += 1;
  } else {
    // Holding the sector count lets every existing ring morph continuously,
    // rather than abruptly adding or removing entire spokes.
    evolutionHistory.push(createGenome({ symmetry: current.symmetry }));
    evolutionIndex += 1;
  }
  transitionTo(evolutionHistory[evolutionIndex]);
}

function previousEvolution() {
  if (evolutionIndex === 0) return;
  evolutionIndex -= 1;
  transitionTo(evolutionHistory[evolutionIndex]);
}

canvas.addEventListener('pointerdown', event => { pointerStart = { x: event.clientX, y: event.clientY }; });
canvas.addEventListener('pointerup', event => {
  if (!pointerStart) return;
  const dx = event.clientX - pointerStart.x; const dy = event.clientY - pointerStart.y; pointerStart = null;
  if (Math.abs(dx) <= 42 || Math.abs(dx) <= Math.abs(dy)) return;
  if (dx < 0) nextEvolution(); else previousEvolution();
});
canvas.addEventListener('pointercancel', () => { pointerStart = null; });
addEventListener('resize', resize, { passive: true });
resize(); requestAnimationFrame(draw);
