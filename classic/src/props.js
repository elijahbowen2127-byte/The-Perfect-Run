// Biome prop library: smooth, organic, textured props (noise-displaced rocks, branching bark trees with
// drooping needle sprays, fluted ruins, faceted crystals). Everything is built from merged geometry with
// baked vertex AO so each prop type stays one instanced draw call per spatial cell.
import * as THREE from 'three';
import { mulberry32 } from './rng.js';
import * as TX from './textures.js';
import { iceMat } from './elements.js';
import { rockGeo, softBox, tube, limbs, spray, clump, lathe, finish, paint, merge, noise3, setColor, clamp, lerp } from './geo.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const sm = (t) => t * t * (3 - 2 * t);

// Shared wind clock for sway shaders.
export const WIND = { uT: { value: 0 } };

function windify(mat, { amp = 0.0016, grass = false, fade = [0.7, 2.3] } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWT = WIND.uT;
    // Cards are lit the same from both sides (no back-face normal flip), like soft foliage.
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
    // Fade cards out right in front of the camera so standing inside a canopy stays usable.
    sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', `diffuseColor.a *= smoothstep(${fade[0].toFixed(2)}, ${fade[1].toFixed(2)}, length(vViewPosition));\n#include <alphatest_fragment>`);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWT;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
#else
  vec3 ip = vec3(0.0);
#endif
  float wph = uWT * ${grass ? '1.9' : '1.1'} + ip.x * 0.21 + ip.z * 0.17;
  ${grass
    ? 'float wg = uv.y * uv.y * 0.16; transformed.x += (sin(wph) + 0.4 * sin(wph * 2.7 + position.x * 3.0)) * wg; transformed.z += cos(wph * 0.9 + position.z * 2.0) * wg * 0.6;'
    : `float wg = max(position.y, 0.0); wg = wg * wg * ${amp.toFixed(5)}; transformed.x += (sin(wph) + 0.35 * sin(wph * 2.3 + 1.7)) * wg; transformed.z += cos(wph * 0.9) * wg * 0.7;`}`);
  };
  mat.customProgramCacheKey = () => 'wind' + (grass ? 'g' : 't') + amp + fade[1];
  return mat;
}

const stdMat = (opts) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, vertexColors: true, ...opts });

export function stoneMat(tint, extra = {}) {
  const m = TX.rockMaps(tint);
  return stdMat({ map: m.map, normalMap: m.normalMap, normalScale: new THREE.Vector2(1.3, 1.3), roughness: 0.93, ...extra });
}
function barkMat(tint) {
  const bk = TX.barkMaps(tint);
  return stdMat({ map: bk.map, normalMap: bk.normalMap, normalScale: new THREE.Vector2(1.5, 1.5), roughness: 0.96 });
}
function foliageMat(kind, Q, tint, fade) {
  const m = TX.sprayMaps(kind);
  const mat = stdMat({ map: m.map, alphaMap: m.alphaMap, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.8, color: tint || 0xffffff, alphaToCoverage: Q >= 1 });
  return windify(mat, { amp: 0.0014, fade });
}

// Extruded gravestone outline with a rounded or pointed top.
function slabGeo(w, h, d, round, seed) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h);
  if (round) s.absarc(0, h, w / 2, 0, Math.PI, false);
  else { s.lineTo(w * 0.1, h + w * 0.42); s.lineTo(-w * 0.1, h + w * 0.42); }
  s.lineTo(-w / 2, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 2, curveSegments: 14 });
  g.translate(0, 0, -d / 2);
  jitter(g, 0.018, 4, seed);
  return g;
}
function jitter(g, amp, freq, seed) {
  const nz = noise3(seed), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i, x + (nz.n(x * freq, y * freq, z * freq) - 0.5) * amp * 2, y + (nz.n(x * freq + 9, y * freq, z * freq) - 0.5) * amp * 2, z + (nz.n(x * freq, y * freq + 7, z * freq) - 0.5) * amp * 2);
  }
}
const mossy = (g, seed, y1 = 0.5, k = 1) => {
  const nz = noise3(seed);
  return paint(g, (x, y, z, nx, ny) => {
    const m = clamp((y1 - y) / y1) * 0.7 + clamp(ny - 0.2) * 0.35 + (nz.fbm(x * 3, y * 3, z * 3, 3) - 0.5) * 0.7;
    const t = clamp(m * k);
    return [1 - t * 0.45, 1 - t * 0.08, 1 - t * 0.55];
  });
};

// Faces of `g` that point upwards, lifted slightly: a snow or dust cap that follows the rock's shape.
function capFaces(g, { minNy = 0.45, lift = 0.05, seed = 1, noise = 0.25 } = {}) {
  const p = g.attributes.position, n = g.attributes.normal, nz = noise3(seed);
  const pos = [], nor = [], uvs = [];
  for (let i = 0; i < p.count; i += 3) {
    let ny = 0, cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) { ny += n.getY(i + k) / 3; cx += p.getX(i + k) / 3; cy += p.getY(i + k) / 3; cz += p.getZ(i + k) / 3; }
    const thr = minNy + (nz.fbm(cx * 2.5, cy * 2.5, cz * 2.5, 3) - 0.5) * noise;
    if (ny < thr) continue;
    for (let k = 0; k < 3; k++) {
      const x = p.getX(i + k), y = p.getY(i + k), z = p.getZ(i + k), l = lift * (0.6 + 0.8 * clamp((n.getY(i + k) - thr) * 3 + 0.3));
      pos.push(x + n.getX(i + k) * l, y + n.getY(i + k) * l, z + n.getZ(i + k) * l);
      nor.push(n.getX(i + k), n.getY(i + k) + 0.25, n.getZ(i + k));
      uvs.push(x * 0.7, z * 0.7);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  setColor(out, 1, 1, 1);
  return out;
}

// Wooden bracket the player stands on up in a climbable tree (see World.buildProps / Player.climb).
function forkGeo(rTrunk, seed) {
  // Standing area reaches rTrunk + 1.45 (see World platforms): a solid bark deck near the trunk, and
  // lashed branch planks fanning out to the rim so it reads as a natural platform, not a disc.
  const R = rTrunk + 0.95, Rp = rTrunk + 1.45, rnd = mulberry32(seed);
  const deck = lathe([[rTrunk * 0.95, -1.5], [rTrunk * 1.15, -0.8], [R * 0.6, -0.34], [R * 0.97, -0.15], [R, 0.0], [R * 0.9, 0.07], [R * 0.55, 0.09], [0.01, 0.09]], { seg: 18, lobes: 6, lobeAmp: 0.07, noiseAmp: 0.07, seed, uvScale: 0.5 });
  paint(deck, (x, y) => 0.5 + 0.5 * sm(clamp((y + 1.3) / 1.4)));
  const list = [deck];
  const nz = noise3(seed + 3);
  const nPlank = 8;
  for (let i = 0; i < nPlank; i++) {
    const a = (i / nPlank) * Math.PI * 2 + (rnd() - 0.5) * 0.25, len = lerp(R * 0.8, Rp, 0.55 + rnd() * 0.45), pts = [];
    for (let k = 0; k <= 3; k++) { const t = k / 3; pts.push(V3(Math.cos(a) * (rTrunk * 0.6 + t * (len - rTrunk * 0.6)), 0.0 + Math.sin(t * 3) * 0.02 - t * 0.06, Math.sin(a) * (rTrunk * 0.6 + t * (len - rTrunk * 0.6)))); }
    list.push(tube(pts, (t) => lerp(0.13, 0.07, t), 5, { vScale: 0.5, noise: nz, wob: 0.12, capEnd: true }));
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rnd() * 0.8, pts = [];
    for (let k = 0; k <= 4; k++) { const t = k / 4; const rr = rTrunk * 0.9 + t * (Rp * 0.8 - rTrunk * 0.9); pts.push(V3(Math.cos(a) * rr, -1.7 + t * 1.65 + Math.sin(t * Math.PI) * 0.1, Math.sin(a) * rr)); }
    list.push(tube(pts, (t) => lerp(0.17, 0.08, t), 6, { vScale: 0.5, noise: nz, wob: 0.1, capEnd: true }));
  }
  return merge(list);
}

export function crystalCluster(seed, n, size) {
  const rnd = mulberry32(seed), list = [];
  for (let i = 0; i < n; i++) {
    const r = (i === 0 ? 0.34 : 0.14 + rnd() * 0.14) * size, h = (i === 0 ? 1.5 : 0.5 + rnd() * 0.9) * size;
    const body = new THREE.CylinderGeometry(r * 0.88, r, h, 6, 1), tip = new THREE.ConeGeometry(r * 0.88, h * 0.5 + r, 6, 1).translate(0, h / 2 + (h * 0.5 + r) / 2, 0);
    body.translate(0, h / 2, 0);
    const bg = merge([finish(body, { smooth: false }), finish(tip, { smooth: false })]);
    const a = rnd() * 6.28, tilt = i === 0 ? (rnd() - 0.5) * 0.2 : 0.35 + rnd() * 0.5, d = i === 0 ? 0 : 0.2 + rnd() * 0.35;
    bg.rotateY(rnd() * 6.28).rotateZ(tilt).rotateY(a).translate(Math.cos(a) * d, -0.05, Math.sin(a) * d);
    paint(bg, (x, y) => 0.7 + 0.3 * clamp(y / 1.0));
    list.push(bg);
  }
  return merge(list);
}

export function propLibrary(biome, Q = 2) {
  const id = biome.id;
  const stoneTint = id === 'desert' ? [0.78, 0.6, 0.42] : id === 'frozen' ? [0.6, 0.66, 0.74] : id === 'volcanic' ? [0.22, 0.19, 0.18] : id === 'abyss' ? [0.22, 0.18, 0.3] : [0.52, 0.52, 0.5];
  const stone = stoneMat(stoneTint);
  const tomb = stoneMat([0.6, 0.6, 0.58]);
  const barkTint = id === 'frozen' ? [0.32, 0.26, 0.22] : id === 'volcanic' ? [0.15, 0.12, 0.11] : id === 'graveyard' ? [0.3, 0.26, 0.22] : [0.3, 0.22, 0.15];
  const bark = barkMat(barkTint);
  const snowMat = stdMat({ roughness: 0.62, color: 0xf2f6fb });
  const lib = {};
  const rd = [3, 4, 5][Q];

  // ---------- rocks ----------
  const rockVar = (seeds, opts = {}, caps = false) => seeds.map((sd) => {
    const g = rockGeo({ seed: sd, detail: rd, ...opts });
    const parts = [{ geo: g, mat: opts.mat || stone }];
    if (caps || id === 'frozen') parts.push({ geo: capFaces(g, { seed: sd, lift: 0.06 }), mat: snowMat });
    return parts;
  });
  lib.rock = () => ({ variants: rockVar([11, 12, 13], { mat: stone, tint: id === 'forest' ? [0.9, 1, 0.8] : null }), r: 1.0, s: [0.8, 2.6], sink: 0.28, n: 70 });
  lib.snowrock = () => ({ variants: rockVar([31, 32], { mat: stone }, true), r: 1.1, s: [1, 3], sink: 0.3, n: 50 });
  lib.mesa = () => {
    const seg = [28, 36, 48][Q], hs = [10, 14, 20][Q];
    const g = new THREE.CylinderGeometry(0.8, 1.05, 1.3, seg, hs, false);
    const nz = noise3(23), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z);
      if (r < 1e-4) continue;
      const a = Math.atan2(z, x), t = (y + 0.65) / 1.3;
      const terr = Math.floor(t * 7) / 7, k = 1 + (nz.fbm(Math.cos(a) * 1.6 + 3, t * 3.2, Math.sin(a) * 1.6, 4) - 0.5) * 0.45 + (Math.sin(t * 50) * 0.02 + (terr - t) * 0.5) * (1 - clamp((t - 0.88) * 8)) + (t < 0.15 ? (0.15 - t) * 1.2 : 0);
      const cap = y > 0.6 ? (nz.fbm(x * 3, 0, z * 3, 3) - 0.5) * 0.08 : 0;
      p.setXYZ(i, x * k, y + cap, z * k);
    }
    const out = finish(g, { crease: 70, uvScale: 0.5 });
    // Sandstone strata bands.
    paint(out, (x, y, z) => { const b = 0.5 + 0.5 * Math.sin(y * 34 + nz.fbm(x * 2, y * 2, z * 2, 2) * 5); const w = clamp((y + 0.65) / 0.4); return [1 - 0.18 * b + 0.04, 1 - 0.28 * b, 1 - 0.42 * b] .map((v) => v * (0.6 + 0.4 * w)); });
    return { parts: [{ geo: out, mat: stone }], r: 1.1, s: [4, 7], sink: 1, n: 14 };
  };
  lib.floater = () => ({ parts: [{ geo: rockGeo({ seed: 41, detail: rd, underhang: true, squash: 0.9, planes: 8, flatBottom: 9 }), mat: stone }], r: 0, s: [1, 3], n: 30, float: [6, 20] });

  // ---------- graveyard ----------
  lib.tomb = () => {
    const vars = [0, 1, 2].map((v) => {
      const slab = slabGeo(0.8, 0.8 + v * 0.1, 0.2, v !== 1, 5 + v);
      const base = softBox(1.0, 0.2, 0.5, { r: 0.04, seed: 7 + v }).translate(0, 0.1, 0);
      const pts = [finish(slab, { crease: 50, uvScale: 0.9 }).translate(0, 0.14, 0), base];
      const g = merge(pts);
      mossy(g, 20 + v, 0.55, 1.1);
      return [{ geo: g, mat: tomb }];
    });
    return { variants: vars, r: 0.5, s: [0.8, 1.3], tilt: 0.15, n: 160, cluster: 6 };
  };
  lib.cross = () => {
    const vars = [0, 1].map((v) => {
      const a = softBox(0.22, 1.9, 0.2, { r: 0.05, seed: 3 + v }).translate(0, 0.95, 0);
      const b = softBox(0.9, 0.2, 0.2, { r: 0.05, seed: 4 + v }).translate(0, 1.32, 0);
      const base = softBox(0.7, 0.2, 0.5, { r: 0.04, seed: 5 }).translate(0, 0.1, 0);
      const list = [a, b, base];
      if (v === 1) list.push(finish(new THREE.TorusGeometry(0.3, 0.055, 8, 22), { crease: 80 }).translate(0, 1.32, 0));
      const g = merge(list);
      mossy(g, 30 + v, 0.6);
      return [{ geo: g, mat: tomb }];
    });
    return { variants: vars, r: 0.3, s: [0.8, 1.4], tilt: 0.2, n: 60, cluster: 4 };
  };
  lib.mausoleum = () => {
    const nzm = 5;
    const base = softBox(5, 3.2, 6, { r: 0.1, seed: nzm, seg: 6, erode: 0.02 }).translate(0, 1.7, 0);
    const step = softBox(5.8, 0.4, 6.8, { r: 0.07, seed: 6 }).translate(0, 0.2, 0);
    const step2 = softBox(5.4, 0.3, 6.4, { r: 0.07, seed: 7 }).translate(0, 0.55, 0);
    const shape = new THREE.Shape();
    shape.moveTo(-2.9, 0); shape.lineTo(2.9, 0); shape.lineTo(0, 1.9); shape.closePath();
    const gable = new THREE.ExtrudeGeometry(shape, { depth: 6.9, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 });
    gable.translate(0, 3.3, -3.45);
    const gF = finish(gable, { crease: 40, uvScale: 0.5 });
    const cor = softBox(5.7, 0.28, 6.7, { r: 0.07, seed: 9 }).translate(0, 3.38, 0);
    const pillars = [];
    for (const sx of [-2.1, 2.1]) {
      const col = lathe([[0.42, 0.0], [0.34, 0.12], [0.3, 0.3], [0.28, 1.5], [0.3, 2.9], [0.4, 3.0], [0.44, 3.2]], { seg: 14, lobes: 10, lobeAmp: 0.03, noiseAmp: 0.01 });
      pillars.push(col.translate(sx, 0.7, 3.2));
    }
    const g = merge([base, step, step2, gF, cor, ...pillars]);
    mossy(g, 40, 1.4, 0.9);
    // Dark recessed doorway with a faint green glow.
    const door = finish(new THREE.BoxGeometry(1.6, 2.4, 0.2, 1, 1, 1), { smooth: false });
    door.translate(0, 1.7, 3.0);
    const arch = finish(new THREE.CircleGeometry(0.8, 14, 0, Math.PI), { smooth: false });
    arch.translate(0, 3.0, 3.0);
    return {
      parts: [{ geo: g, mat: tomb }, { geo: merge([door, arch]), mat: stdMat({ color: 0x050505, emissive: 0x2a3a2a, emissiveIntensity: 0.6 }) }],
      r: 3.4, s: [0.9, 1.2], n: 8,
    };
  };
  lib.lantern = () => {
    const post = lathe([[0.16, 0.0], [0.13, 0.2], [0.07, 0.45], [0.055, 1.0], [0.06, 2.2], [0.09, 2.3]], { seg: 10 });
    const arm = tube([V3(0, 2.2, 0), V3(0.12, 2.38, 0), V3(0.2, 2.34, 0)], () => 0.025, 5);
    const frame = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) frame.push(tube([V3(sx * 0.16, 2.35, sz * 0.16), V3(sx * 0.16, 2.78, sz * 0.16)], () => 0.018, 4));
    const capG = finish(new THREE.ConeGeometry(0.28, 0.22, 4).rotateY(Math.PI / 4).translate(0, 2.93, 0), { crease: 30 });
    const base = finish(new THREE.CylinderGeometry(0.2, 0.17, 0.06, 8).translate(0, 2.35, 0), { crease: 40 });
    const metal = stdMat({ color: 0x1b1b1d, metalness: 0.85, roughness: 0.45 });
    const glass = finish(new THREE.SphereGeometry(0.15, 12, 8).translate(0, 2.57, 0), { crease: 80 });
    return {
      parts: [{ geo: merge([post, arm, ...frame, capG, base]), mat: metal }, { geo: glass, mat: stdMat({ color: 0xffc070, emissive: 0xffa040, emissiveIntensity: 3.2, vertexColors: false }) }],
      r: 0.2, s: [1, 1.1], n: 30,
    };
  };
  lib.puddle = () => {
    const g = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2);
    const p = g.attributes.position, nz = noise3(8);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z), a = Math.atan2(z, x); const k = 1 + (nz.fbm(Math.cos(a) * 1.5 + 4, 0, Math.sin(a) * 1.5, 3) - 0.5) * 0.7; p.setXYZ(i, x * k, 0.03, z * k); }
    const mat = new THREE.MeshStandardMaterial({ color: id === 'frozen' ? 0x9fc8e0 : 0x10181c, roughness: 0.04, metalness: 0.0, envMapIntensity: 1.6, transparent: true, opacity: 0.88, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    return { parts: [{ geo: finish(g, { smooth: false }), mat }], r: 0, s: [1.2, 3.2], n: 30, flat: true, noShadow: true, maxSlope: 0.5 };
  };
  lib.stump = () => {
    const pts = [V3(0, -0.2, 0), V3(0.02, 0.2, 0), V3(0, 0.55, 0.02), V3(-0.03, 0.82, 0)];
    const nz = noise3(14);
    const t = tube(pts, (tt, a) => (0.42 - tt * 0.1) * (1 + 0.5 * Math.exp(-tt * 9) * Math.max(0, Math.cos(a * 5 + 1))) * (1 + (nz.n(a * 2, tt * 3, 0) - 0.5) * 0.3), 14, { vScale: 0.5, uRep: 2, noise: nz, wob: 0.08 });
    const top = finish(new THREE.CircleGeometry(0.34, 14).rotateX(-Math.PI / 2).translate(0, 0.82, 0), { uv: 'keep', smooth: false });
    const tp = top.attributes.position, tu = top.attributes.uv;
    for (let i = 0; i < tp.count; i++) tu.setXY(i, tp.getX(i) / 0.68 + 0.5, tp.getZ(i) / 0.68 + 0.5);
    paint(t, (x, y) => 0.55 + 0.45 * clamp((y + 0.1) / 0.8));
    const rings = TX.ringMaps();
    return { parts: [{ geo: t, mat: bark }, { geo: top, mat: stdMat({ map: rings.map, normalMap: rings.normalMap, roughness: 0.9 }) }], r: 0.45, s: [0.8, 1.5], n: 24 };
  };

  // ---------- trees ----------
  const trunkTube = (H, r0, r1, lean, seed, radial, flare = 0.9) => {
    const rnd = mulberry32(seed), nz = noise3(seed + 9), pts = [];
    const nseg = 12, a = rnd() * 6.28, wob = 0.25 + rnd() * 0.3;
    for (let i = 0; i <= nseg; i++) {
      const t = i / nseg;
      pts.push(V3(Math.cos(a) * lean * t * t + Math.sin(t * 5 + seed) * wob * 0.06 * t, t * H - 0.3, Math.sin(a) * lean * t * t + Math.cos(t * 4 + seed) * wob * 0.06 * t));
    }
    const g = tube(pts, (t, an) => lerp(r0, r1, Math.pow(t, 0.8)) * (1 + flare * Math.exp(-t * 26) * (0.6 + 0.8 * Math.max(0, Math.cos(an * 5 + seed)))), radial, { uRep: 2, vScale: 0.4, noise: nz, wob: 0.07 });
    return g;
  };
  const pineLike = (snow) => () => {
    const vars = [0, 1].map((v) => {
      const seed = 40 + v + (snow ? 10 : 0), rnd = mulberry32(seed);
      const H = 10.4 + v * 0.8;
      const trunk = trunkTube(H, 0.34, 0.03, 0.4 + v * 0.3, seed, Q >= 1 ? 9 : 7);
      paint(trunk, (x, y) => 0.95 - 0.42 * sm(clamp((y - 1) / 3)));
      const layers = [8, 10, 14][Q], segs = [2, 3, 4][Q], sprays = [];
      const center = V3(0, 5, 0);
      for (let i = 0; i < layers; i++) {
        const t = i / (layers - 1), y = 1.8 + t * 8.3;
        const Lb = 2.9 * Math.pow(1 - t, 0.85) + 0.38;
        const nb = Math.max(3, Math.round(lerp(8, 4, t) * [0.7, 0.8, 1][Q]));
        const off = i * 0.97 + rnd();
        for (let k = 0; k < nb; k++) {
          const a = (k / nb) * Math.PI * 2 + off + (rnd() - 0.5) * 0.4, ln = Lb * (0.85 + rnd() * 0.3);
          const tint = [0.92 + rnd() * 0.16, 0.92 + rnd() * 0.16, 0.92 + rnd() * 0.16];
          sprays.push(spray({ base: V3(Math.cos(a) * 0.08, y + (rnd() - 0.5) * 0.35, Math.sin(a) * 0.08), out: V3(Math.cos(a), 0, Math.sin(a)), len: ln, width: ln * 0.62, droop: 0.5 - 0.3 * t + rnd() * 0.15, segs, ao0: 0.5 + 0.3 * t, ao1: 1.0, tint, center: center.clone().setY(y - 1) }));
        }
      }
      // Leader tip.
      for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + rnd(); sprays.push(spray({ base: V3(0, H - 0.9, 0), out: V3(Math.cos(a), 0, Math.sin(a)), len: 0.7, width: 0.5, droop: -0.9, segs: 2, ao0: 0.8, ao1: 1, tint: [1, 1, 1], center: V3(0, H - 2, 0) })); }
      return [{ geo: trunk, mat: bark }, { geo: merge(sprays), mat: foliageMat(snow ? 'snowpine' : 'pine', Q) }];
    });
    return { variants: vars, r: 0.7, s: [0.9, 1.7], n: 110, climb: 4.0, fork: forkGeo(0.7, 3), forkMat: bark };
  };
  lib.pine = pineLike(false);
  lib.snowpine = pineLike(true);

  const deadTree = (seed, twisted) => {
    const rnd = mulberry32(seed), nz = noise3(seed + 2);
    const H = twisted ? 6.6 : 6.4;
    const trunk = trunkTube(H, twisted ? 0.52 : 0.4, twisted ? 0.12 : 0.07, twisted ? 1.6 : 0.8, seed, Q >= 1 ? 9 : 7, 1.1);
    const list = [trunk], tips = [];
    const nl = [4, 5, 6][Q] + (twisted ? 0 : 0);
    for (let i = 0; i < nl; i++) {
      const t = 0.35 + 0.6 * (i + rnd() * 0.7) / nl, a = rnd() * 6.28, el = 0.35 + rnd() * 0.8;
      const start = V3(0, t * H - 0.3, 0);
      const dir = V3(Math.cos(a) * Math.cos(el * 0.6), Math.sin(el * 0.7) + (twisted ? 0.4 : 0.1), Math.sin(a) * Math.cos(el * 0.6));
      limbs(start, dir, (twisted ? 2.4 : 2.1) * (1.15 - t * 0.5) + rnd() * 0.8, (twisted ? 0.17 : 0.13) * (1.3 - t * 0.5), Q >= 2 ? 2 : 1, rnd, list, tips, { radial: 6, curl: twisted ? 0.7 : 0.35, up: twisted ? 0.5 : 0.1, kids: Q >= 2 ? 3 : 2, nz, lenK: 0.6 });
    }
    paint(trunk, (x, y) => 0.55 + 0.45 * clamp(y / 3));
    return { g: merge(list), tips, H, rnd };
  };
  lib.deadtree = () => {
    const vars = [0, 1].map((v) => { const t = deadTree(5 + v * 7, false); return [{ geo: t.g, mat: bark }]; });
    return { variants: vars, r: 0.5, s: [0.8, 1.5], n: 50, climb: 5.2, fork: forkGeo(0.5, 5), forkMat: bark };
  };
  lib.twisted = () => {
    const vars = [0, 1].map((v) => {
      const t = deadTree(9 + v * 5, true), clumps = [], rnd = mulberry32(70 + v);
      const nc = [6, 8, 10][Q];
      const tipsSorted = t.tips.slice().sort((a, b) => b.p.y - a.p.y).slice(0, nc);
      tipsSorted.forEach((tp, i) => {
        const c = tp.p.clone().add(V3((rnd() - 0.5) * 0.6, 0.3, (rnd() - 0.5) * 0.6));
        // Keep the climbing fork's neighbourhood open so the player and the camera are not buried in leaves.
        const hr = Math.hypot(c.x, c.z);
        if (hr < 3.4 && Math.abs(c.y - 5.4) < 3.0) { const k = 3.4 / Math.max(hr, 0.05), a = hr < 0.05 ? i * 2.4 : 0; c.x = hr < 0.05 ? Math.cos(a) * 3.4 : c.x * k; c.z = hr < 0.05 ? Math.sin(a) * 3.4 : c.z * k; }
        clumps.push(clump({ center: c, size: 2.1 + rnd() * 1.1, n: [4, 5, 7][Q], seed: 90 + i + v * 10, ball: true, ao: [0.7, 1], tint: [0.9 + rnd() * 0.2, 0.9 + rnd() * 0.2, 0.9 + rnd() * 0.2] }));
      });
      clumps.push(clump({ center: V3(0, t.H + 1.0, 0), size: 2.0, n: 5, seed: 99 + v, ball: true, ao: [0.7, 1] }));
      return [{ geo: t.g, mat: bark }, { geo: merge(clumps), mat: foliageMat('twisted', Q, null, [1.0, 3.4]) }];
    });
    return { variants: vars, r: 0.5, s: [0.8, 1.5], n: 70, climb: 5.4, fork: forkGeo(0.5, 6), forkMat: bark };
  };
  lib.log = () => {
    const nz = noise3(6), rnd = mulberry32(6);
    const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(V3(-2.5 + t * 5, 0.42 + Math.sin(t * 3) * 0.04 + (nz.n(t * 4, 0, 0) - 0.5) * 0.08, Math.sin(t * 4) * 0.12)); }
    const t = tube(pts, (tt) => 0.5 - tt * 0.06 + (nz.n(tt * 6, 1, 1) - 0.5) * 0.06, 12, { uRep: 2, vScale: 0.4, noise: nz, wob: 0.06 });
    const list = [t];
    for (let i = 0; i < 2; i++) { const x = -1 + rnd() * 2; list.push(tube([V3(x, 0.8, 0), V3(x + 0.05, 1.05, 0.45 * (i ? 1 : -1)), V3(x + 0.1, 1.2, 0.8 * (i ? 1 : -1))], (tt) => 0.1 - tt * 0.06, 6, { vScale: 0.5, capEnd: true })); }
    const g = merge(list);
    mossy(g, 60, 0.5, 1.2);
    const rings = TX.ringMaps();
    const cap = (x, s) => { const c = finish(new THREE.CircleGeometry(s < 0 ? 0.5 : 0.44, 14).rotateY(s * Math.PI / 2), { uv: 'keep', smooth: false }); const p = c.attributes.position, u = c.attributes.uv; for (let i = 0; i < p.count; i++) u.setXY(i, p.getZ(i) / 0.94 + 0.5, p.getY(i) / 0.94 + 0.5); return c.translate(x, 0.42, 0); };
    return { parts: [{ geo: g, mat: bark }, { geo: merge([cap(-2.5, -1), cap(2.5, 1)]), mat: stdMat({ map: rings.map, normalMap: rings.normalMap, roughness: 0.9 }) }], r: 1.0, s: [0.8, 1.2], n: 25 };
  };
  lib.mushroom = () => {
    const stem = lathe([[0.17, 0.0], [0.13, 0.2], [0.1, 0.5], [0.11, 0.78], [0.13, 0.86]], { seg: 10, noiseAmp: 0.04, seed: 4 });
    const prof = [[0.13, 0.83], [0.36, 0.8], [0.54, 0.84], [0.6, 0.9]];
    for (let i = 0; i <= 10; i++) { const th = (i / 10) * (Math.PI / 2); prof.push([0.6 * Math.cos(th) * (1 - 0.0), 0.9 + 0.38 * Math.sin(th)]); }
    const cap = lathe(prof.map((p) => [Math.max(p[0], 0.001), p[1]]), { seg: 16, noiseAmp: 0.05, seed: 8, crease: 70 });
    const nz = noise3(12);
    paint(cap, (x, y, z) => { const s = nz.n(x * 9, y * 9, z * 9); return s > 0.78 ? [0.55, 0.9, 1] : 0.8 + 0.3 * clamp((y - 0.8) * 2); });
    paint(stem, (x, y) => 0.55 + 0.45 * clamp(y / 0.8));
    return { parts: [{ geo: stem, mat: stdMat({ color: 0xd8d0c0, roughness: 0.75 }) }, { geo: cap, mat: stdMat({ color: 0x1a8a9a, emissive: 0x2fe8ff, emissiveIntensity: 1.5, roughness: 0.55 }) }], r: 0, s: [0.6, 1.8], n: 90, cluster: 5 };
  };

  // ---------- desert ----------
  lib.cactus = () => {
    const cm = TX.cactusMaps();
    const mat = stdMat({ map: cm.map, normalMap: cm.normalMap, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.65 });
    const rib = (R, k) => (t, a) => { const e = t > 0.88 ? Math.sqrt(Math.max(0, 1 - ((t - 0.88) / 0.12) ** 2)) : 1; return R * e * (1 + 0.08 * Math.cos(a * 8)) * (t < 0.06 ? 1 + (0.06 - t) * 3 : 1) * k; };
    const nz = noise3(3);
    const main = []; for (let i = 0; i <= 10; i++) main.push(V3(Math.sin(i * 0.5) * 0.04, i * 0.4, Math.cos(i * 0.4) * 0.03));
    const list = [tube(main, rib(0.4, 1), 16, { uRep: 1, vScale: 0.3 })];
    const arm = (h, dir, up, R) => {
      const pts = [V3(0, h, 0), V3(dir * 0.5, h + 0.04, 0), V3(dir * 0.85, h + 0.35, 0), V3(dir * 0.95, h + 0.9, 0), V3(dir * 0.98, h + up, 0)];
      return tube(pts, rib(R, 1), 12, { uRep: 1, vScale: 0.3 });
    };
    list.push(arm(2.0, 1, 1.5, 0.22), arm(2.7, -1, 1.1, 0.2));
    const g = merge(list);
    paint(g, (x, y) => 0.55 + 0.45 * clamp(y / 1.2));
    void nz;
    return { parts: [{ geo: g, mat }], r: 0.5, s: [0.8, 1.4], n: 70 };
  };
  lib.bones = () => {
    const nz = noise3(2), list = [];
    for (let i = 0; i < 7; i++) {
      const x = i * 0.34 - 1, len = 0.55 + Math.sin((i + 0.5) / 7 * Math.PI) * 0.4, pts = [];
      for (let k = 0; k <= 8; k++) { const th = (k / 8) * Math.PI * 0.95; pts.push(V3(x, 0.05 + Math.sin(th) * len * 0.9, Math.cos(th) * len * 0.75 * (1 - 0.15 * k / 8))); }
      list.push(tube(pts, (t) => 0.05 * (1 - t * 0.5) * (t < 0.1 ? 1.5 : 1), 6, { vScale: 1, noise: nz, wob: 0.1 }));
    }
    const spine = []; for (let i = 0; i <= 14; i++) spine.push(V3(-1.2 + i * 0.2, 0.9 + Math.sin(i * 0.7) * 0.02, 0));
    list.push(tube(spine, (t, a) => 0.06 * (1 + 0.35 * Math.cos(a * 0 + t * 60)), 6, { vScale: 1 }));
    const skull = rockGeo({ seed: 5, detail: 2, squash: 0.8, rough: 0.12, crease: 0.1, planes: 3 }); skull.scale(0.25, 0.2, 0.2).translate(2.0, 0.28, 0.1);
    list.push(skull);
    const g = merge(list);
    paint(g, (x, y) => 0.6 + 0.4 * clamp(y / 0.5));
    return { parts: [{ geo: g, mat: stoneMat([0.92, 0.86, 0.7]) }], r: 0, s: [0.8, 2], n: 20 };
  };
  lib.pillar = () => {
    const vars = [0, 1].map((v) => {
      const col = lathe([[0.74, 0], [0.62, 0.3], [0.58, 0.6], [0.56, 2.5], [0.55, 4.6], [0.6, 4.8]], { seg: 22, lobes: 14, lobeAmp: 0.035, noiseAmp: 0.015, seed: v, crease: 50 });
      const base = softBox(1.7, 0.45, 1.7, { r: 0.07, seed: 3 + v }).translate(0, 0.22, 0);
      const cap = softBox(1.55, 0.35, 1.55, { r: 0.07, seed: 5 + v }).translate(0, 4.95, 0);
      const nz = noise3(30 + v);
      const p = col.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 4.3) p.setY(i, y - Math.max(0, (nz.fbm(p.getX(i) * 2, 3, p.getZ(i) * 2, 3) - 0.35)) * 1.3 * ((y - 4.3) / 0.5)); }
      const g = merge([col, base, v ? softBox(1.0, 0.3, 1.0, { r: 0.06, seed: 9 }).translate(0, 5.0, 0.0).rotateZ(0.0) : cap]);
      mossy(g, 50 + v, 1.0, 0.5);
      return [{ geo: g, mat: stone }];
    });
    return { variants: vars, r: 0.8, s: [0.8, 1.4], tilt: 0.12, n: 20, cluster: 3 };
  };

  // ---------- frozen ----------
  lib.icecrystal = () => ({ variants: [[{ geo: crystalCluster(3, 6, 1), mat: iceMat() }], [{ geo: crystalCluster(4, 5, 1), mat: iceMat() }]], r: 0.8, s: [1.5, 4], tilt: 0.35, n: 50, cluster: 4 });
  lib.voidcrystal = () => {
    const mat = stdMat({ color: 0x4a1f90, emissive: 0x7a3cff, emissiveIntensity: 0.55, roughness: 0.12, metalness: 0.35, envMapIntensity: 2.2, flatShading: true, transparent: true, opacity: 0.9, vertexColors: true });
    return { variants: [[{ geo: crystalCluster(5, 6, 1), mat }], [{ geo: crystalCluster(6, 5, 1), mat }]], r: 0.8, s: [1.5, 4], tilt: 0.4, n: 50, cluster: 4 };
  };

  // ---------- volcanic ----------
  lib.basalt = () => {
    const rnd = mulberry32(3), nz = noise3(4), list = [];
    for (let i = 0; i < 7; i++) {
      const h = 2 + rnd() * 4, r = 0.5 + rnd() * 0.15, g = new THREE.CylinderGeometry(r * 0.94, r, h, 6, [3, 4, 6][Q]);
      const p = g.attributes.position, ox = (rnd() - 0.5) * 2.6, oz = (rnd() - 0.5) * 2.6, lean = (rnd() - 0.5) * 0.12;
      for (let k = 0; k < p.count; k++) {
        const x = p.getX(k), y = p.getY(k), z = p.getZ(k), ty = (y + h / 2) / h;
        const j = (nz.n(x * 3 + i * 7, y * 2, z * 3) - 0.5) * 0.12;
        const chip = ty > 0.97 ? (nz.n(x * 4 + i, 1, z * 4) - 0.5) * 0.5 + (x * 0.25) : 0;
        p.setXYZ(k, x + j + lean * y + ox, y + h / 2 + chip, z + j + oz);
      }
      list.push(finish(g, { crease: 38, uvScale: 0.6 }));
    }
    const g = merge(list);
    paint(g, (x, y) => 0.55 + 0.45 * clamp(y / 1.2));
    return { parts: [{ geo: g, mat: stoneMat([0.2, 0.17, 0.15]) }], r: 1.8, s: [0.8, 1.6], n: 40 };
  };
  lib.obsidian = () => {
    const rnd = mulberry32(8), list = [];
    const mat = stdMat({ color: 0x1a1224, roughness: 0.12, metalness: 0.6, envMapIntensity: 1.8 });
    for (let i = 0; i < 4; i++) {
      const h = i === 0 ? 4 : 1.2 + rnd() * 1.8, r = i === 0 ? 0.7 : 0.3 + rnd() * 0.2;
      const g = new THREE.ConeGeometry(r, h, 5, 6, false); g.translate(0, h / 2, 0);
      const p = g.attributes.position, bend = (rnd() - 0.5) * 0.5, tw = (rnd() - 0.5) * 0.8;
      for (let k = 0; k < p.count; k++) { const y = p.getY(k), t = y / h, x = p.getX(k), z = p.getZ(k), c = Math.cos(tw * t), s = Math.sin(tw * t); p.setXYZ(k, x * c - z * s + bend * t * t * h * 0.35, y, x * s + z * c); }
      const a = rnd() * 6.28, d = i === 0 ? 0 : 0.35 + rnd() * 0.4;
      const gg = finish(g, { crease: 28, uvScale: 0.4 }).rotateZ(i === 0 ? 0 : (rnd() - 0.5) * 0.7).rotateY(a).translate(Math.cos(a) * d, -0.1, Math.sin(a) * d);
      paint(gg, (x, y) => 0.5 + 0.5 * clamp(y / 1.2));
      list.push(gg);
    }
    return { parts: [{ geo: merge(list), mat }], r: 0.6, s: [0.8, 2], tilt: 0.35, n: 50, cluster: 4 };
  };
  lib.lavapool = () => {
    const nz = noise3(17), R = 3;
    const rr = (a) => R * (1 + (nz.fbm(Math.cos(a) * 1.4 + 4, 0, Math.sin(a) * 1.4, 3) - 0.5) * 0.45);
    const rings = 5, seg = 36, pos = [], uv = [], idx = [];
    pos.push(0, 0.1, 0); uv.push(0.5, 0.5);
    for (let r = 1; r <= rings; r++) for (let s = 0; s < seg; s++) { const a = (s / seg) * Math.PI * 2, k = r / rings; const x = Math.cos(a) * rr(a) * k, z = Math.sin(a) * rr(a) * k; pos.push(x, 0.1 - Math.pow(k, 3) * 0.08, z); uv.push(0.5 + x / (R * 2), 0.5 + z / (R * 2)); }
    for (let s = 0; s < seg; s++) idx.push(0, 1 + ((s + 1) % seg), 1 + s);
    for (let r = 1; r < rings; r++) for (let s = 0; s < seg; s++) { const a = 1 + (r - 1) * seg + s, b = 1 + (r - 1) * seg + ((s + 1) % seg), c = a + seg, d = b + seg; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    // Cooled rock rim.
    const rp = [], n = 48;
    for (let i = 0; i <= n; i++) { const a = (i % n) / n * Math.PI * 2; rp.push(V3(Math.cos(a) * (rr(a) + 0.22), 0.06 + (nz.n(a * 3, 1, 1) - 0.5) * 0.1, Math.sin(a) * (rr(a) + 0.22))); }
    const rim = tube(rp, (t) => 0.3 + 0.2 * nz.n(t * 20, 2, 2), 8, { vScale: 0.5, uRep: 1.5, noise: nz, wob: 0.15 });
    paint(rim, (x, y) => 0.5 + 0.5 * clamp((y + 0.1) / 0.5));
    return { parts: [{ geo: std0(g), mat: 'lava' }, { geo: rim, mat: stoneMat([0.15, 0.12, 0.11]) }], r: 0, s: [0.8, 2.2], n: 25, flat: true, noShadow: true, maxSlope: 0.4 };
  };
  const std0 = (g) => { g.toNonIndexed && (g = g.toNonIndexed()); return g; };

  // ---------- abyss ----------
  lib.obelisk = () => {
    const body = new THREE.CylinderGeometry(0.62, 0.9, 9, 4, 14).rotateY(Math.PI / 4).translate(0, 4.5, 0);
    const nz = noise3(70), p = body.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = y / 9, tw = t * 0.18, c = Math.cos(tw), s = Math.sin(tw), e = 1 + (nz.fbm(x * 2, y * 0.7, z * 2, 3) - 0.5) * 0.22; p.setXYZ(i, (x * c - z * s) * e, y, (x * s + z * c) * e); }
    const bodyG = finish(body, { crease: 45, uvScale: 0.4 });
    const tip = finish(new THREE.ConeGeometry(0.64, 1.8, 4, 2).rotateY(Math.PI / 4).translate(0, 9.9, 0), { crease: 30 });
    const base = softBox(2.0, 0.5, 2.0, { r: 0.06, seed: 8 }).translate(0, 0.2, 0);
    const base2 = softBox(1.6, 0.4, 1.6, { r: 0.06, seed: 9 }).translate(0, 0.62, 0);
    const g = merge([bodyG, tip, base, base2]);
    paint(g, (x, y) => 0.5 + 0.5 * clamp(y / 3));
    // Rune plates.
    const rune = TX.sprayMaps('rune');
    const plates = [];
    for (let i = 0; i < 4; i++) {
      const y = 2.2 + i * 1.85, w = 0.62 + (1 - y / 9) * 0.28;
      for (let f = 0; f < 4; f++) {
        const pg = new THREE.PlaneGeometry(0.62, 0.62);
        const q = new THREE.Matrix4().makeRotationY(f * Math.PI / 2 + (y / 9) * 0.18).multiply(new THREE.Matrix4().makeTranslation(0, y, w * 0.72 + 0.025));
        pg.applyMatrix4(q);
        plates.push(std0(pg));
      }
    }
    return {
      parts: [{ geo: g, mat: stdMat({ color: 0x14101c, roughness: 0.32, metalness: 0.55, envMapIntensity: 1.4 }) }, { geo: merge(plates), mat: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xa060ff, emissiveMap: rune.map, emissiveIntensity: 3, alphaMap: rune.map, alphaTest: 0.2, transparent: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }) }],
      r: 1.0, s: [0.8, 1.4], n: 20,
    };
  };
  return lib;
}

export { forkGeo };
