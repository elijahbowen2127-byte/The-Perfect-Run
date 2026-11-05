// Seeded randomness + value noise used by world gen, textures and synced effects.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashInt(x, y, seed) {
  let h = (seed | 0) ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

// Value noise; when `period` is set the noise tiles seamlessly (used for textures).
export function makeNoise(seed, period = 0) {
  function lattice(ix, iy) {
    if (period) {
      ix = ((ix % period) + period) % period;
      iy = ((iy % period) + period) % period;
    }
    return hashInt(ix, iy, seed);
  }
  function noise2(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = smooth(x - ix), fy = smooth(y - iy);
    const a = lattice(ix, iy), b = lattice(ix + 1, iy);
    const c = lattice(ix, iy + 1), d = lattice(ix + 1, iy + 1);
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  }
  function fbm(x, y, oct = 5, lac = 2, gain = 0.5) {
    let amp = 0.5, f = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * noise2(x * f, y * f);
      norm += amp;
      amp *= gain;
      f *= lac;
    }
    return sum / norm;
  }
  // Ridged noise for cracks/veins/rock strata.
  function ridged(x, y, oct = 5) {
    let amp = 0.5, f = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      const n = 1 - Math.abs(noise2(x * f, y * f) * 2 - 1);
      sum += amp * n * n;
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  }
  return { noise2, fbm, ridged };
}

export const randRange = (r, a, b) => a + r() * (b - a);
export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
