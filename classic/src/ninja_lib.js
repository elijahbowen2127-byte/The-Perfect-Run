// Local helpers for the ninja designs: measured body fit, noisy cloth tubes with folds, ribbons, small parts.
// Everything works in the kit's canonical frame (+Z forward, character's left +X, metres, T-pose rest).
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { V, ell, hull } from './armor.js';

export const sstep = THREE.MathUtils.smoothstep;
export const lerp = THREE.MathUtils.lerp;
export const clamp = THREE.MathUtils.clamp;

// ---------------------------------------------------------------- noise
function h3(x, y, z) { let n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return n - Math.floor(n); }
export function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h3(ix, iy, iz), h3(ix + 1, iy, iz), u), l(h3(ix, iy + 1, iz), h3(ix + 1, iy + 1, iz), u), v),
    l(l(h3(ix, iy, iz + 1), h3(ix + 1, iy, iz + 1), u), l(h3(ix, iy + 1, iz + 1), h3(ix + 1, iy + 1, iz + 1), u), v), w);
}
export const fbm = (x, y, z) => noise3(x, y, z) * 0.55 + noise3(x * 2.1 + 5, y * 2.1, z * 2.1) * 0.3 + noise3(x * 4.3, y * 4.3 + 9, z * 4.3) * 0.15 - 0.5;

// ---------------------------------------------------------------- measured body
// Collects canonical-frame vertices of the base meshes (T-pose) so garments can hug the real body.
export function makeFit(scene, kit) {
  scene.updateMatrixWorld(true);
  const sets = {}, index = {};
  const tmp = new THREE.Vector3();
  scene.traverse((o) => {
    if (!o.isSkinnedMesh || o.name === 'ninja_gear') return;
    o.skeleton.update();
    const p = o.geometry.attributes.position, arr = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      tmp.fromBufferAttribute(p, i); o.applyBoneTransform(i, tmp); tmp.applyMatrix4(o.matrixWorld);
      arr[i * 3] = tmp.x * kit.L; arr[i * 3 + 1] = tmp.y; arr[i * 3 + 2] = tmp.z * kit.L;
    }
    sets[o.name] = arr; index[o.name] = o.geometry.index ? o.geometry.index.array : null;
  });
  // Radial extents of a vertex set around an axis through `o`: returns Float32Array(bins), angle measured
  // from basis vector `a` toward `b` (so bin k is at angle k/bins*2pi); only vertices within `half` of the plane.
  function slice(names, o, axis, a, b, bins = 48, half = 0.012, filt) {
    const r = new Float32Array(bins).fill(0);
    const ax = axis.clone().normalize();
    for (const nm of names) {
      const arr = sets[nm]; if (!arr) continue;
      for (let i = 0; i < arr.length; i += 3) {
        const dx = arr[i] - o.x, dy = arr[i + 1] - o.y, dz = arr[i + 2] - o.z;
        const h = dx * ax.x + dy * ax.y + dz * ax.z;
        if (Math.abs(h) > half) continue;
        if (filt && !filt(arr[i], arr[i + 1], arr[i + 2])) continue;
        const u = dx * a.x + dy * a.y + dz * a.z, v = dx * b.x + dy * b.y + dz * b.z;
        const rr = Math.hypot(u, v); let t = Math.atan2(v, u); if (t < 0) t += Math.PI * 2;
        const k = Math.round(t / (Math.PI * 2) * bins) % bins;
        if (rr > r[k]) r[k] = rr;
      }
    }
    // fill empty bins by interpolation
    for (let k = 0; k < bins; k++) if (!r[k]) {
      let l = 1, rt = 1; while (!r[(k - l + bins) % bins] && l < bins) l++; while (!r[(k + rt) % bins] && rt < bins) rt++;
      const A = r[(k - l + bins) % bins], B = r[(k + rt) % bins]; r[k] = A + (B - A) * l / (l + rt);
    }
    return r;
  }
  // Exact horizontal cross-section outline: intersects the mesh triangles with the plane y and returns the max radius per
  // angle bin around (cx, cz); angle 0 = +Z (front), pi/2 = +X.
  function outline(names, y, cx, cz, bins = 64) {
    const r = new Float32Array(bins);
    for (const nm of names) {
      const arr = sets[nm], ix = index[nm]; if (!arr) continue;
      const nT = ix ? ix.length / 3 : arr.length / 9;
      for (let t = 0; t < nT; t++) {
        const a = ix ? ix[t * 3] : t * 3, b = ix ? ix[t * 3 + 1] : t * 3 + 1, c = ix ? ix[t * 3 + 2] : t * 3 + 2;
        const ya = arr[a * 3 + 1] - y, yb = arr[b * 3 + 1] - y, yc = arr[c * 3 + 1] - y;
        if ((ya > 0 && yb > 0 && yc > 0) || (ya < 0 && yb < 0 && yc < 0)) continue;
        const pts = [];
        for (const [i, j, yi, yj] of [[a, b, ya, yb], [b, c, yb, yc], [c, a, yc, ya]]) {
          if ((yi > 0) !== (yj > 0)) { const f = yi / (yi - yj); pts.push([arr[i * 3] + (arr[j * 3] - arr[i * 3]) * f, arr[i * 3 + 2] + (arr[j * 3 + 2] - arr[i * 3 + 2]) * f]); }
        }
        if (pts.length < 2) continue;
        for (let s = 0; s <= 6; s++) {
          const f = s / 6, x = pts[0][0] + (pts[1][0] - pts[0][0]) * f - cx, z = pts[0][1] + (pts[1][1] - pts[0][1]) * f - cz;
          const rr = Math.hypot(x, z); let ang = Math.atan2(x, z); if (ang < 0) ang += Math.PI * 2;
          const k = Math.round(ang / (Math.PI * 2) * bins) % bins;
          if (rr > r[k]) r[k] = rr;
        }
      }
    }
    for (let k = 0; k < bins; k++) if (!r[k]) {
      let l = 1, rt = 1; while (!r[(k - l + bins) % bins] && l < bins) l++; while (!r[(k + rt) % bins] && rt < bins) rt++;
      const A = r[(k - l + bins) % bins], B = r[(k + rt) % bins]; r[k] = A + (B - A) * l / (l + rt);
    }
    return r;
  }
  return { sets, index, slice, outline };
}
// Samples a per-bin radius array at angle t (radians, 0..2pi), linear.
export function sampleR(r, t) {
  const n = r.length; t = ((t % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const f = t / (Math.PI * 2) * n, i = Math.floor(f) % n, j = (i + 1) % n, w = f - Math.floor(f);
  return r[i] * (1 - w) + r[j] * w;
}
export function smoothR(r, passes = 2) {
  const n = r.length; let a = Float32Array.from(r);
  for (let p = 0; p < passes; p++) { const b = new Float32Array(n); for (let k = 0; k < n; k++) b[k] = a[(k + n - 1) % n] * 0.25 + a[k] * 0.5 + a[(k + 1) % n] * 0.25; a = b; }
  return a;
}
export function dilateR(r, w = 1) {
  const n = r.length, o = new Float32Array(n);
  for (let k = 0; k < n; k++) { let m = 0; for (let d = -w; d <= w; d++) m = Math.max(m, r[(k + d + n) % n]); o[k] = m; }
  return o;
}

// ---------------------------------------------------------------- generic skinned tube
// Like outfit.sweep but with a per-vertex radius function, optional closed loops, skipped quads, per-vertex colours.
//   pts: ring centres; rad(i, t, k) -> radius along the ring's two axes as number, or [rSide, rNrm] (t = angle 0..2pi)
//   bind(i, k, p) -> bone key or [[key, w], ...]; colour(i, k, p, n, disp) -> hex/Color; skip(i, k) -> true to drop the quad
export function tube(kit, slot, pts, rad, bind, opts = {}) {
  const { L, idx, byKey, lists } = kit;
  const seg = opts.seg || 16, n = pts.length, up0 = opts.up || V(0, 0, 1), closed = !!opts.closed;
  const pos = [], ringOf = [], kOf = [], ix = [], disp = [];
  let prevSide = null;
  const nr = closed ? n : n;
  for (let i = 0; i < n; i++) {
    const t = closed ? pts[(i + 1) % n].clone().sub(pts[(i - 1 + n) % n]).normalize() : pts[Math.min(n - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
    let side = new THREE.Vector3().crossVectors(t, opts.upAt ? opts.upAt(i) : up0);
    if (side.lengthSq() < 1e-4) side = prevSide ? prevSide.clone() : V(1, 0, 0);
    side.normalize();
    const nrm = new THREE.Vector3().crossVectors(side, t).normalize();
    prevSide = side;
    for (let k = 0; k < seg; k++) {
      const a = opts.angle ? opts.angle(i, k) : (k / seg) * Math.PI * 2;
      let r = rad(i, a, k); if (!Array.isArray(r)) r = [r, r];
      const p = pts[i].clone().addScaledVector(side, Math.cos(a) * r[0]).addScaledVector(nrm, Math.sin(a) * r[1]);
      if (opts.dy) p.y += opts.dy(i, k, a);
      pos.push(p.x, p.y, p.z); ringOf.push(i); kOf.push(k);
    }
  }
  const rows = closed ? n : n - 1;
  for (let i = 0; i < rows; i++) for (let k = 0; k < (opts.open ? seg - 1 : seg); k++) {
    if (opts.skip && opts.skip(i, k)) continue;
    const i2 = (i + 1) % n;
    const a = i * seg + k, b = i * seg + (k + 1) % seg, c = i2 * seg + k, d = i2 * seg + (k + 1) % seg;
    ix.push(a, c, b, b, c, d);
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(ix); g.computeVertexNormals();
  // orientation: normals should point away from the path
  let flipped = false;
  {
    const nA = g.attributes.normal; let votes = 0;
    for (let s = 0; s < 24; s++) {
      const i = Math.floor((s / 24) * n) % n, k = (s * 5) % seg, v = i * seg + k;
      const o = V(pos[v * 3] - pts[i].x, pos[v * 3 + 1] - pts[i].y, pos[v * 3 + 2] - pts[i].z);
      votes += o.dot(V(nA.getX(v), nA.getY(v), nA.getZ(v))) < 0 ? 1 : -1;
    }
    if (opts.inward ? votes < 0 : votes > 0) { for (let q = 0; q < ix.length; q += 3) { const tmp = ix[q + 1]; ix[q + 1] = ix[q + 2]; ix[q + 2] = tmp; } g.setIndex(ix); g.computeVertexNormals(); flipped = true; }
  }
  const nA = g.attributes.normal;
  const g1 = g.toNonIndexed();
  const allPos = Array.from(g1.attributes.position.array), allNor = Array.from(g1.attributes.normal.array);
  const rings = ix.map((q) => ringOf[q]), ks = ix.map((q) => kOf[q]);
  if (opts.caps && !closed) {
    for (const [i0, dir] of [[0, -1], [n - 1, 1]]) {
      const c = pts[i0]; const t = pts[Math.min(n - 1, i0 + 1)].clone().sub(pts[Math.max(0, i0 - 1)]).normalize();
      for (let k = 0; k < seg; k++) {
        const v0 = i0 * seg + k, v1 = i0 * seg + (k + 1) % seg;
        const p0 = V(pos[v0 * 3], pos[v0 * 3 + 1], pos[v0 * 3 + 2]), p1 = V(pos[v1 * 3], pos[v1 * 3 + 1], pos[v1 * 3 + 2]);
        for (const p of (dir > 0 ? [c, p0, p1] : [c, p1, p0])) { allPos.push(p.x, p.y, p.z); allNor.push(t.x * dir, t.y * dir, t.z * dir); rings.push(i0); ks.push(k); }
      }
    }
  }
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', new THREE.Float32BufferAttribute(allPos, 3));
  g2.setAttribute('normal', new THREE.Float32BufferAttribute(allNor, 3));
  const nv = rings.length, carr = new Float32Array(nv * 3), base = new THREE.Color(opts.color != null ? opts.color : 0xffffff), ao = opts.ao == null ? 0.2 : opts.ao, tc = new THREE.Color();
  const vp = V(0, 0, 0), vn = V(0, 0, 0);
  for (let v = 0; v < nv; v++) {
    vp.set(allPos[v * 3], allPos[v * 3 + 1], allPos[v * 3 + 2]); vn.set(allNor[v * 3], allNor[v * 3 + 1], allNor[v * 3 + 2]);
    if (opts.colour) tc.set(opts.colour(rings[v], ks[v], vp, vn)); else tc.copy(base);
    const kk = 1 - ao + ao * (vn.y * 0.5 + 0.5) * 1.2;
    carr[v * 3] = tc.r * kk; carr[v * 3 + 1] = tc.g * kk; carr[v * 3 + 2] = tc.b * kk;
  }
  g2.setAttribute('color', new THREE.BufferAttribute(carr, 3));
  const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
  for (let v = 0; v < nv; v++) {
    vp.set(allPos[v * 3], allPos[v * 3 + 1], allPos[v * 3 + 2]);
    let w = bind(rings[v], ks[v], vp); if (typeof w === 'string') w = [[w, 1]];
    w = w.slice().sort((a, b) => b[1] - a[1]).slice(0, 4);
    let tot = 0; for (const x of w) tot += x[1];
    w.forEach(([key, wt], j) => { si[v * 4 + j] = idx.get(byKey.get(key)); sw[v * 4 + j] = wt / tot; });
  }
  g2.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g2.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  if (L < 0) g2.rotateY(Math.PI);
  lists[slot].push(g2);
  return g2;
}

// ---------------------------------------------------------------- bone weight helpers
export function chainW(kit, keys, y) {
  const ys = keys.map((k) => kit.J(k).y);
  if (y >= ys[ys.length - 1]) return [[keys[keys.length - 1], 1]];
  for (let i = 0; i < keys.length - 1; i++) if (y >= ys[i] && y <= ys[i + 1]) { const t = (y - ys[i]) / (ys[i + 1] - ys[i]); const s = t * t * (3 - 2 * t); return [[keys[i], 1 - s], [keys[i + 1], s]]; }
  return [[keys[0], 1]];
}
export const TORSO = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck'];
export function torsoW(kit, y) { return chainW(kit, TORSO, y); }
// Arm weights along a path from the shoulder: d = distance along the arm in metres from the shoulder joint.
export function armW(kit, A, p) {
  const sh = kit.J(A + 'Arm'), el = kit.J(A + 'ForeArm'), wr = kit.J(A + 'Hand');
  const lenU = sh.distanceTo(el), lenF = el.distanceTo(wr);
  const d = p.x * (A === 'Left' ? 1 : -1) - sh.x * (A === 'Left' ? 1 : -1);
  const dd = Math.abs(p.x - sh.x);
  const e = sstep(dd, lenU - 0.07, lenU + 0.07), w = sstep(dd, lenU + lenF - 0.03, lenU + lenF + 0.06);
  const out = [];
  const sho = 1 - sstep(dd, 0.0, 0.09);   // near the shoulder blend with the chest
  const a = (1 - e) * (1 - sho), t = (1 - e) * sho;
  if (t > 0.001) out.push(['Spine2', t * 0.6], [A + 'Shoulder', t * 0.4]);
  if (a > 0.001) out.push([A + 'Arm', a]);
  const f = e * (1 - w); if (f > 0.001) out.push([A + 'ForeArm', f]);
  if (w > 0.001) out.push([A + 'Hand', w * e]);
  return out;
}
export function legW(kit, A, p) {
  const hp = kit.J(A + 'UpLeg'), kn = kit.J(A + 'Leg'), an = kit.J(A + 'Foot');
  const k = sstep(p.y, hp.y - 0.0, kn.y + 0.0) ; // 1 at hip -> 0 at knee? compute below
  const wKnee = 1 - sstep(p.y, kn.y - 0.07, kn.y + 0.07);          // 0 above knee, 1 below
  const wAnk = 1 - sstep(p.y, an.y - 0.0, an.y + 0.10);            // 0 above ankle, 1 at/below
  const hipUp = sstep(p.y, hp.y - 0.12, hp.y + 0.04);              // 1 near the hip -> blend torso
  const out = [];
  const th = (1 - wKnee) * (1 - hipUp), sh = wKnee * (1 - wAnk), ft = wAnk * wKnee;
  if (hipUp > 0.01) out.push(['Hips', hipUp * (1 - wKnee)]);
  if (th > 0.001) out.push([A + 'UpLeg', th]);
  if (sh > 0.001) out.push([A + 'Leg', sh]);
  if (ft > 0.001) out.push([A + 'Foot', ft]);
  return out;
}

// ---------------------------------------------------------------- colour
const _c = new THREE.Color();
// A dyed-cloth colour: lifts near-black skin colours to a believable charcoal and keeps hue.
export function fab(hex, lift = 0.075, gain = 0.88) {
  _c.set(hex); const o = {}; _c.getHSL(o, THREE.SRGBColorSpace);
  const c = new THREE.Color(); c.setHSL(o.h, Math.min(1, o.s * 1.0), lift + o.l * gain, THREE.SRGBColorSpace); return c;
}
export function mixC(a, b, t) { return new THREE.Color(a).lerp(new THREE.Color(b), t); }
export function shade(c, k) { const o = new THREE.Color(c); o.r *= k; o.g *= k; o.b *= k; return o; }

// ---------------------------------------------------------------- the head, measured
// Radial profile of the real head (from the base mesh) as a function of height and angle. Angle a measured in
// the tube frame (0 = +X, pi/2 = +Z front). Returns { R(y, a), cz, yTop, yBase }.
export function headField(fit) {
  const cz = 0.02, ys = [], NR = 52;
  for (let i = 0; i <= NR; i++) ys.push(1.5 + i * (1.8325 - 1.5) / NR);
  const BINS = 96;
  const rows = ys.map((y) => smoothR(dilateR(fit.outline(['Wolf3D_Head'], y, 0, cz, BINS), 1), 1));
  const R = (y, a) => {
    const t = Math.PI / 2 - a; // outline angle: 0 front
    let f = (y - ys[0]) / (ys[1] - ys[0]); f = clamp(f, 0, ys.length - 1.001);
    const i = Math.floor(f), w = f - i;
    return sampleR(rows[i], t) * (1 - w) + sampleR(rows[i + 1], t) * w;
  };
  return { R, cz, ys, yTop: 1.833 };
}

// A cloth shell fitted over the real head: rings from the neck to the crown, an eye window cut between two ring rows.
//   o: { yB, thick(y, a), slit: { y0, y1, xw }, color, seed, extra(y, a) }
// Returns { ys, pt(y, a, off) } where pt gives a world point on the shell surface (for straps and knots).
export function hoodShell(kit, slot, head, o = {}) {
  const yB = o.yB ?? 1.53, yT = o.yTop ?? (o.apex ?? 1.852), slit = o.slit, capped = o.yTop == null;
  const set = new Set();
  for (let y = yB; y < (capped ? 1.826 : yT); y += o.dy ?? 0.011) set.add(+y.toFixed(4));
  if (!capped) set.add(yT);
  if (slit) { for (const y of [slit.y0, slit.y1, slit.y0 - 0.005, slit.y1 + 0.005]) set.add(y); }
  (capped ? [1.8, 1.812, 1.822, 1.8325, 1.84, 1.846, ...(yT > 1.86 ? [1.855, 1.865, 1.88, 1.89] : []), yT] : []).forEach((y) => set.add(y));
  const ys = [...set].sort((a, b) => a - b), n = ys.length, seg = o.seg ?? 72;
  const iy0 = slit ? ys.findIndex((y) => Math.abs(y - slit.y0) < 1e-6) : -1, iy1 = slit ? ys.findIndex((y) => Math.abs(y - slit.y1) < 1e-6) : -1;
  const thick = o.thick || (() => 0.008), seed = o.seed || 1;
  const rOf = (y, a) => {
    const yc = Math.min(y, 1.8325);
    let r = head.R(yc, a);
    if (capped && y > 1.785) { // puff the crown into a soft dome so the cloth does not follow the flat scalp
      const k = clamp((y - 1.785) / (yT - 1.785), 0, 1), d = head.R(1.785, a) * Math.sqrt(Math.max(0, 1 - k * k));
      r = Math.max(y > 1.8325 ? 0 : r * (1 - k * 0.0), d);
      if (y > 1.8325 && k >= 1) r = 0;
    }
    return Math.max(r, y > 1.785 ? 0 : 0.045);
  };
  const surf = (y, a, off = 0) => rOf(y, a) + thick(y, a) * (capped && y > yT - 0.012 ? Math.max(0, (yT - y) / 0.012) : 1) + (o.extra ? o.extra(y, a) : 0) + off;
  const pts = ys.map((y) => V(0, y, head.cz));
  const slitK = (() => { const set = new Set(); if (slit) { const ym = (slit.y0 + slit.y1) / 2; for (let k = 0; k < seg; k++) { const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2; if (Math.sin(a0) > 0 && Math.sin(a1) > 0 && Math.abs(Math.cos(a0) * rOf(ym, a0)) < slit.xw && Math.abs(Math.cos(a1) * rOf(ym, a1)) < slit.xw) set.add(k); } } return (k) => set.has(k); })();
  const rx = new Float32Array(n * seg), fold = new Float32Array(n * seg);
  const g = tube(kit, slot, pts, (i, a, k) => {
    const y = ys[i];
    const f = (fbm(Math.cos(a) * 3 + seed, y * 22, Math.sin(a) * 3) * 0.0035) * (o.foldAmt ?? 1);
    fold[i * seg + k] = f;
    let r = surf(y, a) + f;
    if (capped && i === n - 1) r = 0.0005;
    rx[i * seg + k] = Math.cos(a) * r;
    return r;
  }, (i, k, p) => {
    const y = ys[i], w = sstep(y, 1.53, 1.6);
    return w > 0.999 ? 'Head' : [['Neck', 1 - w], ['Head', w]];
  }, {
    seg, up: V(0, 0, 1), ao: 0.22,
    colour: (i, k, p) => { const base = o.color(ys[i], p); const f = fold[i * seg + k] ?? 0; return shade(base, clamp(1 + f * 70, 0.7, 1.25)); },
    skip: slit ? (i, k) => {
      if (i < iy0 || i + 1 > iy1) return false;
      return slitK(k);
    } : null,
    dy: slit && o.arch ? (i, k, a) => {
      if (!slitK(k) && !slitK(k - 1) && !slitK((k + 1) % seg)) return 0;
      const x = Math.cos(a) * rOf(ys[iy1], a), xn = clamp(x / slit.xw, -1, 1);
      const w = i === iy1 ? 1 : i === iy1 + 1 ? 0.7 : i === iy1 + 2 ? 0.35 : 0;
      return w * o.arch * (1 - xn * xn);
    } : null,
  });
  return { ys, surf, pt: (y, a, off = 0) => { const r = surf(y, a, off); return V(Math.cos(a) * r, y, head.cz + Math.sin(a) * r); } };
}

// ---------------------------------------------------------------- torso
// rows: [y, halfWidth, front, back, centreZ]. Superellipse cross-section (exponent n).
export function torsoField(rows, n = 2.5) {
  const lerpRow = (y) => {
    if (y <= rows[0][0]) return rows[0].slice(1);
    for (let i = 0; i < rows.length - 1; i++) if (y <= rows[i + 1][0]) {
      const t = (y - rows[i][0]) / (rows[i + 1][0] - rows[i][0]), s = t * t * (3 - 2 * t);
      return rows[i].slice(1).map((v, j) => v + (rows[i + 1][j + 1] - v) * s);
    }
    return rows[rows.length - 1].slice(1);
  };
  const e = 2 / n;
  const sg = (v) => (v < 0 ? -1 : 1);
  const xz = (y, a, grow = 0) => {
    const [hw, zf, zb, cz] = lerpRow(y), c = Math.cos(a), s = Math.sin(a);
    return [(hw + grow) * sg(c) * Math.pow(Math.abs(c), e), cz + (s >= 0 ? (zf + grow) : -(zb + grow)) * Math.pow(Math.abs(s), e) * (s >= 0 ? 1 : 1) * (s >= 0 ? 1 : 1)];
  };
  // point on the surface with outward offset
  const P = (y, a, off = 0) => {
    const [hw, zf, zb, cz] = lerpRow(y);
    const [x, z] = xz(y, a);
    const s = Math.sin(a);
    const zr = s >= 0 ? zf : zb;
    let nx = x / (hw * hw), nz = (z - cz) / (zr * zr), l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    return V(x + nx * off, y, z + nz * off);
  };
  // radii for tube() given a ring centred at (0, y, cz): [rSide, rNrm] with extra growth
  const rad = (y, a, grow = 0) => {
    const [hw, zf, zb, cz] = lerpRow(y), c = Math.cos(a), s = Math.sin(a);
    const zr = s >= 0 ? zf : zb;
    return [(hw + grow) * Math.pow(Math.max(Math.abs(c), 1e-3), e - 1), (zr + grow) * Math.pow(Math.max(Math.abs(s), 1e-3), e - 1)];
  };
  const cz = (y) => lerpRow(y)[3];
  return { P, rad, cz, row: lerpRow };
}

// ---------------------------------------------------------------- body-bound weights for torso / arm / leg paths
export function weightsFor(kit) {
  const k = kit;
  return {
    torso: (y) => torsoW(k, y),
    arm: (A, p) => armW(k, A, p),
    leg: (A, p) => legW(k, A, p),
  };
}

// ---------------------------------------------------------------- limbs
// Point along an arm axis at x-distance d from the shoulder joint (T-pose, arms straight out).
export function armAxis(kit, A) {
  const sh = kit.J(A + 'Arm'), el = kit.J(A + 'ForeArm'), wr = kit.J(A + 'Hand');
  const s = A === 'Left' ? 1 : -1;
  return { sh, el, wr, s, at: (d) => V(sh.x + s * d, sh.y + (wr.y - sh.y) * (d / sh.distanceTo(wr)), sh.z + (wr.z - sh.z) * (d / sh.distanceTo(wr))), lenU: sh.distanceTo(el), len: sh.distanceTo(wr) };
}
export function legAxis(kit, A) {
  const hp = kit.J(A + 'UpLeg'), kn = kit.J(A + 'Leg'), an = kit.J(A + 'Foot');
  const at = (y) => (y >= kn.y ? hp.clone().lerp(kn, (hp.y - y) / (hp.y - kn.y)) : kn.clone().lerp(an, (kn.y - y) / (kn.y - an.y)));
  return { hp, kn, an, at };
}

// ---------------------------------------------------------------- spiral wraps (kyahan, hand wraps, forearm cloth)
// Radius offset of a strip of cloth wound as a helix: `phase` runs 0..1 across one strip width; the strip's upper edge
// overlaps the previous turn so the profile is a sawtooth with a soft crest.
export function spiral(u, a, pitch, dir = 1) {
  let ph = (u / pitch - dir * a / (Math.PI * 2)); ph -= Math.floor(ph);
  return ph; // 0 = start of the strip (lowest), 1 = overlapped edge
}
export function spiralH(ph, thick) {
  const rise = Math.pow(ph, 0.85), edge = 1 - sstep(ph, 0.93, 1.0); // sharp drop at the over-edge
  return thick * (rise * 0.8 + 0.2) * (0.35 + 0.65 * edge) * 1.0;
}

// ---------------------------------------------------------------- a tabi / boot foot along +Z
// sec(z) -> { w, h, yc, n } half width, half height, centre height, squareness. Returns tube geometry on slot.
export function footTube(kit, slot, A, secFn, zs, color, o = {}) {
  const an = kit.J(A + 'Foot'), tb = kit.J(A + 'ToeBase'), s = A === 'Left' ? 1 : -1;
  const xc = (z) => an.x + (tb.x - an.x) * clamp((z - an.z) / (tb.z - an.z), 0, 1) + (z > tb.z ? (kit.J(A + 'Toe_End').x - tb.x) * clamp((z - tb.z) / 0.1, 0, 1) : 0);
  const pts = zs.map((z) => V(xc(z), secFn(z).yc, z));
  const seg = o.seg ?? 28;
  return tube(kit, slot, pts, (i, a, k) => {
    const sc = secFn(zs[i]), e = 2 / (sc.n || 2.4), c = Math.cos(a), sn = Math.sin(a);
    // frame: angle 0 = up (+Y), pi/2 = +X
    return [sc.h * Math.pow(Math.max(Math.abs(c), 1e-3), e - 1), sc.w * Math.pow(Math.max(Math.abs(sn), 1e-3), e - 1)];
  }, (i, k, p) => {
    const w = sstep(p.z, tb.z - 0.06, tb.z + 0.03);
    return w < 0.001 ? [[A + 'Foot', 1]] : w > 0.999 ? [[A + 'ToeBase', 1]] : [[A + 'Foot', 1 - w], [A + 'ToeBase', w]];
  }, { seg, up: V(1, 0, 0), ao: o.ao ?? 0.22, color, colour: o.colour, caps: true });
}

// ---------------------------------------------------------------- cloth folds
// A smooth crease field: u = distance along the garment (m), a = angle round it. Returns about -1..1.
export function creases(u, a, seed = 0, freqU = 14, nA = 3) {
  return (fbm(Math.cos(a) * nA + seed, u * freqU, Math.sin(a) * nA + seed * 0.7) * 2) * 0.8 + Math.sin(a * 2 + u * 9 + seed) * 0.2;
}
// Longitudinal pleats (hanging cloth): ridges running along the garment.
export function pleats(u, a, seed = 0, count = 7, wob = 1.2) {
  return Math.sin(a * count + Math.sin(u * 7 + seed) * wob + seed) * 0.6 + fbm(Math.cos(a) * 2 + seed, u * 6, Math.sin(a) * 2) * 0.8;
}
// Ring-by-ring interpolation of keyed values: keys [[t, v], ...] ascending in t.
export function keyed(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) if (t <= keys[i + 1][0]) { const f = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]); const s = f * f * (3 - 2 * f); return keys[i][1] + (keys[i + 1][1] - keys[i][1]) * s; }
  return keys[keys.length - 1][1];
}
// Even spacing of n+1 values from a to b.
export const span = (a, b, step) => { const o = []; const n = Math.max(1, Math.round(Math.abs(b - a) / step)); for (let i = 0; i <= n; i++) o.push(a + (b - a) * i / n); return o; };

// ---------------------------------------------------------------- flat ribbon / strap hugging a path
// pts: path points; nrms: outward normals per point (the face the strap shows); width, thick in metres (numbers or fn(i)).
export function ribbon(kit, slot, pts, nrms, width, thick, bind, o = {}) {
  const seg = o.seg ?? 12, W = typeof width === 'function' ? width : () => width, T = typeof thick === 'function' ? thick : () => thick;
  const col = o.color != null ? new THREE.Color(o.color) : null, stitch = o.stitch ? new THREE.Color(o.stitch) : null;
  return tube(kit, slot, pts, (i, a, k) => {
    const c = Math.cos(a), s = Math.sin(a), e = 0.5, f = o.fold ? o.fold(i, a) : 0;
    return [W(i) / 2 * Math.pow(Math.max(Math.abs(c), 1e-3), e - 1) + f, T(i) / 2 * Math.pow(Math.max(Math.abs(s), 1e-3), e - 1) + f];
  }, bind, {
    seg, upAt: (i) => nrms[i], closed: o.closed, ao: o.ao ?? 0.2, caps: o.caps,
    colour: (i, k, p, nn) => {
      if (stitch && (k === 2 || k === seg - 2 || k === Math.round(seg / 2) - 2 || k === Math.round(seg / 2) + 2) && i % 2 === 0) return stitch;
      return o.colorFn ? o.colorFn(i, k, p) : col;
    },
  });
}

// ---------------------------------------------------------------- small hard-surface parts (rigid, one bone)
export function bx(c, h, rot) {
  const g = new THREE.BoxGeometry(h[0] * 2, h[1] * 2, h[2] * 2);
  if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')));
  g.translate(c.x, c.y, c.z); return g;
}
// A rounded slab: hull of an inset box (chamfer ch).
export function slab(c, h, ch = 0.003, rot) {
  const pts = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    pts.push(V(sx * h[0], sy * (h[1] - ch), sz * (h[2] - ch)), V(sx * (h[0] - ch), sy * h[1], sz * (h[2] - ch)), V(sx * (h[0] - ch), sy * (h[1] - ch), sz * h[2]));
  }
  const g = hull(pts);
  if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')));
  g.translate(c.x, c.y, c.z); return g;
}
// A torus ring (link / buckle / hole) at c, normal along `dir`.
export function torus(c, R, r, dir = V(0, 0, 1), seg = 10, tub = 6, sx = 1, sy = 1) {
  const g = new THREE.TorusGeometry(R, r, tub, seg); g.scale(sx, sy, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), dir.clone().normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(c, q, V(1, 1, 1))); return g;
}
// A four-point throwing star (flat, bevelled, with a centre hole).
export function shuriken(R, th = 0.0025) {
  const sh = new THREE.Shape(), pts = 4, ro = R, ri = R * 0.3;
  for (let i = 0; i < pts * 2; i++) { const a = (i / (pts * 2)) * Math.PI * 2, r = i % 2 ? ri : ro; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) sh.lineTo(x, y); else sh.moveTo(x, y); }
  const hole = new THREE.Path(); hole.absarc(0, 0, R * 0.12, 0, Math.PI * 2, true); sh.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: true, bevelThickness: th * 0.4, bevelSize: th * 0.5, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -th / 2); return g;
}
// Chain of oval links along a curve (array of Vector3), linking alternately turned.
export function chainLinks(curve, n, len = 0.016, wid = 0.009, wire = 0.0016) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, p = curve.getPoint(t), tg = curve.getTangent(t).normalize();
    const side = new THREE.Vector3().crossVectors(tg, V(0, 1, 0)); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize();
    const nrm = new THREE.Vector3().crossVectors(side, tg).normalize();
    const g = new THREE.TorusGeometry(0.5, wire / wid * 0.5, 5, 10); g.scale(len, wid, wid);
    const m = new THREE.Matrix4().makeBasis(tg, i % 2 ? nrm : side, i % 2 ? side : nrm).setPosition(p);
    g.applyMatrix4(m); out.push(g);
  }
  return out;
}

// ---------------------------------------------------------------- scene helpers
export function hideBase(scene, re) { scene.traverse((o) => { if (o.isMesh && re.test(o.name)) o.visible = false; }); }
export function meshByName(scene, re) { let m = null; scene.traverse((o) => { if (o.isMesh && re.test(o.name) && !m) m = o; }); return m; }

// ---------------------------------------------------------------- materials
import { real } from './realmat.js';
// realmat's cloth kinds ask for sheen but are plain MeshStandardMaterials, which ignore it. This rebuilds a kind as a
// MeshPhysicalMaterial with the same triplanar shader hook, so dark dyed fabric gets the soft grazing sheen of real cloth.
export function fabricMat(kind = 'cloth', { scale, bump, rough, metal, sheen = 1, sheenRough = 0.55, sheenColor = 0x2c2f38, cav, tag = '' } = {}) {
  const base = real(kind, { scale, bump, rough, metal });
  const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, color: 0xffffff, metalness: base.metalness, roughness: base.roughness });
  m.sheen = sheen; m.sheenRoughness = sheenRough; m.sheenColor = new THREE.Color(sheenColor);
  m.onBeforeCompile = (sh) => {
    base.onBeforeCompile(sh);
    if (cav != null) sh.fragmentShader = sh.fragmentShader.replace(/diffuseColor\.rgb \*= 1\.0 \+ rmCav \* [0-9.]+;/, 'diffuseColor.rgb *= 1.0 + rmCav * ' + cav.toFixed(2) + ';');
  };
  m.customProgramCacheKey = () => 'ninjaP' + tag + kind + scale + bump + rough + metal + cav;
  return m;
}

// A kunai: leaf blade, wrapped grip and a ring pommel, lying along +Y from the origin (blade up). Returns [{geo, kind}].
export function kunaiParts(len = 0.2, wid = 0.03) {
  const out = [];
  const sh = new THREE.Shape(), bl = len * 0.55;
  sh.moveTo(0, 0); sh.lineTo(wid / 2 * 0.6, bl * 0.18); sh.quadraticCurveTo(wid / 2 * 1.05, bl * 0.5, 0, bl); sh.quadraticCurveTo(-wid / 2 * 1.05, bl * 0.5, -wid / 2 * 0.6, bl * 0.18); sh.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.0035, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -0.00175); out.push({ geo: g.translate(0, len * 0.18, 0), kind: 'steel' });
  const grip = new THREE.CylinderGeometry(0.0085, 0.0085, len * 0.27, 8, 6); grip.translate(0, len * 0.18 - len * 0.135, 0); out.push({ geo: grip, kind: 'wrap' });
  const ring = new THREE.TorusGeometry(0.0125, 0.0028, 5, 12); ring.translate(0, len * 0.18 - len * 0.27 - 0.011, 0); out.push({ geo: ring, kind: 'steel' });
  return out;
}
// place a geometry: rotate to point +Y along dir, then translate.
export function placeAlong(g, pos, dir, roll = 0) {
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
  if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), roll));
  g.applyMatrix4(new THREE.Matrix4().compose(pos, q, V(1, 1, 1))); return g;
}

// ---------------------------------------------------------------- cloth tube: a tube whose radius = base + crease field, with the
// folds baked into the colour (valleys dark, ridges light) and a soft dye mottle, so flat vertex colours read as worn cloth.
//   base(i, a) -> number | [r0, r1]; fold(i, a) -> metres (signed); colour(i, k, p) -> optional per-vertex base colour
export function clothTube(kit, slot, pts, base, fold, bind, o = {}) {
  const seg = o.seg ?? 24, fv = new Float32Array(pts.length * seg), col = new THREE.Color(o.color ?? 0x333333);
  const fk = o.foldK ?? 55, mot = o.mottle ?? 0.1, ms = o.mottleScale ?? 7;
  return tube(kit, slot, pts, (i, a, k) => {
    let b = base(i, a); const f = fold ? fold(i, a) : 0; fv[i * seg + k] = f;
    return Array.isArray(b) ? [b[0] + f, b[1] + f] : b + f;
  }, bind, {
    ...o, seg,
    colour: (i, k, p, n) => {
      const c = o.colour ? o.colour(i, k, p, n) : col;
      const m = 1 + mot * (fbm(p.x * ms, p.y * ms, p.z * ms) * 2) + mot * 0.4 * (noise3(p.x * 40, p.y * 40, p.z * 40) - 0.5);
      return shade(c, clamp((1 + fv[i * seg + k] * fk) * m, 0.45, 1.5));
    },
  });
}

// A closed band round a limb or waist: flat strap with given width/thickness around an ellipse (rx, rz) centred at c.
export function bandAround(kit, slot, c, rx, rz, wid, thick, bind, o = {}) {
  const N = o.n ?? 40, pts = [];
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; pts.push(V(c.x + Math.cos(a) * (rx + (o.wob ? o.wob(a) : 0)), c.y + (o.tilt ? o.tilt(a) : 0), c.z + Math.sin(a) * (rz + (o.wob ? o.wob(a) : 0)))); }
  const col = new THREE.Color(o.color ?? 0x222222);
  return tube(kit, slot, pts, (i, a, k) => {
    const e = 0.5, cc = Math.cos(a), sn = Math.sin(a), f = o.fold ? o.fold(i, k) : 0;
    return [thick / 2 * Math.pow(Math.max(Math.abs(cc), 1e-3), e - 1) + f, wid / 2 * Math.pow(Math.max(Math.abs(sn), 1e-3), e - 1) + f];
  }, bind, { seg: o.seg ?? 12, closed: true, up: V(0, 1, 0), color: col, ao: o.ao ?? 0.28, colour: o.colourFn });
}

// Angle on an arm tube for the same physical spot on either arm (the right arm's tube frame is mirrored about Y).
export const armAng = (s, a) => (s > 0 ? a : Math.PI - a);
