// Design 3: naval privateer officer. Navy coat with white facings, white waistcoat and breeches, stockings, buckle shoes,
// bicorne, crimson sash, small-sword, spyglass, epaulettes, tied queue.
import * as THREE from 'three';
import { V } from './armor.js';
import * as K from './corsair_lib.js';
import * as B from './corsair_base.js';
import * as C from './corsair_cloth.js';
import * as C2 from './corsair_cloth2.js';
import * as G from './corsair_gear.js';
import * as P from './corsair_props.js';
import { recolorOutfit } from './corsair_d1.js';
const { SL } = B, { col, shade, sstep, clamp, mix, fbm, TAU, skinGeo, gridGeo, tubeGeo, ribbonGeo, legBind, boxG, sphereG } = K;
const GOLD = 0xd9b350, WHITE = 0xe6dfcd;

const hsl = (c) => { const h = {}; col(c).getHSL(h, THREE.SRGBColorSpace); return [h.h * 360, h.s, h.l]; };

// white knit stocking from the shoe to under the knee
function stocking(ctx, A, o = {}) {
  const { kit, J } = ctx, an = J(A + 'Foot'), kn = J(A + 'Leg'), hp = J(A + 'UpLeg'), y0 = o.y0 ?? 0.07, y1 = o.y1 ?? 0.58;
  const cen = (y) => y >= kn.y ? V(mix(kn.x, hp.x, (y - kn.y) / (hp.y - kn.y)), y, mix(kn.z, hp.z, (y - kn.y) / (hp.y - kn.y))) : V(mix(an.x, kn.x, (y - an.y) / (kn.y - an.y)), y, mix(an.z, kn.z, (y - an.y) / (kn.y - an.y)));
  const rows = [], NY = 40, NS = 28;
  for (let j = 0; j <= NY; j++) {
    const t = j / NY, y = mix(y0, y1, t), c = cen(y), calf = Math.exp(-Math.pow((t - 0.5) / 0.28, 2)), r = 0.049 + 0.021 * calf + 0.004 * sstep(t, 0.9, 1.0) + 0.004 * (1 - sstep(t, 0.0, 0.15)), ring = [];
    const wr = 1 + 0.012 * Math.sin(t * 40) * (1 - t * 0.5);
    for (let k = 0; k < NS; k++) { const a = (k / NS) * TAU; ring.push(V(c.x + Math.sin(a) * r * 1.02 * wr, y, c.z + Math.cos(a) * r * 1.06 * wr)); }
    rows.push(ring);
  }
  skinGeo(kit, SL.linen, gridGeo(rows, { closed: true, flip: true }), { bind: legBind(kit, A), color: (p, n) => col(o.color ?? 0xdcd6c6).multiplyScalar(0.86 + 0.1 * Math.sin(p.y * 520) + 0.1 * fbm(p.x * 40, p.y * 30)), ao: 0.3 });
  // knee band with a small buckle
  const c = cen(y1 - 0.045), tg = new THREE.TorusGeometry(1, 0.0085, 8, 40); tg.rotateX(Math.PI / 2); tg.scale(0.0715, 1, 0.0775); tg.translate(c.x, c.y, c.z);
  skinGeo(kit, SL.leather, tg, { bind: legBind(kit, A), color: () => 0x1a1612, ao: 0.2 });
  const s = A === 'Left' ? 1 : -1, bx = c.x + s * 0.074;
  skinGeo(kit, SL.gilt, boxG(V(bx, c.y, c.z), [0.004, 0.015, 0.012]), { bind: legBind(kit, A), color: () => GOLD, ao: 0.1 });
}

// black buckled shoe: low leather shoe with a silver buckle across the instep
function shoeBuckle(ctx, A) {
  const { kit, J } = ctx, an = J(A + 'Foot'), bind = [[A + 'Foot', 1]], at = V(an.x, 0.078, an.z + 0.075);
  const W = 0.034, H = 0.017;
  for (const [dx, dy, sx, sy] of [[-W, 0, 0.0035, H], [W, 0, 0.0035, H], [0, H, W, 0.0035], [0, -H, W, 0.0035]]) skinGeo(kit, SL.steel, boxG(at.clone().add(V(dx, dy * 0.15 + 0, 0)), [sx, 0.0035, sy], [0, 0, 0]), { bind, color: () => 0xcfd3d8, ao: 0.1 });
}

// slim officer's small-sword hanging from the belt on the left hip
function smallSword(ctx, o = {}) {
  const { kit } = ctx, sx = o.sideX || (() => 0.2), sd = o.side ?? 1;
  const p0 = V(sd * (sx(1.0) + 0.03), 1.04, -0.09), tip = V(sd * (sx(0.4) + 0.07), 0.34, -0.3);
  const curve = new THREE.CatmullRomCurve3([p0, V(sd * (sx(0.8) + 0.045), 0.82, -0.12), V(sd * (sx(0.6) + 0.055), 0.58, -0.2), tip]);
  const NS = 10, N = 28, rows = [], leather = 0x14110e;
  for (let i = 0; i <= N; i++) { const t = i / N, c = curve.getPointAt(t), w = mix(0.0135, 0.0075, t), ring = []; const tg = curve.getTangentAt(t), n1 = new THREE.Vector3().crossVectors(tg, V(0, 0, 1)).normalize(), n2 = new THREE.Vector3().crossVectors(n1, tg).normalize(); for (let k = 0; k < NS; k++) { const a = (k / NS) * TAU; ring.push(c.clone().addScaledVector(n1, Math.cos(a) * w).addScaledVector(n2, Math.sin(a) * w * 0.8)); } rows.push(ring); }
  const sbind = (p) => { const t = 1 - sstep(p.y, 0.55, 0.95); return [['Hips', (1 - t) * 0.7 + 0.15], [(sd > 0 ? 'Left' : 'Right') + 'UpLeg', t * 0.8 + 0.15]]; };
  skinGeo(kit, SL.leather, gridGeo(rows, { closed: true, flip: sd < 0 }), { bind: sbind, color: (p) => shade(leather, 0.8 + 0.4 * fbm(p.x * 60 + p.z * 40, p.y * 30)), ao: 0.3 });
  const gil = (t0, t1, r) => { const rr = []; for (let j = 0; j <= 4; j++) { const t = mix(t0, t1, j / 4), c = curve.getPointAt(t), tg = curve.getTangentAt(t), n1 = new THREE.Vector3().crossVectors(tg, V(0, 0, 1)).normalize(), n2 = new THREE.Vector3().crossVectors(n1, tg).normalize(), w = mix(0.0135, 0.0075, t) + r, ring = []; for (let k = 0; k < NS; k++) { const a = (k / NS) * TAU; ring.push(c.clone().addScaledVector(n1, Math.cos(a) * w).addScaledVector(n2, Math.sin(a) * w * 0.8)); } rr.push(ring); } skinGeo(kit, SL.gilt, gridGeo(rr, { closed: true, flip: sd < 0 }), { bind: sbind, color: () => GOLD, ao: 0.1 }); };
  gil(0, 0.09, 0.0022); gil(0.92, 1.0, 0.002);
  const tp = new THREE.SphereGeometry(0.0085, 8, 6); tp.translate(tip.x, tip.y, tip.z); skinGeo(kit, SL.gilt, tp, { bind: sbind, color: () => GOLD, ao: 0.1 });
  // hilt: wire grip, urn pommel, shell guard, quillons
  const up = V(-0.08 * sd, 1, 0.2).normalize(), top = p0.clone().addScaledVector(up, 0.095);
  const hb = 'Hips';
  skinGeo(kit, SL.steel, tubeGeo([p0.clone().addScaledVector(up, 0.012), top], (t) => 0.0085 + 0.0014 * Math.sin(t * Math.PI * 9), 8, 24, {}), { bind: hb, color: (p) => col(0xb9bec6).multiplyScalar(0.8 + 0.3 * (Math.sin(p.y * 600) > 0 ? 1 : 0.4)), ao: 0.2 });
  skinGeo(kit, SL.gilt, sphereG(top.clone().addScaledVector(up, 0.008), [0.0125, 0.015, 0.0125], 10), { bind: hb, color: () => GOLD, ao: 0.1 });
  const shell = new THREE.SphereGeometry(0.03, 14, 8, 0, TAU, 0, Math.PI / 2); shell.scale(1, 0.55, 1.0); shell.rotateX(Math.PI); shell.translate(p0.x, p0.y + 0.002, p0.z);
  skinGeo(kit, SL.gilt, shell, { bind: hb, color: (p) => col(GOLD).multiplyScalar(0.85 + 0.2 * Math.sin(Math.atan2(p.x - p0.x, p.z - p0.z) * 14)), ao: 0.1 });
  skinGeo(kit, SL.gilt, tubeGeo([p0.clone().add(V(-0.035, 0.004, 0)), p0.clone().add(V(0.045, 0.004, 0))], 0.0032, 8, 4, {}), { bind: hb, color: () => GOLD, ao: 0.1 });
  skinGeo(kit, SL.gilt, tubeGeo([p0.clone().add(V(0.04, 0.004, 0)), p0.clone().add(V(0.05, 0.05, 0.005)), top.clone().add(V(0.012, -0.01, 0.0))], 0.003, 8, 24, {}), { bind: hb, color: () => GOLD, ao: 0.1 });
  const fg = new THREE.TorusGeometry(0.022, 0.005, 6, 18); fg.rotateX(Math.PI / 2); fg.translate(p0.x, p0.y - 0.035, p0.z);
  skinGeo(kit, SL.leather, fg, { bind: hb, color: () => 0x15100c, ao: 0.2 });
}

// brass spyglass carried in the right fist: leather-wrapped barrel and two brass draws, lens at the front
function spyglass(ctx) {
  const { kit, J } = ctx, wr = J('RightHand'), el = J('RightForeArm'), dir = wr.clone().sub(el).normalize(), c = wr.clone().addScaledVector(dir, 0.045).add(V(0, -0.004, 0));
  const bind = [['RightHand', 1]], seg = [[-0.19, -0.02, 0.0165, 'leather'], [-0.02, 0.1, 0.0138, 'brass'], [0.1, 0.17, 0.0112, 'brass']];
  const P = (z) => V(c.x, c.y, c.z + z);
  for (const [s0, s1, r, kind] of seg) {
    skinGeo(kit, kind === 'leather' ? SL.leather : SL.gilt, tubeGeo([P(s0), P(s1)], r, 14, 6, {}), { bind, color: (pp) => kind === 'leather' ? shade(0x3a2616, 0.8 + 0.5 * (Math.sin(pp.z * 420) > 0.3 ? 1 : 0.5)) : col(0xb98f3e).multiplyScalar(0.8 + 0.4 * fbm(pp.x * 90, pp.z * 60)), ao: 0.2 });
    skinGeo(kit, SL.gilt, tubeGeo([P(s1 - 0.012), P(s1 + 0.003)], r + 0.003, 14, 3, {}), { bind, color: () => 0x8f6a2a, ao: 0.2 });
  }
  const lg = new THREE.CircleGeometry(0.0105, 14); lg.translate(c.x, c.y, c.z + 0.1705);
  skinGeo(kit, SL.steel, lg, { bind, color: () => 0x405e6a, ao: 0.1 });
  skinGeo(kit, SL.gilt, tubeGeo([P(-0.195), P(-0.19)], 0.0175, 14, 2, {}), { bind, color: () => 0x8f6a2a, ao: 0.2 });
}

// gold bullion epaulette: a curved plate over the shoulder cap with rope edges and a fringe, all following the arm
function epaulette(ctx, A) {
  const { kit, J } = ctx, s = A === 'Left' ? 1 : -1, sh = J(A + 'Arm'), bind = [[A + 'Shoulder', 0.55], [A + 'Arm', 0.45]];
  const arm = (t) => V(s * t, sh.y, sh.z), X0 = 0.1, X1 = 0.235, rows = [], NJ = 10, NI = 12;
  const half = (u) => 0.05 * Math.sqrt(Math.max(0.0, 1 - Math.pow((u - 0.45) / 0.55, 2))) + 0.004;
  const Rr = (t) => 0.066 + 0.02 * (1 - sstep(t, X0, X0 + 0.1)) - 0.012 * sstep(t, X0 + 0.07, X1);
  const pt = (u, v) => { const t = mix(X0, X1, u), w = half(u), z = (v * 2 - 1) * w, R = Rr(t); return V(s * t, sh.y + Math.sqrt(Math.max(R * R - z * z, 0.0004)) + 0.007 + 0.004 * Math.sin(u * Math.PI) - 0.025 * u * u, sh.z + z); };
  for (let j = 0; j <= NJ; j++) { const row = []; for (let i = 0; i <= NI; i++) row.push(pt(j / NJ, i / NI)); rows.push(row); }
  skinGeo(kit, SL.gilt, gridGeo(rows, { flip: s > 0 }), { bind, color: (p) => col(GOLD).multiplyScalar(0.75 + 0.25 * Math.sin(p.z * 520) * Math.sin(p.x * 300)), ao: 0.2 });
  for (const sd of [0, 1]) { const pts = []; for (let k = 0; k <= 16; k++) { const u = k / 16, q = pt(u, sd); pts.push(q.clone().add(V(0, 0.003, 0))); } skinGeo(kit, SL.gilt, tubeGeo(pts, 0.0034, 6, 16, {}), { bind, color: () => GOLD, ao: 0.1 }); }
  const e = (v, d) => { const q = pt(1, v); return q.clone().add(V(s * d, -0.006 * d * 10, 0)); };
  for (let k = 0; k < 16; k++) { const v = k / 15, q = pt(0.985, 0.5 + (v - 0.5) * 0.9), len = 0.07 + 0.01 * Math.sin(k * 2.3); skinGeo(kit, SL.gilt, tubeGeo([q, q.clone().add(V(s * 0.006, -len * 0.5, (v - 0.5) * 0.004)), q.clone().add(V(s * 0.01, -len, (v - 0.5) * 0.008))], 0.0026, 5, 8, {}), { bind, color: () => GOLD, ao: 0.15 }); }
  const bt = new THREE.SphereGeometry(0.008, 8, 6); bt.translate(s * X0 + s * 0.012, sh.y + 0.09, sh.z); skinGeo(kit, SL.gilt, bt, { bind, color: () => GOLD, ao: 0.1 });
}

// cravat: a white linen stock wound round the neck, knotted at the front with two short ends tucked into the waistcoat
function cravat(ctx) {
  const { kit } = ctx, y = 1.568, rows = [], NS = 40, cz = 0.012;
  for (let j = 0; j <= 6; j++) { const v = j / 6, ring = []; for (let i = 0; i < NS; i++) { const a = (i / NS) * TAU, r = 0.088 + 0.006 * Math.sin(v * Math.PI) + 0.002 * Math.sin(a * 7 + v * 4); ring.push(V(Math.sin(a) * r * 1.0, y + 0.02 - v * 0.05 + 0.004 * Math.sin(a * 3), cz + Math.cos(a) * r * 0.98 + 0.012)); } rows.push(ring); }
  const bind = K.torsoBind(kit), cc = (p, n) => col(0xf0eadb).multiplyScalar(0.86 + 0.14 * n.y + 0.08 * fbm(p.x * 40, p.y * 40));
  skinGeo(kit, SL.linen, gridGeo(rows, { closed: true, flip: true }), { bind, color: cc, ao: 0.3 });
  const kn = new THREE.SphereGeometry(0.02, 12, 10); kn.scale(1.15, 0.85, 0.8); kn.translate(0, y - 0.012, cz + 0.106); skinGeo(kit, SL.linen, kn, { bind, color: cc, ao: 0.3 });
  for (const sd of [-1, 1]) skinGeo(kit, SL.linen, ribbonGeo([V(sd * 0.008, y - 0.022, cz + 0.108), V(sd * 0.022, y - 0.05, cz + 0.112), V(sd * 0.03, y - 0.085, cz + 0.108), V(sd * 0.032, y - 0.11, cz + 0.108)], (t) => 0.018 + 0.008 * t, 0.003, V(0, 0, 1), { caps: false }), { bind, color: cc, ao: 0.3 });
}

// queue: hair gathered at the nape, tied with a black ribbon and bow
function queue(ctx, color) {
  const { kit, hs } = ctx, n = hs.pt(Math.PI, 0.1, 0.012), pts = [n.clone().add(V(0, 0.02, -0.005)), n.clone().add(V(0, -0.03, -0.035)), n.clone().add(V(0, -0.11, -0.06)), n.clone().add(V(0.004, -0.22, -0.065)), n.clone().add(V(0.0, -0.31, -0.06))];
  skinGeo(kit, SL.hair, tubeGeo(pts, (t) => 0.026 * (1 - 0.8 * Math.pow(t, 1.6)) + 0.004, 12, 24, {}), { bind: 'Head', color: (p) => col(color).multiplyScalar(0.7 + 0.5 * fbm(p.x * 80, p.y * 25)), ao: 0.4 });
  const rb = (y) => { const g = new THREE.TorusGeometry(0.0255, 0.0045, 6, 16); g.rotateX(Math.PI / 2); g.translate(n.x, n.y - y, n.z - 0.04 - y * 0.35); return g; };
  skinGeo(kit, SL.silk, rb(0.03), { bind: 'Head', color: () => 0x15121a, ao: 0.2 });
  for (const sd of [-1, 1]) { const g = new THREE.SphereGeometry(0.017, 10, 8); g.scale(1.3, 0.8, 0.5); g.rotateZ(sd * 0.4); g.translate(n.x + sd * 0.02, n.y - 0.035, n.z - 0.052); skinGeo(kit, SL.silk, g, { bind: 'Head', color: () => 0x15121a, ao: 0.2 }); }
}

export function buildCorsairD3(scene, skin) {
  const ctx = B.setup(scene, skin), { kit } = ctx;
  const id = skin.id, navy = id === 'scarlet' || id == null ? 0x1f2f5a : (skin.coat ?? 0x1f2f5a), face = id === 'blackflag' ? (skin.trim ?? 0xc0c4cc) : (id === 'admiral' ? 0xefe6d2 : WHITE);
  const sashC = id === 'scarlet' || id == null ? 0x9a1c26 : (skin.sash ?? 0x9a1c26), hatC = id === 'scarlet' || id == null ? 0x17141a : (skin.hat ?? 0x17141a);
  const hatLift = (c) => { const h = {}; col(c).getHSL(h); return new THREE.Color().setHSL(h.h, h.s, Math.max(h.l, 0.11)).getHex(); };
  const coatVC = shade(navy, 0.45).getHex(), trimC = id === 'blackflag' ? (skin.trim ?? 0xc0c4cc) : GOLD, faceVC = shade(face, 0.8).getHex();
  const [ch, cs, cl] = hsl(navy), [fh, fs, fl] = hsl(face);
  B.tintSkin(ctx, skin.skin ?? 0xc9966f);
  ctx.shoes.visible = false;
  recolorOutfit(ctx, 'd3' + navy.toString(16) + face.toString(16), { coat: [ch, cs, Math.max(0.12, cl * 0.9), 1.1], vest: [fh, fs * 0.6, 0.82, 0.5], shirt: [fh, fs * 0.5, 0.85, 0.4], button: [44, 0.7, 0.5, 0], pants: [fh, fs * 0.5, 0.78, 0.6], lapel: [fh, fs * 0.6, 0.8, 0.5] });
  K.filterTris(ctx.top, (c, id2) => !(id2 === 13 || id2 === 14 || id2 === 0 || id2 === 16 || id2 === 17) && !(id2 === 9 && c.y < 0.93));
  K.filterTris(ctx.bottom, (c, id2, mn) => mn > 0.5);
  K.filterTris(ctx.bodyM, (c, id2, mn) => mn > 0.12);
  for (const A of ['Left', 'Right']) { B.boot(ctx, A, { color: 0x15110e, top: 0.1, flare: 0.062, cuff: 0.015, lowFoot: 0.66, footLen: 0.8, footWide: 1.1, lining: 0x15110e, spur: false, sole: 0x0c0907 }); stocking(ctx, A); shoeBuckle(ctx, A); }
  const ed = C.coatSkirt(ctx, { y0: 1.12, color: coatVC, openTop: 0.45, openHem: 0.95, vent: 0.12, hemF: 0.72, hemS: 0.58, hemB: 0.52 });
  for (const s of [1, -1]) {
    C.laceBand(ctx, ed.front[s].slice(2), 0.05, { color: faceVC, dark: faceVC, slot: SL.wool, pattern: 10, off: 0.004, thick: 0.004, normal: true });
    C.laceBand(ctx, ed.front[s].slice(2), 0.012, { color: trimC, off: 0.008, normal: true });
    C.laceBand(ctx, ed.hem[s], 0.02, { color: faceVC, dark: faceVC, slot: SL.wool, pattern: 10, off: 0.004, thick: 0.004, normal: true });
    C.pocketFlap(ctx, ed, s, 1.2, 0.99, { color: coatVC, trim: trimC });
    C.buttonRow(ctx, ed.front[s].slice(0, 20).map((p) => p.clone()), 0.075, 0.0095, { start: 0.0, off: 0.009 });
  }
  for (const A of ['Left', 'Right']) C.cuff(ctx, A, { color: faceVC, trim: trimC, from: 0.56, to: 0.7, flare: 0.022 });
  ctx.jabotZ = (x, y) => G.torsoPt(ctx, x, y, true, 0.0).z;
  cravat(ctx);
  G.belt(ctx, { y: 1.07, width: 0.04, color: 0x15100c });
  C2.sash(ctx, { color: sashC, y: 1.12, width: 0.085, knotX: 0.2, stripe: false, fringe: trimC });
  smallSword(ctx, { sideX: ed.sideX, side: 1 });
  spyglass(ctx);
  for (const A of ['Left', 'Right']) epaulette(ctx, A);
  P.hat(ctx, { y: 1.748, z: 0.0, pitch: -0.1, roll: 0.0, corners: 2, color: hatLift(hatC), trim: trimC, brim: 0.17, lift: 0.11, plume: false, flapPhase: Math.PI / 2 });
  P.parrot(ctx, skin, { size: 1.2 });
  { const R = K.rng(21), locks = [];
    for (let i = 0; i < 36; i++) { const u = i / 35, az = 0.9 + u * (Math.PI * 2 - 1.8), bk = Math.abs(az - Math.PI) < 0.5; locks.push({ az, el: 0.15 + 0.5 * R(), len: bk ? 0.04 : 0.1 + 0.03 * R(), curl: 0.5 + R(), w: 0.035 + 0.02 * R() }); }
    B.hair(ctx, { colors: [0x3a2a1e, 0x4a3828, 0x5a4636], locks, seed: 9 });
    queue(ctx, 0x45331f); }
  kit.add(0, new THREE.BoxGeometry(0.01, 0.01, 0.01), 'Hips', 0xffffff);
  return kit.finish();
}
