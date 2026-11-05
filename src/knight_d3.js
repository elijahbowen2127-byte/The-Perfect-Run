// Design 3: battle-worn man-at-arms (c.1470): open sallet with a flared tail over a short mail camail, a cloth-covered
// brigandine studded with brass rivets, mail sleeves with leather cuffs, wool hose, turned-cuff boots, a wide belt
// carrying sword, rondel dagger and pouch. Earthy, scuffed, no heraldry.
import * as THREE from 'three';
import { makeKit, V } from './armor.js';
import { real } from './realmat.js';
import { finishKit, surf, tubeAlong, studs, makeWeights, mailMaterial, dsided, tab, sstep, mix, clamp, sp, TAU, vnoise } from './knight_kit.js';
import { hideBaseClothes, doublet, neckBand, armTube, legTube, legCenter, LEG_R } from './knight_body.js';
import { strap, buckle, swordAndScabbard, shoe } from './knight_parts.js';

const col = (c, k) => new THREE.Color(c).multiplyScalar(k);
const SIDES = ['Left', 'Right'];
const sgn = (A) => (A === 'Left' ? 1 : -1);

export function buildKnightD3(scene, skin) {
  const C = { steel: 0xb4bcc6, steel2: 0x8f98a4, mail: 0x6c727c, trim: 0xd9b45a, tabard: 0xefe9da, tabard2: 0xcfc7b4, emblem: 0xb8202a, leather: 0x4a3222, ...skin };
  hideBaseClothes(scene);
  const steel = real('steel', { rough: 0.68, metal: 0.62 }), brass = real('gilt', { rough: 0.5 });
  const leather = dsided(real('leather', { scale: 3.5, bump: 0.3 })), cloth = dsided(real('cloth', { scale: 8, bump: 0.3 })), wool = dsided(real('wool', { scale: 6, bump: 0.28 }));
  const kit = makeKit(scene, [steel, brass, leather, cloth, wool, mailMaterial(), dsided(steel, 'plate2')], 'knight_armor');
  const S = { steel: 0, brass: 1, leather: 2, cloth: 3, wool: 4, mail: 5, steel2s: 6 };
  const J = kit.J, W = makeWeights(kit);
  const steelC = col(C.steel, 0.78).getHex(), steel2C = col(C.steel2, 0.8).getHex(), trimC = col(C.trim, 0.85).getHex(), leatherC = col(C.leather, 0.85).getHex();
  const mailC = col(C.mail, 1.55).getHex();
  const brigC = col(C.emblem, 0.17).getHex(), tunicC = col(C.tabard2, 0.2).getHex(), hoseC = col(C.tabard2, 0.3).getHex();
  const patina = (k = 1) => (p, n, u, v) => 1 - 0.13 * k * vnoise(p.x * 22 + p.y * 9, p.z * 22 + p.y * 11) - 0.08 * k * vnoise(p.x * 90, p.y * 60 + p.z * 90);
  const CUCZ = 0.004;
  const skirtBind = (p) => {
    const y = p.y;
    if (y > 1.05) return W.torso(y);
    const w = sstep(y, 1.04, 0.74) * sstep(Math.abs(p.x), 0.0, 0.26);
    const side = p.x >= 0 ? 'Left' : 'Right';
    return w < 0.02 ? [['Hips', 1]] : [['Hips', 1 - w], [side + 'UpLeg', w]];
  };

  // ------------------------------------------------------------ under-layers: wool tunic, mail sleeves, wool hose
  doublet(kit, S.wool, { color: tunicC, quilt: 0.002, y0: 0.9 });
  neckBand(kit, S.wool, col(C.tabard2, 0.5).getHex());
  for (const A of SIDES) {
    armTube(kit, S.mail, A, { color: mailC, thick: (d, a) => 0.005 + 0.002 * Math.sin(d * 40 + a * 2) * sstep(d, 0.25, 0.4) * (1 - sstep(d, 0.55, 0.66)) });
    legTube(kit, S.wool, A, { color: hoseC, y1: 1.0, wrinkle: (y, a) => 0.0016 * Math.sin(y * 60 + a * 3) * sstep(y, 0.28, 0.5) });
  }

  // ------------------------------------------------------------ brigandine: cloth-covered plates with brass rivets
  const BR = [[0.98, 0.186, 0.142, 0.13], [1.08, 0.18, 0.136, 0.124], [1.16, 0.174, 0.132, 0.12], [1.26, 0.186, 0.14, 0.12], [1.36, 0.2, 0.155, 0.122], [1.43, 0.2, 0.138, 0.114], [1.47, 0.172, 0.11, 0.1], [1.5, 0.14, 0.092, 0.09]];
  const topAt = (th) => tab([[0, 1.485], [0.5, 1.49], [0.9, 1.49], [1.3, 1.51], [1.7, 1.52], [2.4, 1.51], [3.15, 1.5]], th)[0];
  const bp = (th, y, out, off = 0) => {
    const [rx, zf, zb] = tab(BR, y), e = 2 / 2.6, s = Math.sin(th), c = Math.cos(th);
    const bulge = 1 + 0.012 * Math.sin(th * 17 + y * 40) * 0;
    out.set((rx + off) * sp(s, e), y, CUCZ + (c >= 0 ? zf + off : zb + off) * sp(c, e));
    return out;
  };
  const PW = 0.19;   // plate width (radians)
  const plateShade = (th, y) => {
    const f = ((th / PW) % 1 + 1) % 1, r = (((y - 0.98) / 0.075) % 1 + 1) % 1;
    return 1 - 0.3 * sstep(f, 0.82, 1.0) - 0.3 * sstep(r, 0.8, 1.0) - 0.15 * (1 - sstep(r, 0, 0.15));
  };
  surf(kit, S.cloth, 120, 40, (u, v, out) => { const th = u * TAU, thf = th > Math.PI ? TAU - th : th; bp(th, mix(0.98, topAt(thf), v), out, 0.006); }, {
    closed: true, color: brigC, ao: 0.28, bind: (p) => W.torso(p.y),
    shade: (p, n, u, v) => { const th = Math.atan2(p.x, p.z - CUCZ); return plateShade(th, p.y) * (1 - 0.14 * vnoise(p.x * 30, p.y * 22 + p.z * 30)); },
  });
  {
    const rows = [], rowsU = [];
    for (let r = 0; r < 13; r++) {
      const y = 1.0 + r * 0.0375 + 0.014; if (y > 1.45) continue;
      for (let k = 0; k < Math.round(TAU / PW); k++) {
        const th = (k + 0.5 + (r % 2) * 0.0) * PW; if (th > TAU - 0.05) continue;
        const p = bp(th, y, V(), 0.0075), n = V(Math.sin(th), 0, Math.cos(th));
        (y > 1.2 ? rows : rowsU).push({ p, n });
      }
    }
    studs(kit, S.brass, 'Spine1', rows, 0.0032, trimC); studs(kit, S.brass, 'Spine', rowsU, 0.0032, trimC);
    // leather binding on the neck edge and the hem
    const hem = []; for (let i = 0; i < 80; i++) hem.push(bp((i / 80) * TAU, 0.98, V(), 0.009));
    tubeAlong(kit, S.leather, hem, [0.006, 0.006], () => 'Spine', { closed: true, seg: 7, color: leatherC, ao: 0.12 });
    const neck = []; for (let i = 0; i < 80; i++) { const th = (i / 80) * TAU, thf = th > Math.PI ? TAU - th : th; neck.push(bp(th, topAt(thf) - 0.004, V(), 0.009)); }
    tubeAlong(kit, S.leather, neck, [0.006, 0.006], () => 'Spine2', { closed: true, seg: 7, color: leatherC, ao: 0.12 });
    // buckled side closure on the left
    for (const y of [1.1, 1.22, 1.34]) {
      const a = bp(1.45, y, V(), 0.012), b = bp(1.8, y, V(), 0.012);
      strap(kit, S.leather, [a, a.clone().lerp(b, 0.5).add(V(0.004, 0, 0)), b], 0.022, 0.004, () => 'Spine1', leatherC, { vertical: true });
      buckle(kit, S.brass, 'Spine1', a.clone().lerp(b, 0.3), V(1, 0, 0.1).normalize(), V(0, 1, 0), 0.011, 0.014, trimC);
    }
    // shoulder straps with buckles
    for (const s of [1, -1]) {
      const pts = [V(s * 0.1, 1.5, 0.095), V(s * 0.145, 1.512, 0.04), V(s * 0.16, 1.5, -0.03), V(s * 0.115, 1.49, -0.095)];
      strap(kit, S.leather, pts, 0.03, 0.006, () => 'Spine2', leatherC, { vertical: false, up: V(0, 1, 0) });
      buckle(kit, S.brass, 'Spine2', V(s * 0.145, 1.516, 0.04), V(0, 1, 0), V(0, 0, 1), 0.013, 0.015, trimC);
    }
  }
  // fauld: short leather-and-cloth skirt with plate lines, slit at front and back
  {
    const SK = [[0.74, 0.27, 0.22, 0.2], [0.8, 0.262, 0.215, 0.195], [0.9, 0.24, 0.19, 0.172], [1.0, 0.205, 0.158, 0.14], [1.04, 0.19, 0.146, 0.132]];
    const slitW = (y) => 0.12 * sstep(y, 0.96, 0.82);
    const hemY = (th) => 0.75 + 0.008 * Math.sin(th * 14) - 0.01 * Math.abs(Math.sin(th * 24));
    for (const sign of [1, -1]) {
      const par = (u, v) => {
        const y0 = mix(1.0, 0.75, v), sF = slitW(y0) + 0.05, sB = slitW(y0) + 0.05;
        const th = sign > 0 ? mix(sF, Math.PI - sB, u) : mix(Math.PI + sB, TAU - sF, u);
        return { th, y: y0 + (hemY(th) - 0.75) * Math.pow(v, 2) };
      };
      surf(kit, S.cloth, 50, 20, (u, v, out) => {
        const { th, y } = par(u, v), [rx, zf, zb] = tab(SK, y), e = 2 / 2.5, s = Math.sin(th), c = Math.cos(th);
        const k = 1 + 0.012 * Math.sin(th * 15 + y * 7) * sstep(y, 0.95, 0.75);
        out.set(rx * k * sp(s, e), y, CUCZ + (c >= 0 ? zf : zb) * k * sp(c, e));
      }, { center: V(0, 1.0, 0), bind: skirtBind, color: brigC, ao: 0.22, shade: (p, n, u, v) => { const q = par(u, v); return plateShade(q.th * 1.0, q.y * 1.0) * (1 - 0.14 * vnoise(p.x * 30, p.y * 22 + p.z * 30)); } });
    }
  }
  // belt, buckle, dagger, sword, pouch
  {
    const belt = []; for (let i = 0; i < 80; i++) { const th = (i / 80) * TAU; const p = bp(th, 1.0, V(), 0.012); p.y += 0.003 * Math.cos(th); belt.push(p); }
    strap(kit, S.leather, belt, 0.05, 0.007, () => 'Spine', col(C.leather, 0.75).getHex(), { closed: true, vertical: true });
    buckle(kit, S.brass, 'Spine', bp(0, 1.0, V(), 0.02), V(0, 0, 1), V(0, 1, 0), 0.02, 0.02, trimC);
    strap(kit, S.leather, [V(0.02, 0.995, 0.17), V(0.03, 0.92, 0.175), V(0.032, 0.86, 0.172)], 0.03, 0.005, () => 'Hips', leatherC, { vertical: false });
    swordAndScabbard(kit, S, { belt: V(0.2, 1.0, 0.03), tip: V(0.34, 0.4, -0.12), bone: 'Hips', grip: 0.115, color: 0x2a1e16, hiltColor: trimC, cross: 0.2 });
    strap(kit, S.leather, [V(0.19, 1.01, 0.03), V(0.205, 0.95, 0.03), V(0.22, 0.9, 0.03)], 0.022, 0.005, () => 'Hips', leatherC, { vertical: false });
    swordAndScabbard(kit, S, { belt: V(-0.17, 0.99, 0.14), tip: V(-0.22, 0.75, 0.18), bone: 'Hips', grip: 0.075, wide: 0.036, thick: 0.02, color: 0x2a1e16, hiltColor: trimC, cross: 0.08 });
    // belt pouch at the back right hip
    surf(kit, S.leather, 20, 12, (u, v, out) => {
      const a = u * TAU, h = mix(0, 1, v), r = 0.07 * (1 - 0.35 * h);
      out.set(-0.2 + Math.sin(a) * 0.03 * (1 - 0.3 * h) , 0.99 - 0.13 * h + 0.0, -0.1 + Math.cos(a) * r - 0.0);
    }, { closed: true, color: leatherC, ao: 0.25, bind: 'Hips', center: V(-0.2, 0.9, -0.1), shade: (p) => 1 - 0.12 * vnoise(p.x * 40, p.y * 40) });
  }

  // ------------------------------------------------------------ shoulders, bracers, boots
  for (const A of SIDES) {
    const s = sgn(A), sh = J(A + 'Arm');
    // leather-and-steel shoulder cap with rivets
    surf(kit, S.leather, 28, 12, (u, v, out) => {
      const a = u * TAU, t = v * 1.3, r = 0.093;
      out.set(sh.x + s * 0.02 + Math.sin(t) * Math.cos(a) * r * 1.0, sh.y + 0.004 + Math.cos(t) * r * 0.92, sh.z + Math.sin(t) * Math.sin(a) * r * 1.02);
    }, { closed: true, color: col(C.leather, 0.9).getHex(), ao: 0.3, bind: (p) => W.arm(A, p), center: V(sh.x + s * 0.02, sh.y - 0.02, sh.z), shade: (p) => 1 - 0.14 * vnoise(p.x * 40, p.y * 40 + p.z * 40) });
    // wool/leather cuff and bracer on the forearm
    const wr = J(A + 'Hand'), el = J(A + 'ForeArm');
    for (const [x0, x1] of [[0.6, 0.7]]) {
      surf(kit, S.leather, 24, 8, (u, v, out) => {
        const d = mix(x0, x1, v), t = (d - Math.abs(el.x)) / (Math.abs(wr.x) - Math.abs(el.x)), c = el.clone().lerp(wr, t), a = u * TAU;
        const r = 0.055 - 0.011 * (d - 0.451) / 0.26 + 0.004 * Math.pow(Math.abs(v - 0.5) * 2, 4) * 0.3;
        out.set(s * d, c.y + Math.cos(a) * (r + 0.003), c.z + Math.sin(a) * (r + 0.003) * 1.02);
      }, { closed: true, color: leatherC, ao: 0.2, bind: (p) => W.arm(A, p), shade: (p) => 1 - 0.12 * vnoise(p.x * 40, p.y * 40 + p.z * 40) });
    }
    const LC = (y) => legCenter(kit, A, y, new THREE.Vector3());
    // boots with turned cuff and a leg garter
    shoe(kit, S, A, { color: col(C.leather, 0.6).getHex(), top: 0.4 });
    { const loop = []; for (let k = 0; k < 28; k++) { const a = (k / 28) * TAU, c = LC(0.4), r = 0.071; loop.push(V(c.x + Math.sin(a) * r, 0.4, c.z + Math.cos(a) * r * 1.03)); }
      strap(kit, S.leather, loop, 0.034, 0.006, () => A + 'Leg', col(C.leather, 0.7).getHex(), { closed: true, vertical: true }); }
    { const loop = []; for (let k = 0; k < 28; k++) { const a = (k / 28) * TAU, c = LC(0.545), r = 0.077; loop.push(V(c.x + Math.sin(a) * r, 0.545, c.z + Math.cos(a) * r * 1.03)); }
      strap(kit, S.leather, loop, 0.022, 0.005, () => A + 'Leg', leatherC, { closed: true, vertical: true });
      buckle(kit, S.brass, A + 'Leg', V(LC(0.545).x + 0.0, 0.545, LC(0.545).z + 0.08), V(0, 0, 1), V(0, 1, 0), 0.011, 0.012, trimC); }
  }

  // ------------------------------------------------------------ camail over the shoulders
  {
    const CP = [[1.36, 0.19, 0.14, 0.13], [1.42, 0.18, 0.122, 0.118], [1.47, 0.15, 0.104, 0.105], [1.52, 0.118, 0.092, 0.1], [1.56, 0.1, 0.09, 0.098], [1.6, 0.098, 0.092, 0.098]];
    surf(kit, S.mail, 96, 22, (u, v, out) => {
      const th = u * TAU, y = mix(1.6, 1.39 - 0.03 * Math.pow(Math.sin(th), 2) - 0.008 * Math.abs(Math.sin(th * 24)), v), [rx, zf, zb] = tab(CP, y), e = 2 / 2.3, s = Math.sin(th), c = Math.cos(th);
      const k = 1 + 0.03 * Math.sin(th * 13 + v * 5) * v;
      out.set(rx * k * sp(s, e), y, 0.01 + (c >= 0 ? zf : zb) * k * sp(c, e));
    }, { closed: true, color: mailC, ao: 0.25, bind: (p) => W.torso(Math.min(p.y, 1.5)) });
  }

  // ------------------------------------------------------------ open sallet: rounded skull, brow, long flared tail, face open
  {
    const HC = (y) => 0.03 - 0.03 * sstep(y, 1.84, 1.96);
    const HR = [[1.5, 0.1, 0.1, 0.17], [1.56, 0.102, 0.106, 0.178], [1.62, 0.108, 0.115, 0.158], [1.7, 0.113, 0.134, 0.136], [1.78, 0.114, 0.146, 0.126], [1.84, 0.11, 0.14, 0.12], [1.89, 0.1, 0.126, 0.11], [1.925, 0.08, 0.1, 0.088], [1.95, 0.05, 0.062, 0.058], [1.962, 0.02, 0.026, 0.026], [1.97, 0.003, 0.005, 0.006]];
    const helmBot = (thf) => tab([[0, 1.775], [0.45, 1.765], [0.8, 1.69], [1.1, 1.64], [1.5, 1.6], [2.0, 1.56], [2.6, 1.52], [3.15, 1.49]], thf)[0];
    const helmPt = (u, v, out) => {
      const th = u * TAU, thf = th > Math.PI ? TAU - th : th;
      const y = mix(helmBot(thf), 1.97, Math.pow(v, 0.92));
      const [rx, zf, zb] = tab(HR, y), e = 2 / 2.3, s = Math.sin(th), c = Math.cos(th);
      out.set(rx * sp(s, e), y, HC(y) + (c >= 0 ? zf * sp(c, e) : zb * sp(c, e)));
    };
    surf(kit, S.steel, 80, 32, helmPt, { closed: true, color: steelC, ao: 0.3, bind: 'Head', shade: patina(1.5) });
    const rim = []; for (let i = 0; i < 96; i++) { const p = V(); helmPt(i / 96, 0, p); rim.push(p); }
    tubeAlong(kit, S.steel, rim, 0.0042, () => 'Head', { closed: true, seg: 7, color: steel2C, ao: 0.12 });
    // comb ridge front to back
    const comb = []; for (let i = 0; i <= 40; i++) { const th = mix(0, Math.PI, i / 40), p = V(); const u = th / TAU; helmPt(u, 0.55 + 0.45 * 0 + (i / 40) * 0.0, p); comb.push(p); }
    const ridge = []; for (let i = 0; i <= 50; i++) { const a = (i / 50) * Math.PI; const y = 1.965 * 0 + mix(1.9, 1.9, 0) ; const th = a; const q = V(); const vv = 0.995; helmPt(0.0, vv, q); ridge.push(q); }
    const rv = []; for (let i = 0; i < 48; i += 2) { const p = rim[i].clone(); p.y += 0.018; rv.push({ p, n: V(p.x, 0, p.z - HC(p.y)).normalize() }); }
    studs(kit, S.brass, 'Head', rv, 0.0028, trimC);
    // brow reinforcement: a thin proud band across the front
    const fr = []; for (let i = 0; i <= 36; i++) { const u = mix(-0.2, 0.2, i / 36); const p = V(); helmPt(((u % 1) + 1) % 1, 0.02, p); fr.push(p); }
    tubeAlong(kit, S.steel, fr, 0.0042, () => 'Head', { seg: 7, color: steel2C, ao: 0.12 });
    // chin strap
    const sp3 = [V(0.108, 1.69, 0.025), V(0.106, 1.63, 0.05), V(0.07, 1.575, 0.09), V(0.0, 1.56, 0.105), V(-0.07, 1.575, 0.09), V(-0.106, 1.63, 0.05), V(-0.108, 1.69, 0.025)];
    strap(kit, S.leather, new THREE.CatmullRomCurve3(sp3).getPoints(40), 0.014, 0.003, () => 'Head', leatherC, { vertical: false });
    studs(kit, S.brass, 'Head', [{ p: V(0.115, 1.69, 0.025), n: V(1, 0, 0), r: 0.007 }, { p: V(-0.115, 1.69, 0.025), n: V(-1, 0, 0), r: 0.007 }], 0.007, trimC, { flat: 0.6 });
  }

  return finishKit(kit);
}
