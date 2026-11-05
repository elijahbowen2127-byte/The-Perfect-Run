// Shared parts of the three pirate captain designs: setup, skin tone, face dressing (eyepatch, scars, earring),
// hair and beard cards, tall boots, the parrot.
import * as THREE from 'three';
import { makeKit, V } from './armor.js';
import * as K from './corsair_lib.js';
const { TAU, sstep, clamp, mix, rng, fbm, vnoise, skinGeo, gridGeo, surfGeo, ribbonGeo, tubeGeo, mergeG, legBind, boxG, sphereG, orient, featherGeo, col } = K;

export const SL = K.slot;

export function setup(scene, skin) {
  const real = K.real;
  const mats = [K.dsided(real('felt', { scale: 2, bump: 0.35 }), 'w'), real('leather', { scale: 5, bump: 0.04 }), real('gilt', { scale: 2 }), K.dsided(real('cloth', { scale: 4, bump: 0.12 }), 'c'), real('steel'), K.dsided(real('felt', { scale: 3, bump: 0.6 }), 'f'), K.hairMat(), K.dsided(real('silk', { scale: 2.5 }), 's'), K.softMat(0.5), K.softMat(0.3, 0, THREE.FrontSide), K.softMat(0.42, 0, THREE.FrontSide), real('rope', { scale: 6, bump: 0.2 }), real('felt', { scale: 2, bump: 0.35 })];
  scene.updateMatrixWorld(true);
  const ctx = { scene, skin, mats };
  ctx.top = K.findMesh(scene, /Outfit_Top/); ctx.bottom = K.findMesh(scene, /Outfit_Bottom/); ctx.shoes = K.findMesh(scene, /Footwear/);
  ctx.head = K.findMesh(scene, /Wolf3D_Head/); ctx.bodyM = K.findMesh(scene, /Wolf3D_Body/); ctx.beardM = K.findMesh(scene, /Wolf3D_Beard/);
  ctx.surf = K.sampleTorso(ctx.top, 0.01);
  ctx.hs = headSurface(ctx.head, [K.findMesh(scene, /EyeLeft/), K.findMesh(scene, /EyeRight/)].filter(Boolean));
  ctx.kit = makeKit(scene, mats, 'corsair_gear');
  ctx.J = ctx.kit.J;
  return ctx;
}

// Skin tone: tint the face and body textures towards the skin colour (the veteran's own tone as reference).
export function tintSkin(ctx, c) {
  const ref = col(0xe4b8a2), t = col(c), k = new THREE.Color(Math.min(1, t.r / ref.r), Math.min(1, t.g / ref.g), Math.min(1, t.b / ref.b));
  if (ctx.head) { ctx.head.material = ctx.head.material.clone(); ctx.head.material.color.copy(k); }
  if (ctx.bodyM) { ctx.bodyM.material = ctx.bodyM.material.clone(); ctx.bodyM.material.color.copy(t).multiplyScalar(1.0); }
}

// ---------------------------------------------------------------- head surface
function headSurface(mesh, extra = []) {
  const C = V(0, 1.72, 0.02), NA = 90, NE = 45, R = new Float32Array(NA * NE).fill(0), v = V(0, 0, 0);
  const X0 = -0.11, Y0 = 1.5, CS = 0.003, NX = 74, NY = 120, Z = new Float32Array(NX * NY).fill(-9);
  // rasterise triangles into a depth grid (max z) and bin vertices radially
  for (const [msh, onlyZ] of [[mesh, false], ...extra.map((m) => [m, true])]) {
    msh.skeleton.update();
    const pp = msh.geometry.attributes.position, ix = msh.geometry.index ? msh.geometry.index.array : null, n = pp.count, W = [];
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(pp, i); msh.applyBoneTransform(i, v); v.applyMatrix4(msh.matrixWorld); W.push(v.clone()); }
    if (!onlyZ) for (const q of W) {
      if (q.y < 1.55) continue;
      const d = q.clone().sub(C), r = d.length(), az = Math.atan2(d.x, d.z), el = Math.asin(clamp(d.y / r, -1, 1));
      const a = Math.floor((az + Math.PI) / TAU * NA) % NA, e = clamp(Math.floor((el + Math.PI / 2) / Math.PI * NE), 0, NE - 1);
      if (r > R[a * NE + e]) R[a * NE + e] = r;
    }
    const T = ix ? ix.length / 3 : n / 3;
    for (let t = 0; t < T; t++) {
      const A = W[ix ? ix[t * 3] : t * 3], B = W[ix ? ix[t * 3 + 1] : t * 3 + 1], Cc = W[ix ? ix[t * 3 + 2] : t * 3 + 2];
      const x0 = Math.min(A.x, B.x, Cc.x), x1 = Math.max(A.x, B.x, Cc.x), y0 = Math.min(A.y, B.y, Cc.y), y1 = Math.max(A.y, B.y, Cc.y);
      if (y1 < Y0 || y0 > Y0 + NY * CS || x1 < X0 || x0 > X0 + NX * CS) continue;
      const den = (B.y - Cc.y) * (A.x - Cc.x) + (Cc.x - B.x) * (A.y - Cc.y);
      if (Math.abs(den) < 1e-12) continue;
      for (let yi = Math.max(0, Math.floor((y0 - Y0) / CS)); yi <= Math.min(NY - 1, Math.floor((y1 - Y0) / CS)); yi++) for (let xi = Math.max(0, Math.floor((x0 - X0) / CS)); xi <= Math.min(NX - 1, Math.floor((x1 - X0) / CS)); xi++) {
        const px = X0 + (xi + 0.5) * CS, py = Y0 + (yi + 0.5) * CS;
        const l1 = ((B.y - Cc.y) * (px - Cc.x) + (Cc.x - B.x) * (py - Cc.y)) / den, l2 = ((Cc.y - A.y) * (px - Cc.x) + (A.x - Cc.x) * (py - Cc.y)) / den, l3 = 1 - l1 - l2;
        if (l1 < -0.02 || l2 < -0.02 || l3 < -0.02) continue;
        const z = l1 * A.z + l2 * B.z + l3 * Cc.z;
        if (z > Z[yi * NX + xi]) Z[yi * NX + xi] = z;
      }
    }
  }
  for (let it = 0; it < 6; it++) for (let a = 0; a < NA; a++) for (let e = 0; e < NE; e++) if (R[a * NE + e] === 0) {
    let s = 0, n = 0; for (const [da, de] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const r = R[((a + da + NA) % NA) * NE + clamp(e + de, 0, NE - 1)]; if (r > 0) { s += r; n++; } }
    if (n) R[a * NE + e] = s / n;
  }
  for (let it = 0; it < 3; it++) for (let yi = 0; yi < NY; yi++) for (let xi = 0; xi < NX; xi++) if (Z[yi * NX + xi] < -8) {
    let s = 0, n = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const z = Z[clamp(yi + dy, 0, NY - 1) * NX + clamp(xi + dx, 0, NX - 1)]; if (z > -8) { s += z; n++; } }
    if (n) Z[yi * NX + xi] = s / n;
  }
  const rad = (az, el) => {
    const fa = ((az + Math.PI) / TAU) * NA - 0.5, fe = ((el + Math.PI / 2) / Math.PI) * NE - 0.5, a = Math.floor(fa), e = clamp(Math.floor(fe), 0, NE - 2), ta = fa - a, te = clamp(fe - e, 0, 1);
    const g = (aa, ee) => R[((aa % NA) + NA) % NA * NE + ee];
    return mix(mix(g(a, e), g(a + 1, e), ta), mix(g(a, e + 1), g(a + 1, e + 1), ta), te);
  };
  return {
    C,
    // a point on the scalp/face in direction (az from +Z toward +X, el up), pushed out by off
    pt: (az, el, off = 0) => { const r = rad(az, el) + off; return V(C.x + r * Math.cos(el) * Math.sin(az), C.y + r * Math.sin(el), C.z + r * Math.cos(el) * Math.cos(az)); },
    // face depth z at (x, y)
    front: (x, y) => { const fx = (x - X0) / CS - 0.5, fy = (y - Y0) / CS - 0.5, xi = clamp(Math.floor(fx), 0, NX - 2), yi = clamp(Math.floor(fy), 0, NY - 2), tx = clamp(fx - xi, 0, 1), ty = clamp(fy - yi, 0, 1); const g = (a, b) => Z[b * NX + a]; return mix(mix(g(xi, yi), g(xi + 1, yi), tx), mix(g(xi, yi + 1), g(xi + 1, yi + 1), tx), ty); },
  };
}

// ---------------------------------------------------------------- face dressing
// Leather eyepatch over the character's left eye (+X) with a strap round the head.
export function eyepatch(ctx, { color = 0x0f0d0c, side = 1 } = {}) {
  const { kit, hs } = ctx, cx = 0.031 * side, cy = 1.726;
  const f = (u, v) => { // u, v in 0..1 -> point on the face, an ellipse patch
    const a = (u - 0.5) * 2, b = (v - 0.5) * 2, r = Math.min(1, Math.hypot(a, b)), k = Math.hypot(a, b) > 0 ? r / Math.hypot(a, b) : 0;
    const x = cx + a * k * 0.027 * side, y = cy + b * k * 0.024 - a * k * 0.004;
    return V(x, y, hs.front(x, y) + 0.0045 + (1 - r * r) * 0.0015);
  };
  skinGeo(kit, SL.matte, surfGeo(14, 10, f, { flip: true }), { bind: 'Head', color: (p) => shade(color, 0.9 + 0.3 * fbm(p.x * 300, p.y * 300)), ao: 0.1 });
  // strap: from the patch's upper corner diagonally across the forehead, round the back and in under the other side
  const sx = side, cp = [[0.02, 0.07], [-0.3, 0.3], [-0.95, 0.46], [-1.8, 0.45], [-2.9, 0.33], [-3.9, 0.34], [-4.7, 0.33], [-5.2, 0.17], [-5.75, 0.1]];
  const path = new THREE.CatmullRomCurve3(cp.map(([a, e]) => hs.pt(sx * a * 1.0, e, 0.0045 + 0.0)), false, 'catmullrom', 0.5).getPoints(70);
  skinGeo(kit, SL.matte, ribbonGeo(path, 0.0105, 0.0028, V(0, 1, 0)), { bind: 'Head', color: () => shade(color, 1.1), ao: 0.1 });
}
const shade = K.shade;

// A thin scar: a raised pale line along the face from (x0,y0) to (x1,y1), with little cross-stitch marks.
export function scar(ctx, x0, y0, x1, y1, { color = 0xc98c80, width = 0.0035, bow = 0.004, ticks = 5 } = {}) {
  const { kit, hs } = ctx, pts = [];
  for (let k = 0; k <= 12; k++) { const t = k / 12, x = mix(x0, x1, t) + bow * Math.sin(t * Math.PI), y = mix(y0, y1, t); pts.push(V(x, y, hs.front(x, y) + 0.0008)); }
  skinGeo(kit, SL.matte, ribbonGeo(pts, width, 0.0016, V(0, 0, 1)), { bind: 'Head', color: () => color, ao: 0.0 });
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
  for (let k = 0; k < ticks; k++) {
    const t = (k + 0.5) / ticks, x = mix(x0, x1, t) + bow * Math.sin(t * Math.PI), y = mix(y0, y1, t), a = V(x - nx * 0.0045, y - ny * 0.0045, 0), b = V(x + nx * 0.0045, y + ny * 0.0045, 0);
    a.z = hs.front(a.x, a.y) + 0.0006; b.z = hs.front(b.x, b.y) + 0.0006;
    skinGeo(kit, SL.matte, ribbonGeo([a, b], 0.0014, 0.0012, V(0, 0, 1), { caps: false }), { bind: 'Head', color: () => color, ao: 0 });
  }
}

export function earring(ctx, side = 1, { color = 0xd9b350, y = 1.69, r = 0.012 } = {}) {
  const { kit, hs } = ctx;
  const p = hs.pt(side * Math.PI / 2, (y - hs.C.y) / 0.1, 0.0);
  const g = new THREE.TorusGeometry(r, 0.0016, 6, 20); g.rotateY(Math.PI / 2); g.translate(p.x + side * 0.004, p.y - r * 0.9, p.z + 0.012);
  kit.add(SL.gilt, g, 'Head', color, 0.1);
}

// ---------------------------------------------------------------- hair and beard
// A flattened tube (a lock of hair) along pts: width w(t) across, thickness h(t) along `out(p)`.
function lockTube(pts, wf, hf, out, ni = 8) {
  const n = pts.length, rows = [];
  for (let i = 0; i < n; i++) {
    const t = pts[Math.min(n - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize(), o = out(pts[i]);
    let sd = new THREE.Vector3().crossVectors(t, o); if (sd.lengthSq() < 0.02) sd.set(1, 0, 0); sd.normalize();
    const nm = new THREE.Vector3().crossVectors(sd, t).normalize(), u = i / (n - 1), w = wf(u) * 0.5, h = hf(u) * 0.5, ring = [];
    for (let k = 0; k < ni; k++) { const a = (k / ni) * TAU; ring.push(pts[i].clone().addScaledVector(sd, Math.cos(a) * w).addScaledVector(nm, Math.sin(a) * h)); }
    rows.push(ring);
  }
  const g = gridGeo(rows, { closed: true });
  // close the tip
  return g;
}
const lockW = (w, tip = 0.12) => (u) => w * (Math.sin(Math.min(1, u * 6 + 0.08) * Math.PI * 0.5) * 0.7 + 0.3) * (1 - (1 - tip) * Math.pow(u, 1.6));
// Hair in locks. Roots sit on the scalp at (az, el); a lock follows the head surface down to elEnd, then hangs.
// spec: { colors, locks:[{az, el, len, w, curl, sweep}], seed, bind }
export function hair(ctx, spec) {
  const { kit, hs } = ctx, R = rng(spec.seed || 7), cols = spec.colors.map(col), surf = ctx.surf;
  const C = hs.C, out = (p) => V(p.x - C.x, 0.25, p.z - C.z).normalize();
  for (const cl of spec.locks) {
    const wob = R() * 10, cc = cols[Math.floor(R() * cols.length)].clone().multiplyScalar(0.8 + 0.4 * R()), N = 14, pts = [];
    const elEnd = cl.elEnd ?? -0.1, scalpArc = Math.max(0, cl.el - elEnd) * 0.115, hang0 = hs.pt(cl.az, elEnd, 0.012 + (cl.lift ?? 0));
    for (let k = 0; k < N; k++) {
      const sc = (k / (N - 1)) * cl.len; let p;
      if (sc <= scalpArc) { const f = sc / Math.max(1e-4, scalpArc); p = hs.pt(cl.az, cl.el - f * (cl.el - elEnd), 0.004 + (0.008 + (cl.lift ?? 0)) * f); }
      else {
        const d = sc - scalpArc, o = Math.min(1, d / 0.08), sw = cl.curl ?? 1;
        p = V(hang0.x + Math.sin(cl.az) * 0.014 * o + Math.sin(d * 17 + wob) * 0.011 * sw * Math.min(1, d * 7), hang0.y - d * 0.97, hang0.z + Math.cos(cl.az) * 0.014 * o + Math.cos(d * 15 + wob * 1.3) * 0.008 * sw * Math.min(1, d * 7) + (cl.sweep ?? 0) * d);
        if (p.y < 1.585) { const th = Math.atan2(p.x, p.z - 0.01), rr = Math.hypot(p.x, p.z - 0.01), need = (spec.clampR ? spec.clampR(p.y, th) : surf(p.y, th) + 0.01) + 0.004 * R(); if (rr < need) { p.x = Math.sin(th) * need; p.z = 0.01 + Math.cos(th) * need; } }
      }
      pts.push(p);
    }
    const w = cl.w ?? 0.04;
    skinGeo(kit, SL.hair, lockTube(pts, lockW(w, cl.tip ?? 0.1), (u) => 0.014 * (1 - 0.5 * u), out), { bind: spec.bind || 'Head', color: (p) => cc.clone().multiplyScalar(0.85 + 0.3 * vnoise(p.x * 40, p.y * 25)), ao: 0.45 });
  }
}
// Beard as a shaped mass over the jaw and chin, with a forked tip, plus a few free locks. o: { colors, tip, width, grey }
export function beardMass(ctx, o = {}) {
  const { kit, hs } = ctx, tipY = o.tipY ?? 1.5, cc = col(o.color ?? 0x2a1a10), grey = col(o.greyColor ?? 0x9a948a), R = rng(o.seed ?? 4);
  const faceZ = (x, y) => (y > 1.635 ? hs.front(clamp(x, -0.09, 0.09), y) : Math.max(hs.front(clamp(x, -0.09, 0.09), 1.635), 0.03) - (1.635 - y) * 0.32);
  const f = (u01, v) => { // u in -1..1 across, v in 0..1 down
    const u = u01 * 2 - 1, au = Math.abs(u), y0 = 1.632 + 0.1 * Math.pow(au, 1.6), y1 = mix(1.64, tipY, Math.pow(1 - au, 1.25)), y = mix(y0, y1, Math.pow(v, 0.9));
    const half = 0.094, x = u * half * (1 - 0.35 * Math.pow(v, 1.6) * (1 - au)) * (1 - 0.5 * Math.pow(v, 2.0));
    const fork = (o.fork ?? 0.02) * Math.pow(v, 1.6) * Math.sign(u) * (1 - au), xx = x + fork;
    const th = 0.005 + 0.022 * Math.sin(Math.min(1, v * 1.6) * Math.PI * 0.6) * (1 - 0.6 * au) + 0.012 * v;
    return V(xx, y, faceZ(xx, y) + th + 0.004 + 0.008 * Math.sin(u * 9 + v * 6) * v);
  };
  // the hole for the mouth: skip rows crossing |u|<0.3 between y 1.64 and 1.7 by pushing them behind the moustache (hidden)
  const g = surfGeo(40, 24, f, { flip: false });
  skinGeo(kit, SL.hair, g, { bind: 'Head', color: (p) => { const gr = (o.grey ?? 0.3) * (vnoise(p.x * 70, p.y * 22) > 0.55 ? 1 : 0.0) * (1 - clamp((p.y - 1.55) * 8, 0, 1) * 0.0); return cc.clone().lerp(grey, gr).multiplyScalar(0.8 + 0.35 * vnoise(p.x * 120, p.y * 40)); }, ao: 0.35 });
  // free locks: forked tip strands
  if (o.locks === false) return;
  const out = (p) => V(Math.sign(p.x) * Math.min(0.6, Math.abs(p.x) * 6), 0.1, 1).normalize();
  for (const [x, ln] of [[-0.012, 0.09], [0.012, 0.09], [0.0, 0.07], [-0.03, 0.05], [0.03, 0.05]]) {
    const pts = []; for (let k = 0; k < 9; k++) { const t = k / 8; pts.push(V(x * (1 + t * 0.5) + Math.sin(t * 5 + x * 90) * 0.004, tipY + 0.03 - t * ln, faceZ(x, tipY + 0.03) + 0.025 + 0.006 * t)); }
    skinGeo(kit, SL.hair, lockTube(pts, lockW(0.014 + R() * 0.006, 0.05), (u) => 0.012 * (1 - 0.5 * u), out), { bind: 'Head', color: () => cc.clone().multiplyScalar(0.8 + 0.3 * R()), ao: 0.4 });
  }
}

// ---------------------------------------------------------------- tall boots
// A leather boot: foot loft, shaft with ankle wrinkles, a folded-down bucket top. opts: { color, top, cuff, flare, sole }
export function boot(ctx, A, o = {}) {
  const { kit, J } = ctx, s = A === 'Left' ? 1 : -1;
  const an = J(A + 'Foot'), kn = J(A + 'Leg'), hp = J(A + 'UpLeg'), tb = J(A + 'ToeBase'), te = J(A + 'Toe_End');
  const color = o.color ?? 0x2a1a10, top = o.top ?? 0.66, cuffH = o.cuff ?? 0.11, flare = o.flare ?? 0.115, sole = o.sole ?? 0x120c08;
  const cen = (y) => y >= kn.y ? V(mix(kn.x, hp.x, (y - kn.y) / (hp.y - kn.y)), y, mix(kn.z, hp.z, (y - kn.y) / (hp.y - kn.y))) : V(mix(an.x, kn.x, (y - an.y) / (kn.y - an.y)), y, mix(an.z, kn.z, (y - an.y) / (kn.y - an.y)));
  const wear = (p, base) => { const n = fbm(p.x * 70 + p.z * 30, p.y * 40), sc = vnoise(p.x * 300 + p.y * 50, p.z * 300) > 0.86 ? 1.25 : 1; return shade(base, (0.78 + 0.5 * n) * sc); };
  // shaft (flaring into the bucket top)
  const prof = (y) => {
    const t = clamp((y - an.y) / (top - an.y), 0, 1), calf = Math.exp(-Math.pow((t - 0.42) / 0.3, 2)), fl = Math.pow(sstep(y, top - cuffH, top), 1.7) * (flare - 0.075);
    return [0.052 + 0.02 * calf + fl, 0.058 + 0.022 * calf + fl * 1.04];
  };
  const NY = 44, NS = 32, rows = [], bind = legBind(kit, A), y0 = 0.05;
  for (let j = 0; j <= NY; j++) {
    const y = mix(y0, top, j / NY), c = cen(y), [rx, rz] = prof(y), ring = [];
    const wr = 1 + 0.045 * Math.sin(y * 150) * (1 - sstep(y, 0.2, 0.42)) * (0.5 + 0.5 * Math.sin(y * 31));
    for (let k = 0; k < NS; k++) { const a = (k / NS) * TAU, cr = 1 + 0.05 * Math.sin(a * 5 + y * 20) * sstep(y, top - cuffH, top); ring.push(V(c.x + Math.sin(a) * rx * wr * cr, y, c.z + Math.cos(a) * rz * wr * cr)); }
    rows.push(ring);
  }
  skinGeo(kit, SL.leather, gridGeo(rows, { closed: true, flip: true }), { bind, color: (p) => wear(p, color), ao: 0.28 });
  // rolled lip and the lining inside the bucket
  { const c = cen(top), [rx, rz] = prof(top), g = new THREE.TorusGeometry(1, 0.0065, 6, 40); g.rotateX(Math.PI / 2); g.scale(rx, 1, rz); g.translate(c.x, top, c.z); skinGeo(kit, SL.leather, g, { bind, color: (p) => wear(p, shade(color, 1.15)), ao: 0.2 });
    const rr = []; for (const [dy, f] of [[0, 0.985], [-0.03, 0.9], [-0.07, 0.8]]) { const ring = [], [qx, qz] = prof(top + dy); for (let k = 0; k < NS; k++) { const a = (k / NS) * TAU; ring.push(V(c.x + Math.sin(a) * qx * f, top + dy, c.z + Math.cos(a) * qz * f)); } rr.push(ring); }
    skinGeo(kit, SL.leather, gridGeo(rr, { closed: true, flip: false }), { bind, color: (p) => shade(o.lining ?? 0x6a4a2a, 0.7 + 0.5 * fbm(p.x * 50, p.y * 50)), ao: 0.3 }); }
  // foot: a loft along z through a table of stations [z rel. ankle, half width, top height, bottom height]
  {
    const tbl = [[-0.1, 0.012, 0.03, 0.02], [-0.09, 0.034, 0.07, 0.012], [-0.07, 0.049, 0.115, 0.01], [-0.04, 0.056, 0.16, 0.01], [0.0, 0.06, 0.16, 0.008], [0.04, 0.062, 0.14, 0.006], [0.09, 0.064, 0.102, 0.006], [0.14, 0.059, 0.072, 0.006], [0.19, 0.046, 0.054, 0.006], [0.23, 0.028, 0.04, 0.007], [0.245, 0.01, 0.026, 0.01]];
    const at = (k, z) => { let i = 0; while (i < tbl.length - 2 && tbl[i + 1][0] < z) i++; const t = clamp((z - tbl[i][0]) / (tbl[i + 1][0] - tbl[i][0]), 0, 1), s = t * t * (3 - 2 * t); return mix(tbl[i][k], tbl[i + 1][k], s); };
    const frows = [], N = 34, z0 = tbl[0][0], z1 = tbl[tbl.length - 1][0];
    for (let q = 0; q <= N; q++) {
      const z = mix(z0, z1, q / N), w = at(1, z), hb = at(3, z), ht = hb + (at(2, z) - hb) * (o.lowFoot ?? 1), ring = [];
      for (let kk = 0; kk < 18; kk++) {
        const a = (kk / 18) * TAU, cx = Math.sin(a), cy = Math.cos(a), sx = Math.sign(cx) * Math.pow(Math.abs(cx), 0.75), sy = Math.sign(cy) * Math.pow(Math.abs(cy), 0.6);
        const yy = sy > 0 ? mix((ht + hb) / 2, ht, sy) : mix((ht + hb) / 2, hb, -sy);
        ring.push(V(an.x + sx * w * (o.footWide ?? 1), yy, an.z + (z > 0.04 ? 0.04 + (z - 0.04) * (o.footLen ?? 1) : z)));
      }
      frows.push(ring);
    }
    skinGeo(kit, SL.leather, gridGeo(frows, { closed: true, flip: true }), {
      bind: (p) => { const t = sstep(p.z, tb.z - 0.07, tb.z + 0.03); return t < 0.01 ? [[A + 'Foot', 1]] : [[A + 'Foot', 1 - t], [A + 'ToeBase', t]]; },
      color: (p) => { if (p.y < 0.019) return sole; return wear(p, color); }, ao: 0.3,
    });
    // heel block and sole slab
    kit.add(SL.leather, boxG(V(an.x, 0.018, an.z - 0.045), [0.042, 0.018, 0.034]), A + 'Foot', sole, 0.15);
    // spur
    if (o.spur !== false) {
      const sp = V(an.x, an.y + 0.015, an.z - 0.07);
      const g = new THREE.TorusGeometry(0.03, 0.0035, 6, 18, Math.PI * 1.5); g.rotateY(Math.PI / 2); g.translate(sp.x, sp.y, sp.z + 0.0); kit.add(SL.gilt, g, A + 'Foot', 0xd9b350, 0.1);
      kit.add(SL.gilt, orient(new THREE.CylinderGeometry(0.0025, 0.009, 0.034, 8), sp.clone().add(V(0, 0, -0.03)), sp.clone().add(V(0, -0.012, -0.066))), A + 'Foot', 0xd9b350, 0.1);
      kit.add(SL.gilt, sphereG(sp.clone().add(V(0, -0.013, -0.068)), [0.009, 0.009, 0.009], 8), A + 'Foot', 0xd9b350, 0.1);
    }
  }
}
