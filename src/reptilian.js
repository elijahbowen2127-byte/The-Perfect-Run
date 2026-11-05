// Scalefang: a realistic, heavily muscled reptilian warrior. Built on the plain mannequin rig like
// Giga Tyrone: one skinned "muscle suit" whose torso, limbs and head are dense sweeps sculpted with
// muscle bumps and grooves (pecs, abs, lats, quads, calves...), clawed hands and feet, a saurian head
// with jaw, teeth, horns and slit-pupil eyes, and a thick tail on real bones named tail_<i> that
// animateTail() sways. The body uses one scale shader: triplanar Voronoi scales, a lighter belly with
// ventral plates on the abdomen, dorsal banding and per-scale colour.
import * as THREE from 'three';
import { makeKit, V, ell, chainWeights } from './armor.js';
import { setShoulders } from './chad.js';
import { boneKey } from './retarget.js';

const sm = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;

// ---------------------------------------------------------------- skin shader
// Vertex colour channels (not colours): r = belly mask, g = baked shading, b = band coordinate
// (metres along the body; >= 50 turns the dorsal bars off).
export function reptileSkin({ base, belly, band }, vc, unit = 1) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0, vertexColors: vc });
  const U = { uBase: { value: new THREE.Color(base) }, uBelly: { value: new THREE.Color(belly) }, uBand: { value: new THREE.Color(band) }, uScale: { value: 84 }, uUnit: { value: unit } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON; uniform float uUnit;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position * uUnit; vON = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vOP; varying vec3 vON;
        uniform vec3 uBase, uBelly, uBand; uniform float uScale;
        vec2 h2(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
        float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
        vec2 vor(vec2 p){ vec2 i=floor(p), f=fract(p); float d1=8.0, d2=8.0; float id=0.0;
          for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y); vec2 o=h2(i+g); o = 0.5+0.36*sin(o*6.2831); vec2 r=g+o-f; float d=dot(r,r);
            if(d<d1){ d2=d1; d1=d; id=h2(i+g).x; } else if(d<d2) d2=d; }
          return vec2(sqrt(d2)-sqrt(d1), id); }
        vec3 tri(vec3 p, vec3 n, float s){ vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x+w.y+w.z);
          vec2 a = vor(p.zy*s), b = vor(p.xz*s), c = vor(p.xy*s);
          return vec3(a.x*w.x+b.x*w.y+c.x*w.z, a.y*w.x+b.y*w.y+c.y*w.z, 0.0); }
        float plateEdge(vec2 p){ float row = floor(p.y); p.x += 0.5 * mod(row, 2.0); vec2 f = abs(fract(p) - 0.5); return 0.5 - max(f.x, f.y); }
        float redge; float redge2; float rbelly; float rfar;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 N0 = normalize(vON);
          #ifdef USE_COLOR
            vec3 ch = vColor;
          #else
            vec3 ch = vec3(smoothstep(0.1, 0.6, 0.5 * N0.z - 0.7 * N0.y), 0.78, vOP.y);
          #endif
          float bellyK = ch.x, ao = ch.y, q = ch.z;
          float qs = 1.0; if (q >= 150.0) { qs = 0.3; q -= 200.0; }
          float dens = uScale * (q >= 50.0 ? 1.5 : 1.0);
          vec3 sc = tri(vOP, N0, dens);
          vec3 sc2 = tri(vOP, N0, dens * 0.27);
          float fw = fwidth(vOP.y * dens) + fwidth(vOP.x * dens) + fwidth(vOP.z * dens);
          float far = smoothstep(0.12, 0.55, fw);
          float edge = mix(smoothstep(0.0, 0.26, sc.x), 0.85, far);
          float edge2 = smoothstep(0.0, 0.2, sc2.x);
          // ventral plates across the abdomen
          float pm = bellyK * smoothstep(1.03, 1.09, vOP.y) * (1.0 - smoothstep(1.27, 1.34, vOP.y)) * smoothstep(0.3, 0.6, N0.z);
          float pe = plateEdge(vec2(vOP.x * 15.0, vOP.y * 19.0));
          edge = mix(edge, mix(smoothstep(0.0, 0.14, pe), 0.88, far), pm);
          float nL = n3(vOP * 7.0) * 0.6 + n3(vOP * 19.0) * 0.4;
          bellyK = clamp(bellyK + (nL - 0.5) * 0.3, 0.0, 1.0) * smoothstep(0.0, 0.25, bellyK + 0.1);
          vec3 back = mix(uBase * 0.74, uBase * 1.24, nL);
          back *= mix(1.0, 0.72, smoothstep(0.1, 0.95, N0.y));
          back *= 0.86 + 0.28 * sc2.y;
          float bars = smoothstep(0.5, 0.78, sin(q * 34.0 + nL * 3.2) * 0.5 + 0.5) * (1.0 - bellyK) * step(q, 50.0);
          back = mix(back, uBand, bars * 0.62 * qs);
          vec3 col = mix(back, uBelly * (0.9 + 0.2 * nL), bellyK);
          col *= mix(0.88 + sc.y * 0.24, 0.98, far);
          col *= mix(0.7, 1.0, edge);
          col *= mix(0.58, 1.0, edge2 + far * 0.35 * (1.0 - edge2));
          col *= 0.92 + 0.16 * sc2.y;
          col *= ao;
          diffuseColor.rgb = col;
          redge = edge; redge2 = edge2; rbelly = bellyK; rfar = far;
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.8, 0.5, redge) * mix(1.0, 1.1, rbelly);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float h = smoothstep(0.0, 0.3, redge) * 0.6 + redge2 * 0.9; vec3 g = clamp(vec3(dFdx(h), dFdy(h), 0.0) * 0.6, -0.25, 0.25) * (1.0 - rfar); normal = normalize(normal + vec3(-g.x, -g.y, 0.0)); }`);
  };
  m.customProgramCacheKey = () => 'reptile' + (vc ? 'v' : 'n');
  return m;
}

function eyeTexture(iris = ['#ffe36a', '#d68b12']) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  gr.addColorStop(0, iris[0]); gr.addColorStop(0.55, iris[1]); gr.addColorStop(1, '#2a1205');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(80,30,0,${0.1 + Math.random() * 0.35})`; g.lineWidth = 1 + Math.random() * 1.5; const a = Math.random() * 6.28; g.beginPath(); g.moveTo(128 + Math.cos(a) * 24, 128 + Math.sin(a) * 24); g.lineTo(128 + Math.cos(a) * 124, 128 + Math.sin(a) * 124); g.stroke(); }
  g.fillStyle = '#040201'; g.beginPath(); g.ellipse(128, 128, 15, 92, 0, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---------------------------------------------------------------- geometry helpers
const AO = (ny, lo = 0.66) => lo + (1 - lo) * (ny * 0.5 + 0.5);
const CH = {
  torso: (x, y, z, nx, ny, nz, o) => { o[0] = sm(nz, 0.4, 0.85) * (1 - sm(y, 1.42, 1.5)) * sm(y, 1.04, 1.14) * (1 - sm(Math.abs(x), 0.11, 0.2)); o[1] = AO(ny); o[2] = y; },
  pelvis: (x, y, z, nx, ny, nz, o) => { o[0] = 0; o[1] = AO(ny); o[2] = 99; },
  neck: (x, y, z, nx, ny, nz, o) => { o[0] = sm(nz, 0.05, 0.95) * (1 - sm(ny, 0.5, 0.9)); o[1] = AO(ny); o[2] = y; },
  arm: (x, y, z, nx, ny, nz, o) => { o[0] = sm(-ny, 0.25, 0.8) * 0.9; o[1] = AO(ny); o[2] = 200 + Math.abs(x); },
  leg: (x, y, z, nx, ny, nz, o) => { o[0] = sm((x >= 0 ? 0.082 - x : x + 0.082) * 10, 0.75, 1.15); o[1] = AO(ny); o[2] = 200 + y; },
  head: (x, y, z, nx, ny, nz, o) => { o[0] = sm(-ny, 0.45, 0.9); o[1] = AO(ny, 0.72); o[2] = 99; },
  jaw: (x, y, z, nx, ny, nz, o) => { o[0] = sm(-ny, 0.1, 0.6); o[1] = AO(ny, 0.6); o[2] = 99; },
  tail: (x, y, z, nx, ny, nz, o) => { o[0] = sm(-ny, 0.2, 0.75); o[1] = AO(ny); o[2] = -z; },
  foot: (x, y, z, nx, ny, nz, o) => { o[0] = sm(-ny, 0.2, 0.8); o[1] = AO(ny, 0.6); o[2] = 99; },
  hand: (x, y, z, nx, ny, nz, o) => { o[0] = sm(-ny, 0.2, 0.8); o[1] = AO(ny, 0.62); o[2] = 99; },
};
// Gaussian-ish muscle bump sum at a point: bumps are [cx, cy, cz, rx, ry, rz, amp].
const MUSCLE = 1.25;
function bumpAt(bumps, x, y, z) {
  let d = 0;
  for (let k = 0; k < bumps.length; k++) {
    const b = bumps[k], dx = (x - b[0]) / b[3], dy = (y - b[1]) / b[4], dz = (z - b[2]) / b[5], q = dx * dx + dy * dy + dz * dz;
    if (q < 1) { const w = 1 - q; d += b[6] * w * w; }
  }
  return d * MUSCLE;
}
// Pushes vertices along their normals by the bump sum and rebuilds smooth normals.
function sculpt(g, bumps) {
  if (!bumps || !bumps.length) return g;
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), d = bumpAt(bumps, x, y, z);
    if (d) p.setXYZ(i, x + n.getX(i) * d, y + n.getY(i) * d, z + n.getZ(i) * d);
  }
  if (g.index) { g.computeVertexNormals(); return g; }
  // Non-indexed (kit sweeps): average the face normals of vertices that share a position.
  const key = (i) => Math.round(p.getX(i) * 2e4) + ',' + Math.round(p.getY(i) * 2e4) + ',' + Math.round(p.getZ(i) * 2e4);
  const acc = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), f = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    f.subVectors(c, b).cross(a.clone().sub(b));
    for (let k = 0; k < 3; k++) { const kk = key(i + k); const e = acc.get(kk); if (e) e.add(f); else acc.set(kk, f.clone()); }
  }
  const nn = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { const e = acc.get(key(i)); if (e && e.lengthSq() > 0) { nn.copy(e).normalize(); n.setXYZ(i, nn.x, nn.y, nn.z); } }
  return g;
}
// Rewrites a piece's vertex colours as skin-shader channels (grooves darken, bulges catch light).
function chan(g, fn, bumps) {
  const p = g.attributes.position, n = g.attributes.normal, c = new Float32Array(p.count * 3), o = [0, 0, 0];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    fn(x, y, z, n.getX(i), n.getY(i), n.getZ(i), o);
    const cav = bumps ? clamp(1 + bumpAt(bumps, x, y, z) * 11, 0.74, 1.1) : 1;
    c[i * 3] = o[0]; c[i * 3 + 1] = o[1] * cav; c[i * 3 + 2] = o[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
// A cone with its base at b pointing along d; flat thins it across x before orienting.
// c0 -> c1 paints a base-to-tip colour gradient.
function spike(b, d, h, r, seg = 5, flat = 1, c0 = null, c1 = null) {
  const g = new THREE.ConeGeometry(r, h, seg); g.translate(0, h / 2, 0); g.scale(flat, 1, 1);
  if (c0 != null) {
    const p = g.attributes.position, arr = new Float32Array(p.count * 3), a = new THREE.Color(c0), z = new THREE.Color(c1), t = new THREE.Color();
    for (let i = 0; i < p.count; i++) { t.copy(a).lerp(z, Math.pow(Math.max(0, p.getY(i) / h), 1.4)); arr[i * 3] = t.r; arr[i * 3 + 1] = t.g; arr[i * 3 + 2] = t.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize()));
  g.translate(b.x, b.y, b.z);
  return g;
}
// Piecewise-linear lookup in a table whose first column is the parameter.
function at(tab, z) {
  if (z <= tab[0][0]) return tab[0].slice(1);
  for (let i = 0; i < tab.length - 1; i++) {
    const a = tab[i], b = tab[i + 1];
    if (z <= b[0]) { const t = (z - a[0]) / (b[0] - a[0]); return a.slice(1).map((v, k) => lerp(v, b[k + 1], t)); }
  }
  return tab[tab.length - 1].slice(1);
}
// Smooth (cubic Hermite) resample of a table [t, v1, v2, ...] to N rows.
function resample(tab, N) {
  const R = tab.length, C = tab[0].length, out = [];
  const tan = (i, k) => { const a = tab[Math.max(0, i - 1)], b = tab[Math.min(R - 1, i + 1)]; return (b[k] - a[k]) / (b[0] - a[0]); };
  for (let j = 0; j < N; j++) {
    const t = tab[0][0] + (tab[R - 1][0] - tab[0][0]) * (j / (N - 1));
    let i = 0; while (i < R - 2 && t > tab[i + 1][0]) i++;
    const a = tab[i], b = tab[i + 1], h = b[0] - a[0], u = clamp((t - a[0]) / h, 0, 1), u2 = u * u, u3 = u2 * u;
    const row = [t];
    for (let k = 1; k < C; k++) row.push((2 * u3 - 3 * u2 + 1) * a[k] + (u3 - 2 * u2 + u) * h * tan(i, k) + (-2 * u3 + 3 * u2) * b[k] + (u3 - u2) * h * tan(i + 1, k));
    out.push(row);
  }
  return out;
}
// Lofted head shell from rows { z, w, cy, hh, n }: superellipse rings along +z, ends fanned shut.
function loftZ(rows, K = 28) {
  const pos = [], ix = [];
  rows.forEach((r) => {
    const e = 2 / (r.n || 2.4);
    for (let k = 0; k < K; k++) {
      const a = (k / K) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(r.w * Math.sign(c) * Math.pow(Math.abs(c), e), r.cy + r.hh * Math.sign(s) * Math.pow(Math.abs(s), e), r.z);
    }
  });
  const R = rows.length;
  for (let i = 0; i < R - 1; i++) for (let k = 0; k < K; k++) {
    const a = i * K + k, b = i * K + (k + 1) % K, c = (i + 1) * K + k, d = (i + 1) * K + (k + 1) % K;
    ix.push(a, b, c, b, d, c);
  }
  const c0 = pos.length / 3; pos.push(0, rows[0].cy, rows[0].z);
  const c1 = c0 + 1; pos.push(0, rows[R - 1].cy, rows[R - 1].z);
  for (let k = 0; k < K; k++) { ix.push(c0, (k + 1) % K, k); ix.push(c1, (R - 1) * K + k, (R - 1) * K + (k + 1) % K); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(ix); g.computeVertexNormals();
  const nA = g.attributes.normal, m = Math.floor(R / 2) * K;
  if (nA.getX(m) < 0) { const a = g.index.array; for (let q = 0; q < a.length; q += 3) { const t = a[q + 1]; a[q + 1] = a[q + 2]; a[q + 2] = t; } g.computeVertexNormals(); }
  return g;
}

// ---------------------------------------------------------------- the build
const TAIL = { n: 12, seg: 0.108, a0: -0.42, da: 0.05 };
const HAND_BONES = ['Hand', ...['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].flatMap((f) => [1, 2, 3, 4].map((i) => 'Hand' + f + i))];

export function buildReptilian(scene, skin) {
  const LZ = { base: 0x55702a, belly: 0xc4b87e, band: 0x1d2a12, ...(skin.lizard || {}) };
  const HORN0 = new THREE.Color(LZ.band).lerp(new THREE.Color(0x2a2016), 0.35).getHex();
  const HORN1 = new THREE.Color(LZ.band).lerp(new THREE.Color(0xe2d6b0), 0.78).getHex();
  const CLAW0 = new THREE.Color(LZ.band).lerp(new THREE.Color(0x16110c), 0.7).getHex();
  const CLAW1 = new THREE.Color(0x4a3e2e).getHex();
  const TOOTH = 0xe9dfc2;

  setShoulders(scene, 0.035, 0.014, 1.3);

  // ---- tail bones (real Bones, so the tail mesh is skinned to them; animateTail drives tail_<i>) ----
  let hipsB = null; scene.traverse((o) => { if (o.isBone && !hipsB && boneKey(o.name) === 'Hips') hipsB = o; });
  scene.updateMatrixWorld(true);
  const hp0 = hipsB.getWorldPosition(V(0, 0, 0));
  const troot = new THREE.Object3D(); troot.position.set(hp0.x, hp0.y - 0.045, hp0.z - 0.085);
  scene.add(troot); scene.updateMatrixWorld(true); hipsB.attach(troot);
  const joints = [];
  { let parent = troot;
    for (let i = 0; i < TAIL.n; i++) {
      const b = new THREE.Bone(); b.name = 'tail_' + i;
      b.position.set(0, 0, i === 0 ? 0 : -TAIL.seg); b.rotation.x = i === 0 ? TAIL.a0 : TAIL.da;
      parent.add(b); parent = b; joints.push(b);
    }
  }
  scene.updateMatrixWorld(true);

  const skinM = reptileSkin(LZ, true);
  const boneM = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, roughness: 0.4, metalness: 0 });
  const darkM = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, roughness: 0.75, metalness: 0 });
  const kit = makeKit(scene, [skinM, boneM, darkM], 'scalefang_body');
  const { J, add, mirror, tube } = kit;

  const S = (geo, bone, f, bumps) => chan(add(0, geo, bone, null), f, bumps);   // scaled skin (rigid)
  const T = (pts, rad, bind, f, bumps, seg = 28, up = V(0, 0, 1)) => chan(sculpt(tube(0, pts, rad, bind, { seg, up }), bumps), f, bumps); // scaled skin (skinned sweep)
  const B = (geo, bone, col, ao = 0.18) => add(1, geo, bone, col, ao);
  const torsoBones = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck'];
  const sideOf = (s) => (s > 0 ? 'Left' : 'Right');
  const SP = (b, d, h, r, seg, flat) => spike(b, d, h, r, seg, flat, HORN0, HORN1);
  const CL = (b, d, h, r, seg) => spike(b, d, h, r, seg, 1, CLAW0, CLAW1);

  // ---- torso: V-taper from a narrow waist to a deep, broad chest, sculpted ----
  const rows = resample([ // y, rx, rz, z
    [1.06, 0.168, 0.124, 0.02], [1.12, 0.156, 0.117, 0.022], [1.17, 0.15, 0.113, 0.022], [1.22, 0.17, 0.124, 0.018], [1.27, 0.2, 0.138, 0.013],
    [1.32, 0.228, 0.15, 0.007], [1.37, 0.246, 0.155, 0.0], [1.42, 0.254, 0.15, -0.007], [1.465, 0.226, 0.13, -0.016], [1.51, 0.165, 0.108, -0.024], [1.55, 0.115, 0.09, -0.024],
  ], 72);
  const torsoB = [];
  for (const s of [1, -1]) {
    torsoB.push(
      [s * 0.105, 1.385, 0.14, 0.1, 0.07, 0.075, 0.036],      // pec
      [s * 0.09, 1.452, 0.1, 0.1, 0.03, 0.06, 0.012],          // clavicle ridge
      [s * 0.1, 1.322, 0.15, 0.11, 0.014, 0.05, -0.008],       // under-pec groove
      [s * 0.205, 1.31, 0.06, 0.03, 0.018, 0.05, 0.012], [s * 0.208, 1.265, 0.06, 0.03, 0.018, 0.05, 0.012], [s * 0.208, 1.22, 0.055, 0.03, 0.018, 0.05, 0.011], // serratus
      [s * 0.045, 1.292, 0.152, 0.04, 0.026, 0.05, 0.021], [s * 0.045, 1.234, 0.141, 0.04, 0.026, 0.05, 0.02], [s * 0.044, 1.176, 0.133, 0.04, 0.026, 0.05, 0.018], // abs
      [s * 0.045, 1.264, 0.15, 0.052, 0.012, 0.05, -0.007], [s * 0.045, 1.206, 0.14, 0.052, 0.012, 0.05, -0.007],
      [s * 0.18, 1.2, 0.05, 0.05, 0.09, 0.09, 0.018],           // oblique
      [s * 0.18, 1.31, -0.12, 0.11, 0.13, 0.08, 0.026],        // lat
      [s * 0.11, 1.4, -0.155, 0.07, 0.05, 0.05, 0.02],         // infraspinatus
      [s * 0.085, 1.475, -0.1, 0.1, 0.06, 0.08, 0.028],        // trapezius
      [s * 0.04, 1.2, -0.1, 0.028, 0.09, 0.05, 0.012],         // erector
    );
  }
  torsoB.push([0, 1.385, 0.15, 0.018, 0.07, 0.05, -0.009], [0, 1.23, 0.145, 0.016, 0.1, 0.06, -0.009], [0, 1.32, -0.15, 0.018, 0.16, 0.06, -0.012]); // sternum, linea alba, spine groove
  {
    const pts = rows.map((r) => V(0, r[0], r[3])), rad = rows.map((r) => [r[1], r[2]]);
    T(pts, rad, (i) => chainWeights(kit, torsoBones, pts[i].y), CH.torso, torsoB, 84);
  }
  // Pelvis: closes the crotch and glutes, following the hips and thighs.
  {
    const pr = resample([[0.86, 0.17, 0.098], [0.9, 0.195, 0.118], [0.96, 0.208, 0.136], [1.02, 0.2, 0.14], [1.07, 0.172, 0.126], [1.1, 0.15, 0.108], [1.13, 0.138, 0.098]], 22);
    const pts = pr.map((r) => V(0, r[0], -0.008));
    const pb = [[0.085, 1.0, -0.14, 0.1, 0.09, 0.08, 0.03], [-0.085, 1.0, -0.14, 0.1, 0.09, 0.08, 0.03], [0, 0.98, -0.14, 0.01, 0.1, 0.06, -0.016], [0.15, 1.1, 0.0, 0.05, 0.03, 0.1, 0.01], [-0.15, 1.1, 0.0, 0.05, 0.03, 0.1, 0.01]];
    T(pts, pr.map((r) => [r[1], r[2]]), (i, u, p) => {
      const side = p.x >= 0 ? 'Left' : 'Right', w = (1 - sm(pts[i].y, 0.9, 1.08)) * sm(Math.abs(p.x), 0.0, 0.07);
      return w < 0.001 ? [['Hips', 1]] : [['Hips', 1 - w], [side + 'UpLeg', w]];
    }, CH.pelvis, pb, 40);
  }

  // ---- neck: thick, leaning forward to carry the head ----
  {
    const nr = resample([[1.42, -0.035, 0.15, 0.12], [1.48, -0.03, 0.125, 0.106], [1.54, -0.012, 0.099, 0.092], [1.6, 0.012, 0.088, 0.086], [1.655, 0.04, 0.082, 0.082]], 18);
    const pts = nr.map((r) => V(0, r[0], r[1]));
    const nb = [];
    for (const s of [1, -1]) nb.push([s * 0.055, 1.57, 0.05, 0.03, 0.07, 0.05, 0.012], [s * 0.07, 1.5, -0.03, 0.04, 0.05, 0.1, 0.012]);
    T(pts, nr.map((r) => [r[2], r[3]]), (i) => chainWeights(kit, ['Spine2', 'Neck', 'Head'], pts[i].y), CH.neck, nb, 24);
  }

  // ---- arms and hands ----
  mirror((s) => {
    const A = sideOf(s);
    const sh = J(A + 'Arm'), el = J(A + 'ForeArm'), wr = J(A + 'Hand');
    const lenU = sh.distanceTo(el), lenF = el.distanceTo(wr), total = lenU + lenF;
    const prof = resample([ // t along the arm, rx (vertical), rz (front-back)
      [0.0, 0.088, 0.09], [0.1, 0.09, 0.092], [0.22, 0.076, 0.078], [0.36, 0.066, 0.064], [0.47, 0.058, 0.058],
      [0.54, 0.062, 0.06], [0.62, 0.06, 0.054], [0.76, 0.049, 0.045], [0.9, 0.042, 0.04], [1.03, 0.04, 0.039],
    ], 36);
    const along = (d) => (d <= lenU ? sh.clone().lerp(el, d / lenU) : el.clone().lerp(wr, (d - lenU) / lenF));
    const pts = prof.map((p) => along(p[0] * total));
    const o = (d, dx, dy, dz, rx, ry, rz, amp) => { const p = along(d); return [p.x + s * dx, p.y + dy, p.z + dz, rx, ry, rz, amp]; };
    const ab = [
      o(0.17, 0.0, 0.012, 0.062, 0.1, 0.05, 0.05, 0.024),     // biceps
      o(0.17, 0.0, 0.0, -0.062, 0.11, 0.05, 0.05, 0.024),     // triceps
      o(0.2, 0.0, 0.07, 0.0, 0.09, 0.03, 0.04, 0.011),
      o(0.33, 0.0, 0.03, 0.055, 0.1, 0.035, 0.035, 0.02),     // brachioradialis
      o(0.37, 0.0, 0.04, -0.03, 0.1, 0.035, 0.04, 0.016),     // extensors
      o(0.35, 0.0, -0.035, 0.038, 0.1, 0.03, 0.04, 0.016),    // flexors
      o(0.28, 0.0, 0.0, -0.062, 0.03, 0.03, 0.03, 0.012),     // elbow
    ];
    T(pts, prof.map((p) => [p[1], p[2]]), (i) => {
      const w = sm(prof[i][0] * total, lenU - 0.07, lenU + 0.07);
      return w <= 0.001 ? [[A + 'Arm', 1]] : w >= 0.999 ? [[A + 'ForeArm', 1]] : [[A + 'Arm', 1 - w], [A + 'ForeArm', w]];
    }, CH.arm, ab, 26);
    // deltoid cap
    S(ell(V(sh.x + s * 0.062, sh.y + 0.022, sh.z - 0.004), [0.098, 0.096, 0.092], null, 22), A + 'Arm', CH.arm);
    // forearm and elbow spurs
    B(SP(V(el.x + s * 0.03, el.y - 0.005, el.z - 0.062), V(s * 0.25, -0.2, -1), 0.048, 0.013, 5, 0.6), A + 'ForeArm', 0xffffff);
    for (let i = 0; i < 3; i++) { const p = el.clone().lerp(wr, 0.3 + i * 0.16); B(SP(V(p.x, p.y + 0.008, p.z - 0.056), V(0.0, -0.1, -1), 0.026 - i * 0.004, 0.007, 4, 0.7), A + 'ForeArm', 0xffffff); }

    // ---- the hand: palm and four clawed fingers plus a thumb, skinned to the finger bones ----
    const m1 = J(A + 'HandMiddle1');
    const hc = wr.clone().lerp(m1, 0.45), hl = wr.distanceTo(m1);
    S(ell(V(hc.x, hc.y + 0.002, hc.z - 0.012), [hl * 0.6, 0.032, 0.058], null, 20), A + 'Hand', CH.hand);                // palm
    S(ell(V(hc.x - s * 0.012, hc.y + 0.016, hc.z - 0.012), [hl * 0.45, 0.022, 0.048], null, 14), A + 'Hand', CH.hand);   // back of hand
    const finger = (f, r0, r1) => {
      const k = [1, 2, 3, 4].map((i) => A + 'Hand' + f + i);
      if (!k.every((n) => kit.has(n))) return;
      const P = k.map((n) => J(n)), d0 = P[1].clone().sub(P[0]).normalize();
      const rs = [];
      const push = (p, r, w) => { rs.push([p, r, w]); };
      push(P[0].clone().addScaledVector(d0, -0.02), r0 * 0.95, [[A + 'Hand', 0.6], [k[0], 0.4]]);
      for (let j = 0; j < 4; j++) {
        const r = lerp(r0, r1, j / 3);
        push(P[j], r, j === 0 ? [[k[0], 0.5], [A + 'Hand', 0.5]] : [[k[j], 0.5], [k[j - 1], 0.5]]);
        if (j < 3) push(P[j].clone().lerp(P[j + 1], 0.5), r * 1.04, [[k[j], 1]]);
      }
      push(P[3].clone().addScaledVector(P[3].clone().sub(P[2]).normalize(), 0.012), r1 * 0.75, [[k[2], 1]]);
      chan(tube(0, rs.map((x) => x[0]), rs.map((x) => x[1]), (i) => rs[i][2], { seg: 9, up: V(0, 0, 1) }), CH.hand);
      const tip = P[3], dir = tip.clone().sub(P[2]).normalize();
      B(CL(tip.clone().addScaledVector(dir, 0.004), dir.clone().add(V(0, -0.6, 0.1)), 0.07, 0.0095, 6), k[2], 0xffffff, 0.12);
    };
    finger('Index', 0.019, 0.0115); finger('Middle', 0.02, 0.012); finger('Ring', 0.019, 0.0115); finger('Pinky', 0.0165, 0.0105); finger('Thumb', 0.024, 0.014);
  });

  // ---- legs and feet ----
  mirror((s) => {
    const A = sideOf(s);
    const hp = J(A + 'UpLeg'), kn = J(A + 'Leg'), an = J(A + 'Foot');
    const lenT = hp.distanceTo(kn), lenS = kn.distanceTo(an), total = lenT + lenS;
    const prof = resample([ // t, rx (side), rz (front-back); starts above the hip as a dome so no shelf shows
      [-0.1, 0.06, 0.066], [-0.06, 0.092, 0.098], [-0.025, 0.108, 0.114], [0.0, 0.112, 0.118], [0.1, 0.116, 0.122], [0.24, 0.102, 0.11], [0.38, 0.086, 0.094], [0.49, 0.068, 0.072], [0.56, 0.066, 0.072],
      [0.64, 0.07, 0.078], [0.76, 0.056, 0.06], [0.9, 0.042, 0.045], [1.0, 0.038, 0.04],
    ], 46);
    const pos = (t) => { const d = t * total; return d <= lenT ? hp.clone().lerp(kn, d / lenT) : kn.clone().lerp(an, (d - lenT) / lenS); };
    const pts = prof.map((p) => pos(p[0]));
    const o = (t, dx, dy, dz, rx, ry, rz, amp) => { const p = pos(t); return [p.x + s * dx, p.y + dy, p.z + dz, rx, ry, rz, amp]; };
    const lb = [
      o(0.18, 0.0, 0.0, 0.098, 0.04, 0.14, 0.05, 0.022),      // rectus femoris
      o(0.2, 0.098, -0.01, 0.03, 0.05, 0.15, 0.08, 0.028),    // vastus lateralis
      o(0.3, -0.085, -0.02, 0.04, 0.045, 0.09, 0.07, 0.026),  // vastus medialis
      o(0.22, 0.0, 0.0, -0.1, 0.08, 0.15, 0.05, 0.024),       // hamstrings
      o(0.12, -0.1, 0.0, 0.0, 0.04, 0.13, 0.07, 0.012),       // adductors
      o(0.5, 0.0, 0.0, 0.075, 0.035, 0.04, 0.03, 0.012),      // knee
      o(0.62, 0.035, 0.02, -0.07, 0.04, 0.1, 0.05, 0.03),     // gastrocnemius lateral
      o(0.62, -0.035, 0.0, -0.07, 0.04, 0.1, 0.05, 0.034),    // gastrocnemius medial
      o(0.65, 0.02, 0.0, 0.065, 0.025, 0.11, 0.03, 0.012),    // tibialis
    ];
    T(pts, prof.map((p) => [p[1], p[2]]), (i) => {
      const w = sm(prof[i][0] * total, lenT - 0.07, lenT + 0.07);
      return w <= 0.001 ? [[A + 'UpLeg', 1]] : w >= 0.999 ? [[A + 'Leg', 1]] : [[A + 'UpLeg', 1 - w], [A + 'Leg', w]];
    }, CH.leg, lb, 28);
    // ankle, heel and the reptilian foot: three heavy clawed toes and a spur
    const x = an.x;
    S(ell(V(x, 0.074, -0.034), [0.05, 0.056, 0.06], null, 14), A + 'Foot', CH.foot);
    S(ell(V(x, 0.04, -0.056), [0.04, 0.04, 0.05], null, 12), A + 'Foot', CH.foot);
    S(ell(V(x, 0.034, 0.03), [0.052, 0.032, 0.086], [0.06, 0, 0], 14), A + 'Foot', CH.foot);
    const tk = A + 'ToeBase';
    for (const [ox, zl, yo] of [[-0.036, 0.19, 0], [0.0, 0.215, 0.002], [0.036, 0.195, 0]]) {
      const tp = [V(x + ox * 0.5, 0.034 + yo, 0.07), V(x + ox * 1.1, 0.025 + yo, 0.13), V(x + ox * 1.5, 0.018, zl - 0.02)];
      chan(tube(0, tp, [0.026, 0.021, 0.0125], () => [[tk, 1]], { seg: 9, up: V(0, 1, 0) }), CH.foot);
      B(CL(V(x + ox * 1.5, 0.016, zl - 0.026), V(ox * 0.3, -0.34, 1), 0.052, 0.0092, 6), tk, 0xffffff, 0.12);
    }
    B(CL(V(x, 0.05, -0.1), V(0, -0.15, -1), 0.045, 0.0085, 6), A + 'Foot', 0xffffff, 0.12);
    B(SP(V(x + s * 0.045, 0.08, -0.02), V(s * 1, 0.45, -0.2), 0.04, 0.009, 5, 1), A + 'Foot', 0xffffff, 0.12);              // ankle spur
  });

  // ---- spine ridge: blade scutes from the skull down the neck and back ----
  {
    for (let i = 0; i < 8; i++) {
      const y = 1.13 + i * 0.056, r = rows.reduce((a, b) => (Math.abs(b[0] - y) < Math.abs(a[0] - y) ? b : a));
      B(SP(V(0, y, r[3] - r[2] + 0.014), V(0, 1, -0.55), 0.034 + Math.sin((i / 7) * Math.PI) * 0.026, 0.012, 4, 0.42), y > 1.3 ? 'Spine2' : y > 1.2 ? 'Spine1' : 'Spine', 0xffffff, 0.12);
    }
    for (let i = 0; i < 4; i++) B(SP(V(0, 1.545 + i * 0.05, -0.12 + i * 0.05), V(0, 1, -0.5), 0.036 - i * 0.003, 0.012, 4, 0.42), i < 2 ? 'Neck' : 'Head', 0xffffff, 0.12);
  }

  // ---- head ----
  const HEAD = 'Head';
  // Cross-section tables: z, half-width, top y, mouth-line y (upper); z, half-width, top y, chin y (lower).
  const UP = [[-0.098, 0.03, 1.74, 1.7], [-0.078, 0.066, 1.762, 1.67], [-0.04, 0.084, 1.778, 1.655], [0.0, 0.09, 1.782, 1.652], [0.04, 0.088, 1.78, 1.651], [0.08, 0.076, 1.766, 1.65],
    [0.12, 0.06, 1.74, 1.648], [0.17, 0.05, 1.724, 1.646], [0.22, 0.046, 1.714, 1.644], [0.27, 0.045, 1.709, 1.641], [0.305, 0.04, 1.703, 1.638], [0.322, 0.02, 1.692, 1.64]];
  const LO = [[-0.06, 0.02, 1.656, 1.63], [-0.04, 0.058, 1.66, 1.612], [-0.01, 0.076, 1.659, 1.6], [0.03, 0.076, 1.658, 1.597], [0.08, 0.066, 1.655, 1.598], [0.14, 0.055, 1.651, 1.603],
    [0.2, 0.049, 1.648, 1.607], [0.26, 0.045, 1.644, 1.611], [0.3, 0.039, 1.641, 1.616], [0.316, 0.02, 1.638, 1.624]];
  const mkRows = (tab, N) => resample(tab, N).map(([z, w, top, bot]) => ({ z, w, cy: (top + bot) / 2, hh: (top - bot) / 2, n: z > 0.1 ? 3.3 : 2.3 }));
  const hb = [];
  for (const s of [1, -1]) hb.push(
    [s * 0.06, 1.762, 0.07, 0.046, 0.02, 0.055, 0.026],     // brow ridge
    [s * 0.032, 1.752, 0.1, 0.03, 0.012, 0.04, 0.018],       // brow, inner end
    [s * 0.074, 1.727, 0.07, 0.028, 0.026, 0.028, -0.012],   // eye socket
    [s * 0.078, 1.7, 0.0, 0.026, 0.032, 0.05, 0.008],        // cheekbone
    [s * 0.048, 1.752, 0.15, 0.02, 0.018, 0.04, 0.008],      // pre-orbital
    [s * 0.015, 1.702, 0.31, 0.018, 0.012, 0.02, 0.004],     // nostril mound
    [s * 0.06, 1.675, -0.02, 0.03, 0.035, 0.05, 0.008],      // jaw muscle
  );
  hb.push([0, 1.718, 0.22, 0.012, 0.014, 0.1, 0.005], [0, 1.775, -0.01, 0.014, 0.012, 0.06, 0.006]);
  S(sculpt(loftZ(mkRows(UP, 44), 36), hb), HEAD, CH.head, hb);
  S(loftZ(mkRows(LO, 30), 28), HEAD, CH.jaw);
  mirror((s) => {
    // cheek scutes and jaw spines
    for (let i = 0; i < 3; i++) B(SP(V(s * (0.08 - i * 0.003), 1.652 - i * 0.012, -0.01 - i * 0.025), V(s * 1, -0.2 - i * 0.1, -0.5), 0.034 - i * 0.005, 0.009, 4, 0.8), HEAD, 0xffffff);
    // nostril, ear hole, mouth line and teeth
    add(2, ell(V(s * 0.015, 1.706, 0.318), [0.0055, 0.0036, 0.006], null, 8), HEAD, 0x120a06, 0);
    add(2, ell(V(s * 0.0885, 1.708, -0.02), [0.006, 0.014, 0.014], null, 8), HEAD, 0x120a06, 0);
    const mp = [];
    for (let z = 0.02; z <= 0.3; z += 0.04) { const u = at(UP, z), l = at(LO, z); mp.push(V(s * (Math.min(u[0], l[0] + 0.004) - 0.002), u[2] + 0.001, z)); }
    tube(2, mp, mp.map(() => 0.0032), () => [[HEAD, 1]], { seg: 5, up: V(0, 1, 0), caps: false, color: 0x1a0f0a, ao: 0 });
    for (let i = 0; i < 12; i++) {
      const z = 0.06 + i * 0.0215, u = at(UP, z), big = i === 3 || i === 9;
      B(spike(V(s * (u[0] - 0.0035), u[2] + 0.002, z), V(s * 0.06, -1, 0.15), big ? 0.022 : 0.0135, big ? 0.0046 : 0.0034, 5), HEAD, TOOTH, 0.05);
      const l = at(LO, z + 0.01);
      B(spike(V(s * (l[0] - 0.009), l[1] - 0.003, z + 0.01), V(0, 1, 0.1), big ? 0.017 : 0.01, 0.0031, 5), HEAD, TOOTH, 0.05);
    }
    // swept-back horns from the brow and a smaller one behind it
    for (const [p0, p1, p2, p3, r0] of [
      [V(s * 0.052, 1.775, 0.0), V(s * 0.074, 1.8, -0.06), V(s * 0.098, 1.805, -0.13), V(s * 0.125, 1.79, -0.2), 0.02],
      [V(s * 0.07, 1.745, -0.05), V(s * 0.1, 1.755, -0.1), V(s * 0.125, 1.745, -0.14), V(s * 0.14, 1.72, -0.17), 0.012],
    ]) {
      const hp = new THREE.CatmullRomCurve3([p0, p1, p2, p3]).getPoints(9);
      const g = tube(1, hp, hp.map((_, i) => r0 * Math.pow(1 - i / 9, 0.8) + 0.0018), () => [[HEAD, 1]], { seg: 8, up: V(0, 0, 1), color: HORN0, ao: 0.2 });
      const c = g.attributes.color, p = g.attributes.position, tmp = new THREE.Color(), tip = new THREE.Color(HORN1);
      for (let i = 0; i < c.count; i++) { const k = clamp((Math.abs(p.getX(i)) - 0.05) / 0.09, 0, 1); tmp.set(HORN0).lerp(tip, k * k); c.setXYZ(i, tmp.r, tmp.g, tmp.b); }
    }
  });
  for (let i = -2; i <= 2; i++) B(spike(V(i * 0.0125, 1.639, 0.31 - Math.abs(i) * 0.002), V(0, -1, 0.1), 0.014, 0.0035, 5), HEAD, TOOTH, 0.05);
  for (let i = 0; i < 5; i++) B(SP(V(0, 1.775 - i * 0.003, 0.0 - i * 0.02), V(0, 1, -0.7), 0.03 - i * 0.003, 0.011, 4, 0.42), HEAD, 0xffffff, 0.12);

  // ---- tail: skinned to the tail bones, thick at the root, deeper than wide, ridge of blades ----
  {
    const jp = joints.map((j) => j.getWorldPosition(V(0, 0, 0)));
    const tip = jp[jp.length - 1].clone().add(jp[jp.length - 1].clone().sub(jp[jp.length - 2]));
    const pts = [jp[0].clone().add(V(0, 0.015, 0.06))], wt = [[['Hips', 0.5], ['tail_0', 0.5]]];
    jp.forEach((p, i) => {
      pts.push(p.clone()); wt.push(i === 0 ? [['tail_0', 1]] : [['tail_' + i, 0.5], ['tail_' + (i - 1), 0.5]]);
      const nx = i < jp.length - 1 ? jp[i + 1] : tip;
      pts.push(p.clone().lerp(nx, 0.5)); wt.push([['tail_' + i, 1]]);
    });
    pts.push(tip); wt.push([['tail_' + (jp.length - 1), 1]]);
    const rad = pts.map((_, i) => { const u = i / (pts.length - 1), f = Math.pow(1 - u, 1.25); return [0.012 + 0.108 * f, 0.012 + 0.098 * f]; });
    T(pts, rad, (i) => wt[i], CH.tail, null, 20, V(0, 1, 0));
    // bone-local geometry (tail_i frame: -z runs down the tail, +y up)
    joints.forEach((j, i) => {
      const u = (i * 2 + 1) / (pts.length - 1), h = 0.012 + 0.098 * Math.pow(1 - u, 1.25);
      if (i < joints.length - 1) B(SP(V(0, h * 0.82, -TAIL.seg * 0.5), V(0, 1, -0.5), 0.05 * (1 - i / 14), 0.012, 4, 0.42).applyMatrix4(j.matrixWorld), 'tail_' + i, 0xffffff, 0.12);
    });
  }

  // ---- belt: a plain strap of worked leather with a bone clasp ----
  tube(2, [V(0, 1.112, 0.012), V(0, 1.082, 0.012)], [[0.178, 0.133], [0.18, 0.136]], () => [['Hips', 1]], { seg: 28, up: V(0, 0, 1), color: 0x2a1c12, ao: 0.2 });
  B(ell(V(0, 1.097, 0.148), [0.028, 0.022, 0.01], null, 12, [0.6, 0.6]), 'Hips', 0xd8cba0, 0.1);

  const smesh = kit.finish();
  // Enlarge the head a little (vertices rigidly bound to the Head bone) so it sits right on the big shoulders.
  const HS = 1.13, HP = V(0, 1.64, 0.03), hi = smesh.skeleton.bones.indexOf(kit.byKey.get(HEAD));
  {
    const g = smesh.geometry, p = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, v = V(0, 0, 0);
    for (let i = 0; i < p.count; i++) if (si.getX(i) === hi && sw.getX(i) > 0.999) { v.fromBufferAttribute(p, i).sub(HP).multiplyScalar(HS).add(HP); p.setXYZ(i, v.x, v.y, v.z); }
    g.computeBoundingSphere();
  }

  // ---- eyes: rigid spheres on the head bone with a slit-pupil texture ----
  {
    const headB = kit.byKey.get(HEAD);
    const eyeMat = new THREE.MeshPhysicalMaterial({ map: eyeTexture(skin.eye), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, emissive: 0xffffff, emissiveIntensity: 0.28 });
    eyeMat.emissiveMap = eyeMat.map;
    for (const s of [-1, 1]) {
      const dir = V(s * 0.8, 0.05, 0.6).normalize();
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.0172 * HS, 28, 20), eyeMat);
      e.position.set(s * 0.067, 1.73, 0.066).sub(HP).multiplyScalar(HS).add(HP); e.quaternion.setFromUnitVectors(V(1, 0, 0), dir);
      scene.add(e); headB.attach(e);
      const lg = new THREE.TorusGeometry(0.0185 * HS, 0.0066 * HS, 8, 24), n = lg.attributes.position.count, ca = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { ca[i * 3] = 0; ca[i * 3 + 1] = 0.8; ca[i * 3 + 2] = 99; }
      lg.setAttribute('color', new THREE.BufferAttribute(ca, 3));
      const lid = new THREE.Mesh(lg, skinM);
      lid.position.set(s * 0.0715, 1.73, 0.0705).sub(HP).multiplyScalar(HS).add(HP); lid.quaternion.setFromUnitVectors(V(0, 0, 1), dir);
      scene.add(lid); headB.attach(lid);
    }
  }

  // ---- the mannequin's own meshes stay as filler under the suit; its head and hands are cut away ----
  const headBone = kit.byKey.get(HEAD), cut = new Set([headBone]);
  for (const A of ['Left', 'Right']) for (const k of HAND_BONES) if (kit.byKey.has(A + k)) cut.add(kit.byKey.get(A + k));
  scene.traverse((o) => {
    if (!o.isSkinnedMesh || o === smesh) return;
    o.material = reptileSkin(LZ, false, o.matrixWorld.getMaxScaleOnAxis()); o.castShadow = true;
    const g0 = o.geometry, SI = g0.attributes.skinIndex, SW = g0.attributes.skinWeight;
    if (!g0.index) return;
    const flags = new Uint8Array(g0.attributes.position.count);
    for (let i = 0; i < flags.length; i++) for (let k = 0; k < 4; k++) if (SW.getComponent(i, k) > 0.5 && cut.has(o.skeleton.bones[SI.getComponent(i, k)])) flags[i] = 1;
    const src = g0.index.array, keep = [];
    for (let i = 0; i < src.length; i += 3) if (!(flags[src[i]] && flags[src[i + 1]] && flags[src[i + 2]])) keep.push(src[i], src[i + 1], src[i + 2]);
    const g1 = new THREE.BufferGeometry();
    for (const k of Object.keys(g0.attributes)) g1.setAttribute(k, g0.attributes[k]);
    // Sink the filler under the suit so it never pokes through the sculpted muscle (new array: the source geometry is shared).
    const pa = g0.attributes.position.clone(), na = g0.attributes.normal;
    for (let i = 0; i < pa.count; i++) pa.setXYZ(i, pa.getX(i) - na.getX(i) * 0.028, pa.getY(i) - na.getY(i) * 0.028, pa.getZ(i) - na.getZ(i) * 0.028);
    g1.setAttribute('position', pa);
    g1.setIndex(keep); g1.computeBoundingSphere();
    o.geometry = g1;
  });
  return smesh;
}
