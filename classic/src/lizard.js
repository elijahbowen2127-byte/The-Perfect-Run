// Turns a smooth Mixamo body (the X Bot rig) into a scaled lizard warrior:
// reptile skin shader, a sculpted reptile head with jaws, teeth and slit eyes,
// a dorsal crest, claws, and a jointed tail that sways and lags behind.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { boneKey } from './retarget.js';

const V = (...a) => new THREE.Vector3(...a);

// Shared reptile skin: triplanar Voronoi scales in object space, olive back,
// pale belly, darker banding. Works on skinned and rigid meshes alike.
export function scaleMaterial({ base = 0x3f5a2a, belly = 0xb9b07a, band = 0x24331a, scale = 30, skinned = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.0 });
  m.userData.uniforms = { uBase: { value: new THREE.Color(base) }, uBelly: { value: new THREE.Color(belly) }, uBand: { value: new THREE.Color(band) }, uScale: { value: scale }, uUnit: { value: 1 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON; uniform float uUnit;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position * uUnit; vON = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vOP; varying vec3 vON;
        uniform vec3 uBase, uBelly, uBand; uniform float uScale;
        vec2 h2(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
        // Returns (edge distance, cell id)
        vec2 vor(vec2 p){ vec2 i=floor(p), f=fract(p); float d1=8.0, d2=8.0; float id=0.0;
          for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y); vec2 o=h2(i+g); o = 0.5+0.4*sin(o*6.2831); vec2 r=g+o-f; float d=dot(r,r);
            if(d<d1){ d2=d1; d1=d; id=h2(i+g).x; } else if(d<d2) d2=d; }
          return vec2(sqrt(d2)-sqrt(d1), id); }
        vec3 tri(vec3 p, vec3 n){ vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x+w.y+w.z);
          vec2 a = vor(p.zy*uScale), b = vor(p.xz*uScale), c = vor(p.xy*uScale);
          return vec3(a.x*w.x+b.x*w.y+c.x*w.z, a.y*w.x+b.y*w.y+c.y*w.z, 0.0); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 sc = tri(vOP, normalize(vON));
        float fw = fwidth(vOP.y * uScale) + fwidth(vOP.x * uScale);
        float far = smoothstep(0.08, 0.45, fw);
        float edge = mix(smoothstep(0.0, 0.12, sc.x), 0.8, far);
        float bellyK = smoothstep(0.15, 0.75, normalize(vON).z) * smoothstep(0.25, 0.9, 1.0 - abs(normalize(vON).y));
        vec3 col = mix(uBase, uBelly, bellyK * 0.85);
        float bandK = smoothstep(0.55, 0.8, sin(vOP.y * 38.0 + sin(vOP.x * 20.0) * 1.5) * 0.5 + 0.5) * (1.0 - bellyK);
        col = mix(col, uBand, bandK * 0.6);
        col *= mix(0.82 + sc.y * 0.3, 0.97, far);
        col *= mix(0.45, 1.0, edge);
        diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.85, 0.42, edge);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float h = smoothstep(0.0, 0.15, sc.x); vec3 g = vec3(dFdx(h), dFdy(h), 0.0) * 2.5; normal = normalize(normal + vec3(-g.x, -g.y, 0.0)); }`);
  };
  return m;
}

function sculptHead(S) {
  // Start from a dense sphere and push it into a long reptile skull.
  const g = new THREE.SphereGeometry(1, 48, 36);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let { x, y, z } = v;
    // Snout along +z: stretch the front half and taper it.
    if (z > 0) {
      const t = z;
      z = z * 2.35;
      const taper = 1 - 0.55 * Math.pow(t, 1.3);
      x *= taper; y *= taper * 0.92;
      y -= t * 0.18; // snout dips a little
    } else { z *= 1.05; }
    y *= y > 0 ? 0.68 : 0.9; // flat crown, deep jaw
    if (y > 0) y -= Math.max(0, Math.abs(x) - 0.55) * 0.25; // squared-off sides of the skull
    x *= 0.92;
    // Brow ridges over the eyes.
    const ex = Math.abs(x) - 0.62, ez = z - 0.45, ey = y - 0.42;
    y += 0.16 * Math.exp(-(ex * ex * 22 + ez * ez * 8 + ey * ey * 18));
    x += Math.sign(x) * 0.05 * Math.exp(-(ex * ex * 22 + ez * ez * 8 + ey * ey * 18));
    // Cheek bulge behind the jaw.
    const cz = z + 0.2, cy = y + 0.2;
    x += Math.sign(x) * 0.12 * Math.exp(-(cz * cz * 6 + cy * cy * 8));
    // Mouth groove along the jaw line.
    const mouthY = -0.25 - z * 0.06;
    const md = (y - mouthY);
    if (z > -0.3) { const k = Math.exp(-md * md * 600) * Math.min(1, (z + 0.3) * 3); x *= 1 - 0.08 * k; y -= 0.0 * k; }
    // Nostrils.
    for (const s of [-1, 1]) { const nx = x - s * 0.17, nz = z - 2.05, ny = y + 0.05; const k = Math.exp(-(nx * nx + nz * nz + ny * ny) * 160); x -= s * 0.04 * k; y -= 0.03 * k; }
    p.setXYZ(i, x * 0.085 * S, y * 0.085 * S, z * 0.085 * S);
  }
  g.computeVertexNormals();
  return g;
}

function eyeTexture(iris = ['#ffe36a', '#d68b12']) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, iris[0]); gr.addColorStop(0.6, iris[1]); gr.addColorStop(1, '#2a1205');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(90,40,0,${Math.random() * 0.4})`; const a = Math.random() * 6.28; g.beginPath(); g.moveTo(64 + Math.cos(a) * 12, 64 + Math.sin(a) * 12); g.lineTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62); g.stroke(); }
  g.fillStyle = '#050302'; g.beginPath(); g.ellipse(64, 64, 7, 44, 0, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildLizard(rig, { base, belly, band, eye, body = 'goblin' } = {}) {
  rig.updateMatrixWorld(true);
  const bones = new Map();
  rig.traverse((o) => { if (o.isBone && !bones.has(boneKey(o.name))) bones.set(boneKey(o.name), o); });
  const P = (k) => bones.get(k).getWorldPosition(new THREE.Vector3());
  const S = (bones.has('HeadTop_End') ? P('HeadTop_End').y : 1.78) / 1.78;
  const skin = scaleMaterial({ base, belly, band, skinned: true });
  const rigid = scaleMaterial({ base, belly, band });
  if (body === 'goblin') rig.traverse((o) => { if (o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map((m) => reptilize(m, { hue: 0.25, scale: 34 })) : reptilize(o.material, { hue: 0.25, scale: 34 }); o.castShadow = true; } });
  else rig.traverse((o) => { if (o.isMesh) { o.material = skin; o.castShadow = true; } });
  // Mixamo meshes are authored in centimetres; measure scales in metres.
  rig.traverse((o) => { if (o.isSkinnedMesh) skin.userData.uniforms.uUnit.value = o.matrixWorld.getMaxScaleOnAxis(); });
  if (body !== 'goblin') {
    const ch = P('Spine2'), hp = P('Hips'), sp1 = P('Spine1');
    rig.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const fwd = o.matrixWorld.clone(), inv = fwd.clone().invert();
      const pos = o.geometry.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(fwd);
        // Flatten the chest into a broad, plated reptile breast.
        for (const sx of [-1, 1]) {
          const d = V(v.x - (ch.x + sx * 0.08 * S), v.y - (ch.y + 0.0 * S), 0);
          const k = Math.exp(-(d.x * d.x + d.y * d.y) / (0.07 * 0.07 * S * S));
          if (v.z > ch.z + 0.04 * S) v.z -= k * 0.045 * S;
        }
        // Broaden shoulders and ribcage, thicken the waist.
        const ty = (v.y - hp.y) / (ch.y + 0.15 * S - hp.y);
        if (ty > -0.1 && ty < 1.2 && Math.abs(v.x) < 0.25 * S) {
          const w = 1 + 0.16 * Math.max(0, Math.min(1, ty)) + 0.1 * Math.exp(-((ty - 0.35) ** 2) * 12);
          v.x = ch.x + (v.x - ch.x) * w;
          v.z = ch.z + (v.z - ch.z) * (1 + 0.08 * Math.max(0, ty));
        }
        // Narrower, squarer pelvis.
        const py = (v.y - (hp.y - 0.12 * S)) / (0.25 * S);
        if (py > 0 && py < 1 && Math.abs(v.x) < 0.22 * S) v.x = hp.x + (v.x - hp.x) * (1 - 0.12 * Math.sin(py * Math.PI));
        v.applyMatrix4(inv); pos.setXYZ(i, v.x, v.y, v.z);
      }
      o.geometry.computeVertexNormals();
    });
  }

  const parts = [];
  const attach = (k, mesh) => { rig.add(mesh); bones.get(k).attach(mesh); mesh.castShadow = true; parts.push(mesh); return mesh; };

  // Hide the mannequin's head by collapsing its weights? Simpler: the new head
  // is larger and covers it. Place it on the Head bone.
  const hp = P('Head'), top = P('HeadTop_End');
  // Shrink the mannequin's own head so the reptile skull fully covers it.
  // Collapse the base model's own head; the sculpted reptile skull replaces it.
  if (body === 'goblin') {
    // Every mesh island that sits mostly inside the head (face, ears, hair knot)
    // is rebound to the head bone, which is then collapsed.
    const neckY = P('Neck').y + 0.02 * S, headB = bones.get('Head');
    const c = hp.clone().lerp(top, 0.45).add(V(0, 0, 0.04 * S));
    const inHead = (v) => v.y > neckY && ((v.x - c.x) / (0.4 * S)) ** 2 + ((v.y - c.y) / (0.2 * S)) ** 2 + ((v.z - c.z) / (0.22 * S)) ** 2 < 1;
    rig.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const hi = o.skeleton.bones.indexOf(headB); if (hi < 0) return;
      const g = o.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = pos.count;
      const par = new Int32Array(n); for (let i = 0; i < n; i++) par[i] = i;
      const f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
      const idx = g.index ? g.index.array : null;
      if (idx) for (let t = 0; t < idx.length; t += 3) { const a1 = f(idx[t]), b1 = f(idx[t + 1]), c1 = f(idx[t + 2]); par[a1] = c1; par[b1] = c1; }
      const v = new THREE.Vector3(), inside = new Uint8Array(n), cnt = new Map();
      for (let i = 0; i < n; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.bindMatrix);
        inside[i] = inHead(v) ? 1 : 0;
        const r = f(i); const e = cnt.get(r) || [0, 0]; e[0]++; e[1] += inside[i]; cnt.set(r, e);
      }
      for (let i = 0; i < n; i++) {
        const e = cnt.get(f(i)); const frac = e[1] / e[0];
        if (frac > 0.6 || (inside[i] && frac > 0.25)) { si.setXYZW(i, hi, 0, 0, 0); sw.setXYZW(i, 1, 0, 0, 0); }
      }
      si.needsUpdate = sw.needsUpdate = true;
    });
  }
  bones.get('Head').scale.setScalar(body === 'goblin' ? 0.02 : 0.6); rig.updateMatrixWorld(true);
  const headC = new THREE.Vector3(hp.x, hp.y + 0.085 * S, hp.z + 0.05 * S);
  const HS = S * (body === 'goblin' ? 1.3 : 1);
  const headGeo = sculptHead(HS);
  headGeo.translate(headC.x, headC.y, headC.z - 0.02 * HS);
  attach('Head', new THREE.Mesh(headGeo, rigid));

  // Teeth along both jaws.
  const teeth = [];
  for (const s of [-1, 1]) for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const z = (0.05 + t * 0.12) * HS, x = s * (0.05 - t * 0.022) * HS;
    const y = (-0.25 - (z / (0.085 * HS)) * 0.06) * 0.085 * HS * 0.95;
    for (const up of [1, -1]) {
      const c = new THREE.ConeGeometry(0.0022 * HS, (0.007 + (i % 3 === 0 ? 0.004 : 0)) * HS, 5);
      if (up > 0) c.rotateX(Math.PI);
      c.translate(headC.x + x, headC.y + y + up * 0.004 * HS, headC.z - 0.02 * HS + z);
      teeth.push(c);
    }
  }
  attach('Head', new THREE.Mesh(mergeGeometries(teeth), new THREE.MeshStandardMaterial({ color: 0xd8cca4, roughness: 0.35 })));

  // Eyes.
  const eyeMat = new THREE.MeshPhysicalMaterial({ map: eyeTexture(eye), roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.0125 * HS, 20, 14), eyeMat);
    e.position.set(headC.x + s * 0.05 * HS, headC.y + 0.026 * HS, headC.z + 0.03 * HS);
    e.rotation.y = s * 0.9; // the pupil texture centre (+z of uv sphere seam) faces out
    e.rotation.y = s > 0 ? Math.PI / 2 - 0.5 : -Math.PI / 2 + 0.5;
    attach('Head', e);
  }

  // Dorsal crest: spines from the brow down the neck and back.
  const crest = (k, a, b, n, h0, h1) => {
    const geos = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(1, n - 1);
      const p = a.clone().lerp(b, t);
      const h = (h0 + (h1 - h0) * t) * HS;
      const c = new THREE.ConeGeometry(0.008 * HS, h, 4); c.scale(0.5, 1, 1.6); c.rotateX(-0.6);
      c.translate(p.x, p.y + h * 0.4, p.z);
      geos.push(c);
    }
    attach(k, new THREE.Mesh(mergeGeometries(geos), rigid));
  };
  crest('Head', V(headC.x, headC.y + 0.06 * HS, headC.z + 0.02 * HS), V(headC.x, headC.y + 0.03 * HS, headC.z - 0.09 * HS), 5, 0.025, 0.045);
  if (bones.has('Neck')) crest('Neck', P('Neck').add(V(0, 0.02 * S, -0.06 * S)), P('Head').add(V(0, -0.02 * S, -0.08 * S)), 3, 0.04, 0.04);
  if (bones.has('Spine2')) crest('Spine2', P('Spine2').add(V(0, 0.12 * S, -0.1 * S)), P('Spine2').add(V(0, -0.02 * S, -0.11 * S)), 4, 0.04, 0.035);
  if (bones.has('Spine')) crest('Spine', P('Spine1').add(V(0, 0, -0.1 * S)), P('Spine').add(V(0, -0.05 * S, -0.1 * S)), 4, 0.032, 0.025);

  // Claws on fingers and toes.
  const clawMat = new THREE.MeshStandardMaterial({ color: 0x1d1812, roughness: 0.35 });
  for (const sd of ['Left', 'Right']) {
    for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
      const k3 = sd + 'Hand' + f + '3', k4 = sd + 'Hand' + f + '4';
      if (!bones.has(k3) || !bones.has(k4)) continue;
      const a = P(k3), b = P(k4);
      const d = b.clone().sub(a).normalize();
      const c = new THREE.ConeGeometry(0.0045 * S, 0.022 * S, 6);
      c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d));
      c.translate(b.x + d.x * 0.008 * S, b.y + d.y * 0.008 * S - 0.003 * S, b.z + d.z * 0.008 * S);
      attach(k3, new THREE.Mesh(c, clawMat));
    }
    if (bones.has(sd + 'ToeBase')) {
      const t = P(sd + 'ToeBase'), te = bones.has(sd + 'Toe_End') ? P(sd + 'Toe_End') : t.clone().add(V(0, 0, 0.08 * S));
      const geos = [];
      for (let i = 0; i < 3; i++) {
        const c = new THREE.ConeGeometry(0.006 * S, 0.035 * S, 6); c.rotateX(Math.PI / 2 + 0.3);
        c.translate(te.x + (i - 1) * 0.022 * S, te.y + 0.012 * S, te.z + 0.01 * S);
        geos.push(c);
      }
      attach(sd + 'ToeBase', new THREE.Mesh(mergeGeometries(geos), clawMat));
    }
  }

  addTail(rig, bones, rigid, S);
  return parts;
}

export function addTail(rig, bones, rigid, S, { length = 1, girth = 1 } = {}) {
  // A chain of tapered segments under the hips, animated by the caller.
  const hips = bones.get('Hips');
  const hipP = hips.getWorldPosition(new THREE.Vector3());
  const tailRoot = new THREE.Object3D();
  tailRoot.position.copy(hipP).add(V(0, -0.06 * S, -0.08 * S));
  rig.add(tailRoot); hips.attach(tailRoot);
  const segs = [];
  let parent = tailRoot;
  const N = 12, segLen = 0.085 * S * length;
  for (let i = 0; i < N; i++) {
    const r0 = (0.085 - i * 0.0068) * S * girth, r1 = (0.085 - (i + 1) * 0.0068) * S * girth;
    const g = new THREE.CylinderGeometry(Math.max(0.006 * S, r1), Math.max(0.008 * S, r0), segLen * 1.18, 16, 1, false);
    g.rotateX(-Math.PI / 2); g.translate(0, 0, -segLen / 2);
    const cap = new THREE.SphereGeometry(Math.max(0.008 * S, r0), 16, 10); cap.scale(1, 1, 1.1);
    const geo = mergeGeometries([g.toNonIndexed(), cap.toNonIndexed()]);
    geo.scale(1, 0.85, 1);
    const seg = new THREE.Mesh(geo, rigid);
    seg.castShadow = true;
    const joint = new THREE.Object3D();
    joint.name = 'tail_' + i;
    joint.position.set(0, 0, i === 0 ? 0 : -segLen);
    joint.rotation.x = i === 0 ? -0.75 : 0.06; // droop, then curl gently back up
    parent.add(joint); joint.add(seg);
    // Crest along the tail.
    if (i < N - 2) {
      const c = new THREE.ConeGeometry(0.006 * S, (0.03 - i * 0.002) * S, 4); c.scale(0.5, 1, 1.6); c.rotateX(-0.5);
      c.translate(0, Math.max(0.008 * S, r0) * 0.85, -segLen * 0.5);
      joint.add(new THREE.Mesh(c, rigid));
    }
    segs.push(joint);
    parent = joint;
  }
  rig.userData.tail = segs;
  rig.userData.tailBase = segs.map((s) => s.rotation.x);
}

// Call every frame: speed in m/s, turn rate in rad/s. The sway runs off an accumulated
// phase (so a change of speed never makes the tail jump), the tail drags behind turns
// with a lag, and it whips a little when the body stops or starts. Optional `rate` is the
// sway rate in rad/s (pass the stride rate to tie the swish to the footfalls).
export function animateTail(rig, t, dt, speed = 0, turn = 0, rate = null) {
  const segs = rig.userData.tail; if (!segs) return;
  const base = rig.userData.tailBase, ud = rig.userData;
  if (ud.tailPh === undefined) { ud.tailPh = t * 2.2; ud.tailTurn = turn; ud.tailSp = speed; }
  ud.tailPh += dt * (rate != null ? rate : 2.2 + speed * 0.4);
  ud.tailTurn += (turn - ud.tailTurn) * Math.min(1, dt * 5);
  const accel = (speed - ud.tailSp) / Math.max(dt, 1e-3); ud.tailSp = speed;
  ud.tailLift = (ud.tailLift || 0) + (Math.max(-3, Math.min(3, accel)) * 0.012 - ud.tailLift) * Math.min(1, dt * 6);
  const amp = 0.08 + Math.min(1, speed / 8) * 0.12;
  const ph = ud.tailPh;
  for (let i = 0; i < segs.length; i++) {
    const k = i / segs.length;
    segs[i].rotation.y = Math.sin(ph - i * 0.55) * amp * (0.3 + k) - ud.tailTurn * 0.06 * (1 - k * 0.3);
    segs[i].rotation.x = base[i] + Math.sin(t * 1.3 - i * 0.4) * 0.02 + (i > 0 ? Math.min(1, speed / 10) * 0.012 + ud.tailLift * k : -Math.min(1, speed / 10) * 0.2);
  }
}

// Re-skins an existing textured creature: warm skin tones shift to reptile
// greens and pick up a scale pattern; cloth and metal keep their colours.
export function reptilize(mat, { hue = 0.24, scale = 45 } = {}) {
  const m = mat.clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uHue = { value: hue }; sh.uniforms.uScale = { value: scale }; sh.uniforms.uUnit = { value: m.userData.unit || 1 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON; uniform float uUnit;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position * uUnit; vON = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vOP; varying vec3 vON; uniform float uHue, uScale;
        vec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.,-1./3.,2./3.,-1.); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1.0e-10; return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x); }
        vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.,2./3.,1./3.,3.); vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y); }
        vec2 h2(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
        float vor(vec2 p){ vec2 i=floor(p), f=fract(p); float d1=8.0, d2=8.0;
          for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y); vec2 o=h2(i+g); vec2 r=g+o-f; float d=dot(r,r); if(d<d1){ d2=d1; d1=d; } else if(d<d2) d2=d; }
          return sqrt(d2)-sqrt(d1); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        { vec3 hsv = rgb2hsv(diffuseColor.rgb);
          float skinK = smoothstep(0.02, 0.0, abs(hsv.x - 0.06) - 0.07) * smoothstep(0.12, 0.3, hsv.y) * smoothstep(0.08, 0.25, hsv.z);
          vec3 n = normalize(vON); vec3 w = pow(abs(n), vec3(4.)); w /= w.x+w.y+w.z;
          float e = vor(vOP.zy*uScale)*w.x + vor(vOP.xz*uScale)*w.y + vor(vOP.xy*uScale)*w.z;
          float fw = fwidth(vOP.y*uScale) ; float edge = mix(smoothstep(0.0, 0.12, e), 0.8, smoothstep(0.3, 0.8, fw));
          vec3 lizard = hsv2rgb(vec3(uHue + (hsv.x - 0.06) * 0.6, min(1.0, hsv.y * 1.1), hsv.z * 0.9)) * mix(0.55, 1.0, edge);
          diffuseColor.rgb = mix(diffuseColor.rgb, lizard, skinK); }`);
  };
  return m;
}
