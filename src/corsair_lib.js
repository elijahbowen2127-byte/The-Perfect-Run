// Toolkit for the pirate captain (corsair.js): noise, skinned grid surfaces, ribbons, feathers, hair cards,
// texture recolouring with UV regions, island hiding on the veteran's own clothing, a torso surface sampler.
// Everything works in the kit's canonical frame (+Z forward, the character's left on +X, metres, rest pose).
import * as THREE from 'three';
import { V } from './armor.js';
import { real } from './realmat.js';
import { chainW } from './outfit.js';

export const TAU = Math.PI * 2;
export const sstep = THREE.MathUtils.smoothstep;
export const clamp = THREE.MathUtils.clamp;
export const mix = (a, b, t) => a + (b - a) * t;
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export function rng(seed) { let s = (seed * 2654435761) >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
export function vnoise(x, y = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const h = (a, b) => hash(a * 57.3 + b * 131.9);
  return mix(mix(h(xi, yi), h(xi + 1, yi), u), mix(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}
export const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 5, y * 2.1 + 9) * 0.3 + vnoise(x * 4.3 + 2, y * 4.3 + 7) * 0.15;
export const col = (c) => new THREE.Color(c);
export const lerpCol = (a, b, t) => col(a).lerp(col(b), t);
export const shade = (c, k) => col(c).multiplyScalar(k);

// ------------------------------------------------------------ materials
// real() material made double-sided (cloth sheets are seen from inside at the cut-away edges).
export function dsided(m, tag = 'ds') {
  const c = m.clone();
  c.onBeforeCompile = m.onBeforeCompile; c.side = THREE.DoubleSide;
  const k = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
  c.customProgramCacheKey = () => k + tag;
  return c;
}
// Plain vertex-coloured material for feathers, hair, beaks.
// Hair material: vertex colours with fine vertical streaks (strand noise in object space), a soft sheen.
export function hairMat() {
  const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, color: 0xffffff, roughness: 0.5, metalness: 0, side: THREE.DoubleSide, sheen: 0.3, sheenRoughness: 0.4, sheenColor: new THREE.Color(0.42, 0.32, 0.24) });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 hP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nhP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 hP; float hH;
      float hh(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float hn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(hh(i), hh(i+vec3(1,0,0)), f.x), mix(hh(i+vec3(0,1,0)), hh(i+vec3(1,1,0)), f.x), f.y), mix(mix(hh(i+vec3(0,0,1)), hh(i+vec3(1,0,1)), f.x), mix(hh(i+vec3(0,1,1)), hh(i+vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      hH = hn(vec3(hP.x * 130.0, hP.y * 9.0, hP.z * 130.0)) * 0.65 + hn(vec3(hP.x * 260.0, hP.y * 18.0, hP.z * 260.0)) * 0.35;
      diffuseColor.rgb *= 0.6 + 0.8 * hH;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor * (0.75 + 0.6 * hH), 0.2, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { vec3 sx = normalize(dFdx(-vViewPosition)), sy = normalize(dFdy(-vViewPosition)); vec3 r1 = cross(sy, normal), r2 = cross(normal, sx); float det = dot(sx, r1); vec2 dH = vec2(dFdx(hH), dFdy(hH)) * 1.0;
        normal = normalize(abs(det) * normal - sign(det) * (dH.x * r1 + dH.y * r2)); }`);
  };
  m.customProgramCacheKey = () => 'corsairhair';
  return m;
}
export function softMat(rough = 0.6, metal = 0, side = THREE.DoubleSide) {
  return new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, roughness: rough, metalness: metal, side });
}

// ------------------------------------------------------------ skinned geometry
// Bakes any geometry (canonical coordinates) into the kit as a skinned piece.
// opts.bind(p, i) -> bone name | [[bone, w]..]; opts.color(p, n, i) -> colour; opts.ao shading strength.
export function skinGeo(kit, slot, geo, o = {}) {
  const { L, idx, byKey, lists } = kit;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  let g = geo.index ? geo.toNonIndexed() : geo;
  for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a);
  const n = g.attributes.position.count, P = g.attributes.position, N = g.attributes.normal;
  const carr = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), vp = V(0, 0, 0), vn = V(0, 0, 0), tmp = new THREE.Color();
  const ao = o.ao == null ? 0.22 : o.ao;
  for (let i = 0; i < n; i++) {
    vp.fromBufferAttribute(P, i); vn.fromBufferAttribute(N, i);
    const c = o.color ? o.color(vp, vn, i) : 0xffffff;
    tmp.set(c);
    const k = 1 - ao + ao * (vn.y * 0.5 + 0.5) * 1.2;
    carr[i * 3] = tmp.r * k; carr[i * 3 + 1] = tmp.g * k; carr[i * 3 + 2] = tmp.b * k;
    let w = typeof o.bind === 'function' ? o.bind(vp, i) : o.bind || 'Hips';
    if (typeof w === 'string') w = [[w, 1]];
    let tot = 0; for (const x of w) tot += x[1];
    w.slice(0, 4).forEach(([k2, wt], j) => { si[i * 4 + j] = idx.get(byKey.get(k2)); sw[i * 4 + j] = wt / tot; });
  }
  g.setAttribute('color', new THREE.BufferAttribute(carr, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  if (L < 0) g.rotateY(Math.PI);
  lists[slot].push(g);
  return g;
}

// Indexed grid surface from rows[j][i] points. closed wraps i. Winding flips with `flip`.
export function gridGeo(rows, { closed = false, flip = false, skip = null } = {}) {
  const nj = rows.length, ni = rows[0].length, pos = new Float32Array(nj * ni * 3);
  rows.forEach((r, j) => r.forEach((p, i) => { pos[(j * ni + i) * 3] = p.x; pos[(j * ni + i) * 3 + 1] = p.y; pos[(j * ni + i) * 3 + 2] = p.z; }));
  const ix = [], ie = closed ? ni : ni - 1;
  for (let j = 0; j < nj - 1; j++) for (let i = 0; i < ie; i++) {
    const a = j * ni + i, b = j * ni + (i + 1) % ni, c = (j + 1) * ni + i, d = (j + 1) * ni + (i + 1) % ni;
    if (skip) { const q = V(0, 0, 0); for (const k of [a, b, c, d]) q.add(V(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2])); if (skip(q.multiplyScalar(0.25), j, i)) continue; }
    if (flip) ix.push(a, b, c, b, d, c); else ix.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(ix); g.computeVertexNormals();
  return g;
}

// A surface from a function f(u, v) -> Vector3 with u, v in 0..1 (nu x nv quads).
export function surfGeo(nu, nv, f, o = {}) {
  const rows = [];
  for (let j = 0; j <= nv; j++) { const r = []; for (let i = 0; i <= nu; i++) r.push(f(i / nu, j / nv)); rows.push(r); }
  return gridGeo(rows, o);
}

// Rounded-rectangle ribbon swept along pts (band with thickness): rows of 8 points per ring.
export function ribbonGeo(pts, width, thick, up0 = V(0, 1, 0), o = {}) {
  const n = pts.length, rows = [];
  const wf = typeof width === 'function' ? width : () => width, tf = typeof thick === 'function' ? thick : () => thick;
  let prevSide = null;
  for (let i = 0; i < n; i++) {
    const t = pts[Math.min(n - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
    const up = typeof up0 === 'function' ? up0(pts[i], i) : up0;
    let side = new THREE.Vector3().crossVectors(t, up);
    if (side.lengthSq() < 1e-6) side = prevSide ? prevSide.clone() : V(1, 0, 0);
    side.normalize(); prevSide = side;
    const nrm = new THREE.Vector3().crossVectors(side, t).normalize(); // out of the band's face
    const w = wf(i / (n - 1), i) * 0.5, h = tf(i / (n - 1), i) * 0.5, ring = [];
    const cs = [[1, 0.0], [1, 1], [0.0, 1], [-1, 1], [-1, 0.0], [-1, -1], [0.0, -1], [1, -1]];
    for (const [a, b] of cs) ring.push(pts[i].clone().addScaledVector(side, a * w * (Math.abs(b) > 0.5 && Math.abs(a) > 0.5 ? 0.94 : 1)).addScaledVector(nrm, b * h));
    rows.push(ring);
  }
  const g = gridGeo(rows, { closed: true, flip: o.flip });
  if (o.caps !== false) return capEnds(g, rows, o.flip);
  return g;
}
// Round tube along a Catmull curve (radius number or fn(t)).
export function tubeGeo(pts, rad, seg = 8, nsub, o = {}) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  const N = nsub || Math.max(6, pts.length * 4), rows = [];
  const rf = typeof rad === 'function' ? rad : () => rad;
  const frames = curve.computeFrenetFrames(N, false);
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = curve.getPointAt(t), r = rf(t), ring = [];
    for (let k = 0; k < seg; k++) { const a = (k / seg) * TAU; ring.push(p.clone().addScaledVector(frames.normals[i], Math.cos(a) * r * (o.ex || 1)).addScaledVector(frames.binormals[i], Math.sin(a) * r)); }
    rows.push(ring);
  }
  const g = gridGeo(rows, { closed: true, flip: o.flip });
  return o.caps === false ? g : capEnds(g, rows, o.flip);
}
function capEnds(g, rows, flip) {
  const ni = rows[0].length, nj = rows.length, pos = Array.from(g.attributes.position.array), ix = Array.from(g.index.array);
  for (const [j, dir] of [[0, 0], [nj - 1, 1]]) {
    const c = V(0, 0, 0); for (let i = 0; i < ni; i++) c.add(rows[j][i]); c.multiplyScalar(1 / ni);
    const ci = pos.length / 3; pos.push(c.x, c.y, c.z);
    for (let i = 0; i < ni; i++) { const a = j * ni + i, b = j * ni + (i + 1) % ni; if ((dir === 0) !== !!flip) ix.push(ci, b, a); else ix.push(ci, a, b); }
  }
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g2.setIndex(ix); g2.computeVertexNormals();
  return g2;
}
// Merge several geometries (any indexedness) into one non-indexed geometry with positions + normals.
export function mergeG(list) {
  const P = [], N = [];
  for (const g0 of list) {
    if (!g0.attributes.normal) g0.computeVertexNormals();
    const g = g0.index ? g0.toNonIndexed() : g0;
    P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  return g;
}
export function xform(g, m) { g.applyMatrix4(m); return g; }

// ------------------------------------------------------------ body weights
export const TORSO = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck'];
// Weights for a point on a garment: spine chain above the pelvis, blended into the leg bones below it.
export function bodyBind(kit, o = {}) {
  const top = o.legTop ?? 1.04, bot = o.legBot ?? 0.62, maxLeg = o.maxLeg ?? 0.9, spread = o.spread ?? 0.1;
  return (p) => {
    const w = (1 - sstep(p.y, bot, top)) * sstep(Math.abs(p.x), 0.0, spread) * maxLeg;
    const upper = p.y > 1.05 ? chainW(kit, TORSO, p.y) : [['Hips', 1]];
    if (w < 0.001) return upper;
    const side = p.x >= 0 ? 'Left' : 'Right';
    return [...upper.map(([k, v]) => [k, v * (1 - w)]), [side + 'UpLeg', w]];
  };
}
export function torsoBind(kit) { return (p) => chainW(kit, TORSO, p.y); }
// A point along an arm (A = 'Left' | 'Right') -> bone weights blended at the elbow.
export function armBind(kit, A) {
  const el = kit.J(A + 'ForeArm').x * (A === 'Left' ? 1 : 1), sh = kit.J(A + 'Shoulder');
  return (p) => {
    const t = sstep(Math.abs(p.x), Math.abs(el) - 0.07, Math.abs(el) + 0.07);
    const w0 = 1 - sstep(Math.abs(p.x), Math.abs(sh.x), Math.abs(sh.x) + 0.04);
    return [[A + 'Shoulder', w0 * (1 - t)], [A + 'Arm', (1 - w0) * (1 - t)], [A + 'ForeArm', t]];
  };
}
// Leg weights for a point on the leg: thigh above the knee, shin below.
export function legBind(kit, A) {
  const kn = kit.J(A + 'Leg').y, an = kit.J(A + 'Foot').y;
  return (p) => {
    const t = 1 - sstep(p.y, kn - 0.08, kn + 0.08), f = 1 - sstep(p.y, an - 0.02, an + 0.07);
    return [[A + 'UpLeg', 1 - t], [A + 'Leg', t * (1 - f)], [A + 'Foot', f]];
  };
}

// ------------------------------------------------------------ texture recolour with UV regions
// fn(h, s, l, u, v) -> [h, s, l] or null. Cached by key. Reads the source image into a canvas.
const rcCache = new Map();
export function recolorUV(src, key, fn) {
  const ck = src.uuid + '|' + key;
  if (rcCache.has(ck)) return rcCache.get(ck);
  const W = src.image.width, H = src.image.height, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d'); x.drawImage(src.image, 0, 0);
  const img = x.getImageData(0, 0, W, H), d = img.data, rgb = [0, 0, 0];
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const i = (y * W + xx) * 4;
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dl = mx - mn;
    let h = 0, s = 0;
    if (dl > 1e-4) { s = l > 0.5 ? dl / (2 - mx - mn) : dl / (mx + mn); h = mx === r ? ((g - b) / dl + (g < b ? 6 : 0)) : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4; h *= 60; }
    const o = fn(h, s, l, xx / W, y / H);
    if (!o) continue;
    const c = tmpC.setHSL(((o[0] % 360) + 360) % 360 / 360, clamp(o[1], 0, 1), clamp(o[2], 0, 1), THREE.SRGBColorSpace);
    c.getRGB(tmpO, THREE.SRGBColorSpace);
    d[i] = tmpO.r * 255; d[i + 1] = tmpO.g * 255; d[i + 2] = tmpO.b * 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.flipY = src.flipY; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = src.wrapS; t.wrapT = src.wrapT; t.anisotropy = 8;
  rcCache.set(ck, t);
  return t;
}
const tmpC = new THREE.Color(), tmpO = { r: 0, g: 0, b: 0 };

// ------------------------------------------------------------ veteran's own clothing
// Connected components ("islands") of a skinned mesh, by welded positions.
export function islands(geo) {
  const p = geo.attributes.position, ix = geo.index.array, n = p.count, par = Array.from({ length: n }, (_, i) => i);
  const f = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  const key = new Map();
  for (let i = 0; i < n; i++) { const k = Math.round(p.getX(i) * 1e4) + ',' + Math.round(p.getY(i) * 1e4) + ',' + Math.round(p.getZ(i) * 1e4); if (key.has(k)) par[f(i)] = f(key.get(k)); else key.set(k, i); }
  for (let t = 0; t < ix.length; t += 3) { par[f(ix[t + 1])] = f(ix[t]); par[f(ix[t + 2])] = f(ix[t]); }
  const ids = new Map(), of = new Int32Array(n);
  for (let i = 0; i < n; i++) { const r = f(i); if (!ids.has(r)) ids.set(r, ids.size); of[i] = ids.get(r); }
  return { of, count: ids.size };
}
// Replace a skinned mesh's index with the triangles for which keep(tri centroid in canonical coords, island id) is true.
export function filterTris(mesh, keep) {
  const g0 = mesh.geometry;
  if (!g0.userData.isl) g0.userData.isl = islands(g0);
  const isl = g0.userData.isl, p = g0.attributes.position, ix = g0.index.array, out = [], v = V(0, 0, 0), c = V(0, 0, 0);
  mesh.skeleton.update();
  for (let t = 0; t < ix.length; t += 3) {
    c.set(0, 0, 0); let mn = 9;
    for (let k = 0; k < 3; k++) { v.fromBufferAttribute(p, ix[t + k]); mesh.applyBoneTransform(ix[t + k], v); v.applyMatrix4(mesh.matrixWorld); c.add(v); mn = Math.min(mn, v.y); }
    c.multiplyScalar(1 / 3);
    if (keep(c, isl.of[ix[t]], mn)) out.push(ix[t], ix[t + 1], ix[t + 2]);
  }
  const g = g0.clone(); g.userData = { isl }; g.setIndex(out);
  mesh.geometry = g;
}
export function findMesh(scene, re) { let r = null; scene.traverse((o) => { if (o.isSkinnedMesh && re.test(o.name)) r = o; }); return r; }
export function cloneMat(m, fn) { const c = m.clone(); if (fn) fn(c); return c; }

// Samples the veteran's outfit as a radial surface: returns surf(y, theta) -> radius from the axis (0, cz).
export function sampleTorso(mesh, cz = 0.01) {
  const NY = 140, NT = 72, y0 = 0.55, y1 = 1.6, R = new Float32Array(NY * NT).fill(-1);
  const p = mesh.geometry.attributes.position, v = V(0, 0, 0);
  mesh.skeleton.update();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); mesh.applyBoneTransform(i, v); v.applyMatrix4(mesh.matrixWorld);
    if (Math.abs(v.x) > 0.25 && v.y > 1.38) continue;
    if (Math.abs(v.x) > 0.3) continue;
    const yb = Math.floor((v.y - y0) / (y1 - y0) * NY); if (yb < 0 || yb >= NY) continue;
    const th = Math.atan2(v.x, v.z - cz), tb = Math.floor(((th + TAU) % TAU) / TAU * NT), r = Math.hypot(v.x, v.z - cz);
    if (r > R[yb * NT + tb]) R[yb * NT + tb] = r;
  }
  // fill gaps by interpolation around, then down
  for (let j = 0; j < NY; j++) {
    const row = R.subarray(j * NT, (j + 1) * NT);
    const known = []; row.forEach((r, i) => { if (r >= 0) known.push(i); });
    if (!known.length) continue;
    for (let i = 0; i < NT; i++) if (row[i] < 0) {
      let a = i, b = i, da = 0, db = 0;
      while (row[(a + NT) % NT] < 0 && da < NT) { a--; da++; }
      while (row[(b + NT) % NT] < 0 && db < NT) { b++; db++; }
      const ra = row[(a + NT) % NT], rb = row[(b + NT) % NT];
      row[i] = -2 - (ra * db + rb * da) / (da + db);
    }
    for (let i = 0; i < NT; i++) if (row[i] < -1.5) row[i] = -(row[i] + 2); // keep marker positive
  }
  for (let j = 0; j < NY; j++) { let any = false; for (let i = 0; i < NT; i++) if (R[j * NT + i] >= 0) any = true; if (!any && j > 0) for (let i = 0; i < NT; i++) R[j * NT + i] = R[(j - 1) * NT + i]; }
  for (let j = NY - 2; j >= 0; j--) { let any = false; for (let i = 0; i < NT; i++) if (R[j * NT + i] >= 0) any = true; if (!any) for (let i = 0; i < NT; i++) R[j * NT + i] = R[(j + 1) * NT + i]; }
  return (y, th) => {
    const fy = clamp((y - y0) / (y1 - y0) * NY - 0.5, 0, NY - 1.001), j = Math.floor(fy), ty = fy - j;
    const ft = (((th % TAU) + TAU) % TAU) / TAU * NT - 0.5, i = Math.floor(ft), tt = ft - i;
    const g = (jj, ii) => R[jj * NT + ((ii % NT) + NT) % NT];
    return mix(mix(g(j, i), g(j, i + 1), tt), mix(g(j + 1, i), g(j + 1, i + 1), tt), ty);
  };
}

// ------------------------------------------------------------ feathers and hair cards
// A feather card: a curved tapered blade with a mid-rib, from base point along dir (unit), length len, width w.
// bend curves it toward `curl` (a vector), the vane is cupped slightly. Returns indexed geometry.
export function featherGeo(base, dir, len, w, curl = V(0, -1, 0), bendAmt = 0.3, nu = 3, nv = 9, tip = 0.45) {
  const side = new THREE.Vector3().crossVectors(dir, curl).normalize();
  if (side.lengthSq() < 0.5) side.set(1, 0, 0);
  const nrm = new THREE.Vector3().crossVectors(side, dir).normalize();
  const rows = [];
  for (let j = 0; j <= nv; j++) {
    const t = j / nv, spine = base.clone().addScaledVector(dir, len * t).addScaledVector(curl, bendAmt * len * t * t);
    // outline: a quick ramp up from the quill, then a rounded end over the last `tip` fraction
    const t0 = 1 - tip, prof = (0.4 + 0.6 * Math.sin(Math.min(1, t / 0.3) * Math.PI * 0.5)) * (t < t0 ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow((t - t0) / (1 - t0), 2))));
    const ww = w * 0.5 * Math.max(0.02, prof), r = [];
    for (let i = 0; i <= nu; i++) {
      const u = i / nu * 2 - 1;
      r.push(spine.clone().addScaledVector(side, u * ww).addScaledVector(nrm, -Math.abs(u) * ww * 0.18 + (Math.abs(u) < 0.01 ? 0.0006 : 0)));
    }
    rows.push(r);
  }
  return gridGeo(rows);
}

// ------------------------------------------------------------ misc geometry
export function lathe(profile, seg = 32, rot) { // profile: [[r, y], ...]
  const rows = profile.map(([r, y]) => { const ring = []; for (let k = 0; k < seg; k++) { const a = (k / seg) * TAU; ring.push(V(Math.sin(a) * r, y, Math.cos(a) * r)); } return ring; });
  return gridGeo(rows, { closed: true, flip: true });
}
export function boxG(c, h, rot) {
  const g = new THREE.BoxGeometry(h[0] * 2, h[1] * 2, h[2] * 2);
  if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')));
  g.translate(c.x, c.y, c.z); return g;
}
export function sphereG(c, r, seg = 14) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(6, Math.round(seg * 0.7)));
  g.scale(r[0], r[1], r[2]); g.translate(c.x, c.y, c.z); return g;
}
export function orient(g, from, to) { // rotate geometry so +Y axis maps along (to - from) and place at from
  const d = to.clone().sub(from), q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(from, q, V(1, 1, 1))); return g;
}
export const slot = { wool: 0, leather: 1, gilt: 2, linen: 3, steel: 4, felt: 5, hair: 6, silk: 7, feather: 8, matte: 9, wood: 10, rope: 11, woolSS: 12 };
export { real };
