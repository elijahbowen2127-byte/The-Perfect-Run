// Design 2: weathered buccaneer. Open-collar linen shirt, leather vest, bandana, slouch hat, crossbelt, twin pistols, sash, tall boots.
import * as THREE from 'three';
import { V } from './armor.js';
import * as K from './corsair_lib.js';
import * as B from './corsair_base.js';
import * as G from './corsair_gear.js';
import * as P from './corsair_props.js';
import * as C2 from './corsair_cloth2.js';
import { torsoE } from './corsair_cloth2.js';
import { recolorOutfit } from './corsair_d1.js';
const col = K.col;

export function buildCorsairD2(scene, skin) {
  const ctx = B.setup(scene, skin), { kit } = ctx;
  const shirtC = skin.shirt ?? 0xe4dac2, sashC = skin.sash ?? 0x7a1820, bootC = 0x3a2416;
  B.tintSkin(ctx, skin.skin ?? 0xd0956c);
  ctx.shoes.visible = false; ctx.top.visible = false; ctx.top.geometry.setDrawRange(0, 0);
  recolorOutfit(ctx, 'd2', { coat: [28, 0.4, 0.2, 1], vest: [26, 0.45, 0.2, 1.0], shirt: [34, 0.3, 0.6, 0.5], button: [40, 0.5, 0.45, 0], pants: [36, 0.18, 0.28, 0.6] });
  // keep only the veteran's vest; the shirt, jacket, cuffs and accessories are replaced
  K.filterTris(ctx.top, () => false);
  K.filterTris(ctx.bodyM, (c, id, mn) => mn > 0.5);
  K.filterTris(ctx.bottom, (c, id, mn) => mn > 0.45);
  for (const s of ['Left', 'Right']) B.boot(ctx, s, { color: bootC, top: 0.6, flare: 0.112, cuff: 0.14 });
  C2.shirtBody(ctx, { color: shirtC, hem: 0.9, blouse: 0.09, openW: 0.075, openY: 1.3, fit: 0.93 });
  C2.vest(ctx, { color: 0x4a2e1a });
  for (const A of ['Left', 'Right']) C2.billowSleeve(ctx, A, { color: shirtC, puff: 0.018, cuffColor: 0xbfb49a, cuffSlot: B.SL.linen, frill: false });
  G.baldric(ctx, { color: 0x3a2514 });
  G.belt(ctx, { y: 1.04, width: 0.07, color: 0x2e1c10, buckleW: 0.08 });
  C2.sash(ctx, { color: sashC, y: 1.1, width: 0.12, knotX: -0.2, stripe: col(sashC).multiplyScalar(0.6).getHex() });
  const bR = G.torsoPt(ctx, -0.14, 1.08, true, 0.09), bL = G.torsoPt(ctx, 0.14, 1.08, true, 0.09);
  G.pistol(ctx, bR, V(0.9, -0.22, 0.38), V(0, 0.2, 1), { scale: 0.7 });
  G.pistol(ctx, bL, V(-0.9, -0.22, 0.38), V(0, 0.2, 1), { scale: 0.7 });
  C2.ropeCoil(ctx, V(-0.1, 0.99, -0.2), { r: 0.06, ex: 1.0, color: 0x7a6644 });
  C2.bandana(ctx, { color: 0x8a1c18 });
  P.hat(ctx, { y: 1.762, z: 0.0, pitch: 0.12, roll: -0.12, yaw: 0.2, corners: 3, color: 0x4a3828, trim: false, band: 0x2a1c12, brim: 0.15, lift: 0.03, plume: false, worn: true });
  P.parrot(ctx, skin, { size: 1.2 });
  B.earring(ctx, 1); B.earring(ctx, -1);
  B.scar(ctx, 0.03, 1.72, 0.045, 1.655);
  { const R = K.rng(11), locks = [];
    for (let i = 0; i < 56; i++) { const u = i / 55, az = 0.9 + u * (Math.PI * 2 - 1.8), bk = Math.abs(az - Math.PI) < 1.0; locks.push({ az, el: 0.1 + 0.6 * R(), len: bk ? 0.12 + 0.07 * R() : 0.11 + 0.06 * R(), curl: 0.5 + R(), w: 0.05 + 0.025 * R() }); }
    B.hair(ctx, { colors: [0x2a1a10, 0x3a2414, 0x4a3020], locks, seed: 7, clampR: (y, th) => { const [rx, rz] = torsoE(y); return Math.max(1 / Math.hypot(Math.sin(th) / rx, Math.cos(th) / rz) + 0.04, y > 1.35 ? 0.15 : 0); } });
    B.beardMass(ctx, { color: skin.beard ?? 0x3a2214, grey: 0.2 }); }
  kit.add(0, new THREE.BoxGeometry(0.01, 0.01, 0.01), 'Hips', 0xffffff);
  return kit.finish();
}
