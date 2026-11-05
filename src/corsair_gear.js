// Worn gear for the pirate captain: baldric, belts, cutlass, small-sword, flintlock pistols, spyglass, rope coil.
import * as THREE from 'three';
import { V } from './armor.js';
import * as K from './corsair_lib.js';
import { SL } from './corsair_base.js';
const { TAU, sstep, clamp, mix, fbm, vnoise, skinGeo, gridGeo, surfGeo, ribbonGeo, tubeGeo, bodyBind, torsoBind, col, shade, boxG, sphereG, orient, mergeG } = K;

const GOLD = 0xd9b350, BRASS = 0xb08a3a, DARK = 0x16110d;

// Point on the torso at height y and horizontal position x (front: z > 0; back: z < 0), pushed out by off.
export function torsoPt(ctx, x, y, front = true, off = 0.008, cz = 0.012) {
  let th = 0;
  for (let i = 0; i < 4; i++) { const r = nbrR(ctx, y, th) + off; th = Math.asin(clamp(x / r, -0.98, 0.98)); }
  if (!front) th = Math.PI - th;
  const r = nbrR(ctx, y, th) + off, sg = Math.sin(th);
  return V(r * sg, y, cz + r * Math.cos(th));
}
const nbrR = (ctx, y, th) => Math.max(ctx.surf(y, th), ctx.surf(y, th + 0.14), ctx.surf(y, th - 0.14), ctx.surf(y + 0.03, th), ctx.surf(y - 0.03, th));
const outward = (p) => V(p.x, 0.15, p.z - 0.012).normalize();

// Wide leather strap across the chest with brass edging and a buckle. s = +1: over the character's right shoulder to the left hip.
export function baldric(ctx, o = {}) {
  const { kit } = ctx, w = o.width ?? 0.058, color = o.color ?? 0x2a1a10, s = o.side ?? 1; // s=1: over right shoulder (-x)
  const sx = -s;
  const front = [[-0.118, 1.57], [-0.1, 1.50], [-0.06, 1.41], [-0.015, 1.32], [0.04, 1.23], [0.09, 1.15], [0.14, 1.08], [0.19, 1.02]];
  const back = [[0.19, 1.02], [0.14, 1.06], [0.09, 1.14], [0.04, 1.22], [-0.01, 1.31], [-0.06, 1.40], [-0.1, 1.49], [-0.118, 1.57]];
  const pts = [];
  const pf = front.map(([x, y]) => (y > 1.52 ? V(sx * -x * -1 * 1, y, -0.012) : torsoPt(ctx, x * sx * -1, y, true, 0.009)));
  // build front path: x measured with +x on the left hip side; baldric over the right shoulder => start at x<0
  const F = front.map(([x, y]) => (y >= 1.55 ? V(x, y, 0.0) : torsoPt(ctx, x, y, true, 0.010)));
  const Bk = back.map(([x, y]) => (y >= 1.55 ? V(x, y, -0.05) : torsoPt(ctx, x, y, false, 0.010)));
  // the shoulder top: a short arc over the trapezius
  F[0] = V(-0.12, 1.568, 0.0); Bk[Bk.length - 1] = V(-0.12, 1.566, -0.058);
  const mid = V(-0.123, 1.585, -0.03);
  const side = torsoPt(ctx, 0.205, 1.0, true, 0.01); const sidePt = V(side.x + 0.012, 1.0, 0.012 + 0.002);
  const all = [...F.slice(0, 8), V(0.205, 1.0, 0.012), ...Bk.slice(0, 8)].filter(Boolean);
  const loop = [Bk[7], mid, F[0], ...F.slice(1, 8), V(sidePt.x, 1.0, 0.012), ...Bk.slice(0, 7)];
  loop.push(loop[0].clone());
  if (s < 0) loop.forEach((p) => { p.x = -p.x; });
  const curve = new THREE.CatmullRomCurve3(loop, false, 'catmullrom', 0.5), P = curve.getPoints(110);
  const g = ribbonGeo(P, w, 0.007, outward);
  const bind = (p) => { const t = sstep(p.y, 1.1, 1.45); return t > 0.99 ? chain(kit, p.y) : torsoBind(kit)(p); };
  skinGeo(kit, SL.leather, g, { bind: torsoBind(kit), color: (p) => shade(color, 0.8 + 0.4 * fbm(p.x * 40 + p.z * 40, p.y * 40)), ao: 0.3 });
  // brass edge lines (stitching/trim) along both borders
  for (const e of [-1, 1]) {
    const ep = P.map((p, i) => { const t = P[Math.min(P.length - 1, i + 1)].clone().sub(P[Math.max(0, i - 1)]).normalize(), sd = new THREE.Vector3().crossVectors(t, outward(p)).normalize(); return p.clone().addScaledVector(sd, e * (w * 0.5 - 0.004)).addScaledVector(outward(p), 0.0045); });
    skinGeo(kit, SL.gilt, ribbonGeo(ep, 0.0032, 0.0022, outward, { caps: false }), { bind: torsoBind(kit), color: () => BRASS, ao: 0.1 });
  }
  // buckle plate on the chest
  const bp = torsoPt(ctx, -0.0, 1.285, true, 0.016);
  buckle(ctx, bp, 0.06, 0.048, { bind: torsoBind(kit), tilt: -0.5, rot: 0.55 * s * -1 });
  return { P, curve };
}

// A brass buckle plate with a raised rim and a bar at p, facing +Z-ish; w x h half sizes scaled.
export function buckle(ctx, p, w, h, o = {}) {
  const { kit } = ctx, bind = o.bind || 'Hips', rot = o.rot ?? 0;
  const mk = (g) => { g.rotateZ(rot); g.translate(p.x, p.y, p.z); return g; };
  const plate = new THREE.BoxGeometry(w, h, 0.006), rim = new THREE.TorusGeometry(1, 0.1, 4, 4);
  // rounded rectangle frame from four bars
  const frame = [];
  for (const [bx, by, bw, bh] of [[0, h / 2, w, 0.008], [0, -h / 2, w, 0.008], [w / 2, 0, 0.008, h], [-w / 2, 0, 0.008, h]]) { const g = new THREE.BoxGeometry(bw, bh, 0.011); g.translate(bx, by, 0); frame.push(g); }
  const bar = new THREE.BoxGeometry(0.007, h * 0.92, 0.012); bar.translate(w * 0.12, 0, 0.001);
  const tongue = new THREE.BoxGeometry(w * 0.55, 0.006, 0.01); tongue.translate(w * 0.12, h * 0.1, 0.004);
  const m = mergeG([...frame, bar, tongue]);
  m.rotateZ(rot); m.translate(p.x, p.y, p.z);
  skinGeo(kit, SL.gilt, m, { bind, color: () => GOLD, ao: 0.1 });
  const lg = new THREE.BoxGeometry(w * 0.9, h * 0.88, 0.003); lg.rotateZ(rot); lg.translate(p.x, p.y, p.z - 0.001);
  skinGeo(kit, SL.leather, lg, { bind, color: () => 0x120c08, ao: 0.1 });
}
const chain = (kit, y) => torsoBind(kit)({ y });

// Waist belt: a loop at height y with a front buckle, hanging a frog. o: { y, width, color, buckleX }
export function belt(ctx, o = {}) {
  const { kit } = ctx, y = o.y ?? 1.075, w = o.width ?? 0.05, color = o.color ?? 0x1a110b, N = 72, pts = [];
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * TAU - Math.PI, r = Math.max(nbrR(ctx, y, th), 0.15) + (o.off ?? 0.016), yy = y + (o.tilt ?? 0.012) * Math.sin(th * 1.0 + 0.5) * 0;
    pts.push(V(Math.sin(th) * r * (th > 0.01 || th < -0.01 ? 1 : 1), yy, 0.012 + Math.cos(th) * r));
  }
  skinGeo(kit, SL.leather, ribbonGeo(pts, w, 0.008, outward, { caps: false, flip: false }), { bind: 'Hips', color: (p) => shade(color, 0.8 + 0.4 * fbm(p.x * 50 + p.z * 50, p.y * 50)), ao: 0.3 });
  // close the loop (ribbon with end caps false; seam hidden under the buckle)
  const f = pts.find((p, i) => i === Math.round(N / 2) + 0) || pts[0];
  const bp = V(0, y, 0.012 + Math.max(nbrR(ctx, y, 0), 0.15) + (o.off ?? 0.016) + 0.004);
  buckle(ctx, bp, o.buckleW ?? 0.062, w * 0.95, { bind: 'Hips' });
  return pts;
}

// Cutlass in a scabbard hung at the left hip, hilt up. p0 = throat of the scabbard.
export function cutlass(ctx, o = {}) {
  const { kit, J } = ctx, sx = o.sideX || (() => 0.2);
  const p0 = o.p0 ?? V(sx(1.0) + 0.025, 1.0, 0.03), tip = o.tip ?? V(sx(0.5) + 0.075, 0.3, -0.2);
  const mid1 = V(sx(0.8) + 0.04, 0.78, 0.0), mid2 = V(sx(0.6) + 0.055, 0.55, -0.08);
  const curve = new THREE.CatmullRomCurve3([p0, mid1, mid2, tip], false, 'catmullrom', 0.5);
  const leather = o.leather ?? 0x1c1410;
  // scabbard: flattened tube
  const rows = [], N = 28, NS = 12;
  const fr = curve.computeFrenetFrames(N, false);
  for (let i = 0; i <= N; i++) {
    const t = i / N, c = curve.getPointAt(t), w = mix(0.021, 0.012, Math.pow(t, 1.4)), h = mix(0.0135, 0.008, t), ring = [];
    const sd = V(1, 0, 0.2).normalize(), tg = curve.getTangentAt(t), nm = new THREE.Vector3().crossVectors(tg, sd).normalize(), sd2 = new THREE.Vector3().crossVectors(nm, tg).normalize();
    for (let k = 0; k < NS; k++) { const a = (k / NS) * TAU; ring.push(c.clone().addScaledVector(sd2, Math.cos(a) * w).addScaledVector(nm, Math.sin(a) * h)); }
    rows.push(ring);
  }
  const sg = gridGeo(rows, { closed: true });
  const capped = mergeG([sg]);
  const sbind = (p) => { const t = 1 - sstep(p.y, 0.55, 0.95); return [['Hips', (1 - t) * 0.7 + 0.15], ['LeftUpLeg', t * 0.8 + 0.15]]; };
  skinGeo(kit, SL.leather, sg, { bind: sbind, color: (p) => shade(leather, 0.75 + 0.5 * fbm(p.x * 60 + p.z * 40, p.y * 30)), ao: 0.3 });
  // brass locket and chape and a mid band
  const band = (t0, t1, r, gc = GOLD) => {
    const rr = [];
    for (let j = 0; j <= 6; j++) { const t = mix(t0, t1, j / 6), c = curve.getPointAt(t), tg = curve.getTangentAt(t), sd = V(1, 0, 0.2).normalize(), nm = new THREE.Vector3().crossVectors(tg, sd).normalize(), sd2 = new THREE.Vector3().crossVectors(nm, tg).normalize(), w = mix(0.021, 0.012, Math.pow(t, 1.4)) + r, h = mix(0.0135, 0.008, t) + r, ring = []; for (let k = 0; k < NS; k++) { const a = (k / NS) * TAU; ring.push(c.clone().addScaledVector(sd2, Math.cos(a) * w).addScaledVector(nm, Math.sin(a) * h)); } rr.push(ring); }
    skinGeo(kit, SL.gilt, gridGeo(rr, { closed: true }), { bind: sbind, color: () => gc, ao: 0.1 });
  };
  band(0.0, 0.1, 0.0025); band(0.45, 0.47, 0.0025); band(0.93, 1.0, 0.002);
  const tipS = new THREE.SphereGeometry(0.0125, 8, 6); tipS.translate(tip.x, tip.y, tip.z); skinGeo(kit, SL.gilt, tipS, { bind: sbind, color: () => GOLD, ao: 0.1 });
  // hilt: grip (wire-wrapped), knuckle bow, cross guard, pommel
  const tg0 = curve.getTangentAt(0).clone().negate(), hp = p0.clone();
  const up = V(-0.07, 1, 0.12).normalize(), side = V(1, 0, 0.0);
  const gripTop = hp.clone().addScaledVector(up, 0.115);
  const gripPts = [hp.clone().addScaledVector(up, 0.012), gripTop];
  skinGeo(kit, SL.leather, tubeGeo([gripPts[0], gripPts[1]], (t) => 0.0125 + 0.0018 * Math.sin(t * Math.PI * 6), 10, 24, {}), { bind: 'Hips', color: (p) => shade(0x1a1410, 0.8 + 0.5 * (Math.sin(p.y * 380) > 0.2 ? 1 : 0.3)), ao: 0.2 });
  skinGeo(kit, SL.gilt, sphereG(gripTop.clone().addScaledVector(up, 0.007), [0.017, 0.016, 0.017], 10), { bind: 'Hips', color: () => GOLD, ao: 0.1 });
  skinGeo(kit, SL.gilt, boxG(hp.clone(), [0.052, 0.006, 0.01], [0, 0, -0.05]), { bind: 'Hips', color: () => GOLD, ao: 0.1 }); // cross guard
  skinGeo(kit, SL.gilt, tubeGeo([hp.clone().add(V(0.05, 0.001, 0)), hp.clone().add(V(0.062, 0.05, 0.012)), hp.clone().addScaledVector(up, 0.09).add(V(0.04, 0, 0.012)), gripTop.clone().add(V(0.015, 0, 0.0))], 0.0042, 8, 30), { bind: 'Hips', color: () => GOLD, ao: 0.1 }); // knuckle bow
  skinGeo(kit, SL.gilt, tubeGeo([hp.clone().add(V(-0.05, 0.003, 0)), hp.clone().add(V(-0.056, 0.012, 0.006))], 0.0045, 8, 4), { bind: 'Hips', color: () => GOLD, ao: 0.1 });
  skinGeo(kit, SL.gilt, new THREE.SphereGeometry(0.0085, 8, 6).translate(hp.x + 0.052, hp.y, hp.z), { bind: 'Hips', color: () => GOLD, ao: 0.1 });
  // frog: leather loop tying the scabbard to the belt
  const fg = new THREE.TorusGeometry(0.024, 0.006, 6, 18); fg.rotateX(Math.PI / 2); fg.scale(1, 1, 0.8); fg.translate(p0.x, p0.y - 0.03, p0.z);
  skinGeo(kit, SL.leather, fg, { bind: 'Hips', color: () => 0x1a110b, ao: 0.2 });
  return curve;
}

// Flintlock pistol built in a local frame (+x muzzle, +y up, +z lock side) and placed with a matrix.
// at: butt position, d: muzzle direction, side: the direction the lock plate faces (made orthogonal to d).
export function pistol(ctx, at, d0, side0, o = {}) {
  const { kit } = ctx, bind = o.bind || 'Hips', sc = o.scale ?? 1;
  const dx = d0.clone().normalize(), dz = side0.clone().sub(dx.clone().multiplyScalar(side0.dot(dx))).normalize(), dy = new THREE.Vector3().crossVectors(dz, dx).normalize();
  const M = new THREE.Matrix4().makeBasis(dx, dy, dz).setPosition(at).multiply(new THREE.Matrix4().makeScale(sc, sc, sc)), Mi = M.clone().invert(), flip = M.determinant() < 0;
  const wood = o.wood ?? 0x5a3418;
  const put = (slotN, geo, colorFn, ao = 0.25) => {
    geo.applyMatrix4(M);
    if (flip) { if (geo.index) { const a = geo.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } } else { const p = geo.attributes.position; for (let i = 0; i < p.count; i += 3) { const x = p.getX(i + 1), y = p.getY(i + 1), z = p.getZ(i + 1); p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)); p.setXYZ(i + 2, x, y, z); } } }
    geo.computeVertexNormals();
    skinGeo(kit, slotN, geo, { bind, color: (p) => colorFn(p.clone().applyMatrix4(Mi)), ao });
  };
  const L = (x, y, z) => V(x, y, z);
  const grain = (q) => shade(wood, 0.62 + 0.7 * fbm(q.x * 26 + 3, (q.y * 0.4 + q.z) * 170));
  // stock: from the butt, curving up into the wrist, then forward under the barrel
  put(SL.wood, tubeGeo([L(-0.125, -0.092, 0), L(-0.108, -0.05, 0), L(-0.075, -0.016, 0), L(-0.03, -0.004, 0), L(0.05, -0.006, 0), L(0.14, -0.011, 0), L(0.205, -0.012, 0)], (t) => mix(0.03, 0.0125, Math.pow(t, 0.55)), 12, 40, { ex: 0.92 }), grain);
  put(SL.gilt, new THREE.SphereGeometry(0.028, 12, 8).scale(0.95, 0.5, 0.7).translate(-0.127, -0.1, 0), () => BRASS, 0.1); // butt cap
  put(SL.gilt, new THREE.SphereGeometry(0.0085, 8, 6).translate(-0.13, -0.075, 0), () => BRASS, 0.1);
  // barrel: octagonal steel with brass bands and a flared muzzle
  const barrel = new THREE.CylinderGeometry(0.0105, 0.0125, 0.27, 8); barrel.rotateZ(-Math.PI / 2); barrel.translate(0.1, 0.014, 0);
  put(SL.steel, barrel, (q) => shade(0x6c6f76, 0.8 + 0.4 * fbm(q.x * 40, q.y * 80)), 0.2);
  for (const x of [-0.028, 0.06, 0.15]) { const b = new THREE.CylinderGeometry(0.0135, 0.0135, 0.009, 10); b.rotateZ(-Math.PI / 2); b.translate(x, 0.014, 0); put(SL.gilt, b, () => GOLD, 0.1); }
  { const m = new THREE.CylinderGeometry(0.0165, 0.012, 0.022, 10); m.rotateZ(-Math.PI / 2); m.translate(0.228, 0.014, 0); put(SL.steel, m, () => 0x55585e, 0.1); }
  // lock plate, cock (hammer), pan and frizzen
  put(SL.steel, new THREE.BoxGeometry(0.095, 0.03, 0.0045).translate(0.0, 0.005, 0.0135), (q) => shade(0x92949a, 0.85 + 0.3 * fbm(q.x * 60, q.y * 60)), 0.2);
  put(SL.steel, tubeGeo([L(-0.03, 0.01, 0.017), L(-0.04, 0.03, 0.017), L(-0.026, 0.048, 0.017), L(-0.005, 0.05, 0.017)], 0.0048, 7, 14), () => 0x5a5c62, 0.2);
  put(SL.steel, new THREE.BoxGeometry(0.014, 0.011, 0.008).translate(-0.004, 0.05, 0.017), () => 0x4a4c52, 0.2);
  put(SL.steel, new THREE.BoxGeometry(0.02, 0.026, 0.004).translate(0.034, 0.03, 0.0155).applyMatrix4(new THREE.Matrix4().makeRotationZ(-0.25)), () => 0x6a6c72, 0.2);
  put(SL.steel, new THREE.CylinderGeometry(0.0075, 0.009, 0.008, 8).translate(0.012, 0.022, 0.012), () => 0x7a7c82, 0.2);
  // trigger guard and trigger
  put(SL.gilt, tubeGeo([L(-0.045, -0.012, 0), L(-0.05, -0.04, 0), L(-0.012, -0.05, 0), L(0.025, -0.036, 0), L(0.03, -0.01, 0)], 0.0034, 6, 24), () => BRASS, 0.1);
  put(SL.steel, new THREE.BoxGeometry(0.004, 0.02, 0.004).translate(-0.022, -0.02, 0), () => 0x55585e, 0.1);
  // ramrod pipes and the rod end under the barrel
  for (const x of [0.07, 0.15, 0.205]) { const b = new THREE.CylinderGeometry(0.0062, 0.0062, 0.012, 8); b.rotateZ(-Math.PI / 2); b.translate(x, -0.0075, 0); put(SL.gilt, b, () => BRASS, 0.1); }
  // sideplate: small brass escutcheon on the wrist
  put(SL.gilt, new THREE.SphereGeometry(0.012, 8, 6).scale(1.4, 0.6, 0.3).translate(-0.065, -0.012, 0.0135), () => GOLD, 0.1);
}
