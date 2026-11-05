// Design 4: grey Dark Souls-style Silver/Lothric knight: slim, worn and weathered grey plate, closed helm with a narrow T visor
// slit and a small ragged plume, layered scalloped pauldrons, mail glimpsed at the joints, and long tattered dark-grey cloth
// hanging from the waist in ragged strips. All grey, no heraldry.
import * as THREE from 'three';
import { makeKit, V } from './armor.js';
import { real } from './realmat.js';
import { finishKit, surf, tubeAlong, studs, makeWeights, mailMaterial, dsided, tab, sstep, mix, sp, TAU, vnoise } from './knight_kit.js';
import { hideBaseClothes, doublet, neckBand, armTube, legTube, legCenter, LEG_R } from './knight_body.js';
import { band, bead, beadU, riveted, strap, buckle, fingerPlates, swordAndScabbard, surfObj } from './knight_parts.js';

const col = (c, k) => new THREE.Color(c).multiplyScalar(k);
const SIDES = ['Left', 'Right'];
const sgn = (A) => (A === 'Left' ? 1 : -1);

export function buildKnightD4(scene, skin) {
  const C = { steel: 0x9aa1aa, steel2: 0x737a84, trim: 0xa9b0b9, leather: 0x34302c, ...skin };
  hideBaseClothes(scene);
  const steel = real('plate', { rough: 0.62, metal: 0.72, bump: 1.4 }), dark = real('plate', { rough: 0.62, metal: 0.7, scale: 1.3 });
  const leather = dsided(real('leather', { scale: 1.8 })), cloth = dsided(real('cloth', { scale: 3, bump: 0.2 })), wool = dsided(real('wool', { scale: 3, bump: 0.2 }));
  const kit = makeKit(scene, [steel, dark, leather, cloth, wool, dsided(steel, 'plate2'), mailMaterial()], 'knight_armor');
  const S = { steel: 0, brass: 1, leather: 2, cloth: 3, wool: 4, steel2s: 5, mail: 6 };   // 'brass' slot = blackened gunmetal fittings
  const J = kit.J, W = makeWeights(kit);
  const steelC = col(C.steel, 0.72).getHex(), steel2C = col(C.steel2, 0.72).getHex(), trimC = col(C.trim, 0.7).getHex();
  const leatherC = col(C.leather, 0.7).getHex(), clothC = 0x25272b, cloth2C = 0x1b1c20, blackC = 0x08080a;
  const patina = (k = 1) => (p, n, u, v) => 1 - 0.2 * k * vnoise(p.x * 18 + p.y * 7, p.z * 18 + p.y * 9) - 0.12 * k * vnoise(p.x * 70, p.y * 14 + p.z * 70) - 0.1 * k * Math.pow(vnoise(p.x * 9, p.y * 30 + p.z * 9), 2);
  const mailC = col(0x666c76, 1.15).getHex();
  const edgeAO = (k = 0.2, pw = 3) => (p, n, u, v) => 1 - k * Math.pow(1 - v, pw);
  const CUCZ = 0.004;

  // ------------------------------------------------------------ body under-layers: dark padded cloth
  doublet(kit, S.cloth, { color: cloth2C, quilt: 0.002 });
  neckBand(kit, S.cloth, cloth2C);
  for (const A of SIDES) {
    armTube(kit, S.mail, A, { color: mailC, thick: 0.004 });
    legTube(kit, S.mail, A, { color: mailC, y1: 1.06, wrinkle: (y, a) => 0.0014 * Math.sin(y * 70 + a * 3) });
  }

  // ------------------------------------------------------------ cuirass: slim, segmented, ridged
  const CU = [[1.04, 0.17, 0.132, 0.121], [1.12, 0.168, 0.134, 0.119], [1.2, 0.17, 0.142, 0.121], [1.28, 0.18, 0.152, 0.124], [1.36, 0.196, 0.158, 0.128], [1.42, 0.2, 0.148, 0.128], [1.47, 0.186, 0.134, 0.12], [1.51, 0.15, 0.104, 0.1], [1.54, 0.1, 0.07, 0.07]];
  const topAt = (th) => tab([[0, 1.525], [0.45, 1.53], [0.8, 1.52], [1.15, 1.5], [1.5, 1.48], [1.9, 1.485], [2.3, 1.505], [2.7, 1.525], [3.15, 1.53]], th)[0];
  const cuirPt = (u, v, out) => {
    const th = u * TAU, thf = th > Math.PI ? TAU - th : th;
    const y = mix(1.06, topAt(thf), v);
    const [rx, zf, zb] = tab(CU, y), e = 2 / 2.7, s = Math.sin(th), c = Math.cos(th);
    // a sharp medial keel down the front and back
    const keel = (c > 0 ? 0.03 * sstep(y, 1.1, 1.3) * (1 - 0.7 * sstep(y, 1.42, 1.5)) : 0.007) * Math.exp(-Math.pow(rx * sp(s, e) / 0.018, 2));
    out.set(rx * sp(s, e), y, CUCZ + (c >= 0 ? zf * sp(c, e) + keel : zb * sp(c, e) - keel * 0.5));
  };
  surf(kit, S.steel, 96, 40, cuirPt, { closed: true, color: steelC, ao: 0.28, bind: 'Spine1', shade: patina() });
  {
    const B = surfObj(cuirPt, 96, 40, true, () => V(0, 1.3, CUCZ));
    bead(kit, S.brass, B, 1, 0.0045, () => 'Spine1', steel2C, { N: 96 });
    bead(kit, S.brass, B, 0, 0.0045, () => 'Spine1', steel2C, { N: 96 });
    // horizontal plate-segment rolls across the chest and belly
    for (const y of [1.14, 1.22, 1.3]) {
      const pts = []; for (let i = 0; i <= 56; i++) { const th = mix(-2.9, 2.9, i / 56); const e = 2 / 2.7, s = Math.sin(th), c = Math.cos(th), [rx, zf, zb] = tab(CU, y);
        const keel = (c > 0 ? 0.03 * sstep(y, 1.1, 1.3) : 0.007) * Math.exp(-Math.pow(rx * sp(s, e) / 0.018, 2));
        pts.push(V(rx * 1.004 * sp(s, e), y, CUCZ + (c >= 0 ? zf * 1.004 * sp(c, e) + keel : zb * 1.004 * sp(c, e) - keel * 0.5))); }
      tubeAlong(kit, S.brass, pts, 0.0036, () => 'Spine1', { seg: 6, color: steel2C, ao: 0.12 });
    }
    // medial ridge line (front), and rivet rows along it
    const rid = []; for (let i = 0; i <= 24; i++) { const y = mix(1.1, 1.44, i / 24), [, zf] = tab(CU, y); rid.push(V(0, y, CUCZ + zf + 0.03 * sstep(y, 1.1, 1.3) * (1 - 0.7 * sstep(y, 1.42, 1.5)) + 0.002)); }
    tubeAlong(kit, S.brass, rid, 0.0038, () => 'Spine1', { seg: 6, color: steel2C, ao: 0.12 });
    const rv = []; for (const s of [1, -1]) for (let k = 0; k < 6; k++) { const y = 1.12 + k * 0.06 + 0.03, [rx, zf] = tab(CU, y), th = 0.55, e = 2 / 2.7; rv.push({ p: V(s * (rx + 0.002) * sp(Math.sin(th), e), y, CUCZ + zf * sp(Math.cos(th), e)), n: V(s * Math.sin(th), 0, Math.cos(th)).normalize() }); }
    studs(kit, S.brass, 'Spine1', rv, 0.0034, trimC);
    // side buckle straps
    for (const s of [1, -1]) for (const y of [1.17, 1.25]) {
      const [rx, zf, zb] = tab(CU, y), a = [];
      for (let k = 0; k <= 8; k++) { const th = mix(1.05, 2.1, k / 8), e = 2 / 2.7, ss = Math.sin(th), c = Math.cos(th); a.push(V(s * (rx + 0.003) * sp(ss, e), y, CUCZ + (c >= 0 ? (zf + 0.003) * sp(c, e) : (zb + 0.003) * sp(c, e)))); }
      strap(kit, S.leather, a, 0.018, 0.004, () => 'Spine1', leatherC, { vertical: true });
      buckle(kit, S.brass, 'Spine1', a[4].clone(), V(s, 0, 0).normalize(), V(0, 1, 0), 0.008, 0.01, trimC);
    }
  }

  // ------------------------------------------------------------ gorget: stacked rings of plate round the neck
  for (const [y0, y1, r0, r1, c, xs] of [[1.5, 1.54, 0.135, 0.118, 0, 1.12], [1.525, 1.565, 0.11, 0.095, 1, 1.05], [1.55, 1.59, 0.09, 0.078, 0, 1.0]]) {
    surf(kit, S.steel, 48, 4, (u, v, out) => { const a = u * TAU, y = mix(y0, y1, v), r = mix(r0, r1, v); out.set(Math.sin(a) * r * xs, y, 0.004 + Math.cos(a) * r * (Math.cos(a) > 0 ? 0.92 : 0.98)); },
      { closed: true, color: c ? steelC : steel2C, ao: 0.3, bind: (p) => W.torso(Math.min(p.y, 1.56)), shade: (p, n, u, v) => edgeAO(0.25, 3)(p, n, u, v) * patina()(p, n, u, v) });
  }

  // ------------------------------------------------------------ helm: fitted, tapering, pointed beak, narrow slit, tall swept crest
  const HC = (y) => 0.026 - 0.03 * sstep(y, 1.84, 1.96);
  const HR = [[1.5, 0.074, 0.08, 0.085], [1.56, 0.085, 0.1, 0.098], [1.62, 0.094, 0.118, 0.108], [1.68, 0.1, 0.128, 0.116], [1.75, 0.104, 0.131, 0.124], [1.82, 0.102, 0.13, 0.123], [1.88, 0.09, 0.114, 0.109], [1.93, 0.064, 0.081, 0.078], [1.96, 0.03, 0.04, 0.04], [1.975, 0.003, 0.005, 0.006]];
  const helmBot = (thf) => tab([[0, 1.578], [1.0, 1.565], [2.0, 1.53], [3.15, 1.5]], thf)[0];
  const headPt = (th, y, off = 0, out = V()) => {
    const [rx, zf, zb] = tab(HR, y), s = Math.sin(th), c = Math.cos(th);
    const e = 2 / (c >= 0 ? mix(2.3, 1.3, sstep(y, 1.8, 1.66)) : 2.3);
    const beak = c > 0 ? 0.05 * Math.exp(-Math.pow(rx * sp(s, e) / 0.04, 2)) * sstep(y, 1.57, 1.63) * (1 - sstep(y, 1.74, 1.8)) : 0;
    const brow = 0.007 * sstep(y, 1.745, 1.765) * (1 - sstep(y, 1.9, 1.95));
    out.set(rx * sp(s, e), y, HC(y) + (c >= 0 ? zf * sp(c, e) + beak : zb * sp(c, e)));
    out.x += brow * s; out.z += brow * c;
    if (off) { out.x += off * s; out.z += off * c; }
    return out;
  };
  const helmPt = (u, v, out) => { const th = u * TAU, thf = th > Math.PI ? TAU - th : th; return headPt(th, mix(helmBot(thf), 1.975, Math.pow(v, 0.92)), 0, out); };
  surf(kit, S.steel, 96, 44, helmPt, { closed: true, color: steelC, ao: 0.3, bind: 'Head', shade: patina(1.6) });
  {
    const rim = []; for (let i = 0; i < 96; i++) { const p = V(); helmPt(i / 96, 0, p); rim.push(p); }
    tubeAlong(kit, S.brass, rim, 0.004, () => 'Head', { closed: true, seg: 7, color: steel2C, ao: 0.12 });
    const arc = (y, a, b, off, n = 40) => { const o = []; for (let i = 0; i <= n; i++) o.push(headPt(mix(a, b, i / n), y, off)); return o; };
    tubeAlong(kit, S.brass, arc(1.77, -2.3, 2.3, 0.002), 0.0042, () => 'Head', { seg: 7, color: steel2C, ao: 0.12 });
    // single narrow eye slit, a thin breath slit below it
    tubeAlong(kit, S.leather, arc(1.728, -0.62, 0.62, 0.0008, 30), (t) => [0.0016, 0.0044 * Math.pow(Math.sin(t * Math.PI), 0.3) + 0.0004], () => 'Head', { seg: 6, color: blackC, ao: 0, up: V(0, 1, 0) });
    tubeAlong(kit, S.brass, arc(1.742, -0.7, 0.7, 0.002, 24), 0.0026, () => 'Head', { seg: 6, color: steel2C, ao: 0.1 });
    tubeAlong(kit, S.brass, arc(1.714, -0.7, 0.7, 0.002, 24), 0.0026, () => 'Head', { seg: 6, color: steel2C, ao: 0.1 });
    const stem = []; for (let i = 0; i <= 12; i++) stem.push(headPt(0, mix(1.7, 1.615, i / 12), 0.0008));
    tubeAlong(kit, S.leather, stem, [0.0014, 0.0017], () => 'Head', { seg: 6, color: blackC, ao: 0, up: V(1, 0, 0) });
    const holes = []; for (const sx of [1, -1]) for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - (r === 2 ? 1 : 0); k++) { const th = sx * (0.5 + k * 0.1 + (r % 2) * 0.05), y = 1.665 - r * 0.026; holes.push({ p: headPt(th, y, 0.0006), n: V(Math.sin(th), 0, Math.cos(th)), r: 0.003 }); }
    studs(kit, S.leather, 'Head', holes, 0.003, blackC, { flat: 0.35, ao: 0 });
    const rv = []; for (let i = 0; i < 36; i++) { const th = (i / 36) * TAU; rv.push({ p: headPt(th, 1.8, 0.0012), n: V(Math.sin(th), 0, Math.cos(th)) }); }
    studs(kit, S.brass, 'Head', rv, 0.0026, trimC);
    // tall sharp crest fin swept back along the skull
    const NB = 44, base = [];
    for (let i = 0; i <= NB; i++) { const t = i / NB; base.push(t <= 0.5 ? headPt(0, mix(1.775, 1.972, Math.pow(t * 2, 0.7)), 0.0) : headPt(Math.PI, mix(1.972, 1.7, Math.pow((t - 0.5) * 2, 0.9)), 0.0)); }
    const crest = (u, v, out) => {
      const p = base[Math.min(NB, Math.round(u * NB))], h = 0.06 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05 + 0.02)), 1.1) * (1 - sstep(u, 0.7, 0.98)) + 0.012;
      out.copy(p); out.y += h * v; out.z -= (0.07 * Math.pow(Math.max(0, u - 0.3) / 0.7, 1.2)) * v * v; out.x = 0;
    };
    surf(kit, S.steel2s, NB, 6, crest, { color: steelC, ao: 0.3, bind: 'Head', center: V(0, 1.5, 0), shade: patina(), flip: false });
    const top = []; for (let i = 0; i <= NB; i++) { const q = V(); crest(i / NB, 1, q); top.push(q); }
    tubeAlong(kit, S.brass, top, 0.0042, () => 'Head', { seg: 7, color: steel2C, ao: 0.12 });
    // pointed neck-guard flaring from the back of the helm
    const ng = (u, v, out) => { const ux = (u - 0.5) * 2, w = 0.074 * (1 + 0.3 * v), hem = 1.445 - 0.055 * (1 - Math.abs(ux)); out.set(ux * w, mix(1.63, hem, v), -(0.1 + 0.04 * Math.pow(v, 1.3)) + 0.02 * ux * ux * (0.4 + v)); };
    surf(kit, S.steel2s, 16, 8, ng, { color: steelC, ao: 0.3, bind: 'Head', center: V(0, 1.55, 0.2), shade: (p, n, u, v) => patina()(p, n, u, v) * (1 - 0.2 * v) });
    const rb = []; for (let i = 0; i <= 8; i++) { const q = V(); ng(0.5, i / 8, q); q.z -= 0.003; rb.push(q); }
    tubeAlong(kit, S.brass, rb, 0.0035, () => 'Head', { seg: 6, color: steel2C, ao: 0.1 });
    for (const sx of [0, 1]) { const eg = []; for (let i = 0; i <= 12; i++) { const q = V(); ng(sx, i / 12 * 0.999, q); eg.push(q); } tubeAlong(kit, S.brass, eg, 0.0032, () => 'Head', { seg: 6, color: steel2C, ao: 0.1 }); }
  }

  // ------------------------------------------------------------ pauldrons (layered, ridged) and arms
  for (const A of SIDES) {
    const s = sgn(A), sh = J(A + 'Arm');
    const axC = (d) => V(s * d, sh.y, sh.z), REF = V(0, 1, 0);
    const lame = (d0, d1, rr0, rr1, a0, a1, bone, color = steelC, o = {}) => band(kit, S.steel, {
      c0: axC(d0), c1: axC(d1), d: V(s, 0, 0), ref: REF, sgn: s,
      rA: (v, a) => mix(rr0, rr1, v) + (o.bulge ? o.bulge * Math.sin(v * Math.PI) : 0) + (o.lip ? o.lip * Math.pow(v, 5) : 0) + (o.scal ? o.scal * Math.pow(v, 3) * (0.5 + 0.5 * Math.cos(a * 7)) : 0),
      rB: (v, a) => (mix(rr0, rr1, v) + (o.bulge ? o.bulge * Math.sin(v * Math.PI) : 0) + (o.lip ? o.lip * Math.pow(v, 5) : 0) + (o.scal ? o.scal * Math.pow(v, 3) * (0.5 + 0.5 * Math.cos(a * 7)) : 0)) * (o.asp ?? 1),
      a0, a1, nu: o.nu ?? 28, nv: o.nv ?? 4, n: o.n ?? 2.2, color, ao: 0.3, bind: bone, shade: o.shade ?? ((p, n, u, v) => edgeAO(0.2)(p, n, u, v) * patina()(p, n, u, v)),
    });
    const cx = s * 0.185, cy = 1.51, cz = sh.z;
    const domePt = (u, v, out) => {
      const th = u * TAU, ph = v * 1.3, sx = Math.sin(ph) * Math.cos(th), sz = Math.sin(ph) * Math.sin(th), sy = Math.cos(ph);
      const rim = 0.008 * sstep(v, 0.9, 1), ridge = 0.01 * Math.exp(-Math.pow(Math.sin(th) / 0.14, 2)) * Math.sin(ph), tip = 0.04 * Math.pow(Math.max(0, Math.cos(th)), 5) * sstep(v, 0.55, 1);   // raised ridge fore-aft over the top
      out.set(cx + s * ((0.126 + rim) * sx * (1 + ridge * 8) + tip), cy + 0.09 * sy - 0.016 + ridge * sy * 2.5 - tip * 0.25, cz + (0.13 + rim) * sz * (1 + ridge * 8));
    };
    const dbind = [['Spine2', 0.45], [A + 'Shoulder', 0.55]];
    surf(kit, S.steel, 40, 14, domePt, { closed: true, color: steelC, ao: 0.28, bind: dbind, center: V(cx, cy - 0.02, cz), shade: patina() });
    const DB = surfObj(domePt, 40, 14, true, () => V(cx, cy, cz));
    bead(kit, S.brass, DB, 1, 0.0046, dbind, steel2C, { N: 40 });
    // fore-aft ridge rib along the crown
    { const rb = []; for (let i = 0; i <= 14; i++) { const th = i < 8 ? 0 : 0; const ph = mix(0.05, 1.25, i / 14); const p = V(); domePt(0.25, mix(0.03, 0.9, i / 14), p); rb.push(p); } 
      const rb2 = []; for (let i = 0; i <= 14; i++) { const p = V(); domePt(0.75, mix(0.03, 0.9, i / 14), p); rb2.push(p); }
      for (const r of [rb, rb2]) tubeAlong(kit, S.brass, r.map((p) => p.clone().add(V(0, 0.003, 0))), 0.0036, dbind, { seg: 6, color: steel2C, ao: 0.1 }); }
    riveted(kit, S.brass, 'Spine2', DB, [0.1, 0.35, 0.6, 0.85].map((u) => [u, 0.9, 0.001]), 0.0034, trimC);
    // lames cascading down the outer arm, each with a raised spine and a flared lip
    [[0.2, 0.28, 0.13, 0.124], [0.245, 0.32, 0.12, 0.114], [0.288, 0.358, 0.108, 0.102], [0.33, 0.395, 0.094, 0.088]].forEach(([d0, d1, r0, r1], i) => {
      const B = lame(d0, d1, r0, r1, -2.3, 2.3, A + 'Arm', i % 2 ? steel2C : steelC, { lip: 0.006, nv: 5, nu: 40, n: 1.7 });
      bead(kit, S.steel, B, 1, 0.0038, () => A + 'Arm', i % 2 ? steelC : steel2C, { N: 32, u0: 0.01, u1: 0.99 });
      for (let k = -2; k <= 2; k++) {
        const a = k * 0.5, rr = r1 + 0.005, base = V(s * d1 - s * 0.01, sh.y + Math.cos(a) * rr, sh.z + Math.sin(a) * rr);
        const nrm = V(0, Math.cos(a), Math.sin(a)), tip = base.clone().addScaledVector(nrm, 0.007).add(V(s * 0.05, -0.004, 0));
        tubeAlong(kit, S.steel, [base.clone().add(V(-s * 0.02, 0, 0)), base, tip], (t) => [0.003 * (1 - t) + 0.0005, 0.012 * (1 - t) + 0.0006], () => A + 'Arm', { seg: 6, color: steelC, ao: 0.2, up: nrm });
      }
      beadU(kit, S.brass, B, 0.5, 0.004, () => A + 'Arm', steel2C, { N: 5 });
      riveted(kit, S.brass, A + 'Arm', B, [0.28, 0.72].map((u) => [u, 0.3, 0.0012]), 0.0032, trimC);
    });
    // rerebrace, couter with wing, vambrace
    let B2 = lame(0.37, 0.435, 0.068, 0.064, 0, TAU, A + 'Arm', steelC, { bulge: 0.003, lip: 0.004, nu: 28 });
    bead(kit, S.steel, B2, 1, 0.0034, () => A + 'Arm', steel2C); bead(kit, S.steel, B2, 0, 0.0034, () => A + 'Arm', steel2C);
    const couter = band(kit, S.steel, {
      c0: axC(0.415), c1: axC(0.5), d: V(s, 0, 0), ref: V(0, 0, -1), sgn: -s, nu: 36, nv: 10, n: 2,
      rA: (v, a) => 0.06 + 0.032 * Math.sin(Math.PI * Math.pow(v, 0.8)) * Math.exp(-Math.pow(a / 1.1, 2)) + 0.007 * Math.sin(Math.PI * v),
      rB: (v, a) => 0.064 + 0.012 * Math.sin(Math.PI * v) + 0.02 * Math.sin(Math.PI * v) * Math.exp(-Math.pow((Math.abs(a) - 1.1) / 0.7, 2)),
      a0: -Math.PI * 0.92, a1: Math.PI * 0.92, color: steelC, ao: 0.3, bind: A + 'ForeArm', shade: (p, n, u, v) => (1 - 0.15 * Math.pow(1 - Math.sin(v * Math.PI), 2)) * patina()(p, n, u, v),
    });
    { const el = J(A + 'ForeArm'), b0 = V(s * 0.455, el.y + 0.002, el.z - 0.06);
      tubeAlong(kit, S.steel, [b0.clone().add(V(0, 0, 0.012)), b0, b0.clone().add(V(s * 0.012, 0.012, -0.075))], (t) => 0.016 * (1 - t) + 0.0008, () => A + 'ForeArm', { seg: 8, color: steelC, ao: 0.2 }); }
    bead(kit, S.brass, couter, 0.02, 0.0034, () => A + 'ForeArm', steel2C, { N: 36 }); bead(kit, S.brass, couter, 0.98, 0.0034, () => A + 'ForeArm', steel2C, { N: 36 });
    lame(0.4, 0.44, 0.06, 0.072, 0, TAU, A + 'Arm', steel2C, { nv: 3, lip: 0.003 });
    B2 = lame(0.495, 0.655, 0.063, 0.05, 0, TAU, A + 'ForeArm', steelC, { bulge: 0.0035, nu: 30, nv: 8, lip: 0.003 });
    bead(kit, S.steel, B2, 0, 0.0035, () => A + 'ForeArm', steel2C); bead(kit, S.steel, B2, 1, 0.0035, () => A + 'ForeArm', steel2C);
    beadU(kit, S.brass, B2, 0.5, 0.0036, () => A + 'ForeArm', steel2C, { N: 8 });
    riveted(kit, S.brass, A + 'ForeArm', B2, [0.1, 0.35, 0.6, 0.85].map((u) => [u, 0.08, 0.001]), 0.003, trimC);
    // gauntlet
    B2 = lame(0.65, 0.725, 0.055, 0.047, 0, TAU, A + 'Hand', steel2C, { lip: 0.009, nv: 4 });
    bead(kit, S.brass, B2, 1, 0.0035, () => A + 'Hand', steelC);
    const hc = (v) => V(s * mix(0.715, 0.805, v), 1.512 - 0.004 * v, -0.05);
    const hand = band(kit, S.steel, { c: hc, d: V(s, 0, 0), ref: REF, sgn: s, nu: 18, nv: 8, n: 2.4, a0: -1.45, a1: 1.45, rA: (v) => 0.03 - 0.008 * v, rB: (v) => 0.05 - 0.002 * v, color: steelC, ao: 0.28, bind: A + 'Hand', shade: patina() });
    bead(kit, S.steel, hand, 1, 0.003, () => A + 'Hand', steel2C, { N: 18 });
    fingerPlates(kit, S.steel, A, { color: steelC, r: 0.0082 });
  }

  // ------------------------------------------------------------ fauld lames and the dark cloth tassets
  {
    const FA = [[0.96, 0.176, 0.138, 0.126], [1.06, 0.172, 0.136, 0.123], [1.12, 0.17, 0.136, 0.121]];
    for (let i = 0; i < 3; i++) {
      const yT = 1.07 - i * 0.032, yB = yT - 0.046, bone = i < 1 ? 'Spine' : 'Hips';
      const fp = (u, v, out) => { const th = u * TAU, y = mix(yT, yB, v), [rx, zf, zb] = tab(FA, y), k = 1 + i * 0.012 + 0.012 * Math.pow(v, 3), e = 2 / 2.5, s = Math.sin(th), c = Math.cos(th); out.set(rx * k * sp(s, e), y, CUCZ + (c >= 0 ? zf * k * sp(c, e) : zb * k * sp(c, e))); };
      surf(kit, S.steel, 64, 4, fp, { closed: true, color: i % 2 ? steel2C : steelC, ao: 0.3, bind: bone, shade: (p, n, u, v) => edgeAO(0.22, 4)(p, n, u, v) * patina()(p, n, u, v) });
      bead(kit, S.steel, surfObj(fp, 64, 4, true, () => V(0, yT, CUCZ)), 1, 0.0032, () => bone, i % 2 ? steelC : steel2C, { N: 64 });
    }
    // belt with a gunmetal buckle
    const pts = []; for (let i = 0; i < 72; i++) { const th = (i / 72) * TAU, s = Math.sin(th), c = Math.cos(th), e = 2 / 2.5; pts.push(V(0.183 * sp(s, e), 1.09, CUCZ + (c >= 0 ? 0.153 * sp(c, e) : 0.14 * sp(c, e)))); }
    strap(kit, S.leather, pts, 0.034, 0.006, () => 'Spine', 0x15130f, { closed: true, vertical: true });
    buckle(kit, S.brass, 'Spine', V(0, 1.09, 0.156), V(0, 0, 1), V(0, 1, 0), 0.015, 0.014, steel2C);
    // long tattered tabard and waist cape: ragged strips hung from the belt, bound to the thigh on their own side
    const skirtBind = (p) => {
      const w = 0.72 * sstep(p.y, 1.0, 0.68);
      return w < 0.02 ? [['Hips', 1]] : [['Hips', 1 - w], [(p.x >= 0 ? 'Left' : 'Right') + 'UpLeg', w]];
    };
    const SK = [[0.3, 0.2, 0.2, 0.2], [0.7, 0.2, 0.19, 0.19], [0.9, 0.186, 0.16, 0.152], [1.04, 0.176, 0.14, 0.13]];
    const strips = (back, n, base, vary, wid, layer, color0) => {
      for (let k = 0; k < n; k++) {
        const hsh = Math.abs(Math.sin(k * 12.9898 + layer * 78.233 + (back ? 3 : 0)) * 43758.5453) % 1;
        const xc = mix(-0.185, 0.185, (k + 0.5) / n), ln = base + vary * hsh, w = wid * (0.85 + 0.3 * hsh), ph = hsh * 6;
        surf(kit, S.cloth, 4, 22, (u, v, out) => {
          const y = mix(1.04 - layer * 0.01, 1.04 - ln, v), tp = 1 - 0.65 * sstep(v, 0.55, 1), xx = xc + (u - 0.5) * w * tp + 0.012 * Math.sin(v * 4 + ph) * v;
          const [rx, zf, zb] = tab(SK, Math.max(0.3, y)), r = back ? zb : zf, ex = Math.min(1, Math.abs(xx) / rx);
          const z = r * Math.sqrt(Math.max(0.15, 1 - ex * ex * 0.9)) + 0.012 + layer * 0.012 + 0.03 * sstep(y, 0.9, 0.55) + 0.014 * Math.sin(y * 9 + ph) * v;
          out.set(xx * (1 + 0.08 * v), y, CUCZ + (back ? -z : z));
        }, { color: hsh > 0.5 ? color0 : col(color0, 0.8).getHex(), ao: 0.3, bind: skirtBind, center: () => V(0, 0.9, back ? 0.4 : -0.4), shade: (p) => 1 - 0.18 * vnoise(p.x * 40, p.y * 10) });
      }
    };
    strips(false, 8, 0.52, 0.2, 0.04, 0, 0x373a3f);
    strips(true, 8, 0.46, 0.22, 0.04, 0, 0x2d3034);
    strips(false, 12, 0.2, 0.1, 0.027, 1, 0x3d4045);   // frayed hip cloth over the thighs
    strips(true, 12, 0.2, 0.1, 0.027, 1, 0x34373c);
  }
  swordAndScabbard(kit, S, { belt: V(0.215, 1.08, 0.0), tip: V(0.29, 0.46, -0.14), bone: 'Hips', grip: 0.1, color: 0x15130f, hiltColor: trimC, cross: 0.2 });

  // ------------------------------------------------------------ legs
  for (const A of SIDES) {
    const s = sgn(A), an = J(A + 'Foot');
    const LC = (y) => legCenter(kit, A, y, new THREE.Vector3());
    const legBand = (y0, y1, extra, o = {}) => band(kit, S.steel, {
      c: (v) => LC(mix(y1, y0, v)), d: V(0, -1, 0), ref: V(0, 0, 1), sgn: s, a0: o.a0 ?? 0, a1: o.a1 ?? TAU, nu: o.nu ?? 32, nv: o.nv ?? 6, n: o.n ?? 2.2,
      rA: (v, a) => { const y = mix(y1, y0, v); return tab(LEG_R, y)[0] + extra(v, a) + (o.zex ?? 0.003); },
      rB: (v, a) => { const y = mix(y1, y0, v); return tab(LEG_R, y)[0] * 0.98 + extra(v, a); },
      color: o.color ?? steelC, ao: 0.3, bind: o.bone, shade: (p, n, u, v) => edgeAO(0.2)(p, n, u, v) * patina()(p, n, u, v),
    });
    const ridge = (a, w = 0.6) => 0.007 * Math.exp(-Math.pow(a / w, 2));
    let B = legBand(0.71, 0.97, (v, a) => 0.012 + ridge(a) - 0.004 * v, { bone: A + 'UpLeg', nv: 8, color: steelC });
    bead(kit, S.steel, B, 1, 0.0035, () => A + 'UpLeg', steel2C);
    B = legBand(0.63, 0.8, (v, a) => 0.014 + ridge(a) - 0.002 * v, { bone: A + 'UpLeg', nv: 6, color: steel2C });
    bead(kit, S.steel, B, 0, 0.0035, () => A + 'UpLeg', steelC); bead(kit, S.steel, B, 1, 0.0035, () => A + 'UpLeg', steelC);
    // poleyn: knee cop with a pointed side wing
    const pol = band(kit, S.steel, {
      c: (v) => LC(mix(0.625, 0.505, v)), d: V(0, -1, 0), ref: V(0, 0, 1), sgn: s, a0: -1.45, a1: 1.45, nu: 36, nv: 14, n: 2,
      rA: (v, a) => 0.07 + 0.036 * Math.sin(Math.PI * Math.pow(v, 0.9)) * Math.exp(-Math.pow(a / 1.2, 2)) + 0.004,
      rB: (v, a) => 0.075 + 0.012 * Math.sin(Math.PI * v) + 0.025 * Math.sin(Math.PI * v) * Math.exp(-Math.pow((a - 0.95) / 0.5, 2)),
      color: steelC, ao: 0.3, bind: A + 'Leg', shade: (p, n, u, v) => (1 - 0.18 * Math.pow(Math.abs(v - 0.5) * 2, 3)) * patina()(p, n, u, v),
    });
    { const c = LC(0.565), b0 = V(c.x, c.y, c.z + 0.095);
      tubeAlong(kit, S.steel, [b0.clone().add(V(0, 0.004, -0.02)), b0, b0.clone().add(V(0, -0.012, 0.062))], (t) => 0.02 * (1 - t) + 0.0008, () => A + 'Leg', { seg: 8, color: steelC, ao: 0.2, up: V(1, 0, 0) }); }
    bead(kit, S.brass, pol, 0.02, 0.0034, () => A + 'Leg', steel2C, { N: 36 }); bead(kit, S.brass, pol, 0.98, 0.0034, () => A + 'Leg', steel2C, { N: 36 });
    legBand(0.585, 0.655, (v, a) => 0.011 + ridge(a, 0.5) * 0.5, { bone: A + 'UpLeg', nv: 3, a0: -1.6, a1: 1.6, nu: 22, color: steel2C });
    // greave with a shin ridge
    B = legBand(0.14, 0.5, (v, a) => 0.009 + 0.01 * Math.exp(-Math.pow(a / 0.35, 2)), { bone: A + 'Leg', nv: 12, nu: 36, color: steelC });
    bead(kit, S.steel, B, 0, 0.0035, () => A + 'Leg', steel2C); bead(kit, S.brass, B, 1, 0.0035, () => A + 'Leg', steel2C);
    for (const y of [0.4, 0.27]) {
      const loop = []; for (let k = 0; k < 28; k++) { const a = (k / 28) * TAU; const r = tab(LEG_R, y)[0] + 0.0145, c = LC(y); loop.push(V(c.x + Math.sin(a) * r, y, c.z + Math.cos(a) * r * 0.98)); }
      strap(kit, S.leather, loop, 0.02, 0.005, () => A + 'Leg', leatherC, { closed: true, vertical: true });
    }
    // sabaton: solid lofted boot with instep ridges
    legBand(0.1, 0.17, () => 0.011, { bone: A + 'Foot', nv: 3, nu: 24, color: steel2C });
    const fx = an.x, TOPY = [[-0.09, 0.1], [0.0, 0.118], [0.08, 0.104], [0.17, 0.072], [0.25, 0.04], [0.3, 0.014]], WID = [[-0.09, 0.034], [-0.03, 0.054], [0.1, 0.056], [0.19, 0.045], [0.26, 0.026], [0.3, 0.006]];
    const shoePt = (u, v, out, off = 0) => {
      const z = mix(-0.09, 0.3, v), top = tab(TOPY, z)[0] + off, w = tab(WID, z)[0] + off, bot = 0.004, mid = (top + bot) / 2, hh = (top - bot) / 2, a = u * TAU;
      out.set(fx + s * 0.005 + w * sp(Math.sin(a), 0.85), mid + hh * sp(Math.cos(a), 0.85), z); return out;
    };
    const sbind = (p) => { const w = sstep(p.z, 0.08, 0.2); return [[A + 'Foot', 1 - w], [A + 'ToeBase', w]]; };
    surf(kit, S.steel, 32, 24, shoePt, { closed: true, color: steelC, ao: 0.3, bind: sbind, center: V(fx, 0.05, 0.1), shade: patina(1.4) });
    for (const z of [0.0, 0.06, 0.12, 0.18]) {
      const v = (z + 0.09) / 0.39, pts = []; for (let i = 0; i <= 14; i++) { const q = V(); shoePt(mix(-0.34, 0.34, i / 14), v, q, 0.003); pts.push(q); }
      tubeAlong(kit, S.brass, pts, 0.0034, sbind, { seg: 6, color: steel2C, ao: 0.12 });
    }
    surf(kit, S.leather, 20, 12, (u, v, out) => {
      const a = (u - 0.5) * TAU * 0.5, z = mix(-0.1, 0.3, v), w = tab([[-0.1, 0.03], [-0.02, 0.05], [0.1, 0.05], [0.18, 0.04], [0.3, 0.004]], z)[0];
      out.set(fx + s * 0.005 + Math.sin(a * 2) * w, mix(0.002, 0.018, Math.abs(Math.cos(a))), z);
    }, { color: 0x14100c, ao: 0.1, bind: A + 'Foot', center: V(fx, 0.06, 0.1) });
  }

  // ------------------------------------------------------------ short tattered cape from the shoulders
  for (let k = 0; k < 9; k++) {
    const hsh = Math.abs(Math.sin(k * 9.31 + 1.7) * 43758.5453) % 1, xc = mix(-0.165, 0.165, (k + 0.5) / 9), ln = 0.44 + 0.14 * hsh, w = 0.05 * (0.9 + 0.3 * hsh), ph = hsh * 6;
    surf(kit, S.cloth, 4, 22, (u, v, out) => {
      const y = mix(1.5, 1.5 - ln, v), tp = 1 - 0.7 * sstep(v, 0.5, 1), xx = xc + (u - 0.5) * w * tp + 0.012 * Math.sin(v * 4 + ph) * v;
      out.set(xx * (1 + 0.12 * v), y, -(0.15 + 0.04 * Math.pow(v, 1.2) + 0.02 * Math.sin(v * 5 + ph) * v + 0.012 * (1 - Math.abs(xx) / 0.17)));
    }, { color: hsh > 0.5 ? 0x2b2d31 : 0x232529, ao: 0.3, bind: (p) => W.torso(Math.max(p.y, 0.95)), center: () => V(0, 1.2, 0.4), shade: (p) => 1 - 0.18 * vnoise(p.x * 40, p.y * 10) });
  }

  return finishKit(kit);
}
