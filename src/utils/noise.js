export class SimplexNoise {
  constructor(seed = 1) {
    this.seed = seed;
  }

  // Simple pseudo-random seeded 2D noise
  noise2D(x, y) {
      let n = Math.sin(x * 12.9898 + y * 78.233 + this.seed) * 43758.5453;
      let res = n - Math.floor(n);
      return res;
  }
}

export const noise = new SimplexNoise();
