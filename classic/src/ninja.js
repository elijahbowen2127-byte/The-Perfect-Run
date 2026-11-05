// The ninja (Kiri) on the realistic veteran body: three clearly different costume designs chosen by skin.design (1..3).
import { buildD1 } from './ninja_d1.js';
import { buildD2 } from './ninja_d2.js';
import { buildD3 } from './ninja_d3.js';
export function buildNinja(scene, skin) {
  const d = (skin && skin.design) || 1;
  if (d === 2) return buildD2(scene, skin);
  if (d === 3) return buildD3(scene, skin);
  return buildD1(scene, skin);
}
