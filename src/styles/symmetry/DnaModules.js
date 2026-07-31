// Each module operates on a single radial-sector motif. The renderer copies the
// finished sector around the centre, so these transformations can never break
// the mandala's rotational symmetry.
const clone = (motif, changes) => ({ ...motif, ...changes });

export const EFFECT_NAMES = [
  'radial-wave', 'twist', 'bloom', 'echo', 'split', 'prism', 'shape-shift', 'surface-cycle'
];

export const applyDnaChain = (motifs, chain, context) => chain.reduce(
  (current, gene) => EFFECT_MODULES[gene.name]?.(current, gene, context) || current,
  motifs
);

export const EFFECT_MODULES = {
  'radial-wave': (motifs, gene) => motifs.map((motif, index) => clone(motif, {
    radius: Math.max(8, motif.radius + Math.sin(index * 1.73 + gene.phase) * gene.strength * 36),
    signal: motif.signal + gene.strength
  })),

  twist: (motifs, gene, { sectorAngle }) => motifs.map(motif => clone(motif, {
    rotation: motif.rotation + Math.sin(motif.radius * 0.027 + gene.phase) * sectorAngle * gene.strength * 0.42,
    signal: motif.signal + gene.strength * 0.5
  })),

  bloom: (motifs, gene) => motifs.map((motif, index) => clone(motif, {
    size: motif.size * (0.68 + gene.strength * 0.85 + (index % 2) * 0.14),
    stretch: motif.stretch * (0.8 + gene.strength * 0.48)
  })),

  echo: (motifs, gene, { sectorAngle }) => motifs.flatMap(motif => [
    clone(motif, { radius: motif.radius * (0.86 - gene.strength * 0.08), size: motif.size * 0.58, rotation: motif.rotation - sectorAngle * gene.strength * 0.18, detail: 1 }),
    clone(motif, { radius: motif.radius * (1.08 + gene.strength * 0.12), size: motif.size * 0.38, rotation: motif.rotation + sectorAngle * gene.strength * 0.18, surface: 'outline', detail: 1 })
  ]),

  split: (motifs, gene, { sectorAngle }) => motifs.flatMap(motif => [
    clone(motif, { rotation: motif.rotation - sectorAngle * (0.08 + gene.strength * 0.17), size: motif.size * 0.72 }),
    clone(motif, { rotation: motif.rotation + sectorAngle * (0.08 + gene.strength * 0.17), size: motif.size * 0.72, surface: 'cutout' })
  ]),

  prism: (motifs, gene, { palette }) => motifs.map((motif, index) => clone(motif, {
    color: palette[(motif.colorIndex + Math.floor(index * gene.strength + 1)) % palette.length],
    colorIndex: (motif.colorIndex + Math.floor(index * gene.strength + 1)) % palette.length
  })),

  'shape-shift': (motifs, gene, { shapes }) => motifs.map((motif, index) => clone(motif, {
    kind: shapes[Math.abs(Math.floor((motif.radius * 0.09) + motif.signal * 7 + index * gene.strength * 5)) % shapes.length]
  })),

  'surface-cycle': (motifs, gene) => motifs.map((motif, index) => clone(motif, {
    surface: ['solid', 'outline', 'cutout', 'hatch'][Math.abs(Math.floor(index + motif.signal * 4 + gene.phase * 3)) % 4],
    detail: Math.max(motif.detail, gene.strength)
  }))
};
