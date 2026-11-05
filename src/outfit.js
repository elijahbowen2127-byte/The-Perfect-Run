// Shared helpers for the hand-built heroes on the mannequin rig (knight, samurai, ninja, corsair).
// Everything here works in the kit's canonical frame: +Z forward, the character's left on +X,
// metres, T-pose rest (shoulders y 1.438, elbows x 0.43, wrists x 0.713, hips y 1.04, knees y 0.53,
// ankles y 0.084, head joint y 1.596, scalp top y 1.82).
import * as THREE from 'three';
import { V, ell } from './armor.js';
import { real } from './realmat.js';

export const sstep = THREE.MathUtils.smoothstep;

// Chamfer-free box centred at c with half sizes h, optional Euler rotation (YXZ).
export function box(c, h, rot) {
  const g = new THREE.BoxGeometry(h[0] * 2, h[1] * 2, h[2] * 2, 1, 1, 1);
  if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')));
  g.translate(c.x, c.y, c.z);
  return g;
}
// Horizontal ring (torus lying flat) at c, optional Euler rotation applied before placing.
export function ringAt(c, R, r, rot, seg = 28, arc) {
  const g = new THREE.TorusGeometry(R, r, 8, seg, arc);
  g.rotateX(Math.PI / 2);
  if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')));
  g.translate(c.x, c.y, c.z);
  return g;
}

// Standard material set: matte cloth, worn plate metal, bright trim metal, dark leather.
export function outfitMaterials({ metal, rough, wear, cloth: ck = 'cloth', plate: pk = 'steel', trim: tk = 'gilt', leather: lk = 'leather' } = {}) {
  const o = (metal != null ? { metal } : {});
  return { cloth: real(ck), plate: real(pk, { ...o, ...(rough != null ? { rough } : {}) }), trim: real(tk), leather: real(lk) };
}

// A skinned sweep like kit.tube (same arguments), with the ring-to-bone mapping kept in step with the
// final triangle order: armor.js's tube reverses the winding of an inward-facing sweep on a copy of the
// index, so a flipped sweep there gets two of every three vertices bound to the neighbouring ring.
export function sweep(kit, slot, pts, rad, bind, opts = {}) {
  const { L, idx, byKey, lists } = kit;
  const seg = opts.seg || 14, n = pts.length, up0 = opts.up || V(0, 0, 1);
  const pos = [], ringOf = [], ix = [];
  let prevSide = null;
  for (let i = 0; i < n; i++) {
    const t = pts[Math.min(n - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
    let side = new THREE.Vector3().crossVectors(t, up0);
    if (side.lengthSq() < 1e-4) side = prevSide ? prevSide.clone() : V(1, 0, 0);
    side.normalize();
    const nrm = new THREE.Vector3().crossVectors(side, t).normalize();
    prevSide = side;
    const r = Array.isArray(rad[i]) ? rad[i] : [rad[i], rad[i]];
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      const p = pts[i].clone().addScaledVector(side, Math.cos(a) * r[0]).addScaledVector(nrm, Math.sin(a) * r[1]);
      pos.push(p.x, p.y, p.z); ringOf.push(i);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < seg; k++) {
    const a = i * seg + k, b = i * seg + (k + 1) % seg, c = (i + 1) * seg + k, d = (i + 1) * seg + (k + 1) % seg;
    ix.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(ix);
  g.computeVertexNormals();
  const nA = g.attributes.normal, mid = Math.floor(n / 2) * seg, pm = pts[Math.floor(n / 2)];
  const outward = V(pos[mid * 3] - pm.x, pos[mid * 3 + 1] - pm.y, pos[mid * 3 + 2] - pm.z);
  if (outward.dot(V(nA.getX(mid), nA.getY(mid), nA.getZ(mid))) < 0) {
    for (let q = 0; q < ix.length; q += 3) { const tmp = ix[q + 1]; ix[q + 1] = ix[q + 2]; ix[q + 2] = tmp; }
    g.setIndex(ix); g.computeVertexNormals();
  }
  const g1 = g.toNonIndexed();
  const allPos = Array.from(g1.attributes.position.array), allNor = Array.from(g1.attributes.normal.array), rings = ix.map((q) => ringOf[q]);
  if (opts.caps !== false) {
    for (const [i0, dir] of [[0, -1], [n - 1, 1]]) {
      const c = pts[i0], r = Array.isArray(rad[i0]) ? rad[i0] : [rad[i0], rad[i0]];
      const t = pts[Math.min(n - 1, i0 + 1)].clone().sub(pts[Math.max(0, i0 - 1)]).normalize();
      let side = new THREE.Vector3().crossVectors(t, up0); if (side.lengthSq() < 1e-4) side = V(1, 0, 0); side.normalize();
      const nrm = new THREE.Vector3().crossVectors(side, t).normalize();
      for (let k = 0; k < seg; k++) {
        const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
        const p0 = c.clone().addScaledVector(side, Math.cos(a0) * r[0]).addScaledVector(nrm, Math.sin(a0) * r[1]);
        const p1 = c.clone().addScaledVector(side, Math.cos(a1) * r[0]).addScaledVector(nrm, Math.sin(a1) * r[1]);
        for (const p of (dir > 0 ? [c, p0, p1] : [c, p1, p0])) { allPos.push(p.x, p.y, p.z); allNor.push(t.x * dir, t.y * dir, t.z * dir); rings.push(i0); }
      }
    }
  }
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', new THREE.Float32BufferAttribute(allPos, 3));
  g2.setAttribute('normal', new THREE.Float32BufferAttribute(allNor, 3));
  const nv = rings.length, carr = new Float32Array(nv * 3), base = new THREE.Color(opts.color != null ? opts.color : 0xffffff), ao = opts.ao == null ? 0.22 : opts.ao, tmpc = new THREE.Color();
  for (let v = 0; v < nv; v++) {
    const c = opts.ringColor ? tmpc.set(opts.ringColor(rings[v])) : tmpc.copy(base);
    const k = 1 - ao + ao * (allNor[v * 3 + 1] * 0.5 + 0.5) * 1.2;
    carr[v * 3] = c.r * k; carr[v * 3 + 1] = c.g * k; carr[v * 3 + 2] = c.b * k;
  }
  g2.setAttribute('color', new THREE.BufferAttribute(carr, 3));
  const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4), vp = V(0, 0, 0);
  for (let v = 0; v < nv; v++) {
    vp.set(allPos[v * 3], allPos[v * 3 + 1], allPos[v * 3 + 2]);
    let w = bind(rings[v], rings[v] / (n - 1), vp); if (typeof w === 'string') w = [[w, 1]];
    let tot = 0; for (const x of w) tot += x[1];
    w.slice(0, 4).forEach(([k, wt], j) => { si[v * 4 + j] = idx.get(byKey.get(k)); sw[v * 4 + j] = wt / tot; });
  }
  g2.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g2.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  if (L < 0) g2.rotateY(Math.PI);
  lists[slot].push(g2);
  return g2;
}

// A sleeve: a skinned sweep from the shoulder down the arm. `dists` are in upper-arm lengths
// (0 = shoulder, 1 = elbow, >1 continues down the forearm), `radii` per point (number or [ry, rz]).
export function sleeve(kit, slot, A, dists, radii, opts = {}) {
  const sh = kit.J(A + 'Arm'), el = kit.J(A + 'ForeArm'), wr = kit.J(A + 'Hand');
  const lenU = sh.distanceTo(el), lenF = el.distanceTo(wr);
  const pts = dists.map((t) => (t <= 1 ? sh.clone().lerp(el, t) : el.clone().lerp(wr, (t - 1) * lenU / lenF)));
  return sweep(kit, slot, pts, radii.map((r) => (Array.isArray(r) ? r : [r, r])), (i) => {
    const w = sstep(dists[i], 0.88, 1.12);
    return w <= 0.001 ? [[A + 'Arm', 1]] : w >= 0.999 ? [[A + 'ForeArm', 1]] : [[A + 'Arm', 1 - w], [A + 'ForeArm', w]];
  }, { seg: 14, ao: 0.25, ...opts });
}

// Trouser leg / greave sweep from the hip joint down to the ankle. `ts` are fractions of the whole
// leg length (0 = hip, 1 = ankle); the knee blends between the thigh and shin bones.
export function legwear(kit, slot, A, ts, radii, opts = {}) {
  const hp = kit.J(A + 'UpLeg'), kn = kit.J(A + 'Leg'), an = kit.J(A + 'Foot');
  const lenT = hp.distanceTo(kn), lenS = kn.distanceTo(an), total = lenT + lenS;
  const at = (t) => { const d = t * total; return d <= lenT ? hp.clone().lerp(kn, d / lenT) : kn.clone().lerp(an, (d - lenT) / lenS); };
  const pts = ts.map((t) => { const p = at(t); if (opts.fwd) p.z += opts.fwd(t); return p; });
  return sweep(kit, slot, pts, radii.map((r) => (Array.isArray(r) ? r : [r, r])), (i) => {
    const w = sstep(ts[i] * total, lenT - 0.07, lenT + 0.07);
    return w <= 0.001 ? [[A + 'UpLeg', 1]] : w >= 0.999 ? [[A + 'Leg', 1]] : [[A + 'UpLeg', 1 - w], [A + 'Leg', w]];
  }, { seg: 14, ao: 0.25, ...opts });
}

// A skirt / coat tail around the pelvis: one flared tube whose lower rings follow each leg.
export function skirt(kit, slot, ys, rx, rz, opts = {}) {
  const torso = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck'];
  const pts = ys.map((y) => V(0, y, opts.cz || 0));
  const top = opts.legFrom != null ? opts.legFrom : 1.02, bot = opts.legTo != null ? opts.legTo : 0.82;
  return sweep(kit, slot, pts, ys.map((_, i) => [rx[i], rz[i]]), (i, u, p) => {
    const y = pts[i].y;
    const w = (1 - sstep(y, bot, top)) * sstep(Math.abs(p.x), 0.0, 0.08); // 0 above the hip line, 1 below the crotch
    const upper = y > 1.05 ? chainW(kit, torso, y) : [['Hips', 1]];
    if (w < 0.001) return upper;
    const side = p.x >= 0 ? 'Left' : 'Right';
    return [...upper.map(([k, v]) => [k, v * (1 - w)]), [side + 'UpLeg', w]];
  }, { seg: 28, ao: 0.28, ...opts });
}
function chainW(kit, keys, y) {
  const ys = keys.map((k) => kit.J(k).y);
  if (y >= ys[ys.length - 1]) return [[keys[keys.length - 1], 1]];
  for (let i = 0; i < keys.length - 1; i++) if (y >= ys[i] && y <= ys[i + 1]) { const t = (y - ys[i]) / (ys[i + 1] - ys[i]); return [[keys[i], 1 - t], [keys[i + 1], t]]; }
  return [[keys[0], 1]];
}
export { chainW };

// Torso wrap: a sweep up the trunk bound to the spine chain. rows: [y, rx, rz, cz].
export function torsoTube(kit, slot, rows, opts = {}) {
  const pts = rows.map((r) => V(0, r[0], r[3] || 0)), rad = rows.map((r) => [r[1], r[2]]);
  return sweep(kit, slot, pts, rad, (i) => chainW(kit, ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck'], pts[i].y), { seg: 24, ao: 0.26, ...opts });
}

// Re-colours a kit geometry's baked vertex colours in canonical coordinates: fn(x, y, z) -> colour or null (keep).
export function repaint(kit, g, fn, ao = 0.22) {
  const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color, L = kit.L, col = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const r = fn(p.getX(i) * L, p.getY(i), p.getZ(i) * L, n.getY(i));
    if (r == null) continue;
    col.set(r);
    const k = 1 - ao + ao * (n.getY(i) * 0.5 + 0.5) * 1.2;
    c.setXYZ(i, col.r * k, col.g * k, col.b * k);
  }
  return g;
}

// A smooth head shell over the mannequin's wedge face (quill's numbers), returned for `add`.
export function headShell(scale = 1) {
  return ell(V(0, 1.69, 0.01), [0.108 * scale, 0.122 * scale, 0.118 * scale], null, 30, [0.9, 0.9]);
}

// Recolours the mannequin's own body meshes (Beta_Surface / Beta_Joints). `fn(mesh, material)` may replace
// the material entirely by returning one.
export function tintBody(scene, skip, surface, joints, fn) {
  scene.traverse((o) => {
    if (!o.isSkinnedMesh || o === skip) return;
    let m = o.material.clone();
    const isJ = /Joints/i.test(o.name);
    m.color.set(isJ ? joints : surface); m.metalness = 0; m.roughness = 0.7;
    if (fn) m = fn(o, m, isJ) || m;
    o.material = m;
  });
}

// Chainmail: a triplanar ring lattice baked into the body material (object-space, so it stays put).
export function mailMaterial(color, unit = 1) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.75 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uUnit = { value: unit };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON; uniform float uUnit;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position * uUnit; vON = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vOP; varying vec3 vON;
        float ringP(vec2 p){ vec2 a = fract(p) - 0.5; vec2 b = fract(p + 0.5) - 0.5; float d = min(length(a), length(b)); return smoothstep(0.46, 0.34, d) * smoothstep(0.14, 0.26, d); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 w = pow(abs(vON), vec3(3.0)); w /= (w.x + w.y + w.z);
        float pat = ringP(vOP.yz * 125.0) * w.x + ringP(vOP.xz * 125.0) * w.y + ringP(vOP.xy * 125.0) * w.z;
        diffuseColor.rgb *= 0.55 + 0.7 * pat;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor *= 1.15 - 0.5 * pat;`);
  };
  m.customProgramCacheKey = () => 'mail';
  return m;
}

// Simple eyes: dark almond with a bright highlight, on the head bone.
export function eyes(kit, slot, y, z, color = 0x1a1410, w = 0.034, gap = 0.036, slotHi = slot) {
  kit.mirror((s) => {
    kit.add(slot, ell(V(s * gap, y, z), [w * 0.5, w * 0.3, 0.006], null, 10), 'Head', color, 0);
    kit.add(slotHi, ell(V(s * gap + s * 0.004, y + 0.003, z + 0.004), [0.004, 0.004, 0.003], null, 6), 'Head', 0xffffff, 0);
  });
}
