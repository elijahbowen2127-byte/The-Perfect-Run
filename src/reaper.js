// Death, the round-end hunter, dressed as a grim reaper.
//
// She is the sorceress skinned mesh with her own clothes, shoes and hair hidden and replaced by
// hand-built geometry bound to her rig: a tattered black hooded robe (skinned, so it follows the
// legs and arms), bell sleeves, a deep hood that swallows the face, wrapped wrists and ankles, a
// rope-and-chain belt and a cold-blue mist. Her feet are bare. Also here: the scythe she carries.
import * as THREE from 'three';
import { boneKey } from './retarget.js';

const V = (...a) => new THREE.Vector3(...a);
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function prng(seed) { let s = seed >>> 0 || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, { repeat = true, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------- textures
// Black, threadbare cloth: soft mottling, vertical fold streaks, dust at the hem and torn gaps that
// start at the bottom edge (alpha-tested, so the hem is genuinely ragged).
let clothCache = null;
function clothTextures() {
  if (clothCache) return clothCache;
  const W = 512, H = 512, R = prng(7);
  const col = canvas(W, H), g = col.getContext('2d');
  g.fillStyle = '#18181e'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 120; i++) { // mottling
    const x = R() * W, y = R() * H, r = 20 + R() * 70, dark = R() < 0.55;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, dark ? 'rgba(4,4,8,0.30)' : 'rgba(70,72,92,0.13)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 46; i++) { // fold streaks (wrap-safe)
    const x = R() * W, w = 3 + R() * 16, dark = R() < 0.6;
    for (const o of [-W, 0, W]) {
      const gr = g.createLinearGradient(x + o - w, 0, x + o + w, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, dark ? 'rgba(2,2,6,0.2)' : 'rgba(80,84,110,0.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x + o - w, 0, w * 2, H);
    }
  }
  for (let i = 0; i < 7000; i++) { // weave and fibres
    g.strokeStyle = R() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(110,115,140,0.045)';
    g.lineWidth = 1; const x = R() * W, y = R() * H, l = 2 + R() * 6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 3, y + l); g.stroke();
  }
  const dust = g.createLinearGradient(0, H * 0.62, 0, H); // hem dust, greyer toward the bottom
  dust.addColorStop(0, 'rgba(58,58,68,0)'); dust.addColorStop(1, 'rgba(64,62,70,0.45)');
  g.fillStyle = dust; g.fillRect(0, H * 0.62, W, H * 0.38);
  // Torn gaps cut out of the alpha channel, sparse and mostly near the bottom.
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
  const tri = (x, w, h) => {
    for (const o of [-W, 0, W]) {
      g.beginPath(); g.moveTo(x + o - w * 0.5, H + 2); g.lineTo(x + o + w * 0.5, H + 2);
      g.lineTo(x + o + (R() - 0.5) * w * 0.9, H - h); g.closePath(); g.fill();
    }
  };
  for (let i = 0; i < 22; i++) tri(R() * W, 5 + R() * 20, 14 + Math.pow(R(), 2.2) * 150);
  for (let i = 0; i < 9; i++) { // holes and nicks
    const x = R() * W, y = H * (0.45 + R() * 0.55), r = 2 + R() * 5;
    for (const o of [-W, 0, W]) { g.beginPath(); g.ellipse(x + o, y, r, r * (0.6 + R() * 0.8), R() * 3, 0, 7); g.fill(); }
  }
  g.globalCompositeOperation = 'source-over';
  const bump = canvas(256, 256), b = bump.getContext('2d');
  b.fillStyle = '#808080'; b.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1500; i++) {
    b.strokeStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${0.05 + R() * 0.14})`; b.lineWidth = 1 + R() * 2;
    const x = R() * 256, y = R() * 256, l = 8 + R() * 40;
    b.beginPath(); b.moveTo(x, y); b.lineTo(x + (R() - 0.5) * 5, y + l); b.stroke();
  }
  clothCache = { map: tex(col), bump: tex(bump, { srgb: false }) };
  return clothCache;
}

// Pale, grubby linen wraps and a twisted rope: diagonal strands.
function stripeTexture(base, dark, light, slope, n) {
  const W = 256, H = 64, c = canvas(W, H), g = c.getContext('2d'), R = prng(11);
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  for (let i = -H; i < W + H; i += W / n) {
    g.fillStyle = dark; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + W / n * 0.45, 0); g.lineTo(i + slope + W / n * 0.45, H); g.lineTo(i + slope, H); g.fill();
  }
  for (let i = 0; i < 700; i++) { g.fillStyle = R() < 0.5 ? dark : light; g.globalAlpha = 0.08 + R() * 0.12; g.fillRect(R() * W, R() * H, 1 + R() * 3, 1); }
  g.globalAlpha = 1;
  return tex(c);
}

let woodCache = null;
function woodTexture() {
  if (woodCache) return woodCache;
  const W = 64, H = 512, c = canvas(W, H), g = c.getContext('2d'), R = prng(3);
  g.fillStyle = '#2c1d15'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = R() < 0.6 ? 'rgba(8,4,3,0.5)' : 'rgba(110,76,52,0.22)'; g.lineWidth = 0.6 + R() * 1.6;
    const x = R() * W; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (R() - 0.5) * 8, H * 0.3, x + (R() - 0.5) * 8, H * 0.7, x + (R() - 0.5) * 6, H); g.stroke();
  }
  woodCache = tex(c);
  return woodCache;
}

// ---------------------------------------------------------------- geometry helpers
// Interpolates a profile table [[y, a, b, ...], ...] (y descending) at y with a Catmull-Rom blend.
function prof(tab, y) {
  const n = tab.length;
  if (y >= tab[0][0]) return tab[0].slice(1);
  if (y <= tab[n - 1][0]) return tab[n - 1].slice(1);
  let k = 0; while (k < n - 2 && y < tab[k + 1][0]) k++;
  const t = (tab[k][0] - y) / (tab[k][0] - tab[k + 1][0]);
  const p0 = tab[Math.max(0, k - 1)], p1 = tab[k], p2 = tab[k + 1], p3 = tab[Math.min(n - 1, k + 2)];
  const out = [];
  for (let i = 1; i < p1.length; i++) {
    const a = p0[i], b = p1[i], c = p2[i], d = p3[i];
    out.push(0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t));
  }
  return out;
}

// Parametric grid: fn(i, j) -> [x, y, z]; skip(i, j) drops a cell. u wraps (seam vertices duplicated).
function grid(nu, nv, fn, uvFn, skip) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const p = fn(i % nu, j); pos.push(p[0], p[1], p[2]);
    const t = uvFn(i, j); uv.push(t[0], t[1]);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    if (skip && skip(i, j)) continue;
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.userData.nu = nu; g.userData.nv = nv;
  return g;
}

// Smooth normals that point away from `centre(i,j)`, with seam vertices averaged.
function finishNormals(g, outward) {
  g.computeVertexNormals();
  const nu = g.userData.nu, nv = g.userData.nv, n = g.attributes.normal, p = g.attributes.position;
  // Flip winding when most normals point inward.
  let dot = 0;
  for (let j = 0; j <= nv; j += 3) for (let i = 0; i < nu; i += 5) {
    const k = j * (nu + 1) + i, o = outward(i, j, p.getX(k), p.getY(k), p.getZ(k));
    dot += n.getX(k) * o[0] + n.getY(k) * o[1] + n.getZ(k) * o[2];
  }
  if (dot < 0) { const a = g.index.array; for (let q = 0; q < a.length; q += 3) { const t = a[q + 1]; a[q + 1] = a[q + 2]; a[q + 2] = t; } g.computeVertexNormals(); }
  for (let j = 0; j <= nv; j++) {
    const a = j * (nu + 1), b = a + nu;
    const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
  }
}

// ---------------------------------------------------------------- the build
export function buildReaper(scene, opts = {}) {
  scene.updateMatrixWorld(true);
  const byKey = new Map(), list = [];
  scene.traverse((o) => { if (o.isBone) { list.push(o); const k = boneKey(o.name); if (!byKey.has(k)) byKey.set(k, o); } });
  const L = byKey.get('LeftArm').getWorldPosition(V(0, 0, 0)).x >= 0 ? 1 : -1; // rig faces -Z when L < 0
  const S = (opts.top || 1.79) / 1.789; // scene units per final metre (authoring is in final metres)
  const M = (x, y, z) => V(x * S * L, y * S, z * S * L); // canonical (+Z forward, left +X) -> scene
  const J = (k) => { const p = byKey.get(k).getWorldPosition(V(0, 0, 0)); return V(p.x * L / S, p.y / S, p.z * L / S); };

  let body = null; const meshes = {};
  scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    if (o.name === 'Bodybaked') body = o;
    meshes[o.name] = o;
  });
  if (!body) return;
  const bones = body.skeleton.bones;
  const bi = (k) => bones.indexOf(byKey.get(k));

  // ---- strip her old outfit: hair, jacket, skirt, shoes; the socks become bare feet ----
  const matName = (o) => [].concat(o.material).map((m) => m.name).join('|');
  // Skin goes cold and bloodless; the face fades to black from the brow down so the hood's shadow
  // swallows her eyes (done in the shader from bind-pose height, so it follows the head).
  const skinCache = new Map();
  // The face mesh's own local height range (its units are not guaranteed to match the bones'), mapped
  // onto the head's known extent in final metres (1.455 chin .. 1.70 crown).
  let fy0 = 0, fy1 = 1;
  if (meshes.Facebaked_7) {
    const g = meshes.Facebaked_7.geometry, pa = g.attributes.position, ix = g.index; fy0 = 1e9; fy1 = -1e9;
    for (let i = 0; i < ix.count; i++) { const y = pa.getY(ix.getX(i)); fy0 = Math.min(fy0, y); fy1 = Math.max(fy1, y); }
  }
  const hRow = 'position.y';
  const ySh = (y) => (fy0 + ((y - 1.455) / (1.70 - 1.455)) * (fy1 - fy0)).toFixed(4);
  const tweak = (m, pale, shade, legs) => {
    const c = m.clone();
    c.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vRY;').replace('#include <begin_vertex>', `#include <begin_vertex>\nvRY = ${hRow};`);
      const pal = 'mix(vec3(dot(X, vec3(0.3, 0.59, 0.11))), X, 0.38) * vec3(0.92, 0.96, 1.1)';
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vRY;')
        .replace('#include <color_fragment>', '#include <color_fragment>\nfloat rShade = ' + (shade ? `mix(1.0, 0.03, smoothstep(${ySh(1.47)}, ${ySh(1.525)}, vRY))` : legs ? `mix(1.0, 0.04, smoothstep(${ySh(0.2)}, ${ySh(0.24)}, vRY) * (1.0 - smoothstep(${ySh(0.98)}, ${ySh(1.08)}, vRY)))` : '1.0') + ';\n' +
          (pale ? 'diffuseColor.rgb = ' + pal.replace(/X/g, 'diffuseColor.rgb') + ';\n' : '') + 'diffuseColor.rgb *= rShade;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + (pale ? 'totalEmissiveRadiance = ' + pal.replace(/X/g, 'totalEmissiveRadiance') + ';\n' : '') + 'totalEmissiveRadiance *= rShade;');
    };
    c.customProgramCacheKey = () => 'reaperSkin' + (pale ? 'p' : '') + (shade ? 's' : '') + (legs ? 'l' : '');
    return c;
  };
  scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    if (/^Hair/.test(o.name) || /Tops_|Bottoms_|Shoes_/.test(matName(o))) { o.visible = false; return; }
    const face = /^Face/.test(o.name), skin = /SKIN/.test(matName(o));
    if (!face && !skin) return;
    const mats = [].concat(o.material).map((m) => {
      const legs = o.name === 'Bodybaked', key = m.uuid + (face ? 'f' : '') + (legs ? 'l' : '');
      if (!skinCache.has(key)) skinCache.set(key, tweak(m, /SKIN/.test(m.name), face, legs));
      return skinCache.get(key);
    });
    o.material = Array.isArray(o.material) ? mats : mats[0];
  });
  // Bodybaked_1 is the sock mesh (it has the foot shape): re-skin it as a bare foot and ankle.
  if (meshes.Bodybaked_1) {
    meshes.Bodybaked_1.material = new THREE.MeshStandardMaterial({ color: 0x8f8893, roughness: 0.6, metalness: 0 });
  }

  // ---- skinned-mesh plumbing ----
  const weigh = (g, fn) => {
    const p = g.attributes.position, n = p.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const ws = fn(p.getX(i), p.getY(i), p.getZ(i), i).filter((w) => w[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
      let tot = 0; for (const w of ws) tot += w[1];
      ws.forEach(([k, w], j) => { si[i * 4 + j] = Math.max(0, bi(k)); sw[i * 4 + j] = w / tot; });
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  };
  // Canonical-metre geometry -> scene units.
  const toScene = (g) => {
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * S * L, p.getY(i) * S, p.getZ(i) * S * L);
    if (n) for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i) * L, n.getY(i), n.getZ(i) * L);
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  };
  const addSkinned = (g, mat, weightFn, name, extra = {}) => {
    weigh(g, weightFn); // weights are decided in canonical coordinates
    toScene(g);
    g.applyMatrix4(body.matrixWorld.clone().invert());
    const m = new THREE.SkinnedMesh(g, mat);
    m.name = name; m.castShadow = true; m.frustumCulled = false;
    body.parent.add(m);
    m.position.copy(body.position); m.quaternion.copy(body.quaternion); m.scale.copy(body.scale);
    m.bind(body.skeleton, body.bindMatrix);
    Object.assign(m, extra);
    return m;
  };
  const addRigid = (g, mat, bone, name) => {
    toScene(g);
    const m = new THREE.Mesh(g, mat); m.name = name; m.castShadow = true; m.frustumCulled = false;
    scene.add(m); byKey.get(bone).attach(m);
    return m;
  };

  // ---- materials ----
  const ct = clothTextures();
  const cloth = (extra = {}) => {
    const m = new THREE.MeshPhysicalMaterial({
      map: ct.map, bumpMap: ct.bump, bumpScale: 0.7, color: 0xffffff, roughness: 0.93, metalness: 0,
      sheen: 0.8, sheenColor: new THREE.Color(0x4a5588), sheenRoughness: 0.6, side: THREE.DoubleSide, alphaTest: 0.5, ...extra,
    });
    // Inside faces (hood lining, sleeve inside) fall into near black.
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  if (!gl_FrontFacing) diffuseColor.rgb *= 0.1;'); };
    m.customProgramCacheKey = () => 'reaperCloth';
    return m;
  };
  const robeMat = cloth(), hoodMat = cloth();
  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: ct.map, alphaTest: 0.5 });
  const linenTex = stripeTexture('#8a8071', '#4e4637', '#b5aa94', 18, 10);
  const linen = new THREE.MeshStandardMaterial({ map: linenTex, roughness: 0.95, side: THREE.DoubleSide });
  const ropeTex = stripeTexture('#6a5238', '#2c2016', '#a58a62', 30, 7);
  const rope = new THREE.MeshStandardMaterial({ map: ropeTex, roughness: 0.9 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x4b4f58, roughness: 0.4, metalness: 0.85 });

  // ---- how the robe follows her: the torso chain above the hips, the thighs below ----
  const hipY = J('Hips').y;
  const chain = [['Neck', J('Neck').y], ['Spine2', J('Spine2').y], ['Spine1', J('Spine1').y], ['Spine', J('Spine').y], ['Hips', hipY]];
  const spineW = (y) => {
    if (y >= chain[0][1]) return [['Neck', 1]];
    for (let i = 0; i < chain.length - 1; i++) {
      if (y <= chain[i][1] && y >= chain[i + 1][1]) { const t = (chain[i][1] - y) / (chain[i][1] - chain[i + 1][1]); return [[chain[i][0], 1 - t], [chain[i + 1][0], t]]; }
    }
    return [['Hips', 1]];
  };
  const robeW = (x, y) => {
    const base = spineW(y);
    if (y >= hipY) return base;
    const t = clamp((hipY - y) / 0.85, 0, 1), leg = 0.34 * Math.pow(t, 0.85);
    const side = 1 / (1 + Math.exp(-x / 0.12)); // 1 on the left, 0 on the right
    return [['Hips', 1 - leg], ['LeftUpLeg', leg * side], ['RightUpLeg', leg * (1 - side)]];
  };

  // ======================================================== the robe
  const ROBE = [ // y, half width, front depth, back depth, centre z
    [1.45, 0.062, 0.060, 0.060, -0.01], [1.41, 0.100, 0.080, 0.075, -0.005], [1.37, 0.162, 0.113, 0.105, 0.0],
    [1.30, 0.168, 0.136, 0.112, 0.01], [1.20, 0.150, 0.130, 0.105, 0.005], [1.10, 0.138, 0.125, 0.105, 0.0],
    [1.00, 0.150, 0.122, 0.115, -0.005], [0.90, 0.200, 0.150, 0.150, -0.01], [0.70, 0.255, 0.205, 0.205, -0.015],
    [0.45, 0.315, 0.265, 0.275, -0.02], [0.14, 0.375, 0.335, 0.355, -0.03],
  ];
  const rr = prng(21);
  const RN = 88, RM = 40, yTop = 1.45, yHemBase = 0.155;
  const hemOf = new Float32Array(RN);
  for (let i = 0; i < RN;) { // ragged teeth of random length: some strips hang low, some are torn short
    const w = 2 + Math.floor(rr() * 4), len = 0.005 + Math.pow(rr(), 1.4) * 0.15;
    for (let j = 0; j < w && i < RN; j++, i++) hemOf[i] = yHemBase + 0.035 - len * Math.pow(1 - Math.abs((2 * (j + 0.5)) / w - 1), 0.8);
  }
  const fold = (a, y) => {
    const A = 0.11 * sstep(1.0, 0.2, y) + 0.012;
    return 1 + A * (0.5 * Math.sin(a * 3 + y * 2.2 + 0.7) + 0.32 * Math.sin(a * 7 - y * 3.1) + 0.2 * Math.sin(a * 13 + y * 1.3));
  };
  const robeGrid = (shrink, lift, jitter) => {
    const g = grid(RN, RM, (i, j) => {
      const a = (i / RN) * Math.PI * 2, hem = Math.max(hemOf[i], 0.1) + lift, y = yTop + (hem - yTop) * (j / RM);
      const [w, f, b, zc] = prof(ROBE, y), F = fold(a, y) * shrink * (1 + (jitter && j === RM ? (rr() - 0.5) * 0.03 : 0));
      const s = Math.sin(a), c = Math.cos(a);
      return [w * s * F, y, zc + (c >= 0 ? f : b) * c * F];
    }, (i, j) => [(i / RN) * 3, 1 - j / RM], null);
    finishNormals(g, (i, j, x, y, z) => { const [, , , zc] = prof(ROBE, y); return [x, 0, z - zc]; });
    return g;
  };
  const robe = addSkinned(robeGrid(1, 0, true), robeMat, (x, y) => robeW(x, y), 'ReaperRobe');
  robe.customDepthMaterial = depthMat;
  // A black lining just inside, so tears show darkness rather than the body underneath.
  addSkinned(robeGrid(0.955, 0.035, false), new THREE.MeshStandardMaterial({ color: 0x07070b, roughness: 0.95, side: THREE.DoubleSide }), (x, y) => robeW(x, y), 'ReaperLining').castShadow = false;

  // ======================================================== sleeves
  const armPts = (sd) => [J(sd + 'Arm'), J(sd + 'ForeArm'), J(sd + 'Hand')];
  const SLV = [[0.11, 0.062], [0.20, 0.072], [0.30, 0.082], [0.42, 0.098], [0.52, 0.125], [0.60, 0.15]];
  const slvR = (ax) => {
    for (let k = 0; k < SLV.length - 1; k++) if (ax <= SLV[k + 1][0]) { const t = sstep(SLV[k][0], SLV[k + 1][0], ax); return SLV[k][1] + (SLV[k + 1][1] - SLV[k][1]) * t; }
    return SLV[SLV.length - 1][1];
  };
  for (const [sd, sg] of [['Left', 1], ['Right', -1]]) {
    const [pa, pf, ph] = armPts(sd);
    const axisAt = (ax) => { // point on the arm line at distance ax along X
      const x = ax * sg;
      const [p, q] = Math.abs(pf.x) > Math.abs(x) ? [pa, pf] : [pf, ph];
      const t = (x - p.x) / ((q.x - p.x) || 1);
      return [x, p.y + (q.y - p.y) * t, p.z + (q.z - p.z) * t];
    };
    const SN = 30, SM = 22, r2 = prng(sg > 0 ? 5 : 9), endOf = new Float32Array(SN);
    for (let i = 0; i < SN;) { const w = 2 + Math.floor(r2() * 3), len = 0.005 + Math.pow(r2(), 1.3) * 0.085; for (let j = 0; j < w && i < SN; j++, i++) endOf[i] = 0.592 - len * Math.pow(1 - Math.abs((2 * (j + 0.5)) / w - 1), 0.8); }
    const g = grid(SN, SM, (i, j) => {
      const a = (i / SN) * Math.PI * 2, ax = 0.11 + (endOf[i] - 0.11) * (j / SM), ap = axisAt(ax);
      const k = 1 + 0.07 * sstep(0.25, 0.6, ax) * (0.6 * Math.sin(a * 3 + ax * 9) + 0.4 * Math.sin(a * 5 - ax * 6));
      const r = slvR(ax) * k;
      return [ap[0], ap[1] + Math.cos(a) * r, ap[2] + Math.sin(a) * r * 0.95];
    }, (i, j) => [(i / SN) * 2, 1 - j / SM], null);
    finishNormals(g, (i, j, x, y, z) => { const a = (i / SN) * Math.PI * 2; return [0, Math.cos(a), Math.sin(a)]; });
    const el = pf.x * sg;
    addSkinned(g, cloth(), (x, y) => {
      const ax = Math.abs(x), sh = 1 - sstep(0.1, 0.19, ax), el2 = sstep(el - 0.06, el + 0.06, ax);
      return [['Spine2', sh * 0.5], [sd + 'Shoulder', sh * 0.5], [sd + 'Arm', (1 - sh) * (1 - el2)], [sd + 'ForeArm', (1 - sh) * el2]];
    }, 'ReaperSleeve' + sd).customDepthMaterial = depthMat;
  }

  // ======================================================== wrapped wrists and ankles, bare feet
  for (const [sd, sg] of [['Left', 1], ['Right', -1]]) {
    const [pa, pf, ph] = armPts(sd);
    const wr = prng(31 + sg);
    // Wrist: strips of linen wound round the forearm, one loose end trailing.
    const WN = 18, WM = 10, ax0 = 0.505, ax1 = 0.604;
    const g = grid(WN, WM, (i, j) => {
      const a = (i / WN) * Math.PI * 2, ax = ax0 + (ax1 - ax0) * (j / WM), x = ax * sg;
      const t = (x - pf.x) / ((ph.x - pf.x) || 1), y = pf.y + (ph.y - pf.y) * t, z = pf.z + (ph.z - pf.z) * t;
      const r = 0.034 + 0.003 * Math.sin(j * 2.1 + a * 2) + (j === 0 || j === WM ? -0.002 : 0);
      return [x, y + Math.cos(a) * r, z + Math.sin(a) * r];
    }, (i, j) => [(i / WN) * 1, j / WM], null);
    finishNormals(g, (i) => { const a = (i / WN) * Math.PI * 2; return [0, Math.cos(a), Math.sin(a)]; });
    addSkinned(g, linen, (x) => { const t = sstep(0.5, 0.6, Math.abs(x)); return [[sd + 'ForeArm', 1 - t * 0.6], [sd + 'Hand', t * 0.6]]; }, 'ReaperWrist' + sd);
    // Trailing ribbon.
    const rp = [], ri = [], ruv = [];
    for (let j = 0; j <= 8; j++) {
      const t = j / 8, cx = (0.578 + t * 0.03) * sg, cy = ph.y - 0.02 - t * 0.085, cz = ph.z + 0.02 + Math.sin(t * 3 + sg) * 0.012, hw = 0.008 * (1 - t * 0.5);
      rp.push(cx, cy, cz - hw, cx, cy, cz + hw); ruv.push(0, t, 1, t);
    }
    for (let j = 0; j < 8; j++) { const a = j * 2; ri.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const RB = new THREE.BufferGeometry();
    RB.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); RB.setAttribute('uv', new THREE.Float32BufferAttribute(ruv, 2)); RB.setIndex(ri); RB.computeVertexNormals();
    addSkinned(RB, linen, () => [[sd + 'Hand', 1]], 'ReaperRibbon' + sd);

    // Ankle wrap over the join between the leg and the bare foot.
    const leg = J(sd + 'Leg'), foot = J(sd + 'Foot');
    const AN = 18, AM = 9, y0 = 0.075, y1 = 0.205;
    const ag = grid(AN, AM, (i, j) => {
      const a = (i / AN) * Math.PI * 2, y = y0 + (y1 - y0) * (j / AM), t = (y - foot.y) / ((leg.y - foot.y) || 1);
      const cx = foot.x + (leg.x - foot.x) * clamp(t, 0, 1), cz = foot.z + (leg.z - foot.z) * clamp(t, 0, 1);
      const r = 0.046 + 0.004 * Math.sin(j * 2.3 + a * 2) - (j === 0 || j === AM ? 0.003 : 0);
      return [cx + Math.sin(a) * r, y, cz + Math.cos(a) * r * 1.05];
    }, (i, j) => [(i / AN), j / AM], null);
    finishNormals(ag, (i) => { const a = (i / AN) * Math.PI * 2; return [Math.sin(a), 0, Math.cos(a)]; });
    addSkinned(ag, linen, (x, y) => [[sd + 'Leg', sstep(0.07, 0.2, y) * 0.6], [sd + 'Foot', 1 - sstep(0.07, 0.2, y) * 0.6]], 'ReaperAnkle' + sd);
  }

  // ======================================================== belt: twisted rope, knot, hanging ends, chain
  const waistY = 1.015;
  const beltPts = [];
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2, [w, f, b, zc] = prof(ROBE, waistY + 0.012 * Math.sin(a * 2));
    const s = Math.sin(a), c = Math.cos(a), e = 0.014;
    beltPts.push(V((w + e) * s, waistY - 0.012 * c, zc + (c >= 0 ? f + e : b + e) * c));
  }
  const beltG = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(beltPts, true), 120, 0.0125, 8, true);
  beltG.setAttribute('uv', new THREE.Float32BufferAttribute(Array.from(beltG.attributes.uv.array, (v, i) => (i % 2 ? v : v * 24)), 2));
  const knotAt = V(0.14, waistY - 0.022, 0.118);
  const parts = [beltG];
  const ends = [[[0.0, -0.02, 0.012], [0.01, -0.12, 0.018], [0.005, -0.25, 0.026], [0.016, -0.40, 0.03]], [[0.02, -0.02, 0.01], [0.045, -0.10, 0.02], [0.055, -0.19, 0.03], [0.04, -0.30, 0.034]]];
  for (const e of ends) {
    const pts = e.map((p) => knotAt.clone().add(V(...p)));
    const cg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.0095, 6, false);
    const pos = cg.attributes.position, nn = 7;
    for (let i = 0; i < pos.count; i++) { // taper and fray the tip
      const seg = Math.floor(i / nn), t = seg / 16, c = new THREE.CatmullRomCurve3(pts).getPointAt(Math.min(1, t));
      const k = 1 - 0.55 * sstep(0.7, 1, t);
      pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * k, c.y + (pos.getY(i) - c.y) * k, c.z + (pos.getZ(i) - c.z) * k);
    }
    cg.setAttribute('uv', new THREE.Float32BufferAttribute(Array.from(cg.attributes.uv.array, (v, i) => (i % 2 ? v : v * 5)), 2));
    parts.push(cg);
  }
  parts.push(new THREE.SphereGeometry(0.022, 10, 8).scale(1.2, 1, 0.9).translate(knotAt.x, knotAt.y, knotAt.z));
  const flatten = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); return n; };
  const beltAll = mergeGeos(parts.map(flatten));
  beltAll.userData.nu = 0; beltAll.userData.nv = 0;
  addSkinned(beltAll, rope, (x, y) => robeW(x, y), 'ReaperBelt');

  // Iron chain on the right hip, ending in a ring.
  const cp = [], cx = -0.17, cz = 0.075;
  const chainParts = [];
  for (let k = 0; k < 11; k++) {
    const t = k / 10, y = waistY - 0.03 - t * 0.27;
    const link = new THREE.TorusGeometry(0.0105, 0.0026, 5, 10).scale(1, 1.55, 1);
    if (k % 2) link.rotateY(Math.PI / 2);
    link.translate(cx - 0.006 * Math.sin(t * 2), y, cz + 0.045 * t * t + Math.sin(t * 2.6) * 0.004);
    chainParts.push(link);
  }
  chainParts.push(new THREE.TorusGeometry(0.026, 0.0045, 7, 20).rotateY(Math.PI / 2).translate(cx - 0.012, waistY - 0.32, cz + 0.05));
  chainParts.push(new THREE.TorusGeometry(0.012, 0.0032, 6, 12).translate(cx, waistY - 0.01, cz - 0.004));
  const chainG = mergeGeos(chainParts.map(flatten)); chainG.userData.nu = 0; chainG.userData.nv = 0;
  addSkinned(chainG, iron, (x, y) => robeW(x, y), 'ReaperChain');
  void cp;

  // ======================================================== the hood
  // Rigid on the head: an outer cowl that droops over the shoulders, a deep opening and a rolled rim.
  const HOOD = [ // y, half width, front depth, back depth, centre z
    [1.86, 0.004, 0.012, 0.012, -0.130], [1.83, 0.032, 0.042, 0.082, -0.090], [1.79, 0.078, 0.085, 0.145, -0.050],
    [1.73, 0.114, 0.128, 0.188, -0.020], [1.68, 0.134, 0.158, 0.200, 0.000], [1.60, 0.138, 0.152, 0.186, 0.005],
    [1.52, 0.126, 0.124, 0.150, 0.000], [1.45, 0.130, 0.106, 0.122, 0.003], [1.38, 0.178, 0.118, 0.126, 0.0],
    [1.30, 0.215, 0.130, 0.140, 0.0],
  ];
  const HN = 84, HM = 50, hr = prng(77), botOf = new Float32Array(HN);
  for (let i = 0; i < HN;) { const w = 3 + Math.floor(hr() * 5), len = 0.004 + hr() * 0.05; for (let j = 0; j < w && i < HN; j++, i++) botOf[i] = 1.31 - len * Math.pow(1 - Math.abs((2 * (j + 0.5)) / w - 1), 0.8); }
  const OPEN = { a: 0.98, yc: 1.585, ya: 0.135 }; // opening: half-angle (rad), centre height, half height
  const hoodPt = (phi, y, push = 0) => {
    const [w, f, b, zc] = prof(HOOD, y), fo = 1 + 0.02 * Math.sin(phi * 5 + y * 8) * (1 - sstep(1.45, 1.75, y)) + 0.05 * sstep(1.45, 1.3, y) * Math.sin(phi * 4 + 1);
    const s = Math.sin(phi), c = Math.cos(phi);
    return [(w * fo + push) * s, y, zc + ((c >= 0 ? f : b) * fo + push) * c];
  };
  const dphi = (i) => { const p = (i / HN) * Math.PI * 2; return p > Math.PI ? p - Math.PI * 2 : p; };
  const inOpen = (i, j) => {
    const y = 1.86 + (botOf[i] - 1.86) * ((j + 0.5) / HM), d = (dphi(i + 0.5) / OPEN.a) ** 2 + ((y - OPEN.yc) / OPEN.ya) ** 2;
    return d < 1;
  };
  const hoodG = grid(HN, HM, (i, j) => {
    const phi = (i / HN) * Math.PI * 2, y = 1.86 + (botOf[i] - 1.86) * (j / HM);
    return hoodPt(phi, y);
  }, (i, j) => [(i / HN) * 2, 1 - j / HM], inOpen);
  finishNormals(hoodG, (i, j, x, y, z) => { const [, , , zc] = prof(HOOD, y); return [x, 0.15, z - zc]; });
  addRigid(hoodG, hoodMat, 'Head', 'ReaperHood').customDepthMaterial = depthMat;
  // Rolled rim around the opening.
  const rimPts = [];
  for (let k = 0; k < 64; k++) {
    const t = (k / 64) * Math.PI * 2, phi = OPEN.a * Math.cos(t), y = OPEN.yc + OPEN.ya * Math.sin(t);
    const p = hoodPt(phi, y, 0.004); rimPts.push(V(p[0], p[1], p[2]));
  }
  const rimG = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), 128, 0.0075, 8, true);
  rimG.setAttribute('uv', new THREE.Float32BufferAttribute(Array.from(rimG.attributes.uv.array, (v, i) => (i % 2 ? v * 0.5 + 0.4 : v * 8)), 2));
  addRigid(rimG, cloth({ alphaTest: 0 }), 'Head', 'ReaperRim');

  // ---- two cold lights in the dark of the hood ----
  const glowTex = (() => {
    const c = canvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(190,210,255,0.95)'); gr.addColorStop(0.5, 'rgba(110,130,255,0.28)'); gr.addColorStop(1, 'rgba(60,70,200,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return tex(c, { repeat: false });
  })();
  const eyeMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0xcfdcff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.PlaneGeometry(0.06, 0.036);
    e.rotateZ(-sx * 0.16); e.translate(sx * 0.034, 1.553, 0.113);
    const m = addRigid(e, eyeMat, 'Head', 'ReaperEye'); m.castShadow = false; m.renderOrder = 4; eyes.push(m);
  }
  const halo = new THREE.PlaneGeometry(0.2, 0.1); halo.translate(0, 1.553, 0.108);
  const haloM = addRigid(halo, new THREE.MeshBasicMaterial({ map: glowTex, color: 0x6070e0, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }), 'Head', 'ReaperHalo');
  haloM.castShadow = false; haloM.renderOrder = 3;

  buildMist(scene, { S, L, hip: byKey.get('Hips').getWorldPosition(V(0, 0, 0)) });
}

function mergeGeos(list) {
  let nv = 0; for (const g of list) nv += g.attributes.position.count;
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

// ---------------------------------------------------------------- cold mist around her
// Two point clouds sharing one set of uniforms: dark navy smoke that actually dims what is behind it,
// and a few pale blue-violet wisps that glow. rig.userData.aura drives both (see animateAura in gear.js).
function buildMist(rig, { S, hip }) {
  const N = 150, seed = new Float32Array(N), z3 = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) seed[i] = Math.random();
  const uniforms = { uT: { value: 0 }, uS: { value: S / 1.0 }, uI: { value: 1 } };
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(z3, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const vs = `attribute float seed; uniform float uT, uS; varying float vA; varying float vK;
    void main(){ float t = fract(uT*0.12 + seed*7.0); float a = seed*40.0 + uT*(0.25+seed*0.5);
      float r = (0.20 + 0.32*seed + t*0.22)*uS;
      vec3 p = vec3(cos(a)*r, (t*1.55 - 0.02)*uS, sin(a)*r*0.85);
      vA = sin(t*3.14159); vK = seed;
      vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv;
      gl_PointSize = (seed < 0.7 ? 30.0 : 8.0) * uS * (0.8 + seed) / -mv.z * 6.0; }`;
  const dark = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms,
    vertexShader: vs,
    fragmentShader: `varying float vA; varying float vK; uniform float uI;
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5 || vK > 0.7) discard;
        float soft = pow(max(0.0, 1.0 - d*2.0), 1.5);
        gl_FragColor = vec4(vec3(0.015,0.02,0.05), soft * vA * 0.42 * min(uI, 1.4)); }`,
  });
  const wisp = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms,
    vertexShader: vs,
    fragmentShader: `varying float vA; varying float vK; uniform float uI;
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5 || vK <= 0.7) discard;
        float soft = pow(max(0.0, 1.0 - d*2.0), 2.4);
        gl_FragColor = vec4(vec3(0.38,0.5,1.0) * uI, soft * vA * 0.75); }`,
  });
  const a = new THREE.Points(geo, wisp), b = new THREE.Points(geo, dark);
  for (const p of [a, b]) { p.frustumCulled = false; p.position.set(hip.x, 0, hip.z); rig.add(p); }
  a.name = 'aura'; b.name = 'auraMist'; b.renderOrder = 1;
  rig.userData.aura = wisp;
}

// ---------------------------------------------------------------- the scythe
// Local frame: the shaft runs along +Z with the right hand at the origin; the blade sticks out along
// +X from the top and hooks back toward the butt. `support` is where the left hand goes.
export function makeReaperScythe() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), color: 0xffffff, roughness: 0.6, metalness: 0 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x1b1412, roughness: 0.85 });
  const steel = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, metalness: 0.6, roughness: 0.32, emissive: 0x141c30, emissiveIntensity: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2d36, metalness: 0.85, roughness: 0.4 });

  // Shaft: a gently curved snath, thicker toward the middle, along z in [-0.9, 1.0].
  const curve = new THREE.CatmullRomCurve3([V(0.0, 0, -0.9), V(0.012, 0.004, -0.46), V(0.0, 0, 0.0), V(-0.016, -0.004, 0.5), V(-0.008, 0, 1.0)]);
  const N = 60, seg = 10, pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, c = curve.getPointAt(t), tg = curve.getTangentAt(t);
    const side = V(1, 0, 0).sub(tg.clone().multiplyScalar(tg.x)).normalize(), up = new THREE.Vector3().crossVectors(tg, side).normalize();
    const r = 0.0165 + 0.003 * Math.sin(t * Math.PI) - 0.002 * t;
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      pos.push(c.x + (side.x * Math.cos(a) + up.x * Math.sin(a)) * r, c.y + (side.y * Math.cos(a) + up.y * Math.sin(a)) * r, c.z + (side.z * Math.cos(a) + up.z * Math.sin(a)) * r);
      uv.push(k / seg, t * 3);
    }
  }
  for (let i = 0; i < N; i++) for (let k = 0; k < seg; k++) { const a = i * (seg + 1) + k, b = a + 1, c = a + seg + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); sg.setIndex(idx); sg.computeVertexNormals();
  g.add(new THREE.Mesh(sg, wood));
  // Leather wraps at both grips, an iron ferrule at the butt and an iron socket collar at the head.
  for (const [z0, z1] of [[-0.09, 0.09], [0.37, 0.53]]) {
    const w = new THREE.CylinderGeometry(0.0215, 0.0215, z1 - z0, 14, 1, true).rotateX(Math.PI / 2).translate(0.002 - (z0 + z1) * 0.014, 0, (z0 + z1) / 2);
    g.add(new THREE.Mesh(w, leather));
    for (let k = 0; k < 6; k++) g.add(new THREE.Mesh(new THREE.TorusGeometry(0.0218, 0.0022, 5, 14).translate(0.002 - (z0 + z1) * 0.014, 0, 0).translate(0, 0, z0 + (k + 0.5) * (z1 - z0) / 6), leather));
  }
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.1, 10).rotateX(-Math.PI / 2).translate(0, 0, -0.95), dark));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.0235, 0.021, 0.07, 12).rotateX(Math.PI / 2).translate(0.0, 0, -0.865), dark));
  const top = curve.getPointAt(1);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.0235, 0.09, 14).rotateX(Math.PI / 2).translate(top.x, 0, 0.96), dark));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.027, 0.005, 6, 16).translate(top.x, 0, 0.92), dark));

  // Blade: a long crescent in the X-Z plane. Outer (back) and inner (cutting) edges are cubic curves that meet at the tip.
  const ox = top.x, B0 = V(ox, 0, 1.0);
  const outer = new THREE.CubicBezierCurve(new THREE.Vector2(0.02, 1.045), new THREE.Vector2(0.42, 1.24), new THREE.Vector2(0.88, 1.18), new THREE.Vector2(1.06, 0.74));
  const inner = new THREE.CubicBezierCurve(new THREE.Vector2(1.06, 0.74), new THREE.Vector2(0.84, 1.04), new THREE.Vector2(0.40, 1.07), new THREE.Vector2(0.02, 0.94));
  const sh = new THREE.Shape();
  sh.moveTo(0.02, 1.045);
  for (const p of outer.getPoints(40).slice(1)) sh.lineTo(p.x, p.y);
  for (const p of inner.getPoints(40).slice(1)) sh.lineTo(p.x, p.y);
  sh.lineTo(0.02, 1.045);
  const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.0025, bevelSize: 0.003, bevelSegments: 2, curveSegments: 4 });
  bg.translate(0, 0, -0.003);
  // shape (x, y) -> blade (x, z); extrusion axis -> local y
  bg.rotateX(Math.PI / 2); bg.translate(ox, 0, 0);
  { // honed bright along the inner edge, dark and bluish along the spine
    const p = bg.attributes.position, colA = new Float32Array(p.count * 3), zi = [], zo = [];
    const so = outer.getPoints(80), si = inner.getPoints(80);
    const look = (pts, x) => { let best = pts[0].y, bd = 9; for (const q of pts) { const d = Math.abs(q.x - x); if (d < bd) { bd = d; best = q.y; } } return best; };
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) - ox, z = p.getZ(i), yo = look(so, x), yi = look(si, x);
      const f = clamp((z - yi) / Math.max(0.012, yo - yi), 0, 1); // 0 at the cutting edge, 1 at the spine
      const bright = 0.22 + 0.78 * Math.pow(1 - f, 2.2);
      const c = new THREE.Color().setRGB(0.6 * bright + 0.16, 0.66 * bright + 0.18, 0.78 * bright + 0.22);
      colA[i * 3] = c.r; colA[i * 3 + 1] = c.g; colA[i * 3 + 2] = c.b;
    }
    bg.setAttribute('color', new THREE.BufferAttribute(colA, 3));
    void zi; void zo;
  }
  g.add(new THREE.Mesh(bg, steel));
  // Spine ridge along the back, a heel plate where the blade meets the socket and a few rivets.
  const spinePts = outer.getPoints(32).map((p) => V(p.x + ox, 0, p.y + 0.002));
  const spineG = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spinePts), 48, 0.0065, 6, false);
  { const pp = spineG.attributes.position, sc = new THREE.CatmullRomCurve3(spinePts); for (let i = 0; i < pp.count; i++) { const s = Math.floor(i / 7) / 48, c = sc.getPointAt(Math.min(1, s)), k = 1 - 0.75 * sstep(0.35, 1, s); pp.setXYZ(i, c.x + (pp.getX(i) - c.x) * k, c.y + (pp.getY(i) - c.y) * k, c.z + (pp.getZ(i) - c.z) * k); } }
  g.add(new THREE.Mesh(spineG, dark));
  const plate = new THREE.BoxGeometry(0.15, 0.012, 0.1).translate(ox + 0.07, 0, 0.99);
  g.add(new THREE.Mesh(plate, dark));
  for (const x of [0.05, 0.1, 0.15]) g.add(new THREE.Mesh(new THREE.SphereGeometry(0.0075, 8, 6).translate(ox + x, 0.008, 0.995), steel));
  // A faint cold gleam along the cutting edge.
  const edgePts = inner.getPoints(40).map((p) => V(p.x + ox, 0, p.y - 0.001));
  const gleam = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edgePts), 60, 0.0028, 5, false), new THREE.MeshBasicMaterial({ color: 0x9fb8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  gleam.name = 'scytheGleam'; g.add(gleam);

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = {
    id: 'reaperScythe', kind: 'melee', twoHanded: true, reaper: true,
    muzzle: V(0.8, 0, 0.95), support: V(0, 0, 0.45),
  };
  return g;
}
