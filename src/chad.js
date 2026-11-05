// Giga Tyrone (internal id "gigachad", kept so saves and network presence keep working): a lovable parody of the over-muscled, jaw-forward hero, a Black man with dark brown skin. Built on the plain
// mannequin rig: its own body is recoloured to a skin tone and clothed in a smooth skinned
// "muscle suit" (V-taper torso, bulging arms and legs that bend without cracks), plus an
// enormous chiselled head with shades, a high-top fade, a groomed beard and a confident grin. One skinned mesh,
// four material slots (matte, gloss, chrome, glow).
import * as THREE from 'three';
import { makeKit, V, ell, limb, chainWeights, paint, addWear } from './armor.js';
import { boneKey } from './retarget.js';

// The stock shoulders sit well behind the chest line, which is fine on the slim mannequin but on
// this deep barrel chest the arms hang at the back of the body and look tucked behind it. Move the
// shoulder joints forward and a touch out (everything hanging off them follows), and make the
// hands fists that match the arms. Done before the suit is built, so the suit binds to the new joints.
export function setShoulders(scene, fwd, out, hand) {
  scene.updateMatrixWorld(true);
  const arms = [], hands = [];
  scene.traverse((o) => { if (o.isBone) { const k = boneKey(o.name); if (k === 'LeftArm' || k === 'RightArm') arms.push([o, k]); if (k === 'LeftHand' || k === 'RightHand') hands.push(o); } });
  const L = arms.find((a) => a[1] === 'LeftArm')[0].getWorldPosition(new THREE.Vector3()).x >= 0 ? 1 : -1;
  for (const [b, k] of arms) {
    const p = b.getWorldPosition(new THREE.Vector3()), side = k === 'LeftArm' ? 1 : -1;
    p.x += side * L * out; p.z += L * fwd;
    b.position.copy(b.parent.worldToLocal(p));
  }
  for (const h of hands) h.scale.setScalar(hand);
  scene.updateMatrixWorld(true);
}

export function buildChad(scene, skin) {
  const matte = addWear(new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, roughness: 0.52, metalness: 0 }), { amt: 0.1, fine: 220, coarse: 30, rough: 0.2 });
  const gloss = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, roughness: 0.3, metalness: 0.12 });
  const chrome = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, roughness: 0.16, metalness: 1 });
  const glow = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x050508, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.4 });
  setShoulders(scene, 0.05, 0.012, 1.18);
  const kit = makeKit(scene, [matte, gloss, chrome, glow], 'chad_body');
  const { J, add, mirror, tube } = kit;
  const SK = skin.tone, TR = skin.trunks, GOLD = skin.trim;
  const DIM = new THREE.Color(SK).multiplyScalar(0.78).getHex(); // dimples and creases, a shade deeper than the skin
  const sk = (g, bone, ao = 0.25) => add(0, g, bone, SK, ao);

  const hips = J('Hips'), neck = J('Neck'), head = J('Head');
  const torsoBones = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck'];

  // ---- torso: a V-taper from a tiny waist to enormous shoulders ----
  {
    const rows = [ // y, rx, rz, z
      [1.09, 0.168, 0.122, 0.02], [1.14, 0.152, 0.11, 0.022], [1.19, 0.158, 0.112, 0.02], [1.245, 0.19, 0.12, 0.012],
      [1.295, 0.225, 0.13, 0.006], [1.345, 0.252, 0.138, 0.0], [1.395, 0.268, 0.138, -0.004], [1.445, 0.27, 0.13, -0.012], [1.49, 0.215, 0.115, -0.022], [1.53, 0.14, 0.095, -0.028],
    ];
    const pts = rows.map((r) => V(0, r[0], r[3])), rad = rows.map((r) => [r[1], r[2]]);
    tube(0, pts, rad, (i) => chainWeights(kit, torsoBones, pts[i].y), { color: SK, ao: 0.28, seg: 22, up: V(0, 0, 1) });
  }
  // Pecs, abs, lats and traps (rigid on the spine bones; the overlaps read as muscle grooves).
  mirror((s) => {
    sk(ell(V(s * 0.1, 1.385, 0.095), [0.105, 0.072, 0.075], [0.12, -s * 0.12, -s * 0.1], 22), 'Spine2', 0.32);
    sk(ell(V(s * 0.17, 1.33, -0.075), [0.1, 0.12, 0.065], [0, 0, 0], 16), 'Spine2');
    sk(ell(V(s * 0.1, 1.505, -0.03), [0.125, 0.048, 0.075], [0, 0, -s * 0.35], 16), 'Spine2');
    for (const [y, bone, k] of [[1.295, 'Spine1', 1], [1.23, 'Spine1', 0.95], [1.168, 'Spine', 0.9]]) sk(ell(V(s * 0.047 * k, y, 0.113), [0.047 * k, 0.034, 0.028], null, 14), bone, 0.4);
    sk(ell(V(s * 0.168, 1.2, 0.04), [0.04, 0.07, 0.07], [0, 0, 0.2], 12), 'Spine1', 0.3); // obliques
    // Deltoids and traps over the shoulder joint.
    sk(ell(V(s * 0.234, 1.452, 0.0), [0.108, 0.106, 0.1], null, 22), s > 0 ? 'LeftArm' : 'RightArm', 0.3);
  });
  // Neck: thick and short.
  tube(0, [V(0, 1.49, -0.03), V(0, 1.55, -0.026), V(0, 1.615, -0.012)], [[0.098, 0.09], [0.088, 0.082], [0.082, 0.078]], (i) => chainWeights(kit, ['Spine2', 'Neck', 'Head'], [1.49, 1.55, 1.615][i] + (i === 0 ? 0.0 : 0)), { color: SK, ao: 0.2, seg: 14, up: V(0, 0, 1) });

  // ---- arms ----
  mirror((s) => {
    const A = s > 0 ? 'Left' : 'Right';
    const sh = J(A + 'Arm'), el = J(A + 'ForeArm'), wr = J(A + 'Hand');
    const pts = [], rad = [];
    const prof = [ // t along the whole arm, rx (vertical), rz (front-back)
      [0.0, 0.1, 0.1], [0.1, 0.104, 0.102], [0.22, 0.1, 0.102], [0.34, 0.082, 0.082], [0.46, 0.066, 0.068],
      [0.52, 0.07, 0.074], [0.6, 0.074, 0.072], [0.72, 0.06, 0.058], [0.88, 0.046, 0.046], [0.97, 0.04, 0.04],
    ];
    const lenU = sh.distanceTo(el), lenF = el.distanceTo(wr), total = lenU + lenF;
    const start = sh.clone().add(V(s * 0.04, 0, 0)); // start inside the deltoid
    for (const [t, rx, rz] of prof) {
      const d = t * total; let p;
      if (d <= lenU) p = sh.clone().lerp(el, d / lenU); else p = el.clone().lerp(wr, (d - lenU) / lenF);
      pts.push(p); rad.push([rx, rz]);
    }
    const us = (i) => prof[i][0] * total;
    tube(0, pts, rad, (i) => {
      const d = us(i), blend = 0.07;
      const w = THREE.MathUtils.smoothstep(d, lenU - blend, lenU + blend);
      return w <= 0.001 ? [[A + 'Arm', 1]] : w >= 0.999 ? [[A + 'ForeArm', 1]] : [[A + 'Arm', 1 - w], [A + 'ForeArm', w]];
    }, { color: SK, ao: 0.25, seg: 18, up: V(0, 0, 1) });
    // Biceps peak and tricep.
    const mid = sh.clone().lerp(el, 0.52);
    sk(ell(V(mid.x, mid.y + 0.03, mid.z + 0.025), [0.09, 0.062, 0.055], [0, 0, 0], 16), A + 'Arm', 0.3);
    // White sweat band on the wrist.
    const w0 = el.clone().lerp(wr, 0.8), w1 = el.clone().lerp(wr, 0.93);
    add(0, limb(w0, w1, 0.051, 0.051, 0.051, 0.051, V(0, 0, 1), 0.3), A + 'ForeArm', 0xf4f4f4, 0.2);
  });

  // ---- legs ----
  mirror((s) => {
    const A = s > 0 ? 'Left' : 'Right';
    const hp = J(A + 'UpLeg'), kn = J(A + 'Leg'), an = J(A + 'Foot');
    const lenT = hp.distanceTo(kn), lenS = kn.distanceTo(an), total = lenT + lenS;
    const prof = [ // t, rx (side), rz (front-back)
      [0.0, 0.122, 0.128], [0.1, 0.126, 0.13], [0.24, 0.116, 0.122], [0.38, 0.098, 0.106], [0.5, 0.076, 0.08], [0.56, 0.074, 0.08],
      [0.64, 0.082, 0.09], [0.74, 0.066, 0.07], [0.88, 0.048, 0.05], [1.0, 0.042, 0.044],
    ];
    const at = (t) => { const d = t * total; return d <= lenT ? hp.clone().lerp(kn, d / lenT) : kn.clone().lerp(an, (d - lenT) / lenS); };
    const pts = prof.map((p) => at(p[0])), rad = prof.map((p) => [p[1], p[2]]);
    const bindLeg = (i) => {
      const d = prof[i][0] * total, w = THREE.MathUtils.smoothstep(d, lenT - 0.07, lenT + 0.07);
      return w <= 0.001 ? [[A + 'UpLeg', 1]] : w >= 0.999 ? [[A + 'Leg', 1]] : [[A + 'UpLeg', 1 - w], [A + 'Leg', w]];
    };
    tube(0, pts, rad, bindLeg, { color: SK, ao: 0.25, seg: 18, up: V(0, 0, 1) });
    // Quad / calf bulges.
    sk(ell(at(0.22).add(V(0, 0, 0.035)), [0.1, 0.17, 0.08], null, 16), A + 'UpLeg', 0.3);
    sk(ell(at(0.64).add(V(0, 0.01, -0.04)), [0.07, 0.13, 0.07], null, 16), A + 'Leg', 0.3);
    // Sneaker: chunky, white with a contrast toe cap, stripe and dark sole.
    const toe = J(A + 'ToeBase'), te = kit.has(A + 'Toe_End') ? J(A + 'Toe_End') : toe.clone().add(V(0, 0, 0.09));
    const zc = (an.z + te.z) * 0.5 + 0.012;
    const shoe = paint(ell(V(an.x, 0.056, zc), [0.068, 0.056, 0.145], [0.05, 0, 0], 22, [0.8, 0.8]), (x, y, z) => {
      if (z > te.z - 0.04) return skin.shoes2;
      if (Math.abs(Math.abs(x - an.x) - 0.04) < 0.008 && z > an.z - 0.02) return skin.shoes2;
      return skin.shoes;
    }, 0.3);
    add(0, shoe, A + 'Foot', null);
    add(0, ell(V(an.x, 0.02, zc + 0.006), [0.072, 0.02, 0.152], null, 16), A + 'Foot', 0x2a2a2e, 0.2);
    // Ankle sock.
    add(0, ell(V(an.x, an.y + 0.045, an.z), [0.056, 0.075, 0.056], null, 16), A + 'Foot', 0xf6f6f6, 0.2);
  });
  // Trunks: one flared skirt-tube around the pelvis and both thighs (weights split left/right), gold waistband.
  {
    const ys = [1.112, 1.1, 1.08, 1.03, 0.98, 0.92, 0.86, 0.835];
    const rx = [0.176, 0.176, 0.186, 0.2, 0.214, 0.222, 0.224, 0.224], rz = [0.152, 0.152, 0.16, 0.168, 0.174, 0.178, 0.178, 0.178];
    const pts = ys.map((y) => V(0, y, -0.008));
    tube(0, pts, ys.map((_, i) => [rx[i], rz[i]]), (i, u, p) => {
      const side = p.x >= 0 ? 'Left' : 'Right', w = THREE.MathUtils.smoothstep(pts[i].y, 1.08, 0.9) * THREE.MathUtils.smoothstep(Math.abs(p.x), 0.0, 0.07);
      return w < 0.001 ? [['Hips', 1]] : [['Hips', 1 - w], [side + 'UpLeg', w]];
    }, { color: TR, ao: 0.2, seg: 28, ringColor: (i) => (i <= 1 ? GOLD : i === 7 ? GOLD : TR) });
    add(2, ell(V(0, 1.075, 0.142), [0.062, 0.05, 0.016], null, 22, [0.6, 0.6]), 'Hips', 0xf0c040, 0.1);
    add(0, ell(V(0, 1.075, 0.157), [0.036, 0.028, 0.006], null, 14, [0.6, 0.6]), 'Hips', 0xc23030, 0.1);
    if (skin.glowTrim) add(3, limb(V(-0.2, 1.0, 0.12), V(0.2, 1.0, 0.12), 0.004, 0.004, 0.004, 0.004), 'Hips', 0x2de6ff, 0);
  }
  // Gold chain and medallion.
  {
    const curve = new THREE.CatmullRomCurve3([V(-0.07, 1.52, 0.055), V(-0.115, 1.46, 0.118), V(-0.07, 1.415, 0.172), V(0, 1.4, 0.18), V(0.07, 1.415, 0.172), V(0.115, 1.46, 0.118), V(0.07, 1.52, 0.055)]);
    add(2, new THREE.TubeGeometry(curve, 40, 0.0055, 6, false), 'Spine2', 0xf0c040, 0.1);
    add(2, ell(V(0, 1.378, 0.186), [0.02, 0.022, 0.007], null, 14), 'Spine2', 0xf0c040, 0.1);
  }
  if (skin.flowers) { // Beach Day: hibiscus on the trunks
    for (const [x, y, z, r] of [[0.15, 0.93, 0.13, 0.026], [-0.12, 0.88, 0.14, 0.02], [0.17, 0.82, 0.115, 0.016]]) add(0, ell(V(x, y, z), [r, r, 0.006], null, 10), 'Hips', 0xfff0f6, 0.1);
  }

  // ---- head: big square jaw, grin, shades, quiff ----
  const hc = V(0, 1.695, 0.0), HEAD = 'Head';
  const ha = (slot, g, c, ao) => add(slot, g, HEAD, c, ao);
  ha(0, ell(V(0, 1.712, -0.004), [0.095, 0.1, 0.102], null, 30, [0.88, 0.88]), SK, 0.25);            // cranium
  ha(0, ell(V(0, 1.648, 0.022), [0.106, 0.066, 0.115], null, 30, [0.62, 0.66]), SK, 0.3);            // jaw block
  ha(0, ell(V(0, 1.606, 0.1), [0.056, 0.036, 0.046], null, 20, [0.62, 0.62]), SK, 0.3);              // chin
  ha(0, ell(V(0, 1.6, 0.138), [0.012, 0.012, 0.008], null, 8), DIM, 0.0);                         // chin dimple
  mirror((s) => {
    ha(0, ell(V(s * 0.08, 1.683, 0.088), [0.03, 0.022, 0.03], [0.2, 0, 0], 14), SK, 0.3);            // cheekbones
    ha(0, ell(V(s * 0.098, 1.7, 0.0), [0.014, 0.032, 0.024], null, 10), SK, 0.3);                    // ears
    // Mirror shades: angled lens and temple arm.
    ha(2, ell(V(s * 0.048, 1.716, 0.1), [0.043, 0.027, 0.014], [0.0, s * 0.3, -s * 0.16], 20, [0.55, 0.55]), skin.lens, 0.1);
    ha(1, limb(V(s * 0.086, 1.724, 0.09), V(s * 0.099, 1.722, 0.0), 0.007, 0.006, 0.007, 0.006, V(0, 1, 0), 0.5), skin.shades, 0.1);
    ha(0, ell(V(s * 0.05, 1.745, 0.104), [0.046, 0.011, 0.014], [0, s * 0.2, -s * 0.2], 12), SK, 0.4);   // heavy brow
  });
  ha(1, ell(V(0, 1.718, 0.11), [0.016, 0.01, 0.01], null, 8), skin.shades, 0.1);                    // bridge
  ha(0, ell(V(0, 1.683, 0.125), [0.014, 0.032, 0.026], [0.28, 0, 0], 12), SK, 0.35);                 // nose
  // Grin: dark mouth line, bright teeth, smirk dimples.
  ha(1, ell(V(0, 1.636, 0.125), [0.052, 0.014, 0.012], [0, 0, 0.06], 14, [0.6, 0.6]), 0x2a1210, 0.0);
  ha(0, ell(V(0.002, 1.637, 0.131), [0.043, 0.0095, 0.007], [0, 0, 0.06], 14, [0.6, 0.6]), 0xfdfdfd, 0.0);
  ha(0, ell(V(0.058, 1.645, 0.118), [0.01, 0.012, 0.008], null, 8), DIM, 0.0);
  // Hair: a sharp high-top fade with a crisp line-up, curly texture on top, and a full groomed beard
  // that follows the jaw line (the big chiselled jaw still reads through it) with the grin kept clear.
  const HR = skin.hair, BD = skin.beard != null ? skin.beard : skin.hair;
  const mix = (k) => new THREE.Color(SK).lerp(new THREE.Color(HR), k).getHex(); // fade: skin blending into hair
  ha(0, ell(V(0, 1.774, -0.004), [0.099, 0.064, 0.108], null, 28, [0.55, 0.62]), HR, 0.22);             // high-top
  ha(0, ell(V(0, 1.738, -0.072), [0.093, 0.058, 0.058], null, 20), mix(0.78), 0.3);                    // back, fading
  ha(0, ell(V(0, 1.696, -0.088), [0.068, 0.028, 0.036], null, 14), mix(0.42), 0.3);                    // nape fade
  for (let i = 0; i < 30; i++) { // coily texture on top
    const a = i * 2.399963, r = 0.012 + 0.074 * Math.sqrt((i + 0.5) / 30), x = Math.cos(a) * r, z = Math.sin(a) * r * 1.05 - 0.004;
    ha(0, ell(V(x, 1.774 + 0.064 * Math.pow(Math.max(0, 1 - Math.pow(r / 0.102, 2.2)), 0.55) - 0.003, z), [0.0165, 0.013, 0.0165], null, 8), HR, 0.18);
  }
  mirror((s) => ha(0, ell(V(s * 0.088, 1.742, -0.006), [0.013, 0.05, 0.072], null, 12), mix(0.62), 0.3)); // faded temples
  // Beard: one smooth band following the jaw from sideburn to chin and up the other side.
  {
    // Points follow the jaw block's superellipse so the beard hugs the face instead of hanging off it.
    const zs = [0.0, 0.03, 0.055, 0.08, 0.103, 0.12, 0.133], ys = [1.675, 1.65, 1.625, 1.606, 1.592, 1.585, 1.583];
    const half = zs.map((z, i) => [0.103 * Math.pow(Math.max(0.0004, 1 - Math.pow(Math.abs(z - 0.022) / 0.115, 1.515)), 0.66), ys[i], z]);
    const pts = [...half.map(([x, y, z]) => V(-x, y, z)), V(0, 1.581, 0.143), ...half.slice().reverse().map(([x, y, z]) => V(x, y, z))];
    const rad = [0.012, 0.017, 0.02, 0.023, 0.026, 0.027, 0.028, 0.029, 0.028, 0.027, 0.026, 0.023, 0.02, 0.017, 0.012];
    tube(0, pts, rad, () => [[HEAD, 1]], { color: BD, ao: 0.3, seg: 10 });
  }
  mirror((s) => ha(0, ell(V(s * 0.019, 1.657, 0.132), [0.026, 0.0085, 0.011], [0, 0, s * -0.12], 10), BD, 0.3)); // moustache
  ha(0, ell(V(0, 1.602, 0.13), [0.04, 0.02, 0.028], null, 14), BD, 0.3);                               // chin
  ha(0, ell(V(0, 1.619, 0.14), [0.016, 0.008, 0.008], null, 8), BD, 0.3);                                // soul patch

  const sm = kit.finish();

  // ---- the mannequin's own body takes the skin tone (hands show; the rest is under the suit) ----
  const col = new THREE.Color(SK);
  scene.traverse((o) => {
    if (!o.isSkinnedMesh || o === sm) return;
    o.material = o.material.clone();
    o.material.color.copy(col); o.material.metalness = 0; o.material.roughness = 0.55;
  });
  return sm;
}
