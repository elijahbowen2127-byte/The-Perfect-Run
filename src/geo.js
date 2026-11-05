// Geometry helpers for the smoother, more organic world props: creased smooth normals, noise-displaced
// rocks, tapered tubes for trunks and branches, drooping foliage cards, baked vertex AO.
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { hashInt, mulberry32 } from './rng.js';

const sm = (t) => t * t * (3 - 2 * t);
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// 3D value noise for displacing meshes.
export function noise3(seed) {
  const L = (x, y, z) => hashInt(x, y * 1597 + z * 7919, seed);
  function n(x, y, z) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = sm(x - ix), fy = sm(y - iy), fz = sm(z - iz);
    const a = (j, k) => { const p = L(ix, iy + j, iz + k), q = L(ix + 1, iy + j, iz + k); return p + (q - p) * fx; };
    const b0 = a(0, 0) + (a(1, 0) - a(0, 0)) * fy;
    const b1 = a(0, 1) + (a(1, 1) - a(0, 1)) * fy;
    return b0 + (b1 - b0) * fz;
  }
  function fbm(x, y, z, oct = 4) {
    let amp = 0.5, f = 1, s = 0, nn = 0;
    for (let i = 0; i < oct; i++) { s += amp * n(x * f, y * f, z * f); nn += amp; amp *= 0.5; f *= 2.03; }
    return s / nn;
  }
  function ridged(x, y, z, oct = 3) {
    let amp = 0.5, f = 1, s = 0, nn = 0;
    for (let i = 0; i < oct; i++) { const v = 1 - Math.abs(n(x * f, y * f, z * f) * 2 - 1); s += amp * v * v; nn += amp; amp *= 0.5; f *= 2.07; }
    return s / nn;
  }
  return { n, fbm, ridged };
}

// ---------- finishing / merging ----------
// Keep positions only, then give the mesh creased smooth normals (hard edges above `crease` degrees),
// per-face box-projected UVs (no stretching on any side) and a white vertex-colour channel.
export function finish(g, { crease = 55, uv = 'box', uvScale = 0.6, smooth = true } = {}) {
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && !(uv === 'keep' && k === 'uv')) g.deleteAttribute(k);
  let out = g.index ? g.toNonIndexed() : g;
  if (smooth) out = toCreasedNormals(out, (crease * Math.PI) / 180);
  else out.computeVertexNormals();
  const p = out.attributes.position;
  if (uv === 'box') {
    const n = p.count, arr = new Float32Array(n * 2);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3();
    for (let i = 0; i < n; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
      fn.copy(b).sub(a).cross(c.clone().sub(a));
      const ax = Math.abs(fn.x), ay = Math.abs(fn.y), az = Math.abs(fn.z);
      for (let k = 0; k < 3; k++) {
        const v = k === 0 ? a : k === 1 ? b : c;
        let u, w;
        if (ay >= ax && ay >= az) { u = v.x; w = v.z; } else if (ax >= az) { u = v.z; w = v.y; } else { u = v.x; w = v.y; }
        arr[(i + k) * 2] = u * uvScale; arr[(i + k) * 2 + 1] = w * uvScale;
      }
    }
    out.setAttribute('uv', new THREE.BufferAttribute(arr, 2));
  } else if (!out.attributes.uv) out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(p.count * 2), 2));
  setColor(out, 1, 1, 1);
  return out;
}

export function setColor(g, r, gg, b) {
  const n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = r; arr[i * 3 + 1] = gg; arr[i * 3 + 2] = b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

// Bake per-vertex ambient occlusion / tint. fn(x,y,z,nx,ny,nz) -> number or [r,g,b]; multiplies what is there.
export function paint(g, fn) {
  const p = g.attributes.position, nn = g.attributes.normal, c = g.attributes.color;
  for (let i = 0; i < p.count; i++) {
    const v = fn(p.getX(i), p.getY(i), p.getZ(i), nn ? nn.getX(i) : 0, nn ? nn.getY(i) : 1, nn ? nn.getZ(i) : 0, i);
    if (Array.isArray(v)) c.setXYZ(i, c.getX(i) * v[0], c.getY(i) * v[1], c.getZ(i) * v[2]);
    else c.setXYZ(i, c.getX(i) * v, c.getY(i) * v, c.getZ(i) * v);
  }
  return g;
}

// Everything non-indexed with position/normal/uv/color so differently-built pieces merge.
export function std(g) {
  if (g.index) g = g.toNonIndexed();
  const n = g.attributes.position.count;
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.attributes.color) setColor(g, 1, 1, 1);
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}

export function merge(list) {
  const out = mergeGeometries(list.map(std));
  return out;
}

// ---------- rocks ----------
// A faceted, weathered boulder: noise-displaced sphere clipped by random fracture planes with soft edges.
export function rockGeo({ underhang = false, seed = 1, detail = 4, squash = 0.75, rough = 0.28, crease = 0.2, planes = 6, stretch = [1, 1, 1], flatBottom = 0.3, tint = null } = {}) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  for (const k of ['normal', 'uv']) g.deleteAttribute(k);
  const nz = noise3(seed), rnd = mulberry32(seed * 7 + 3);
  const pl = [];
  for (let i = 0; i < planes; i++) {
    const v = new THREE.Vector3(rnd() * 2 - 1, (rnd() * 2 - 1) * 0.7 + 0.15, rnd() * 2 - 1).normalize();
    pl.push({ n: v, d: 0.7 + rnd() * 0.22 });
  }
  const p = g.attributes.position, v = new THREE.Vector3();
  const cav = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let r = 0.82 + (nz.fbm(v.x * 1.5 + 5, v.y * 1.5, v.z * 1.5, 4) - 0.5) * rough * 2;
    r += (nz.ridged(v.x * 2.4 + 9, v.y * 2.4, v.z * 2.4, 3) - 0.35) * crease;
    for (const q of pl) {
      const dn = v.dot(q.n);
      if (dn > 0.05) { const lim = q.d / dn; if (lim < r + 0.1) { const t = clamp((r - lim) / 0.1 + 0.5); r = r - (r - lim) * sm(t) * 0.999; } }
    }
    cav[i] = r;
    v.multiplyScalar(r);
    v.x *= stretch[0]; v.y *= squash * stretch[1]; v.z *= stretch[2];
    if (underhang && v.y < 0) { v.y *= 2.3; const k = clamp(1 + v.y * 0.5, 0.2, 1); v.x *= k; v.z *= k; }
    else if (v.y < -flatBottom) v.y = -flatBottom - (-flatBottom - v.y) * 0.15;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  const out = finish(g, { crease: 70, uvScale: 0.55 });
  const pp = out.attributes.position;
  paint(out, (x, y) => { const k = clamp((y + 0.4) / 1.1); return 0.5 + 0.5 * sm(k); });
  if (tint) paint(out, (x, y, z) => { const f = nz.fbm(x * 2 + 1, y * 2, z * 2, 3); return [lerp(1, tint[0], f), lerp(1, tint[1], f), lerp(1, tint[2], f)]; });
  void pp;
  return out;
}

// Rounded, weathered box (tombs, steps, obelisk). Eroded corners and faint noise give a hand-cut look.
export function softBox(w, h, d, { r = 0.06, seg = 5, erode = 0.012, seed = 1, crease = 60, uvScale = 0.6 } = {}) {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  const p = g.attributes.position, nz = noise3(seed);
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r, v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(clamp(v.x, -hx, hx), clamp(v.y, -hy, hy), clamp(v.z, -hz, hz));
    const dir = v.clone().sub(c);
    if (dir.lengthSq() > 1e-9) v.copy(c).addScaledVector(dir.normalize(), r);
    const e = (nz.fbm(v.x * 3, v.y * 3, v.z * 3, 3) - 0.5) * erode * 2;
    v.x += Math.sign(v.x) * e * (Math.abs(v.x) > hx ? 1 : 0.2);
    v.y += Math.sign(v.y) * e * (Math.abs(v.y) > hy ? 1 : 0.2);
    v.z += Math.sign(v.z) * e * (Math.abs(v.z) > hz ? 1 : 0.2);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return finish(g, { crease, uvScale });
}

// ---------- tubes (trunks, branches, roots, arms) ----------
export function tube(pts, radiusFn, radial = 7, { uRep = 2, vScale = 0.4, noise = null, wob = 0, capEnd = false } = {}) {
  const n = pts.length;
  const T = pts.map((_, i) => pts[Math.min(i + 1, n - 1)].clone().sub(pts[Math.max(i - 1, 0)]).normalize());
  const N = new THREE.Vector3(0, 0, 1);
  if (Math.abs(T[0].z) > 0.9) N.set(1, 0, 0);
  N.addScaledVector(T[0], -N.dot(T[0])).normalize();
  const pos = [], nor = [], uv = [], idx = [];
  let len = 0;
  const B = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    if (i > 0) { len += pts[i].distanceTo(pts[i - 1]); N.addScaledVector(T[i], -N.dot(T[i])).normalize(); }
    B.crossVectors(T[i], N);
    const t = i / (n - 1);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const r0 = radiusFn(t, a);
      d.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
      let r = r0;
      if (noise) r *= 1 + wob * (noise.fbm(Math.cos(a) * 1.3 + 4, len * 0.9, Math.sin(a) * 1.3, 3) - 0.5) * 2;
      pos.push(pts[i].x + d.x * r, pts[i].y + d.y * r, pts[i].z + d.z * r);
      nor.push(d.x, d.y, d.z);
      uv.push((j / radial) * uRep, len * vScale);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  if (capEnd) {
    const c = pos.length / 3;
    const last = pts[n - 1];
    pos.push(last.x, last.y, last.z); nor.push(T[n - 1].x, T[n - 1].y, T[n - 1].z); uv.push(0.5, len * vScale);
    const base = (n - 1) * (radial + 1);
    for (let j = 0; j < radial; j++) idx.push(base + j + 1, base + j, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return std(g);
}

// Branching limb: recursive tapered tubes. Returns a list of geometries; also the tip positions for foliage.
export function limbs(start, dir, len, r0, depth, rnd, out, tips, { radial = 7, curl = 0.25, up = 0.15, kids = 3, spread = [0.5, 1.1], taper = 0.18, lenK = 0.62, nz = null } = {}) {
  const segs = depth >= 2 ? 6 : 5;
  const pts = [start.clone()], d = dir.clone().normalize();
  const side = new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).normalize();
  for (let i = 0; i < segs; i++) {
    d.addScaledVector(side, curl * (rnd() - 0.4) / segs * 3).add(new THREE.Vector3(0, up / segs, 0)).normalize();
    pts.push(pts[i].clone().addScaledVector(d, len / segs));
  }
  const rEnd = Math.max(0.012, r0 * taper);
  out.push(tube(pts, (t) => lerp(r0, rEnd, Math.pow(t, 0.8)), depth >= 2 ? radial : Math.max(4, radial - 2), { uRep: 1.5, vScale: 0.5 / Math.max(r0 * 2.2, 0.25), noise: nz, wob: depth >= 2 ? 0.14 : 0.08, capEnd: true }));
  if (depth <= 0) { tips && tips.push({ p: pts[pts.length - 1], d: d.clone() }); return; }
  const nk = kids + (rnd() < 0.4 ? 1 : 0);
  for (let k = 0; k < nk; k++) {
    const t = 0.3 + 0.65 * ((k + rnd() * 0.6) / nk);
    const i = Math.min(segs - 1, Math.floor(t * segs));
    const base = pts[i].clone().lerp(pts[i + 1], t * segs - i);
    const az = rnd() * Math.PI * 2, ang = lerp(spread[0], spread[1], rnd());
    const perp = new THREE.Vector3().crossVectors(d, new THREE.Vector3(Math.cos(az), 0.3, Math.sin(az))).normalize();
    const nd = d.clone().applyAxisAngle(perp, ang);
    limbs(base, nd, len * lenK * (0.75 + rnd() * 0.5), lerp(r0, rEnd, t) * 0.78, depth - 1, rnd, out, tips, { radial, curl, up, kids: Math.max(2, kids - 1), spread, taper, lenK, nz });
  }
  tips && tips.push({ p: pts[pts.length - 1], d: d.clone() });
}

// ---------- foliage cards ----------
// A drooping needle spray: a V-shaped strip from the trunk outwards. Normals lean outward from the tree
// axis so the canopy shades like a soft volume rather than a pile of flat cards.
export function spray({ base, out, len, width, droop, segs = 3, lean = 0.55, ao0 = 0.45, ao1 = 1, tint = [1, 1, 1], center }) {
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const side = new THREE.Vector3(-out.z, 0, out.x);
  const cols = 3;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const cx = base.x + out.x * len * t, cz = base.z + out.z * len * t;
    const cy = base.y - droop * len * t * t + 0.12 * len * t * (1 - t);
    const hw = width * 0.5 * (0.45 + 0.55 * Math.sin(Math.min(1, t * 1.15 + 0.12) * Math.PI * 0.62 + 0.25) / 1.0);
    for (let j = 0; j < cols; j++) {
      const s = (j - 1);
      const raise = j === 1 ? width * 0.09 * (1 - t * 0.5) : 0;
      const px = cx + side.x * hw * s, pz = cz + side.z * hw * s, py = cy + raise - Math.abs(s) * hw * 0.12;
      pos.push(px, py, pz);
      const o = new THREE.Vector3(px - center.x, (py - center.y) * 0.6 + 0.35, pz - center.z).normalize();
      const nn = o.multiplyScalar(lean).add(new THREE.Vector3(0, 1 - lean * 0.4, 0)).normalize();
      nor.push(nn.x, nn.y, nn.z);
      uv.push(j / (cols - 1), t);
      const a = lerp(ao0, ao1, Math.pow(t, 0.7));
      col.push(a * tint[0], a * tint[1], a * tint[2]);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < cols - 1; j++) {
    const a = i * cols + j, b = a + cols;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return std(g);
}

// Crossed leaf/blade cards in a ball (canopy clump) or a tuft; normals radiate from the centre.
export function clump({ center, size, n = 5, seed = 1, ball = true, ao = [0.5, 1], tint = [1, 1, 1], tall = 1, up = 0.35 }) {
  const rnd = mulberry32(seed), list = [];
  for (let i = 0; i < n; i++) {
    const g = new THREE.PlaneGeometry(size, size * tall, 1, 2);
    g.translate(0, ball ? 0 : size * tall * 0.5, 0);
    const a = rnd() * Math.PI, tilt = (rnd() - 0.5) * (ball ? 2.2 : 0.5);
    g.rotateX(tilt).rotateY(a);
    const p = g.attributes.position;
    const nor = new Float32Array(p.count * 3), col = new Float32Array(p.count * 3);
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
      const o = new THREE.Vector3(x, ball ? y : y * 0.4 + size * up, z).normalize();
      if (!ball) o.y = Math.max(o.y, 0.5), o.normalize();
      nor[k * 3] = o.x; nor[k * 3 + 1] = o.y; nor[k * 3 + 2] = o.z;
      const f = ball ? clamp(Math.hypot(x, y, z) / (size * 0.6)) : clamp(y / (size * tall));
      const c = lerp(ao[0], ao[1], f);
      col[k * 3] = c * tint[0]; col[k * 3 + 1] = c * tint[1]; col[k * 3 + 2] = c * tint[2];
      p.setXYZ(k, x + center.x, y + center.y, z + center.z);
    }
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    list.push(std(g));
  }
  return merge(list);
}

// Radial profile lathe with optional lobes (flutes, ribs) and noise; profile is [[r,y],...].
export function lathe(profile, { seg = 24, lobes = 0, lobeAmp = 0.05, seed = 0, noiseAmp = 0, crease = 50, uvScale = 0.6 } = {}) {
  const g = new THREE.LatheGeometry(profile.map((p) => new THREE.Vector2(p[0], p[1])), seg);
  const p = g.attributes.position, nz = noise3(seed + 1);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const a = Math.atan2(z, x);
    let k = 1 + (lobes ? Math.cos(a * lobes) * lobeAmp : 0);
    if (noiseAmp) k += (nz.fbm(x * 2.2, y * 2.2, z * 2.2, 3) - 0.5) * noiseAmp * 2;
    p.setXYZ(i, x * k, y, z * k);
  }
  return finish(g, { crease, uvScale });
}
