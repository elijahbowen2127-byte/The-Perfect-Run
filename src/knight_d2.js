// Design 2: crusader (c.1230): flat-topped great helm over a mail coif, a long mail hauberk with mittens and chausses,
// a flowing wool surcoat with a painted cross, a leather baldric carrying a kite shield on the back, an arming sword.
import * as THREE from 'three';
import { makeKit, V } from './armor.js';
import { real } from './realmat.js';
import { finishKit, surf, tubeAlong, studs, makeWeights, mailMaterial, dsided, tab, sstep, mix, clamp, sp, TAU, vnoise, decalMaterial } from './knight_kit.js';
import { hideBaseClothes, doublet, armTube, legTube, legCenter, LEG_R } from './knight_body.js';
import { strap, buckle, swordAndScabbard, surfObj, bead, beadU, shoe, mailGlove } from './knight_parts.js';
import { surcoatTexture, shieldTexture } from './knight_heraldry.js';

const col = (c, k) => new THREE.Color(c).multiplyScalar(k);
const SIDES = ['Left', 'Right'];
const sgn = (A) => (A === 'Left' ? 1 : -1);

export function buildKnightD2(scene, skin) {
  const C = { steel: 0xb4bcc6, steel2: 0x8f98a4, mail: 0x6c727c, trim: 0xd9b45a, tabard: 0xefe9da, tabard2: 0xcfc7b4, emblem: 0xb8202a, leather: 0x4a3222, heraldry: 'cross', ...skin };
  hideBaseClothes(scene);
  const steel = real('steel', { rough: 0.58, metal: 0.7 }), brass = real('gilt', { rough: 0.45 });
  const leather = dsided(real('leather', { scale: 3.5, bump: 0.3 })), wool = dsided(real('wool', { scale: 6, bump: 0.25 }));
  const sTex = surcoatTexture(C), shTex = shieldTexture(C);
  const kit = makeKit(scene, [steel, brass, leather, wool, mailMaterial(), decalMaterial('wool', sTex, { scale: 7, bump: 0.22 }), decalMaterial('leather', shTex, { scale: 0.6, bump: 0.25 }), dsided(steel, 'plate2')], 'knight_armor');
  const S = { steel: 0, brass: 1, leather: 2, wool: 3, mail: 4, coat: 5, shield: 6, steel2s: 7 };
  const J = kit.J, W = makeWeights(kit);
  const steelC = col(C.steel, 0.92).getHex(), steel2C = col(C.steel2, 0.95).getHex(), trimC = C.trim, leatherC = col(C.leather, 0.8).getHex();
  const mailC = col(C.mail, 1.75).getHex();
  const patina = (k = 1) => (p, n, u, v) => 1 - 0.09 * k * vnoise(p.x * 22 + p.y * 9, p.z * 22 + p.y * 11) - 0.05 * k * vnoise(p.x * 90, p.y * 60 + p.z * 90);
  const CUCZ = 0.004;

  // bone weights for cloth that hangs from the hips: legs take over below the crotch at the sides
  const skirtBind = (p) => {
    const y = p.y;
    if (y > 1.05) return W.torso(y);
    const w = sstep(y, 1.04, 0.74) * sstep(Math.abs(p.x), 0.0, 0.26);
    const side = p.x >= 0 ? 'Left' : 'Right';
    return w < 0.02 ? [['Hips', 1]] : [['Hips', 1 - w], [side + 'UpLeg', w]];
  };

  // ------------------------------------------------------------ hauberk: mail to the knee, long sleeves, mittens, chausses
  const HB = [[0.6, 0.285, 0.245, 0.225], [0.8, 0.245, 0.205, 0.19], [1.0, 0.208, 0.168, 0.152], [1.1, 0.186, 0.152, 0.136], [1.2, 0.188, 0.152, 0.13], [1.34, 0.2, 0.158, 0.128], [1.43, 0.195, 0.128, 0.118], [1.49, 0.15, 0.1, 0.095], [1.55, 0.1, 0.08, 0.08]];
  const slitW = (y, k = 1) => 0.2 * k * sstep(y, 0.96, 0.62);
  const hemAt = (th) => 0.62 + 0.012 * Math.sin(th * 9) - 0.012 * Math.abs(Math.sin(th * 21));
  // a skirted garment as two smooth halves (left, right) that part at the front and back slits
  const halves = (slot, nu, nv, yTop, hemBase, hemFn, secFn, colorOpt, extra = {}) => {
    const par = (u, v, sign) => {
      const y0 = mix(yTop, hemBase, v), sF = slitW(y0, 1.1), sB = slitW(y0, 0.95);
      const th = sign > 0 ? mix(sF, Math.PI - sB, u) : mix(Math.PI + sB, TAU - sF, u);
      const y = y0 + (hemFn(th) - hemBase) * Math.pow(v, 2);
      return { th, y };
    };
    for (const sign of [1, -1]) {
      surf(kit, slot, nu, nv, (u, v, out) => { const { th, y } = par(u, v, sign); secFn(th, y, out); }, {
        center: V(0, 1.0, 0), bind: skirtBind, ao: 0.22, color: colorOpt, ...extra,
        shade: extra.shadeFn ? (p, n, u, v) => extra.shadeFn(p, n, u, v, par(u, v, sign)) : undefined, uvFn: extra.uvFn });
    }
  };
  halves(S.mail, 60, 60, 1.545, 0.62, hemAt, (th, y, out) => {
    const [rx, zf, zb] = tab(HB, y), e = 2 / 2.5, s = Math.sin(th), c = Math.cos(th), k = 1 + 0.02 * Math.sin(th * 11 + y * 9) * sstep(y, 1.0, 0.65);
    out.set(rx * k * sp(s, e), y, CUCZ + (c >= 0 ? zf : zb) * k * sp(c, e));
  }, mailC);
  for (const A of SIDES) {
    armTube(kit, S.mail, A, { color: mailC, thick: (d, a) => 0.009 + 0.0022 * Math.sin(d * 48 + a * 2) * sstep(d, 0.2, 0.4) * (1 - sstep(d, 0.6, 0.7)), radii: [[0.1, 0.082], [0.166, 0.082], [0.3, 0.072], [0.451, 0.063], [0.52, 0.06], [0.62, 0.052], [0.715, 0.043]] });
    legTube(kit, S.mail, A, { color: mailC, y1: 1.0, thick: 0.006 });
    mailGlove(kit, S.mail, A, mailC);
    // leather garter under the knee, shoe and spur
    const LC = (y) => legCenter(kit, A, y, new THREE.Vector3());
    for (const y of [0.52]) {
      const loop = []; for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; const r = tab(LEG_R, y)[0] + 0.011, c = LC(y); loop.push(V(c.x + Math.sin(a) * r, y, c.z + Math.cos(a) * r * 1.02)); }
      strap(kit, S.leather, loop, 0.026, 0.005, () => A + 'Leg', leatherC, { closed: true, vertical: true });
    }
    shoe(kit, S, A, { color: col(C.leather, 0.55).getHex(), top: 0.26 });
    const an = J(A + 'Foot'), s = sgn(A);
    { const arc = []; for (let k = 0; k <= 14; k++) { const a = mix(-1.5, 1.5, k / 14); arc.push(V(an.x + s * 0.004 + Math.sin(a) * 0.052, 0.05 + 0.02 * Math.cos(a) * 0 + 0.002 * Math.cos(a), -0.076 - Math.abs(Math.cos(a)) * 0.0 - 0.02 * Math.cos(a) * 0 + (1 - Math.cos(a)) * 0.0)); }
      tubeAlong(kit, S.brass, arc.map((p, i) => p), 0.0028, () => A + 'Foot', { seg: 6, color: trimC, ao: 0.1, up: V(0, 1, 0) });
      tubeAlong(kit, S.brass, [V(an.x + s * 0.004, 0.058, -0.1), V(an.x + s * 0.004, 0.056, -0.135), V(an.x + s * 0.004, 0.07, -0.16)], [0.004, 0.0035, 0.003], () => A + 'Foot', { seg: 6, color: trimC, ao: 0.1, up: V(1, 0, 0) });
      studs(kit, S.brass, A + 'Foot', [{ p: V(an.x + s * 0.004, 0.07, -0.166), n: V(0, 0, -1), r: 0.011 }], 0.011, trimC, { flat: 0.25 });
    }
  }

  // ------------------------------------------------------------ coif cape over the shoulders and the great helm
  {
    const CP = [[1.36, 0.19, 0.14, 0.13], [1.42, 0.18, 0.122, 0.118], [1.47, 0.15, 0.104, 0.105], [1.52, 0.118, 0.092, 0.1], [1.56, 0.105, 0.095, 0.1], [1.6, 0.1, 0.095, 0.1]];
    surf(kit, S.mail, 96, 24, (u, v, out) => {
      const th = u * TAU, y = mix(1.6, 1.37 - 0.02 * Math.pow(Math.sin(th), 2) - 0.008 * Math.abs(Math.sin(th * 24)), v), [rx, zf, zb] = tab(CP, y), e = 2 / 2.3, s = Math.sin(th), c = Math.cos(th);
      const k = 1 + 0.03 * Math.sin(th * 13 + v * 5) * v;
      out.set(rx * k * sp(s, e), y, 0.01 + (c >= 0 ? zf : zb) * k * sp(c, e));
    }, { closed: true, color: mailC, ao: 0.25, bind: (p) => W.torso(Math.min(p.y, 1.5)) });
  }

  // ------------------------------------------------------------ great helm: riveted flat-topped cylinder with cross slits
  {
    const y0 = 1.545, y1 = 1.915, gz = 0.026;
    const GR = [[1.545, 0.137, 0.168, 0.145], [1.62, 0.132, 0.172, 0.146], [1.72, 0.127, 0.174, 0.146], [1.82, 0.121, 0.168, 0.14], [1.9, 0.115, 0.158, 0.132], [1.915, 0.112, 0.154, 0.128]];
    const secAt = (th, y, off = 0) => {
      const [rx, zf, zb] = tab(GR, y), e = 2 / 2.5, s = Math.sin(th), c = Math.cos(th);
      // the face is a slightly proud plate, riveted over the sides
      const plate = c > 0 ? 0.01 * Math.exp(-Math.pow(th / 0.75, 2)) : 0;
      return V((rx + off) * sp(s, e) + off * 0, y, gz + (c >= 0 ? (zf + plate + off) * sp(c, e) : (zb + off) * sp(c, e)));
    };
    const hp = (u, v, out) => out.copy(secAt(u * TAU, mix(y0, y1, v)));
    surf(kit, S.steel, 96, 40, hp, { closed: true, color: steelC, ao: 0.3, bind: 'Head', shade: patina(1.2) });
    // domed top plate
    surf(kit, S.steel, 96, 8, (u, v, out) => {
      const th = u * TAU, r = 1 - v * 0.999, p = secAt(th, y1);
      out.set(p.x * r, y1 + 0.016 * (1 - r * r) + 0.0 , gz + (p.z - gz) * r);
    }, { closed: true, color: steelC, ao: 0.3, bind: 'Head', center: V(0, y1 - 0.1, gz), shade: patina(1.2) });
    // rolled rim round the top and a flared lip at the foot
    const ring = (y, off, r, color, slot = S.steel) => { const pts = []; for (let i = 0; i < 96; i++) pts.push(secAt((i / 96) * TAU, y, off)); tubeAlong(kit, slot, pts, r, () => 'Head', { closed: true, seg: 7, color, ao: 0.12 }); };
    ring(y1 + 0.001, 0.001, 0.0048, steel2C); ring(y0 + 0.002, 0.002, 0.0055, steel2C); ring(1.805, 0.003, 0.0045, steel2C); ring(1.628, 0.003, 0.0045, steel2C);
    // reinforcing strips: a vertical bar down the face and the cross-bar above the eye slit
    const strip = (th0, th1, ya, yb, off, color) => surf(kit, S.steel2s, 4, 24, (u, v, out) => out.copy(secAt(mix(th0, th1, u), mix(ya, yb, v), off)), { color, ao: 0.3, bind: 'Head', center: V(0, 1.72, gz), shade: patina(0.8) });
    strip(-0.1, 0.1, y0 + 0.012, y1 - 0.004, 0.0035, steel2C);
    strip(-0.95, 0.95, 1.739, 1.756, 0.0035, steel2C);
    strip(-0.95, 0.95, 1.69, 1.703, 0.0035, steel2C);
    // rivet rows
    const rv = []; for (let i = -10; i <= 10; i++) { const th = i * 0.088; const p = secAt(th, 1.747, 0.0045); rv.push({ p, n: V(Math.sin(th), 0, Math.cos(th)) }); const q = secAt(th, 1.696, 0.0045); rv.push({ p: q, n: V(Math.sin(th), 0, Math.cos(th)) }); }
    for (let j = 0; j < 12; j++) { const y = mix(1.57, 1.9, j / 11); if (y > 1.69 && y < 1.76) continue; rv.push({ p: secAt(0.045, y, 0.0045), n: V(0.2, 0, 1) }); rv.push({ p: secAt(-0.045, y, 0.0045), n: V(-0.2, 0, 1) }); }
    studs(kit, S.steel, 'Head', rv, 0.0034, steel2C);
    // eye slit and breathing slit (sunk dark), breaths on the left cheek
    const dark = 0x07070a;
    { const pts = []; for (let i = -11; i <= 11; i++) pts.push(secAt(i * 0.036, 1.722, 0.001)); tubeAlong(kit, S.leather, pts, (t) => [0.0036 * (0.4 + Math.sin(t * Math.PI) ** 0.4), 0.0045], () => 'Head', { seg: 6, color: dark, ao: 0, up: V(0, 1, 0) }); }
    { const pts = []; for (let j = 0; j <= 10; j++) pts.push(secAt(0.0, mix(1.585, 1.68, j / 10), 0.001)); tubeAlong(kit, S.leather, pts, [0.0034, 0.0045], () => 'Head', { seg: 6, color: dark, ao: 0, up: V(1, 0, 0) }); }
    const hol = []; for (let r = 0; r < 5; r++) for (let k = 0; k < 4 - (r > 2 ? 1 : 0); k++) { const th = 0.2 + k * 0.1, y = 1.665 - r * 0.021, p = secAt(th, y, 0.002); hol.push({ p, n: V(Math.sin(th), 0, Math.cos(th)), r: 0.0037 }); }
    studs(kit, S.leather, 'Head', hol, 0.0035, dark, { flat: 0.3, ao: 0 });
    // a leather chin strap's buckle at each cheek and the padded foot ring
    ring(y0 - 0.004, 0.003, 0.0045, leatherC, S.leather);
  }

  // ------------------------------------------------------------ surcoat: long wool, belted, painted cross
  {
    const SC = [[0.44, 0.38, 0.3, 0.28], [0.6, 0.35, 0.28, 0.26], [0.8, 0.3, 0.24, 0.22], [1.0, 0.25, 0.2, 0.175], [1.09, 0.205, 0.172, 0.15], [1.16, 0.226, 0.178, 0.152], [1.28, 0.228, 0.19, 0.152], [1.38, 0.235, 0.186, 0.146], [1.46, 0.23, 0.158, 0.132], [1.495, 0.15, 0.11, 0.105]];
    const hemY = (th) => 0.43 + 0.018 * Math.sin(th * 5 + 1) + 0.01 * Math.sin(th * 11);
    const foldAt = (th0, y) => {
      const th = th0;
      const below = sstep(y, 1.08, 0.5), above = sstep(y, 1.1, 1.3) * (1 - sstep(y, 1.38, 1.46));
      const swirl = Math.sin(y * 3.1 + 0.6) * 0.7 + Math.sin(y * 7.3) * 0.2;
      const pl = (k, ph) => { const q = Math.sin(k * th * 0.5 + ph); return 1 - 2 * Math.pow(Math.abs(q), 0.8); };
      const waist = sstep(y, 1.0, 1.1) * (1 - sstep(y, 1.14, 1.3));
      return (0.004 + 0.05 * below) * (0.6 * pl(14, 1.4 * swirl) + 0.4 * pl(26, 2.1 + 2 * swirl) + 0.2 * Math.sin(23 * th + y * 11)) + 0.0055 * above * Math.sin(9 * th + y * 20) + 0.006 * waist * Math.sin(17 * th + y * 60);
    };
    halves(S.coat, 80, 100, 1.495, 0.43, hemY, (th, y, out) => {
      const [rx, zf, zb] = tab(SC, y), e = 2 / 2.4, s = Math.sin(th), c = Math.cos(th);
      const flow = 0.012 * Math.sin(th * 2 + 0.5) * sstep(y, 1.08, 0.5);
      const k = 1 + (foldAt(th, y) + flow) / 0.3;
      out.set(rx * k * sp(s, e), y, CUCZ + (c >= 0 ? zf : zb) * k * sp(c, e));
    }, 0xffffff, {
      uvFn: (p) => [p.z > CUCZ ? 0.5 + p.x * 0.8 : 1.0 - p.x * 0.8, (p.y - 0.43) / (1.495 - 0.43)],
      shadeFn: (p, n, u, v, q) => clamp(0.9 + 5.5 * foldAt(q.th, q.y), 0.55, 1.12) * (1 - 0.07 * vnoise(p.x * 26, p.y * 9 + p.z * 20)),
    });
    // belt cinching the coat at the waist, buckle and the hanging tail
    const belt = []; for (let i = 0; i < 80; i++) { const th = (i / 80) * TAU, [rx, zf, zb] = tab(SC, 1.1), s = Math.sin(th), c = Math.cos(th), e = 2 / 2.4; belt.push(V((rx + 0.011) * sp(s, e), 1.1 + 0.01 * Math.cos(th) * 0, CUCZ + (c >= 0 ? zf + 0.011 : zb + 0.011) * sp(c, e))); }
    strap(kit, S.leather, belt, 0.042, 0.007, () => 'Spine', col(C.leather, 0.7).getHex(), { closed: true, vertical: true });
    buckle(kit, S.brass, 'Spine', V(0, 1.1, CUCZ + 0.19), V(0, 0, 1), V(0, 1, 0), 0.016, 0.017, trimC);
    strap(kit, S.leather, [V(0.012, 1.09, 0.201), V(0.02, 1.02, 0.206), V(0.024, 0.95, 0.206), V(0.026, 0.9, 0.203)], 0.034, 0.006, () => 'Hips', col(C.leather, 0.7).getHex(), { vertical: false });
    tubeAlong(kit, S.brass, [V(0.026, 0.91, 0.205), V(0.026, 0.885, 0.205)], [0.017, 0.004], () => 'Hips', { seg: 6, n: 4, color: trimC, ao: 0.1, up: V(0, 0, 1) });
    swordAndScabbard(kit, S, { belt: V(0.215, 1.095, 0.03), tip: V(0.375, 0.46, -0.1), bone: 'Hips', grip: 0.11, color: 0x30221a, hiltColor: trimC, cross: 0.21 });
    strap(kit, S.leather, [V(0.2, 1.11, 0.04), V(0.226, 1.07, 0.03), V(0.236, 1.03, 0.03)], 0.022, 0.005, () => 'Hips', col(C.leather, 0.7).getHex());
  }

  // ------------------------------------------------------------ kite shield on the back, hung from a baldric across the chest
  {
    const yT = 1.5, yB = 0.62, HW = 0.255;
    const half = (t) => HW * Math.pow(1 - t, 0.78) * Math.min(1, Math.sqrt(Math.max(0, t) / 0.12 + 0.02));
    const R = 0.55;
    const shPt = (u, v, out) => {
      const t = v, x = (u - 0.5) * 2 * half(t), y = mix(yT, yB, t), tilt = 0.12 * t;
      out.set(x, y - 0.02 * 0, -0.232 - 0.07 * t + (x * x) / (2 * R) - 0.0 - tilt * 0 + 0.0);
    };
    surf(kit, S.shield, 28, 40, shPt, { uvFn: (p) => [p.x / (2 * HW) + 0.5, (p.y - yB) / (yT - yB) * 0.98 + 0.01], color: 0xffffff, ao: 0.2, bind: 'Spine2', center: V(0, 1.0, 0.3), shade: (p, n, u, v) => 1 - 0.08 * vnoise(p.x * 30, p.y * 30) });
    // iron-bound rim (a rolled edge) and rivets
    const rim = []; for (let i = 0; i <= 56; i++) {
      const w = i / 56, a = w < 0.5 ? 0 : 1; let u, v;
      if (w < 0.5) { v = w * 2; u = 1; } else { v = 1 - (w - 0.5) * 2; u = 0; }
      const p = V(); shPt(u, v, p); rim.push(p);
    }
    tubeAlong(kit, S.steel, rim, 0.0055, () => 'Spine2', { seg: 7, color: steel2C, ao: 0.15, up: V(0, 0, 1) });
    const top = []; for (let i = 0; i <= 24; i++) { const p = V(); shPt(i / 24, 0, p); top.push(p); }
    tubeAlong(kit, S.steel, top, 0.0055, () => 'Spine2', { seg: 7, color: steel2C, ao: 0.15, up: V(0, 0, 1) });
    const rv = rim.filter((_, i) => i % 3 === 0).map((p) => ({ p: p.clone().add(V(0, 0, -0.002)), n: V(0, 0, -1) })); studs(kit, S.steel, 'Spine2', rv, 0.0032, steelC);
    // guige: the strap over the right shoulder, across the chest to the left hip and back to the shield
    const pts = [V(-0.2, 1.46, -0.2), V(-0.18, 1.52, -0.1), V(-0.13, 1.545, -0.02), V(-0.1, 1.51, 0.09), V(-0.04, 1.38, 0.205), V(0.06, 1.24, 0.225), V(0.15, 1.14, 0.215), V(0.225, 1.08, 0.13), V(0.25, 1.07, 0.0), V(0.24, 1.09, -0.12), V(0.2, 1.16, -0.2)];
    const cur = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const sp2 = cur.getPoints(60);
    strap(kit, S.leather, sp2, 0.04, 0.007, () => 'Spine2', col(C.leather, 0.85).getHex(), { vertical: false, up: V(0, 1, 0) });
    studs(kit, S.brass, 'Spine2', [0.28, 0.38, 0.5, 0.62].map((t) => ({ p: cur.getPoint(t).add(V(0, 0.0, 0.0)), n: V(0, 0, 1) })), 0.004, trimC);
  }

  return finishKit(kit);
}
