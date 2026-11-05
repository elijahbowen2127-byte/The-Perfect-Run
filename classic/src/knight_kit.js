// Toolkit for the three knight designs: parametric skinned surfaces, rolled edges, rivets, straps,
// a fine riveted-mail material, canvas heraldry, bone-weight helpers and the shared body under-layers.
// Everything works in the kit's canonical frame (+Z forward, character's left on +X, metres, T-pose rest).
import * as THREE from 'three';
import { V, chainWeights } from './armor.js';
import { real } from './realmat.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
// smoothstep that also accepts reversed edges (a > b gives 1 below b and 0 above a)
export const sstep = (x, a, b) => (a <= b ? THREE.MathUtils.smoothstep(x, a, b) : 1 - THREE.MathUtils.smoothstep(x, b, a));
export const clamp = THREE.MathUtils.clamp;
export const mix = (a, b, t) => a + (b - a) * t;
export const sp = (a, k) => Math.sign(a) * Math.pow(Math.abs(a), k);
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export function vnoise(x, y = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const h = (a, b) => hash(a * 57.3 + b * 131.7);
  return mix(mix(h(xi, yi), h(xi + 1, yi), u), mix(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}
// Piecewise smooth interpolation through rows [x, a, b, ...] (ascending x); returns the array of values.
export function tab(rows, x) {
  const n = rows.length;
  if (x <= rows[0][0]) return rows[0].slice(1);
  if (x >= rows[n - 1][0]) return rows[n - 1].slice(1);
  let i = 0; while (i < n - 2 && x > rows[i + 1][0]) i++;
  const r0 = rows[Math.max(0, i - 1)], r1 = rows[i], r2 = rows[i + 1], r3 = rows[Math.min(n - 1, i + 2)];
  const t = (x - r1[0]) / (r2[0] - r1[0]), t2 = t * t, t3 = t2 * t;
  const out = [];
  for (let k = 1; k < r1.length; k++) {
    const p0 = r0[k], p1 = r1[k], p2 = r2[k], p3 = r3[k];
    out.push(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3));
  }
  return out;
}

// ------------------------------------------------------------------ materials
// A fine riveted-mail material: a triplanar ring lattice as a bump + cavity mask, vertex coloured, dark between the rings.
let _mail = null;
export function mailMaterial() {
  if (_mail) return _mail;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, metalness: 0.85, roughness: 0.5, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 mP; varying vec3 mN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nmP = position; mN = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 mP; varying vec3 mN;
      float mH; float mFar;
      float mRing(vec2 p, float fw){
        vec2 a = fract(p) - 0.5, b = fract(p + 0.5) - 0.5;
        float da = length(a * vec2(1.0, 1.25)), db = length(b * vec2(1.0, 1.25));
        float wd = 0.15 + fw * 0.9;
        float ha = clamp(1.0 - abs(da - 0.33) / wd, 0.0, 1.0), hb = clamp(1.0 - abs(db - 0.33) / wd, 0.0, 1.0);
        return max(ha, hb * 0.78);
      }
      float mPat(vec3 p, vec3 w, float fw) {
        float u = 56.0;
        float pat = mRing(p.yz * u, fw) * w.x + mRing(p.xz * u, fw) * w.y + mRing(p.xy * u, fw) * w.z;
        float k = 1.0 - smoothstep(0.1, 0.32, fw);
        return mix(0.5, pat, k);
      }
      vec3 mPerturb(vec3 surfPos, vec3 surfNorm, vec2 dH, float faceDir){
        vec3 sx = normalize(dFdx(surfPos)), sy = normalize(dFdy(surfPos));
        vec3 r1 = cross(sy, surfNorm), r2 = cross(surfNorm, sx);
        float det = dot(sx, r1) * faceDir;
        vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
        return normalize(abs(det) * surfNorm - grad);
      }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 mW = pow(abs(normalize(mN)), vec3(4.0)); mW /= (mW.x + mW.y + mW.z);
        float mFw = length(fwidth(mP * 56.0));
        mH = mPat(mP, mW, mFw);
        mFar = smoothstep(0.1, 0.32, mFw);
        diffuseColor.rgb *= mix(0.34 + 0.95 * mH, 0.5, mFar);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(mix(roughnessFactor * (1.35 - 0.8 * mH), 0.78, mFar), 0.12, 1.0);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.5, mFar);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = mPerturb(-vViewPosition, normal, vec2(dFdx(mH), dFdy(mH)) * 1.8, faceDirection);`);
  };
  m.customProgramCacheKey = () => 'kmail2';
  _mail = m;
  return m;
}
// Double-sided copy of a realmat material (open cloth hems and thin plates are seen from both sides).
const _ds = new Map();
export function dsided(m, tag = 'ds') {
  const k = m.uuid + tag;
  if (_ds.has(k)) return _ds.get(k);
  const c = m.clone();
  c.onBeforeCompile = m.onBeforeCompile;
  const base = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
  c.customProgramCacheKey = () => base + tag;
  c.side = THREE.DoubleSide;
  _ds.set(k, c);
  return c;
}
// Cloth material carrying a painted canvas texture (heraldry, quilting, wear) on top of the vertex colour.
export function decalMaterial(kind, tex, o = {}) {
  const base = real(kind, o);
  const c = base.clone();
  c.onBeforeCompile = base.onBeforeCompile;
  const key = base.customProgramCacheKey ? base.customProgramCacheKey() : '';
  c.customProgramCacheKey = () => key + 'decal';
  c.map = tex; c.side = THREE.DoubleSide;
  return c;
}

// ------------------------------------------------------------------ canvas helpers
export function canvasTex(w, h, draw, repeat = false) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
export const css = (c) => '#' + new THREE.Color(c).getHexString();
// Cloth speckle, weave streaks and soiling over a painted canvas.
export function weathering(g, w, h, amt = 1, seed = 1) {
  const R = (i) => hash(i * 7.77 + seed);
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 2600 * amt; i++) {
    const x = R(i) * w, y = R(i + 9000) * h, r = 0.5 + R(i + 5000) * 2.2;
    g.fillStyle = R(i + 3000) > 0.45 ? `rgba(0,0,0,${0.02 + R(i + 1) * 0.07})` : `rgba(255,250,235,${0.02 + R(i + 2) * 0.05})`;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  for (let i = 0; i < 70 * amt; i++) { // dirty vertical streaks and road dust toward the hem
    const x = R(i + 400) * w, y0 = R(i + 800) * h, len = 40 + R(i + 120) * 260;
    const gr = g.createLinearGradient(0, y0, 0, y0 + len); gr.addColorStop(0, 'rgba(60,45,30,0)'); gr.addColorStop(1, `rgba(60,45,30,${0.05 + R(i + 17) * 0.08})`);
    g.fillStyle = gr; g.fillRect(x, y0, 2 + R(i + 66) * 9, len);
  }
  const hem = g.createLinearGradient(0, h * 0.72, 0, h); hem.addColorStop(0, 'rgba(70,50,30,0)'); hem.addColorStop(1, `rgba(70,50,30,${0.28 * amt})`);
  g.fillStyle = hem; g.fillRect(0, h * 0.72, w, h * 0.28);
}

// ------------------------------------------------------------------ skinned surfaces
// surf(kit, slot, nu, nv, fn, o): a parametric patch. fn(u, v, out) writes a canonical-frame point for u, v in 0..1.
// o: closed (u wraps), closedV (v wraps), color (hex | fn(p, n, u, v)), ao, shade(p, n, u, v) -> scalar,
//    bind(p, u, v) -> bone key | [[key, weight], ...], center (Vector3 | fn(u,v)) for the outward test, flip, uv [su, sv].
const _c = new THREE.Color(), _t = new THREE.Vector3();
export function surf(kit, slot, nu, nv, fn, o = {}) {
  const { L, idx, byKey, lists } = kit;
  const cols = o.closed ? nu : nu + 1, rows = o.closedV ? nv : nv + 1, n = cols * rows;
  const pos = new Float32Array(n * 3), uvs = o.uv ? new Float32Array(n * 2) : null;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    fn(i / nu, j / nv, _t);
    const k = j * cols + i;
    pos[k * 3] = _t.x; pos[k * 3 + 1] = _t.y; pos[k * 3 + 2] = _t.z;
    if (uvs) { uvs[k * 2] = (o.uvOff ? o.uvOff[0] : 0) + (i / nu) * o.uv[0]; uvs[k * 2 + 1] = (o.uvOff ? o.uvOff[1] : 0) + (j / nv) * o.uv[1]; }
  }
  const ix = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    if (o.skip && o.skip((i + 0.5) / nu, (j + 0.5) / nv)) continue;
    const j1 = (j + 1) % rows, a = j * cols + i, b = j * cols + (i + 1) % cols, c = j1 * cols + i, d = j1 * cols + (i + 1) % cols;
    ix.push(a, c, b, b, c, d);
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(ix);
  g.computeVertexNormals();
  // outward test
  let flip = o.flip;
  if (flip === undefined) {
    const nA = g.attributes.normal; let s = 0;
    const cen = new THREE.Vector3();
    if (!o.center) { for (let k = 0; k < n; k++) cen.add(_t.set(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2])); cen.divideScalar(n); }
    for (let k = 0; k < n; k++) {
      let cx, cy, cz;
      if (o.center && o.center.isVector3) { cx = o.center.x; cy = o.center.y; cz = o.center.z; }
      else if (o.center) { const r = o.center(k % cols / Math.max(1, nu), Math.floor(k / cols) / Math.max(1, nv)); cx = r.x; cy = r.y; cz = r.z; }
      else if (o.closed && !o.perRow) { cx = cen.x; cy = pos[k * 3 + 1]; cz = cen.z; }
      else { cx = cen.x; cy = cen.y; cz = cen.z; }
      s += nA.getX(k) * (pos[k * 3] - cx) + nA.getY(k) * (pos[k * 3 + 1] - cy) + nA.getZ(k) * (pos[k * 3 + 2] - cz);
    }
    flip = s < 0;
  }
  if (flip) { for (let q = 0; q < ix.length; q += 3) { const t = ix[q + 1]; ix[q + 1] = ix[q + 2]; ix[q + 2] = t; } g.setIndex(ix); g.computeVertexNormals(); }
  if (uvs) g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g = g.toNonIndexed();
  if (o.uvFn) { const P0 = g.attributes.position, uv2 = new Float32Array(P0.count * 2), q = new THREE.Vector3(); for (let v = 0; v < P0.count; v++) { q.set(P0.getX(v), P0.getY(v), P0.getZ(v)); const r = o.uvFn(q); uv2[v * 2] = r[0]; uv2[v * 2 + 1] = r[1]; } g.setAttribute('uv', new THREE.BufferAttribute(uv2, 2)); }
  const P = g.attributes.position, N = g.attributes.normal, nv2 = P.count;
  const col = new Float32Array(nv2 * 3), si = new Uint16Array(nv2 * 4), sw = new Float32Array(nv2 * 4);
  const ao = o.ao == null ? 0.2 : o.ao, p = new THREE.Vector3(), nn = new THREE.Vector3();
  // u, v per vertex (needed for colour/bind callbacks): recover from the original index order
  const uvOf = new Float32Array(nv2 * 2);
  { let w = 0; for (let q = 0; q < ix.length; q++) { const k = ix[q], j = Math.floor(k / cols), i = k % cols; uvOf[w++] = i / nu; uvOf[w++] = j / nv; } }
  const baseCol = typeof o.color === 'function' ? null : new THREE.Color(o.color == null ? 0xffffff : o.color);
  for (let v = 0; v < nv2; v++) {
    p.set(P.getX(v), P.getY(v), P.getZ(v)); nn.set(N.getX(v), N.getY(v), N.getZ(v));
    const u = uvOf[v * 2], vv = uvOf[v * 2 + 1];
    if (baseCol) _c.copy(baseCol); else _c.set(o.color(p, nn, u, vv));
    let k = 1 - ao + ao * (nn.y * 0.5 + 0.5) * 1.2;
    if (o.shade) k *= o.shade(p, nn, u, vv);
    col[v * 3] = _c.r * k; col[v * 3 + 1] = _c.g * k; col[v * 3 + 2] = _c.b * k;
    let w = typeof o.bind === 'function' ? o.bind(p, u, vv) : o.bind;
    if (typeof w === 'string') w = [[w, 1]];
    if (w.length > 4) { w = w.slice().sort((a, b) => b[1] - a[1]).slice(0, 4); }
    let tot = 0; for (const x of w) tot += x[1];
    w.forEach(([key, wt], j) => { si[v * 4 + j] = idx.get(byKey.get(key)); sw[v * 4 + j] = wt / tot; });
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  if (!o.uv && !o.uvFn) g.deleteAttribute('uv');
  if (L < 0) g.rotateY(Math.PI);
  g.userData.tag = o.tag || new Error().stack.split('\n')[2].trim().slice(-60);
  lists[slot].push(g);
  return g;
}

// A tube along a path of points (closed loop or open): radius number | [rx, rz] | fn(j / (n-1)).
// Used for rolled edges, cords, straps (flat: rx >> rz), rings of rivets, belts.
export function tubeAlong(kit, slot, pts, rad, bind, o = {}) {
  const n = pts.length, seg = o.seg || 8, closed = !!o.closed;
  const fr = [];
  const up0 = o.up || V(0, 1, 0);
  let prevSide = null;
  for (let j = 0; j < n; j++) {
    const a = pts[closed ? (j - 1 + n) % n : Math.max(0, j - 1)], b = pts[closed ? (j + 1) % n : Math.min(n - 1, j + 1)];
    const t = b.clone().sub(a).normalize();
    let side = new THREE.Vector3().crossVectors(t, up0);
    if (side.lengthSq() < 1e-5) side = prevSide ? prevSide.clone() : V(1, 0, 0);
    side.normalize(); prevSide = side;
    fr.push([t, side, new THREE.Vector3().crossVectors(side, t).normalize()]);
  }
  const rr = (j) => { const r = typeof rad === 'function' ? rad(j / (closed ? n : n - 1)) : rad; return Array.isArray(r) ? r : [r, r]; };
  const e = o.n || 2;
  return surf(kit, slot, seg, closed ? n : n - 1, (u, v, out) => {
    const j = Math.round(v * (closed ? n : n - 1)) % n, [rx, rz] = rr(j), a = u * TAU;
    const c = Math.cos(a), s = Math.sin(a);
    const x = e === 2 ? c : sp(c, 2 / e), z = e === 2 ? s : sp(s, 2 / e);
    out.copy(pts[j]).addScaledVector(fr[j][1], x * rx).addScaledVector(fr[j][2], z * rz);
  }, { closed: true, closedV: closed, ao: o.ao ?? 0.15, color: o.color, bind: bind, shade: o.shade, center: (u, v) => pts[Math.round(v * (closed ? n : n - 1)) % n] });
}

// Circle/ellipse loop of points in a horizontal plane (or tilted by a matrix).
export function loopPts(cx, cy, cz, rx, rz, N = 48, f = null, a0 = 0, a1 = TAU) {
  const out = [];
  const full = Math.abs(a1 - a0 - TAU) < 1e-6;
  const cnt = full ? N : N + 1;
  for (let i = 0; i < cnt; i++) {
    const a = a0 + (a1 - a0) * (i / N);
    const p = V(cx + Math.sin(a) * rx, cy, cz + Math.cos(a) * rz);
    if (f) f(p, a, i / N);
    out.push(p);
  }
  return out;
}

// Rivet heads / studs: many small domes merged into one rigid piece.
let _sph = null;
export function studs(kit, slot, bone, pts, r, color, o = {}) {
  if (!_sph) _sph = new THREE.SphereGeometry(1, 7, 5);
  const gs = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  for (const p of pts) {
    const g = _sph.clone();
    const nrm = p.n || V(0, 0, 1);
    q.setFromUnitVectors(V(0, 0, 1), nrm);
    const rad = (p.r || r);
    s.set(rad, rad, rad * (o.flat || 0.55));
    m.compose(p.p || p, q, s);
    g.applyMatrix4(m); g.deleteAttribute('uv');
    gs.push(g);
  }
  if (!gs.length) return;
  const geo = mergeGeometries(gs);
  return kit.add(slot, geo, bone, color, o.ao ?? 0.1);
}

// Rigid piece from any geometry with a transform; wrapper over kit.add.
export const place = (kit, slot, geo, bone, color, ao = 0.2, xf) => kit.add(slot, geo, bone, color, ao, undefined, xf);

// ------------------------------------------------------------------ bone weights
export function makeWeights(kit) {
  const torsoKeys = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck'];
  const torso = (y) => chainWeights(kit, torsoKeys, y);
  const arm = (A, p, opt = {}) => {
    const d = Math.abs(p.x), wSh = sstep(d, opt.sh0 ?? 0.08, opt.sh1 ?? 0.2), wEl = sstep(d, 0.405, 0.495), wWr = sstep(d, 0.675, 0.735);
    const out = [];
    const t = torso(p.y);
    for (const [k, w] of t) if (w * (1 - wSh) > 0.01) out.push([k, w * (1 - wSh)]);
    const a = wSh * (1 - wEl), f = wSh * wEl * (1 - wWr), h = wSh * wEl * wWr;
    if (a > 0.01) out.push([A + 'Arm', a]); if (f > 0.01) out.push([A + 'ForeArm', f]); if (h > 0.01) out.push([A + 'Hand', h]);
    return out;
  };
  const leg = (A, p, opt = {}) => {
    const y = p.y, wHip = sstep(y, 1.08, 0.94), wKn = sstep(y, 0.62, 0.5), wAn = sstep(y, 0.17, 0.09);
    const out = [];
    if (wHip < 0.99) for (const [k, w] of torso(Math.max(y, 1.0))) out.push([k, w * (1 - wHip)]);
    const u = wHip * (1 - wKn), l = wHip * wKn * (1 - wAn), f = wHip * wKn * wAn;
    if (u > 0.01) out.push([A + 'UpLeg', u]); if (l > 0.01) out.push([A + 'Leg', l]); if (f > 0.01) out.push([A + 'Foot', f]);
    return out;
  };
  return { torso, arm, leg };
}

// ------------------------------------------------------------------ cross-section helpers
// Point on a superellipse section around (cx, cz) at angle th (0 = +Z front, +X toward the character's left).
export function secPt(out, cx, y, cz, rx, zf, zb, n, th, off = 0) {
  const s = Math.sin(th), c = Math.cos(th), e = 2 / n;
  const x = rx * sp(s, e), z = (c >= 0 ? zf : zb) * sp(c, e);
  out.set(cx + x, y, cz + z);
  if (off) { out.x += off * s; out.z += off * c; }
  return out;
}

// Finish the kit: every geometry needs the same attribute set to merge, so give all of them a (zero) uv.
export function finishKit(kit) {
  kit.lists.forEach((l, si) => l.forEach((g, gi) => { const a = g.attributes.position.array; for (let i = 0; i < a.length; i++) if (!(a[i] === a[i])) { console.log('DBG NaN in slot ' + si + ' geo ' + gi + ' n=' + g.attributes.position.count + ' tag=' + (g.userData.tag || '')); break; } }));
  for (const l of kit.lists) for (const g of l) if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return kit.finish();
}
