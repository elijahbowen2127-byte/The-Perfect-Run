// The two extra maps: the Hot Springs Valley (a stream, a pond, steaming pools, blossom trees, flowers) and the hidden space map
// (a huge crashed UFO burning in a crater, alien plants, a ringed planet in a starry sky). Both are visual dressing on top of the
// normal world generator: world.js calls prepStage() before the terrain is built (ground shaping goes through world.flats / world.carves)
// and buildStageExtras() after the props. Everything is seeded from the round seed so every player sees the same map, and nothing here
// touches the gameplay random stream.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './rng.js';

const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;

export function prepStage(w) {
  w.carves = []; w.flats = w.flats || [];
  const id = w.biome.id;
  if (id === 'springs') setupSprings(w);
  else if (id === 'space') setupSpace(w);
}
export function buildStageExtras(w) {
  const st = w.stage;
  if (!st) return;
  if (st.id === 'springs') buildSprings(w, st);
  else if (st.id === 'space') buildSpace(w, st);
}

// ---------- shared helpers ----------
// Jittered low-poly blob (canopies, boulders): an icosphere with its vertices pushed around by a hash, vertex-coloured.
function blob(r, detail, jit, seed, colA, colB, sx = 1, sy = 1, sz = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail).toNonIndexed();
  const pos = g.attributes.position, rnd = mulberry32(seed), n = pos.count, col = new Float32Array(n * 3);
  const keep = new Map();
  for (let i = 0; i < n; i++) {
    const k = pos.getX(i).toFixed(3) + ',' + pos.getY(i).toFixed(3) + ',' + pos.getZ(i).toFixed(3);
    if (!keep.has(k)) keep.set(k, 1 + (rnd() - 0.5) * jit);
    const s = keep.get(k);
    pos.setXYZ(i, pos.getX(i) * s * sx, pos.getY(i) * s * sy, pos.getZ(i) * s * sz);
    const t = Math.max(0, Math.min(1, (pos.getY(i) / (r * sy) + 1) / 2)), c = new THREE.Color(colA).lerp(new THREE.Color(colB), t);
    const v = 0.88 + rnd() * 0.24;
    col[i * 3] = c.r * v; col[i * 3 + 1] = c.g * v; col[i * 3 + 2] = c.b * v;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}
function tint(g, hex) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const prep = (g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); if (!n.attributes.normal) n.computeVertexNormals(); return n; };
const matrixAt = (x, y, z, ry = 0, s = 1, sy = s) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, sy, s));
const stdVC = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, ...o });

const SOFT = (() => { // a soft round sprite for steam, smoke and glow
  let t = null;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    t = new THREE.CanvasTexture(c);
    return t;
  };
})();

// Rising puffs (steam, smoke, embers) from a set of sources. Each puff lives `life` seconds, climbs `rise` m and drifts with `drift`.
function plume(w, sources, { count, color, size, rise, life, alpha, spread, additive = false, drift = [0.6, 0, 0.3], grow = 2.2 }) {
  const n = Math.max(8, Math.round(count * [0.4, 0.7, 1][w.quality])), seed = new Float32Array(n * 4), pos = new Float32Array(n * 3), r = mulberry32(w.seed * 3 + 91);
  const src = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    seed[i * 4] = r(); seed[i * 4 + 1] = r(); seed[i * 4 + 2] = r(); seed[i * 4 + 3] = r();
    const s = sources[i % sources.length];
    src[i * 4] = s.x; src[i * 4 + 1] = s.y; src[i * 4 + 2] = s.z; src[i * 4 + 3] = s.r || 1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  g.setAttribute('aSrc', new THREE.BufferAttribute(src, 4));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e4);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uMap: { value: SOFT() }, uCol: { value: new THREE.Color(color) }, uPx: { value: 700 } },
    vertexShader: `attribute vec4 aSeed; attribute vec4 aSrc; uniform float uT, uPx; varying float vA;
      void main(){
        float ph = fract(uT / ${life.toFixed(2)} + aSeed.x);
        vec3 p = aSrc.xyz + vec3((aSeed.y - .5) * aSrc.w * ${spread.toFixed(2)}, ph * ${rise.toFixed(2)}, (aSeed.z - .5) * aSrc.w * ${spread.toFixed(2)});
        p += vec3(${drift.map((d) => d.toFixed(2)).join(',')}) * ph * ${rise.toFixed(2)} * (.4 + aSeed.w);
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = ${size.toFixed(2)} * (1. + ph * ${grow.toFixed(2)}) * uPx / max(1., -mv.z);
        vA = sin(ph * 3.14159) * ${alpha.toFixed(2)};
      }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uCol; varying float vA;
      void main(){ float a = texture2D(uMap, gl_PointCoord).a * vA; gl_FragColor = vec4(uCol, a); }`,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false; pts.renderOrder = 4;
  w.group.add(pts);
  w.animated.push((t) => { mat.uniforms.uT.value = t; mat.uniforms.uPx.value = Math.max(300, (w.pxScale || 700)); });
  return pts;
}

// Water: gently rolling ripples and slow glints, tinted deep to shallow; takes the scene fog.
function waterMaterial(w, { deep, shallow, alpha = 0.8, glow = 0 }) {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uDeep: { value: new THREE.Color(deep) }, uShallow: { value: new THREE.Color(shallow) }, uA: { value: alpha }, uGlow: { value: glow } }]),
    vertexShader: `varying vec3 vP; varying vec3 vN;
      #include <fog_pars_vertex>
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.); vP = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition; vN = vec3(0., 1., 0.);
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uT, uA, uGlow; uniform vec3 uDeep, uShallow; varying vec3 vP; varying vec3 vN;
      #include <fog_pars_fragment>
      void main(){
        vec2 p = vP.xz;
        float r1 = sin(p.x * .55 + uT * 1.1 + sin(p.y * .31 + uT * .5) * 1.7), r2 = sin(p.y * .7 - uT * .9 + sin(p.x * .4) * 1.3), r3 = sin((p.x + p.y) * 1.3 + uT * 1.9);
        float rip = (r1 + r2) * .25 + r3 * .08;
        vec3 V = normalize(cameraPosition - vP);
        float fres = pow(1. - clamp(V.y, 0., 1.), 2.2);
        vec3 col = mix(uDeep, uShallow, clamp(.5 + rip * .6, 0., 1.));
        col += fres * vec3(.45, .6, .7) * .55;
        float glint = smoothstep(.93, 1., sin(p.x * 2.1 + uT * 2.3) * sin(p.y * 2.4 - uT * 1.7) * .5 + .5 + rip * .2);
        col += glint * .55 + uGlow * (.5 + rip * .4) * vec3(.35, .9, .85);
        gl_FragColor = vec4(col, uA);
        #include <fog_fragment>
      }`,
    transparent: true, depthWrite: false, fog: true,
  });
  w.animated.push((t) => (mat.uniforms.uT.value = t));
  return mat;
}

// ======================================================================================================================
// HOT SPRINGS VALLEY
// ======================================================================================================================
function setupSprings(w) {
  const r = mulberry32(w.seed * 7 + 1234);
  const far = (x, z, d) => Math.hypot(x - w.spawn.x, z - w.spawn.z) > d && Math.hypot(x - w.arena.x, z - w.arena.z) > w.arena.r + d * 0.6;
  const cands = [];
  for (let tries = 0; cands.length < 14 && tries < 200; tries++) {
    const a = r() * TAU, d = 38 + r() * 55, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (far(x, z, 48)) cands.push({ x, z, h: w.rawHeight(x, z) });
  }
  if (cands.length < 4) cands.push({ x: 20, z: 20, h: w.rawHeight(20, 20) }, { x: -60, z: 40, h: w.rawHeight(-60, 40) }, { x: 50, z: -60, h: w.rawHeight(50, -60) }, { x: -40, z: -70, h: w.rawHeight(-40, -70) });
  const pond = cands.reduce((a, b) => (b.h < a.h ? b : a));
  const source = cands.filter((c) => Math.hypot(c.x - pond.x, c.z - pond.z) > 62).reduce((a, b) => (b.h > a.h ? b : a), cands.find((c) => Math.hypot(c.x - pond.x, c.z - pond.z) > 62) || cands[0]);
  // The stream: from the high source to the pond, wandering side to side.
  const pts = [], N = 26, dx = pond.x - source.x, dz = pond.z - source.z, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L, ph = r() * 6;
  for (let i = 0; i <= N; i++) {
    const t = i / N, off = Math.sin(t * Math.PI) * 11 * Math.sin(t * 5 + ph) + Math.sin(t * 13 + ph * 2) * 2.2 * Math.sin(t * Math.PI);
    pts.push([source.x + dx * t + nx * off, source.z + dz * t + nz * off]);
  }
  const pondR = 15, base = pond.h;
  // Hot spring pools beside the pond, away from the stream, from each other, the camp and the boss arena.
  const pools = [];
  const nearStream = (x, z) => { let b = 1e9; for (let i = 0; i < pts.length - 1; i++) { const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0] - ax, bz = pts[i + 1][1] - az, t = Math.max(0, Math.min(1, ((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz))); b = Math.min(b, Math.hypot(x - ax - bx * t, z - az - bz * t)); } return b; };
  for (let tries = 0; pools.length < 4 && tries < 120; tries++) {
    const a = r() * TAU, d = pondR + 16 + r() * 22, x = pond.x + Math.cos(a) * d, z = pond.z + Math.sin(a) * d, pr = 5 + r() * 3;
    if (!far(x, z, 30) || Math.hypot(x, z) > 112 || nearStream(x, z) < pr + 8) continue;
    if (pools.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + pr + 12)) continue;
    pools.push({ x, z, r: pr, h: w.rawHeight(x, z) });
  }
  // Shape the ground: a basin for the pond, a bowl for each pool, a channel for the stream.
  w.flats.push({ x: pond.x, z: pond.z, r: pondR, blend: 13, h: base - 2.0 });
  for (const p of pools) w.flats.push({ x: p.x, z: p.z, r: p.r, blend: 4, h: p.h - 1.0 });
  const HW = 1.5, BL = 2.6, DEPTH = 0.85;
  w.carves.push((x, z, h) => {
    if (x < w.stageBox.x0 || x > w.stageBox.x1 || z < w.stageBox.z0 || z > w.stageBox.z1) return h;
    const d = nearStream(x, z);
    if (d > HW + BL) return h;
    return h - DEPTH * smooth(1 - (d - HW) / BL);
  });
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
  w.stageBox = { x0: x0 - 8, x1: x1 + 8, z0: z0 - 8, z1: z1 + 8 };
  w.stage = {
    id: 'springs', pond: { x: pond.x, z: pond.z, r: pondR, base }, pools, stream: pts, HW, nearStream,
    noPlace(x, z, rad) {
      if (Math.hypot(x - pond.x, z - pond.z) < pondR + 9 + rad) return true;
      for (const p of pools) if (Math.hypot(x - p.x, z - p.z) < p.r + 3.5 + rad) return true;
      return nearStream(x, z) < HW + 3 + rad;
    },
  };
}

function buildSprings(w, st) {
  const r = mulberry32(w.seed * 11 + 777), Q = w.quality, pond = st.pond;
  const lvlPond = pond.base - 0.85;
  // ---- water ----
  const pondMat = waterMaterial(w, { deep: 0x1d6f8a, shallow: 0x58c4cf, alpha: 0.82 });
  const pondMesh = new THREE.Mesh(new THREE.CircleGeometry(pond.r + 12, 56).rotateX(-Math.PI / 2), pondMat);
  pondMesh.position.set(pond.x, lvlPond, pond.z); pondMesh.renderOrder = 2; pondMesh.frustumCulled = false; w.group.add(pondMesh);
  const poolMat = waterMaterial(w, { deep: 0x2aa7b4, shallow: 0x9af2e6, alpha: 0.88, glow: 0.35 });
  for (const p of st.pools) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(p.r + 3, 40).rotateX(-Math.PI / 2), poolMat);
    m.position.set(p.x, p.h - 0.38, p.z); m.renderOrder = 2; m.frustumCulled = false; w.group.add(m);
  }
  // The stream: a ribbon that follows the ground along its channel and ends in the pond.
  {
    const pts = st.stream, n = pts.length, pos = [], idx = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const hw = 3.4 + (i / n) * 1.2, cy = w.heightAt(pts[i][0], pts[i][1]) - 0.4;
      pos.push(pts[i][0] - tz * hw, cy, pts[i][1] + tx * hw, pts[i][0] + tz * hw, cy, pts[i][1] - tx * hw);
      if (i < n - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, waterMaterial(w, { deep: 0x2a8aa0, shallow: 0x7fd6dc, alpha: 0.72 }));
    m.renderOrder = 2; m.frustumCulled = false; w.group.add(m);
  }
  // Steam rising off every hot spring (and a faint mist over the pond).
  plume(w, st.pools.map((p) => ({ x: p.x, y: p.h - 0.3, z: p.z, r: p.r })), { count: 130, color: 0xf2f6f8, size: 7, rise: 9, life: 5.5, alpha: 0.34, spread: 1.5, grow: 1.8 });
  plume(w, [{ x: pond.x, y: lvlPond + 0.2, z: pond.z, r: pond.r }], { count: 50, color: 0xe6f0f2, size: 8, rise: 2.5, life: 9, alpha: 0.16, spread: 1.6, drift: [0.3, 0, 0.1] });

  // ---- stones round the pools, lily pads, reeds ----
  const stoneGeo = prep(blob(0.6, 1, 0.5, 5, 0x7a7770, 0xb3afa4, 1, 0.7, 1));
  const stones = [];
  for (const p of st.pools) {
    const n = 12 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + r() * 0.3, d = p.r + 0.2 + r() * 0.8, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d, s = 0.7 + r() * 1.2;
      stones.push({ m: matrixAt(x, w.heightAt(x, z) - 0.05, z, r() * TAU, s, s * 0.85), x, z });
    }
  }
  w.addInstanced([{ geo: stoneGeo, mat: stdVC({ roughness: 0.92 }) }], stones, { cast: true });
  const pad = new THREE.CircleGeometry(0.7, 14).rotateX(-Math.PI / 2); tint(pad, 0x3f8a3a);
  const pads = [];
  for (let i = 0; i < 46; i++) {
    const a = r() * TAU, d = 2 + r() * (pond.r + 4), x = pond.x + Math.cos(a) * d, z = pond.z + Math.sin(a) * d;
    pads.push({ m: matrixAt(x, lvlPond + 0.05, z, r() * TAU, 0.7 + r() * 0.9), x, z });
  }
  w.addInstanced([{ geo: prep(pad), mat: stdVC({ side: THREE.DoubleSide, roughness: 0.6 }) }], pads, { cast: false, receive: false });
  const reedGeo = (() => { const parts = []; for (let k = 0; k < 6; k++) { const c = new THREE.ConeGeometry(0.05, 2.1 + (k % 3) * 0.4, 4, 1).translate(0, 1.1, 0); c.rotateZ((k - 2.5) * 0.09); c.rotateY(k * 1.1); c.translate(Math.cos(k * 2) * 0.3, 0, Math.sin(k * 2) * 0.3); parts.push(tint(prep(c), k % 2 ? 0x5f8f3a : 0x7aa044)); } return mergeGeometries(parts); })();
  const reeds = [];
  const nearWater = (x, z) => Math.abs(Math.hypot(x - pond.x, z - pond.z) - (pond.r + 3)) < 3 || st.nearStream(x, z) < 5.4;
  for (let i = 0, k = 0; i < [60, 110, 170][Q] && k < 4000; k++) {
    const a = r() * TAU, d = pond.r + r() * 12, x = pond.x + Math.cos(a) * d, z = pond.z + Math.sin(a) * d;
    if (!nearWater(x, z) || w.heightAt(x, z) < lvlPond - 0.1) continue;
    reeds.push({ m: matrixAt(x, w.heightAt(x, z) - 0.1, z, r() * TAU, 0.8 + r() * 0.7), x, z }); i++;
  }
  for (let i = 0, k = 0; i < [40, 80, 120][Q] && k < 4000; k++) {
    const p = st.stream[Math.floor(r() * st.stream.length)], x = p[0] + (r() - 0.5) * 14, z = p[1] + (r() - 0.5) * 14;
    const d = st.nearStream(x, z); if (d < 3.6 || d > 6.5) continue;
    reeds.push({ m: matrixAt(x, w.heightAt(x, z) - 0.1, z, r() * TAU, 0.7 + r() * 0.6), x, z }); i++;
  }
  w.addInstanced([{ geo: reedGeo, mat: stdVC({ side: THREE.DoubleSide, roughness: 0.8 }) }], reeds, { cast: false });

  // ---- trees: broad-leaved and a few pink blossom trees near the water ----
  const trunk = (h, r0, r1) => tint(prep(new THREE.CylinderGeometry(r1, r0, h, 7, 1).translate(0, h / 2, 0)), 0x5a4030);
  const tree = (colA, colB, seed, scale) => mergeGeometries([
    trunk(3.2 * scale, 0.32 * scale, 0.2 * scale),
    blob(2.3 * scale, 1, 0.45, seed, colA, colB, 1, 0.85, 1).translate(0, 4.4 * scale, 0),
    blob(1.7 * scale, 1, 0.45, seed + 1, colA, colB, 1, 0.85, 1).translate(1.3 * scale, 3.6 * scale, 0.4 * scale),
    blob(1.6 * scale, 1, 0.45, seed + 2, colA, colB, 1, 0.85, 1).translate(-1.2 * scale, 3.8 * scale, -0.5 * scale),
    blob(1.3 * scale, 1, 0.45, seed + 3, colA, colB, 1, 0.85, 1).translate(0.2 * scale, 5.7 * scale, 0.5 * scale),
  ].map((g) => (g.index ? g.toNonIndexed() : g)));
  const kinds = [
    { geo: tree(0x2f6f2a, 0x74b54a, 21, 1), n: [60, 110, 160], bl: 1.8 },
    { geo: tree(0x3f7a2e, 0x9acb55, 31, 1.25), n: [30, 55, 80], bl: 2.2 },
    { geo: tree(0xd98aa8, 0xffd4e0, 41, 1.05), n: [10, 18, 26], bl: 1.9, near: true },
  ];
  const placed = [];
  for (const kd of kinds) {
    const items = [];
    for (let i = 0, k = 0; i < kd.n[Q] && k < 6000; k++) {
      let x, z;
      if (kd.near) { const a = r() * TAU, d = pond.r + 11 + r() * 30; x = pond.x + Math.cos(a) * d; z = pond.z + Math.sin(a) * d; }
      else { x = (r() * 2 - 1) * 125; z = (r() * 2 - 1) * 125; }
      if (!w.clearOf(x, z, 2.2) || w.blocked(x, z, 2) || Math.hypot(x, z) > 125) continue;
      if (placed.some((p) => Math.hypot(p[0] - x, p[1] - z) < 4.2)) continue;
      const h = w.heightAt(x, z);
      if (Math.abs(w.heightAt(x + 1.5, z) - h) > 0.9 || Math.abs(w.heightAt(x, z + 1.5) - h) > 0.9) continue;
      const s = 0.75 + r() * 0.6;
      items.push({ m: matrixAt(x, h - 0.1, z, r() * TAU, s), x, z });
      w.addCollider(x, z, 0.55 * s, h + 7 * s);
      w.blobs.push({ x, z, y: h, r: kd.bl * s });
      placed.push([x, z]); i++;
    }
    w.addInstanced([{ geo: kd.geo, mat: stdVC({ roughness: 0.82 }) }], items, { cast: true });
  }

  // ---- flowers scattered through the grass ----
  const headGeo = prep(new THREE.IcosahedronGeometry(0.13, 0).translate(0, 0.42, 0)), stalkGeo = tint(prep(new THREE.CylinderGeometry(0.012, 0.016, 0.42, 4).translate(0, 0.21, 0)), 0x4a8a34);
  const heads = [], stalks = [], cols = [0xffd23a, 0xff6a8a, 0xffffff, 0xc77dff, 0xff9a3a, 0x7ad0ff];
  for (let i = 0, k = 0; i < [500, 1000, 1700][Q] && k < 9000; k++) {
    const x = (r() * 2 - 1) * 120, z = (r() * 2 - 1) * 120;
    if (!w.clearOf(x, z, 0.5) || w.blocked(x, z, 0.4)) continue;
    const h = w.heightAt(x, z), s = 0.8 + r() * 0.9, m = matrixAt(x, h - 0.02, z, r() * TAU, s);
    heads.push({ m, x, z, c: new THREE.Color(cols[Math.floor(r() * cols.length)]) }); stalks.push({ m, x, z }); i++;
  }
  w.addInstanced([{ geo: headGeo, mat: new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: 0x222222 }) }], heads, { cast: false, receive: false });
  w.addInstanced([{ geo: stalkGeo, mat: stdVC({ roughness: 0.8 }) }], stalks, { cast: false, receive: false });
}

// ======================================================================================================================
// CRASH SITE PRIME (the hidden space map)
// ======================================================================================================================
function setupSpace(w) {
  const r = mulberry32(w.seed * 9 + 555);
  const craters = [{ x: 0, z: 0, r: 34, d: 7.5, rim: 3.2 }]; // the UFO's own crater
  for (let tries = 0; craters.length < 13 && tries < 200; tries++) {
    const a = r() * TAU, d = 30 + r() * 95, x = Math.cos(a) * d, z = Math.sin(a) * d, cr = 6 + r() * 12;
    if (Math.hypot(x - w.spawn.x, z - w.spawn.z) < cr + 20 || Math.hypot(x - w.arena.x, z - w.arena.z) < w.arena.r + cr + 8) continue;
    if (craters.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + cr + 4)) continue;
    craters.push({ x, z, r: cr, d: cr * 0.16, rim: cr * 0.06 });
  }
  w.carves.push((x, z, h) => {
    for (const c of craters) {
      const d = Math.hypot(x - c.x, z - c.z);
      if (d > c.r * 1.6) continue;
      if (d < c.r) h -= c.d * (1 - (d / c.r) * (d / c.r));
      const e = (d - c.r) / (c.r * 0.28);
      h += c.rim * Math.exp(-e * e);
    }
    return h;
  });
  w.stage = {
    id: 'space', craters, ufo: { x: 0, z: 0, r: 25 },
    noPlace(x, z, rad) { return Math.hypot(x, z) < 38 + rad; },
  };
}

function buildSpace(w, st) {
  const r = mulberry32(w.seed * 13 + 4321), Q = w.quality;
  const floor = w.heightAt(0, 0);
  // ---- the UFO ----
  const ufo = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0x59606b, roughness: 0.38, metalness: 0.92 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.5, metalness: 0.85 });
  const scorch = new THREE.MeshStandardMaterial({ color: 0x1a1412, roughness: 0.9, metalness: 0.4 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x7dffd8, toneMapped: false });
  const lampOff = new THREE.MeshStandardMaterial({ color: 0x0e1a18, roughness: 0.4, metalness: 0.6 });
  const prof = [[0, -3.2], [9, -3.6], [17, -2.9], [23, -1.2], [25.5, 0.4], [24, 1.7], [18, 2.7], [11, 3.5], [5, 4.6], [0, 5.0]].map(([rr, y]) => new THREE.Vector2(rr, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), hull);
  body.castShadow = true; body.receiveShadow = true; ufo.add(body);
  for (const [rr, y, tr] of [[25.4, 0.5, 0.55], [18.5, 2.75, 0.4], [10, -3.4, 0.45]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(rr, tr, 8, 64).rotateX(Math.PI / 2), dark); t.position.y = y; ufo.add(t); }
  // Window lamps around the rim: most are dark, a few still glow.
  const lampGeo = new THREE.BoxGeometry(1.5, 0.7, 0.5);
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU, lamp = new THREE.Mesh(lampGeo, r() < 0.28 ? glowMat : lampOff);
    lamp.position.set(Math.cos(a) * 25.1, 0.5, Math.sin(a) * 25.1); lamp.rotation.y = -a + Math.PI / 2; ufo.add(lamp);
  }
  // The cracked dome with a sick green glow inside.
  const dome = new THREE.Mesh(new THREE.SphereGeometry(7.5, 28, 16, 0, TAU, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x9fe8d0, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1, clearcoat: 1, side: THREE.DoubleSide, emissive: 0x1a6a4a, emissiveIntensity: 0.6 }));
  dome.position.y = 4.4; ufo.add(dome);
  const core = new THREE.Mesh(new THREE.SphereGeometry(2.6, 14, 10), glowMat); core.position.y = 6.2; ufo.add(core);
  // Burnt scars and torn plating chunks sticking out of the hull.
  for (let i = 0; i < 9; i++) {
    const a = r() * TAU, rr = 15 + r() * 8, chunk = new THREE.Mesh(new THREE.BoxGeometry(3 + r() * 5, 0.5, 2 + r() * 3), i % 2 ? dark : scorch);
    chunk.position.set(Math.cos(a) * rr, 1.8 + r() * 1.8, Math.sin(a) * rr); chunk.rotation.set((r() - 0.5) * 0.9, r() * TAU, (r() - 0.5) * 0.9); chunk.castShadow = true; ufo.add(chunk);
  }
  // Landing struts snapped off, one still planted.
  for (const [a, broke] of [[0.8, false], [2.4, true], [4.0, true]]) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, broke ? 3 : 7, 8), dark);
    s.position.set(Math.cos(a) * 17, broke ? -3.6 : -5.3, Math.sin(a) * 17); s.rotation.z = broke ? 0.6 : 0; ufo.add(s);
  }
  // Half-buried in the crater, tipped over.
  ufo.position.set(0, floor + 3.4, 0); ufo.rotation.set(0.22, 0.6, -0.16);
  ufo.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  w.group.add(ufo);
  w.addCollider(0, 0, 23, floor + 14);
  w.blobs.push({ x: 0, z: 0, y: floor, r: 30 });

  // ---- fire ----
  const flameMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float uT; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float nz(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        float y = vUv.y, n = nz(vec2(vUv.x * 4., y * 3. - uT * 2.8)) * .65 + nz(vec2(vUv.x * 9. + 3., y * 6. - uT * 4.6)) * .35;
        float w = (1. - y) * .55 + .05, shape = smoothstep(w, w * .3, abs(vUv.x - .5)) * smoothstep(1., .15, y);
        float a = clamp(shape * (.55 + n * 1.1), 0., 1.);
        vec3 c = mix(vec3(1., .92, .55), vec3(1., .3, .06), smoothstep(.0, .75, y + (1. - n) * .25));
        gl_FragColor = vec4(c * (1.1 + n * .5), a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  w.animated.push((t) => (flameMat.uniforms.uT.value = t));
  const fires = [[16, 3.2, 8], [-14, 3.5, -12], [4, 5.5, -19], [-21, 2.6, 4], [20, 1.2, -10], [-2, 8.5, 2], [9, 4.0, 17], [-10, 3.2, 14]];
  const flameGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const smokeSrc = [], emberSrc = [];
  fires.forEach(([fx, fy, fz], i) => {
    const wp = new THREE.Vector3(fx, fy, fz).applyEuler(ufo.rotation).add(ufo.position), s = 7 + (i % 3) * 3;
    for (const ry of [0, Math.PI / 2, Math.PI / 4]) {
      const m = new THREE.Mesh(flameGeo, flameMat); m.scale.set(s * 0.7, s * 1.5, 1); m.position.copy(wp); m.rotation.y = ry + i; m.renderOrder = 5; m.frustumCulled = false; w.group.add(m);
    }
    smokeSrc.push({ x: wp.x, y: wp.y + s * 0.9, z: wp.z, r: 3 }); emberSrc.push({ x: wp.x, y: wp.y + 1, z: wp.z, r: 4 });
  });
  plume(w, smokeSrc, { count: 170, color: 0x2a2220, size: 14, rise: 70, life: 9, alpha: 0.5, spread: 1.6, drift: [1.1, 0, 0.4], grow: 2.6 });
  plume(w, emberSrc, { count: 120, color: 0xffa040, size: 1.6, rise: 26, life: 3.4, alpha: 0.9, spread: 2, additive: true, drift: [0.7, 0, 0.25], grow: 0.2 });
  // A pool of firelight on the crater floor.
  const glowTex = SOFT();
  const lightPool = new THREE.Mesh(new THREE.PlaneGeometry(130, 130).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff6a1a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  lightPool.position.set(0, floor + 1.2, 0); lightPool.renderOrder = 1; lightPool.frustumCulled = false; w.group.add(lightPool);
  w.animated.push((t) => { lightPool.material.opacity = 0.42 + Math.sin(t * 7) * 0.05 + Math.sin(t * 13.3) * 0.04; });

  // ---- wreckage and alien plants ----
  const junkGeo = prep(blob(1, 1, 0.55, 8, 0x3a3d44, 0x6b7078, 1.6, 0.5, 1));
  const junk = [];
  for (let i = 0; i < 40; i++) {
    const a = r() * TAU, d = 24 + r() * 26, x = Math.cos(a) * d, z = Math.sin(a) * d, s = 0.6 + r() * 1.6;
    junk.push({ m: matrixAt(x, w.heightAt(x, z) - 0.1, z, r() * TAU, s, s * (0.6 + r() * 0.8)), x, z });
  }
  w.addInstanced([{ geo: junkGeo, mat: stdVC({ roughness: 0.4, metalness: 0.8 }) }], junk, { cast: true });
  const stem = tint(prep(new THREE.CylinderGeometry(0.06, 0.16, 3.2, 6).translate(0, 1.6, 0)), 0x3a2a4a);
  const bulbGeo = prep(new THREE.IcosahedronGeometry(0.5, 1).translate(0, 3.4, 0));
  const plants = [], bulbs = [], pcols = [0x3affd0, 0xff4ad0, 0xb6ff3a, 0x6a8aff, 0xffb83a];
  for (let i = 0, k = 0; i < [70, 130, 200][Q] && k < 6000; k++) {
    const x = (r() * 2 - 1) * 122, z = (r() * 2 - 1) * 122;
    if (!w.clearOf(x, z, 1.2) || w.blocked(x, z, 1)) continue;
    const h = w.heightAt(x, z), s = 0.6 + r() * 1.4, m = matrixAt(x, h - 0.05, z, r() * TAU, s);
    plants.push({ m, x, z }); bulbs.push({ m, x, z, c: new THREE.Color(pcols[Math.floor(r() * pcols.length)]).multiplyScalar(2.2) }); i++;
  }
  w.addInstanced([{ geo: stem, mat: stdVC({ roughness: 0.7 }) }], plants, { cast: false });
  w.addInstanced([{ geo: bulbGeo, mat: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }) }], bulbs, { cast: false, receive: false });

  // ---- the sky: stars and a ringed planet ----
  const starN = 1400, sp = new Float32Array(starN * 3), sc = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) {
    const u = r() * 2 - 1, a = r() * TAU, q = Math.sqrt(1 - u * u), rad = 820;
    sp[i * 3] = Math.cos(a) * q * rad; sp[i * 3 + 1] = Math.abs(u) * rad * 0.95 + 20; sp[i * 3 + 2] = Math.sin(a) * q * rad;
    const b = 0.5 + r() * 0.8; sc[i * 3] = b; sc[i * 3 + 1] = b * (0.85 + r() * 0.15); sc[i * 3 + 2] = b * (0.8 + r() * 0.3);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 3, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false, transparent: true }));
  stars.renderOrder = -0.8; stars.frustumCulled = false; w.group.add(stars);
  const planet = new THREE.Group();
  const bands = new THREE.ShaderMaterial({
    uniforms: {}, vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'varying vec3 vN; varying vec3 vP; void main(){ float b = sin(vP.y * .09) * .5 + .5 + sin(vP.y * .31 + 1.) * .15; vec3 c = mix(vec3(.55, .28, .22), vec3(.95, .72, .5), b); float l = clamp(dot(normalize(vN), normalize(vec3(-.6, .35, .7))) * .9 + .15, .08, 1.); gl_FragColor = vec4(c * l, 1.); }',
    fog: false, depthWrite: false,
  });
  planet.add(new THREE.Mesh(new THREE.SphereGeometry(130, 40, 24), bands));
  const ring = new THREE.Mesh(new THREE.RingGeometry(170, 250, 80, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd9b48a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, fog: false, depthWrite: false }));
  ring.rotation.set(0.35, 0, 0.18); planet.add(ring);
  planet.position.set(-420, 330, -560); planet.renderOrder = -0.7; planet.traverse((o) => { o.frustumCulled = false; o.renderOrder = -0.7; });
  w.group.add(planet);
}
