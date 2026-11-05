// Quill: the tinker-ranger. A warm clay figure (the mannequin rig, recoloured with darker clay
// joints) in a long cream ranger coat with coral piping, brass spectacles, a brimmed hat, a
// scholar's satchel and tools. An eight-point spark glows on the chest, floats behind the head as
// a halo ring, and a little spark companion bobs beside the shoulder. Original character; the
// spark is just a simple star shape. One skinned mesh (3 slots) + the companion.
import * as THREE from 'three';
import { makeKit, V, ell, limb, chainWeights, paint, sparkGeo } from './armor.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

export function buildQuill(scene, skin) {
  const cloth = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, roughness: 0.78, metalness: 0 });
  const metal = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, roughness: 0.32, metalness: 0.85 });
  const glow = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x100804, emissive: skin.glow, emissiveIntensity: 2.0, roughness: 0.4 });
  const kit = makeKit(scene, [cloth, metal, glow], 'quill_gear');
  const { J, add, mirror, tube } = kit;
  const torso = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck'];
  const BRASS = 0xd9a85a, DARK = 0x2a1a14;

  // ---- long ranger coat (skinned: the skirt follows each leg) ----
  {
    const ys = [1.55, 1.505, 1.45, 1.39, 1.31, 1.22, 1.12, 1.02, 0.92, 0.82, 0.72, 0.64, 0.62];
    const rx = [0.13, 0.24, 0.272, 0.265, 0.232, 0.2, 0.2, 0.222, 0.246, 0.266, 0.28, 0.288, 0.288];
    const rz = [0.11, 0.15, 0.162, 0.16, 0.15, 0.14, 0.142, 0.154, 0.166, 0.176, 0.184, 0.19, 0.19];
    const pts = ys.map((y) => V(0, y, 0.012));
    tube(0, pts, ys.map((_, i) => [rx[i], rz[i]]), (i, u, p) => {
      const y = pts[i].y;
      const w = THREE.MathUtils.smoothstep(y, 1.06, 0.82) * THREE.MathUtils.smoothstep(Math.abs(p.x), 0.0, 0.08);
      const upper = chainWeights(kit, torso, y);
      if (w < 0.001) return upper;
      const side = p.x >= 0 ? 'Left' : 'Right';
      return [...upper.map(([k, v]) => [k, v * (1 - w)]), [side + 'UpLeg', w]];
    }, { color: skin.coat, ao: 0.28, seg: 30, ringColor: (i) => (i >= 11 ? skin.trim : i === 10 ? skin.coat2 : skin.coat) });
  }
  // Standing collar.
  tube(0, [V(0, 1.5, -0.03), V(0, 1.56, -0.028), V(0, 1.585, -0.022)], [[0.105, 0.096], [0.098, 0.09], [0.1, 0.092]], (i, u) => chainWeights(kit, ['Spine2', 'Neck', 'Head'], [1.5, 1.56, 1.585][i]), { color: skin.coat2, ao: 0.25, seg: 18, ringColor: (i) => (i === 2 ? skin.trim : skin.coat2) });
  // Sleeves rolled to the forearm with a coral cuff; clay forearms show below.
  mirror((s) => {
    const A = s > 0 ? 'Left' : 'Right', sh = J(A + 'Arm'), el = J(A + 'ForeArm'), wr = J(A + 'Hand');
    const lenU = sh.distanceTo(el), lenF = el.distanceTo(wr);
    const dists = [0, 0.18, 0.4, 0.62, 0.84, 1.0, 1.16, 1.28, 1.34], rr = [0.095, 0.092, 0.078, 0.066, 0.064, 0.066, 0.07, 0.072, 0.068];
    const pts = dists.map((t) => (t <= 1 ? sh.clone().lerp(el, t) : el.clone().lerp(wr, (t - 1) * lenU / lenF)));
    tube(0, pts, rr.map((r) => [r, r]), (i) => {
      const w = THREE.MathUtils.smoothstep(dists[i], 0.88, 1.12);
      return w <= 0.001 ? [[A + 'Arm', 1]] : w >= 0.999 ? [[A + 'ForeArm', 1]] : [[A + 'Arm', 1 - w], [A + 'ForeArm', w]];
    }, { color: skin.coat, ao: 0.25, seg: 14, ringColor: (i) => (i >= 7 ? skin.trim : skin.coat) });
    // Wrist bracer with a tiny glowing gauge on the left.
    if (s > 0) {
      const m = el.clone().lerp(wr, 0.7);
      add(1, limb(m.clone().add(V(-0.05, 0, 0)), m.clone().add(V(0.05, 0, 0)), 0.046, 0.046, 0.046, 0.046, V(0, 0, 1), 0.3), A + 'ForeArm', BRASS, 0.2);
      add(2, ell(V(m.x, m.y + 0.044, m.z), [0.022, 0.006, 0.022], null, 12), A + 'ForeArm', skin.glowCore, 0);
    }
  });
  // ---- trousers, boots ----
  mirror((s) => {
    const A = s > 0 ? 'Left' : 'Right', hp = J(A + 'UpLeg'), kn = J(A + 'Leg'), an = J(A + 'Foot');
    const lenT = hp.distanceTo(kn), lenS = kn.distanceTo(an), total = lenT + lenS;
    const ts = [0.0, 0.25, 0.5, 0.7, 0.74, 0.8, 0.9, 1.0];
    const rad = [0.08, 0.084, 0.086, 0.088, 0.084, 0.078, 0.066, 0.058];
    const pts = ts.map((t) => { const d = t * total; return d <= lenT ? hp.clone().lerp(kn, d / lenT) : kn.clone().lerp(an, (d - lenT) / lenS); });
    tube(0, pts, rad.map((r) => [r, r]), (i) => {
      const w = THREE.MathUtils.smoothstep(ts[i] * total, lenT - 0.07, lenT + 0.07);
      return w <= 0.001 ? [[A + 'UpLeg', 1]] : w >= 0.999 ? [[A + 'Leg', 1]] : [[A + 'UpLeg', 1 - w], [A + 'Leg', w]];
    }, { color: skin.pants, ao: 0.25, seg: 14, ringColor: (i) => (i >= 3 ? skin.boots : skin.pants) });
    // Boot cuff ring + boot foot.
    const top = pts[3].clone();
    add(0, new THREE.TorusGeometry(0.066, 0.011, 8, 22).rotateX(Math.PI / 2).translate(top.x, top.y + 0.01, top.z), A + 'Leg', skin.trim, 0.1);
    const te = kit.has(A + 'Toe_End') ? J(A + 'Toe_End') : V(an.x, 0, an.z + 0.2);
    const zc = (an.z + te.z) * 0.5 + 0.01;
    const shoe = paint(ell(V(an.x, 0.05, zc), [0.058, 0.05, 0.135], [0.04, 0, 0], 20, [0.8, 0.8]), (x, y, z) => (z > te.z - 0.045 ? skin.trim : skin.boots), 0.3);
    add(0, shoe, A + 'Foot', null);
    add(0, ell(V(an.x, 0.018, zc + 0.005), [0.062, 0.018, 0.142], null, 14), A + 'Foot', DARK, 0.2);
  });
  // ---- belt, satchel with scrolls, wrench ----
  tube(0, [V(0, 1.065, 0.02), V(0, 1.1, 0.02)], [[0.228, 0.172], [0.228, 0.172]], () => 'Hips', { color: 0x3a2418, ao: 0.2, seg: 28 });
  add(1, ell(V(0, 1.083, 0.16), [0.032, 0.03, 0.01], null, 14, [0.6, 0.6]), 'Hips', BRASS, 0.1);
  add(0, kit_box(V(0.215, 0.99, -0.02), [0.05, 0.07, 0.085]), 'Hips', skin.boots, 0.25);
  add(0, kit_box(V(0.215, 1.03, -0.02), [0.054, 0.034, 0.09]), 'Hips', skin.coat2, 0.25);
  add(1, ell(V(0.27, 1.01, -0.02), [0.008, 0.016, 0.016], null, 8), 'Hips', BRASS, 0.1);
  for (const [dz, dy] of [[-0.05, 0], [0.0, 0.02], [0.05, 0]]) add(0, limb(V(0.2, 1.05 + dy, -0.02 + dz), V(0.27, 1.26 + dy, -0.02 + dz + 0.02), 0.014, 0.014, 0.014, 0.014, V(0, 0, 1), 0.2), 'Hips', skin.coat, 0.2);
  add(1, limb(V(-0.2, 1.0, 0.04), V(-0.22, 0.86, 0.06), 0.008, 0.008, 0.008, 0.008, V(0, 0, 1), 0.3), 'Hips', BRASS, 0.2);
  add(1, ell(V(-0.222, 0.835, 0.062), [0.02, 0.02, 0.008], null, 10), 'Hips', BRASS, 0.2);
  // Bedroll on the back.
  add(0, limb(V(-0.14, 1.32, -0.185), V(0.14, 1.32, -0.185), 0.05, 0.05, 0.05, 0.05, V(0, 1, 0), 0.25), 'Spine2', skin.coat2, 0.25);
  for (const x of [-0.08, 0.08]) add(0, limb(V(x - 0.01, 1.32, -0.185), V(x + 0.01, 1.32, -0.185), 0.053, 0.053, 0.053, 0.053, V(0, 1, 0), 0.25), 'Spine2', skin.trim, 0.2);

  // ---- chest spark emblem ----
  {
    const parts = sparkGeo(0.062, 0.2, 0.06, true), g = mergeGeometries(parts);
    g.translate(0, 1.36, 0.162);
    add(2, g, 'Spine2', skin.glowCore, 0);
  }

  // ---- head: friendly face, round spectacles, hat, halo ----
  const HEAD = 'Head', ha = (slot, g, c, ao) => add(slot, g, HEAD, c, ao);
  // A rounded clay head shell covers the mannequin's wedge face and carries the features.
  ha(0, ell(V(0, 1.69, 0.012), [0.112, 0.12, 0.118], null, 32, [0.9, 0.9]), skin.clay, 0.25);
  ha(0, ell(V(0, 1.625, 0.045), [0.092, 0.075, 0.095], null, 22, [0.8, 0.8]), skin.clay, 0.3);
  ha(0, ell(V(0, 1.678, 0.142), [0.012, 0.016, 0.013], [0.3, 0, 0], 10), skin.clay, 0.3);
  mirror((s) => {
    ha(2, ell(V(s * 0.037, 1.705, 0.128), [0.017, 0.024, 0.008], null, 14), skin.glowCore, 0);
    ha(0, ell(V(s * 0.037, 1.705, 0.134), [0.0075, 0.012, 0.004], null, 8), DARK, 0);
    ha(1, new THREE.TorusGeometry(0.032, 0.0042, 8, 26).translate(s * 0.037, 1.705, 0.137), BRASS, 0.1);
    ha(1, limb(V(s * 0.068, 1.708, 0.133), V(s * 0.108, 1.71, 0.04), 0.0035, 0.0035, 0.0035, 0.0035, V(0, 1, 0), 0.5), BRASS, 0.1);
  });
  ha(1, limb(V(-0.006, 1.708, 0.14), V(0.006, 1.708, 0.14), 0.003, 0.003, 0.003, 0.003, V(0, 1, 0), 0.5), BRASS, 0.1);
  ha(0, ell(V(-0.04, 1.752, 0.124), [0.02, 0.0045, 0.006], [0, 0, 0.32], 8), skin.joints, 0.1); // raised, curious brow
  ha(0, ell(V(0.04, 1.744, 0.126), [0.02, 0.0045, 0.006], [0, 0, 0.0], 8), skin.joints, 0.1);
  { // smile
    const curve = new THREE.CatmullRomCurve3([V(-0.032, 1.652, 0.12), V(-0.012, 1.64, 0.13), V(0.012, 1.64, 0.13), V(0.032, 1.652, 0.12)]);
    ha(0, new THREE.TubeGeometry(curve, 16, 0.0034, 5, false), skin.joints, 0.0);
  }
  // Brimmed hat with a coral band and a spark pin.
  ha(0, ell(V(0, 1.768, 0.0), [0.178, 0.011, 0.178], null, 28), skin.hat, 0.3);
  ha(0, ell(V(0, 1.812, -0.002), [0.108, 0.07, 0.112], null, 28, [0.8, 0.9]), skin.hat, 0.28);
  ha(0, new THREE.TorusGeometry(0.108, 0.011, 8, 30).rotateX(Math.PI / 2).scale(1, 1, 1.03).translate(0, 1.783, -0.002), skin.trim, 0.1);
  ha(2, mergeGeometries(sparkGeo(0.026, 0.22, 0.2, true)).translate(0.04, 1.783, 0.108), skin.glowCore, 0);
  // Halo ring floating behind the head.
  ha(2, new THREE.TorusGeometry(0.215, 0.0075, 8, 56).translate(0, 1.735, -0.14), skin.glow, 0);
  ha(2, new THREE.TorusGeometry(0.195, 0.003, 6, 56).translate(0, 1.735, -0.14), skin.glowCore, 0);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ha(2, ell(V(Math.cos(a) * 0.215, 1.735 + Math.sin(a) * 0.215, -0.14), [0.011, 0.011, 0.011], null, 6), skin.glowCore, 0); }

  const sm = kit.finish();

  // ---- the clay body ----
  scene.traverse((o) => {
    if (!o.isSkinnedMesh || o === sm) return;
    o.material = o.material.clone();
    o.material.color.set(/Joints/i.test(o.name) ? skin.joints : skin.clay);
    o.material.metalness = 0; o.material.roughness = 0.72;
  });

  // ---- the floating spark companion ----
  const star = new THREE.Mesh(mergeGeometries(sparkGeo(0.1, 0.2, 0.2, true)), new THREE.MeshStandardMaterial({ color: skin.glowCore, emissive: skin.glow, emissiveIntensity: 2.4, roughness: 0.3, metalness: 0.1 }));
  const orb = new THREE.Group(); orb.name = 'spark_orb';
  orb.add(star);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: skin.glow, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(0.42); orb.add(halo);
  orb.userData.base = V(-0.4, 1.78, 0.12);
  orb.position.copy(orb.userData.base);
  orb.traverse((o) => { o.castShadow = false; o.frustumCulled = false; });
  scene.add(orb);
  return sm;
}

function kit_box(c, h) {
  const g = new THREE.BoxGeometry(h[0] * 2, h[1] * 2, h[2] * 2, 1, 1, 1);
  g.translate(c.x, c.y, c.z);
  return g;
}

// Bobs and spins the companion; hidden in first person and when dead.
export function animateSpark(orb, t, speed, hide) {
  const b = orb.userData.base;
  orb.visible = !hide;
  orb.position.set(b.x + Math.sin(t * 1.3) * 0.035, b.y + Math.sin(t * 2.1) * 0.045, b.z + Math.cos(t * 1.7) * 0.03);
  const star = orb.children[0];
  star.rotation.z = t * 0.9;
  const k = 1 + Math.sin(t * 4.2) * 0.07;
  orb.scale.setScalar(k);
}
