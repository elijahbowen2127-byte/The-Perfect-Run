// Gear toolkit for the hand-built heroes, plus Ironwood, the heavy super-soldier.
//
// The kit lets a builder describe extra geometry in a canonical frame (+Z forward,
// the character's left on +X, metres, rest pose) and bakes everything into ONE skinned
// mesh bound to the rig's own bones, so it follows any retargeted clip and costs a
// draw call per material slot instead of one per piece. Rigid parts follow a single
// bone; `tube()` sweeps a smooth skinned limb/cloth along a path with per-ring bone
// weights so elbows, knees and coats bend without cracks.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { mergeGeometries, mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { boneKey } from './retarget.js';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- colour / texture
export function hsl2rgb(h, s, l) { // h in degrees
  h = ((h % 360) + 360) % 360 / 360;
  const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  if (s < 1e-4) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return [f(p, q, h + 1 / 3), f(p, q, h), f(p, q, h - 1 / 3)];
}

const recolorCache = new Map();
// Re-colours a texture pixel by pixel. `fn(h, s, l)` (hue in degrees, s and l in 0..1)
// returns [h, s, l] or [h, s, l, glow]; when any pixel glows an emissive map is made too.
// Returns { map, glow } canvas textures (cached by `key`).
export function recolorTexture(src, key, fn) {
  const ck = src.uuid + '|' + key;
  if (recolorCache.has(ck)) return recolorCache.get(ck);
  const W = src.image.width, H = src.image.height;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const cv = mk(), x = cv.getContext('2d');
  x.drawImage(src.image, 0, 0);
  const img = x.getImageData(0, 0, W, H), d = img.data;
  let gd = null, gimg = null, cg = null, xg = null;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dl = mx - mn;
    let h = 0, s = 0;
    if (dl > 1e-4) {
      s = l > 0.5 ? dl / (2 - mx - mn) : dl / (mx + mn);
      h = mx === r ? ((g - b) / dl + (g < b ? 6 : 0)) : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4;
      h *= 60;
    }
    const o = fn(h, s, l);
    if (!o) continue;
    const [nr, ng, nb] = hsl2rgb(o[0], Math.max(0, Math.min(1, o[1])), Math.max(0, Math.min(1, o[2])));
    d[i] = nr * 255; d[i + 1] = ng * 255; d[i + 2] = nb * 255;
    if (o[3]) {
      if (!gd) { cg = mk(); xg = cg.getContext('2d'); gimg = xg.createImageData(W, H); gd = gimg.data; for (let k = 3; k < gd.length; k += 4) gd[k] = 255; }
      const [gr, gg, gb] = hsl2rgb(o[0], Math.min(1, o[1] * 1.1), 0.55);
      gd[i] = gr * 255 * o[3]; gd[i + 1] = gg * 255 * o[3]; gd[i + 2] = gb * 255 * o[3];
    }
  }
  x.putImageData(img, 0, 0);
  const tex = (c) => {
    const t = new THREE.CanvasTexture(c);
    t.flipY = src.flipY; t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = src.wrapS; t.wrapT = src.wrapT; t.anisotropy = src.anisotropy || 4;
    return t;
  };
  let glow = null;
  if (gd) { xg.putImageData(gimg, 0, 0); glow = tex(cg); }
  const res = { map: tex(cv), glow };
  recolorCache.set(ck, res);
  return res;
}

// ---------------------------------------------------------------- geometry helpers
export const hull = (pts) => new ConvexGeometry(pts);

// Chamfered box centred at c with half-sizes h = [hx, hy, hz].
export function bevBox(c, h, ch = 0.008) {
  const pts = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    pts.push(V(c.x + sx * h[0], c.y + sy * (h[1] - ch), c.z + sz * (h[2] - ch)));
    pts.push(V(c.x + sx * (h[0] - ch), c.y + sy * h[1], c.z + sz * (h[2] - ch)));
    pts.push(V(c.x + sx * (h[0] - ch), c.y + sy * (h[1] - ch), c.z + sz * h[2]));
  }
  return hull(pts);
}

// Superellipse cross-section at height y: half width w, front distance f and back distance b
// from the centre (cx, cz), squareness n (2 = round), rf = how far the front ridge juts out.
export function ring(y, w, f, b, n = 2.6, rf = 0, cx = 0, cz = 0, N = 16) {
  const pts = [], e = 2 / n;
  for (let k = 0; k < N; k++) {
    const t = (k / N) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    const x = w * Math.sign(c) * Math.pow(Math.abs(c), e);
    const z = s >= 0 ? f * Math.pow(s, e) + rf * Math.pow(Math.max(0, 1 - Math.abs(x) / w), 1.5) * Math.min(1, s * 2) : -b * Math.pow(-s, e);
    pts.push(V(cx + x, y, cz + z));
  }
  return pts;
}
// Front arc only (a visor strip).
export function arc(y, w, f, n, cz = 0, N = 10, spread = 0.84, rf = 0) {
  const pts = [], e = 2 / n;
  for (let k = 0; k <= N; k++) {
    const t = Math.PI * (0.5 - spread * 0.5) + (k / N) * Math.PI * spread, c = Math.cos(t), s = Math.sin(t);
    const x = w * Math.sign(c) * Math.pow(Math.abs(c), e);
    pts.push(V(x, y, cz + f * Math.pow(s, e) + rf * Math.pow(Math.max(0, 1 - Math.abs(x) / w), 1.5) * Math.min(1, s * 2)));
  }
  return pts;
}
// Stack of rings: rows are [dy, w, f, b, n, rf]; returns the hull.
export function loft(rows, y0, cx = 0, cz = 0, N = 16) {
  const pts = [];
  for (const [dy, w, f, b, n, rf] of rows) pts.push(...ring(y0 + dy, w, f, b, n, rf || 0, cx, cz, N));
  return hull(pts);
}
// A tapered chamfered rod between a and b.
export function limb(a, b, ra0, rb0, ra1, rb1, up = V(0, 0, 1), ex = 0.6) {
  const dir = b.clone().sub(a).normalize();
  const side = new THREE.Vector3().crossVectors(dir, up).normalize();
  const nrm = new THREE.Vector3().crossVectors(side, dir).normalize();
  const pts = [];
  for (const [p, rx, rz] of [[a, ra0, rb0], [b, ra1, rb1]]) {
    for (let k = 0; k < 8; k++) {
      const t = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const cx = Math.cos(t), cz = Math.sin(t);
      const sx = Math.sign(cx) * Math.pow(Math.abs(cx), ex), sz = Math.sign(cz) * Math.pow(Math.abs(cz), ex);
      pts.push(p.clone().addScaledVector(side, sx * rx).addScaledVector(nrm, sz * rz));
    }
  }
  return hull(pts);
}
// Ellipsoid centred at c with radii r = [rx, ry, rz], optionally rotated (Euler xyz).
export function ell(c, r, rot, seg = 18, e = null) {
  let g = new THREE.SphereGeometry(1, seg, Math.max(8, Math.round(seg * 0.7)));
  if (e) { // superellipsoid: exponents e = [latitude, longitude] below 1 make it squarer
    const p = g.attributes.position;
    const sp = (a, k) => Math.sign(a) * Math.pow(Math.abs(a), k);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), lat = Math.asin(Math.max(-1, Math.min(1, y))), lon = Math.atan2(p.getX(i), p.getZ(i)), cl = sp(Math.cos(lat), e[0]);
      p.setXYZ(i, cl * sp(Math.sin(lon), e[1]), sp(Math.sin(lat), e[0]), cl * sp(Math.cos(lon), e[1]));
    }
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    g = mergeVertices(g, 1e-5); g.computeVertexNormals();
  }
  g.scale(r[0], r[1], r[2]);
  if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')));
  g.translate(c.x, c.y, c.z);
  return g;
}
// A window cut from an ellipsoid shell (radii r about c): longitudes lon0..lon1 measured from +Z
// toward +X, latitudes given per column by latFn(u) -> [bottom, top] with u in -1..1. Smooth
// normals; optional colorFn(u, v) -> THREE.Color (v = 0 bottom .. 1 top) for baked gradients.
export function patch(c, r, lon0, lon1, latFn, nu = 24, nv = 8, colorFn, e = null) {
  const pos = [], col = [], idx = [];
  const sp = (a, k) => Math.sign(a) * Math.pow(Math.abs(a), k);
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = (i / nu) * 2 - 1, lon = lon0 + (lon1 - lon0) * (i / nu), [b, t] = latFn(u), v = j / nv, lat = b + (t - b) * v;
    if (e) { const cl = sp(Math.cos(lat), e[0]); pos.push(c.x + r[0] * cl * sp(Math.sin(lon), e[1]), c.y + r[1] * sp(Math.sin(lat), e[0]), c.z + r[2] * cl * sp(Math.cos(lon), e[1])); }
    else pos.push(c.x + r[0] * Math.cos(lat) * Math.sin(lon), c.y + r[1] * Math.sin(lat), c.z + r[2] * Math.cos(lat) * Math.cos(lon));
    if (colorFn) { const k = colorFn(u, v); col.push(k.r, k.g, k.b); }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, d = a + nu + 1, e = d + 1; idx.push(a, b, d, b, e, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Make sure the winding faces outward.
  const n = g.attributes.normal, m = Math.floor((nu + 1) * (nv + 1) / 2);
  if (n.getX(m) * (pos[m * 3] - c.x) + n.getY(m) * (pos[m * 3 + 1] - c.y) + n.getZ(m) * (pos[m * 3 + 2] - c.z) < 0) { const a = g.index.array; for (let q = 0; q < a.length; q += 3) { const tmp = a[q + 1]; a[q + 1] = a[q + 2]; a[q + 2] = tmp; } g.computeVertexNormals(); }
  return g;
}
// Eight-point spark: four crossed slim diamonds in the XY plane (+ optional core).
export function sparkGeo(R = 1, thin = 0.16, depth = 0.1, core = true) {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.OctahedronGeometry(1, 0);
    g.scale(R, R * thin * (i % 2 ? 0.75 : 1), R * thin * depth * 4);
    g.rotateZ((i * Math.PI) / 4);
    parts.push(g);
  }
  if (core) parts.push(new THREE.SphereGeometry(R * 0.2, 14, 10));
  return parts.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const a of Object.keys(n.attributes)) if (a !== 'position' && a !== 'normal') n.deleteAttribute(a); return n; });
}

// Paints a geometry's vertex colours from position and normal: fn(x, y, z, ny) -> colour (hex / THREE.Color),
// with the same baked underside shading `add()` gives flat colours.
export function paint(g, fn, ao = 0.22) {
  const p = g.attributes.position, n = g.attributes.normal || null, arr = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const ny = n ? n.getY(i) : 0;
    c.set(fn(p.getX(i), p.getY(i), p.getZ(i), ny));
    const k = 1 - ao + ao * (ny * 0.5 + 0.5) * 1.2;
    arr[i * 3] = c.r * k; arr[i * 3 + 1] = c.g * k; arr[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

// Per-vertex baked shading: undersides darker, tops slightly lifted.
function tint(g, color, ao = 0.22) {
  const n = g.attributes.normal, p = g.attributes.position, c = new THREE.Color(color);
  const arr = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const k = 1 - ao + ao * (n.getY(i) * 0.5 + 0.5) * 1.2;
    arr[i * 3] = c.r * k; arr[i * 3 + 1] = c.g * k; arr[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

// Linear bone-chain weights: bones listed with their rest heights; returns weights for a point at y.
export function chainWeights(kit, keys, y) {
  const ys = keys.map((k) => kit.J(k).y);
  const asc = ys[ys.length - 1] > ys[0];
  const ks = asc ? keys.slice().reverse() : keys, yy = asc ? ys.slice().reverse() : ys; // descending height
  if (y >= yy[0]) return [[ks[0], 1]];
  for (let i = 0; i < ks.length - 1; i++) {
    if (y <= yy[i] && y >= yy[i + 1]) { const t = (yy[i] - y) / (yy[i] - yy[i + 1]); return [[ks[i], 1 - t], [ks[i + 1], t]]; }
  }
  return [[ks[ks.length - 1], 1]];
}

// ---------------------------------------------------------------- the kit
export function makeKit(scene, slots, name = 'gear') {
  scene.updateMatrixWorld(true);
  const bones = []; scene.traverse((o) => { if (o.isBone) bones.push(o); });
  const byKey = new Map(); for (const b of bones) if (!byKey.has(boneKey(b.name))) byKey.set(boneKey(b.name), b);
  const idx = new Map(bones.map((b, i) => [b, i]));
  // Canonical frame: some rigs face -Z; flip about Y so +Z is forward and the character's left is +X.
  const L = byKey.get('LeftArm').getWorldPosition(V(0, 0, 0)).x >= 0 ? 1 : -1;
  const has = (k) => byKey.has(k);
  const J = (k) => { const p = byKey.get(k).getWorldPosition(V(0, 0, 0)); return V(p.x * L, p.y, p.z * L); };
  const lists = slots.map(() => []);
  const kit = { L, J, has, bones, byKey, idx, slots, lists };

  const finishGeo = (list, geo, { color, ao, crease, xf, colorFn }) => {
    if (xf) geo.applyMatrix4(xf);
    let g = geo.index ? geo.toNonIndexed() : geo;
    for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'skinIndex', 'skinWeight', 'color'].includes(a)) g.deleteAttribute(a);
    if (crease) g = toCreasedNormals(g, crease);
    if (!g.attributes.color) {
      if (color != null) tint(g, color, ao == null ? 0.22 : ao);
      else g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
    }
    return g;
  };
  const skinAttr = (g, fn) => {
    const n = g.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const ws = fn(i); let tot = 0;
      for (const w of ws) tot += w[1];
      ws.slice(0, 4).forEach(([k, w], j) => { si[i * 4 + j] = idx.get(byKey.get(k)); sw[i * 4 + j] = w / tot; });
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  };
  const flip = (g) => { if (L < 0) g.rotateY(Math.PI); return g; };

  // Rigid piece: follows one bone.
  kit.add = (slot, geo, bone, color, ao, crease, xf) => {
    const g = finishGeo(lists[slot], geo, { color, ao, crease, xf });
    flip(g);
    const bi = idx.get(byKey.get(bone)), n = g.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    lists[slot].push(g);
    return g;
  };
  kit.mirror = (fn) => { fn(1); fn(-1); };

  // Skinned sweep. pts: path points; rad: per-point number or [rx, rz]; bind(i, u): bone weights for ring i.
  // opts: { seg, up, color, ao, ringColor(i), caps }
  kit.tube = (slot, pts, rad, bind, opts = {}) => {
    const seg = opts.seg || 14, n = pts.length, up0 = opts.up || V(0, 0, 1);
    const pos = [], nor = [], col = [], ringOf = [], ix = [];
    let prevSide = null;
    for (let i = 0; i < n; i++) {
      const t = pts[Math.min(n - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
      let side = new THREE.Vector3().crossVectors(t, up0);
      if (side.lengthSq() < 1e-4) side = prevSide ? prevSide.clone() : V(1, 0, 0);
      side.normalize();
      const nrm = new THREE.Vector3().crossVectors(side, t).normalize();
      prevSide = side;
      const r = Array.isArray(rad[i]) ? rad[i] : [rad[i], rad[i]];
      for (let k = 0; k < seg; k++) {
        const a = (k / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        const p = pts[i].clone().addScaledVector(side, c * r[0]).addScaledVector(nrm, s * r[1]);
        pos.push(p.x, p.y, p.z); ringOf.push(i);
      }
    }
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < seg; k++) {
      const a = i * seg + k, b = i * seg + (k + 1) % seg, c = (i + 1) * seg + k, d = (i + 1) * seg + (k + 1) % seg;
      ix.push(a, c, b, b, c, d);
    }
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(ix);
    g.computeVertexNormals();
    // Orientation check: make sure normals point outward from the path.
    const nA = g.attributes.normal, mid = Math.floor(n / 2) * seg;
    const outward = V(pos[mid * 3] - pts[Math.floor(n / 2)].x, pos[mid * 3 + 1] - pts[Math.floor(n / 2)].y, pos[mid * 3 + 2] - pts[Math.floor(n / 2)].z);
    if (outward.dot(V(nA.getX(mid), nA.getY(mid), nA.getZ(mid))) < 0) { const a = g.index.array; for (let q = 0; q < a.length; q += 3) { const tmp = a[q + 1]; a[q + 1] = a[q + 2]; a[q + 2] = tmp; } g.computeVertexNormals(); }
    g = g.toNonIndexed();
    const rings = [];
    // Map non-indexed vertices back to rings through the original index order.
    const src = ix.slice(); if (g.index) { /* never indexed after toNonIndexed */ }
    for (let q = 0; q < src.length; q++) rings.push(ringOf[src[q]]);
    // Caps (flat, separate vertices).
    const capGeo = (i0, dir) => {
      const c = pts[i0], r = Array.isArray(rad[i0]) ? rad[i0] : [rad[i0], rad[i0]];
      const t = pts[Math.min(n - 1, i0 + 1)].clone().sub(pts[Math.max(0, i0 - 1)]).normalize();
      let side = new THREE.Vector3().crossVectors(t, up0); if (side.lengthSq() < 1e-4) side = V(1, 0, 0); side.normalize();
      const nrm = new THREE.Vector3().crossVectors(side, t).normalize();
      const out = [], nn = [];
      for (let k = 0; k < seg; k++) {
        const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
        const p0 = c.clone().addScaledVector(side, Math.cos(a0) * r[0]).addScaledVector(nrm, Math.sin(a0) * r[1]);
        const p1 = c.clone().addScaledVector(side, Math.cos(a1) * r[0]).addScaledVector(nrm, Math.sin(a1) * r[1]);
        const tri = dir > 0 ? [c, p0, p1] : [c, p1, p0];
        for (const p of tri) { out.push(p.x, p.y, p.z); nn.push(t.x * dir, t.y * dir, t.z * dir); }
      }
      return { out, nn };
    };
    let allPos = Array.from(g.attributes.position.array), allNor = Array.from(g.attributes.normal.array);
    const capRings = [];
    if (opts.caps !== false) {
      for (const [i0, dir] of [[0, -1], [n - 1, 1]]) {
        const cg = capGeo(i0, dir);
        // Winding check against the outward direction handled by normals; flip winding if needed.
        allPos.push(...cg.out); allNor.push(...cg.nn);
        for (let q = 0; q < cg.out.length / 3; q++) capRings.push(i0);
      }
    }
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(allPos, 3));
    g2.setAttribute('normal', new THREE.Float32BufferAttribute(allNor, 3));
    const allRings = rings.concat(capRings);
    // Colours (baked shading + optional per-ring colour).
    const nv = allRings.length, carr = new Float32Array(nv * 3), base = new THREE.Color(opts.color != null ? opts.color : 0xffffff), ao = opts.ao == null ? 0.22 : opts.ao;
    const tmpc = new THREE.Color();
    for (let v = 0; v < nv; v++) {
      const c = opts.ringColor ? tmpc.set(opts.ringColor(allRings[v])) : tmpc.copy(base);
      const k = 1 - ao + ao * (allNor[v * 3 + 1] * 0.5 + 0.5) * 1.2;
      carr[v * 3] = c.r * k; carr[v * 3 + 1] = c.g * k; carr[v * 3 + 2] = c.b * k;
    }
    g2.setAttribute('color', new THREE.BufferAttribute(carr, 3));
    const P3 = g2.attributes.position, vp = V(0, 0, 0);
    skinAttr(g2, (v) => { vp.fromBufferAttribute(P3, v); if (L < 0) { vp.x = -vp.x; vp.z = -vp.z; } const w = bind(allRings[v], allRings[v] / (n - 1), vp); return typeof w === 'string' ? [[w, 1]] : w; });
    flip(g2);
    lists[slot].push(g2);
    return g2;
  };

  // Rigid hull/box/ellipsoid geometry in one call: kit.part(slot, geo, bone, color, ao, crease).
  kit.part = kit.add;

  // Bake: merge per slot, create the skinned mesh and bind it to the scene's bones.
  kit.finish = (opts = {}) => {
    const all = [], groups = [];
    let start = 0;
    lists.forEach((l, slot) => {
      if (!l.length) return;
      const m = l.length === 1 ? l[0] : mergeGeometries(l);
      const cnt = m.attributes.position.count;
      all.push(m); groups.push([start, cnt, slot]); start += cnt;
    });
    const geo = all.length === 1 ? all[0] : mergeGeometries(all);
    geo.clearGroups();
    for (const [s, c, slot] of groups) geo.addGroup(s, c, slot);
    geo.computeBoundingSphere();
    const sm = new THREE.SkinnedMesh(geo, slots);
    sm.name = name;
    sm.castShadow = true;
    sm.frustumCulled = false;
    scene.add(sm);
    const inverses = bones.map((b) => b.matrixWorld.clone().invert());
    sm.bind(new THREE.Skeleton(bones, inverses), new THREE.Matrix4());
    return sm;
  };
  return kit;
}

// Cheap procedural surface variation (object-space noise on colour and roughness) so flat vertex-coloured
// plates read as worn paint or skin rather than plastic.
export function addWear(mat, { amt = 0.28, fine = 140, coarse = 48, rough = 0.5 } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWp;
        float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float wearN = n3(vWp * ${coarse.toFixed(1)}) * 0.6 + n3(vWp * ${fine.toFixed(1)}) * 0.4;
        diffuseColor.rgb *= ${(1 - amt / 2).toFixed(3)} + ${amt.toFixed(3)} * wearN;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor *= ${(1 - rough / 2).toFixed(3)} + ${rough.toFixed(3)} * wearN;`);
  };
  mat.customProgramCacheKey = () => 'wear' + amt + fine + coarse + rough;
  return mat;
}

// Standard gear materials (vertex coloured, so a skin only changes the colours baked in).
export function gearMaterials({ metal = 0.5, rough = 0.42, glow = 0xffffff, glowI = 1.15, glowBase = 0x041218 } = {}) {
  const armor = addWear(new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, metalness: metal, roughness: rough }));
  const lights = new THREE.MeshStandardMaterial({ color: glowBase, emissive: glow, emissiveIntensity: glowI, roughness: 0.25, metalness: 0.2, vertexColors: true });
  return { armor, lights };
}

// ================================================================ Ironwood
// A hulking, heroic super-soldier in moss-green power armour: rounded helmet with a wide
// tinted visor, oversized pauldrons, chest plate, back canisters. Original design, built on the
// rigged soldier body: its sculpted plates are recoloured, the stock hood is cut away and the
// extra pieces merged into one skinned mesh (two materials).

// Hue-maps the stock desert-tan plates, red stripes, olive fabric and steel bits per the skin's rules.
function ironTexture(src, key, T) {
  const mapTo = (r, s, l) => [r.h, r.s0 + s * r.sk, r.l0 + l * r.lk];
  return recolorTexture(src, key, (h, s, l) => {
    if ((h < 14 || h > 335) && s > 0.45 && l > 0.2) { const o = mapTo(T.stripe, s, l); if (T.stripe.glow) o.push(T.stripe.glow); return o; }
    if (h >= 14 && h < 70 && s > 0.12) return mapTo(T.plate, s, l);
    if (h >= 70 && h < 175 && s > 0.08) return mapTo(T.fabric, s, l);
    if (h >= 175 && h < 260 && s > 0.06 && l > 0.2) return mapTo(T.steel, s, l);
    return [T.fabric.h, Math.min(0.15, s + 0.03), l * 0.9];
  });
}

export function buildIronwood(scene, skin) {
  const C = skin.c, T = skin.tex;
  const { armor, lights } = gearMaterials({ metal: 0.45, rough: 0.4, glow: C.visor, glowI: 1.0 });
  // Visor: tinted, reflective glass.
  const glass = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, metalness: 0.85, roughness: 0.1, emissive: C.visor, emissiveIntensity: 0.1 });
  const kit = makeKit(scene, [armor, glass, lights], 'ironwood_armor');
  const { J, add, mirror } = kit;
  const SM = Math.PI / 4.2;
  const head = J('Head'), neck = J('Neck'), s2 = J('Spine2');

  // ---- helmet: squared dome, wide curved visor, jaw guard and rebreather ----
  const hc = V(0, head.y + 0.105, head.z + 0.05); // helmet centre
  const R = [0.142, 0.158, 0.165], E = [0.78, 0.82];
  const H = (slot, geo, color, ao) => add(slot, geo, 'Head', color, ao);
  H(0, ell(hc, R, null, 36, E), C.steel, 0.3);
  // Jaw guard, cheek plates and ear sensors.
  H(0, ell(V(0, hc.y - 0.1, hc.z + 0.035), [0.112, 0.082, 0.132], null, 30, [0.7, 0.7]), C.steel2, 0.3);
  mirror((s) => {
    H(0, ell(V(s * 0.112, hc.y - 0.06, hc.z + 0.015), [0.03, 0.07, 0.085], null, 16), C.steel2, 0.25);
    H(0, limb(V(s * 0.132, hc.y + 0.0, hc.z - 0.015), V(s * 0.16, hc.y + 0.0, hc.z - 0.015), 0.048, 0.048, 0.044, 0.044, V(0, 1, 0), 0.45), C.dark, 0.2);
    H(2, bevBox(V(s * 0.1615, hc.y + 0.0, hc.z - 0.015), [0.003, 0.014, 0.014], 0.002), null);
    H(0, ell(V(s * 0.058, hc.y - 0.13, hc.z + 0.145), [0.024, 0.024, 0.02], null, 12), C.dark, 0.1);
  });
  // The visor: a curved lens that tapers toward the temples, dark tinted glass with a bright lower edge.
  const lonMax = 82 * Math.PI / 180;
  const vR = [R[0] + 0.006, R[1] + 0.006, R[2] + 0.007];
  const winLat = (u) => [(-24 + 14 * u * u) * Math.PI / 180, (24 - 14 * u * u) * Math.PI / 180];
  const c0 = new THREE.Color(C.visor2), c1 = new THREE.Color(C.visor).multiplyScalar(0.55);
  add(1, patch(hc, vR, -lonMax, lonMax, winLat, 36, 12, (u, v) => c0.clone().lerp(c1, Math.pow(1 - v, 2.4)), E), 'Head', null);
  add(2, patch(hc, [vR[0] + 0.0012, vR[1] + 0.0012, vR[2] + 0.0012], -lonMax * 0.96, lonMax * 0.96, (u) => { const b = winLat(u)[0]; return [b - 0.022, b + 0.002]; }, 36, 2, null, E), 'Head', null);
  // Brow band (cream) above the visor and a low dorsal crest.
  add(0, patch(hc, [R[0] + 0.004, R[1] + 0.004, R[2] + 0.005], -lonMax * 0.92, lonMax * 0.92, (u) => { const t = winLat(u)[1]; return [t + 0.004, t + 0.055]; }, 32, 2, null, E), 'Head', C.trim, 0.1);
  H(0, ell(V(0, hc.y + 0.152, hc.z - 0.02), [0.012, 0.03, 0.12], null, 12), C.trim, 0.15);
  // Rebreather snout and chin.
  H(0, bevBox(V(0, hc.y - 0.125, hc.z + 0.14), [0.04, 0.032, 0.028], 0.012), C.dark, 0.2);
  H(0, ell(V(0, hc.y - 0.178, hc.z + 0.075), [0.055, 0.026, 0.075], null, 14), C.steel2, 0.3);
  // Antenna whip, right side.
  H(0, limb(V(-0.14, hc.y - 0.02, hc.z - 0.06), V(-0.17, hc.y + 0.4, hc.z - 0.12), 0.006, 0.006, 0.0025, 0.0025, V(0, 0, 1)), C.dark, 0);
  // Collar closing the neck.
  add(0, loft([[0.07, 0.1, 0.085, 0.092, 2.4, 0], [-0.02, 0.14, 0.11, 0.12, 2.5, 0], [-0.075, 0.19, 0.13, 0.14, 2.5, 0]], neck.y, 0, -0.045, 20), 'Neck', C.dark, 0.3, SM);

  // ---- chest plate ----
  const cy = s2.y;
  add(0, loft([[-0.095, 0.16, 0.168, 0.09, 2.6, 0.014], [-0.03, 0.19, 0.18, 0.09, 2.6, 0.02], [0.05, 0.208, 0.176, 0.09, 2.6, 0.02], [0.105, 0.18, 0.158, 0.09, 2.6, 0.01]], cy, 0, -0.035, 20), 'Spine2', C.steel, 0.3, SM);
  // Sternum ridge and a cream stripe across the chest.
  add(0, limb(V(0, cy + 0.1, 0.152), V(0, cy - 0.09, 0.157), 0.012, 0.008, 0.012, 0.008, V(1, 0, 0)), 'Spine2', C.steel2, 0.2);
  add(2, bevBox(V(0, cy - 0.045, 0.171), [0.045, 0.0045, 0.004], 0.002), 'Spine2', null);

  // ---- power pack: a slim slab with two canisters ----
  const bz = -0.205;
  add(0, bevBox(V(0, cy + 0.0, bz - 0.05), [0.115, 0.17, 0.055], 0.026), 'Spine2', C.steel, 0.28);
  add(0, bevBox(V(0, cy + 0.2, bz - 0.04), [0.08, 0.028, 0.042], 0.014), 'Spine2', C.dark, 0.2);
  mirror((s) => {
    add(0, limb(V(s * 0.06, cy + 0.12, bz - 0.108), V(s * 0.06, cy - 0.22, bz - 0.108), 0.031, 0.031, 0.031, 0.031, V(0, 0, 1), 0.2), 'Spine2', C.steel2, 0.22);
    add(0, limb(V(s * 0.06, cy + 0.17, bz - 0.108), V(s * 0.06, cy + 0.135, bz - 0.108), 0.033, 0.033, 0.033, 0.033, V(0, 0, 1), 0.2), 'Spine2', C.trim, 0.1);
    add(2, bevBox(V(s * 0.06, cy + 0.178, bz - 0.108), [0.022, 0.003, 0.022], 0.002), 'Spine2', null);
  });

  // ---- shoulder pauldrons: smooth domed caps with a cream rim ----
  mirror((s) => {
    const key = s > 0 ? 'Left' : 'Right', sh = J(key + 'Arm');
    const c = V(s * 0.262, sh.y + 0.082, sh.z);
    add(0, ell(c, [0.112, 0.07, 0.112], [0, 0, s * 0.18], 26), key + 'Shoulder', C.steel, 0.3);
    const tor = new THREE.TorusGeometry(0.105, 0.007, 8, 32); tor.rotateX(Math.PI / 2); tor.rotateZ(s * 0.18); tor.translate(c.x, c.y - 0.043, c.z);
    add(0, tor, key + 'Shoulder', C.trim, 0.1);
  });

  // ---- forearm bracers and the wrist display ----
  mirror((s) => {
    const key = s > 0 ? 'Left' : 'Right';
    const e = J(key + 'ForeArm'), h = J(key + 'Hand');
    add(0, limb(e.clone().lerp(h, 0.2), e.clone().lerp(h, 0.82), 0.05, 0.056, 0.042, 0.048, V(0, 0, 1), 0.45), key + 'ForeArm', C.steel2, 0.26);
    add(0, limb(e.clone().lerp(h, 0.78), e.clone().lerp(h, 0.86), 0.054, 0.059, 0.054, 0.059, V(0, 0, 1), 0.45), key + 'ForeArm', C.trim, 0.1);
  });
  {
    const e = J('LeftForeArm'), h = J('LeftHand'), m = e.clone().lerp(h, 0.5);
    add(0, bevBox(V(m.x, m.y + 0.052, m.z - 0.005), [0.04, 0.012, 0.045], 0.007), 'LeftForeArm', C.dark, 0.2);
    add(2, bevBox(V(m.x, m.y + 0.0645, m.z - 0.005), [0.028, 0.002, 0.03], 0.001), 'LeftForeArm', null);
  }
  // ---- thigh plates and knee guards ----
  mirror((s) => {
    const key = s > 0 ? 'Left' : 'Right', k = J(key + 'Leg'), u = J(key + 'UpLeg');
    const mid = u.clone().lerp(k, 0.45);
    add(0, limb(mid.clone().add(V(0, 0.1, 0.06)), mid.clone().add(V(0, -0.1, 0.07)), 0.058, 0.03, 0.054, 0.03, V(1, 0, 0), 0.5), key + 'UpLeg', C.steel, 0.25);
    add(0, ell(V(k.x, k.y + 0.005, k.z + 0.1), [0.056, 0.06, 0.034], [0.25, 0, 0], 18), key + 'Leg', C.steel2, 0.25);
    add(0, limb(V(k.x - 0.05, k.y - 0.07, k.z + 0.108), V(k.x + 0.05, k.y - 0.07, k.z + 0.108), 0.01, 0.01, 0.01, 0.01, V(0, 1, 0), 0.5), key + 'Leg', C.trim, 0.1);
  });

  const sm = kit.finish();

  // ---- body: recolour, drop the stock hood and visor ----
  let body = null; const cuts = [];
  scene.traverse((o) => { if (o.isSkinnedMesh && o !== sm) { if (/visor/i.test(o.name)) cuts.push(o); else body = o; } });
  cuts.forEach((o) => o.removeFromParent());
  if (body) {
    const mat = body.material.clone();
    if (mat.map && mat.map.image) {
      const t = ironTexture(mat.map, skin.id, T);
      mat.map = t.map;
      if (t.glow) { mat.emissiveMap = t.glow; mat.emissive = new THREE.Color(0xffffff); mat.emissiveIntensity = 0.5; }
    }
    mat.color.setScalar(1); mat.metalness = 0.4; mat.roughness = 0.55;
    body.material = mat;
    // Remove triangles whose vertices all belong to the head (the stock hood).
    const g0 = body.geometry, SI = g0.attributes.skinIndex, SW = g0.attributes.skinWeight;
    const hi = body.skeleton.bones.indexOf(kit.byKey.get('Head'));
    const flags = new Uint8Array(g0.attributes.position.count);
    for (let i = 0; i < flags.length; i++) for (let k = 0; k < 4; k++) if (SI.getComponent(i, k) === hi && SW.getComponent(i, k) > 0.5) flags[i] = 1;
    const src = g0.index.array, keep = [];
    for (let i = 0; i < src.length; i += 3) if (!(flags[src[i]] && flags[src[i + 1]] && flags[src[i + 2]])) keep.push(src[i], src[i + 1], src[i + 2]);
    const g1 = new THREE.BufferGeometry();
    for (const k of Object.keys(g0.attributes)) g1.setAttribute(k, g0.attributes[k]);
    g1.setIndex(keep);
    g1.computeBoundingSphere();
    body.geometry = g1;
  }
  return sm;
}


// ================================================================ Bonelord extras
// A gold crown (Gilded King) and a burning ember in the ribcage (Cinder).
export function buildCrown(scene, skin) {
  const gold = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, metalness: 1, roughness: 0.28 });
  const glow = new THREE.MeshStandardMaterial({ color: 0x180600, emissive: 0xff6a1a, emissiveIntensity: 2.2, vertexColors: true });
  const kit = makeKit(scene, [gold, glow], 'bonelord_extras');
  const head = kit.J('Head'), top = kit.has('HeadTop_End') ? kit.J('HeadTop_End') : V(head.x, head.y + 0.2, head.z);
  if (skin.crown) {
    const cy = top.y - 0.075, cz = head.z + 0.012;
    const band = new THREE.TorusGeometry(0.102, 0.013, 8, 36); band.rotateX(Math.PI / 2); band.scale(1, 1, 1.1); band.translate(0, cy, cz);
    kit.add(0, band, 'Head', 0xffd36a, 0.15);
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI * 0.5 + (i / 4) * Math.PI; // -90..90 deg around +Z
      const x = Math.sin(ang) * 0.102, z = Math.cos(ang) * 0.112;
      const h = i === 2 ? 0.085 : i % 2 ? 0.05 : 0.065;
      const c = new THREE.ConeGeometry(0.016, h, 6); c.translate(x, cy + h / 2 + 0.006, cz + z * 1.0);
      kit.add(0, c, 'Head', 0xffd36a, 0.15);
      const gem = new THREE.OctahedronGeometry(0.011, 0); gem.translate(x, cy + h + 0.012, cz + z);
      kit.add(1, gem, 'Head', i === 2 ? 0xff3b3b : 0xff7a3a, 0);
    }
    for (let i = 0; i < 3; i++) { // gem band
      const ang = (i - 1) * 0.5, g = new THREE.OctahedronGeometry(0.014, 0); g.scale(1, 1.3, 0.6); g.translate(Math.sin(ang) * 0.106, cy, cz + Math.cos(ang) * 0.12);
      kit.add(1, g, 'Head', [0x56d8ff, 0xff4d4d, 0x56d8ff][i], 0);
    }
  }
  if (skin.ember) {
    const sp = kit.J('Spine2');
    kit.add(1, ell(V(0, sp.y + 0.03, sp.z + 0.01), [0.045, 0.055, 0.04]), 'Spine2', 0xffa040, 0);
    kit.add(1, ell(V(0, sp.y + 0.03, sp.z + 0.01), [0.075, 0.085, 0.065]), 'Spine2', 0x7a2a08, 0);
  }
  return kit.finish();
}
