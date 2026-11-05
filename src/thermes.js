// Thermes, the final boss: a shirtless demonic viking deity on the veteran's rig. Dark purple skin that pulses to a lighter
// purple, a breathing blue aura shell, ice-blue glowing eyes (laser sources), short curved horns, pointed ears, clawed hands,
// braided beard and hair, fur-trimmed leather kilt, arm rings, bracers and a torc.
//
// Everything hand-built goes through the armor kit into ONE skinned mesh (a material per slot); mobrig's collapse() later merges
// the body per material and drops mesh names, so the runtime hooks find things by MATERIAL NAME and by bone:
//   tickThermes(root, dt, t)  drives the skin pulse / aura breathing / eye flicker (caches on root.userData.thermes)
//   thermesEyes(root, out)    fills out[0] (left) and out[1] (right) with the eyes' world positions (Head bone + stored offsets)
import * as THREE from 'three';
import { makeKit, V, ell, limb, chainWeights, bevBox, patch, paint } from './armor.js';
import { real } from './realmat.js';
import { boneKey } from './retarget.js';

export const THERMES_SKIN_DARK = 0x2a1040, THERMES_SKIN_LIGHT = 0x6a2aa0, THERMES_EYE = 0x7fd8ff, THERMES_AURA = 0x3a8aff;
const PULSE_PERIOD = 1.2;
const MAT = { skin: 'thermes_skin', eye: 'thermes_eye', aura: 'thermes_aura' };

// Additive fresnel shell: the body geometry pushed out along its normals in the vertex shader (uGrow), lit only by a view-angle
// rim so it reads as a halo round the silhouette with a faint fill over the skin. Skinning uniforms come from the renderer.
function auraMaterial() {
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(THERMES_AURA) }, uPulse: { value: 0.5 }, uGrow: { value: 0.03 } },
    vertexShader: `
      #include <common>
      #include <skinning_pars_vertex>
      uniform float uGrow; uniform float uPulse;
      varying vec3 vN; varying vec3 vV;
      void main() {
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        transformed += objectNormal * uGrow * (0.75 + 0.5 * uPulse);
        #include <skinning_vertex>
        #include <project_vertex>
        vN = normalize(normalMatrix * objectNormal);
        vV = -mvPosition.xyz;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uPulse;
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec3 n = normalize(vN), v = normalize(vV);
        float f = 1.0 - abs(dot(n, v));
        float rim = pow(f, 3.5);
        float k = 0.45 + 0.8 * uPulse;
        vec3 c = uColor * (rim * 0.85 + 0.008) * k + vec3(0.5, 0.75, 1.0) * pow(f, 9.0) * 0.6 * k;
        gl_FragColor = vec4(c, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide, fog: false,
  });
  m.name = MAT.aura;
  return m;
}

// Rigid tapered sweep along a Catmull-Rom path: radius(t) in 0..1, optional per-vertex tint fn(t) -> hex.
function sweep(pts, radius, seg = 10, steps = 24) {
  const curve = new THREE.CatmullRomCurve3(pts), pos = [], idx = [];
  let prev = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, p = curve.getPoint(t), tan = curve.getTangent(t).normalize();
    let side = prev ? prev.clone().sub(tan.clone().multiplyScalar(prev.dot(tan))) : new THREE.Vector3().crossVectors(tan, Math.abs(tan.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0));
    if (side.lengthSq() < 1e-6) side = new THREE.Vector3().crossVectors(tan, V(1, 0, 0));
    side.normalize(); prev = side;
    const nrm = new THREE.Vector3().crossVectors(tan, side).normalize(), r = radius(t);
    for (let k = 0; k < seg; k++) { const a = (k / seg) * Math.PI * 2; const q = p.clone().addScaledVector(side, Math.cos(a) * r).addScaledVector(nrm, Math.sin(a) * r); pos.push(q.x, q.y, q.z); }
  }
  for (let i = 0; i < steps; i++) for (let k = 0; k < seg; k++) { const a = i * seg + k, b = i * seg + (k + 1) % seg, c = a + seg, d = b + seg; idx.push(a, c, b, b, c, d); }
  // end caps
  const tip = curve.getPoint(1), base = curve.getPoint(0), ti = pos.length / 3; pos.push(tip.x, tip.y, tip.z, base.x, base.y, base.z);
  for (let k = 0; k < seg; k++) { idx.push(steps * seg + k, ti, steps * seg + (k + 1) % seg); idx.push((k + 1) % seg, ti + 1, k); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  // orient outward
  const n = g.attributes.normal, mid = Math.floor(steps / 2) * seg, pm = curve.getPoint(0.5);
  if ((pos[mid * 3] - pm.x) * n.getX(mid) + (pos[mid * 3 + 1] - pm.y) * n.getY(mid) + (pos[mid * 3 + 2] - pm.z) * n.getZ(mid) < 0) { const a = g.index.array; for (let q = 0; q < a.length; q += 3) { const t = a[q + 1]; a[q + 1] = a[q + 2]; a[q + 2] = t; } g.computeVertexNormals(); }
  return g;
}
// Braid: a sweep whose radius swells and pinches every few centimetres.
const braid = (pts, r0, r1, pitch = 0.032) => {
  const len = new THREE.CatmullRomCurve3(pts).getLength();
  return sweep(pts, (t) => (r0 + (r1 - r0) * t) * (0.82 + 0.18 * Math.sin((t * len / pitch) * Math.PI * 2)), 8, Math.max(16, Math.round(len / pitch * 3)));
};
const torus = (c, R, r, rot, seg = 24) => { const g = new THREE.TorusGeometry(R, r, 8, seg); if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ'))); g.translate(c.x, c.y, c.z); return g; };

export function buildThermes(scene, skin) {
  // ---- materials ----
  const src = real('skin');
  const skinMat = src.clone(); skinMat.onBeforeCompile = src.onBeforeCompile; skinMat.customProgramCacheKey = src.customProgramCacheKey;
  skinMat.name = MAT.skin; skinMat.color.set(THERMES_SKIN_DARK); skinMat.roughness = 0.42;
  skinMat.emissive = new THREE.Color(0x4a1a80); skinMat.emissiveIntensity = 0.1;
  skinMat.sheenColor = new THREE.Color(0x6a8ad0); skinMat.sheen = 0.9;
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x082030, emissive: THERMES_EYE, emissiveIntensity: 2.6, roughness: 0.2, metalness: 0, vertexColors: true, toneMapped: false });
  eyeMat.name = MAT.eye;
  const hairMat = real('felt', { scale: 1.3, bump: 0.45 }), leatherMat = real('leather'), furMat = real('felt', { scale: 0.8 }), giltMat = real('gilt'), hornMat = real('bone', { bump: 0.8 });
  const aura = auraMaterial();
  const S = 0, E = 1, H = 2, LE = 3, FU = 4, G = 5, HO = 6, AU = 7;
  const kit = makeKit(scene, [skinMat, eyeMat, hairMat, leatherMat, furMat, giltMat, hornMat, aura], 'thermes_body');
  const { add, mirror, tube, J } = kit;
  const W = 0xffffff; // skin pieces are white in the vertex colours: the material colour carries the pulsing purple
  const auraGeos = [], AG = (g) => { auraGeos.push(g); return g; }; // the big sweeps only: overlapping small shells would draw bubble outlines
  const HAIR = 0x1a1422, LEATH = 0x3a2416, LEATH2 = 0x2a1a10, FUR = 0x5a4a3c, GILT = 0xd0a040, HORN = 0x1a1216;

  // ---- the veteran body: keep the real hands (clawed, bigger), face and beard; drop the clothes and teeth ----
  const drop = [];
  scene.traverse((o) => { if (o.isMesh) drop.push(o); });
  const white = (g) => { if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3)); };
  for (const o of drop) {
    if (/Wolf3D_Body/.test(o.name)) { keepBones(o, /Hand/); o.material = skinMat; o.castShadow = true; }
    else if (/Wolf3D_Head/.test(o.name)) { white(o.geometry); o.material = skinMat; }
    else if (/^Eye(Left|Right)$/.test(o.name)) { white(o.geometry); o.material = eyeMat; }
    else if (o.parent) o.parent.remove(o);
  }
  for (const sd of ['Left', 'Right']) { const hb = kit.byKey.get(sd + 'Hand'); if (hb) hb.scale.setScalar(1.22); }

  // ---- torso: a barrel chest over a hard waist ----
  const torsoBones = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck'];
  {
    const rows = [ // y, rx, rz, z
      [0.97, 0.16, 0.115, 0.0], [1.02, 0.178, 0.125, 0.0], [1.1, 0.168, 0.118, 0.004], [1.18, 0.176, 0.124, 0.008], [1.26, 0.196, 0.134, 0.006],
      [1.34, 0.216, 0.144, 0.0], [1.42, 0.23, 0.15, -0.008], [1.48, 0.22, 0.14, -0.016], [1.53, 0.17, 0.112, -0.022], [1.565, 0.1, 0.085, -0.02],
    ];
    const pts = rows.map((r) => V(0, r[0], r[3])), rad = rows.map((r) => [r[1], r[2]]);
    AG(tube(S, pts, rad, (i) => chainWeights(kit, torsoBones, pts[i].y), { color: W, ao: 0.3, seg: 28, up: V(0, 0, 1) }));
    mirror((s) => {
      add(S, ell(V(s * 0.1, 1.4, 0.118), [0.108, 0.078, 0.052], [0.25, 0, s * -0.15], 16), 'Spine2', W, 0.3);          // pecs
      add(S, ell(V(s * 0.09, 1.535, -0.015), [0.085, 0.05, 0.075], [0, 0, s * 0.5], 14), 'Spine2', W, 0.3);           // traps
      add(S, ell(V(s * 0.16, 1.3, -0.045), [0.075, 0.12, 0.1], [0, 0, s * -0.15], 14), 'Spine1', W, 0.3);             // lats
      for (let r = 0; r < 3; r++) add(S, ell(V(s * 0.046, 1.3 - r * 0.075, 0.128 - r * 0.004), [0.042, 0.034, 0.02], null, 12), r === 0 ? 'Spine1' : 'Spine', W, 0.3); // abs
      add(S, ell(V(s * 0.095, 1.095, 0.11), [0.055, 0.045, 0.024], [0.3, 0, s * 0.5], 12), 'Hips', W, 0.3);           // lower obliques
      add(S, ell(V(s * 0.07, 1.47, 0.07), [0.07, 0.03, 0.03], [0, 0, s * -0.1], 10), 'Spine2', W, 0.3);               // collarbones
    });
    AG(add(S, ell(V(0, 1.02, -0.01), [0.17, 0.085, 0.125], null, 20), 'Hips', W, 0.3));
    add(S, ell(V(0, 0.95, 0.0), [0.14, 0.07, 0.11], null, 18), 'Hips', W, 0.3);
    add(S, ell(V(0, 1.44, 0.11), [0.025, 0.09, 0.02], null, 10), 'Spine2', W, 0.3);                                   // sternum
  }
  // Neck: thick, swallowing the veteran head's own thin neck.
  const neck = J('Neck'), headJ = J('Head');
  AG(tube(S, [V(0, neck.y - 0.02, -0.02), V(0, neck.y + 0.06, -0.012), V(0, headJ.y + 0.015, 0.0)], [[0.095, 0.085], [0.08, 0.072], [0.068, 0.064]], (i) => chainWeights(kit, ['Spine2', 'Neck', 'Head'], [neck.y - 0.02, neck.y + 0.06, headJ.y + 0.015][i]), { color: W, ao: 0.2, seg: 18, up: V(0, 0, 1) }));

  // ---- limbs ----
  mirror((s) => {
    const A = s > 0 ? 'Left' : 'Right';
    const sh = J(A + 'Arm'), el = J(A + 'ForeArm'), wr = J(A + 'Hand');
    const lenU = sh.distanceTo(el), lenF = el.distanceTo(wr), total = lenU + lenF;
    const prof = [[0.0, 0.088, 0.088], [0.14, 0.084, 0.086], [0.3, 0.084, 0.09], [0.42, 0.072, 0.076], [0.5, 0.062, 0.064], [0.56, 0.066, 0.068], [0.68, 0.068, 0.066], [0.82, 0.056, 0.054], [0.94, 0.046, 0.044], [1.0, 0.044, 0.042]];
    const at = (t) => { const dd = t * total; return dd <= lenU ? sh.clone().lerp(el, dd / lenU) : el.clone().lerp(wr, (dd - lenU) / lenF); };
    const armBind = (i, u, L) => { const w = THREE.MathUtils.smoothstep(prof[i][0] * total, lenU - 0.06, lenU + 0.06); return w <= 0.001 ? [[A + 'Arm', 1]] : w >= 0.999 ? [[A + 'ForeArm', 1]] : [[A + 'Arm', 1 - w], [A + 'ForeArm', w]]; };
    AG(tube(S, prof.map((p) => at(p[0])), prof.map((p) => [p[1], p[2]]), armBind, { color: W, ao: 0.25, seg: 18, up: V(0, 0, 1) }));
    AG(add(S, ell(sh.clone().add(V(s * -0.01, 0.015, -0.005)), [0.095, 0.085, 0.09], null, 16), A + 'Arm', W, 0.3));        // deltoid
    add(S, ell(at(0.3).add(V(0, 0.012, 0.012)), [0.07, 0.06, 0.07], null, 14), A + 'Arm', W, 0.3);                        // biceps
    add(S, ell(el.clone().add(V(0, 0.0, -0.016)), [0.05, 0.05, 0.05], null, 12), A + 'ForeArm', W, 0.3);                  // elbow
    add(S, ell(wr.clone().add(V(0, 0, -0.012)), [0.03, 0.04, 0.04], null, 10), A + 'Hand', W, 0.3);                       // wrist
    // Arm ring on the upper arm; leather bracer with gilt edges on the forearm.
    const armAxis = [0, Math.PI / 2, 0];
    add(G, torus(at(0.24), 0.09, 0.013, armAxis), A + 'Arm', GILT, 0.1);
    add(G, torus(at(0.3), 0.093, 0.009, armAxis), A + 'Arm', GILT, 0.1);
    const bp = [0.6, 0.72, 0.84, 0.92];
    tube(LE, bp.map((t) => at(t)), [[0.074, 0.072], [0.07, 0.068], [0.062, 0.06], [0.056, 0.054]], () => [[A + 'ForeArm', 1]], { color: LEATH, ao: 0.25, seg: 16, up: V(0, 0, 1) });
    add(G, torus(at(0.6), 0.074, 0.009, armAxis), A + 'ForeArm', GILT, 0.1);
    add(G, torus(at(0.92), 0.056, 0.009, armAxis), A + 'ForeArm', GILT, 0.1);
    // Claws: a curved horn off each fingertip.
    for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
      const k3 = A + 'Hand' + f + '3', k4 = A + 'Hand' + f + '4';
      if (!kit.has(k3) || !kit.has(k4)) continue;
      const a = J(k3), b = J(k4), d = b.clone().sub(a).normalize(), len = a.distanceTo(b);
      const p0 = b.clone().addScaledVector(d, -len * 0.5), p1 = b.clone().addScaledVector(d, len * 0.6).add(V(0, -0.006, 0)), p2 = b.clone().addScaledVector(d, len * 1.3).add(V(0, -0.02, 0));
      add(HO, sweep([p0, p1, p2], (t) => 0.008 * (1 - t * 0.9) + 0.0008, 7, 10), k3, HORN, 0.2);
    }
    // Legs: thick thighs, fur-wrapped shins and boots.
    const hp = J(A + 'UpLeg'), kn = J(A + 'Leg'), an = J(A + 'Foot');
    const lenT = hp.distanceTo(kn), lenS = kn.distanceTo(an), tot = lenT + lenS;
    const lp = [[0.0, 0.13, 0.135], [0.14, 0.126, 0.132], [0.3, 0.115, 0.12], [0.44, 0.095, 0.1], [0.5, 0.085, 0.09], [0.58, 0.088, 0.095], [0.68, 0.085, 0.09], [0.82, 0.07, 0.072], [0.94, 0.06, 0.06], [1.0, 0.058, 0.058]];
    const lat = (t) => { const dd = t * tot; return dd <= lenT ? hp.clone().lerp(kn, dd / lenT) : kn.clone().lerp(an, (dd - lenT) / lenS); };
    AG(tube(S, lp.map((p) => lat(p[0])), lp.map((p) => [p[1], p[2]]), (i) => {
      const w = THREE.MathUtils.smoothstep(lp[i][0] * tot, lenT - 0.07, lenT + 0.07);
      return w <= 0.001 ? [[A + 'UpLeg', 1]] : w >= 0.999 ? [[A + 'Leg', 1]] : [[A + 'UpLeg', 1 - w], [A + 'Leg', w]];
    }, { color: W, ao: 0.25, seg: 20, up: V(0, 0, 1) }));
    add(S, ell(hp.clone().add(V(s * -0.02, -0.01, 0.0)), [0.125, 0.13, 0.13], null, 18), A + 'UpLeg', W, 0.3);
    add(S, ell(kn.clone().add(V(0, 0.015, 0.03)), [0.07, 0.075, 0.06], null, 14), A + 'Leg', W, 0.3);                     // kneecap
    add(S, ell(lat(0.66).add(V(0, 0, -0.03)), [0.07, 0.12, 0.06], null, 14), A + 'Leg', W, 0.3);                           // calf
    // Fur shin wraps and boots (hide the stock feet).
    tube(FU, [lat(0.74), lat(0.86), lat(0.96), V(an.x, an.y - 0.01, an.z)], [[0.1, 0.1], [0.094, 0.094], [0.086, 0.086], [0.082, 0.085]], () => [[A + 'Leg', 1]], { color: FUR, ao: 0.3, seg: 16, up: V(0, 0, 1), ringColor: (i) => (i % 2 ? FUR : 0x4a3a2e) });
    add(LE, torus(lat(0.75), 0.1, 0.012, [Math.PI / 2, 0, 0], 20), A + 'Leg', LEATH2, 0.2);
    add(LE, torus(lat(0.9), 0.09, 0.012, [Math.PI / 2, 0, 0], 20), A + 'Leg', LEATH2, 0.2);
    add(FU, ell(V(an.x, 0.075, an.z + 0.09), [0.082, 0.072, 0.19], [0.12, 0, 0], 16), A + 'Foot', FUR, 0.3);
    add(LE, ell(V(an.x, 0.03, an.z + 0.09), [0.085, 0.03, 0.195], [0.1, 0, 0], 14), A + 'Foot', LEATH2, 0.2);              // sole
  });

  // ---- kilt: pleated leather straps with fur at waist and hem, a belt with a gilt buckle ----
  {
    const ks = [[1.1, 0.2, 0.15], [0.98, 0.225, 0.17], [0.86, 0.245, 0.185], [0.74, 0.26, 0.2], [0.64, 0.27, 0.21]];
    const g = tube(LE, ks.map((r) => V(0, r[0], 0.01)), ks.map((r) => [r[1], r[2]]), () => [['Hips', 1]], { color: LEATH, ao: 0.3, seg: 36, up: V(0, 0, 1), caps: false });
    paint(g, (x, y, z) => { const a = Math.atan2(x, z - 0.01); const k = Math.floor(((a / Math.PI) * 0.5 + 0.5) * 18) % 2; return k ? LEATH : LEATH2; }, 0.3);
    tube(FU, [V(0, 1.075, 0.01), V(0, 1.11, 0.01), V(0, 1.14, 0.01)], [[0.21, 0.16], [0.235, 0.18], [0.215, 0.165]], () => [['Hips', 1]], { color: FUR, ao: 0.3, seg: 28, up: V(0, 0, 1) });
    tube(FU, [V(0, 0.61, 0.01), V(0, 0.645, 0.01), V(0, 0.675, 0.01)], [[0.265, 0.205], [0.285, 0.225], [0.275, 0.215]], () => [['Hips', 1]], { color: FUR, ao: 0.3, seg: 32, up: V(0, 0, 1), ringColor: (i) => (i === 1 ? 0x6a5a4a : FUR) });
    tube(LE, [V(0, 1.03, 0.01), V(0, 1.07, 0.01)], [[0.205, 0.155], [0.205, 0.155]], () => [['Hips', 1]], { color: LEATH2, ao: 0.2, seg: 28, up: V(0, 0, 1) });
    add(G, bevBox(V(0, 1.05, 0.165), [0.045, 0.028, 0.012], 0.006), 'Hips', GILT, 0.1);
    add(G, torus(V(0, 1.05, 0.178), 0.03, 0.006, null, 16), 'Hips', GILT, 0.1);
  }
  // Torc round the neck.
  add(G, torus(V(0, 1.555, -0.005), 0.11, 0.013, [Math.PI / 2, 0, 0], 28), 'Spine2', GILT, 0.1);
  mirror((s) => add(G, ell(V(s * 0.055, 1.555, 0.095), [0.018, 0.018, 0.018], null, 10), 'Spine2', GILT, 0.1));

  // ---- head: horns, pointed ears, hair cap, braids, glowing eye lenses ----
  const HEAD = 'Head';
  mirror((s) => {
    // Horns: from the brow, up and back, curling forward to a point.
    add(HO, sweep([V(s * 0.048, 1.785, 0.058), V(s * 0.078, 1.835, 0.04), V(s * 0.1, 1.885, 0.03), V(s * 0.108, 1.925, 0.055), V(s * 0.104, 1.945, 0.085)], (t) => 0.03 * (1 - t) * (1 - t * 0.3) + 0.004, 10, 18), HEAD, HORN, 0.25);
    // Pointed ear tips.
    add(S, limb(V(s * 0.072, 1.735, -0.012), V(s * 0.108, 1.805, -0.04), 0.02, 0.012, 0.004, 0.003, V(0, 0, 1), 0.7), HEAD, W, 0.3);
    // Glowing lens over each eye socket, so the eyes read from far away.
    add(E, ell(V(s * 0.031, 1.727, 0.097), [0.02, 0.0115, 0.008], [0, s * 0.25, 0], 12), HEAD, 0xffffff, 0.0);
    // Side braids from above the ears, down over the shoulders; small gilt beads at the ends.
    const sb = [V(s * 0.085, 1.805, -0.025), V(s * 0.112, 1.72, -0.06), V(s * 0.115, 1.6, -0.035), V(s * 0.105, 1.46, 0.02), V(s * 0.1, 1.36, 0.055)];
    add(H, braid(sb, 0.026, 0.014), HEAD, HAIR, 0.3);
    add(G, torus(sb[4].clone().add(V(0, 0.03, -0.012)), 0.017, 0.006, null, 12), HEAD, GILT, 0.1);
    // Beard side braids, a second pair nearer the chin, and moustache braids hanging past the mouth.
    const bb = [V(s * 0.045, 1.605, 0.072), V(s * 0.058, 1.52, 0.104), V(s * 0.063, 1.44, 0.11), V(s * 0.06, 1.37, 0.1)];
    add(H, braid(bb, 0.021, 0.011, 0.028), HEAD, HAIR, 0.3);
    add(G, torus(bb[3].clone().add(V(0, 0.028, 0.004)), 0.014, 0.005, null, 12), HEAD, GILT, 0.1);
    add(H, braid([V(s * 0.024, 1.6, 0.088), V(s * 0.03, 1.52, 0.118), V(s * 0.032, 1.44, 0.122), V(s * 0.03, 1.33, 0.108)], 0.018, 0.01, 0.028), HEAD, HAIR, 0.3);
    add(H, braid([V(s * 0.008, 1.662, 0.102), V(s * 0.035, 1.655, 0.104), V(s * 0.06, 1.625, 0.095), V(s * 0.075, 1.56, 0.095), V(s * 0.078, 1.49, 0.1)], 0.013, 0.007, 0.024), HEAD, HAIR, 0.3);
    add(H, ell(V(s * 0.03, 1.615, 0.085), [0.03, 0.022, 0.02], [0, s * 0.3, 0], 10), HEAD, HAIR, 0.3);                    // beard bulk under the lip
  });
  // Hair: a dark cap over the back and top of the skull, a thick braid down the back.
  const hc = V(0, 1.752, -0.008), hr = [0.094, 0.122, 0.114];
  add(H, patch(hc, hr, Math.PI * 0.42, Math.PI * 1.58, () => [-0.45, 1.45], 28, 10), HEAD, HAIR, 0.3);
  add(H, patch(hc, hr, -Math.PI * 0.42, Math.PI * 0.42, () => [0.42, 1.5], 20, 8), HEAD, HAIR, 0.3);
  add(H, braid([V(0, 1.84, -0.1), V(0, 1.74, -0.15), V(0, 1.6, -0.17), V(0, 1.44, -0.16), V(0, 1.3, -0.13)], 0.036, 0.018, 0.04), HEAD, HAIR, 0.3);
  add(G, torus(V(0, 1.33, -0.138), 0.022, 0.007, [0.4, 0, 0], 14), HEAD, GILT, 0.1);
  // Beard: the stock beard is kept dark; a thick centre braid hangs from the chin.
  add(H, braid([V(0, 1.6, 0.085), V(0, 1.5, 0.12), V(0, 1.4, 0.13), V(0, 1.3, 0.115), V(0, 1.24, 0.1)], 0.032, 0.014, 0.035), HEAD, HAIR, 0.3);
  add(G, torus(V(0, 1.265, 0.108), 0.018, 0.006, [0.3, 0, 0], 14), HEAD, GILT, 0.1);
  add(G, torus(V(0, 1.47, 0.125), 0.03, 0.006, [0.2, 0, 0], 14), HEAD, GILT, 0.1);

  // ---- aura: every skin piece again, pushed out along its normals in the shader ----
  for (const g of auraGeos) kit.lists[AU].push(g.clone());

  const sm = kit.finish();
  // Eye positions for the laser beams: Head-local offsets, stored on the Head bone (userData survives SkeletonUtils.clone).
  scene.updateMatrixWorld(true);
  const head = kit.byKey.get('Head'), L = kit.L;
  const loc = (x, y, z) => { const p = head.worldToLocal(V(x * L, y, z * L)); return [p.x, p.y, p.z]; };
  head.userData.thermesEyes = { l: loc(0.031, 1.727, 0.104), r: loc(-0.031, 1.727, 0.104) };
  return sm;
}

// Keeps only the triangles of a skinned mesh whose strongest bone matches `re`; vertex colours become white (the material tints).
function keepBones(mesh, re) {
  const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const names = mesh.skeleton.bones.map((b) => boneKey(b.name));
  const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = si.count;
  const keep = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
    keep[i] = re.test(names[best] || '') ? 1 : 0;
  }
  const tri = [];
  for (let t = 0; t < n; t += 3) if (keep[t] + keep[t + 1] + keep[t + 2] >= 2) tri.push(t);
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(g.attributes)) {
    const sz = attr.itemSize, arr = new (attr.array.constructor)(tri.length * 3 * sz);
    let j = 0;
    for (const t of tri) for (let v = 0; v < 3; v++) for (let c = 0; c < sz; c++) arr[j++] = attr.array[(t + v) * sz + c];
    out.setAttribute(name, new THREE.BufferAttribute(arr, sz));
  }
  out.setAttribute('color', new THREE.BufferAttribute(new Float32Array(tri.length * 9).fill(1), 3));
  out.computeBoundingSphere();
  mesh.geometry = out;
}

// ---------------------------------------------------------------- runtime hooks
const _dark = new THREE.Color(THERMES_SKIN_DARK), _light = new THREE.Color(THERMES_SKIN_LIGHT), _tmpV = new THREE.Vector3();

function cache(root) {
  let c = root.userData.thermes;
  if (c) return c;
  c = { skin: [], eye: [], aura: [], head: null, eyes: null, seen: new Set() };
  root.traverse((o) => {
    if (o.isBone && !c.head && boneKey(o.name) === 'Head') c.head = o;
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || c.seen.has(m)) continue;
      c.seen.add(m);
      if (m.name === MAT.skin) c.skin.push(m); else if (m.name === MAT.eye) c.eye.push(m); else if (m.name === MAT.aura) c.aura.push(m);
    }
  });
  if (c.head && c.head.userData.thermesEyes) c.eyes = c.head.userData.thermesEyes;
  if (!c.eyes && c.head) { // fallback: the rig's own eye bones
    const b = {}; root.traverse((o) => { if (o.isBone) { const k = boneKey(o.name); if (k === 'LeftEye' || k === 'RightEye') b[k] = o; } });
    c.eyeBones = b;
  }
  root.userData.thermes = c;
  return c;
}

// Drive the skin pulse (dark -> regular purple, ~1.2 s), the aura breathing and a faint eye flicker. `t` is the view's clock in seconds.
export function tickThermes(root, dt, t) {
  const c = cache(root);
  const k = 0.5 - 0.5 * Math.cos((t / PULSE_PERIOD) * Math.PI * 2);
  for (const m of c.skin) { m.color.lerpColors(_dark, _light, k); m.emissiveIntensity = 0.06 + 0.3 * k; }
  for (const m of c.aura) { m.uniforms.uPulse.value = k; }
  for (const m of c.eye) m.emissiveIntensity = 2.3 + 0.7 * k + 0.25 * Math.sin(t * 23.0);
  return k;
}

// World positions of the left (out[0]) and right (out[1]) eyes; works on the scaled, animated clone.
export function thermesEyes(root, out) {
  const c = cache(root);
  if (!c.head) return out;
  c.head.updateWorldMatrix(true, false);
  if (c.eyes) {
    out[0].set(c.eyes.l[0], c.eyes.l[1], c.eyes.l[2]).applyMatrix4(c.head.matrixWorld);
    out[1].set(c.eyes.r[0], c.eyes.r[1], c.eyes.r[2]).applyMatrix4(c.head.matrixWorld);
  } else if (c.eyeBones && c.eyeBones.LeftEye && c.eyeBones.RightEye) {
    c.eyeBones.LeftEye.updateWorldMatrix(true, false); c.eyeBones.RightEye.updateWorldMatrix(true, false);
    c.eyeBones.LeftEye.getWorldPosition(out[0]); c.eyeBones.RightEye.getWorldPosition(out[1]);
  } else { c.head.getWorldPosition(_tmpV); out[0].copy(_tmpV); out[1].copy(_tmpV); }
  return out;
}
