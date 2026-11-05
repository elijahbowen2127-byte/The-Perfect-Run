import * as THREE from 'three';
import { V } from './armor.js';
import * as K from './corsair_lib.js';
import * as B from './corsair_base.js';
import * as C from './corsair_cloth.js';
import * as G from './corsair_gear.js';
import * as P from './corsair_props.js';
import { torsoE } from './corsair_cloth2.js';
const { SL } = B, col = K.col;

// Recolours the veteran's tailoring by region. spec: { coat:[h,s,l0,gain], vest, shirt, button, pants }
export function recolorOutfit(ctx, key, spec) {
  const fix = (m, fn) => { if (!m || !m.material.map) return; m.material = m.material.clone(); m.material.map = K.recolorUV(m.material.map, key, fn); };
  const map = (c, l, ref) => [c[0], c[1], K.clamp(c[2] + (l - ref) * c[3], 0.02, 0.97)];
  fix(ctx.top, (h, s, l, u, v) => {
    if (l < 0.115 && u > 0.6 && u < 0.93 && v > 0.2 && v < 0.56) return map(spec.button, l, 0.08);
    if ((u < 0.13 && v > 0.3) || (u > 0.74 && v < 0.235)) return map(spec.shirt, l, 0.45);
    if (spec.lapel && u > 0.82 && u < 0.94 && v > 0.3 && v < 0.82) return map(spec.lapel, l, 0.2);
    if (u >= 0.13 && u < 0.26) return map(spec.vest, l, 0.22);
    return map(spec.coat, l, 0.3);
  });
  fix(ctx.bottom, (h, s, l) => (l > 0.2 ? map(spec.pants, l, 0.3) : map(spec.pants, l, 0.3)));
}

export function buildCorsairD1(scene, skin) {
  const ctx = B.setup(scene, skin), { kit } = ctx;
  const coatC = skin.coat ?? 0x8e1c22, coatVC = K.shade(coatC, 0.45).getHex(), trimC = skin.trim ?? 0xe0b45a;
  B.tintSkin(ctx, skin.skin ?? 0xd0956c);
  ctx.shoes.visible = false;
  const ch = {}; col(coatC).getHSL(ch, THREE.SRGBColorSpace);
  recolorOutfit(ctx, 'd1' + coatC.toString(16), { coat: [ch.h * 360, Math.min(0.75, ch.s * 0.95), ch.l < 0.2 ? Math.max(0.04, ch.l * 0.8) : Math.max(0.2, ch.l * (ch.h > 0.15 && ch.h < 0.9 ? 0.92 : 0.6)), 1.1], vest: [42, 0.35, 0.62, 1.0], shirt: [40, 0.28, 0.74, 0.5], button: [44, 0.7, 0.5, 0], pants: [250, 0.12, 0.17, 0.6] });
  K.filterTris(ctx.top, (c, id) => !(id === 13 || id === 14 || id === 0 || id === 16 || id === 17) && !(id === 9 && c.y < 0.93));
  K.filterTris(ctx.bottom, (c, id, mn) => mn > 0.69);
  K.filterTris(ctx.bodyM, (c, id, mn) => mn > 0.5);
  B.boot(ctx, 'Left', { color: 0x2c1a10, top: 0.74, flare: 0.112, cuff: 0.13 }); B.boot(ctx, 'Right', { color: 0x2c1a10, top: 0.74, flare: 0.112, cuff: 0.13 });
  const ed = C.coatSkirt(ctx, { y0: 1.12, color: coatVC, openTop: 0.55, openHem: 1.2, vent: 0.12, hemF: 0.72, hemS: 0.56, hemB: 0.5 });
  for (const s of [1, -1]) { C.laceBand(ctx, ed.front[s].slice(2), 0.024, { color: trimC }); C.laceBand(ctx, ed.hem[s], 0.024, { color: trimC }); }
  for (const s of [1, -1]) { C.pocketFlap(ctx, ed, s, 1.2, 0.99, { color: coatVC, trim: trimC }); C.buttonRow(ctx, ed.front[s].slice(0, 20).map((p) => p.clone()), 0.075, 0.0095, { start: 0.0, off: 0.006 }); }
  for (const A of ['Left', 'Right']) C.cuff(ctx, A, { color: coatVC, trim: trimC, from: 0.56, to: 0.7 });
  const on = () => true;
  ctx.jabotZ = (x, y) => G.torsoPt(ctx, x, y, true, 0.0).z;
  if (on('jabot')) P.jabot(ctx, { y0: 1.52, tiers: 6 });
  if (on('baldric')) G.baldric(ctx, { color: 0x2a1a10 });
  if (on('belt')) G.belt(ctx, { y: 1.07 });
  if (on('sword')) G.cutlass(ctx, { sideX: ed.sideX });
  if (on('pistol')) {
    const bR = G.torsoPt(ctx, -0.19, 1.06, true, 0.034), bL = G.torsoPt(ctx, 0.19, 1.06, true, 0.034);
    G.pistol(ctx, bR, V(0.9, -0.22, 0.38), V(0.0, 0.2, 1), {});
    G.pistol(ctx, bL, V(-0.9, -0.22, 0.38), V(0.0, 0.2, 1), {});
  }
  if (on('hat')) P.hat(ctx, { y: 1.742, z: 0.02, pitch: -0.14, roll: 0.06, color: skin.hat ?? 0x14100e, plume: false });
  if (on('parrot')) P.parrot(ctx, skin, { size: 1.25 });
  B.eyepatch(ctx); B.earring(ctx, -1);
  { const R = K.rng(5), locks = [];
    for (let i = 0; i < 60; i++) { const u = i / 59, az = 0.9 + u * (Math.PI * 2 - 1.8), bk = Math.abs(az - Math.PI) < 0.9; locks.push({ az, el: 0.1 + 0.6 * R(), len: bk ? 0.4 + 0.12 * R() : 0.17 + 0.04 * R(), curl: 0.25 + 0.5 * R(), w: 0.04 + 0.02 * R() }); }
    B.hair(ctx, { colors: [0x2a1a10, 0x3a2414, 0x4a3020, 0x5a4a3c], locks, seed: 3, clampR: (y, th) => { const [rx, rz] = torsoE(y); return Math.max(1 / Math.hypot(Math.sin(th) / rx, Math.cos(th) / rz) + 0.035, y > 1.35 ? 0.145 : 0); } });
    B.beardMass(ctx, { color: 0x2c1c12, grey: 0.35 }); }
  kit.add(0, new THREE.BoxGeometry(0.01, 0.01, 0.01), 'Hips', 0xffffff);
  return kit.finish();
}
