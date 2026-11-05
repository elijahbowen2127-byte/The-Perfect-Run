// The veteran base model only has a head, hands and ankles of its own (the rest is tailored clothes meshes),
// so every knight design dresses a complete body: padded doublet, sleeves, hose and neck, all skinned to the rig.
import * as THREE from 'three';
import { V } from './armor.js';
import { surf, secPt, tab, sstep, mix, clamp, TAU, vnoise, makeWeights } from './knight_kit.js';

// Hide the base model's own clothes (they would poke through the armour).
export function hideBaseClothes(scene, { footwear = true, top = true, bottom = true } = {}) {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if ((top && /Outfit_Top/.test(o.name)) || (bottom && /Outfit_Bottom/.test(o.name)) || (footwear && /Outfit_Footwear/.test(o.name))) o.visible = false;
  });
}

// Torso body table: [y, rx, zf, zb] of the padded doublet over the chest and belly.
export const TORSO = [
  [0.90, 0.176, 0.128, 0.118],
  [1.00, 0.176, 0.128, 0.118],
  [1.08, 0.168, 0.124, 0.112],
  [1.16, 0.160, 0.120, 0.106],
  [1.26, 0.172, 0.128, 0.108],
  [1.36, 0.186, 0.142, 0.110],
  [1.44, 0.192, 0.126, 0.104],
  [1.49, 0.158, 0.096, 0.090],
  [1.535, 0.092, 0.072, 0.070],
  [1.575, 0.060, 0.060, 0.058],
];
export const TORSO_CZ = 0.004;

// Padded arming doublet: torso with quilting channels. o: { color, y0, y1, quilt (amplitude), thick (extra radius) }
export function doublet(kit, slot, o = {}) {
  const W = makeWeights(kit);
  const y0 = o.y0 ?? 0.94, y1 = o.y1 ?? 1.585, thk = o.thick ?? 0.0, amp = o.quilt ?? 0.004;
  const cols = o.cols ?? 18, rows = o.rowH ?? 0.06;
  const col = o.color ?? 0xcfc4a8;
  return surf(kit, slot, cols * 5, Math.round((y1 - y0) / rows) * 7, (u, v, out) => {
    const y = mix(y0, y1, v), [rx, zf, zb] = tab(TORSO, y), a = u * TAU, th = typeof thk === 'function' ? thk(y, a) : thk;
    secPt(out, 0, y, TORSO_CZ, rx + th, zf + th, zb + th, 2.6, a);
    if (amp) {
      const pu = Math.abs(Math.sin(u * cols * Math.PI)), pv = Math.abs(Math.sin(((y - y0) / rows) * Math.PI));
      const puff = amp * (Math.pow(pu, 0.55) * Math.pow(pv, 0.55) - 0.6);
      out.x += puff * Math.sin(a); out.z += puff * Math.cos(a);
    }
  }, { closed: true, color: col, ao: 0.25, bind: (p) => W.torso(p.y), shade: (p, n, u, v) => 1 - 0.1 * vnoise(u * 40, v * 50) });
}

// Neck cloth/collar from the doublet up to just under the chin.
export function neckBand(kit, slot, color) {
  const W = makeWeights(kit), J = kit.J, nk = J('Neck');
  return surf(kit, slot, 20, 4, (u, v, out) => {
    const y = mix(1.5, 1.56, v);
    secPt(out, 0, y, mix(0.0, 0.02, v), 0.062 - v * 0.004, 0.06, 0.062, 2.3, u * TAU);
  }, { closed: true, color, bind: (p) => W.torso(p.y) });
}

// Arm tube along the T-pose arm. o: { color, x0, x1, quilt, thick, radii: table [x, rr] }
export function armTube(kit, slot, A, o = {}) {
  const W = makeWeights(kit), s = A === 'Left' ? 1 : -1;
  const sh = kit.J(A + 'Arm'), el = kit.J(A + 'ForeArm'), wr = kit.J(A + 'Hand');
  const x0 = o.x0 ?? 0.1, x1 = o.x1 ?? 0.715, amp = o.quilt ?? 0, thk = o.thick ?? 0;
  const R = o.radii ?? [[0.1, 0.082], [0.166, 0.078], [0.3, 0.07], [0.451, 0.059], [0.52, 0.058], [0.62, 0.05], [0.715, 0.04]];
  const nx = Math.round((x1 - x0) / 0.012);
  const rows = o.rowH ?? 0.06;
  return surf(kit, slot, 24, nx, (u, v, out) => {
    const d = mix(x0, x1, v), [r] = tab(R, d), a = u * TAU;
    const ax = Math.abs(sh.x), ex = Math.abs(el.x), wx = Math.abs(wr.x);
    const c = d <= ex ? sh.clone().lerp(el, (d - ax) / (ex - ax)) : el.clone().lerp(wr, (d - ex) / (wx - ex));
    let rr = r + (typeof thk === 'function' ? thk(d, a) : thk);
    if (amp) { const pu = Math.abs(Math.sin(u * 8 * Math.PI)), pv = Math.abs(Math.sin(((d - x0) / rows) * Math.PI)); rr += amp * (Math.pow(pu, 0.55) * Math.pow(pv, 0.55) - 0.6); }
    out.set(s * d, c.y + Math.cos(a) * rr * 1.0, c.z + Math.sin(a) * rr * 1.02);
  }, { closed: true, color: o.color, ao: 0.25, bind: (p) => W.arm(A, p), shade: o.shade });
}

// Leg tube from the hip to above the ankle along the leg. R: [y, radius] table.
export const LEG_R = [[0.12, 0.043], [0.2, 0.048], [0.3, 0.058], [0.4, 0.068], [0.5, 0.068], [0.567, 0.071], [0.66, 0.078], [0.78, 0.088], [0.9, 0.098], [1.0, 0.107], [1.1, 0.112]];
export function legCenter(kit, A, y, out = new THREE.Vector3()) {
  const J = kit.J, hp = J(A + 'UpLeg'), kn = J(A + 'Leg'), an = J(A + 'Foot');
  if (y >= kn.y) { const t = (hp.y - y) / (hp.y - kn.y); return out.copy(hp).lerp(kn, t); }
  const t = (kn.y - y) / (kn.y - an.y); return out.copy(kn).lerp(an, t);
}
export function legTube(kit, slot, A, o = {}) {
  const W = makeWeights(kit), y0 = o.y0 ?? 0.14, y1 = o.y1 ?? 1.08, thk = o.thick ?? 0, R = o.radii ?? LEG_R;
  const c = new THREE.Vector3();
  return surf(kit, slot, 24, Math.round((y1 - y0) / 0.012), (u, v, out) => {
    const y = mix(y0, y1, v), [r] = tab(R, y), a = u * TAU;
    legCenter(kit, A, y, c);
    let rr = r + (typeof thk === 'function' ? thk(y, a) : thk);
    if (o.wrinkle) rr += o.wrinkle(y, a, u);
    out.set(c.x + Math.sin(a) * rr, y, c.z + Math.cos(a) * rr * 1.04);
  }, { closed: true, color: o.color, ao: 0.25, bind: (p) => W.leg(A, p), shade: o.shade });
}
