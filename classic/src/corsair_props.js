// Hats, plumes, jabot and the shoulder parrot for the pirate captain.
import * as THREE from 'three';
import { V } from './armor.js';
import * as K from './corsair_lib.js';
import { SL } from './corsair_base.js';
const { TAU, sstep, clamp, mix, fbm, vnoise, hash, rng, skinGeo, gridGeo, surfGeo, ribbonGeo, tubeGeo, featherGeo, col, shade, boxG, sphereG, orient, mergeG } = K;

const GOLD = 0xd9b350, BRASS = 0xb08a3a;
const hatXf = (o) => new THREE.Matrix4().compose(V(o.x ?? 0, o.y ?? 1.77, o.z ?? 0.03), new THREE.Quaternion().setFromEuler(new THREE.Euler(o.pitch ?? 0, o.yaw ?? 0, o.roll ?? 0, 'YXZ')), V(1, 1, 1));

// ------------------------------------------------------------------ tricorn / bicorne
// o: { x,y,z,pitch,yaw,roll, corners: 3|2, color, trim, crown: [rx, rz, h], brim: apothem, lift, plume: bool, plumeColor, worn }
export function hat(ctx, o = {}) {
  const { kit } = ctx, xf = hatXf(o), nC = o.corners ?? 3, color = o.color ?? 0x14100e, crown = o.crown ?? [0.112, 0.132, 0.085], apo = o.brim ?? 0.165, lift = o.lift ?? 0.075;
  const T = (p) => p.applyMatrix4(xf);
  const worn = (p, k = 1) => { const n = fbm(p.x * 60 + p.z * 45, p.y * 55); return col(color).multiplyScalar((0.75 + 0.7 * n) * k).lerp(col(0x3a3631), 0.12 * (1 - n)); };
  const nrmCol = (c) => (p, n) => shade(color, 0.85 + 0.4 * fbm(p.x * 55, p.z * 55 + p.y * 70));
  // ---- crown
  const NS = 40, rows = [];
  const prof = [[0, 1], [0.012, 1.005], [0.03, 1.0], [0.05, 0.985], [0.07, 0.96], [0.085, 0.93], [0.095, 0.85], [0.1, 0.68], [0.103, 0.45], [0.1045, 0.2], [0.105, 0.0]];
  const hs = crown[2] / 0.085;
  for (const [yy, f] of prof) {
    const ring = [];
    for (let k = 0; k < NS; k++) {
      const a = (k / NS) * TAU, dent = 1 - 0.05 * Math.pow(Math.sin(a * 1.5 + 0.0), 2) * sstep(yy, 0.05, 0.1), pinch = 1 + 0.03 * Math.cos(a * 3) * sstep(yy, 0.03, 0.09);
      ring.push(T(V(Math.sin(a) * crown[0] * f * pinch, yy * hs - (yy > 0.09 ? 0.006 * Math.pow(Math.sin(a), 2) : 0), Math.cos(a) * crown[1] * f * pinch * dent)));
    }
    rows.push(ring);
  }
  skinGeo(kit, SL.felt, gridGeo(rows, { closed: true, flip: true }), { bind: 'Head', color: (p) => worn(p, 1.0), ao: 0.3 });
  // crown band: a dark ribbon round the base with a brass buckle
  { const rr = []; for (const [yy, r] of [[0.006, 1.012], [0.03, 1.01]]) { const ring = []; for (let k = 0; k < NS; k++) { const a = (k / NS) * TAU; ring.push(T(V(Math.sin(a) * crown[0] * r, yy * hs + 0.004, Math.cos(a) * crown[1] * r))); } rr.push(ring); }
    skinGeo(kit, SL.silk, gridGeo(rr, { closed: true, flip: true }), { bind: 'Head', color: () => shade(o.band ?? 0x120f0e, 1), ao: 0.2 }); }
  // ---- brim: polygon outline with the flaps folded up
  const NA = 150, NR = 9, cr = (a) => V(Math.sin(a) * crown[0] * 1.012, 0.0, Math.cos(a) * crown[1] * 1.012);
  const sector = Math.PI * 2 / nC, flapC = (i) => (o.flapPhase ?? (nC === 3 ? Math.PI / 3 : Math.PI / 2)) + i * sector; // flap centres
  const outline = (a) => { // distance to the folded-up flap edge as a function of angle
    let best = 1e9, phi = 0;
    for (let i = 0; i < nC; i++) { let d = a - flapC(i); d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) < sector / 2 + 1e-6) { phi = d; best = apo / Math.cos(d * 0.98); } }
    return { r: best, phi };
  };
  const bg = [], edgePts = [];
  const brimRows = [];
  for (let j = 0; j <= NR; j++) {
    const s = j / NR, ring = [];
    for (let k = 0; k <= NA; k++) {
      const a = (k / NA) * TAU, { r: R0, phi } = outline(a), R = Math.min(R0, apo * 1.85) * (1 - 0.1 * Math.pow(Math.abs(phi) / (sector / 2), 4));
      const cp = cr(a), rc = Math.hypot(cp.x, cp.z), rr = mix(rc, R, s);
      const fold = Math.pow(Math.max(0, Math.cos(phi * Math.PI / sector * 0.96)), 0.9), up = lift * fold * Math.pow(sstep(s, 0.15, 1.0), 1.25) * (o.liftScale ?? 1);
      const y = -0.004 + up + 0.012 * (1 - fold) * s * s * -1 + 0.006 * Math.sin(a * 6) * s * 0.0;
      const wob = 1 + 0.01 * Math.sin(a * 9 + 1) * s;
      ring.push(T(V(Math.sin(a) * rr * wob, y, Math.cos(a) * rr * wob * (o.brimDepth ?? 1.0) * (rc > 0 ? 1 : 1))));
    }
    brimRows.push(ring);
  }
  skinGeo(kit, SL.felt, gridGeo(brimRows, { flip: true }), { bind: 'Head', color: (p) => worn(p, 0.95), ao: 0.3 });
  // edge binding: a ribbon along the outer border
  const edge = brimRows[NR];
  const ep = edge.map((p) => p.clone());
  if (o.trim !== false) {
    const lace = ribbonGeo(ep.map((p) => p.clone().add(V(0, 0.0, 0)).addScaledVector(V(0, 1, 0), 0.0)), 0.015, 0.003, (p) => V(0, 1, 0).applyMatrix4(new THREE.Matrix4()), { caps: false });
    const accum = [0]; for (let i = 1; i < ep.length; i++) accum.push(accum[i - 1] + ep[i].distanceTo(ep[i - 1]));
    skinGeo(kit, SL.gilt, lace, { bind: 'Head', color: (p) => { let bi = 0, bd = 1e9; for (let i = 0; i < ep.length; i += 2) { const d = p.distanceToSquared(ep[i]); if (d < bd) { bd = d; bi = i; } } return col(o.trim ?? GOLD).lerp(col(0x6a4a18), 0.5 * Math.abs(Math.sin(accum[bi] / 0.012 * Math.PI))); }, ao: 0.2 });
  }
  // brass tack buttons where the flaps meet the crown, and the cockade at the front
  for (let i = 0; i < nC; i++) { const a = flapC(i), p = T(V(Math.sin(a) * crown[0] * 1.03, lift * 0.55 + 0.01, Math.cos(a) * crown[1] * 1.03)); skinGeo(kit, SL.gilt, sphereG(p, [0.0085, 0.0085, 0.006], 8), { bind: 'Head', color: () => GOLD, ao: 0.1 }); }
  // plume: a drooping ostrich feather from the left flap
  if (o.plume !== false) plume(ctx, T(V(Math.sin(flapC(0)) * crown[0] * 1.0, 0.06, Math.cos(flapC(0)) * crown[1] * 1.0)), o.plumeColor ?? 0xf1ece0, o.plumeDir ?? V(0.35, 0.65, -0.75), xf);
  return { xf, T };
}

// An ostrich plume: a curved spine with dense barbs (feather cards) that droop.
export function plume(ctx, base, color, dir, xf, o = {}) {
  const { kit } = ctx, R = rng(o.seed ?? 21), len = o.len ?? 0.3;
  const d = dir.clone().normalize(), spinePts = [], N = 10;
  for (let i = 0; i <= N; i++) { const t = i / N; spinePts.push(base.clone().addScaledVector(d, len * t * 0.8).add(V(0.0, -len * 0.5 * t * t * t, -len * 0.2 * t * t)).add(V((o.sway ?? 0.5) * len * 0.35 * Math.sin(t * 2.4), 0, 0))); }
  const curve = new THREE.CatmullRomCurve3(spinePts, false, 'catmullrom', 0.5);
  skinGeo(kit, SL.feather, tubeGeo(curve.getPoints(10), 0.0016, 5, 10, {}), { bind: 'Head', color: () => shade(color, 0.75), ao: 0.2 });
  const M = 46;
  for (let i = 0; i < M; i++) {
    const t = 0.05 + (i / M) * 0.95, p = curve.getPointAt(t), tg = curve.getTangentAt(t), side0 = new THREE.Vector3().crossVectors(tg, V(0, 1, 0.3)).normalize();
    for (const sd of [-1, 1]) {
      const bl = len * (0.2 + 0.12 * Math.sin(Math.min(1, t * 1.3) * Math.PI)) * (0.85 + 0.3 * R()), dirB = side0.clone().multiplyScalar(sd).addScaledVector(tg, 0.45).addScaledVector(V(0, -1, 0), 0.5 + 0.7 * t).normalize();
      const g = featherGeo(p, dirB, bl, 0.022, V(0, -1, 0.1).normalize(), 0.25, 2, 5, 0.3);
      const c = col(color).multiplyScalar(0.85 + 0.25 * R());
      skinGeo(kit, SL.feather, g, { bind: 'Head', color: () => c, ao: 0.35 });
    }
  }
}

// ------------------------------------------------------------------ jabot: cascading linen ruffles down the chest
export function jabot(ctx, o = {}) {
  const { kit, surf } = ctx, y0 = o.y0 ?? 1.52, y1 = o.y1 ?? 1.24, linen = o.color ?? 0xe9e1cd, tb = K.torsoBind(kit);
  const cz = 0.012;
  const chestZ = (y) => { let s = 0; for (let k = -2; k <= 2; k++) s += surf(y + k * 0.015, 0); return cz + s / 5; };
  const zAt = (x, y) => chestZ(y) + 0.006 - x * x * 2.4;
  for (const sd of [-1, 1]) {
    const NU = 8, NV = 46, rows = [];
    for (let j = 0; j <= NV; j++) {
      const v = j / NV, y = mix(y0, y1, v), x0 = sd * (0.012 + 0.014 * v), w = 0.032 + 0.022 * Math.pow(v, 0.8), row = [];
      for (let i = 0; i <= NU; i++) {
        const u = i / NU, x = x0 + sd * u * w + sd * 0.006 * Math.sin(v * 9 + sd) * u;
        const pleat = Math.sin(v * Math.PI * 2 * 7.5 + sd * 1.3 + u * 1.4), edge = Math.pow(u, 1.5);
        const zz = zAt(x, y) + 0.01 + 0.014 * Math.sin(u * Math.PI * 0.8) + 0.016 * pleat * edge + 0.006 * (1 - v) * u;
        row.push(V(x, y - 0.01 * edge * Math.abs(pleat) * 0.6, zz));
      }
      rows.push(row);
    }
    skinGeo(kit, SL.linen, gridGeo(rows, { flip: sd > 0 }), { bind: tb, color: (p, n) => { const f = 0.88 + 0.22 * n.y + 0.1 * vnoise(p.x * 90, p.y * 90); return col(linen).multiplyScalar(f); }, ao: 0.35 });
  }
  // the central placket: a pleated linen band between the two frills
  { const rows = []; for (let j = 0; j <= 30; j++) { const v = j / 30, y = mix(y0, y1 + 0.03, v), row = []; for (let i = 0; i <= 4; i++) { const x = (i / 4 - 0.5) * (0.034 + 0.01 * v); row.push(V(x, y, zAt(x, y) + 0.004 + 0.004 * Math.sin(v * 40 + i))); } rows.push(row); } skinGeo(kit, SL.linen, gridGeo(rows), { bind: tb, color: () => shade(linen, 0.9), ao: 0.3 }); }
}

// ------------------------------------------------------------------ parrot
// A macaw perched on the right shoulder, looking toward the captain's ear. Built in a local frame (+y up, +z forward,
// feet at the origin) from a smooth body core under layered feather cards.
export function parrot(ctx, skin, o = {}) {
  const { kit } = ctx, R = rng(o.seed ?? 5), P1 = skin.parrot ?? 0xd8281c, P2 = skin.parrot2 ?? 0xf2c23c, P3 = skin.parrot3 ?? 0x2a5fc4;
  const pos = o.pos ?? V(-0.185, 1.545, -0.04), sz = o.size ?? 1;
  const hsl = {}; col(P1).getHSL(hsl); const white = hsl.l > 0.8;
  const M = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(o.lean ?? 0.42, o.yaw ?? 0.55, 0, 'YXZ')), V(sz, sz, sz));
  const Mi = M.clone().invert();
  const T = (x, y, z) => V(x, y, z).applyMatrix4(M), D = (x, y, z) => V(x, y, z).transformDirection(M);
  const bind = [['RightShoulder', 0.75], ['RightArm', 0.25]];
  const grade = (c, sat, lit) => { const h = {}; col(c).getHSL(h); return new THREE.Color().setHSL(h.h, h.s * sat, h.l * lit); };
  const c1 = white ? col(P1) : grade(P1, 0.78, 0.72), c2 = white ? col(P2) : grade(P2, 0.85, 0.85), c3 = white ? col(P3) : grade(P3, 0.8, 0.7), c1d = c1.clone().multiplyScalar(0.5);
  const put = (slotN, g, cf, ao = 0.3) => skinGeo(kit, slotN, g, { bind, color: typeof cf === 'function' ? cf : () => cf, ao });
  const ell = (cx, cy, cz, rx, ry, rz, seg = 20) => { const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)); g.scale(rx, ry, rz); g.translate(cx, cy, cz); g.applyMatrix4(M); return g; };
  // feather: base/dir in local space; colour gradient along its length
  const feather = (base, dir, len, w, curl, colA, colB, o2 = {}) => {
    const b = T(base.x, base.y, base.z), d = D(dir.x, dir.y, dir.z), cu = D(curl.x, curl.y, curl.z);
    const g = featherGeo(b, d, len * sz, w * sz, cu, o2.bend ?? 0.25, 2, o2.nv ?? 6, o2.tip ?? 0.5), vary = 0.7 + 0.45 * R();
    put(SL.feather, g, (p) => { const t = clamp(p.clone().sub(b).dot(d) / (len * sz), 0, 1), edge = 1; return colA.clone().lerp(colB, o2.grad ? sstep(t, o2.grad[0], o2.grad[1]) : 0).multiplyScalar(vary * (0.8 + 0.3 * t)); }, 0.3);
  };
  // body core, neck and head
  put(SL.feather, ell(0, 0.1, 0.0, 0.037, 0.082, 0.046), (p) => c1d.clone().multiplyScalar(0.9 + 0.2 * fbm(p.x * 90, p.y * 90)));
  put(SL.feather, ell(0, 0.172, 0.014, 0.033, 0.036, 0.04), (p) => c1.clone().multiplyScalar(0.8 + 0.25 * fbm(p.x * 90, p.y * 90)));
  put(SL.feather, ell(0, 0.208, 0.032, 0.031, 0.031, 0.036), (p) => c1.clone().multiplyScalar(0.85 + 0.25 * fbm(p.x * 100, p.y * 100)));
  // bare face patch around the eye, with fine dark feather lines
  for (const sd of [-1, 1]) {
    const g = ell(sd * 0.0215, 0.203, 0.047, 0.0125, 0.0215, 0.027, 14);
    put(SL.matte, g, (p) => { const q = p.clone().applyMatrix4(Mi); return (white ? col(0xf4f0e6) : col(0xf0e6da)).multiplyScalar(0.88 + 0.12 * Math.sin(q.y * 520) * Math.sin(q.z * 90 + 1)); }, 0.15);
    put(SL.matte, ell(sd * 0.0275, 0.212, 0.0545, 0.0055, 0.0075, 0.0075, 10), 0xf4e08a, 0.1);
    put(SL.matte, ell(sd * 0.0305, 0.212, 0.0555, 0.0025, 0.004, 0.004, 8), 0x080604, 0.05);
  }
  // beak: hooked upper mandible, white horn over the top, grey-black below; lower mandible tucked under
  { const up = tubeGeo([V(0, 0.214, 0.058), V(0, 0.218, 0.078), V(0, 0.208, 0.098), V(0, 0.186, 0.105), V(0, 0.171, 0.097)].map((q) => q.applyMatrix4(M)), (t) => (mix(0.017, 0.003, Math.pow(t, 1.1))) * sz, 12, 22, { ex: 0.82 });
    put(SL.feather, up, (p) => { const q = p.clone().applyMatrix4(Mi); return col(0xece3cf).lerp(col(0x3c3630), clamp((0.205 - q.y) * 14, 0, 0.85)); }, 0.25);
    const lo = tubeGeo([V(0, 0.196, 0.06), V(0, 0.184, 0.08), V(0, 0.178, 0.094)].map((q) => q.applyMatrix4(M)), (t) => mix(0.0115, 0.005, t) * sz, 10, 10, { ex: 0.9 });
    put(SL.feather, lo, 0x24201c, 0.25); }
  // crown / nape feathers
  for (let k = 0; k < 9; k++) { const a = (k / 8 - 0.5) * 1.6; feather(V(Math.sin(a) * 0.026, 0.232, 0.016 + Math.cos(a) * 0.012), V(Math.sin(a) * 0.4, -0.15, -0.9), 0.03, 0.02, V(-Math.sin(a), -0.3, -Math.cos(a)), c1, c1, { bend: 0.4, nv: 6 }); }
  // breast and belly: overlapping rows of small cards pointing down
  for (let r = 0; r < 8; r++) for (let k = 0; k < 13; k++) {
    const a = ((k + (r % 2) * 0.5) / 13 - 0.5) * 2.5, y = 0.172 - r * 0.0215, rad = 0.043 * Math.sqrt(Math.max(0.2, 1 - Math.pow((y - 0.1) / 0.092, 2)));
    feather(V(Math.sin(a) * rad * 0.9, y, Math.cos(a) * rad * 1.1 + 0.004), V(Math.sin(a) * 0.3, -1, 0.28), 0.046, 0.026, V(-Math.sin(a), 0, -Math.cos(a)), c1, c1d, { bend: 0.22, nv: 6, tip: 0.5, grad: [0.2, 1] });
  }
  // back feathers
  for (let r = 0; r < 6; r++) for (let k = 0; k < 9; k++) { const a = Math.PI + ((k + (r % 2) * 0.5) / 9 - 0.5) * 2.0, y = 0.16 - r * 0.02; feather(V(Math.sin(a) * 0.036, y, Math.cos(a) * 0.04), V(Math.sin(a) * 0.2, -1, -0.3), 0.05, 0.026, V(-Math.sin(a), 0, -Math.cos(a)), c1, c1d, { bend: 0.15, nv: 6, grad: [0.3, 1] }); }
  // wings, folded along the body: red marginal coverts, yellow median coverts, blue flight feathers
  for (const sd of [-1, 1]) {
    for (let k = 0; k < 7; k++) { const t = k / 6; feather(V(sd * (0.04 - 0.003 * t), 0.165 - t * 0.045, 0.002 - 0.01 * t), V(sd * 0.1, -1, -0.12), 0.055, 0.03, V(-sd, 0, 0.2), c1, c1d, { bend: 0.1, nv: 6, grad: [0.4, 1] }); }
    for (let k = 0; k < 7; k++) { const t = k / 6; feather(V(sd * (0.041 - 0.003 * t), 0.15 - t * 0.04, -0.004 - 0.012 * t), V(sd * 0.1, -1, -0.17), 0.085, 0.032, V(-sd, 0, 0.2), c2, c2.clone().lerp(c1, 0.3), { bend: 0.1, nv: 5, grad: [0.5, 1] }); }
    for (let k = 0; k < 8; k++) { const t = k / 7; feather(V(sd * (0.042 - 0.002 * t), 0.135 - t * 0.04, -0.008 - 0.014 * t), V(sd * (0.06 + 0.05 * t), -1, -0.28 - 0.1 * t), 0.17 + 0.06 * t, 0.034, V(-sd, 0, 0.4), c3.clone().multiplyScalar(0.9), c3.clone().multiplyScalar(0.5), { bend: 0.06, nv: 8, tip: 0.35, grad: [0.0, 0.7] }); }
  }
  // tail: two long red centre feathers and shorter side feathers tipped blue
  for (let k = 0; k < 7; k++) { const a = (k - 3) / 3, len = 0.34 - Math.abs(a) * 0.1; feather(V(a * 0.012, 0.03, -0.04), V(a * 0.12, -0.85, -0.55), len, 0.034, V(0, -0.55, 0.85), c1, k % 2 ? c3 : c1.clone().lerp(c3, 0.5), { bend: 0.02, nv: 10, tip: 0.35, grad: [0.55, 0.9] }); }
  if (white) for (let k = 0; k < 7; k++) { const a = (k - 3) * 0.2; feather(V(0, 0.236, 0.0), V(a * 0.4, 0.8, -0.7), 0.075, 0.014, V(0, 0, -1), c2, c2, { bend: 0.5, nv: 6 }); }
  // feet gripping the shoulder
  for (const sd of [-1, 1]) {
    const f = T(sd * 0.018, 0.0, 0.0), toes = [[0.006, 0.026], [-0.006, 0.026], [0.0, -0.022]];
    put(SL.matte, tubeGeo([T(sd * 0.018, 0.04, 0), f], 0.005 * sz, 6, 4, {}), 0x77706a, 0.2);
    for (const [dx, dz] of toes) put(SL.matte, tubeGeo([f, T(sd * 0.018 + dx * 0.5, -0.004, dz * 0.6), T(sd * 0.018 + dx, -0.012, dz)], 0.0036 * sz, 6, 6, {}), 0x6a645e, 0.2);
  }
}
