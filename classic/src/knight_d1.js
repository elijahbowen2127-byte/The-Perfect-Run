// Design 1: late-medieval full harness (Italian/Gothic c.1450): bascinet with the visor raised over a mail
// aventail, globose breastplate, articulated pauldrons and arms, fingered gauntlets, tassets, cuisses,
// poleyns, greaves and long sabatons, a heraldic tabard and a sheathed arming sword.
import * as THREE from 'three';
import { makeKit, V } from './armor.js';
import { real } from './realmat.js';
import { finishKit, surf, tubeAlong, studs, makeWeights, mailMaterial, dsided, tab, sstep, mix, clamp, sp, TAU, vnoise, decalMaterial } from './knight_kit.js';
import { hideBaseClothes, doublet, neckBand, armTube, legTube, legCenter, LEG_R } from './knight_body.js';
import { band, bead, beadU, riveted, strap, buckle, fingerPlates, swordAndScabbard, surfObj } from './knight_parts.js';
import { heraldryTexture } from './knight_heraldry.js';

const col = (c, k) => new THREE.Color(c).multiplyScalar(k);
const SIDES = ['Left', 'Right'];
const sgn = (A) => (A === 'Left' ? 1 : -1);

export function buildKnightD1(scene, skin) {
  const C = { steel: 0xb4bcc6, steel2: 0x8f98a4, mail: 0x6c727c, trim: 0xd9b45a, tabard: 0xefe9da, tabard2: 0xcfc7b4, emblem: 0xb8202a, leather: 0x4a3222, heraldry: 'cross', ...skin };
  hideBaseClothes(scene);
  const tex = heraldryTexture(C, 1);
  const steel = real('steel', { rough: 0.56, metal: 0.72 }), brass = real('gilt', { rough: 0.42 });
  const leather = dsided(real('leather', { scale: 1.6 })), cloth = dsided(real('cloth', { scale: 6, bump: 0.25 })), wool = dsided(real('wool', { scale: 6, bump: 0.25 }));
  const decal = decalMaterial('wool', tex, { scale: 7, bump: 0.22 });
  const kit = makeKit(scene, [steel, brass, leather, cloth, wool, mailMaterial(), decal, dsided(steel, 'plate2')], 'knight_armor');
  const S = { steel: 0, brass: 1, leather: 2, cloth: 3, wool: 4, mail: 5, decal: 6, steel2s: 7 };
  const J = kit.J, W = makeWeights(kit);
  const steelC = col(C.steel, 0.92).getHex(), steel2C = col(C.steel2, 0.95).getHex(), trimC = C.trim, leatherC = col(C.leather, 0.8).getHex();
  const mailC = col(C.mail, 1.7).getHex();
  const under = col(C.tabard2, 0.42).getHex(), under2 = col(C.leather, 0.7).getHex();
  const patina = (k = 1) => (p, n, u, v) => 1 - 0.09 * k * vnoise(p.x * 22 + p.y * 9, p.z * 22 + p.y * 11) - 0.05 * k * vnoise(p.x * 90, p.y * 60 + p.z * 90);
  const edgeAO = (k = 0.2, pw = 3) => (p, n, u, v) => 1 - k * Math.pow(1 - v, pw);

  // ------------------------------------------------------------ body under-layers
  doublet(kit, S.cloth, { color: under, quilt: 0.0035 });
  neckBand(kit, S.cloth, col(C.leather, 0.5).getHex());
  for (const A of SIDES) {
    armTube(kit, S.mail, A, { color: mailC, thick: 0.004 });
    legTube(kit, S.wool, A, { color: under2, y1: 1.06, wrinkle: (y, a) => 0.0015 * Math.sin(y * 70 + a * 3) });
  }

  // ------------------------------------------------------------ cuirass: globose breast with medial ridge, back plate
  const CU = [[1.10, 0.172, 0.134, 0.122], [1.18, 0.172, 0.146, 0.124], [1.27, 0.186, 0.166, 0.128], [1.35, 0.204, 0.17, 0.13], [1.41, 0.204, 0.15, 0.124], [1.47, 0.178, 0.112, 0.108], [1.5, 0.12, 0.08, 0.085]];
  const topAt = (th) => tab([[0, 1.492], [0.45, 1.505], [0.8, 1.49], [1.15, 1.43], [1.5, 1.395], [1.9, 1.41], [2.3, 1.47], [2.7, 1.5], [3.15, 1.505]], th)[0];
  const CUCZ = 0.004;
  const cuirPt = (u, v, out) => {
    const th = u * TAU, thf = th > Math.PI ? TAU - th : th;
    const y = mix(1.1, topAt(thf), v);
    const [rx, zf, zb] = tab(CU, y);
    const e = 2 / 2.7, s = Math.sin(th), c = Math.cos(th);
    let off = 0;
    if (c > 0) off += 0.014 * Math.exp(-Math.pow(rx * sp(s, e) / 0.03, 2)) * sstep(y, 1.13, 1.3) * (1 - 0.7 * sstep(y, 1.42, 1.5));
    out.set(rx * sp(s, e), y, CUCZ + (c >= 0 ? zf * sp(c, e) + off : zb * sp(c, e)));
  };
  surf(kit, S.steel, 96, 40, cuirPt, { closed: true, color: steelC, ao: 0.28, bind: 'Spine1', shade: patina() });
  {
    const B = surfObj(cuirPt, 96, 40, true, () => V(0, 1.3, CUCZ));
    bead(kit, S.brass, B, 1, 0.0042, () => 'Spine1', trimC, { N: 96 });
    // waist roll and the side straps that buckle the plates together
    const pts = []; for (let i = 0; i <= 40; i++) { const th = mix(-1.25, 1.25, i / 40); const e = 2 / 2.7, s = Math.sin(th), c = Math.cos(th), y = 1.215, [rx, zf] = tab(CU, y); pts.push(V(rx * 1.003 * sp(s, e), y, CUCZ + zf * 1.003 * sp(c, e) + 0.014 * Math.exp(-Math.pow(rx * sp(s, e) / 0.03, 2)) * sstep(y, 1.13, 1.3))); }
    tubeAlong(kit, S.steel, pts, 0.0038, () => 'Spine1', { seg: 6, color: steel2C, ao: 0.12 });
    for (const s of [1, -1]) for (const y of [1.16]) {
      const [rx, zf, zb] = tab(CU, y), a = [];
      for (let k = 0; k <= 8; k++) { const th = mix(1.05, 2.1, k / 8), e = 2 / 2.7, ss = Math.sin(th), c = Math.cos(th); a.push(V(s * (rx + 0.003) * sp(ss, e), y, CUCZ + (c >= 0 ? (zf + 0.003) * sp(c, e) : (zb + 0.003) * sp(c, e)))); }
      strap(kit, S.leather, a, 0.02, 0.0045, () => 'Spine1', leatherC, { vertical: true });
      const mid = a[4]; buckle(kit, S.brass, 'Spine1', mid.clone(), V(s, 0, 0.0).normalize(), V(0, 1, 0), 0.01, 0.012, trimC);
    }
  }

  // ------------------------------------------------------------ helm: bascinet, visor up, aventail
  const HC = (y) => 0.034 - 0.04 * sstep(y, 1.84, 1.965);
  const HR = [[1.57, 0.102, 0.108, 0.106], [1.65, 0.108, 0.124, 0.114], [1.74, 0.112, 0.142, 0.122], [1.80, 0.113, 0.15, 0.126], [1.855, 0.107, 0.143, 0.12], [1.9, 0.09, 0.115, 0.102], [1.935, 0.06, 0.078, 0.076], [1.955, 0.028, 0.038, 0.04], [1.968, 0.003, 0.005, 0.006]];
  const helmBot = (thf) => tab([[0, 1.778], [0.5, 1.772], [0.78, 1.7], [1.0, 1.635], [1.3, 1.6], [2.0, 1.585], [3.15, 1.575]], thf)[0];
  const helmPt = (u, v, out) => {
    const th = u * TAU, thf = th > Math.PI ? TAU - th : th;
    const y = mix(helmBot(thf), 1.968, Math.pow(v, 0.92));
    const [rx, zf, zb] = tab(HR, y);
    const e = 2 / 2.3, s = Math.sin(th), c = Math.cos(th);
    out.set(rx * sp(s, e), y, HC(y) + (c >= 0 ? zf * sp(c, e) : zb * sp(c, e)));
  };
  surf(kit, S.steel, 80, 32, helmPt, { closed: true, color: steelC, ao: 0.3, bind: 'Head', shade: patina(1.2) });
  {
    const rim = []; for (let i = 0; i < 96; i++) { const p = V(); helmPt(i / 96, 0, p); rim.push(p); }
    tubeAlong(kit, S.steel, rim, 0.0036, () => 'Head', { closed: true, seg: 7, color: steel2C, ao: 0.12 });
    const arr = []; for (let i = 0; i < 96; i += 2) { const p = rim[i].clone(); p.y += 0.016; const nrm = V(p.x, 0, p.z - HC(p.y)).normalize(); arr.push({ p, n: nrm }); }
    studs(kit, S.brass, 'Head', arr, 0.0028, trimC);
    // brass edge band around the face opening only (front quarter)
    const fr = []; for (let i = 0; i <= 40; i++) { const u = mix(-0.2, 0.2, i / 40); const p = V(); helmPt(((u % 1) + 1) % 1, 0.012, p); fr.push(p); }
    tubeAlong(kit, S.brass, fr, 0.0042, () => 'Head', { seg: 7, color: trimC, ao: 0.12 });
  }
  // visor: hinged at the temples and swung up; it rests over the brow as a pointed hood with an eye slit and breaths
  {
    const vy0 = 1.785, vy1 = 1.948;
    const visPt = (u, v, out) => {
      const th = (u - 0.5) * 2.5, y = mix(vy0, vy1, v), [rx, zf, zb] = tab(HR, y), e = 2 / 2.3, s = Math.sin(th), c = Math.cos(th);
      const beak = 0.05 * Math.exp(-Math.pow(th / 0.5, 2)) * Math.sin(Math.PI * Math.pow(v, 0.8) * 0.95) * (0.4 + 0.6 * v);
      const off = 0.011 + 0.012 * v + beak * 0.8;
      out.set(rx * sp(s, e) + off * s, y, HC(y) + zf * sp(c, e) + off * c + beak * 0.5 * c);
    };
    const vc = V(0, 1.85, 0.0);
    surf(kit, S.steel2s, 44, 20, visPt, { center: vc, color: steelC, ao: 0.3, bind: 'Head', shade: patina() });
    const B = surfObj(visPt, 44, 20, false, () => vc);
    bead(kit, S.steel, B, 0, 0.0036, () => 'Head', steel2C, { N: 44, u0: 0, u1: 1 });
    bead(kit, S.steel, B, 1, 0.0032, () => 'Head', steel2C, { N: 44, u0: 0, u1: 1 });
    beadU(kit, S.steel, B, 0, 0.0032, () => 'Head', steel2C, { N: 20 }); beadU(kit, S.steel, B, 1, 0.0032, () => 'Head', steel2C, { N: 20 });
    const dark = 0x0a0a0e;
    for (const s of [1, -1]) studs(kit, S.brass, 'Head', [{ p: V(s * 0.1235, 1.795, 0.03), n: V(s, 0, 0), r: 0.0095 }], 0.0095, trimC, { flat: 0.6 });
    const sp3 = (th, v, off = 0.002) => { const p = V(); visPt(th / 2.5 + 0.5, v, p); const n = V(Math.sin(th), 0, Math.cos(th)); p.addScaledVector(n, off); return { p, n }; };
    { const sl = []; for (let i = -12; i <= 12; i++) { const q = sp3(i * 0.045, 0.2, 0.0015); sl.push(q.p); } tubeAlong(kit, S.leather, sl, (t) => [0.0034 * Math.pow(Math.sin(t * Math.PI), 0.3) + 0.0004, 0.0016], () => 'Head', { seg: 6, color: dark, ao: 0, up: V(0, 1, 0) }); }
    const holes = []; for (let r = 0; r < 3; r++) for (let k = -3; k <= 3; k++) { if (Math.abs(k) > 3 - r) continue; holes.push({ ...sp3(0.11 * k + (r % 2) * 0.05, 0.42 + r * 0.17), r: 0.0034 }); }
    studs(kit, S.leather, 'Head', holes, 0.0034, dark, { flat: 0.35, ao: 0 });
  }
  // aventail: riveted mail hung from the rim, over the throat and the shoulders
  {
    const AV = [[1.385, 0.208, 0.172, 0.16], [1.43, 0.196, 0.15, 0.14], [1.47, 0.165, 0.12, 0.122], [1.52, 0.118, 0.092, 0.105], [1.56, 0.092, 0.082, 0.102], [1.6, 0.104, 0.104, 0.108]];
    const top = (thf) => mix(1.565, Math.min(1.598, helmBot(thf)), sstep(thf, 0.35, 1.5));
    surf(kit, S.mail, 96, 26, (u, v, out) => {
      const th = u * TAU, thf = th > Math.PI ? TAU - th : th;
      const hem = 1.375 - 0.03 * Math.pow(Math.sin(th), 2) - 0.015 * Math.abs(Math.cos(th)) - 0.006 * Math.abs(Math.sin(th * 22));
      const y = mix(top(thf), hem, v);
      const [rx, zf, zb] = tab(AV, y);
      const e = 2 / 2.3, s = Math.sin(th), c = Math.cos(th);
      const drape = 1 + 0.025 * Math.sin(th * 14 + v * 5) * v;
      out.set(rx * sp(s, e) * drape, y, 0.008 + (c >= 0 ? zf * sp(c, e) : zb * sp(c, e)) * drape);
    }, { closed: true, color: mailC, ao: 0.25, bind: (p) => W.torso(Math.min(p.y, 1.5)), shade: (p, n, u, v) => 1 - 0.2 * v * v });
  }

  // ------------------------------------------------------------ pauldrons and arms
  for (const A of SIDES) {
    const s = sgn(A), sh = J(A + 'Arm');
    const axC = (d) => V(s * d, sh.y, sh.z);
    const REF = V(0, 1, 0);
    const lame = (d0, d1, rr0, rr1, a0, a1, bone, color = steelC, o = {}) => band(kit, S.steel, {
      c0: axC(d0), c1: axC(d1), d: V(s, 0, 0), ref: REF, sgn: s,
      rA: (v) => mix(rr0, rr1, v) + (o.bulge ? o.bulge * Math.sin(v * Math.PI) : 0) + (o.lip ? o.lip * Math.pow(v, 5) : 0),
      rB: (v) => (mix(rr0, rr1, v) + (o.bulge ? o.bulge * Math.sin(v * Math.PI) : 0) + (o.lip ? o.lip * Math.pow(v, 5) : 0)) * (o.asp ?? 1),
      a0, a1, nu: o.nu ?? 28, nv: o.nv ?? 4, n: o.n ?? 2.2, color, ao: 0.3, bind: bone, shade: o.shade ?? ((p, n, u, v) => edgeAO(0.2)(p, n, u, v) * patina()(p, n, u, v)),
    });
    // dome of the pauldron over the shoulder joint, bound to the shoulder girdle
    const cx = s * 0.19, cy = 1.508, cz = sh.z;
    const domePt = (u, v, out) => {
      const th = u * TAU, ph = v * 1.3, sx = Math.sin(ph) * Math.cos(th), sz = Math.sin(ph) * Math.sin(th), sy = Math.cos(ph);
      const rim = 0.007 * sstep(v, 0.9, 1);
      out.set(cx + s * (0.108 + rim) * sx, cy + 0.094 * sy - 0.012, cz + (0.116 + rim) * sz);
    };
    const dbind = [['Spine2', 0.45], [A + 'Shoulder', 0.55]];
    surf(kit, S.steel, 40, 14, domePt, { closed: true, color: steelC, ao: 0.28, bind: dbind, center: V(cx, cy - 0.02, cz), shade: patina() });
    const DB = surfObj(domePt, 40, 14, true, () => V(cx, cy, cz));
    bead(kit, S.brass, DB, 1, 0.0042, dbind, trimC, { N: 40 });
    riveted(kit, S.brass, 'Spine2', DB, [0.1, 0.35, 0.6, 0.85].map((u) => [u, 0.9, 0.001]), 0.0032, trimC);
    // lames cascading down the outside of the upper arm
    [[0.205, 0.285, 0.112, 0.106], [0.25, 0.325, 0.104, 0.098], [0.292, 0.364, 0.096, 0.09]].forEach(([d0, d1, r0, r1], i) => {
      const B = lame(d0, d1, r0, r1, -2.2, 2.2, A + 'Arm', i % 2 ? steel2C : steelC, { lip: 0.01, nv: 5, nu: 30 });
      bead(kit, S.steel, B, 1, 0.0036, () => A + 'Arm', i % 2 ? steelC : steel2C, { N: 30, u0: 0.01, u1: 0.99 });
      riveted(kit, S.brass, A + 'Arm', B, [0.3, 0.5, 0.7].map((u) => [u, 0.3, 0.0012]), 0.0032, trimC);
    });
    // rerebrace, couter (cop with wing and point), vambrace
    let B2 = lame(0.355, 0.43, 0.073, 0.068, 0, TAU, A + 'Arm', steelC, { bulge: 0.003, lip: 0.004, nu: 28 });
    bead(kit, S.steel, B2, 1, 0.0034, () => A + 'Arm', steel2C); bead(kit, S.steel, B2, 0, 0.0034, () => A + 'Arm', steel2C);
    riveted(kit, S.brass, A + 'Arm', B2, [0.0, 0.25, 0.5, 0.75].map((u) => [u, 0.5, 0.001]), 0.003, trimC);
    const couter = band(kit, S.steel, {
      c0: axC(0.415), c1: axC(0.5), d: V(s, 0, 0), ref: V(0, 0, -1), sgn: -s, nu: 36, nv: 10, n: 2,
      rA: (v, a) => 0.062 + 0.03 * Math.sin(Math.PI * Math.pow(v, 0.8)) * Math.exp(-Math.pow(a / 1.1, 2)) + 0.008 * Math.sin(Math.PI * v),
      rB: (v, a) => 0.068 + 0.012 * Math.sin(Math.PI * v) + 0.018 * Math.sin(Math.PI * v) * Math.exp(-Math.pow((Math.abs(a) - 1.1) / 0.7, 2)),
      a0: -Math.PI * 0.92, a1: Math.PI * 0.92, color: steelC, ao: 0.3, bind: A + 'ForeArm', shade: (p, n, u, v) => (1 - 0.15 * Math.pow(1 - Math.sin(v * Math.PI), 2)) * patina()(p, n, u, v),
    });
    bead(kit, S.brass, couter, 0.02, 0.0032, () => A + 'ForeArm', trimC, { N: 36 });
    bead(kit, S.brass, couter, 0.98, 0.0032, () => A + 'ForeArm', trimC, { N: 36 });
    lame(0.4, 0.44, 0.064, 0.076, 0, TAU, A + 'Arm', steel2C, { nv: 3, lip: 0.003 });
    B2 = lame(0.495, 0.655, 0.067, 0.054, 0, TAU, A + 'ForeArm', steelC, { bulge: 0.0035, nu: 30, nv: 8, lip: 0.003 });
    bead(kit, S.steel, B2, 0, 0.0035, () => A + 'ForeArm', steel2C); bead(kit, S.steel, B2, 1, 0.0035, () => A + 'ForeArm', steel2C);
    riveted(kit, S.brass, A + 'ForeArm', B2, [0.1, 0.35, 0.6, 0.85].map((u) => [u, 0.08, 0.001]), 0.003, trimC);
    // gauntlet: flared cuff, back-of-hand plate, knuckle roll, fingers and thumb in lames
    B2 = lame(0.65, 0.725, 0.058, 0.05, 0, TAU, A + 'Hand', steel2C, { lip: 0.009, nv: 4 });
    bead(kit, S.brass, B2, 1, 0.0035, () => A + 'Hand', trimC);
    const hc = (v) => V(s * mix(0.715, 0.805, v), 1.512 - 0.004 * v, -0.05);
    const hand = band(kit, S.steel, { c: hc, d: V(s, 0, 0), ref: REF, sgn: s, nu: 18, nv: 8, n: 2.4, a0: -1.45, a1: 1.45, rA: (v) => 0.03 - 0.008 * v, rB: (v) => 0.053 - 0.002 * v, color: steelC, ao: 0.28, bind: A + 'Hand', shade: patina() });
    bead(kit, S.steel, hand, 1, 0.003, () => A + 'Hand', steel2C, { N: 18 });
    fingerPlates(kit, S.steel, A, { color: steelC, r: 0.0085 });
  }

  // ------------------------------------------------------------ fauld and the mail skirt under it
  {
    const FA = [[0.98, 0.178, 0.14, 0.126], [1.06, 0.176, 0.138, 0.124], [1.12, 0.172, 0.136, 0.122]];
    for (let i = 0; i < 4; i++) {
      const yT = 1.125 - i * 0.034, yB = yT - 0.05, bone = i < 2 ? 'Spine' : 'Hips';
      const fp = (u, v, out) => { const th = u * TAU, y = mix(yT, yB, v), [rx, zf, zb] = tab(FA, y), k = 1 + i * 0.012 + 0.012 * Math.pow(v, 3), e = 2 / 2.5, s = Math.sin(th), c = Math.cos(th); out.set(rx * k * sp(s, e), y, CUCZ + (c >= 0 ? zf * k * sp(c, e) : zb * k * sp(c, e))); };
      surf(kit, S.steel, 64, 4, fp, { closed: true, color: i % 2 ? steel2C : steelC, ao: 0.3, bind: bone, shade: (p, n, u, v) => edgeAO(0.22, 4)(p, n, u, v) * patina()(p, n, u, v) });
      bead(kit, S.steel, surfObj(fp, 64, 4, true, () => V(0, yT, CUCZ)), 1, 0.0032, () => bone, i % 2 ? steelC : steel2C, { N: 64 });
    }
    // mail skirt: a ring of riveted mail hanging from the fauld, blending onto the thighs
    surf(kit, S.mail, 72, 18, (u, v, out) => {
      const th = u * TAU, y = mix(1.0, 0.83, v), e = 2 / 2.5, s = Math.sin(th), c = Math.cos(th);
      const flare = 1 + 0.12 * v + 0.012 * Math.sin(th * 12 + v * 4) * v;
      out.set(0.19 * flare * sp(s, e), y - 0.006 * Math.abs(Math.sin(th * 20)) * v, CUCZ + (c >= 0 ? 0.158 : 0.145) * flare * sp(c, e));
    }, { closed: true, color: mailC, ao: 0.25, bind: (p) => { const w = (1 - sstep(p.y, 0.98, 0.86)) * sstep(Math.abs(p.x), 0.03, 0.1); return w < 0.02 ? [['Hips', 1]] : [['Hips', 1 - w], [(p.x >= 0 ? 'Left' : 'Right') + 'UpLeg', w]]; } });
  }
  swordAndScabbard(kit, S, { belt: V(0.215, 1.1, 0.0), tip: V(0.29, 0.46, -0.14), bone: 'Hips', grip: 0.1, color: 0x2e2018, hiltColor: trimC, cross: 0.2 });
  

  // ------------------------------------------------------------ legs
  for (const A of SIDES) {
    const s = sgn(A), an = J(A + 'Foot');
    const LC = (y) => legCenter(kit, A, y, new THREE.Vector3());
    const legBand = (y0, y1, extra, o = {}) => band(kit, S.steel, {
      c: (v) => LC(mix(y1, y0, v)), d: V(0, -1, 0), ref: V(0, 0, 1), sgn: s, a0: o.a0 ?? 0, a1: o.a1 ?? TAU, nu: o.nu ?? 32, nv: o.nv ?? 6, n: o.n ?? 2.2,
      rA: (v, a) => { const y = mix(y1, y0, v); return tab(LEG_R, y)[0] + extra(v, a) + (o.zex ?? 0.004); },
      rB: (v, a) => { const y = mix(y1, y0, v); return tab(LEG_R, y)[0] * 0.98 + extra(v, a); },
      color: o.color ?? steelC, ao: 0.3, bind: o.bone, shade: (p, n, u, v) => edgeAO(0.2)(p, n, u, v) * patina()(p, n, u, v),
    });
    const ridge = (a, w = 0.6) => 0.006 * Math.exp(-Math.pow(a / w, 2));
    let B = legBand(0.74, 0.97, (v, a) => 0.014 + ridge(a) - 0.004 * v, { bone: A + 'UpLeg', nv: 8, color: steelC });
    bead(kit, S.steel, B, 1, 0.0035, () => A + 'UpLeg', steel2C);
    riveted(kit, S.brass, A + 'UpLeg', B, [0.0, 0.14, 0.28, 0.42, 0.57, 0.71, 0.86].map((u) => [u, 0.93, 0.001]), 0.003, trimC);
    B = legBand(0.63, 0.77, (v, a) => 0.016 + ridge(a) - 0.002 * v, { bone: A + 'UpLeg', nv: 6, color: steel2C });
    bead(kit, S.steel, B, 0, 0.0035, () => A + 'UpLeg', steelC); bead(kit, S.steel, B, 1, 0.0035, () => A + 'UpLeg', steelC);
    // tassets: hanging lames over the front of the thigh
    for (let i = 0; i < 3; i++) {
      const yT = 1.0 - i * 0.05, yB = yT - 0.075, tb = [[A + 'UpLeg', 0.5], ['Hips', 0.5]];
      const T = band(kit, S.steel, {
        c: (v) => LC(mix(yT, yB, v)), d: V(0, -1, 0), ref: V(0, 0, 1), sgn: s, a0: -1.05, a1: 1.05, nu: 22, nv: 4, n: 2.2,
        rA: (v) => 0.126 + i * 0.006 + 0.004 * Math.pow(v, 3), rB: (v) => 0.124 + i * 0.006 + 0.004 * Math.pow(v, 3),
        color: i % 2 ? steel2C : steelC, ao: 0.3, bind: tb, shade: (p, n, u, v) => edgeAO(0.2)(p, n, u, v) * patina()(p, n, u, v),
      });
      bead(kit, S.brass, T, 1, 0.003, tb, trimC, { N: 22 });
    }
    // poleyn: knee cop with lames above and below and a side wing
    const pol = band(kit, S.steel, {
      c: (v) => LC(mix(0.625, 0.505, v)), d: V(0, -1, 0), ref: V(0, 0, 1), sgn: s, a0: -1.45, a1: 1.45, nu: 36, nv: 14, n: 2,
      rA: (v, a) => 0.07 + 0.034 * Math.sin(Math.PI * Math.pow(v, 0.9)) * Math.exp(-Math.pow(a / 1.2, 2)) + 0.005,
      rB: (v, a) => 0.077 + 0.012 * Math.sin(Math.PI * v) + 0.025 * Math.sin(Math.PI * v) * Math.exp(-Math.pow((a - 0.95) / 0.5, 2)),
      color: steelC, ao: 0.3, bind: A + 'Leg', shade: (p, n, u, v) => (1 - 0.18 * Math.pow(Math.abs(v - 0.5) * 2, 3)) * patina()(p, n, u, v),
    });
    bead(kit, S.brass, pol, 0.02, 0.0034, () => A + 'Leg', trimC, { N: 36 }); bead(kit, S.brass, pol, 0.98, 0.0034, () => A + 'Leg', trimC, { N: 36 });
    legBand(0.585, 0.655, (v, a) => 0.012 + ridge(a, 0.5) * 0.5, { bone: A + 'UpLeg', nv: 3, a0: -1.6, a1: 1.6, nu: 22, color: steel2C });
    // greave: closed shin and calf armour with straps
    B = legBand(0.14, 0.5, (v, a) => 0.011 + 0.008 * Math.exp(-Math.pow(a / 0.45, 2)), { bone: A + 'Leg', nv: 12, nu: 36, color: steelC });
    bead(kit, S.steel, B, 0, 0.0035, () => A + 'Leg', steel2C); bead(kit, S.brass, B, 1, 0.0035, () => A + 'Leg', trimC);
    for (const y of [0.4, 0.27]) {
      const loop = []; for (let k = 0; k < 28; k++) { const a = (k / 28) * TAU; const r = tab(LEG_R, y)[0] + 0.0165, c = LC(y); loop.push(V(c.x + Math.sin(a) * r, y, c.z + Math.cos(a) * r * 0.98)); }
      strap(kit, S.leather, loop, 0.022, 0.005, () => A + 'Leg', leatherC, { closed: true, vertical: true });
      const c = LC(y), r = tab(LEG_R, y)[0] + 0.0185; buckle(kit, S.brass, A + 'Leg', V(c.x + s * r * 0.8, y, c.z - r * 0.55), V(s * 0.8, 0, -0.55).normalize(), V(0, 1, 0), 0.008, 0.011, trimC);
    }
    // sabaton: ankle cuff, lames over the instep with a long pointed toe
    legBand(0.1, 0.17, (v, a) => 0.012, { bone: A + 'Foot', nv: 3, nu: 24, color: steel2C });
    const fx = an.x, toeC = (v) => V(fx + s * 0.006, mix(0.062, 0.036, sstep(v, 0.2, 1)), mix(-0.07, 0.3, v));
    const NL = 9;
    for (let i = 0; i < NL; i++) {
      const v0 = i / NL * 0.92, v1 = v0 + 0.14, bone = A + (i < 3 ? 'Foot' : 'ToeBase');
      const bnd = band(kit, S.steel, {
        c: (v) => toeC(mix(v0, v1, v)), d: V(0, 0, 1), ref: V(0, 1, 0), sgn: -s, a0: -2.6, a1: 2.6, nu: 30, nv: 3, n: 2.2,
        rA: (v) => 0.05 - 0.012 * sstep(v0 + 0.1, 0.55, 1) + 0.006 * Math.sin(v0 * 3) - 0.005 * v0 * (v0 > 0.6 ? 2.5 : 0),
        rB: (v) => 0.054 - 0.021 * sstep(v0 + 0.1, 0.45, 1) + 0.003 * Math.pow(v, 3),
        color: i % 2 ? steel2C : steelC, ao: 0.3, bind: bone, shade: edgeAO(0.2),
      });
      if (i > 1) bead(kit, S.steel, bnd, 1, 0.0026, () => bone, steel2C, { N: 20 });
    }
    surf(kit, S.leather, 20, 12, (u, v, out) => {
      const a = (u - 0.5) * TAU * 0.5, z = mix(-0.1, 0.3, v), w = tab([[-0.1, 0.03], [-0.02, 0.05], [0.1, 0.05], [0.18, 0.04], [0.3, 0.004]], z)[0];
      out.set(fx + s * 0.005 + Math.sin(a * 2) * w, mix(0.002, 0.018, Math.abs(Math.cos(a))), z);
    }, { color: 0x1c1410, ao: 0.1, bind: A + 'Foot', center: V(fx, 0.06, 0.1) });
  }

  // ------------------------------------------------------------ tabard: heraldic cloth panels front and back, hung under the aventail
  {
    const TW = [[0.62, 0.2, 0.16, 0.15], [0.8, 0.178, 0.15, 0.14], [1.0, 0.162, 0.143, 0.13], [1.2, 0.152, 0.16, 0.13], [1.36, 0.14, 0.18, 0.136], [1.5, 0.1, 0.1, 0.1]];
    for (const back of [false, true]) {
      surf(kit, S.decal, 48, 64, (u, v, out) => {
        const y = mix(1.47, 0.64, v), [rx, zf, zb] = tab(TW, y);
        const wid = mix(0.135, 0.185, sstep(y, 1.45, 0.66)), xx = (u - 0.5) * 2 * wid, ex = Math.abs(xx) / wid;
        const lower = sstep(y, 1.08, 0.72);
        const fold = 0.013 * Math.sin(xx * 38 + 0.8 + (back ? 1.7 : 0)) * lower + 0.007 * Math.sin(xx * 81 + y * 5) * lower + 0.004 * Math.sin(xx * 23 - y * 9);
        const r = back ? zb : zf, dz = back ? -1 : 1;
        const sway = 0.014 * Math.sin(y * 7 + (back ? 2 : 0)) * v;
        const belly = 0.012 * Math.exp(-Math.pow((y - 1.15) / 0.05, 2));
        const curl = -0.028 * Math.pow(ex, 3) * (0.4 + lower);
        out.set(xx, y, CUCZ + dz * (r * Math.sqrt(Math.max(0.2, 1 - Math.pow(xx / (rx * 1.25), 2))) + 0.016 + 0.026 * sstep(y, 1.3, 1.1) + fold + 0.024 * lower + sway + belly + curl));
      }, { uv: [0.5, -1], uvOff: [back ? 0.5 : 0, 1], color: 0xffffff, ao: 0.2, bind: (p) => (p.y > 1.2 ? 'Spine1' : p.y > 0.95 ? W.torso(p.y) : (() => { const w = 0.55 * sstep(p.y, 0.97, 0.7) * sstep(Math.abs(p.x), 0.0, 0.12); return w < 0.02 ? [['Hips', 0.8], ['Spine', 0.2]] : [['Hips', 0.8 - w], ['Spine', 0.2], [(p.x >= 0 ? 'Left' : 'Right') + 'UpLeg', w]]; })()), center: (u, v) => V(0, mix(1.47, 0.64, v), CUCZ + (back ? 0.3 : -0.3)),
        shade: (p, n, u, v) => 1 - 0.08 * vnoise(p.x * 30, p.y * 8) });
    }
  }
  // surcoat belt over the tabard
  {
    const pts = []; for (let i = 0; i < 72; i++) { const th = (i / 72) * TAU, s = Math.sin(th), c = Math.cos(th), e = 2 / 2.5; pts.push(V(0.206 * sp(s, e), 1.1, CUCZ + (c >= 0 ? 0.192 * sp(c, e) : 0.168 * sp(c, e)))); }
    strap(kit, S.leather, pts, 0.03, 0.006, () => 'Spine', 0x2c1c12, { closed: true, vertical: true });
    buckle(kit, S.brass, 'Spine', V(0, 1.1, 0.197), V(0, 0, 1), V(0, 1, 0), 0.015, 0.014, trimC);
    studs(kit, S.brass, 'Spine', [-0.09, -0.07, 0.07, 0.09].map((x) => ({ p: V(x, 1.1, 0.193), n: V(0, 0, 1) })), 0.003, trimC);
  }

  return finishKit(kit);
}
