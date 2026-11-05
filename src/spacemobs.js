// New space monsters for Crash Site Prime (Nutty 2026-11-05: "huge blobs with faces on them, or something the game has never
// seen before"). Built from primitives but dressed to read as flesh, jelly, chitin and glass rather than clay: wet physical
// materials, procedural pore/vein normal maps, transmission for the jellies, glowing throats and lures.
// makeSpaceMonster(kind) returns a root Group with userData.anim(st, dt, t) like models.js makeMob; userData.h is its height.
import * as THREE from 'three';
import { mulberry32 } from './rng.js';

const V = (...a) => new THREE.Vector3(...a);
const cache = {};
const tex = (key, fn) => cache[key] || (cache[key] = fn());

// A tiling normal map of soft bumps and pores (cells of noise), and a matching roughness map (wet in the hollows).
function skinMaps(seed, cells = 18, depth = 1) {
  return tex('skin' + seed + cells, () => {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), r = mulberry32(seed), pts = [];
    for (let i = 0; i < cells * cells; i++) pts.push([r() * S, r() * S, 0.5 + r() * 0.8]);
    const h = new Float32Array(S * S);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      let best = 1e9, acc = 0;
      for (const [px, py, k] of pts) { let dx = Math.abs(i - px), dy = Math.abs(j - py); dx = Math.min(dx, S - dx); dy = Math.min(dy, S - dy); const d = Math.hypot(dx, dy) / (S / cells) / k; best = Math.min(best, d); acc += Math.exp(-d * d * 2.5); }
      h[j * S + i] = Math.min(1, acc * 0.6) * 0.7 + (1 - Math.min(1, best)) * 0.3;
    }
    const id = x.createImageData(S, S), d = id.data, rg = x.createImageData(S, S), rd = rg.data;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const hx = (h[j * S + ((i + 1) % S)] - h[j * S + ((i - 1 + S) % S)]) * depth * 2.2, hy = (h[((j + 1) % S) * S + i] - h[((j - 1 + S) % S) * S + i]) * depth * 2.2;
      const n = V(-hx, -hy, 1).normalize(), o = (j * S + i) * 4;
      d[o] = (n.x * 0.5 + 0.5) * 255; d[o + 1] = (n.y * 0.5 + 0.5) * 255; d[o + 2] = (n.z * 0.5 + 0.5) * 255; d[o + 3] = 255;
      const rough = 0.25 + (1 - h[j * S + i]) * 0.5; rd[o] = rd[o + 1] = rd[o + 2] = rough * 255; rd[o + 3] = 255;
    }
    x.putImageData(id, 0, 0); const nm = new THREE.CanvasTexture(c); nm.wrapS = nm.wrapT = THREE.RepeatWrapping;
    const c2 = document.createElement('canvas'); c2.width = c2.height = S; c2.getContext('2d').putImageData(rg, 0, 0);
    const rm = new THREE.CanvasTexture(c2); rm.wrapS = rm.wrapT = THREE.RepeatWrapping;
    return { normalMap: nm, roughnessMap: rm };
  });
}
// Veins: dark branching lines on a tinted base; used as a colour map on jelly and eyes.
function veinMap(seed, base, vein, n = 70) {
  return tex('vein' + seed + base, () => {
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), r = mulberry32(seed);
    x.fillStyle = base; x.fillRect(0, 0, S, S);
    x.strokeStyle = vein; x.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      let px = r() * S, py = r() * S, a = r() * 6.28, wdt = 1.5 + r() * 2.5;
      for (let k = 0; k < 14; k++) { x.lineWidth = wdt * (1 - k / 16); x.beginPath(); x.moveTo(px, py); a += (r() - 0.5) * 1.1; px += Math.cos(a) * 14; py += Math.sin(a) * 14; x.lineTo(px, py); x.stroke(); }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  });
}
// An eye: veined sclera, iris with radial fibres, dark pupil.
function eyeMap(seed, iris) {
  return tex('eye' + seed + iris, () => {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), r = mulberry32(seed);
    x.fillStyle = '#e8e2dc'; x.fillRect(0, 0, S, S);
    x.strokeStyle = 'rgba(190,40,40,0.55)';
    for (let i = 0; i < 40; i++) { let px = r() * S, py = r() * S, a = r() * 6.28; for (let k = 0; k < 8; k++) { x.lineWidth = 1.6 * (1 - k / 9); x.beginPath(); x.moveTo(px, py); a += (r() - 0.5) * 1.2; px += Math.cos(a) * 9; py += Math.sin(a) * 9; x.lineTo(px, py); x.stroke(); } }
    // The iris sits on the +u side (u = 0.75) so the pupil faces +x in the sphere's UV layout.
    const cx = S * 0.75, cy = S * 0.5, R = S * 0.17;
    const g = x.createRadialGradient(cx, cy, R * 0.3, cx, cy, R); g.addColorStop(0, iris); g.addColorStop(0.85, iris); g.addColorStop(1, '#1a1008');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, 6.3); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 1;
    for (let i = 0; i < 48; i++) { const a = (i / 48) * 6.28; x.beginPath(); x.moveTo(cx + Math.cos(a) * R * 0.35, cy + Math.sin(a) * R * 0.35); x.lineTo(cx + Math.cos(a + 0.1) * R * 0.95, cy + Math.sin(a + 0.1) * R * 0.95); x.stroke(); }
    x.fillStyle = '#050305'; x.beginPath(); x.arc(cx, cy, R * 0.38, 0, 6.3); x.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  });
}

// Photo-scanned skins (the Poly Haven CC0 scans the ground uses) tinted into alien colours: real pores, cracks and
// pits in the normal map instead of smooth clay. ids with _a/_n use groundTex; the others are the _m character surfaces.
const scanLoader = new THREE.TextureLoader();
function scanTex(file, srgb, rep) {
  const t = scanLoader.load('assets/scan/' + file); t.flipY = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; t.repeat.set(rep, rep);
  return t;
}
const GROUND_IDS = new Set(['aerial_sand', 'brown_mud_leaves_01', 'burned_ground_01', 'dark_rock_02', 'dark_rock', 'forest_ground_04', 'forest_leaves_02', 'gravel_ground_01', 'leafy_grass', 'mossy_rock', 'mud_cracked_dry_03', 'mud_forest', 'rock_face', 'rocky_terrain_02', 'snow_02']);
function scanSkin(id, { tint = [1, 1, 1], rough = 0.5, bump = 1.0, rep = 2, clearcoat = 0.5, ccRough = 0.25, metal = 0, emissive = 0x000000, ei = 0, sheen = 0.25, sheenColor = 0xffffff, extra = {} } = {}) {
  return tex('skin:' + id + tint.join(',') + rep + rough + clearcoat + JSON.stringify(extra), () => {
    const opts = { color: new THREE.Color(tint[0], tint[1], tint[2]), roughness: rough, metalness: metal, clearcoat, clearcoatRoughness: ccRough, emissive, emissiveIntensity: ei, sheen, sheenRoughness: 0.6, sheenColor: new THREE.Color(sheenColor), ...extra };
    if (GROUND_IDS.has(id)) {
      opts.map = scanTex(id + '_a.webp', true, rep); opts.normalMap = scanTex(id + '_n.webp', false, rep); opts.normalScale = new THREE.Vector2(bump, bump);
    } else {
      const t = scanTex(id + '_m.webp', true, rep);
      opts.map = t; opts.bumpMap = t; opts.bumpScale = bump * 0.35;
    }
    return new THREE.MeshPhysicalMaterial(opts);
  });
}
// Cracked wet hide, smooth leather hide, charred plate, pitted shell, mottled stone-skin.
const wetSkin = (color, seed, { rough = 0.45, bump = 0.6 } = {}) => { const c = new THREE.Color(color); return scanSkin('brown_leather', { tint: [c.r * 2.2, c.g * 2.2, c.b * 2.2], rough, bump: bump + 0.4, rep: 2.5, clearcoat: 0.6, ccRough: 0.2 }); };
const crackSkin = (color, rep = 2) => { const c = new THREE.Color(color); return scanSkin('mud_cracked_dry_03', { tint: [c.r * 1.6, c.g * 1.6, c.b * 1.6], rough: 0.42, bump: 1.4, rep, clearcoat: 0.7, ccRough: 0.18 }); };
const chitin = (color, seed) => { const c = new THREE.Color(color); return scanSkin('burned_ground_01', { tint: [c.r * 1.8 + 0.08, c.g * 1.8 + 0.08, c.b * 1.8 + 0.08], rough: 0.32, bump: 1.2, rep: 1.5, clearcoat: 1, ccRough: 0.1, metal: 0.15, sheen: 0 }); };
const shellSkin = (color) => { const c = new THREE.Color(color); return scanSkin('rusty_metal_04', { tint: [c.r * 1.5 + 0.05, c.g * 1.5 + 0.05, c.b * 1.5 + 0.05], rough: 0.3, bump: 1.4, rep: 2, clearcoat: 1, ccRough: 0.08, metal: 0.35, sheen: 0 }); };
const mottleSkin = (color, rep = 1.5) => { const c = new THREE.Color(color); return scanSkin('mossy_rock', { tint: [c.r * 1.7, c.g * 1.7, c.b * 1.7], rough: 0.5, bump: 1.0, rep, clearcoat: 0.5, ccRough: 0.3 }); };
const glow = (color, i = 2.5) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.4, toneMapped: false });
const eyeMat = (seed, iris) => new THREE.MeshPhysicalMaterial({ map: eyeMap(seed, iris), roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02, ior: 1.5 });

// Lumpy organic geometry: a dense sphere pushed in and out by smooth low-frequency noise, so the surface rolls and
// sags like flesh instead of showing facets. jit = total relief as a fraction of the radius.
function snoise(x, y, z, o) {
  return (Math.sin(x * 1.9 + o) * Math.cos(y * 1.5 - o * 0.7) + Math.sin(y * 2.3 + z * 1.1 + o * 1.3) * 0.8 + Math.cos(z * 2.7 - x * 1.4 + o * 0.4) * 0.7
    + Math.sin(x * 4.1 + y * 3.3 + o) * 0.25 + Math.cos(z * 4.7 + x * 2.9 - o) * 0.22) / 2.97;
}
function blobGeo(r, detail, jit, seed, sx = 1, sy = 1, sz = 1) {
  const seg = detail >= 4 ? 80 : detail >= 3 ? 48 : 28;
  const g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)), p = g.attributes.position, o = seed * 0.77;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / r, y = p.getY(i) / r, z = p.getZ(i) / r;
    const n = snoise(x * 1.6, y * 1.6, z * 1.6, o) * jit + snoise(x * 4, y * 4, z * 4, o + 9) * jit * 0.3;
    const s = 1 + n; p.setXYZ(i, x * r * s * sx, y * r * s * sy, z * r * s * sz);
  }
  g.computeVertexNormals(); return g;
}
const mesh = (geo, mat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; return m; };
// An eye with a pupil facing `dir`.
function eye(r, seed, iris, dir) { const e = mesh(new THREE.SphereGeometry(r, 32, 24), eyeMat(seed, iris)); e.lookAt(dir.clone()); e.rotateY(Math.PI); return e; }
// A ring of teeth round a mouth of radius R, pointing inward.
function teeth(R, n, len, mat, inward = 1) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, t = mesh(new THREE.ConeGeometry(len * 0.22, len, 12), mat); t.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); t.rotation.z = a + Math.PI / 2 * inward; t.rotation.x = 0; g.add(t); }
  return g;
}
// A mouth: dark lips, black throat, a glowing gullet, two rings of teeth.
function mouth(R, lipMat, throatColor, toothMat) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.TorusGeometry(R, R * 0.3, 24, 48), lipMat));
  const throat = mesh(new THREE.CylinderGeometry(R * 0.85, R * 0.2, R * 1.6, 20, 1, true).rotateX(Math.PI / 2).translate(0, 0, -R * 0.8), new THREE.MeshStandardMaterial({ color: 0x0a0406, roughness: 0.9, side: THREE.BackSide }));
  g.add(throat);
  const gl = mesh(new THREE.CircleGeometry(R * 0.4, 16).translate(0, 0, -R * 1.4), glow(throatColor, 3)); g.add(gl);
  g.add(teeth(R * 0.78, Math.round(R * 14), R * 0.42, toothMat));
  const t2 = teeth(R * 0.6, Math.round(R * 9), R * 0.3, toothMat); t2.position.z = -R * 0.35; t2.rotation.z = 0.3; g.add(t2);
  return g;
}
const bone = new THREE.MeshPhysicalMaterial({ color: 0xe8dcc0, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15, sheen: 0.4, sheenColor: new THREE.Color(0xfff2d0) });

export const SPACE_MONSTERS = {
  // 1. Gorgle: a huge translucent jelly with three faces pressing out of it and organs glowing inside.
  gorgle: { name: 'Gorgle', h: 4.2 },
  // 2. Maw Cluster: a floating knot of flesh that is all mouths, tentacles trailing below.
  mawcluster: { name: 'Maw Cluster', h: 4.6, float: 1.2 },
  // 3. Star Leech: a segmented worm rearing up, chitin plates, glowing seams, a funnel of teeth.
  starleech: { name: 'Star Leech', h: 5.0 },
  // 4. Eye Tyrant: one great eye with a crown of eyestalks, floating on a fringe of feelers.
  eyetyrant: { name: 'Eye Tyrant', h: 4.4, float: 1.6 },
  // 5. Void Strider: a glassy black stilt-walker with a split jaw and a lure that lights the way.
  voidstrider: { name: 'Void Strider', h: 5.6 },
};

export function makeSpaceMonster(kind) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const def = SPACE_MONSTERS[kind]; root.userData.h = def.h;
  const parts = {}; let animFn = () => {};
  if (kind === 'gorgle') {
    const jelly = new THREE.MeshPhysicalMaterial({ color: 0x5fd8c8, map: veinMap(3, '#79e0d2', 'rgba(40,90,140,0.55)', 50), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08, transparent: true, opacity: 0.86, depthWrite: true, side: THREE.DoubleSide, normalMap: scanTex('mossy_rock_n.webp', false, 1.5), normalScale: new THREE.Vector2(0.35, 0.35) });
    const blob = mesh(blobGeo(1.9, 4, 0.25, 11, 1.15, 0.95, 1.1), jelly); blob.position.y = 1.9; body.add(blob); parts.blob = blob;
    // Organs and bubbles glowing deep inside.
    const organs = new THREE.Group();
    for (let i = 0; i < 7; i++) { const o = mesh(new THREE.SphereGeometry(0.18 + (i % 3) * 0.12, 10, 8), glow(i % 2 ? 0xff6ad0 : 0x9affd8, 1.8), false); o.position.set(Math.sin(i * 2.1) * 0.9, 1.3 + (i % 4) * 0.4, Math.cos(i * 1.7) * 0.8); organs.add(o); }
    body.add(organs); parts.organs = organs;
    // Three faces, pressing out of the jelly: eyes that bulge through the skin, a mouth each.
    const faces = new THREE.Group(), fleshy = wetSkin(0x8fe0cf, 21, { rough: 0.25, bump: 0.5 }), tooth = bone;
    [[0, 0.1], [2.2, -0.15], [4.3, 0.2]].forEach(([a, tilt], i) => {
      const f = new THREE.Group(), dir = V(Math.sin(a), tilt, Math.cos(a));
      f.position.copy(dir).multiplyScalar(2.05).add(V(0, 1.9 + tilt * 1.2, 0)); f.lookAt(f.position.clone().add(dir));
      const eL = eye(0.34, 5 + i, '#2a7a40', V(0, 0, 1)); eL.position.set(-0.42, 0.34, 0.3); f.add(eL);
      const eR = eye(0.3, 9 + i, '#2a7a40', V(0, 0, 1)); eR.position.set(0.44, 0.3, 0.34); f.add(eR);
      const brow = mesh(blobGeo(0.5, 2, 0.3, 31 + i, 1.6, 0.5, 0.6), fleshy); brow.position.set(0, 0.72, 0.3); f.add(brow);
      const m = mouth(0.42, wetSkin(0x3a8a80, 40 + i, { rough: 0.2 }), 0x2aff9a, tooth); m.position.set(0, -0.42, 0.4); m.rotation.y = Math.PI; f.add(m);
      faces.add(f);
    });
    body.add(faces); parts.faces = faces;
    // Puddle of slime it sits in.
    const slime = mesh(new THREE.CircleGeometry(2.6, 24).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x4fc8b8, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.55 }), false); slime.position.y = 0.03; body.add(slime);
    animFn = (st, dt, t) => {
      const w = Math.sin(t * 2.4 + st.phase) * 0.06, w2 = Math.sin(t * 3.1 + st.phase + 1) * 0.04;
      blob.scale.set(1 + w, 1 - w - w2 + (st.speed > 0.3 ? Math.abs(Math.sin(t * 6)) * 0.08 : 0), 1 + w2);
      organs.rotation.y = t * 0.3; faces.rotation.y = Math.sin(t * 0.5) * 0.15;
      faces.children.forEach((f, i) => { f.scale.setScalar(1 + Math.sin(t * 1.7 + i) * 0.06 + st.attack * 0.25); });
    };
  } else if (kind === 'mawcluster') {
    const flesh = crackSkin(0x6a2448, 2.2), lip = wetSkin(0x8a1c2c, 8, { rough: 0.2 }), tooth = bone;
    const core = mesh(blobGeo(1.5, 4, 0.35, 17, 1.2, 1, 1.1), flesh); core.position.y = 2.4; body.add(core);
    const mouths = new THREE.Group(); mouths.position.y = 2.4;
    const dirs = [V(1, 0.2, 0.3), V(-0.8, 0.5, 0.6), V(0.2, -0.3, 1), V(-0.5, -0.1, -0.9), V(0.6, 0.9, -0.4), V(-0.9, -0.6, 0.1), V(0.1, 1, 0.2)];
    dirs.forEach((d, i) => { d.normalize(); const m = mouth(0.42 + (i % 3) * 0.12, lip, i % 2 ? 0xff5a2a : 0xffb030, tooth); m.position.copy(d).multiplyScalar(1.55); m.lookAt(d.clone().multiplyScalar(4)); mouths.add(m); });
    body.add(mouths); parts.mouths = mouths;
    // Hanging tentacles.
    const tents = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, pts = []; for (let k = 0; k <= 6; k++) pts.push(V(Math.cos(a) * (0.6 + k * 0.08) + Math.sin(k * 1.3 + i) * 0.12, 1.4 - k * 0.42, Math.sin(a) * (0.6 + k * 0.08)));
      const tube = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.13, 12), flesh); tube.userData.a = a; tents.add(tube);
      const tip = mesh(new THREE.SphereGeometry(0.1, 8, 6), glow(0xff7a30, 2)); tip.position.copy(pts[6]); tents.add(tip);
    }
    body.add(tents);
    animFn = (st, dt, t) => {
      core.rotation.y = t * 0.25; core.scale.setScalar(1 + Math.sin(t * 2.2 + st.phase) * 0.04);
      mouths.rotation.y = t * 0.25;
      mouths.children.forEach((m, i) => { const o = Math.max(0, Math.sin(t * 2.6 + i * 1.9)); m.scale.setScalar(0.85 + o * 0.25 + st.attack * 0.4); });
      tents.rotation.y = -t * 0.12; tents.rotation.z = Math.sin(t * 1.1) * 0.06;
    };
  } else if (kind === 'starleech') {
    const plate = chitin(0x2b3b2a, 12), under = crackSkin(0x9aa884, 3), seam = glow(0x3ae8ff, 2.2);
    const segs = [];
    const N = 10;
    for (let i = 0; i < N; i++) {
      const r = 0.62 - i * 0.03, s = new THREE.Group();
      s.add(mesh(new THREE.SphereGeometry(r, 40, 28).scale(1, 0.9, 1.15), under));
      const p = mesh(new THREE.SphereGeometry(r * 1.06, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1, 0.92, 1.15), plate); s.add(p);
      s.add(mesh(new THREE.TorusGeometry(r * 0.9, 0.05, 6, 20).rotateX(Math.PI / 2), seam, false));
      segs.push(s); body.add(s);
    }
    // The head: a funnel of three jaws lined with teeth, a glowing throat.
    const head = new THREE.Group();
    const skull = mesh(blobGeo(0.75, 3, 0.2, 19, 1, 0.9, 1.1), plate); head.add(skull);
    for (let j = 0; j < 3; j++) {
      const a = (j / 3) * Math.PI * 2, jaw = new THREE.Group();
      jaw.add(mesh(new THREE.ConeGeometry(0.42, 1.1, 8, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 0.55), under));
      for (let k = 0; k < 6; k++) { const th = mesh(new THREE.ConeGeometry(0.05, 0.26, 5), bone); th.position.set((k % 2 ? 0.14 : -0.14), 0.05, 0.25 + k * 0.14); th.rotation.x = -Math.PI / 2 + 0.6; jaw.add(th); }
      jaw.position.set(Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0.5); jaw.rotation.z = a; jaw.userData.a = a; head.add(jaw);
    }
    const throat = mesh(new THREE.CircleGeometry(0.28, 14).translate(0, 0, 0.5), glow(0x3ae8ff, 4), false); head.add(throat);
    for (const sx of [-1, 1]) { const e = eye(0.12, 23, '#ffb030', V(sx * 0.5, 0.3, 1)); e.position.set(sx * 0.45, 0.42, 0.5); head.add(e); }
    body.add(head);
    animFn = (st, dt, t) => {
      // The body snakes along the ground then rears up through the last few segments.
      const sway = Math.sin(t * 2 + st.phase);
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1), rear = Math.pow(u, 1.8), s = segs[N - 1 - i];
        const x = Math.sin(t * 2.4 - i * 0.6 + st.phase) * 0.25 * (1 - rear) + sway * rear * 0.3;
        s.position.set(x, 0.55 + rear * 3.6 + Math.sin(t * 1.5 + i) * 0.05, -(1 - u) * 4.2 + rear * 0.9);
        s.rotation.x = -rear * 1.2 - 0.3 * (1 - rear) * Math.cos(t * 2.4 - i * 0.6);
      }
      const top = segs[0];
      head.position.set(top.position.x, top.position.y + 0.55, top.position.z + 0.45); head.rotation.x = -0.35 + st.attack * 0.6;
      head.children.forEach((c) => { if (c.userData.a != null) { const o = 0.25 + Math.max(0, Math.sin(t * 3)) * 0.35 + st.attack * 0.6; c.rotation.x = -o; } });
    };
  } else if (kind === 'eyetyrant') {
    const skin = mottleSkin(0xa05a8a, 1.2);
    const Eg = new THREE.Group(), E = eye(1.25, 33, '#d04a20', V(0, 0, 1)); Eg.position.y = 2.6; Eg.add(E); body.add(Eg); parts.E = Eg;
    const rim = mesh(new THREE.TorusGeometry(1.2, 0.3, 24, 64).rotateX(Math.PI / 2), skin); rim.position.y = 2.6; rim.scale.y = 1.6; body.add(rim);
    const stalks = new THREE.Group(); stalks.position.y = 2.6;
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2, up = 0.4 + (i % 3) * 0.3, pts = [V(Math.cos(a) * 1.0, 0.6, Math.sin(a) * 1.0)];
      for (let k = 1; k <= 4; k++) pts.push(V(Math.cos(a) * (1.0 + k * 0.42), 0.6 + k * up * 0.45 + Math.sin(k + i) * 0.12, Math.sin(a) * (1.0 + k * 0.42)));
      const tube = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.09, 10), skin); stalks.add(tube);
      const e = eye(0.2, 50 + i, i % 2 ? '#30c0ff' : '#ffc030', V(Math.cos(a), 0.3, Math.sin(a))); e.position.copy(pts[4]); stalks.add(e);
    }
    body.add(stalks);
    const fringe = new THREE.Group(); fringe.position.y = 2.6;
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, pts = []; for (let k = 0; k <= 5; k++) pts.push(V(Math.cos(a) * (0.8 + k * 0.05), -0.9 - k * 0.32, Math.sin(a) * (0.8 + k * 0.05))); const tb = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.06, 8), skin); fringe.add(tb); }
    body.add(fringe);
    animFn = (st, dt, t) => {
      Eg.rotation.set(Math.sin(t * 0.9) * 0.2, Math.sin(t * 1.7 + st.phase) * 0.35 + st.attack * 0.3, 0);
      stalks.rotation.y = Math.sin(t * 0.6) * 0.2; stalks.children.forEach((c, i) => { c.position.y = Math.sin(t * 1.4 + i) * 0.08; });
      fringe.rotation.y = -t * 0.3; fringe.children.forEach((c, i) => { c.rotation.x = Math.sin(t * 1.8 + i) * 0.12; });
    };
  } else if (kind === 'voidstrider') {
    const shell = shellSkin(0x0c0a12), inner = wetSkin(0x3a1a4a, 42, { rough: 0.35 });
    const torso = mesh(blobGeo(0.6, 3, 0.25, 43, 1, 0.8, 1.5), shell); torso.position.y = 4.2; body.add(torso);
    const legs = [];
    for (let i = 0; i < 4; i++) {
      const sx = i % 2 ? 1 : -1, sz = i < 2 ? 1 : -1, leg = new THREE.Group();
      const hip = V(sx * 0.5, 4.2, sz * 0.5), knee = V(sx * 1.9, 5.4, sz * 1.5), foot = V(sx * 2.4, 0, sz * 2.1);
      const up = mesh(new THREE.CylinderGeometry(0.1, 0.16, 1, 7), shell), lo = mesh(new THREE.CylinderGeometry(0.05, 0.1, 1, 7), shell);
      const kneeJ = mesh(new THREE.SphereGeometry(0.2, 10, 8), inner);
      leg.add(up, lo, kneeJ); leg.userData = { hip, knee, foot, up, lo, kneeJ, ph: i * 1.57, rest: foot.clone() };
      legs.push(leg); body.add(leg);
    }
    const head = new THREE.Group(); head.position.set(0, 4.3, 0.9);
    head.add(mesh(blobGeo(0.42, 3, 0.2, 44, 1, 0.9, 1.3), shell));
    for (const sy of [-1, 1]) { const jaw = mesh(new THREE.ConeGeometry(0.2, 0.9, 6).rotateX(Math.PI / 2), inner); jaw.position.set(0, sy * 0.22, 0.6); jaw.userData.sy = sy; head.add(jaw); for (let k = 0; k < 5; k++) { const th = mesh(new THREE.ConeGeometry(0.03, 0.14, 4), bone); th.position.set((k - 2) * 0.07, sy * 0.1, 0.5 + Math.abs(k - 2) * 0.1); th.rotation.x = -sy * Math.PI / 2; jaw.add(th); } }
    const stalk = mesh(new THREE.CylinderGeometry(0.025, 0.04, 1.3, 6).translate(0, 0.65, 0), shell); stalk.position.set(0, 0.3, 0.2); stalk.rotation.x = 0.5; head.add(stalk);
    const lure = mesh(new THREE.SphereGeometry(0.17, 12, 10), glow(0x9affff, 4), false); lure.position.set(0, 1.45, 0.75); head.add(lure);
    const lamp = new THREE.PointLight(0x7af0ff, 12, 12, 1.8); lamp.position.copy(lure.position); head.add(lamp);
    for (const sx of [-1, 1]) { const e = eye(0.09, 60, '#8af0ff', V(sx, 0.2, 1)); e.position.set(sx * 0.26, 0.15, 0.3); head.add(e); }
    body.add(head);
    const _a = V(), _b = V();
    animFn = (st, dt, t) => {
      const walking = st.speed > 0.2 ? 1 : 0;
      torso.position.y = 4.2 + Math.sin(t * 2) * 0.08; torso.rotation.z = Math.sin(t * 1.2) * 0.03;
      head.rotation.set(Math.sin(t * 1.1) * 0.15 + st.attack * 0.4, Math.sin(t * 0.8) * 0.3, 0);
      head.children.forEach((c) => { if (c.userData.sy) c.rotation.x = c.userData.sy * (0.25 + st.attack * 0.9 + Math.max(0, Math.sin(t * 2.5)) * 0.2); });
      for (const leg of legs) {
        const u = leg.userData, step = Math.max(0, Math.sin(t * 4 + u.ph)) * walking;
        const foot = _a.copy(u.rest); foot.y = step * 0.9; foot.z += Math.cos(t * 4 + u.ph) * 0.8 * walking;
        const knee = _b.copy(u.hip).add(foot).multiplyScalar(0.5); knee.y = 5.6 + Math.sin(t * 2 + u.ph) * 0.1; knee.x *= 1.6; knee.z *= 1.6;
        const place = (m, a, b) => { m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.y = a.distanceTo(b); m.lookAt(b); m.rotateX(Math.PI / 2); };
        place(u.up, u.hip, knee); place(u.lo, knee, foot); u.kneeJ.position.copy(knee);
      }
    };
  }
  root.userData.anim = (st, dt, t) => animFn(st, dt, t);
  root.userData.anim({ speed: 0, attack: 0, phase: 0 }, 0, 0);
  return root;
}
