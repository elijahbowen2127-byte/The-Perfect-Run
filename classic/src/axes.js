// Axe options for the owner to choose from, plus a modern grenade launcher: five viking battle axes (replacing
// 'axe'), five fire axes (replacing 'fireaxe') and `grenadelModern()` (replacing GUNS.grenadel). Same frame as
// weapons.js: the right hand grips at the origin, +Z runs up the haft to the head, +X is toward the cutting edge
// (the card shows +X up), +Y is the thickness of the head. Melee builders return
// { parts: [[geometry, material], ...], reach, support, twoHanded }; the launcher { parts, muzzle, support }.
import * as THREE from 'three';
import { mats, grainTexture, lathe, at, cyl, sweep, wrapped, slab, BX, CY, helix, grainAlong } from './weapons.js';

// ---------- materials ----------
// Polished metals get the studio environment explicitly, like the weapons.js metals (the world's own environment
// is dim), so the bright edges keep their reflections on the lobby card and in the hand alike.
let AM = null, ENV_SEEN = undefined;
const ENV_K = { gunmetal: 1.6, mirror: 2.4, bright: 1.8, iron: 1.3, black: 1.2, red: 1.1, redDark: 1.0, brassInlay: 1.6, runes: 1.6, inlay: 1.6, anod: 1.2, chrome: 2.6, collar: 1.6 };
function runeTexture() {
  // Etched futhark-style strokes on satin steel: each glyph a stem with one or two slanted branches.
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = '#c3c8d0'; g.fillRect(0, 0, 512, 128);
  g.lineCap = 'round'; g.lineWidth = 7;
  let x = 24;
  while (x < 500) {
    g.strokeStyle = '#ffffff'; g.beginPath(); g.moveTo(x + 2, 22); g.lineTo(x + 2, 106); g.stroke();
    g.strokeStyle = '#2f343c'; g.beginPath(); g.moveTo(x, 20); g.lineTo(x, 104); g.stroke();
    const n = 1 + Math.floor(Math.random() * 2);
    for (let k = 0; k < n; k++) { const y0 = 28 + Math.random() * 40, dy = 24 + Math.random() * 30, dx = (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 14); g.beginPath(); g.moveTo(x, y0); g.lineTo(x + dx, y0 + dy); g.stroke(); }
    x += 36 + Math.random() * 14;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function knotTexture() {
  // Silver wire inlay on blackened iron: interlaced arcs with a thin dark outline either side.
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#2a2d33'; g.fillRect(0, 0, 512, 256); g.lineCap = 'round';
  const arcs = (s, w) => { g.strokeStyle = s; g.lineWidth = w; for (let i = -1; i < 6; i++) { const x = i * 96 + 48; g.beginPath(); g.arc(x, 128, 70, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(x + 48, 128, 70, 0, Math.PI * 2); g.stroke(); } };
  arcs('#101215', 16); arcs('#e8ecf2', 8);
  g.strokeStyle = '#e8ecf2'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 24); g.lineTo(512, 24); g.moveTo(0, 232); g.lineTo(512, 232); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function hazardTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = '#f2c414'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#111';
  for (let x = -64; x < 256; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 24, 0); g.lineTo(x + 64, 64); g.lineTo(x + 40, 64); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function am() {
  const m = mats();
  if (!AM) {
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const hick = grainTexture('#c29a5e', '#6a4320', 70), hick2 = grainTexture('#b58a52', '#5a3618', 90), ash = grainTexture('#8e6a3c', '#3c2410', 70), oak = grainTexture('#5e3e22', '#20100a', 90);
    AM = {
      // Ground, polished cutting edge: metalness held under 1 so the card lights still whiten it face-on.
      mirror: std({ color: 0xf8fafc, metalness: 0.72, roughness: 0.17 }),
      bright: std({ color: 0xe6eaf0, metalness: 0.95, roughness: 0.16 }),              // polished steel cheeks
      iron: std({ color: 0x767b84, metalness: 0.8, roughness: 0.5, roughnessMap: m.iron.roughnessMap }), // forged, lightly worn
      black: std({ color: 0x33363c, metalness: 0.85, roughness: 0.5, roughnessMap: m.iron.roughnessMap }), // blackened iron
      chrome: std({ color: 0xffffff, metalness: 0.96, roughness: 0.05 }),
      collar: std({ color: 0xd8dce2, metalness: 0.9, roughness: 0.25 }),
      runes: std({ map: runeTexture(), metalness: 0.85, roughness: 0.3 }),
      inlay: std({ map: knotTexture(), metalness: 0.85, roughness: 0.35 }),
      brassInlay: std({ color: 0xe0b85a, metalness: 1, roughness: 0.25 }),
      red: std({ color: 0xc81e1a, metalness: 0.25, roughness: 0.3 }),                   // fire-engine enamel
      redDark: std({ color: 0x8e1412, metalness: 0.2, roughness: 0.45 }),
      hickory: std({ map: hick, roughness: 0.55 }), hickory2: std({ map: hick2, roughness: 0.6 }),
      ash: std({ map: ash, roughness: 0.55 }), oak: std({ map: oak, roughness: 0.5 }),
      white: std({ color: 0xf2f2f0, roughness: 0.5 }),                                   // reflective stripe
      hazard: std({ map: hazardTexture(), roughness: 0.5 }),
      rubber: std({ color: 0x141416, roughness: 0.92 }),
      fde: std({ color: 0x7d6b4e, metalness: 0.05, roughness: 0.7, roughnessMap: m.iron.roughnessMap }), // flat dark earth polymer
      gunmetal: std({ color: 0x5a616c, metalness: 0.9, roughness: 0.3, roughnessMap: m.iron.roughnessMap }), // blued gunmetal steel
      poly: std({ color: 0x1d1e21, metalness: 0.05, roughness: 0.7, roughnessMap: m.iron.roughnessMap }),
      anod: std({ color: 0x3d4149, metalness: 0.75, roughness: 0.42, roughnessMap: m.iron.roughnessMap }),
      slot: std({ color: 0x06070a, roughness: 0.9 }),
      lens: new THREE.MeshPhysicalMaterial({ color: 0x1c2b3a, metalness: 0.3, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.7 }),
      dot: new THREE.MeshBasicMaterial({ color: 0xff3020, toneMapped: false }),
      green: new THREE.MeshBasicMaterial({ color: 0x8cff3c, toneMapped: false }),
    };
    AM.hazard.map.repeat.set(2, 1);
  }
  const env = m.edge.envMap;
  if (env !== ENV_SEEN) { ENV_SEEN = env; for (const k of Object.keys(ENV_K)) { AM[k].envMap = env; AM[k].envMapIntensity = ENV_K[k]; AM[k].needsUpdate = true; } }
  return AM;
}

// ---------- geometry helpers ----------
const sphere = (r, x, y, z, w = 8, h = 6) => at(new THREE.SphereGeometry(r, w, h), x, y, z);
const lerp = (a, b, k) => a + (b - a) * k;
// Tapered plate lying in the X/Z plane: `pts` the outline [[x, z], ...] (any winding), `th` the half-thickness
// (in Y) as a function of (x, z) or as one value per outline point. Faceted top, bottom and side walls.
function wedge(pts, th) {
  const area = pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  let T = typeof th === 'function' ? pts.map(([x, z]) => th(x, z)) : th.slice();
  if (area < 0) { pts = pts.slice().reverse(); T = T.reverse(); }
  const tri = THREE.ShapeUtils.triangulateShape(pts.map(([x, z]) => new THREE.Vector2(x, z)), []);
  const pos = [], uv = [];
  const push = (i, s) => { const p = pts[i]; pos.push(p[0], s * T[i], p[1]); uv.push(p[0], p[1]); };
  for (const [a, b, c] of tri) { push(a, 1); push(c, 1); push(b, 1); push(a, -1); push(b, -1); push(c, -1); }
  for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; push(i, 1); push(j, -1); push(i, -1); push(i, 1); push(j, 1); push(j, -1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
// Normalise a geometry's UVs to 0..1 over their bounding box (so a canvas texture fills a plate).
function uvFit(g, swap = false) {
  const uv = g.attributes.uv; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v); }
  for (let i = 0; i < uv.count; i++) { const u = (uv.getX(i) - x0) / (x1 - x0 || 1), v = (uv.getY(i) - y0) / (y1 - y0 || 1); if (swap) uv.setXY(i, v, u); else uv.setXY(i, u, v); }
  return g;
}
// The run of the bit: `n` points from the toe to the heel, bowed out by `bulge` (a convex edge) or in (a hollow one).
function bit(toe, heel, n = 8, bulge = 0.012) {
  const out = [], dx = heel[0] - toe[0], dz = heel[1] - toe[1], L = Math.hypot(dx, dz), nx = dz / L, nz = -dx / L;
  for (let i = 0; i <= n; i++) { const s = i / n, b = Math.sin(Math.PI * s) * bulge; out.push([lerp(toe[0], heel[0], s) + nx * b, lerp(toe[1], heel[1], s) + nz * b]); }
  return out;
}
// Axe head from one outline: the points from index i0 to i1 (inclusive) are the cutting edge. The polished band
// is `band` wide behind the edge, the cheek (the rest of the head) thins from tEye at xEye to tBand at the band.
// Returns [[geometry, material], ...]: cheek in `cheekMat`, band in `edgeMat`.
// Cheek taper: half-thickness tEye at xEye thinning to tBand at xBand (clamped either side).
const taper = (xEye, tEye, xBand, tBand) => (x) => lerp(tEye, tBand, Math.min(1, Math.max(0, (x - xEye) / (xBand - xEye))));
function axeHead(outline, i0, i1, band, { tf, tEdge = 0.0005, cheekMat, edgeMat, fill = false }) {
  let pts = outline.slice();
  const area = pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  if (area < 0) { pts.reverse(); const n = pts.length; [i0, i1] = [n - 1 - i1, n - 1 - i0]; }
  const n = pts.length, run = pts.slice(i0, i1 + 1);
  // Inner line of the band: each edge point moved inward along the outline normal.
  const inner = run.map((p, k) => {
    const a = pts[(i0 + k - 1 + n) % n], b = pts[(i0 + k + 1) % n], tx = b[0] - a[0], tz = b[1] - a[1], L = Math.hypot(tx, tz) || 1;
    return [p[0] - (tz / L) * band, p[1] + (tx / L) * band]; // CCW outline: outward normal is (tz, -tx)
  });
  const cheek = [...pts.slice(0, i0), ...inner, ...pts.slice(i1 + 1)];
  const bandPts = [...run, ...inner.slice().reverse()], bandT = [...run.map(() => tEdge), ...inner.slice().reverse().map(([x]) => tf(x))];
  const out = [[wedge(cheek, (x) => tf(x)), cheekMat], [wedge(bandPts, bandT), edgeMat]];
  if (fill) {
    // Close the two gaps where the band meets the toe and heel corners, so no cheek colour ever reaches the polished edge.
    const tri = (c, e, i) => out.push([wedge([c, e, i], [tf(c[0]), tEdge, tf(i[0])]), edgeMat]);
    tri(pts[(i0 - 1 + n) % n], run[0], inner[0]);
    tri(pts[(i1 + 1) % n], run[run.length - 1], inner[inner.length - 1]);
  }
  return out;
}
// Straight wooden haft from z0 to z1, swelling to rb at the butt, rt at the top (the eye). Grain runs along it.
const haft = (z0, z1, r, rb, rt, mat, seg = 12) => [grainAlong(lathe([[0, z0], [rb * 0.8, z0], [rb, z0 + 0.02], [r, z0 + 0.1], [r, (z0 + z1) / 2], [rt, z1 - 0.02], [rt, z1], [0, z1]], seg)), mat];
// Oval eye lump round the haft at z0..z1 (the socket the head is forged round), rx across the bit, ry thick.
const eye = (z0, z1, rx, ry, mat) => [at(lathe([[0, z0], [rx * 0.9, z0], [rx, z0 + 0.008], [rx, z1 - 0.008], [rx * 0.9, z1], [0, z1]], 14).scale(1, ry / rx, 1), 0, 0, 0), mat];
// Iron langets: strips down both faces of the haft below the head, riveted through.
function langets(P, z0, z1, w, yoff, mat, rivetMat, n = 4) {
  for (const sy of [-1, 1]) {
    P.push([BX(w, 0.004, z1 - z0, 0, sy * yoff, (z0 + z1) / 2), mat]);
    for (let k = 0; k < n; k++) P.push([sphere(0.0042, 0, sy * (yoff + 0.003), lerp(z0 + 0.02, z1 - 0.02, k / (n - 1)), 6, 4), rivetMat]);
  }
}
// Wedge driven into the top of the haft through the eye.
const haftWedge = (z, w, mat) => [BX(0.004, w, 0.016, 0, 0, z), mat];
const ring = (z, r, h, mat, seg = 14) => [lathe([[0, z - h / 2], [r, z - h / 2], [r, z + h / 2], [0, z + h / 2]], seg), mat];
// A cheek decoration on both faces of the head: a plate following the cheek taper `tf`, a hair proud of it.
// The texture's u runs along the haft (z), v across the bit (x), so a band of runes reads along the head.
function faceDecal(P, pts, tf, mat) { P.push([uvFit(wedge(pts, (x) => tf(x) + 0.0007), true), mat]); }
// A smooth curve laid on the cheek face (brass wire inlay): a thin tube just proud of the surface, both faces.
function inlayLine(P, pts3, r, mat) {
  for (const sy of [-1, 1]) P.push([sweep(pts3.map(([x, y, z]) => [x, sy * y, z]), pts3.map(() => r), 6), mat]);
}

// ================= VIKING BATTLE AXES =================
// bax1. Skeggøx: a short-hafted one-hand bearded axe. Narrow eye, the beard hanging a hand's width below it,
// leather grip, iron butt cap, a brass wedge in the eye. Forged iron cheeks with a bright ground edge.
function bax1() {
  const m = mats(), s = am(), P = [];
  P.push(haft(-0.1, 0.612, 0.0165, 0.021, 0.018, s.ash));
  wrapped(P, -0.085, 0.15, [[-0.085, 0.021], [0, 0.0195], [0.15, 0.0185]], m.leather, m.cord, 11, 0.003);
  P.push(ring(-0.108, 0.0225, 0.018, m.iron));
  P.push(eye(0.515, 0.595, 0.03, 0.024, s.iron));
  P.push(haftWedge(0.606, 0.026, m.brass));
  const O = [[-0.036, 0.52], [-0.036, 0.59], [0.025, 0.605], ...bit([0.135, 0.655], [0.16, 0.415], 8, 0.014), [0.1, 0.44], [0.055, 0.5], [0.03, 0.51]];
  P.push(...axeHead(O, 3, 11, 0.032, { tf: taper(0.03, 0.012, 0.125, 0.0045), cheekMat: s.iron, edgeMat: s.mirror }));
  return { parts: P, reach: 0.66, support: null, twoHanded: false };
}
// bax2. Dane axe (breiðöx): a long plain ash haft for two hands and a broad, thin crescent blade with a flared toe
// and heel, polished steel with a mirror bit. A cord whipping below the head and at the grip, iron butt.
function bax2() {
  const m = mats(), s = am(), P = [];
  P.push(haft(-0.12, 1.1, 0.0165, 0.02, 0.018, s.ash));
  P.push([helix(-0.09, 0.1, () => 0.0175, 16, 0.0025), m.cord]);
  P.push([helix(0.86, 0.96, () => 0.0178, 9, 0.0025), m.cord]);
  P.push(ring(-0.128, 0.021, 0.016, m.iron));
  P.push(eye(1.0, 1.085, 0.03, 0.023, s.bright));
  P.push(haftWedge(1.095, 0.026, m.iron));
  const O = [[-0.03, 1.005], [-0.03, 1.08], [0.028, 1.095], [0.13, 1.2], ...bit([0.25, 1.25], [0.25, 0.8], 12, 0.024), [0.13, 0.86], [0.03, 0.99]];
  P.push(...axeHead(O, 4, 16, 0.048, { tf: taper(0.03, 0.011, 0.2, 0.0035), cheekMat: s.bright, edgeMat: s.mirror }));
  return { parts: P, reach: 1.25, support: [0, 0, 0.42], twoHanded: true };
}
// bax3. Broad bearded axe with brass wire inlaid in the cheeks: a two-hand haft of dark oak, cord-and-leather grip,
// riveted iron langets under the head, a deep hooked beard. Satin steel head.
function bax3() {
  const m = mats(), s = am(), P = [];
  P.push(haft(-0.1, 0.86, 0.017, 0.022, 0.019, s.oak));
  wrapped(P, -0.085, 0.2, [[-0.085, 0.0215], [0, 0.02], [0.2, 0.019]], m.leather, m.cord, 14, 0.003, true);
  P.push(ring(-0.108, 0.023, 0.018, m.iron));
  langets(P, 0.5, 0.74, 0.016, 0.0195, m.iron, m.brass, 4);
  P.push(eye(0.74, 0.83, 0.031, 0.025, s.iron));
  P.push(haftWedge(0.853, 0.028, m.iron));
  const O = [[-0.04, 0.745], [-0.04, 0.825], [0.03, 0.845], [0.1, 0.87], ...bit([0.19, 0.875], [0.215, 0.58], 10, 0.016), [0.16, 0.6], [0.075, 0.69], [0.035, 0.735]];
  const tf = taper(0.035, 0.013, 0.17, 0.004);
  P.push(...axeHead(O, 4, 14, 0.036, { tf, cheekMat: s.bright, edgeMat: s.mirror }));
  // Three brass wires swept across each cheek, following the curve of the beard.
  const yAt = (x) => tf(x) + 0.0008;
  for (const d of [0, 0.022, 0.044]) inlayLine(P, [[0.045 + d * 0.3, yAt(0.045 + d * 0.3), 0.835 - d], [0.08 + d * 0.5, yAt(0.08 + d * 0.5), 0.8 - d], [0.11 + d * 0.5, yAt(0.11 + d * 0.5), 0.74 - d], [0.125 + d * 0.5, yAt(0.125 + d * 0.5), 0.665 - d * 0.6]], 0.0016, s.brassInlay);
  return { parts: P, reach: 0.88, support: [0, 0, 0.3], twoHanded: true };
}
// bax4. Hand axe with a hammer poll: short haft for one hand, compact bearded head of blackened iron with a runic
// band etched into each cheek, a flat striking poll on the back, brass rivets through the eye, leather grip.
function bax4() {
  const m = mats(), s = am(), P = [];
  P.push(haft(-0.1, 0.5, 0.016, 0.0215, 0.0175, s.ash));
  wrapped(P, -0.08, 0.13, [[-0.08, 0.0205], [0, 0.019], [0.13, 0.018]], m.leather, m.leather, 10, 0.0032);
  P.push([helix(-0.08, 0.13, () => 0.0195, 10, 0.0012), m.cord]);
  P.push(ring(-0.107, 0.022, 0.016, s.black));
  P.push(eye(0.41, 0.49, 0.028, 0.023, s.black));
  for (const sy of [-1, 1]) P.push([sphere(0.0045, 0, sy * 0.0235, 0.45, 6, 4), m.brass]);
  P.push(haftWedge(0.497, 0.024, m.iron));
  P.push([BX(0.05, 0.034, 0.05, -0.05, 0, 0.45), s.black], [BX(0.008, 0.038, 0.054, -0.078, 0, 0.45), s.bright]); // hammer poll with a polished face
  const O = [[-0.03, 0.415], [-0.03, 0.485], [0.03, 0.5], ...bit([0.115, 0.53], [0.135, 0.33], 8, 0.01), [0.085, 0.35], [0.045, 0.4], [0.028, 0.41]];
  const tf = taper(0.028, 0.012, 0.1, 0.0045);
  P.push(...axeHead(O, 3, 11, 0.028, { tf, cheekMat: s.black, edgeMat: s.mirror }));
  faceDecal(P, [[0.042, 0.405], [0.042, 0.495], [0.078, 0.505], [0.078, 0.395]], tf, s.runes);
  return { parts: P, reach: 0.54, support: null, twoHanded: false };
}
// bax5. Two-hand broad axe in the Mammen style: a big head with a long upswept toe and a hooked beard, blackened
// iron cheeks inlaid with silver knotwork, a mirror edge, long iron langets riveted down a dark oak haft, crossed cord grip.
function bax5() {
  const m = mats(), s = am(), P = [];
  P.push(haft(-0.11, 1.0, 0.0175, 0.023, 0.02, s.oak));
  wrapped(P, -0.095, 0.26, [[-0.095, 0.0225], [0, 0.021], [0.26, 0.02]], m.leather, m.cord, 16, 0.0028, true);
  P.push(ring(-0.118, 0.024, 0.018, s.black));
  langets(P, 0.55, 0.88, 0.017, 0.0205, s.black, m.iron, 5);
  P.push(eye(0.875, 0.965, 0.032, 0.026, s.black));
  P.push(haftWedge(0.993, 0.028, m.iron));
  for (const sy of [-1, 1]) P.push([sphere(0.005, 0, sy * 0.0245, 0.92, 6, 4), m.iron]);
  const O = [[-0.042, 0.88], [-0.042, 0.96], [0.03, 0.985], [0.12, 1.06], ...bit([0.21, 1.09], [0.235, 0.7], 12, 0.018), [0.19, 0.72], [0.1, 0.8], [0.04, 0.865]];
  const tf = taper(0.04, 0.014, 0.185, 0.004);
  P.push(...axeHead(O, 4, 16, 0.042, { tf, cheekMat: s.black, edgeMat: s.mirror }));
  faceDecal(P, [[0.055, 0.875], [0.055, 0.98], [0.15, 1.045], [0.165, 0.74], [0.11, 0.8]], tf, s.inlay);
  return { parts: P, reach: 1.1, support: [0, 0, 0.38], twoHanded: true };
}
export const BATTLEAXE_VARIANTS = { bax1, bax2, bax3, bax4, bax5 };

// ================= FIRE AXES =================
// Every fire axe: a wooden handle with visible grain, a red-enamelled head, and a mirror-steel cutting edge over
// a fifth or more of the red (the band is 30% of the head's width from the eye to the bit, over 20% of the red once
// the eye and the poll are counted).
// Red head with its bright bit: outline as for axeHead; the band is a fifth of the head width.
function fireHead(P, O, i0, i1, xEye, xBit, tEye, tBand, s, fill = false) {
  const band = (xBit - xEye) * 0.3, tf = taper(xEye, tEye, xBit - band, tBand + 0.003);
  P.push(...axeHead(O, i0, i1, band, { tf, cheekMat: s.red, edgeMat: s.mirror, fill }));
  return tf;
}
// Four-sided pick on the back of the head, pointing -X, tip at xTip.
const pick = (xTip, z, w, mat) => [at(new THREE.ConeGeometry(w, -xTip, 4).rotateY(Math.PI / 4).rotateZ(Math.PI / 2), xTip / 2, 0, z), mat];
// fax1. Classic pick-head fire axe: straight hickory handle, red head with a long spike pick, mirror edge, a black
// rubber butt grip and a white reflective ring under the head.
function fax1() {
  const s = am(), P = [];
  P.push(haft(-0.1, 0.87, 0.018, 0.024, 0.019, s.hickory));
  P.push([lathe([[0, -0.108], [0.0245, -0.108], [0.025, -0.03], [0.0195, -0.02], [0, -0.02]], 12), s.rubber]);
  P.push(ring(0.72, 0.0195, 0.03, s.white));
  P.push([at(lathe([[0, 0.78], [0.03, 0.78], [0.033, 0.79], [0.033, 0.855], [0.03, 0.865], [0, 0.865]], 12).scale(1, 0.8, 1), 0, 0, 0), s.red]); // eye
  P.push(haftWedge(0.863, 0.03, s.collar));
  const O = [[-0.02, 0.785], [-0.02, 0.86], [0.04, 0.868], [0.12, 0.9], ...bit([0.2, 0.93], [0.205, 0.725], 8, 0.012), [0.11, 0.75], [0.04, 0.775]];
  fireHead(P, O, 4, 12, 0.04, 0.2, 0.016, 0.004, s);
  P.push(pick(-0.17, 0.822, 0.016, s.red), [at(new THREE.ConeGeometry(0.009, 0.05, 4).rotateY(Math.PI / 4).rotateZ(Math.PI / 2), -0.145, 0, 0.822), s.collar]); // pick, with a bare steel tip
  return { parts: P, reach: 0.93, support: [0, 0, 0.22], twoHanded: true };
}
// fax2. Flat-poll rescue axe: a shorter curved hickory handle with a fawn's-foot end, leather-wrapped grip, broad
// Dayton-pattern red head with a square steel striking poll, mirror edge.
function fax2() {
  const m = mats(), s = am(), P = [];
  const C = [[-0.012, 0, -0.1], [-0.004, 0, -0.04], [0, 0, 0.1], [0.004, 0, 0.4], [0.002, 0, 0.6], [0, 0, 0.75]];
  P.push([sweep(C, [0.025, 0.021, 0.018, 0.0175, 0.018, 0.019], 12), s.hickory2]); // sweep UVs already run along the handle
  P.push([sphere(0.0245, -0.012, 0, -0.1, 10, 8).scale(1, 0.85, 0.6), s.hickory2]);
  wrapped(P, -0.06, 0.14, [[-0.06, 0.0215], [0.14, 0.02]], m.leather, m.cord, 12, 0.0028);
  P.push([at(lathe([[0, 0.66], [0.032, 0.66], [0.035, 0.67], [0.035, 0.74], [0.032, 0.75], [0, 0.75]], 12).scale(1, 0.75, 1), 0, 0, 0), s.red]);
  P.push(haftWedge(0.748, 0.032, s.collar));
  P.push([BX(0.055, 0.044, 0.075, -0.045, 0, 0.705), s.red], [BX(0.008, 0.048, 0.08, -0.076, 0, 0.705), s.collar]); // square poll, bright face
  const O = [[-0.02, 0.665], [-0.02, 0.745], [0.045, 0.755], [0.13, 0.8], ...bit([0.225, 0.83], [0.23, 0.57], 10, 0.02), [0.13, 0.615], [0.045, 0.655]];
  fireHead(P, O, 4, 14, 0.045, 0.225, 0.017, 0.0045, s);
  return { parts: P, reach: 0.83, support: [0, 0, 0.2], twoHanded: true };
}
// fax3. Pulaski pattern: a long handle, red head with an adze blade on the back set across the haft, both bits
// ground bright; a hazard-striped band on the handle under the head.
function fax3() {
  const s = am(), P = [];
  P.push(haft(-0.1, 0.92, 0.0175, 0.023, 0.019, s.hickory));
  P.push([lathe([[0, -0.108], [0.024, -0.108], [0.0245, -0.035], [0.019, -0.025], [0, -0.025]], 12), s.rubber]);
  P.push([uvFit(lathe([[0.0195, 0.74], [0.0195, 0.8]], 14)), s.hazard]);
  P.push([at(lathe([[0, 0.83], [0.03, 0.83], [0.033, 0.84], [0.033, 0.905], [0.03, 0.915], [0, 0.915]], 12).scale(1, 0.8, 1), 0, 0, 0), s.red]);
  P.push(haftWedge(0.913, 0.03, s.collar));
  const O = [[-0.02, 0.835], [-0.02, 0.91], [0.04, 0.918], [0.1, 0.935], ...bit([0.185, 0.95], [0.19, 0.78], 8, 0.008), [0.1, 0.795], [0.04, 0.825]];
  fireHead(P, O, 4, 12, 0.04, 0.185, 0.016, 0.004, s);
  // The adze: a plate set across the haft, curving down, with its own bright edge at the far end.
  P.push([slab([[-0.02, 0.028], [-0.09, 0.034], [-0.15, 0.042], [-0.19, 0.045], [-0.19, -0.045], [-0.15, -0.042], [-0.09, -0.034], [-0.02, -0.028]], 0.014, 0.002).rotateY(Math.PI / 2).translate(0, 0, 0.872), s.red]);
  P.push([slab([[-0.15, 0.044], [-0.2, 0.047], [-0.2, -0.047], [-0.15, -0.044]], 0.009, 0.001).rotateY(Math.PI / 2).translate(0, 0, 0.872), s.mirror]);
  return { parts: P, reach: 0.96, support: [0, 0, 0.24], twoHanded: true };
}
// fax4. Modern rescue axe: a steel collar guarding the top of the handle, a glass-breaker spike pick, a wide bit with
// the bright band, white reflective rings on the handle, cord-wrapped grip.
function fax4() {
  const m = mats(), s = am(), P = [];
  P.push(haft(-0.1, 0.8, 0.018, 0.0235, 0.019, s.hickory2));
  wrapped(P, -0.085, 0.17, [[-0.085, 0.0215], [0.17, 0.0205]], s.rubber, m.cord, 15, 0.0026, true);
  P.push(ring(-0.108, 0.0235, 0.018, s.poly));
  for (const z of [0.3, 0.34]) P.push(ring(z, 0.0185, 0.02, s.white));
  P.push([lathe([[0, 0.6], [0.0205, 0.6], [0.0225, 0.61], [0.0225, 0.705], [0.03, 0.71], [0, 0.71]], 14), s.collar]); // steel collar
  P.push([at(lathe([[0, 0.71], [0.032, 0.71], [0.034, 0.72], [0.034, 0.79], [0.031, 0.8], [0, 0.8]], 12).scale(1, 0.78, 1), 0, 0, 0), s.red]);
  P.push(haftWedge(0.797, 0.03, s.collar));
  for (const sy of [-1, 1]) P.push([sphere(0.005, 0, sy * 0.0265, 0.755, 6, 4), s.collar]);
  const O = [[-0.02, 0.715], [-0.02, 0.795], [0.04, 0.805], [0.14, 0.845], ...bit([0.215, 0.865], [0.215, 0.655], 8, 0.016), [0.13, 0.69], [0.04, 0.705]];
  fireHead(P, O, 4, 12, 0.04, 0.215, 0.017, 0.0045, s);
  P.push([BX(0.06, 0.03, 0.05, -0.045, 0, 0.755), s.red]);
  P.push([at(new THREE.ConeGeometry(0.012, 0.09, 6).rotateZ(Math.PI / 2), -0.12, 0, 0.755), s.collar]); // glass-breaker spike
  return { parts: P, reach: 0.87, support: [0, 0, 0.2], twoHanded: true };
}
// fax5. Heavy Michigan-pattern fire axe: a long handle with a flared end and a black rubber over-grip, a big red
// head with a flat poll, a wide convex bit, a dark red stripe decal across each cheek and a bright band.
function fax5() {
  const s = am(), P = [];
  P.push(haft(-0.12, 0.95, 0.0185, 0.027, 0.02, s.hickory));
  P.push([lathe([[0, -0.128], [0.027, -0.128], [0.0285, -0.11], [0.0265, -0.1], [0.0225, 0.0], [0.0225, 0.09], [0.019, 0.1], [0, 0.1]], 12), s.rubber]);
  for (const z of [-0.08, -0.04, 0.0, 0.04]) P.push(ring(z, 0.0235, 0.006, s.poly));
  P.push(ring(0.78, 0.0205, 0.026, s.white));
  P.push([at(lathe([[0, 0.855], [0.033, 0.855], [0.036, 0.865], [0.036, 0.935], [0.033, 0.945], [0, 0.945]], 12).scale(1, 0.8, 1), 0, 0, 0), s.red]);
  P.push(haftWedge(0.943, 0.032, s.collar));
  P.push([BX(0.05, 0.05, 0.08, -0.04, 0, 0.9), s.red], [BX(0.006, 0.054, 0.084, -0.068, 0, 0.9), s.collar]);
  const O = [[-0.02, 0.86], [-0.02, 0.94], [0.045, 0.95], [0.13, 0.985], ...bit([0.24, 1.0], [0.245, 0.77], 10, 0.028), [0.13, 0.81], [0.045, 0.85]];
  const tf = fireHead(P, O, 4, 14, 0.045, 0.24, 0.018, 0.005, s);
  faceDecal(P, [[0.06, 0.84], [0.06, 0.965], [0.085, 0.975], [0.085, 0.83]], tf, s.redDark);
  return { parts: P, reach: 1.0, support: [0, 0, 0.26], twoHanded: true };
}
export const FIREAXE_VARIANTS = { fax1, fax2, fax3, fax4, fax5 };

// ================= MODERN GRENADE LAUNCHER =================
// Trigger guard (weapons.js keeps its own copy private).
const guard = (z0, z1, y0, depth) => slab([[z0, y0], [z1, y0], [z1, y0 - depth * 0.4], [z1 - 0.015, y0 - depth], [z0 + 0.005, y0 - depth], [z0, y0 - depth * 0.6]], 0.008, 0.001);
function railTeeth(z0, z1, y, w = 0.022) {
  const out = [];
  for (let z = z0; z < z1; z += 0.012) out.push(at(new THREE.BoxGeometry(w, 0.006, 0.006), 0, y, z));
  return out;
}
// Six-shot revolving 40 mm launcher, modern pattern: flat dark earth polymer frame and stock, anodised steel
// cylinder and barrel with a vented shroud, a full-length top picatinny rail carrying a holographic sight, side and
// bottom rails on the handguard, an angled foregrip, a collapsible stock on a buffer tube. Same frame as
// GUNS.grenadel: cylinder axis at y 0.04, barrel at y 0.078, muzzle [0, 0.078, 0.56], support [0, -0.03, 0.312].
export function grenadelModern() {
  const m = mats(), s = am();
  const p = [
    // frame: lower receiver with the cylinder window, upper carrying the barrel and rail
    [slab([[-0.13, 0.02], [-0.07, -0.012], [0.04, -0.016], [0.2, -0.012], [0.2, 0.012], [0.07, 0.016], [0.07, 0.098], [-0.03, 0.108], [-0.13, 0.1]], 0.05, 0.008), s.gunmetal],
    [slab([[-0.1, 0.034], [-0.1, 0.08], [0.0, 0.08], [0.0, 0.034]], 0.054, 0.002), s.poly], // recessed side panels
    [BX(0.058, 0.006, 0.05, 0, 0.06, -0.09), s.anod], // serial plate
    [slab([[-0.13, 0.094], [0.47, 0.094], [0.47, 0.11], [-0.13, 0.112]], 0.03, 0.003), s.anod], // rail base along the top
    ...railTeeth(-0.125, 0.47, 0.115, 0.03).map((g) => [g, s.anod]),
    // cylinder: fluted anodised drum with six chamber mouths and a centre axis
    [CY(0.057, 0.125, 0, 0.04, 0.12, 24), s.anod],
    [CY(0.059, 0.014, 0, 0.04, 0.066, 24), s.poly], [CY(0.059, 0.014, 0, 0.04, 0.176, 24), s.poly],
    [CY(0.009, 0.15, 0, 0.04, 0.12, 10), s.collar],
    // barrel, vented shroud, muzzle
    [at(cyl(0.0215, 0.0215, 0.36, 20), 0, 0.078, 0.375), s.anod],
    [at(cyl(0.027, 0.027, 0.2, 20), 0, 0.078, 0.37), s.poly],
    [CY(0.026, 0.028, 0, 0.078, 0.542, 18), s.anod],
    [at(new THREE.CircleGeometry(0.0168, 16), 0, 0.078, 0.5565), s.slot],
    // handguard under the barrel with a bottom rail, side rail and the angled foregrip
    [BX(0.054, 0.046, 0.22, 0, 0.04, 0.33), s.gunmetal], [BX(0.056, 0.03, 0.17, 0, 0.038, 0.33), s.poly], // handguard with a dark centre band
    [BX(0.03, 0.01, 0.2, 0, 0.012, 0.33), s.anod], ...railTeeth(0.24, 0.42, 0.006, 0.03).map((g) => [g, s.anod]),
    [BX(0.01, 0.026, 0.16, 0.031, 0.044, 0.33), s.anod], ...railTeeth(0.26, 0.4, 0, 0.006).map((g) => [g.translate(0.038, 0.044, 0), s.anod]),
    [slab([[0.265, 0.014], [0.35, 0.014], [0.34, -0.03], [0.325, -0.078], [0.288, -0.082], [0.272, -0.045]], 0.03, 0.005), s.poly], // angled foregrip
    [BX(0.032, 0.03, 0.004, 0, -0.05, 0.306), s.rubber], // its textured front face
    // pistol grip with a rubber overmould and the trigger guard
    [slab([[-0.044, 0.0], [0.0, 0.0], [-0.016, -0.11], [-0.062, -0.118], [-0.072, -0.09]], 0.034, 0.007), s.poly],
    [BX(0.03, 0.08, 0.006, 0, -0.06, -0.012), s.rubber],
    [guard(0.0, 0.07, -0.004, 0.036), s.anod],
    [BX(0.004, 0.026, 0.008, 0, -0.022, 0.03, 0.25), s.anod], // trigger
    // collapsible stock: buffer tube with its adjustment notches, sliding butt with a rubber pad and release lever
    [at(cyl(0.015, 0.015, 0.2, 14), 0, 0.05, -0.23), s.anod],
    [BX(0.012, 0.004, 0.14, 0, 0.035, -0.23), s.poly],
    [slab([[-0.19, 0.074], [-0.33, 0.08], [-0.33, 0.028], [-0.19, 0.028]], 0.036, 0.005), s.poly], // sleeve over the tube
    [slab([[-0.305, 0.08], [-0.335, 0.082], [-0.34, -0.06], [-0.308, -0.062]], 0.036, 0.004), s.poly], // back plate
    [slab([[-0.2, 0.03], [-0.24, 0.03], [-0.335, -0.062], [-0.308, -0.062]], 0.03, 0.004), s.poly], // lower strut (the sling loop between)
    [slab([[-0.335, 0.084], [-0.348, 0.084], [-0.348, -0.064], [-0.335, -0.064]], 0.038, 0.004), s.rubber], // butt pad
    [BX(0.03, 0.01, 0.036, 0, 0.024, -0.215), s.poly], // release lever
    [BX(0.03, 0.012, 0.03, 0.032, 0.03, 0.08), s.anod], // cylinder release on the right
    [BX(0.006, 0.02, 0.02, 0.023, 0.03, -0.21), s.anod], // QD sling point
    // holographic sight on the rail: hooded housing with a window and the red dot inside it
    [BX(0.036, 0.012, 0.078, 0, 0.126, -0.01), s.poly],
    [BX(0.003, 0.03, 0.058, -0.0175, 0.147, -0.01), s.poly], [BX(0.003, 0.03, 0.058, 0.0175, 0.147, -0.01), s.poly], [BX(0.038, 0.004, 0.058, 0, 0.164, -0.01), s.poly], // the hood: open front and back
    [BX(0.032, 0.028, 0.0015, 0, 0.147, -0.004), s.lens],
    [BX(0.02, 0.004, 0.012, 0.0195, 0.14, -0.02), s.anod], [BX(0.02, 0.004, 0.012, 0.0195, 0.14, 0.0), s.anod], // brightness buttons
    [sphere(0.0035, 0, 0.152, -0.01, 8, 6), s.dot],
    [BX(0.012, 0.01, 0.03, 0.022, 0.14, -0.015), s.anod], // brightness buttons housing
    [BX(0.008, 0.01, 0.006, 0, 0.126, 0.46), s.anod], [BX(0.0015, 0.014, 0.004, 0, 0.138, 0.46), s.green], // fibre front post
  ];
  for (let i = 0; i < 6; i++) { // vent slots along the shroud, each side and on top
    const z = 0.29 + i * 0.028;
    for (const sx of [-1, 1]) p.push([BX(0.003, 0.009, 0.016, sx * 0.0265, 0.082, z), s.slot]);
    p.push([BX(0.012, 0.003, 0.016, 0, 0.1045, z), s.slot]);
  }
  for (let i = 0; i < 6; i++) { // chamber mouths and a flute between each pair
    const a = Math.PI / 2 + i * (Math.PI / 3), b = a + Math.PI / 6;
    p.push([at(new THREE.CircleGeometry(0.0158, 14), Math.cos(a) * 0.036, 0.04 + Math.sin(a) * 0.036, 0.1835), s.slot]);
    p.push([BX(0.008, 0.004, 0.09, 0, 0.057, 0.12).rotateZ(b - Math.PI / 2).translate(0, 0.04, 0), s.slot]);
  }
  return { parts: p, muzzle: [0, 0.078, 0.56], support: [0, -0.03, 0.312] };
}

// ---------- Nutty's picks (2026-11-04) ----------
// Shift every part that sits above z0 along the haft by dz (heads, langets, eyes), leaving grips and butts alone.
function shiftAbove(parts, z0, dz) {
  for (const pr of parts) { const g = pr[0]; g.computeBoundingBox(); if (g.boundingBox.min.z > z0) g.translate(0, 0, dz); }
  return parts;
}
// Battle axe 3 (brass-inlaid bearded axe) cut down to a one-hand haft: the head rides 0.25 m lower on a short oak haft.
export function battleaxePick() {
  const d = bax3(), s = am();
  d.parts[0] = haft(-0.1, 0.61, 0.017, 0.022, 0.019, s.oak);
  shiftAbove(d.parts, 0.3, -0.25);
  return { parts: d.parts, reach: 0.66, support: null, twoHanded: false };
}
// Fire axe 2's flat-poll Dayton head on fire axe 1's plain hickory handle with the rubber butt. The polished band fills the toe
// and heel corners too, so red only ever meets steel along the band's inner line, never at the cutting edge.
export function fireaxePick() {
  const s = am(), P = [], Z = 0.12; // fax2's head sits at z 0.57..0.83; lift it onto the top of the 0.87 m handle
  P.push(haft(-0.1, 0.87, 0.018, 0.024, 0.019, s.hickory));
  P.push([lathe([[0, -0.108], [0.0245, -0.108], [0.025, -0.03], [0.0195, -0.02], [0, -0.02]], 12), s.rubber]);
  P.push(ring(0.72, 0.0195, 0.03, s.white));
  const H = [];
  H.push([at(lathe([[0, 0.66], [0.032, 0.66], [0.035, 0.67], [0.035, 0.74], [0.032, 0.75], [0, 0.75]], 12).scale(1, 0.75, 1), 0, 0, 0), s.red]); // eye
  H.push(haftWedge(0.748, 0.032, s.collar));
  H.push([BX(0.055, 0.044, 0.075, -0.045, 0, 0.705), s.red], [BX(0.008, 0.048, 0.08, -0.076, 0, 0.705), s.collar]); // square poll, bright face
  const O = [[-0.02, 0.665], [-0.02, 0.745], [0.045, 0.755], [0.13, 0.8], ...bit([0.225, 0.83], [0.23, 0.57], 10, 0.02), [0.13, 0.615], [0.045, 0.655]];
  fireHead(H, O, 4, 14, 0.045, 0.225, 0.017, 0.0045, s, true); // steel also fills the toe and heel corners
  for (const pr of H) { pr[0].translate(0, 0, Z); P.push(pr); }
  return { parts: P, reach: 0.93, support: [0, 0, 0.22], twoHanded: true };
}
export const AXE_PICKS = { axe: battleaxePick, fireaxe: fireaxePick };
