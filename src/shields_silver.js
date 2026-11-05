// Ten polished-steel round shields, each paired with a bright one-handed sword: variations on the viking pair of
// shields.js for the owner to choose from. Same frames as shields.js: the sword has its origin at the hand with +Z
// from the grip to the tip (flats in X/Z, thickness along Y); the shield is centred at the origin in the Y/Z plane,
// its front face toward +X (front surface at x ~ +thickness, grip side at x ~ 0), up +Y. `size` is the height.
import * as THREE from 'three';
import { mats, grainTexture, lathe, at, sweep, rod, wrapped, bladeParts, ringD, ringX as diamondRing, TAG_D, TAG_X } from './weapons.js';

// ---------- materials ----------
// Polished metals get the studio environment explicitly, like the weapons.js metals (the world's own environment
// is dim), so the silver keeps its reflections in the hand and on the lobby card alike. Metalness sits just under
// 1 so a face square to the light still picks up some of it instead of only mirroring a grey wall.
let SM = null, ENV_SEEN = undefined;
const ENV_K = { blade: 2.0, fuller: 1.8, mirror: 2.3, plate: 2.0, brushed: 1.6, chrome: 3.2, satin: 1.7, black: 1.2, blued: 2.0, engraved: 1.9 };
function brushTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 4;
  const g = c.getContext('2d');
  for (let x = 0; x < 1024; x++) { const v = 120 + Math.random() * 135; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, 4); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1);
  return t;
}
// Engraved sunburst: bright steel with darker etched rays, circles and flame tongues, each cut with a highlight edge.
function sunburstTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'); g.fillStyle = '#eef1f5'; g.fillRect(0, 0, 512, 512); g.translate(256, 256); g.lineCap = 'round';
  const ray = (a, r0, r1, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke(); };
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2, long = i % 2 === 0, r1 = long ? 232 : 180;
    g.strokeStyle = '#ffffff'; ray(a + 0.014, 78, r1, long ? 4 : 3);
    g.strokeStyle = '#6b727c'; ray(a, 78, r1, long ? 5 : 3.5);
  }
  for (const [r, w] of [[70, 4], [84, 2.5], [160, 2], [242, 5]]) {
    g.strokeStyle = '#ffffff'; g.lineWidth = w; g.beginPath(); g.arc(0, 0, r + 3, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#6b727c'; g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
  }
  g.fillStyle = '#6b727c';
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 88, Math.sin(a) * 88); g.lineTo(Math.cos(a + 0.1) * 120, Math.sin(a + 0.1) * 120); g.lineTo(Math.cos(a + 0.2) * 88, Math.sin(a + 0.2) * 88); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function sm() {
  const m = mats();
  if (!SM) {
    const std = (o) => new THREE.MeshStandardMaterial(o);
    SM = {
      blade: std({ color: 0xf2f5fa, metalness: 0.95, roughness: 0.13 }),       // polished blade flats
      fuller: std({ color: 0xe8ecf2, metalness: 0.95, roughness: 0.18 }),      // the groove, a touch more satin
      mirror: std({ color: 0xffffff, metalness: 1, roughness: 0.05 }),         // ground edge bevels
      plate: std({ color: 0xf0f3f8, metalness: 0.94, roughness: 0.16 }),       // polished shield steel
      brushed: std({ color: 0xe4e8ee, metalness: 0.95, roughness: 0.6, roughnessMap: brushTexture() }),
      chrome: std({ color: 0xffffff, metalness: 0.96, roughness: 0.05 }),
      satin: std({ color: 0xdde2e9, metalness: 0.92, roughness: 0.3 }),        // satin fittings
      black: std({ color: 0x2a2d33, metalness: 0.9, roughness: 0.42 }),        // blackened steel
      blued: std({ color: 0x5a6fa8, metalness: 0.85, roughness: 0.28 }),        // blued steel
      engraved: std({ map: sunburstTexture(), metalness: 0.9, roughness: 0.2 }),
      leatherDark: std({ map: grainTexture('#4a2e1a', '#1a0c05', 140), roughness: 0.75 }),
      leatherFace: std({ map: grainTexture('#5e3c22', '#24120a', 220, 512, 512), roughness: 0.7 }),
    };
    SM.leatherFace.map.repeat.set(6, 1);
  }
  const env = m.edge.envMap;
  if (env !== ENV_SEEN) { ENV_SEEN = env; for (const k of Object.keys(ENV_K)) { SM[k].envMap = env; SM[k].envMapIntensity = ENV_K[k]; SM[k].needsUpdate = true; } }
  return SM;
}

// ---------- geometry helpers ----------
const axisX = (g) => g.rotateZ(-Math.PI / 2);                                   // lathe/cylinder axis +Y -> +X
const sphere = (r, x, y, z, w = 10, h = 7) => at(new THREE.SphereGeometry(r, w, h), x, y, z);
const box = (w, h, d, x, y, z) => at(new THREE.BoxGeometry(w, h, d), x, y, z);  // w along x, h along y, d along z
const torusX = (r, tube, x, y, z, seg = 48, rad = 8) => at(new THREE.TorusGeometry(r, tube, rad, seg).rotateY(Math.PI / 2), x, y, z);
const V2 = (p) => p.map(([r, x]) => new THREE.Vector2(r, x));
// Turned plate: `front` = [[radius, x], ...] from the centre (r = 0) out to the rim; the back follows it `t` behind.
// The lathe runs up the back from the centre, over the rim and back in across the front so its faces point outward.
const turned = (front, t, seg = 56) => axisX(new THREE.LatheGeometry(V2([...front.map(([r, x]) => [r, x - t]), ...front.slice().reverse()]), seg));
// Flat annular band, from r0 to r1, between x0 (back) and x1 (front).
const band = (r0, r1, x0, x1, seg = 56) => axisX(new THREE.LatheGeometry(V2([[r0, x0], [r1, x0], [r1, x1], [r0, x1], [r0, x0]]), seg));
// Gently convex face: the front of a plate of thickness t that swells `b` at the centre, with fx(r) its surface height.
const swell = (R, t, b) => { const fx = (r) => t + b * (1 - (r / R) * (r / R)); return { fx, front: [0, 0.35, 0.65, 0.85, 1].map((k) => [k * R, fx(k * R)]) }; };
// Domed boss: a half sphere of radius r, `h` tall, standing on the plane x = x0.
const dome = (r, h, x0, w = 20, hs = 11) => axisX(new THREE.SphereGeometry(r, w, hs, 0, Math.PI * 2, 0, Math.PI / 2)).scale(h / r, 1, 1).translate(x0, 0, 0);
const cone = (r, h, x0, seg = 24) => axisX(new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0)).translate(x0, 0, 0);
const pol = (r, a) => [Math.sin(a) * r, Math.cos(a) * r];                       // [y, z] on the shield at radius r
const rivets = (Q, n, r, x, mat, rad = 0.0065, phase = 0) => { for (let i = 0; i < n; i++) { const [y, z] = pol(r, phase + (i / n) * Math.PI * 2); Q.push([sphere(rad, x, y, z, 7, 5), mat]); } };
// Grip bar across the back (the hand sits behind the boss).
const gripBar = (Q, m, len = 0.5, x = -0.014) => Q.push([at(new THREE.CylinderGeometry(0.013, 0.013, len, 8).rotateX(Math.PI / 2), x, 0, 0), m.wood]);
// Disc with a wavy (scalloped) outline, extruded with a rounded bevel, front toward +X.
function scalloped(R, amp, lobes, t, x0) {
  const sh = new THREE.Shape();
  for (let i = 0; i <= 160; i++) { const a = (i / 160) * Math.PI * 2, r = R - amp + amp * Math.cos(lobes * a); i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 8 });
  return g.rotateY(Math.PI / 2).translate(x0 + 0.004, 0, 0);
}

// ---------- blade helpers ----------
const BM = (s) => ({ edge: s.mirror, steel: s.blade, steelDark: s.fuller });
// Double-edged blade from stations [[z, half-width, half-thickness, fuller half-width], ...].
const dbl = (S, s, fd = 0.002) => bladeParts(S.map((x) => x[0]), S.map(([, w, t, fw]) => ringD(w, t, w * 0.3, fw, Math.min(fd, t * 0.4))), TAG_D, BM(s));
// Stations for a blade from z0 to the tip L: w half-width at the base, fw fuller half-width (0 = none), t half-thickness,
// `taper` the width left at three quarters, `tip` how long the point is.
function stations(z0, L, w, fw, t = 0.006, taper = 0.8, tip = 0.08) {
  const q = (k) => z0 + (L - tip - z0) * k;
  return [[z0, w, t, 0], [z0 + 0.02, w, t, fw], [q(0.45), w * 0.97, t, fw], [q(0.75), w * taper, t * 0.9, fw * 0.75], [L - tip, w * 0.62, t * 0.65, fw * 0.4], [L - tip * 0.35, w * 0.3, t * 0.35, 0], [L, 0, 0, 0]];
}
// Diamond-section blade (a stiff thrusting ridge), no fuller.
const diamond = (S, s) => bladeParts(S.map((x) => x[0]), S.map(([, w, t]) => diamondRing(w, t, w * 0.25)), TAG_X, BM(s));
const wheelPommel = (z, r, mat) => [lathe([[0, z - r * 0.8], [r * 0.4, z - r * 0.8], [r, z - r * 0.4], [r, z + r * 0.4], [r * 0.55, z + r * 0.8], [0, z + r * 0.8]], 16), mat];
const discPommel = (z, r, mat) => [lathe([[0, z - 0.009], [r * 0.8, z - 0.009], [r, z - 0.004], [r, z + 0.004], [r * 0.8, z + 0.009], [0, z + 0.009]], 16), mat];
const lobedPommel = (P, z, mat) => P.push([sphere(0.021, 0, 0, z, 10, 8), mat], [sphere(0.013, 0.03, 0, z + 0.008, 8, 6), mat], [sphere(0.013, -0.03, 0, z + 0.008, 8, 6), mat]);
const nutPommel = (z, mat) => [at(new THREE.SphereGeometry(0.021, 12, 8).scale(1.7, 0.75, 1.0), 0, 0, z), mat];
const scentStopper = (z, mat) => [lathe([[0, z - 0.03], [0.012, z - 0.03], [0.02, z - 0.01], [0.02, z + 0.012], [0.012, z + 0.024], [0, z + 0.024]], 8), mat];
const bar = (z, len, mat, h = 0.012, d = 0.016) => [at(new THREE.BoxGeometry(len, h, d), 0, 0, z), mat];
// Quillons that curve toward the blade (dip > 0) or the pommel (dip < 0), with ball terminals.
function curvedGuard(P, z, len, dip, mat, r = 0.0065) {
  const h = len / 2;
  P.push([sweep([[-h, 0, z + dip], [-h * 0.5, 0, z + dip * 0.25], [0, 0, z], [h * 0.5, 0, z + dip * 0.25], [h, 0, z + dip]], [r, r * 1.15, r * 1.25, r * 1.15, r], 8), mat]);
  for (const sx of [-1, 1]) P.push([sphere(r * 1.3, sx * h, 0, z + dip, 8, 6), mat]);
}

// ================= VARIANTS =================
// 1. Plain polished disc, domed boss, riveted rim band. Classic viking sword: fuller, short guard, lobed brass pommel, leather grip.
function silver1() {
  const m = mats(), s = sm(), P = [], Q = [], R = 0.35, { fx, front } = swell(R, 0.012, 0.02);
  P.push(...dbl(stations(0.065, 0.72, 0.031, 0.011), s));
  P.push(bar(0.052, 0.095, s.satin, 0.017, 0.022), bar(-0.112, 0.078, s.satin, 0.015, 0.018));
  lobedPommel(P, -0.136, m.brass);
  wrapped(P, -0.102, 0.042, [[-0.102, 0.0145], [-0.03, 0.0165], [0.042, 0.015]], m.leather, m.cord, 9);
  Q.push([turned(front, 0.012), s.plate]);
  Q.push([band(R - 0.045, R, 0.01, fx(R - 0.045) + 0.004), s.satin]);
  rivets(Q, 16, R - 0.022, fx(R - 0.022) + 0.005, s.satin, 0.0065, Math.PI / 16);
  Q.push([band(0, 0.105, 0.02, fx(0.1) + 0.004), s.satin], [dome(0.085, 0.085, fx(0.1) + 0.004), s.plate]);
  rivets(Q, 6, 0.096, fx(0.1) + 0.006, m.brass, 0.006);
  gripBar(Q, m);
  return { parts: P, reach: 0.72, support: null, twoHanded: false, shield: { parts: Q, size: 2 * R } };
}

// 2. Brushed steel with eight raised radial ribs and a low boss. Broad unfullered blade, steel disc pommel, cord grip.
function silver2() {
  const m = mats(), s = sm(), P = [], Q = [], R = 0.34;
  P.push(...dbl(stations(0.06, 0.7, 0.034, 0, 0.0058, 0.85, 0.07), s));
  curvedGuard(P, 0.05, 0.19, 0.016, s.satin, 0.007);
  P.push(discPommel(-0.128, 0.024, s.satin));
  wrapped(P, -0.108, 0.04, [[-0.108, 0.014], [-0.03, 0.016], [0.04, 0.0145]], s.leatherDark, m.cord, 12, 0.0032, true);
  Q.push([turned([[0, 0.012], [R, 0.012]], 0.012, 64), s.brushed]);
  Q.push([torusX(R - 0.004, 0.009, 0.01, 0, 0), s.satin]);
  for (let i = 0; i < 8; i++) Q.push([box(0.012, 0.03, R - 0.11, 0.015, 0, 0.1 + (R - 0.11) / 2 - 0.005).rotateX((i / 8) * Math.PI * 2), s.plate]);
  rivets(Q, 8, R - 0.03, 0.019, s.satin, 0.007);
  Q.push([dome(0.09, 0.055, 0.012, 24, 8), s.plate], [sphere(0.016, 0.07, 0, 0, 10, 8), s.plate]);
  gripBar(Q, m);
  return { parts: P, reach: 0.7, support: null, twoHanded: false, shield: { parts: Q, size: 2 * R } };
}

// 3. Concentric stepped rings (target style) rising to a central dome. Long narrow fullered blade, brass bar guard, wheel pommel.
function silver3() {
  const m = mats(), s = sm(), P = [], Q = [], R = 0.345;
  P.push(...dbl(stations(0.075, 0.82, 0.026, 0.009, 0.0058, 0.78, 0.09), s));
  P.push(bar(0.062, 0.19, m.brass, 0.011, 0.014));
  for (const sx of [-1, 1]) P.push([sphere(0.009, sx * 0.095, 0, 0.062, 8, 6), m.brass]);
  P.push(wheelPommel(-0.125, 0.024, m.brass));
  wrapped(P, -0.1, 0.055, [[-0.1, 0.0135], [-0.02, 0.016], [0.055, 0.0145]], m.leather, m.brass, 14, 0.0025, true);
  Q.push([turned([[0, 0.012], [R, 0.012]], 0.012), s.plate]);
  for (const [r0, r1, h] of [[0.27, R - 0.015, 0.008], [0.195, 0.245, 0.011], [0.12, 0.165, 0.014], [0.0, 0.095, 0.017]]) Q.push([band(r0, r1, 0.01, 0.012 + h), s.plate]);
  Q.push([dome(0.07, 0.06, 0.029), s.plate]);
  rivets(Q, 12, 0.305, 0.021, s.satin, 0.006);
  gripBar(Q, m);
  return { parts: P, reach: 0.82, support: null, twoHanded: false, shield: { parts: Q, size: 2 * R } };
}

// 4. Scalloped edge (twelve rounded lobes) with a raised inner ring and a small boss. Leaf-wide blade, down-curved guard, brass pommel.
function silver4() {
  const m = mats(), s = sm(), P = [], Q = [], R = 0.36;
  P.push(...dbl(stations(0.07, 0.74, 0.03, 0.01, 0.006, 0.9, 0.1), s));
  curvedGuard(P, 0.058, 0.2, 0.03, s.satin);
  P.push(nutPommel(-0.128, m.brass));
  wrapped(P, -0.102, 0.048, [[-0.102, 0.014], [-0.025, 0.0165], [0.048, 0.0145]], m.leather, m.cord, 10);
  Q.push([scalloped(R, 0.02, 12, 0.012, 0), s.satin]);
  Q.push([turned([[0, 0.034], [0.1, 0.031], [0.2, 0.022], [0.27, 0.016]], 0.004), s.plate]);      // swelling inner field
  Q.push([band(0.17, 0.2, 0.02, 0.032), s.satin], [torusX(0.275, 0.006, 0.017, 0, 0), s.satin]);
  rivets(Q, 12, 0.185, 0.034, s.satin, 0.006, Math.PI / 12);
  Q.push([dome(0.07, 0.07, 0.033, 20, 10), s.plate]);
  gripBar(Q, m);
  return { parts: P, reach: 0.74, support: null, twoHanded: false, shield: { parts: Q, size: 2 * R } };
}

// 5. Heavy spiked boss and two rows of domed studs on a thick rim. Short broad blade, blackened cross and pommel.
function silver5() {
  const m = mats(), s = sm(), P = [], Q = [], R = 0.355, { fx, front } = swell(R, 0.014, 0.015);
  P.push(...dbl(stations(0.06, 0.66, 0.034, 0, 0.0065, 0.9, 0.07), s));
  P.push(bar(0.048, 0.2, s.black, 0.02, 0.024));
  for (const sx of [-1, 1]) P.push([box(0.024, 0.024, 0.024, sx * 0.1, 0, 0.048), s.black]);
  P.push([lathe([[0, -0.145], [0.017, -0.145], [0.026, -0.13], [0.026, -0.108], [0, -0.108]], 10), s.black]);
  wrapped(P, -0.105, 0.036, [[-0.105, 0.015], [-0.03, 0.017], [0.036, 0.0155]], m.leather, s.black, 8, 0.004);
  Q.push([turned(front, 0.014), s.plate]);
  Q.push([band(R - 0.06, R, 0.012, fx(R - 0.06) + 0.006), s.satin]);
  rivets(Q, 16, R - 0.018, fx(R - 0.06) + 0.006, s.plate, 0.011);
  rivets(Q, 16, R - 0.048, fx(R - 0.06) + 0.006, s.plate, 0.011, Math.PI / 16);
  const bx = fx(0.12) + 0.004;
  Q.push([band(0, 0.125, 0.02, bx), s.black], [dome(0.105, 0.085, bx, 24, 10), s.plate]);
  Q.push([band(0, 0.045, bx + 0.07, bx + 0.085), s.black], [cone(0.036, 0.15, bx + 0.08), s.mirror]);     // the spike on a blackened collar
  for (let i = 0; i < 6; i++) Q.push([cone(0.016, 0.085, 0, 12).rotateZ(0.95).translate(bx + 0.015, 0.1, 0).rotateX((i / 6) * Math.PI * 2 + Math.PI / 6), s.mirror]); // six spikes splayed round the boss
  gripBar(Q, m);
  return { parts: P, reach: 0.66, support: null, twoHanded: false, shield: { parts: Q, size: 2 * R } };
}

// 6. Engraved sunburst (etched rays and circles) round a low boss. All-steel hilt with a brass-wire grip.
function silver6() {
  const m = mats(), s = sm(), P = [], Q = [], R = 0.345;
  P.push(...dbl(stations(0.07, 0.76, 0.028, 0.008, 0.0058, 0.8, 0.09), s));
  curvedGuard(P, 0.058, 0.18, -0.02, s.satin, 0.006);
  P.push([sphere(0.023, 0, 0, -0.128, 12, 9), s.satin], [lathe([[0, -0.108], [0.016, -0.108], [0.016, -0.1], [0, -0.1]], 12), s.satin]);
  wrapped(P, -0.1, 0.05, [[-0.1, 0.0135], [-0.025, 0.0155], [0.05, 0.014]], s.satin, m.brass, 18, 0.0022, true);
  Q.push([turned([[0, 0.012], [R, 0.012]], 0.012), s.plate]);
  Q.push([at(new THREE.CircleGeometry(R - 0.012, 64).rotateY(Math.PI / 2), 0.0128, 0, 0), s.engraved]);
  Q.push([torusX(R - 0.006, 0.007, 0.011, 0, 0), s.satin]);
  Q.push([dome(0.05, 0.045, 0.013, 20, 10), s.plate], [band(0, 0.058, 0.01, 0.016), s.satin]);
  rivets(Q, 8, 0.31, 0.017, s.satin, 0.0055, Math.PI / 8);
  gripBar(Q, m);
  return { parts: P, reach: 0.76, support: null, twoHanded: false, shield: { parts: Q, size: 2 * R } };
}

// 7. Wheel: a thick rounded rim, a domed hub and eight round spokes over a polished backing disc. Diamond-section blade, ring guard.
function silver7() {
  const m = mats(), s = sm(), P = [], Q = [], R = 0.36;
  const z0 = 0.075, L = 0.8, q = (k) => z0 + (L - 0.1 - z0) * k;
  P.push(...diamond([[z0, 0.026, 0.0065], [q(0.4), 0.025, 0.0065], [q(0.75), 0.02, 0.006], [L - 0.1, 0.014, 0.0045], [L - 0.03, 0.006, 0.002], [L, 0, 0]], s));
  P.push(bar(0.06, 0.17, s.satin, 0.01, 0.012));
  P.push([at(new THREE.TorusGeometry(0.03, 0.0045, 7, 20).rotateX(Math.PI / 2), 0, 0, 0.095), s.satin]);  // side ring over the ricasso
  P.push([sphere(0.02, 0, 0, -0.126, 12, 9), s.satin]);
  wrapped(P, -0.105, 0.052, [[-0.105, 0.0135], [-0.03, 0.0155], [0.052, 0.014]], m.leather, m.cord, 10);
  Q.push([turned(swell(R - 0.02, 0.01, 0.015).front, 0.01, 64), s.plate]);
  Q.push([torusX(R - 0.03, 0.03, 0.012, 0, 0, 56, 12), s.plate]);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, [y, z] = pol(R - 0.04, a), [y0, z0b] = pol(0.08, a); Q.push([rod([0.03, y0, z0b], [0.03, y, z], 0.014, 10), s.satin]); }
  rivets(Q, 8, R - 0.03, 0.042, s.satin, 0.009);
  Q.push([dome(0.1, 0.075, 0.02, 24, 10), s.plate], [sphere(0.02, 0.09, 0, 0, 10, 8), s.mirror]);
  gripBar(Q, m);
  return { parts: P, reach: L, support: null, twoHanded: false, shield: { parts: Q, size: 2 * R } };
}

// 8. Chrome mirror disc with a blued-steel cross and chrome boss. Chrome blade, blued guard and pommel.
function silver8() {
  const m = mats(), s = sm(), P = [], Q = [], R = 0.34, { fx, front } = swell(R, 0.012, 0.025);
  P.push(...dbl(stations(0.065, 0.78, 0.029, 0.009, 0.006, 0.8, 0.09), { blade: s.chrome, fuller: s.blade, mirror: s.chrome }));
  P.push(bar(0.054, 0.2, s.blued, 0.012, 0.018));
  for (const sx of [-1, 1]) P.push([sphere(0.01, sx * 0.1, 0, 0.054, 8, 6), s.blued]);
  P.push(scentStopper(-0.13, s.blued));
  wrapped(P, -0.1, 0.044, [[-0.1, 0.014], [-0.028, 0.016], [0.044, 0.0145]], s.blued, s.chrome, 12, 0.0028);
  Q.push([turned(front, 0.012, 64), s.chrome]);
  Q.push([torusX(R - 0.004, 0.008, 0.011, 0, 0), s.blued]);
  const arm = (yl, zl) => { const g = new THREE.BoxGeometry(0.01, yl, zl, 1, yl > zl ? 24 : 1, zl > yl ? 24 : 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getY(i), p.getZ(i)); p.setX(i, p.getX(i) + fx(Math.min(R, r)) + 0.004); } g.computeVertexNormals(); return g; };
  Q.push([arm(0.075, 0.6), s.blued], [arm(0.6, 0.075), s.blued]);                                      // the cross follows the swell
  for (const [y, z] of [[0.27, 0], [-0.27, 0], [0, 0.27], [0, -0.27]]) Q.push([sphere(0.009, fx(0.27) + 0.006, y, z, 8, 6), s.chrome]);
  Q.push([dome(0.075, 0.075, fx(0) + 0.004), s.chrome]);
  gripBar(Q, m);
  return { parts: P, reach: 0.78, support: null, twoHanded: false, shield: { parts: Q, size: 2 * R } };
}

// 9. Dished (concave) shield with a tall cone boss and a rolled rim. Long narrow blade, long straight guard, ball pommel.
function silver9() {
  const m = mats(), s = sm(), P = [], Q = [], R = 0.35;
  P.push(...dbl(stations(0.08, 0.85, 0.024, 0.008, 0.0055, 0.78, 0.1), s));
  P.push(bar(0.066, 0.24, s.satin, 0.01, 0.013));
  for (const sx of [-1, 1]) P.push([sphere(0.008, sx * 0.12, 0, 0.066, 8, 6), s.satin]);
  P.push([sphere(0.021, 0, 0, -0.125, 12, 9), s.satin]);
  wrapped(P, -0.1, 0.06, [[-0.1, 0.013], [-0.02, 0.015], [0.06, 0.0135]], m.leather, m.cord, 12);
  const dish = (r) => 0.075 * (r / R) * (r / R);                                                     // the front sinks toward the centre
  Q.push([turned([[0, 0.012], [0.1, 0.012 + dish(0.1)], [0.2, 0.012 + dish(0.2)], [0.28, 0.012 + dish(0.28)], [R, 0.012 + dish(R)]], 0.012, 64), s.plate]);
  Q.push([torusX(R - 0.004, 0.011, 0.014 + dish(R), 0, 0), s.satin]);
  Q.push([band(0, 0.095, 0.01, 0.022), s.satin], [cone(0.085, 0.2, 0.02, 28), s.plate], [sphere(0.012, 0.215, 0, 0, 8, 6), s.mirror]);
  rivets(Q, 6, 0.085, 0.024, s.satin, 0.006);
  rivets(Q, 12, R - 0.03, 0.016 + dish(R - 0.03), s.satin, 0.006, Math.PI / 12);
  gripBar(Q, m);
  return { parts: P, reach: 0.85, support: null, twoHanded: false, shield: { parts: Q, size: 2 * R } };
}

// 10. Wide polished steel rim over a dark leather face, a silver boss and a Celtic ring of interlaced circles. Leather grip, brass disc pommel.
function silver10() {
  const m = mats(), s = sm(), P = [], Q = [], R = 0.355;
  P.push(...dbl(stations(0.065, 0.74, 0.03, 0.01, 0.006, 0.82, 0.08), s));
  curvedGuard(P, 0.052, 0.17, 0.012, s.satin, 0.007);
  P.push(discPommel(-0.13, 0.026, m.brass));
  wrapped(P, -0.105, 0.04, [[-0.105, 0.0145], [-0.03, 0.0165], [0.04, 0.015]], s.leatherDark, m.cord, 9);
  Q.push([turned([[0, 0.012], [R, 0.012]], 0.012), s.plate]);
  Q.push([turned([[0, 0.0145], [0.265, 0.0145]], 0.002, 56), s.leatherFace]);
  Q.push([turned([[0.26, 0.026], [0.3, 0.024], [R, 0.014]], 0.012), s.plate], [band(0.255, 0.262, 0.012, 0.026), s.plate]); // rounded rim band, its inner wall closed
  rivets(Q, 16, 0.3, 0.028, m.brass, 0.0065, Math.PI / 16);
  Q.push([torusX(0.18, 0.008, 0.016, 0, 0, 56), s.plate]);
  for (let i = 0; i < 4; i++) { const [y, z] = pol(0.18, (i / 4) * Math.PI * 2 + Math.PI / 4); Q.push([torusX(0.05, 0.007, 0.018, y, z, 28), s.plate]); }
  Q.push([dome(0.075, 0.075, 0.018), s.plate], [band(0, 0.092, 0.012, 0.0185), s.plate]);
  gripBar(Q, m);
  return { parts: P, reach: 0.74, support: null, twoHanded: false, shield: { parts: Q, size: 2 * R } };
}

// Nutty's pick (2026-11-04): the plain polished disc of #1 with the sunburst pair's curved-guard sword from #6.
// It replaces the painted viking pair on the Weapon Wall under the same id.
function silverPick() {
  const a = silver1(), b = silver6();
  return { parts: b.parts, reach: b.reach, support: null, twoHanded: false, shield: a.shield };
}
export const SILVER_VARIANTS = { silver1, silver2, silver3, silver4, silver5, silver6, silver7, silver8, silver9, silver10, viking: silverPick };
