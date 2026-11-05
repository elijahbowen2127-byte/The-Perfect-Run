// Procedural models: players/NPCs, weapons, mobs, bosses, the Demon Huntress.
// Models face +Z. Each returns a THREE.Group with userData.anim(state, dt, t).
import * as THREE from 'three';
import { MOBS } from './data.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { iceGeo, rockMaterial } from './elements.js';
import * as TX from './textures.js';

const ni = (g) => (g.index ? g.toNonIndexed() : g);
function merge(list) {
  const m = mergeGeometries(list.map((g) => {
    g = ni(g);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    return g;
  }));
  m.computeVertexNormals();
  return m;
}
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1, ...o });
const glowMat = (c, i = 2.5) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.4 });

// Animation helpers: frame-rate independent smoothing and smooth steps.
const ss = THREE.MathUtils.smoothstep;
const damp = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));

function limb(r, len, mat, seg = 6) {
  const pivot = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, seg).translate(0, -len / 2 - r * 0.5, 0), mat);
  m.castShadow = true;
  pivot.add(m);
  return pivot;
}

// ---------------- Weapons ----------------
const metal = std({ color: 0x8a8f99, metalness: 0.9, roughness: 0.28 });
const darkMetal = std({ color: 0x24262b, metalness: 0.8, roughness: 0.4 });
const wood = std({ color: 0x5a3a22, roughness: 0.75 });
const grip = std({ color: 0x1a1414, roughness: 0.9 });

export function makeWeapon(id) {
  const g = new THREE.Group();
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  let muzzle = new THREE.Vector3(0, 0, 0.5);
  switch (id) {
    case 'knife':
      add(new THREE.BoxGeometry(0.035, 0.06, 0.32), metal, 0, 0, 0.2);
      add(new THREE.BoxGeometry(0.04, 0.05, 0.14), grip, 0, 0, -0.02);
      break;
    case 'sword':
      add(new THREE.BoxGeometry(0.03, 0.09, 1.05), metal, 0, 0, 0.62);
      add(new THREE.BoxGeometry(0.32, 0.05, 0.06), darkMetal, 0, 0, 0.08);
      add(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 6).rotateX(Math.PI / 2), grip, 0, 0, -0.05);
      break;
    case 'spear':
      add(new THREE.CylinderGeometry(0.025, 0.025, 2.1, 6).rotateX(Math.PI / 2), wood, 0, 0, 0.45);
      add(new THREE.ConeGeometry(0.06, 0.35, 4).rotateX(Math.PI / 2), metal, 0, 0, 1.65);
      break;
    case 'axe':
      add(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6).rotateX(Math.PI / 2), wood, 0, 0, 0.3);
      add(new THREE.BoxGeometry(0.04, 0.38, 0.26), metal, 0, 0.14, 0.7);
      break;
    case 'pistol':
      add(new THREE.BoxGeometry(0.05, 0.08, 0.26), darkMetal, 0, 0.03, 0.1);
      add(new THREE.BoxGeometry(0.045, 0.14, 0.06), grip, 0, -0.06, 0.0).rotation.x = 0.25;
      muzzle = new THREE.Vector3(0, 0.04, 0.25);
      break;
    case 'revolver':
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8).rotateX(Math.PI / 2), metal, 0, 0.05, 0.2);
      add(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 8).rotateX(Math.PI / 2), metal, 0, 0.03, 0.03);
      add(new THREE.BoxGeometry(0.045, 0.15, 0.06), wood, 0, -0.06, -0.04).rotation.x = 0.35;
      muzzle = new THREE.Vector3(0, 0.05, 0.36);
      break;
    case 'smg':
      add(new THREE.BoxGeometry(0.06, 0.1, 0.4), darkMetal, 0, 0.03, 0.12);
      add(new THREE.BoxGeometry(0.04, 0.2, 0.05), darkMetal, 0, -0.1, 0.18);
      add(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 6).rotateX(Math.PI / 2), metal, 0, 0.04, 0.38);
      add(new THREE.BoxGeometry(0.045, 0.12, 0.05), grip, 0, -0.06, -0.02);
      muzzle = new THREE.Vector3(0, 0.04, 0.46);
      break;
    case 'ar':
      add(new THREE.BoxGeometry(0.07, 0.11, 0.62), darkMetal, 0, 0.03, 0.18);
      add(new THREE.BoxGeometry(0.05, 0.2, 0.08), darkMetal, 0, -0.1, 0.2).rotation.x = -0.2;
      add(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 6).rotateX(Math.PI / 2), metal, 0, 0.04, 0.62);
      add(new THREE.BoxGeometry(0.05, 0.12, 0.26), darkMetal, 0, 0.0, -0.22);
      add(new THREE.BoxGeometry(0.03, 0.04, 0.18), metal, 0, 0.11, 0.1);
      muzzle = new THREE.Vector3(0, 0.04, 0.78);
      break;
    case 'shotgun':
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8).rotateX(Math.PI / 2), darkMetal, 0, 0.05, 0.38);
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.25, 8).rotateX(Math.PI / 2), wood, 0, 0.0, 0.42);
      add(new THREE.BoxGeometry(0.06, 0.1, 0.3), wood, 0, -0.01, -0.15);
      muzzle = new THREE.Vector3(0, 0.05, 0.8);
      break;
    case 'dmr':
      add(new THREE.BoxGeometry(0.06, 0.1, 0.8), darkMetal, 0, 0.03, 0.22);
      add(new THREE.CylinderGeometry(0.016, 0.016, 0.4, 6).rotateX(Math.PI / 2), metal, 0, 0.04, 0.8);
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 10).rotateX(Math.PI / 2), darkMetal, 0, 0.13, 0.18);
      add(new THREE.BoxGeometry(0.05, 0.13, 0.3), wood, 0, -0.01, -0.3);
      muzzle = new THREE.Vector3(0, 0.04, 1.0);
      break;
  }
  g.userData.muzzle = muzzle;
  return g;
}

// ---------------- Humanoid (players, NPCs) ----------------
export function makeHumanoid({ color = 0x666666, accent = 0xffffff, skin = 0xc89a7a, cape = true, hood = false, scale = 1 } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const armor = std({ color, roughness: 0.45, metalness: 0.55 });
  const cloth = std({ color: new THREE.Color(color).multiplyScalar(0.55), roughness: 0.9 });
  const skinM = std({ color: skin, roughness: 0.7 });
  const glow = glowMat(accent, 3);

  const torso = new THREE.Mesh(merge([
    new THREE.CapsuleGeometry(0.27, 0.42, 4, 10).translate(0, 1.32, 0),
    new THREE.BoxGeometry(0.5, 0.3, 0.3).translate(0, 1.42, 0.04),
  ]), armor);
  torso.castShadow = true;
  body.add(torso);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.1, 12), darkMetal);
  belt.position.y = 1.04;
  body.add(belt);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), glow);
  core.position.set(0, 1.45, 0.24);
  body.add(core);
  const pads = new THREE.Mesh(merge([
    new THREE.SphereGeometry(0.14, 10, 8).scale(1.2, 0.8, 1).translate(-0.33, 1.6, 0),
    new THREE.SphereGeometry(0.14, 10, 8).scale(1.2, 0.8, 1).translate(0.33, 1.6, 0),
  ]), armor);
  pads.castShadow = true;
  body.add(pads);

  const head = new THREE.Group();
  head.position.y = 1.78;
  body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), skinM);
  skull.castShadow = true;
  head.add(skull);
  const helm = new THREE.Mesh(hood
    ? new THREE.SphereGeometry(0.21, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62).translate(0, 0.02, -0.02)
    : new THREE.SphereGeometry(0.2, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hood ? cloth : armor);
  helm.castShadow = true;
  head.add(helm);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.05), glow);
  visor.position.set(0, 0.02, 0.16);
  head.add(visor);

  const armL = limb(0.08, 0.5, armor), armR = limb(0.08, 0.5, armor);
  armL.position.set(-0.36, 1.58, 0);
  armR.position.set(0.36, 1.58, 0);
  body.add(armL, armR);
  const handR = new THREE.Group();
  handR.position.set(0, -0.68, 0.02);
  armR.add(handR);
  const legL = limb(0.1, 0.62, cloth), legR = limb(0.1, 0.62, cloth);
  legL.position.set(-0.14, 1.0, 0);
  legR.position.set(0.14, 1.0, 0);
  root.add(legL, legR);
  for (const l of [legL, legR]) {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.3), darkMetal);
    boot.position.set(0, -0.86, 0.05);
    boot.castShadow = true;
    l.add(boot);
  }
  let capeMesh = null;
  if (cape) {
    const cg = new THREE.PlaneGeometry(0.62, 1.1, 1, 6).translate(0, -0.55, 0);
    capeMesh = new THREE.Mesh(cg, std({ color: new THREE.Color(color).multiplyScalar(0.7), side: THREE.DoubleSide, roughness: 0.9 }));
    capeMesh.position.set(0, 1.62, -0.2);
    capeMesh.rotation.x = 0.12;
    capeMesh.castShadow = true;
    body.add(capeMesh);
  }
  root.scale.setScalar(scale);

  let weapon = null, weaponId = null;
  const anim_ = { sp: 0, ph: Math.random() * 6.28, seed: Math.random() * 6.28, lean: 0, head: 0, dead: 0, init: false };
  root.userData = {
    head, armL, armR, legL, legR, body, handR, core, cape: capeMesh,
    setWeapon(id) {
      if (id === weaponId) return;
      if (weapon) handR.remove(weapon);
      weaponId = id;
      weapon = id ? makeWeapon(id) : null;
      if (weapon) handR.add(weapon);
      root.userData.weapon = weapon;
    },
    weapon: null,
    // st: {speed, pitch, melee (0..1 swing), gun, dead, t}
    // Smoothed state lives here: speed, an accumulated stride phase (so a change of speed never
    // makes the legs snap), and pose channels that ease toward their targets.
    anim(st, dt, t) {
      const S = anim_;
      dt = Math.min(dt, 0.1);
      S.sp = damp(S.sp, st.speed, 10, dt);
      const s = Math.min(1, S.sp / 8);
      // Stride rate from the real speed (cadence rises with speed, with a floor so slow walks keep time).
      S.ph += dt * (3.2 + S.sp * 0.95);
      const ph = S.ph, sw = Math.sin(ph) * 0.75 * s;
      const pitch = st.pitch || 0;
      const melee = st.melee || 0;
      // Legs: stride plus a weight shift while standing.
      const idle = 1 - s, br = Math.sin(t * 1.6 + S.seed);
      legL.rotation.x = sw + idle * 0.02 * Math.sin(t * 0.5 + S.seed);
      legR.rotation.x = -sw - idle * 0.02 * Math.sin(t * 0.5 + S.seed);
      // Body: bob at twice the stride rate, hip sway, shoulders counter-rotating against the hips, lean into speed and turns.
      S.lean = damp(S.lean, s * 0.12 + (st.crouch ? 0.15 : 0), 6, dt);
      body.position.y = Math.abs(Math.cos(ph)) * 0.05 * s + (st.crouch ? -0.1 : 0) + br * 0.004 * idle;
      body.rotation.x = S.lean + br * 0.006 * idle;
      body.rotation.y = Math.sin(ph) * 0.1 * s;
      body.rotation.z = Math.cos(ph) * 0.025 * s;
      // Arm targets per state, then eased toward so switching states never snaps.
      let rx, ry, rz, lx, ly, lz, rate = 14;
      if (melee > 0) {
        // Anticipation (draw back), fast cut with overshoot, then recovery.
        const wind = ss(melee, 0, 0.28), cut = ss(melee, 0.28, 0.5), rec = ss(melee, 0.62, 1);
        const over = Math.sin(Math.PI * ss(melee, 0.5, 0.78)) * 0.25;
        rx = -1.4 + 0.2 * wind + 0.2 * cut - pitch; ry = 0;
        rz = (-0.9 - 0.55 * wind + 3.0 * cut + over) * (1 - rec) + (-0.9 + 0.3) * rec;
        lx = -sw * 0.6; ly = 0; lz = 0.15; rate = 30;
        body.rotation.y += (-0.3 * wind + 0.55 * cut) * (1 - rec);
      } else if (st.gun) {
        const rc = st.recoil || 0;
        rx = -Math.PI / 2 - pitch + rc * 0.12; ry = 0; rz = 0;
        lx = -Math.PI / 2 - pitch + 0.1 + rc * 0.1; ly = 0; lz = 0.5;
      } else if (st.weapon) {
        rx = -0.6 - pitch * 0.5 - sw * 0.2; ry = 0; rz = 0;
        lx = -sw * 0.8; ly = 0; lz = 0.12;
      } else {
        rx = sw * 0.8 + br * 0.01; ry = 0; rz = -0.12 - idle * 0.02;
        lx = -sw * 0.8 - br * 0.01; ly = 0; lz = 0.12 + idle * 0.02;
      }
      if (st.cast > 0) { lx = -Math.PI / 2 - pitch; ly = 0; lz = 0.1; }
      if (!S.init) { armR.rotation.set(rx, ry, rz); armL.rotation.set(lx, ly, lz); S.init = true; }
      else {
        armR.rotation.set(damp(armR.rotation.x, rx, rate, dt), damp(armR.rotation.y, ry, rate, dt), damp(armR.rotation.z, rz, rate, dt));
        armL.rotation.set(damp(armL.rotation.x, lx, rate, dt), damp(armL.rotation.y, ly, rate, dt), damp(armL.rotation.z, lz, rate, dt));
      }
      // The head tracks the aim a beat behind the body.
      S.head = damp(S.head, -pitch * 0.6, 9, dt);
      head.rotation.x = S.head - body.rotation.x * 0.5;
      head.rotation.y = -body.rotation.y * 0.6;
      if (capeMesh) capeMesh.rotation.x = 0.12 + s * 0.6 + Math.sin(t * 3) * 0.04 + Math.sin(ph * 2) * 0.05 * s;
      core.rotation.y += dt * 2;
      root.rotation.z = 0;
      // Death: eased topple that lands hard and settles instead of a flat snap.
      S.dead = Math.max(0, Math.min(1, S.dead + (st.dead ? dt * 1.8 : -dt * 4)));
      if (S.dead > 0) {
        const d = S.dead, e = d * d * (1.5 - 0.5 * d), reb = d >= 1 ? 1 : 1 - 0.05 * Math.sin(d * Math.PI);
        body.rotation.x = -1.4 * e * reb; body.position.y = -0.7 * e;
        legL.rotation.x = -0.3 * e; legR.rotation.x = 0.2 * e;
      }
    },
  };
  return root;
}

export function makeNameplate(text, color = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = '600 30px Rajdhani, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.7)';
  g.strokeText(text, 128, 32);
  g.fillStyle = color;
  g.fillText(text, 128, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(2, 0.5, 1);
  s.renderOrder = 10;
  return s;
}

// ---------------- Mobs ----------------
const mobMats = new Map();
function mobMaterials(tint) {
  if (mobMats.has(tint)) return mobMats.get(tint);
  const m = {
    skin: std({ color: tint, roughness: 0.8, metalness: 0.05 }),
    dark: std({ color: new THREE.Color(tint).multiplyScalar(0.35), roughness: 0.9 }),
    eye: glowMat(0xff3a1a, 4),
    acid: glowMat(0x7dff3a, 2.5),
    bone: std({ color: 0xe0d6c0, roughness: 0.6 }),
  };
  mobMats.set(tint, m);
  return m;
}
const ghostMats = new Map();
function ghostMaterials(color) {
  if (ghostMats.has(color)) return ghostMats.get(color);
  const veil = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, transparent: true, opacity: 0.55, roughness: 0.4, depthWrite: false });
  const m = { skin: veil, dark: veil, eye: glowMat(0xffffff, 5), acid: glowMat(color, 3), bone: veil };
  ghostMats.set(color, m);
  return m;
}
const mobGeoCache = new Map();
function cachedGeo(key, fn) { if (!mobGeoCache.has(key)) mobGeoCache.set(key, fn()); return mobGeoCache.get(key); }

export function makeMob(kind, tint) {
  const def = MOBS[kind] || {};
  const type = def.model || kind;
  if (def.color) tint = new THREE.Color(def.color).lerp(new THREE.Color(tint), 0.25).getHex();
  const M = def.extra === 'ghost' ? ghostMaterials(def.color || 0x9fe8ff) : mobMaterials(tint);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  let armL, armR, legL, legR;
  const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; };
  if (type === 'spitter') {
    body.add(mesh(cachedGeo('sp-body', () => merge([new THREE.SphereGeometry(0.62, 14, 12).scale(1, 0.9, 1.1).translate(0, 1.0, 0), new THREE.SphereGeometry(0.28, 10, 8).translate(0, 1.55, 0.35)])), M.skin));
    body.add(mesh(cachedGeo('sp-sac', () => merge([new THREE.SphereGeometry(0.36, 12, 10).translate(0, 1.15, -0.5), new THREE.SphereGeometry(0.2, 10, 8).translate(0.35, 1.3, -0.35), new THREE.SphereGeometry(0.18, 10, 8).translate(-0.35, 1.2, -0.38)])), M.acid));
    body.add(mesh(cachedGeo('sp-eye', () => merge([new THREE.SphereGeometry(0.05, 6, 6).translate(-0.1, 1.6, 0.6), new THREE.SphereGeometry(0.05, 6, 6).translate(0.1, 1.6, 0.6)])), M.eye));
    legL = limb(0.11, 0.35, M.dark); legR = limb(0.11, 0.35, M.dark);
    legL.position.set(-0.3, 0.62, 0); legR.position.set(0.3, 0.62, 0);
    armL = limb(0.07, 0.4, M.skin); armR = limb(0.07, 0.4, M.skin);
    armL.position.set(-0.55, 1.2, 0.1); armR.position.set(0.55, 1.2, 0.1);
  } else {
    const brute = type === 'brute';
    const runner = type === 'runner';
    body.add(mesh(cachedGeo(type + '-torso', () => merge([
      new THREE.CapsuleGeometry(brute ? 0.4 : 0.22, brute ? 0.5 : 0.45, 4, 10).translate(0, 1.25, 0),
      new THREE.SphereGeometry(brute ? 0.22 : 0.16, 12, 10).scale(1, 1.1, 1.15).translate(0, brute ? 1.8 : 1.72, 0.12),
      new THREE.BoxGeometry(brute ? 0.2 : 0.14, 0.06, 0.16).translate(0, brute ? 1.66 : 1.6, 0.25),
    ])), M.skin));
    body.add(mesh(cachedGeo(type + '-eyes', () => merge([
      new THREE.SphereGeometry(0.035, 6, 6).translate(-0.06, brute ? 1.86 : 1.76, brute ? 0.33 : 0.29),
      new THREE.SphereGeometry(0.035, 6, 6).translate(0.06, brute ? 1.86 : 1.76, brute ? 0.33 : 0.29),
    ])), M.eye));
    body.add(mesh(cachedGeo(type + '-ribs', () => {
      const ribs = [];
      for (let i = 0; i < 4; i++) ribs.push(new THREE.TorusGeometry(brute ? 0.4 : 0.22, 0.025, 4, 10, Math.PI).rotateY(-Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 1.15 + i * 0.1, 0.02));
      if (brute) for (const s of [-1, 1]) ribs.push(new THREE.ConeGeometry(0.1, 0.5, 5).rotateZ(-s * 0.6).translate(s * 0.45, 1.75, -0.05));
      return merge(ribs);
    }), M.bone));
    const armLen = brute ? 0.7 : runner ? 0.45 : 0.62;
    armL = limb(brute ? 0.14 : 0.06, armLen, M.skin); armR = limb(brute ? 0.14 : 0.06, armLen, M.skin);
    armL.position.set(brute ? -0.55 : -0.3, 1.55, 0.05); armR.position.set(brute ? 0.55 : 0.3, 1.55, 0.05);
    for (const a of [armL, armR]) {
      const claw = mesh(cachedGeo('claw', () => merge([0, 1, 2].map((i) => new THREE.ConeGeometry(0.025, 0.18, 4).rotateX(Math.PI).translate((i - 1) * 0.04, -0.09, 0)))), M.bone);
      claw.position.y = -armLen - 0.1;
      a.add(claw);
    }
    legL = limb(brute ? 0.16 : 0.08, 0.55, M.dark); legR = limb(brute ? 0.16 : 0.08, 0.55, M.dark);
    legL.position.set(-0.14, 0.9, 0); legR.position.set(0.14, 0.9, 0);
    body.rotation.x = runner ? 0.55 : brute ? 0.2 : 0.3;
  }
  body.add(armL, armR);
  root.add(legL, legR);
  // Variant looks on top of the shared body plans.
  const hy = type === 'brute' ? 1.85 : type === 'spitter' ? 1.6 : 1.76, hz = type === 'spitter' ? 0.35 : 0.12;
  if (def.extra === 'horns') for (const sx of [-1, 1]) { const h = new THREE.Mesh(cachedGeo('horn', () => new THREE.ConeGeometry(0.05, 0.38, 6).translate(0, 0.19, 0)), M.bone); h.position.set(sx * 0.1, hy + 0.08, hz); h.rotation.set(-0.5, 0, -sx * 0.55); h.castShadow = true; body.add(h); }
  if (def.extra === 'spikes') { const sp = new THREE.Mesh(cachedGeo('spikes', () => merge([0, 1, 2, 3, 4].map((i) => new THREE.ConeGeometry(0.05, 0.3, 4).rotateX(-0.6).translate(0, 1.6 - i * 0.14, -0.2 - i * 0.02)))), M.bone); sp.castShadow = true; body.add(sp); }
  if (def.extra === 'armor') {
    const steel = std({ color: 0x3a3a40, roughness: 0.35, metalness: 0.85 });
    const plates = new THREE.Mesh(cachedGeo('armor', () => merge([
      new THREE.CylinderGeometry(0.46, 0.4, 0.55, 10, 1, true).translate(0, 1.3, 0),
      new THREE.SphereGeometry(0.25, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.86, 0.12),
      new THREE.SphereGeometry(0.2, 8, 6).scale(1.2, 0.6, 1).translate(-0.55, 1.62, 0.05),
      new THREE.SphereGeometry(0.2, 8, 6).scale(1.2, 0.6, 1).translate(0.55, 1.62, 0.05),
    ])), steel);
    plates.castShadow = true; body.add(plates);
  }
  const ghost = def.extra === 'ghost';
  if (ghost) { legL.visible = legR.visible = false; }
  const baseLean = body.rotation.x;
  const MS = { sp: 0, ph: (Math.random() * 6.28), vary: 0.92 + Math.random() * 0.16, lean: 0, atk: -1, arm: true, hit: 0 };
  root.userData = {
    anim(st, dt, t) {
      dt = Math.min(dt, 0.1);
      // Smoothed speed and an accumulated stride phase: cadence follows the real speed, per-mob variation keeps a pack out of step.
      MS.sp = damp(MS.sp, st.speed, 9, dt);
      const s = Math.min(1, MS.sp / 6);
      MS.ph += dt * (3 + MS.sp * 1.2) * MS.vary;
      const ph = MS.ph + (st.phase || 0);
      const sw = Math.sin(ph) * 0.8 * s;
      legL.rotation.x = sw; legR.rotation.x = -sw;
      // Attack on its own clock: draw back, strike fast, recover.
      const a = st.attack || 0;
      if (a > 0.7 && MS.arm) { MS.arm = false; MS.atk = 0; } else if (a < 0.3) MS.arm = true;
      let wind = 0, strike = 0;
      if (MS.atk >= 0) {
        MS.atk += dt;
        const u = MS.atk / 0.5;
        if (u >= 1) MS.atk = -1; else { wind = ss(u, 0, 0.3) * (1 - ss(u, 0.3, 0.46)); strike = ss(u, 0.3, 0.46) * (1 - ss(u, 0.55, 1)); }
      }
      armL.rotation.x = -0.9 - sw * 0.3 + wind * 0.7 - strike * 1.2;
      armR.rotation.x = -0.9 + sw * 0.3 + wind * 0.9 - strike * 1.6;
      // Lean into the chase, lunge into the strike, a flinch when hurt.
      MS.lean = damp(MS.lean, s * 0.12 + strike * 0.35 - wind * 0.12, 12, dt);
      body.rotation.x = baseLean + MS.lean;
      body.rotation.z = Math.cos(ph) * 0.04 * s;
      body.rotation.y = Math.sin(ph) * 0.08 * s;
      body.position.z = (strike * 0.25 - wind * 0.06);
      body.position.y = ghost ? 0.35 + Math.sin(t * 2.2) * 0.12 : Math.abs(Math.cos(ph)) * 0.06 * s + Math.sin(t * 1.3 + (st.phase || 0)) * 0.006 * (1 - s);
      if (st.frozen) { legL.rotation.x = legR.rotation.x = 0; }
    },
  };
  return root;
}

// ---------------- Bosses ----------------
function eyePair(y, z, sep, r, mat) {
  return [new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), mat), new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), mat)].map((m, i) => { m.position.set((i ? 1 : -1) * sep, y, z); return m; });
}

export function makeBoss(index, def) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = std({ color: def.color, roughness: 0.75, metalness: 0.15 });
  const glow = glowMat(def.glow, 3.5);
  const parts = { arms: [], legs: [], spin: [] };
  const add = (geo, mat, parent = body) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; parent.add(m); return m; };

  if (index === 2) {
    // Sandreaver: scorpion.
    for (let i = 0; i < 4; i++) add(new THREE.SphereGeometry(0.55 - i * 0.04, 12, 10).scale(1.2, 0.7, 1), skin).position.set(0, 0.8, 0.5 - i * 0.65);
    add(new THREE.SphereGeometry(0.45, 12, 10).scale(1.1, 0.7, 1), skin).position.set(0, 0.85, 1.05);
    eyePair(1.05, 1.42, 0.16, 0.06, glow).forEach((m) => body.add(m));
    const tail = new THREE.Group();
    tail.position.set(0, 0.9, -2);
    body.add(tail);
    let prev = tail;
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Group();
      seg.position.set(0, 0.35, -0.15);
      seg.rotation.x = -0.45;
      add(new THREE.SphereGeometry(0.28 - i * 0.03, 10, 8), skin, seg);
      prev.add(seg);
      prev = seg;
      parts.spin.push(seg);
    }
    add(new THREE.ConeGeometry(0.15, 0.6, 8).rotateX(-Math.PI / 2), glow, prev).position.z = 0.3;
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(s * 0.6, 0.85, 1.1);
      add(new THREE.CapsuleGeometry(0.12, 0.8, 4, 8).rotateX(Math.PI / 2).translate(0, 0, 0.5), skin, arm);
      add(new THREE.BoxGeometry(0.35, 0.18, 0.55).translate(0, 0, 1.15), skin, arm);
      arm.rotation.y = -s * 0.4;
      body.add(arm);
      parts.arms.push(arm);
      for (let k = 0; k < 3; k++) {
        const leg = new THREE.Group();
        leg.position.set(s * 0.6, 0.8, 0.3 - k * 0.6);
        add(new THREE.CapsuleGeometry(0.06, 0.9, 3, 6).translate(0, -0.45, 0), skin, leg);
        leg.rotation.z = s * 0.9;
        body.add(leg);
        parts.legs.push(leg);
      }
    }
  } else if (index === 3) {
    // Rimefang: ice beast.
    add(new THREE.CapsuleGeometry(0.55, 1.4, 6, 12).rotateX(Math.PI / 2), skin).position.set(0, 1.3, 0);
    const head = new THREE.Group();
    head.position.set(0, 1.55, 1.2);
    body.add(head);
    add(new THREE.SphereGeometry(0.42, 14, 12).scale(0.9, 0.85, 1.2), skin, head);
    add(new THREE.ConeGeometry(0.25, 0.6, 8).rotateX(Math.PI / 2).translate(0, -0.1, 0.55), skin, head);
    eyePair(0.12, 0.38, 0.17, 0.06, glow).forEach((m) => head.add(m));
    const ice = new THREE.MeshStandardMaterial({ color: 0xcdeeff, emissive: 0x3a8acc, emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 9; i++) {
      const sp = add(iceGeo(), ice);
      sp.position.set((i % 2 ? 0.2 : -0.2), 1.7, 0.8 - i * 0.22);
      sp.scale.setScalar(0.5 + Math.sin(i / 8 * Math.PI) * 0.5);
      sp.rotation.set(-0.5, 0, (i % 2 ? -0.4 : 0.4));
    }
    for (const [x, z] of [[-0.45, 0.8], [0.45, 0.8], [-0.45, -0.8], [0.45, -0.8]]) {
      const leg = new THREE.Group();
      leg.position.set(x, 1.1, z);
      add(new THREE.CapsuleGeometry(0.17, 0.85, 4, 8).translate(0, -0.5, 0), skin, leg);
      body.add(leg);
      parts.legs.push(leg);
    }
  } else if (index === 5) {
    // The Perfect One: floating void seraph.
    add(new THREE.ConeGeometry(0.55, 2.2, 16, 1, true).rotateX(Math.PI).translate(0, 1.6, 0), std({ color: 0x0a0612, roughness: 0.3, metalness: 0.7, side: THREE.DoubleSide }));
    add(new THREE.CapsuleGeometry(0.32, 0.6, 4, 12).translate(0, 2.7, 0), skin);
    add(new THREE.SphereGeometry(0.26, 16, 14).translate(0, 3.35, 0), std({ color: 0xf0e6ff, roughness: 0.2, metalness: 0.3 }));
    add(new THREE.BoxGeometry(0.34, 0.05, 0.05).translate(0, 3.38, 0.24), glow);
    const halo = add(new THREE.TorusGeometry(0.55, 0.04, 8, 48), glow);
    halo.position.set(0, 3.75, -0.1);
    halo.rotation.x = 0.3;
    parts.spin.push(halo);
    const ring2 = add(new THREE.TorusGeometry(1.4, 0.025, 6, 64), glow);
    ring2.position.y = 2.5;
    parts.spin.push(ring2);
    for (let i = 0; i < 6; i++) {
      const sh = add(iceGeo(), new THREE.MeshStandardMaterial({ color: 0x3a1a6a, emissive: 0xa060ff, emissiveIntensity: 1.5, flatShading: true }));
      sh.userData.orbit = i;
      sh.scale.setScalar(0.4);
      parts.spin.push(sh);
    }
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(s * 0.45, 3.0, 0);
      add(new THREE.CapsuleGeometry(0.08, 0.9, 4, 8).translate(0, -0.5, 0), skin, arm);
      body.add(arm);
      parts.arms.push(arm);
      const wing = add(new THREE.ConeGeometry(0.5, 2.6, 4, 1).scale(0.3, 1, 1).rotateZ(s * 1.0).translate(s * 1.3, 3.1, -0.3), glow);
      wing.material = new THREE.MeshStandardMaterial({ color: 0x1a0a2a, emissive: def.glow, emissiveIntensity: 0.6, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    }
    root.userData.float = true;
  } else {
    // Humanoid colossi: Gravewarden(0), Thornmother(1), Magmaw(4).
    const lava = index === 4;
    const mat = lava ? new THREE.MeshStandardMaterial({ map: TX.rockMaps([0.18, 0.14, 0.12]).map, normalMap: TX.rockMaps([0.18, 0.14, 0.12]).normalMap, emissive: 0xff4a10, emissiveMap: TX.lavaMap(), emissiveIntensity: 1.6, roughness: 0.9 }) : skin;
    add(new THREE.CapsuleGeometry(0.45, 0.8, 6, 14).translate(0, 1.55, 0), mat);
    add(new THREE.SphereGeometry(0.55, 14, 12).scale(1.3, 0.8, 0.9).translate(0, 2.05, 0), mat);
    const head = new THREE.Group();
    head.position.set(0, 2.55, 0.1);
    body.add(head);
    if (index === 0) {
      add(new THREE.SphereGeometry(0.3, 14, 12), std({ color: 0xd8d0c0, roughness: 0.6 }), head);
      add(new THREE.SphereGeometry(0.42, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.65).translate(0, 0.05, -0.05), std({ color: 0x1a1d1a, roughness: 0.95, side: THREE.DoubleSide }), head);
      add(new THREE.ConeGeometry(0.75, 1.8, 14, 1, true).translate(0, -0.9, 0), std({ color: 0x1a1d1a, roughness: 0.95, side: THREE.DoubleSide })).position.set(0, 1.6, 0);
    } else if (index === 1) {
      add(new THREE.SphereGeometry(0.3, 14, 12).scale(0.9, 1.1, 0.9), mat, head);
      const crown = [];
      for (let i = 0; i < 7; i++) crown.push(new THREE.ConeGeometry(0.06, 0.8, 5).rotateZ((i - 3) * 0.3).translate((i - 3) * 0.1, 0.5, -0.05));
      add(merge(crown), std({ color: 0x2a1f14, roughness: 0.9 }), head);
      for (let i = 0; i < 5; i++) add(new THREE.IcosahedronGeometry(0.4, 1).translate(Math.cos(i) * 0.6, 2.7 + Math.sin(i * 2) * 0.2, Math.sin(i) * 0.3 - 0.2), std({ color: 0x2f5a1f, flatShading: true }));
    } else {
      add(new THREE.SphereGeometry(0.34, 10, 8), mat, head);
    }
    eyePair(0.03, 0.27, 0.11, 0.055, glow).forEach((m) => head.add(m));
    const coreM = add(new THREE.OctahedronGeometry(0.18), glow);
    coreM.position.set(0, 1.9, 0.48);
    parts.spin.push(coreM);
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(s * 0.85, 2.15, 0);
      add(new THREE.CapsuleGeometry(0.2, 0.75, 4, 10).translate(0, -0.55, 0), mat, arm);
      const fore = new THREE.Group();
      fore.position.y = -1.1;
      add(new THREE.CapsuleGeometry(0.22, 0.7, 4, 10).translate(0, -0.45, 0), mat, fore);
      add(new THREE.SphereGeometry(0.28, 10, 8).translate(0, -0.95, 0), mat, fore);
      arm.add(fore);
      body.add(arm);
      parts.arms.push(arm);
      if (index === 0 && s > 0) {
        const lantern = add(new THREE.BoxGeometry(0.25, 0.35, 0.25), glow, fore);
        lantern.position.set(0, -1.35, 0.1);
      }
    }
    for (const s of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(s * 0.32, 1.05, 0);
      add(new THREE.CapsuleGeometry(0.22, 0.75, 4, 10).translate(0, -0.55, 0), mat, leg);
      root.add(leg);
      parts.legs.push(leg);
    }
  }
  root.scale.setScalar(def.scale);
  const B = { sp: 0, ph: Math.random() * 6.28, atk: -1, arm: true, lean: 0 };
  root.userData = {
    parts,
    anim(st, dt, t) {
      dt = Math.min(dt, 0.1);
      // Heavy things move with inertia: smoothed speed, accumulated stride phase, slow lean.
      B.sp = damp(B.sp, st.speed, 5, dt);
      const s = Math.min(1, B.sp / 5);
      B.ph += dt * (2 + B.sp * 0.8);
      const ph = B.ph;
      parts.legs.forEach((l, i) => (l.rotation.x = Math.sin(ph + i * Math.PI) * 0.5 * s));
      // Slow wind-up, hang, then a crushing strike and a long recovery.
      const a = st.attack || 0;
      if (a > 0.7 && B.arm) { B.arm = false; B.atk = 0; } else if (a < 0.3) B.arm = true;
      let up = 0, hit = 0;
      if (B.atk >= 0) {
        B.atk += dt;
        const u = B.atk / 1.0;
        if (u >= 1) B.atk = -1; else { up = ss(u, 0, 0.5) * (1 - ss(u, 0.55, 0.65)); hit = ss(u, 0.55, 0.65) * (1 - ss(u, 0.7, 1)); }
      }
      parts.arms.forEach((a2, i) => {
        a2.rotation.x = -0.25 - Math.sin(ph + i) * 0.25 * s + up * 1.4 - hit * 1.0 + Math.sin(t * 1.1 + i * 2) * 0.02;
      });
      B.lean = damp(B.lean, s * 0.06 + hit * 0.12 - up * 0.08, 6, dt);
      body.rotation.x = B.lean;
      parts.spin.forEach((m, i) => {
        if (m.userData.orbit !== undefined) {
          const a = t * 1.3 + m.userData.orbit * (Math.PI / 3);
          m.position.set(Math.cos(a) * 1.6, 2.4 + Math.sin(t * 2 + i) * 0.3, Math.sin(a) * 1.6);
          m.rotation.y += dt * 2;
        } else if (m.geometry && m.geometry.type === 'TorusGeometry') m.rotation.z += dt * (i % 2 ? 1 : -0.6);
        else if (m.geometry && m.geometry.type === 'OctahedronGeometry') m.rotation.y += dt * 2;
        else m.rotation.x = -0.45 + Math.sin(t * 2 + i * 0.4) * 0.12 - (up + hit) * 0.4;
      });
      body.position.y = (root.userData.float ? 0.6 + Math.sin(t * 1.5) * 0.25 : 0) + Math.sin(t * 2) * 0.03 + Math.abs(Math.cos(ph * 0.5)) * 0.04 * s;
    },
  };
  return root;
}

// ---------------- Death, the grim reaper (fallback when the skinned rig has not loaded) ----------------
export function makeDemon() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const cloth = std({ color: 0x0b0b12, roughness: 0.95, side: THREE.DoubleSide });
  const pale = std({ color: 0xb8b4c0, roughness: 0.6 });
  const wood = std({ color: 0x2a1c14, roughness: 0.6 });
  const steel = std({ color: 0x9aa6bc, roughness: 0.3, metalness: 0.7 });
  const glow = glowMat(0x9fb4ff, 4);
  const add = (geo, mat, parent = body) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; parent.add(m); return m; };
  add(new THREE.CylinderGeometry(0.17, 0.5, 1.45, 18, 1, true).translate(0, 0.78, 0), cloth);
  add(new THREE.CylinderGeometry(0.2, 0.19, 0.4, 14).translate(0, 1.5, 0), cloth);
  const head = new THREE.Group();
  head.position.y = 1.72;
  body.add(head);
  add(new THREE.SphereGeometry(0.17, 16, 12).scale(0.95, 1.1, 1.1), cloth, head);
  add(new THREE.ConeGeometry(0.15, 0.28, 12).rotateX(-0.6).translate(0, 0.2, -0.1), cloth, head);
  add(new THREE.SphereGeometry(0.12, 12, 10).scale(0.9, 1.05, 0.5).translate(0, -0.01, 0.1), std({ color: 0x020204, roughness: 1 }), head);
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.02, 8, 6).scale(1.6, 0.8, 0.8).translate(s * 0.045, 0.01, 0.15), glow, head);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.21, 1.58, 0);
    add(new THREE.ConeGeometry(0.11, 0.62, 10, 1, true).translate(0, -0.3, 0).rotateX(Math.PI), cloth, arm);
    add(new THREE.SphereGeometry(0.04, 8, 6).translate(0, -0.64, 0), pale, arm);
    body.add(arm);
    arms.push(arm);
  }
  // The scythe rides on the right arm: shaft, blade and all.
  const sc = new THREE.Group();
  add(new THREE.CylinderGeometry(0.02, 0.022, 2.0, 8).translate(0, 0.1, 0), wood, sc);
  const bl = new THREE.Shape();
  bl.moveTo(0, 0); bl.quadraticCurveTo(0.5, 0.32, 0.95, -0.18); bl.quadraticCurveTo(0.5, 0.1, 0, -0.1); bl.lineTo(0, 0);
  const bm = add(new THREE.ExtrudeGeometry(bl, { depth: 0.012, bevelEnabled: false }).translate(0, 1.1, -0.006).rotateY(Math.PI / 2), steel, sc);
  bm.rotation.y = 0;
  sc.position.set(0.0, -0.62, 0.12);
  sc.rotation.x = 0;
  arms[0].add(sc);
  root.scale.setScalar(1.0);
  const D = { sp: 0, lean: 0, atk: -1, arm: true };
  root.userData = {
    anim(st, dt, t) {
      dt = Math.min(dt, 0.1);
      D.sp = damp(D.sp, st.speed, 6, dt);
      body.position.y = Math.abs(Math.sin(t * 9)) * Math.min(D.sp, 8) * 0.01;
      const a = st.attack || 0;
      if (a > 0.7 && D.arm) { D.arm = false; D.atk = 0; } else if (a < 0.3) D.arm = true;
      let wind = 0, cut = 0;
      if (D.atk >= 0) {
        D.atk += dt;
        const u = D.atk / 0.6;
        if (u >= 1) D.atk = -1; else { wind = ss(u, 0, 0.3) * (1 - ss(u, 0.3, 0.45)); cut = ss(u, 0.3, 0.45) * (1 - ss(u, 0.55, 1)); }
      }
      arms[0].rotation.x = -0.5 - wind * 1.2 + cut * 1.6;
      arms[1].rotation.x = -0.4 + Math.sin(t * 1.7) * 0.03 - cut * 0.5;
      arms[0].rotation.z = 0.12 + cut * 0.2;
      D.lean = damp(D.lean, Math.min(0.3, D.sp / 28) + cut * 0.3 - wind * 0.1, 8, dt);
      body.rotation.x = D.lean;
    },
  };
  return root;
}

export function makeCampfireRock() { return rockMaterial(); }
