// Hand-built gear attached to character rigs: the WW2 veteran's M1 helmet and
// webbing, and Death's horns, wings and scythe.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { boneKey } from './retarget.js';

const V = (...a) => new THREE.Vector3(...a);
function bonesOf(rig) { const m = new Map(); rig.traverse((o) => { if (o.isBone && !m.has(boneKey(o.name))) m.set(boneKey(o.name), o); }); return m; }
function attach(rig, bone, mesh) { rig.add(mesh); bone.attach(mesh); mesh.castShadow = true; return mesh; }
const nonIdx = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const a of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(a)) n.deleteAttribute(a); if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; };
const merge = (list) => mergeGeometries(list.map(nonIdx));

function paintTexture(base, spots, scale = 256) {
  const c = document.createElement('canvas'); c.width = c.height = scale;
  const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, scale, scale);
  for (let i = 0; i < 400; i++) { g.fillStyle = spots[i % spots.length]; g.globalAlpha = Math.random() * 0.25; g.beginPath(); g.arc(Math.random() * scale, Math.random() * scale, Math.random() * 6, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// ---------------- WW2 veteran ----------------
export function buildVeteranGear(rig, pal = {}) {
  rig.updateMatrixWorld(true);
  const b = bonesOf(rig);
  const P = (k) => b.get(k).getWorldPosition(new THREE.Vector3());
  const head = P('Head'), top = b.has('HeadTop_End') ? P('HeadTop_End') : head.clone().add(V(0, 0.2, 0));
  const S = top.y / 1.85;
  const od = new THREE.MeshStandardMaterial({ map: paintTexture(pal.od || '#4a4a32', pal.spots || ['#3a3a26', '#5b5a40', '#2a2a1c', '#6b604a']), roughness: 0.78, metalness: 0.25 });
  const webbing = new THREE.MeshStandardMaterial({ map: paintTexture(pal.web || '#6e6648', ['#5a5338', '#7d7556', '#4a4430']), roughness: 0.95 });
  const brass = new THREE.MeshStandardMaterial({ color: pal.brass || 0x9c8248, metalness: 0.9, roughness: 0.4 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x3a2516, roughness: 0.7 });

  // M1 helmet: a deep dome with a rolled rim, sitting low over the brow.
  const hc = V(head.x, head.y + (top.y - head.y) * 0.52, head.z - 0.012 * S);
  const dome = new THREE.SphereGeometry(0.128 * S, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.56);
  dome.scale(1.0, 0.95, 1.12);
  const rim = new THREE.TorusGeometry(0.128 * S * Math.sin(Math.PI * 0.56) * 1.0, 0.0055 * S, 8, 48).rotateX(Math.PI / 2).scale(1, 1, 1.1);
  rim.translate(0, Math.cos(Math.PI * 0.56) * 0.128 * S * 0.95, 0);
  const helmet = merge([dome, rim]);
  helmet.translate(hc.x, hc.y, hc.z);
  attach(rig, b.get('Head'), new THREE.Mesh(helmet, od));
  // Unbuckled chinstraps hanging at the sides.
  for (const sx of [-1, 1]) {
    const pts = [V(hc.x + sx * 0.125 * S, hc.y - 0.02 * S, hc.z + 0.02 * S), V(hc.x + sx * 0.12 * S, hc.y - 0.09 * S, hc.z + 0.04 * S), V(hc.x + sx * 0.1 * S, hc.y - 0.13 * S, hc.z + 0.07 * S)];
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.005 * S, 5).scale(1, 1, 1);
    attach(rig, b.get('Head'), new THREE.Mesh(g, webbing));
  }

  // Cartridge belt with pouches around the waist.
  const hip = P('Hips'), sp = P('Spine');
  const by = (hip.y + sp.y) / 2 + 0.01 * S;
  const beltR = 0.155 * S;
  const belt = new THREE.CylinderGeometry(beltR, beltR * 0.98, 0.055 * S, 32, 1, true).scale(1, 1, 0.72);
  belt.translate(hip.x, by, hip.z + 0.0);
  const parts = [belt];
  for (let i = 0; i < 8; i++) {
    const a = -1.1 + (i / 7) * 2.2; // front arc, left to right
    if (Math.abs(a) < 0.2) continue;
    const box = new THREE.BoxGeometry(0.05 * S, 0.06 * S, 0.028 * S);
    box.rotateY(a);
    box.translate(hip.x + Math.sin(a) * beltR * 1.05, by - 0.005 * S, hip.z + Math.cos(a) * beltR * 0.76);
    parts.push(box);
  }
  attach(rig, b.get('Hips'), new THREE.Mesh(merge(parts), webbing));
  // Buckle.
  const buckle = new THREE.BoxGeometry(0.05 * S, 0.04 * S, 0.01 * S); buckle.translate(hip.x, by, hip.z + beltR * 0.74);
  attach(rig, b.get('Hips'), new THREE.Mesh(buckle, brass));
  // Canteen on the right hip.
  const can = new THREE.CylinderGeometry(0.055 * S, 0.055 * S, 0.16 * S, 20).scale(1, 1, 0.5);
  can.translate(hip.x - 0.17 * S, by - 0.1 * S, hip.z - 0.03 * S);
  attach(rig, b.get('Hips'), new THREE.Mesh(can, od));
  // Suspenders over the shoulders.
  const ch = P('Spine2');
  for (const sx of [-1, 1]) {
    const sh = P(sx > 0 ? 'LeftShoulder' : 'RightShoulder');
    const front = [V(hip.x + sx * 0.09 * S, by + 0.03 * S, hip.z + 0.11 * S), V(ch.x + sx * 0.1 * S, ch.y, ch.z + 0.12 * S), V(sh.x + sx * 0.05 * S, sh.y + 0.02 * S, sh.z + 0.04 * S), V(sh.x + sx * 0.04 * S, sh.y + 0.0, sh.z - 0.07 * S), V(ch.x + sx * 0.05 * S, ch.y, ch.z - 0.12 * S), V(hip.x + sx * 0.06 * S, by + 0.03 * S, hip.z - 0.1 * S)];
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(front), 40, 0.011 * S, 4).scale(1, 1, 1);
    g.scale(1, 1, 1);
    attach(rig, b.get('Spine2'), new THREE.Mesh(g, webbing));
  }
  // Dog tags.
  const tag = new THREE.BoxGeometry(0.018 * S, 0.028 * S, 0.002 * S); tag.translate(ch.x + 0.01 * S, ch.y + 0.06 * S, ch.z + 0.115 * S);
  attach(rig, b.get('Spine2'), new THREE.Mesh(tag, new THREE.MeshStandardMaterial({ color: 0xb0b4b8, metalness: 1, roughness: 0.3 })));
  // Gloved look: darken nothing; leather wrist cuffs.
  for (const sd of ['Left', 'Right']) {
    if (!b.has(sd + 'Hand')) continue;
    const h = P(sd + 'Hand'), f = P(sd + 'ForeArm');
    const d = h.clone().sub(f).normalize();
    const g = new THREE.CylinderGeometry(0.037 * S, 0.035 * S, 0.05 * S, 14, 1, true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d));
    const c = h.clone().addScaledVector(d, -0.06 * S); g.translate(c.x, c.y, c.z);
    attach(rig, b.get(sd + 'ForeArm'), new THREE.Mesh(g, leather));
  }
}

// ---------------- Death ----------------
function hornGeo(len, r, curl, sx) {
  // A tapered tube spiralling back and out.
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(V(sx * (t * 0.35 + Math.sin(t * Math.PI) * 0.15) * len, Math.sin(t * Math.PI * 0.75) * len * 0.75, -t * len * 0.8 + Math.sin(t * curl) * 0.1 * len));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, 40, r, 12, false);
  const pos = g.attributes.position, c = new THREE.Vector3(), tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const seg = Math.floor(i / 13), t = seg / 40;
    curve.getPointAt(Math.min(1, t), c);
    tmp.fromBufferAttribute(pos, i).sub(c).multiplyScalar(Math.max(0.04, 1 - t * 0.96) * (1 + 0.08 * Math.sin(t * 60)));
    pos.setXYZ(i, c.x + tmp.x, c.y + tmp.y, c.z + tmp.z);
  }
  g.computeVertexNormals();
  return g;
}

function wingGeo(S) {
  // Membrane between finger bones of a bat wing, in the wing's local frame (+x out, +y up).
  const tips = [[1.25, 0.55], [1.3, 0.05], [1.0, -0.45], [0.55, -0.7]];
  const wrist = [0.42, 0.32];
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.12); shape.lineTo(wrist[0], wrist[1]);
  for (let i = 0; i < tips.length; i++) {
    const t = tips[i], prev = i === 0 ? wrist : tips[i - 1];
    shape.lineTo(t[0], t[1]);
    const nt = tips[i + 1] || [0.05, -0.55];
    // Scalloped trailing edge between finger tips.
    const mx = (t[0] + nt[0]) / 2, my = (t[1] + nt[1]) / 2;
    shape.quadraticCurveTo(mx * 0.82 + wrist[0] * 0.18, my * 0.82 + wrist[1] * 0.18, nt[0], nt[1]);
  }
  shape.lineTo(0, -0.1); shape.lineTo(0, 0.12);
  const membrane = new THREE.ShapeGeometry(shape, 12);
  membrane.scale(S, S, S);
  const bones = [];
  const bone = (a, b, r) => { const d = V(b[0] - a[0], b[1] - a[1], 0); const g = new THREE.CylinderGeometry(r * 0.6, r, d.length(), 6); g.translate(0, d.length() / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize())); g.translate(a[0], a[1], 0.004); return g; };
  bones.push(bone([0, 0.1], wrist, 0.03));
  for (const t of tips) bones.push(bone(wrist, t, 0.016));
  const bg = merge(bones); bg.scale(S, S, S);
  // Claw on the wrist.
  const claw = new THREE.ConeGeometry(0.02, 0.12, 6); claw.rotateZ(0.6); claw.translate(wrist[0] - 0.02, wrist[1] + 0.07, 0.01); claw.scale(S, S, S);
  return { membrane, bones: merge([bg, claw]) };
}

export function buildDeathGear(rig) {
  rig.updateMatrixWorld(true);
  const b = bonesOf(rig);
  const P = (k) => b.get(k).getWorldPosition(new THREE.Vector3());
  const head = P('Head'), top = b.has('HeadTop_End') ? P('HeadTop_End') : head.clone().add(V(0, 0.2, 0));
  const S = top.y / 1.75;
  let body = null;
  rig.traverse((o) => { if (o.isSkinnedMesh && !body && /Outfit_Top|Body/.test(o.name)) body = o; });
  rig.traverse((o) => { if (o.isSkinnedMesh && /Outfit_Top/.test(o.name)) body = o; });

  // Softer, fuller silhouette through the chest and hips of the top and body.
  const ch = P('Spine2'), hip = P('Hips');
  rig.traverse((o) => {
    if (!o.isSkinnedMesh || !/Outfit_Top|Wolf3D_Body/.test(o.name)) return;
    const inv = o.matrixWorld.clone().invert(), fwd = o.matrixWorld.clone();
    const pos = o.geometry.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(fwd);
      for (const sx of [-1, 1]) {
        const c = V(ch.x + sx * 0.085 * S, ch.y - 0.0 * S, ch.z + 0.08 * S);
        const d = v.clone().sub(c); d.z *= 0.6;
        const k = Math.exp(-d.lengthSq() / (0.075 * 0.075 * S * S));
        if (v.z > ch.z) v.add(V(sx * 0.01, 0.006, 0.05).multiplyScalar(k * S));
      }
      v.applyMatrix4(inv); pos.setXYZ(i, v.x, v.y, v.z);
    }
    o.geometry.computeVertexNormals();
  });

  // Skirt: a pleated, flared cone skinned to the hips and thighs so it follows the legs.
  if (body) {
    const segs = 64, rows = 8;
    const waistY = hip.y + 0.07 * S, hemY = hip.y - 0.36 * S;
    const pos = [], idx = [], sw = [], si = [];
    const L = b.get('LeftUpLeg'), R = b.get('RightUpLeg'), H = b.get('Hips');
    const bonesArr = body.skeleton.bones;
    const iH = bonesArr.indexOf(H), iL = bonesArr.indexOf(L), iR = bonesArr.indexOf(R);
    for (let r = 0; r <= rows; r++) {
      const t = r / rows;
      const y = waistY + (hemY - waistY) * t;
      const rad = (0.15 + t * 0.13) * S;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const pleat = 1 + 0.06 * t * Math.sin(a * 16);
        const x = hip.x + Math.sin(a) * rad * pleat, z = hip.z + Math.cos(a) * rad * 0.8 * pleat - 0.01 * S;
        pos.push(x, y, z);
        // Weights: hips at the waist, the nearer thigh toward the hem.
        const legW = Math.min(1, t * 1.25) * 0.75;
        const side = Math.sin(a); // + left, - right
        const wl = legW * Math.max(0, 0.5 + side * 0.9) , wr = legW * Math.max(0, 0.5 - side * 0.9);
        const tot = wl + wr; const fl = tot > legW ? legW / tot : 1;
        const a1 = wl * fl, a2 = wr * fl;
        si.push(iH, iL, iR, 0); sw.push(1 - a1 - a2, a1, a2, 0);
      }
    }
    for (let r = 0; r < rows; r++) for (let i = 0; i < segs; i++) {
      const a = r * (segs + 1) + i, c = a + segs + 1;
      idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    // Into the body mesh's local space so it shares its bind matrix.
    g.applyMatrix4(body.matrixWorld.clone().invert());
    g.computeVertexNormals();
    const cloth = new THREE.MeshPhysicalMaterial({ color: 0x14080c, roughness: 0.55, sheen: 1, sheenColor: new THREE.Color(0x7a1020), sheenRoughness: 0.4, side: THREE.DoubleSide });
    const skirt = new THREE.SkinnedMesh(g, cloth);
    skirt.name = 'Skirt';
    skirt.castShadow = true;
    body.parent.add(skirt);
    skirt.position.copy(body.position); skirt.quaternion.copy(body.quaternion); skirt.scale.copy(body.scale);
    skirt.bind(body.skeleton, body.bindMatrix);
    // A thin crimson ribbon at the waist.
    const rib = new THREE.TorusGeometry(0.152 * S, 0.008 * S, 6, 48).rotateX(Math.PI / 2).scale(1, 1, 0.8);
    rib.translate(hip.x, waistY, hip.z - 0.01 * S);
    attach(rig, H, new THREE.Mesh(rib, new THREE.MeshStandardMaterial({ color: 0x8a0a18, roughness: 0.4 })));
  }

  buildAura(rig);
}

// Deadly aura: dark-red embers and a low mist that cling to her.
export function buildAura(rig) {
  rig.updateMatrixWorld(true);
  const b = bonesOf(rig);
  const hip = b.get('Hips').getWorldPosition(new THREE.Vector3());
  const S = hip.y / 0.98;
  const N = 220;
  const ap = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { seed[i] = Math.random(); ap.set([0, 0, 0], i * 3); }
  const ag = new THREE.BufferGeometry();
  ag.setAttribute('position', new THREE.BufferAttribute(ap, 3));
  ag.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const am = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uS: { value: S }, uI: { value: 1 } },
    vertexShader: `attribute float seed; uniform float uT, uS; varying float vA; varying float vK;
      void main(){ float t = fract(uT*0.18 + seed*7.0); float a = seed*40.0 + uT*(0.4+seed);
        float r = (0.22 + 0.25*seed + t*0.15)*uS;
        vec3 p = vec3(cos(a)*r, (t*1.9 - 0.05)*uS, sin(a)*r*0.8);
        vA = sin(t*3.14159); vK = seed;
        vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv;
        gl_PointSize = (seed < 0.75 ? 26.0 : 7.0) * uS * (1.0 + seed) / -mv.z * 6.0; }`,
    fragmentShader: `varying float vA; varying float vK; uniform float uI;
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;
        float soft = pow(max(0.0, 1.0 - d*2.0), vK < 0.75 ? 1.6 : 3.0);
        vec3 col = vK < 0.75 ? vec3(0.35, 0.0, 0.03) : vec3(1.0, 0.18, 0.12);
        gl_FragColor = vec4(col * uI, soft * vA * (vK < 0.75 ? 0.35 : 0.9)); }`,
  });
  const aura = new THREE.Points(ag, am);
  aura.name = 'aura';
  aura.frustumCulled = false;
  aura.position.set(hip.x, 0, hip.z);
  rig.add(aura);
  rig.userData.aura = am;
}

export function animateAura(rig, t, intensity = 1) {
  const a = rig.userData.aura; if (!a) return;
  a.uniforms.uT.value = t; a.uniforms.uI.value = intensity;
}

export function animateWings(rig, t, beat = 0.3) {
  const w = rig.userData.wings; if (!w) return;
  for (const { inner, sx } of w) {
    const a = Math.sin(t * (2 + beat * 6)) * (0.12 + beat * 0.5);
    inner.rotation.y = sx * (0.55 + a);
    inner.rotation.z = sx * (0.12 + a * 0.4);
  }
}

export function makeScythe() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x1b1012, roughness: 0.5 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a1018, metalness: 0.8, roughness: 0.25, emissive: 0x300000 });
  const shaft = new THREE.CylinderGeometry(0.018, 0.022, 1.9, 10).rotateX(Math.PI / 2).translate(0, 0, 0.35);
  g.add(new THREE.Mesh(shaft, wood));
  const blade = new THREE.Shape();
  blade.moveTo(0, 0); blade.quadraticCurveTo(0.45, 0.12, 0.85, -0.25); blade.quadraticCurveTo(0.42, -0.02, 0, -0.08); blade.lineTo(0, 0);
  const bg = new THREE.ExtrudeGeometry(blade, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.006, bevelSegments: 2, curveSegments: 20 });
  bg.rotateY(-Math.PI / 2); bg.rotateZ(0); bg.translate(0, 0.0, 1.28);
  const bm = new THREE.Mesh(bg, steel); bm.rotation.z = 0; g.add(bm);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { id: 'scythe', kind: 'melee', muzzle: V(0, 0, 1.3), support: V(0, 0, 0.45), twoHanded: true };
  return g;
}

// Her staff: blackened wood wound with silver, a crimson crystal in a crescent claw.
export function makeStaff() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x1a1016, roughness: 0.45 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xc8c4d8, metalness: 0.9, roughness: 0.25 });
  const gem = new THREE.MeshStandardMaterial({ color: 0xff1a3a, emissive: 0xc0001a, emissiveIntensity: 1.6, roughness: 0.1, metalness: 0.2 });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 1.45, 10).rotateX(Math.PI / 2).translate(0, 0, 0.38), wood));
  for (const z of [-0.25, 0.05, 0.7, 1.08]) g.add(new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.006, 6, 14).translate(0, 0, 0).rotateY(0).translate(0, 0, z), silver));
  // Crescent claw around the crystal.
  const arc = new THREE.TorusGeometry(0.075, 0.009, 8, 28, Math.PI * 1.5); arc.rotateY(Math.PI / 2); arc.rotateX(Math.PI * 0.25); arc.translate(0, 0, 1.18);
  g.add(new THREE.Mesh(arc, silver));
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.042, 0).scale(0.8, 0.8, 1.5).translate(0, 0, 1.18), gem);
  crystal.name = 'staffGem';
  g.add(crystal);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { id: 'staff', kind: 'melee', muzzle: V(0, 0, 1.18), support: V(0, 0, 0.3), twoHanded: true };
  return g;
}

// Long flowing hair: layered strand cards shaped over the scalp and down the
// back, skinned to the head and upper spine so it follows the body.
function hairTexture(base) {
  const W = 256, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const col = new THREE.Color(base);
  c.clearRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * W, len = H * (0.82 + Math.random() * 0.18), w = 1 + Math.random() * 2.2;
    const k = 0.7 + Math.random() * 0.35;
    c.strokeStyle = `rgba(${Math.min(255, col.r * 255 * k)},${Math.min(255, col.g * 255 * k)},${Math.min(255, col.b * 255 * k)},${0.55 + Math.random() * 0.45})`;
    c.lineWidth = w;
    c.beginPath(); c.moveTo(x, 0);
    c.bezierCurveTo(x + (Math.random() - 0.5) * 10, len * 0.4, x + (Math.random() - 0.5) * 14, len * 0.7, x + (Math.random() - 0.5) * 18, len);
    c.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function buildLongHair(rig, { color = 0xeeeef6, length = 0.5 } = {}) {
  rig.updateMatrixWorld(true);
  const b = bonesOf(rig);
  let body = null;
  rig.traverse((o) => { if (o.isSkinnedMesh && !body) body = o; });
  if (!body) return;
  const P = (k) => b.get(k).getWorldPosition(new THREE.Vector3());
  const head = P('Head'), neck = P('Neck'), sp2 = P('Spine2');
  const top = b.has('HeadTop_End') ? P('HeadTop_End') : head.clone().add(V(0, 0.2, 0));
  const S = (top.y - neck.y) / 0.27;
  const R = (top.y - head.y) * 0.62;
  const c = V(head.x, top.y - R * 1.02, head.z - 0.035 * S);
  const bones = body.skeleton.bones;
  const iH = bones.indexOf(b.get('Head')), iN = bones.indexOf(b.get('Neck')), iS = bones.indexOf(b.get('Spine2')), iS1 = bones.indexOf(b.get('Spine1'));
  const pos = [], uv = [], si = [], sw = [], idx = [];
  const tipY = c.y - length * S;
  const backZ = sp2.z - 0.115 * S;
  // One layer: rows from crown to tip, columns around the back of the head.
  const layer = (grow, spread, uOff) => {
    const cols = 26, rows = 22, base = pos.length / 3;
    for (let r = 0; r <= rows; r++) {
      const t = r / rows;
      for (let i = 0; i <= cols; i++) {
        const s = i / cols * 2 - 1; // -1..1 across
        let p;
        if (t < 0.3) {
          // Over the scalp: from the crown down to ear level behind the head.
          const phi = (1 - t / 0.3) * Math.PI / 2 * 0.95;
          const th = s * 1.9 * (0.55 + 0.45 * (1 - phi / (Math.PI / 2)));
          const rr = R * (1.06 + grow);
          p = V(c.x + Math.sin(th) * Math.cos(phi) * rr, c.y + Math.sin(phi) * rr, c.z - Math.cos(th) * Math.cos(phi) * rr);
        } else {
          // Falling down the back, widening over the shoulder blades.
          const k = (t - 0.3) / 0.7;
          const th = s * (1.9 - 0.95 * Math.min(1, k * 1.4)) * spread;
          const y = c.y + (tipY - c.y) * k * (1 - 0.22 * s * s);
          const w = R * (1.06 + grow) + (0.045 * S) * Math.min(1, k * 1.5) - 0.02 * S * k * k;
          const d = Math.max(R * (1.06 + grow), (c.z - backZ) * Math.min(1, k * 2.2) + grow * R);
          p = V(c.x + Math.sin(th) * w, y, c.z - Math.cos(th) * d - Math.sin(k * 3) * 0.01 * S);
        }
        pos.push(p.x, p.y, p.z);
        uv.push(i / cols * 1.6 + uOff, 1 - t);
        // Head above the neck, blending into the upper spine below the shoulders.
        const h = THREE.MathUtils.clamp((p.y - (sp2.y + 0.05 * S)) / (neck.y - sp2.y), 0, 1);
        if (p.y < sp2.y - 0.08 * S) { si.push(iS, iS1, 0, 0); sw.push(0.7, 0.3, 0, 0); }
        else { si.push(iH, iN, iS, 0); sw.push(h * h, h * (1 - h) * 2 * 0.5, 1 - h * h - h * (1 - h), 0); }
      }
    }
    for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) {
      const a = base + r * (cols + 1) + i, d = a + cols + 1;
      idx.push(a, d, a + 1, a + 1, d, d + 1);
    }
  };
  layer(0.0, 1.0, 0); layer(0.05, 0.96, 0.31); layer(0.1, 0.9, 0.63);
  // Convert the posed world positions into the body's bind space, per vertex.
  body.skeleton.update();
  const inv = new THREE.Matrix4(), M = new THREE.Matrix4(), bm = body.bindMatrix, bmInv = bm.clone().invert();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.length / 3; i++) {
    M.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    for (let k = 0; k < 4; k++) {
      const w = sw[i * 4 + k]; if (!w) continue;
      const bi = si[i * 4 + k];
      const m = bones[bi].matrixWorld.clone().multiply(body.skeleton.boneInverses[bi]);
      for (let e = 0; e < 16; e++) M.elements[e] += m.elements[e] * w;
    }
    // 'attached' skinning: world = M * bindMatrix * v  ->  v = bindMatrix^-1 * M^-1 * world
    v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(inv.copy(M).invert()).applyMatrix4(bmInv);
    pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({ map: hairTexture(color), color: 0xffffff, roughness: 0.38, sheen: 0.35, sheenColor: new THREE.Color(0xffffff), alphaTest: 0.35, side: THREE.DoubleSide });
  const hair = new THREE.SkinnedMesh(g, mat);
  hair.name = 'LongHair';
  hair.castShadow = true;
  hair.frustumCulled = false;
  body.parent.add(hair);
  hair.position.copy(body.position); hair.quaternion.copy(body.quaternion); hair.scale.copy(body.scale);
  hair.bind(body.skeleton, bm);
}
