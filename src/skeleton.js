// Builds an anatomical skeleton on top of a Mixamo rig: every bone gets a
// sculpted bone mesh (skull, spine, ribcage, pelvis, long bones, hands, feet)
// rigidly attached, so it animates with any retargeted clip.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { boneKey } from './retarget.js';

const V = (a) => new THREE.Vector3(...a);
const UP = new THREE.Vector3(0, 1, 0);

function boneTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#d9ccad'; g.fillRect(0, 0, 256, 256);
  const img = g.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const x = (i / 4) % 256, y = Math.floor(i / 4 / 256);
    const n = Math.sin(x * 0.11 + Math.sin(y * 0.07) * 3) * 0.5 + Math.sin(y * 0.31 + x * 0.05) * 0.3 + (Math.random() - 0.5) * 0.5;
    const k = 1 + n * 0.07;
    img.data[i] *= k; img.data[i + 1] *= k * 0.99; img.data[i + 2] *= k * 0.96;
  }
  g.putImageData(img, 0, 0);
  // Stains and pits.
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(${90 + Math.random() * 40},${70 + Math.random() * 30},${40},${Math.random() * 0.12})`;
    g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 18, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let sharedMat = null;
export function boneMaterial() {
  if (sharedMat) return sharedMat;
  const map = boneTexture();
  sharedMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map, roughness: 0.62, metalness: 0.0, bumpMap: map, bumpScale: 0.6, side: THREE.DoubleSide });
  // Darken crevices: cheap cavity term from the view-space normal.
  sharedMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>
      float rim = max(0.0, 1.0 - abs(dot(normalize(vNormal), vec3(0.0,0.0,1.0))));
      reflectedLight.indirectDiffuse *= mix(1.0, 0.55, pow(rim, 2.0));
      reflectedLight.directDiffuse *= mix(1.0, 0.8, pow(rim, 3.0));`);
  };
  return sharedMat;
}

// A long bone along +Y from 0 to len: knobbly condyles at both ends, slim waisted shaft.
function longBoneGeo(len, r, { head = 1.6, foot = 1.5, seg = 12 } = {}) {
  const pts = [];
  const N = 22;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let w = 0.72 + 0.28 * Math.pow(Math.abs(t - 0.5) * 2, 2.2);
    if (t < 0.12) w = Math.max(w, foot * Math.sqrt(Math.max(0, 1 - Math.pow((0.12 - t) / 0.12, 2))) * (t < 0.02 ? t / 0.02 : 1));
    if (t > 0.88) w = Math.max(w, head * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.88) / 0.12, 2))) * (t > 0.98 ? (1 - t) / 0.02 : 1));
    pts.push(new THREE.Vector2(Math.max(0.0001, w * r), t * len));
  }
  const g = new THREE.LatheGeometry(pts, seg);
  // Slightly flatten for a less perfect, more organic section.
  g.scale(1, 1, 0.82);
  return g;
}

function orientBetween(g, a, b) {
  const d = b.clone().sub(a);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
  g.applyQuaternion(q); g.translate(a.x, a.y, a.z);
  return g;
}

function boneBetween(a, b, r, opts) {
  const len = a.distanceTo(b);
  return orientBetween(longBoneGeo(len, r, opts), a, b);
}

function blob(p, s, seg = 10) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(6, seg - 3));
  g.scale(s[0], s[1], s[2]); g.translate(p.x, p.y, p.z);
  return g;
}

function tube(points, r, segs = 24, flat = 0.55) {
  const curve = new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(curve, segs, r, 6, false);
  // Flatten ribs vertically.
  const pos = g.attributes.position, c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.floor(i / 7) / segs;
    curve.getPointAt(Math.min(1, t), c);
    pos.setY(i, c.y + (pos.getY(i) - c.y) * flat);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * rig: a loaded Mixamo glTF scene at rest (T-pose), root at identity.
 * skullGeo: BufferGeometry of a skull, any scale/orientation (normalised here).
 */
export function buildSkeleton(rig, skullGeo, { eyeColor = 0x7fd8ff } = {}) {
  rig.updateMatrixWorld(true);
  const bones = new Map();
  rig.traverse((o) => { if (o.isBone && !bones.has(boneKey(o.name))) bones.set(boneKey(o.name), o); });
  const P = (k) => bones.get(k).getWorldPosition(new THREE.Vector3());
  const has = (k) => bones.has(k);
  // Hide the original body.
  rig.traverse((o) => { if (o.isMesh) o.visible = false; });

  const parts = new Map(); // bone key -> [geometries]
  const add = (k, g) => { if (!parts.has(k)) parts.set(k, []); parts.get(k).push(g); };
  const height = P('HeadTop_End').y;
  const S = height / 1.78; // scale factor relative to an average adult

  // ---- Skull ----
  {
    const g = skullGeo.clone();
    g.computeBoundingBox();
    const bb = g.boundingBox, size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    g.translate(-c.x, -c.y, -c.z);
    const s = (0.235 * S) / size.y;
    g.scale(s, s, s);
    const head = P('Head'), top = P('HeadTop_End');
    g.translate(head.x, (head.y + top.y) / 2 + 0.005 * S, head.z + 0.02 * S);
    g.deleteAttribute('normal'); g.computeVertexNormals();
    add('Head', g);
  }

  // ---- Spine (vertebrae from pelvis to skull) ----
  const chain = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head'].filter(has);
  const cp = chain.map((k) => P(k));
  for (let i = 0; i < cp.length - 1; i++) {
    const a = cp[i], b = cp[i + 1];
    const n = chain[i] === 'Neck' ? 5 : chain[i] === 'Hips' ? 3 : 4;
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n;
      const p = a.clone().lerp(b, t);
      p.z -= 0.035 * S; // vertebrae sit behind the body's centre line
      const neck = chain[i] === 'Neck';
      const w = (neck ? 0.015 : chain[i] === 'Hips' ? 0.032 : 0.026) * S;
      add(chain[i], blob(p, [w, 0.011 * S, w * 0.85], 8));
      // Spinous process pointing back and down.
      add(chain[i], orientBetween(longBoneGeo(0.03 * S, 0.006 * S, { head: 1.2, foot: 1.4, seg: 6 }), p.clone().add(V([0, 0, -0.012 * S])), p.clone().add(V([0, -0.012 * S, -0.04 * S]))));
      // Transverse processes.
      for (const sx of [-1, 1]) add(chain[i], orientBetween(longBoneGeo(0.025 * S, 0.004 * S, { seg: 5 }), p, p.clone().add(V([sx * 0.032 * S, 0, -0.008 * S]))));
    }
  }

  // ---- Ribcage on Spine1/Spine2 ----
  if (has('Spine2') && has('Spine1')) {
    const top = P('Spine2').y + 0.12 * S, bot = P('Spine1').y - 0.03 * S;
    const zBack = P('Spine2').z - 0.045 * S;
    const sternTop = new THREE.Vector3(0, top - 0.02 * S, zBack + 0.2 * S);
    const sternBot = new THREE.Vector3(0, top - 0.2 * S, zBack + 0.215 * S);
    add('Spine2', boneBetween(sternBot, sternTop, 0.016 * S, { head: 1.6, foot: 0.8, seg: 8 }));
    for (let i = 0; i < 11; i++) {
      const t = i / 10;
      const y = top - t * (top - bot);
      const wx = (0.075 + Math.sin(Math.min(1, t * 1.5 + 0.12) * Math.PI * 0.55) * 0.075) * S;
      const depth = (0.085 + Math.sin(t * Math.PI * 0.9) * 0.02) * S;
      const drop = (0.05 + t * 0.05) * S;
      const host = t < 0.5 ? 'Spine2' : 'Spine1';
      const A = Math.PI * (t > 0.75 ? 0.6 - (t - 0.75) * 0.6 : 0.88);
      for (const sx of [-1, 1]) {
        const pts = [];
        for (let k = 0; k <= 8; k++) {
          const a = (k / 8) * A;
          pts.push(new THREE.Vector3(sx * Math.sin(a) * wx, y + 0.012 * S * Math.sin(a * 2) - drop * Math.pow(a / Math.PI, 1.4), zBack + (1 - Math.cos(a)) * depth));
        }
        add(host, tube(pts, 0.0075 * S, 18, 0.55));
        // Costal cartilage to the sternum for the true ribs.
        if (i < 7) {
          const end = pts[pts.length - 1];
          const st = sternTop.clone().lerp(sternBot, i / 7);
          add(host, tube([end, end.clone().lerp(st, 0.5).add(V([0, 0.01 * S, 0.01 * S])), st.clone().add(V([sx * 0.01 * S, 0, 0]))], 0.005 * S, 8, 0.7));
        }
      }
    }
  }

  // ---- Shoulder girdle ----
  for (const sd of ['Left', 'Right']) {
    const sx = sd === 'Left' ? 1 : -1;
    if (!has(sd + 'Shoulder')) continue;
    const arm = P(sd + 'Arm');
    const sternTop = new THREE.Vector3(0.02 * sx * S, P('Spine2').y + 0.1 * S, P('Spine2').z + 0.15 * S);
    add('Spine2', tube([sternTop, sternTop.clone().lerp(arm, 0.5).add(V([0, 0.015 * S, 0.02 * S])), arm.clone().add(V([-0.02 * sx * S, 0.02 * S, 0.01 * S]))], 0.008 * S, 12, 0.8));
    // Scapula: a thin curved triangle on the back.
    const sc = new THREE.Shape();
    sc.moveTo(0, 0); sc.lineTo(-0.09 * S, -0.02 * S); sc.lineTo(-0.05 * S, -0.15 * S); sc.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(sc, { depth: 0.006 * S, bevelEnabled: true, bevelThickness: 0.003 * S, bevelSize: 0.004 * S, bevelSegments: 2 });
    if (sx < 0) g.scale(-1, 1, 1);
    g.translate(arm.x - 0.01 * sx * S, arm.y - 0.005 * S, P('Spine2').z - 0.08 * S);
    add(sd + 'Shoulder', g);
  }

  // ---- Arms and hands ----
  for (const sd of ['Left', 'Right']) {
    if (!has(sd + 'Arm')) continue;
    const a = P(sd + 'Arm'), f = P(sd + 'ForeArm'), h = P(sd + 'Hand');
    add(sd + 'Arm', boneBetween(a, f, 0.016 * S, { head: 1.4, foot: 1.9 }));
    add(sd + 'Arm', blob(a, [0.024 * S, 0.024 * S, 0.024 * S]));
    // Radius and ulna side by side.
    const side = new THREE.Vector3(0, 0, 0.011 * S);
    add(sd + 'ForeArm', boneBetween(f.clone().add(side), h.clone().add(side), 0.009 * S, { head: 1.5, foot: 1.6 }));
    add(sd + 'ForeArm', boneBetween(f.clone().sub(side), h.clone().sub(side), 0.008 * S, { head: 1.4, foot: 2.0 }));
    add(sd + 'Hand', blob(h.clone().lerp(P(sd + 'HandMiddle1'), 0.15), [0.02 * S, 0.012 * S, 0.026 * S], 8));
    for (const fn of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
      if (!has(sd + 'Hand' + fn + '1')) continue;
      const base = P(sd + 'Hand' + fn + '1');
      // Metacarpal from the wrist to the knuckle.
      add(sd + 'Hand', boneBetween(h.clone().lerp(base, 0.2), base, 0.0045 * S, { head: 1.5, foot: 1.3, seg: 6 }));
      for (let j = 1; j <= 3; j++) {
        const k0 = sd + 'Hand' + fn + j, k1 = sd + 'Hand' + fn + (j + 1);
        if (!has(k0) || !has(k1)) continue;
        add(k0, boneBetween(P(k0), P(k1), 0.0042 * S * (1 - j * 0.12), { head: 1.4, foot: 1.4, seg: 6 }));
      }
    }
  }

  // ---- Pelvis ----
  if (has('Hips') && has('LeftUpLeg')) {
    const hp = P('Hips'), lh = P('LeftUpLeg'), rh = P('RightUpLeg');
    for (const [sx, hj] of [[1, lh], [-1, rh]]) {
      // Iliac wing: a curved shell flaring up and out.
      const g = new THREE.PlaneGeometry(1, 1, 10, 6);
      const gp = g.attributes.position;
      for (let i = 0; i < gp.count; i++) {
        const u = gp.getX(i) + 0.5, v = gp.getY(i) + 0.5;
        const th = -0.3 * Math.PI + u * 0.75 * Math.PI; // back -> front around the side
        const r = (0.065 + v * 0.06 + Math.sin(u * Math.PI) * 0.015) * S;
        const cx = hp.x;
        gp.setXYZ(i, cx + sx * Math.cos(th) * r, hj.y - 0.025 * S + v * 0.12 * S - Math.pow(Math.abs(u - 0.45), 2) * 0.04 * S, hp.z - 0.01 * S + Math.sin(th) * r * 0.85);
      }
      g.computeVertexNormals();
      add('Hips', g);
      // Socket rim and pubic ramus.
      add('Hips', blob(hj.clone().add(V([sx * 0.01 * S, 0.005 * S, 0])), [0.028 * S, 0.028 * S, 0.028 * S]));
      add('Hips', tube([hj.clone().add(V([0, -0.01 * S, 0.01 * S])), new THREE.Vector3(sx * 0.03 * S, hj.y - 0.04 * S, hj.z + 0.05 * S), new THREE.Vector3(sx * 0.005 * S, hj.y - 0.03 * S, hj.z + 0.06 * S)], 0.01 * S, 10, 0.8));
      add('Hips', tube([hj.clone().add(V([0, -0.02 * S, -0.01 * S])), new THREE.Vector3(sx * 0.045 * S, hj.y - 0.075 * S, hj.z + 0.01 * S), new THREE.Vector3(sx * 0.01 * S, hj.y - 0.05 * S, hj.z + 0.05 * S)], 0.009 * S, 10, 0.8));
    }
    // Sacrum.
    const sac = new THREE.ConeGeometry(0.04 * S, 0.11 * S, 12, 1); sac.scale(1, 1, 0.32); sac.rotateX(Math.PI + 0.35);
    sac.translate(hp.x, hp.y - 0.0 * S, hp.z - 0.055 * S);
    add('Hips', sac);
  }

  // ---- Legs and feet ----
  for (const sd of ['Left', 'Right']) {
    if (!has(sd + 'UpLeg')) continue;
    const sx = sd === 'Left' ? 1 : -1;
    const u = P(sd + 'UpLeg'), l = P(sd + 'Leg'), f = P(sd + 'Foot');
    // Femur with neck and ball.
    const troch = u.clone().add(V([sx * 0.035 * S, -0.03 * S, 0]));
    add(sd + 'UpLeg', boneBetween(l, troch, 0.019 * S, { head: 1.5, foot: 2.1 }));
    add(sd + 'UpLeg', boneBetween(troch, u, 0.012 * S, { head: 2.2, foot: 1.2, seg: 8 }));
    // Kneecap.
    add(sd + 'Leg', blob(l.clone().add(V([0, 0.01 * S, 0.035 * S])), [0.02 * S, 0.024 * S, 0.012 * S], 8));
    // Tibia and fibula.
    add(sd + 'Leg', boneBetween(l.clone().add(V([0, -0.005 * S, 0.008 * S])), f.clone().add(V([0, 0.01 * S, 0.006 * S])), 0.017 * S, { head: 1.4, foot: 2.1 }));
    add(sd + 'Leg', boneBetween(l.clone().add(V([sx * 0.026 * S, -0.03 * S, -0.008 * S])), f.clone().add(V([sx * 0.024 * S, 0.0, -0.006 * S])), 0.0075 * S, { head: 1.6, foot: 1.7 }));
    // Foot: heel, tarsal mass, metatarsals, toes.
    if (has(sd + 'ToeBase')) {
      const t = P(sd + 'ToeBase'), te = has(sd + 'Toe_End') ? P(sd + 'Toe_End') : t.clone().add(V([0, 0, 0.08 * S]));
      add(sd + 'Foot', blob(f.clone().add(V([0, -0.045 * S, -0.03 * S])), [0.022 * S, 0.026 * S, 0.035 * S], 9));
      add(sd + 'Foot', blob(f.clone().lerp(t, 0.35).add(V([0, -0.035 * S, 0])), [0.03 * S, 0.02 * S, 0.04 * S], 9));
      for (let k = 0; k < 5; k++) {
        const ox = (k - 2) * 0.013 * S * sx;
        const a = f.clone().lerp(t, 0.45).add(V([ox * 0.6, -0.03 * S, 0]));
        const b = t.clone().add(V([ox, 0.0, 0]));
        add(sd + 'Foot', boneBetween(a, b, 0.0055 * S, { head: 1.4, foot: 1.3, seg: 6 }));
        add(sd + 'ToeBase', boneBetween(b, te.clone().add(V([ox, 0.0, -(Math.abs(k - 1)) * 0.008 * S])), 0.005 * S, { head: 1.3, foot: 1.3, seg: 6 }));
      }
    }
  }

  // Merge per bone and attach rigidly.
  const mat = boneMaterial();
  const group = [];
  for (const [k, geos] of parts) {
    const geo = mergeGeometries(geos.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const a of Object.keys(n.attributes)) if (a !== 'position' && a !== 'normal' && a !== 'uv') n.deleteAttribute(a); if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); if (!n.attributes.normal) n.computeVertexNormals(); return n; }));
    // Box-project UVs so the bone texture wraps every part.
    const pos = geo.attributes.position, uv = geo.attributes.uv, nrm = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i));
      const x = pos.getX(i) * 6, y = pos.getY(i) * 6, z = pos.getZ(i) * 6;
      if (ax > ay && ax > Math.abs(nrm.getZ(i))) uv.setXY(i, z, y); else if (ay > Math.abs(nrm.getZ(i))) uv.setXY(i, x, z); else uv.setXY(i, x, y);
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    rig.add(mesh); // world-space at rest
    bones.get(k).attach(mesh);
    group.push(mesh);
  }

  // Glowing eyes in the sockets.
  if (has('Head')) {
    const head = bones.get('Head');
    const hp = P('Head'), top = P('HeadTop_End');
    const eyeY = hp.y + (top.y - hp.y) * 0.42, eyeZ = hp.z + 0.085 * S;
    const glow = new THREE.MeshBasicMaterial({ color: eyeColor, toneMapped: false });
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.009 * S, 8, 6), glow);
      e.position.set(sx * 0.03 * S, eyeY, eyeZ);
      rig.add(e); head.attach(e);
    }
    rig.userData.eyeMat = glow;
  }
  return group;
}
