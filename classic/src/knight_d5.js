// Design 5: devilish battle-torn knight: slim, lean, polished mirror-steel plate (dented, scratched, one plate cracked away),
// a snug skull-fitting helm with an angular faceplate, slanted glowing eye slits and tooth-like vents, spiked angular pauldrons,
// mail glimpsed at the joints and torn dark cloth hanging from the waist. All grey/silver, no horns, no tall crest.
import * as THREE from 'three';
import { makeKit, V } from './armor.js';
import { real } from './realmat.js';
import { finishKit, surf, tubeAlong, studs, makeWeights, mailMaterial, dsided, tab, sstep, mix, sp, TAU, vnoise } from './knight_kit.js';
import { hideBaseClothes, doublet, neckBand, armTube, legTube, legCenter, LEG_R } from './knight_body.js';
import { band, bead, beadU, riveted, strap, buckle, fingerPlates, swordAndScabbard, surfObj } from './knight_parts.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const col = (c, k) => new THREE.Color(c).multiplyScalar(k);
const SIDES = ['Left', 'Right'];
const sgn = (A) => (A === 'Left' ? 1 : -1);

export function buildKnightD5(scene, skin) {
  const HELM = skin && skin.helm != null ? +skin.helm : Math.round((((skin && +skin.design) || 5) - 5) * 10) || 0;   // 0 = original skull helm, 1-5 = helm types, -1 = none
  const C = { steel: 0x9aa1aa, steel2: 0x737a84, trim: 0xa9b0b9, leather: 0x34302c, ...skin };
  hideBaseClothes(scene);
  // polished steel with a baked studio-sky reflection added to the emissive term, so it gleams even under a dim environment
  const shine = (m, k) => {
    const c = m.clone(), base = m.onBeforeCompile, key = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
    c.onBeforeCompile = (sh, r) => {
      base(sh, r);
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec3 sv = normalize(vViewPosition); vec3 rw = inverseTransformDirection(reflect(-sv, normal), viewMatrix);
          float fr = 0.45 + 0.55 * pow(1.0 - clamp(dot(normal, sv), 0.0, 1.0), 2.0);
          float ang = atan(rw.z, rw.x);
          vec3 sky = mix(vec3(0.12, 0.13, 0.16), vec3(0.42, 0.45, 0.5), smoothstep(-0.35, 0.12, rw.y)) + vec3(0.8, 0.85, 0.95) * smoothstep(0.25, 0.9, rw.y);
          sky += vec3(1.5, 1.55, 1.7) * pow(abs(sin(ang * 2.0 + 0.5)), 24.0) * smoothstep(-0.1, 0.25, rw.y) * (1.0 - smoothstep(0.55, 0.9, rw.y));
          totalEmissiveRadiance += sky * diffuseColor.rgb * ${k.toFixed(2)} * fr; }`);
    };
    c.customProgramCacheKey = () => key + 'shine' + k;
    return c;
  };
  const steel = shine(real('steel', { rough: 0.16, metal: 0.9, bump: 0.7 }), 1.1), dark = shine(real('steel', { rough: 0.3, metal: 0.9, bump: 0.8, scale: 1.3 }), 0.8);
  const glow = new THREE.MeshStandardMaterial({ color: 0x0a0c10, emissive: 0xcfdcff, emissiveIntensity: 1.6, roughness: 0.4, vertexColors: true });
  const leather = dsided(real('leather', { scale: 1.8 })), cloth = dsided(real('cloth', { scale: 3, bump: 0.2 })), wool = dsided(real('wool', { scale: 3, bump: 0.2 }));
  const kit = makeKit(scene, [steel, dark, leather, cloth, wool, dsided(steel, 'plate2'), mailMaterial(), glow], 'knight_armor');
  const S = { steel: 0, brass: 1, leather: 2, cloth: 3, wool: 4, steel2s: 5, mail: 6, glow: 7 };   // 'brass' slot = blackened gunmetal fittings
  const J = kit.J, W = makeWeights(kit);
  const steelC = col(C.steel, 1.1).getHex(), steel2C = col(C.steel2, 0.95).getHex(), trimC = col(C.trim, 0.8).getHex();
  const leatherC = col(C.leather, 0.7).getHex(), clothC = 0x25272b, cloth2C = 0x1b1c20, blackC = 0x08080a;
  const patina = (k = 1) => (p, n, u, v) => 1 - 0.12 * k * vnoise(p.x * 18 + p.y * 7, p.z * 18 + p.y * 9) - 0.12 * k * vnoise(p.x * 70, p.y * 14 + p.z * 70) - 0.1 * k * Math.pow(vnoise(p.x * 9, p.y * 30 + p.z * 9), 2);
  const mailC = col(0x666c76, 1.15).getHex();
  const edgeAO = (k = 0.2, pw = 3) => (p, n, u, v) => 1 - k * Math.pow(1 - v, pw);
  const CUCZ = 0.004;

  // ------------------------------------------------------------ body under-layers: dark padded cloth
  doublet(kit, S.cloth, { color: cloth2C, quilt: 0.002 });
  neckBand(kit, S.cloth, cloth2C);
  for (const A of SIDES) {
    armTube(kit, S.mail, A, { color: mailC, thick: 0.004 });
    legTube(kit, S.mail, A, { color: mailC, y1: 1.06, wrinkle: (y, a) => 0.0014 * Math.sin(y * 70 + a * 3) });
  }

  // ------------------------------------------------------------ cuirass: slim, segmented, ridged
  const CU = [[1.04, 0.17, 0.132, 0.121], [1.12, 0.168, 0.134, 0.119], [1.2, 0.17, 0.142, 0.121], [1.28, 0.18, 0.152, 0.124], [1.36, 0.196, 0.158, 0.128], [1.42, 0.2, 0.148, 0.128], [1.47, 0.186, 0.134, 0.12], [1.51, 0.15, 0.104, 0.1], [1.54, 0.1, 0.07, 0.07]];
  const topAt = (th) => tab([[0, 1.525], [0.45, 1.53], [0.8, 1.52], [1.15, 1.5], [1.5, 1.48], [1.9, 1.485], [2.3, 1.505], [2.7, 1.525], [3.15, 1.53]], th)[0];
  const DENTS = [[-0.08, 1.33, 0.05, 0.009], [0.075, 1.2, 0.042, 0.008], [0.1, 1.31, 0.03, 0.007], [-0.1, 1.2, 0.03, 0.006], [0.02, 1.4, 0.03, 0.006]];
  const cuirXY = (th, y, out) => {
    const [rx, zf, zb] = tab(CU, y), e = 2 / 2.7, s = Math.sin(th), c = Math.cos(th);
    const keel = (c > 0 ? 0.03 * sstep(y, 1.1, 1.3) * (1 - 0.7 * sstep(y, 1.42, 1.5)) : 0.007) * Math.exp(-Math.pow(rx * sp(s, e) / 0.018, 2));
    out.set(rx * sp(s, e), y, CUCZ + (c >= 0 ? zf * sp(c, e) + keel : zb * sp(c, e) - keel * 0.5));
    if (c > 0) for (const [dx, dy, r, d] of DENTS) out.z -= d * Math.exp(-(Math.pow(out.x - dx, 2) + Math.pow(y - dy, 2)) / (r * r));
    return out;
  };
  const cuirPt = (u, v, out) => { const th = u * TAU, thf = th > Math.PI ? TAU - th : th; return cuirXY(th, mix(1.06, topAt(thf), v), out); };
  // a cracked-away plate low on the right of the chest: ragged hole through to the dark padding
  const cuirSkip = (u, v) => { const th = u * TAU, y = mix(1.06, 1.5, v), dth = th - (TAU - 0.62); return (Math.pow(dth / 0.2, 2) + Math.pow((y - 1.17) / 0.07, 2)) < 0.75 + 0.7 * vnoise(u * 240, v * 120) - 0.3; };
  surf(kit, S.steel, 128, 48, cuirPt, { closed: true, color: steelC, ao: 0.28, bind: 'Spine1', shade: patina(), skip: cuirSkip });
  {
    const B = surfObj(cuirPt, 96, 40, true, () => V(0, 1.3, CUCZ));
    bead(kit, S.brass, B, 1, 0.0045, () => 'Spine1', steel2C, { N: 96 });
    bead(kit, S.brass, B, 0, 0.0045, () => 'Spine1', steel2C, { N: 96 });
    // horizontal plate-segment rolls across the chest and belly
    for (const y of [1.14, 1.22, 1.3]) {
      const pts = []; for (let i = 0; i <= 56; i++) { const th = mix(-2.9, 2.9, i / 56); const e = 2 / 2.7, s = Math.sin(th), c = Math.cos(th), [rx, zf, zb] = tab(CU, y);
        const keel = (c > 0 ? 0.03 * sstep(y, 1.1, 1.3) : 0.007) * Math.exp(-Math.pow(rx * sp(s, e) / 0.018, 2));
        pts.push(V(rx * 1.004 * sp(s, e), y, CUCZ + (c >= 0 ? zf * 1.004 * sp(c, e) + keel : zb * 1.004 * sp(c, e) - keel * 0.5))); }
      tubeAlong(kit, S.brass, pts, 0.0036, () => 'Spine1', { seg: 6, color: steel2C, ao: 0.12 });
    }
    // battle scars: slashes and scratches across the breastplate
    for (const [g, col2] of [[[[0.5, 1.4], [0.3, 1.34], [0.1, 1.26]], 0x0d0f12], [[[-0.55, 1.36], [-0.4, 1.3], [-0.3, 1.2]], 0x0d0f12], [[[-0.22, 1.42], [-0.05, 1.36]], 0xe8ecf2], [[[0.62, 1.22], [0.45, 1.16], [0.38, 1.08]], 0xe8ecf2], [[[0.15, 1.2], [0.3, 1.15], [0.42, 1.14]], 0x0d0f12]]) {
      const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14, k = Math.min(g.length - 2, Math.floor(t * (g.length - 1))), f = t * (g.length - 1) - k, q = V(); cuirXY(mix(g[k][0], g[k + 1][0], f), mix(g[k][1], g[k + 1][1], f) + 0.004 * Math.sin(t * 9), q); pts.push(q.addScaledVector(V(q.x / 0.17, 0, 1).normalize(), 0.0012)); }
      tubeAlong(kit, S.leather, pts, [0.0012, 0.0016], () => 'Spine1', { seg: 5, color: col2, ao: 0 });
    }
    // medial ridge line (front), and rivet rows along it
    const rid = []; for (let i = 0; i <= 24; i++) { const y = mix(1.1, 1.44, i / 24), [, zf] = tab(CU, y); rid.push(V(0, y, CUCZ + zf + 0.03 * sstep(y, 1.1, 1.3) * (1 - 0.7 * sstep(y, 1.42, 1.5)) + 0.002)); }
    tubeAlong(kit, S.brass, rid, 0.0038, () => 'Spine1', { seg: 6, color: steel2C, ao: 0.12 });
    const rv = []; for (const s of [1, -1]) for (let k = 0; k < 6; k++) { const y = 1.12 + k * 0.06 + 0.03, [rx, zf] = tab(CU, y), th = 0.55, e = 2 / 2.7; rv.push({ p: V(s * (rx + 0.002) * sp(Math.sin(th), e), y, CUCZ + zf * sp(Math.cos(th), e)), n: V(s * Math.sin(th), 0, Math.cos(th)).normalize() }); }
    studs(kit, S.brass, 'Spine1', rv, 0.0034, trimC);
    // side buckle straps
    for (const s of [1, -1]) for (const y of [1.17, 1.25]) {
      const [rx, zf, zb] = tab(CU, y), a = [];
      for (let k = 0; k <= 8; k++) { const th = mix(1.05, 2.1, k / 8), e = 2 / 2.7, ss = Math.sin(th), c = Math.cos(th); a.push(V(s * (rx + 0.003) * sp(ss, e), y, CUCZ + (c >= 0 ? (zf + 0.003) * sp(c, e) : (zb + 0.003) * sp(c, e)))); }
      strap(kit, S.leather, a, 0.018, 0.004, () => 'Spine1', leatherC, { vertical: true });
      buckle(kit, S.brass, 'Spine1', a[4].clone(), V(s, 0, 0).normalize(), V(0, 1, 0), 0.008, 0.01, trimC);
    }
  }

  // ------------------------------------------------------------ gorget: stacked rings of plate round the neck
  for (const [y0, y1, r0, r1, c, xs] of [[1.5, 1.54, 0.135, 0.118, 0, 1.12], [1.525, 1.565, 0.11, 0.095, 1, 1.05], [1.55, 1.59, 0.09, 0.078, 0, 1.0]]) {
    surf(kit, S.steel, 48, 4, (u, v, out) => { const a = u * TAU, y = mix(y0, y1, v), r = mix(r0, r1, v); out.set(Math.sin(a) * r * xs, y, 0.004 + Math.cos(a) * r * (Math.cos(a) > 0 ? 0.92 : 0.98)); },
      { closed: true, color: c ? steelC : steel2C, ao: 0.3, bind: (p) => W.torso(Math.min(p.y, 1.56)), shade: (p, n, u, v) => edgeAO(0.25, 3)(p, n, u, v) * patina()(p, n, u, v) });
  }

  if (HELM >= 0 && HELM <= 0) {
  // ------------------------------------------------------------ helm: snug skull-fitting armet, angular faceplate
  const HC = (y) => 0.024 - 0.03 * sstep(y, 1.84, 1.96);
  const HR = [[1.55, 0.078, 0.088, 0.094], [1.6, 0.095, 0.132, 0.104], [1.65, 0.101, 0.142, 0.112], [1.7, 0.097, 0.126, 0.118], [1.76, 0.1, 0.13, 0.123], [1.83, 0.098, 0.126, 0.12], [1.89, 0.086, 0.108, 0.104], [1.93, 0.062, 0.078, 0.076], [1.96, 0.03, 0.04, 0.04], [1.972, 0.003, 0.005, 0.006]];
  const helmBot = (thf) => tab([[0, 1.6], [0.5, 1.605], [1.0, 1.585], [2.0, 1.56], [3.15, 1.53]], thf)[0];
  const headPt = (th, y, off = 0, out = V()) => {
    const [rx, zf, zb] = tab(HR, y), s = Math.sin(th), c = Math.cos(th);
    const e = 2 / (c >= 0 ? mix(2.3, 1.5, sstep(y, 1.78, 1.64)) : 2.3);
    const beak = c > 0 ? 0.04 * Math.exp(-Math.pow(rx * sp(s, e) / 0.034, 2)) * sstep(y, 1.585, 1.62) * (1 - sstep(y, 1.74, 1.79)) : 0;
    out.set(rx * sp(s, e), y, HC(y) + (c >= 0 ? zf * sp(c, e) + beak : zb * sp(c, e)));
    if (off) { out.x += off * s; out.z += off * c; }
    return out;
  };
  const helmPt = (u, v, out) => { const th = u * TAU, thf = th > Math.PI ? TAU - th : th; return headPt(th, mix(helmBot(thf), 1.972, Math.pow(v, 0.92)), 0, out); };
  surf(kit, S.steel, 96, 44, helmPt, { closed: true, color: steelC, ao: 0.3, bind: 'Head', shade: patina(1.0), skip: (u, v) => v < 0.07 && vnoise(u * 90, 2) > 0.78 });
  {
    const arc = (y, a, b, off, n = 40) => { const o = []; for (let i = 0; i <= n; i++) o.push(headPt(mix(a, b, i / n), y, off)); return o; };
    // angry brow ridge: a sharp V from the temples down to the nose
    for (const sx of [1, -1]) {
      const br = []; for (let i = 0; i <= 14; i++) { const th = sx * mix(1.5, 0.04, i / 14); br.push(headPt(th, 1.768 - 0.03 * Math.pow(1 - Math.abs(th) / 1.5, 2) * 0 - 0.022 * (1 - Math.abs(th) / 1.5), 0.0025)); }
      tubeAlong(kit, S.brass, br, 0.0042, () => 'Head', { seg: 7, color: steel2C, ao: 0.12 });
      // slanted narrow eye slits (inner ends lower), pale-lit
      const sl = []; for (let i = 0; i <= 12; i++) { const th = sx * mix(0.07, 0.52, i / 12); sl.push(headPt(th, 1.716 + 0.026 * (Math.abs(th) - 0.07) / 0.45, 0.001)); }
      tubeAlong(kit, S.glow, sl, (t) => [0.0016, 0.0044 * (1 - 0.6 * Math.abs(t - 0.4))], () => 'Head', { seg: 6, color: 0x202428, ao: 0, up: V(0, 1, 0) });
      const lo = []; for (let i = 0; i <= 12; i++) { const th = sx * mix(0.05, 0.56, i / 12); lo.push(headPt(th, 1.703 + 0.028 * (Math.abs(th) - 0.05) / 0.5, 0.002)); }
      tubeAlong(kit, S.brass, lo, 0.0026, () => 'Head', { seg: 6, color: steel2C, ao: 0.1 });
    }
    // grim jaw: tooth-like vertical vents across the mouth, jaw line below
    const vents = []; for (let k = -4; k <= 4; k++) { const th = k * 0.1, v0 = headPt(th, 1.66, 0.0008), v1 = headPt(th, 1.622 + 0.008 * Math.abs(k) * 0, 0.0008); vents.push([v0, v1]); }
    for (const [v0, v1] of vents) tubeAlong(kit, S.leather, [v0, v1], [0.0013, 0.0021], () => 'Head', { seg: 5, color: blackC, ao: 0, up: V(1, 0, 0), caps: true });
    tubeAlong(kit, S.brass, arc(1.672, -0.55, 0.55, 0.0018, 20), 0.0024, () => 'Head', { seg: 6, color: steel2C, ao: 0.1 });
    tubeAlong(kit, S.brass, arc(1.612, -0.55, 0.55, 0.0018, 20), 0.0024, () => 'Head', { seg: 6, color: steel2C, ao: 0.1 });
    // a gash across the left cheek and rivets round the skull
    tubeAlong(kit, S.leather, [headPt(0.9, 1.75, 0.0012), headPt(0.78, 1.7, 0.0012), headPt(0.68, 1.64, 0.0012)], 0.0013, () => 'Head', { seg: 5, color: 0x0d0f12, ao: 0 });
    const rv = []; for (let i = 0; i < 30; i++) { const th = (i / 30) * TAU; rv.push({ p: headPt(th, 1.8, 0.0012), n: V(Math.sin(th), 0, Math.cos(th)) }); }
    studs(kit, S.brass, 'Head', rv, 0.0026, trimC);
    // small low sharp ridge along the skull
    const NB = 40, base = [];
    for (let i = 0; i <= NB; i++) { const t = i / NB; base.push(t <= 0.5 ? headPt(0, mix(1.8, 1.968, Math.pow(t * 2, 0.7)), 0) : headPt(Math.PI, mix(1.968, 1.76, Math.pow((t - 0.5) * 2, 0.9)), 0)); }
    const crest = (u, v, out) => { const p = base[Math.min(NB, Math.round(u * NB))], h = 0.02 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.02 + 0.01)), 0.9) + 0.004; out.copy(p); out.y += h * v; out.z -= 0.012 * u * v; out.x = 0; };
    surf(kit, S.steel2s, NB, 3, crest, { color: steelC, ao: 0.3, bind: 'Head', center: V(0, 1.5, 0), flip: false });
  }

  }

  // ------------------------------------------------------------ helm types 1-5 (head-sized, snug, polished steel)
  if (HELM >= 1 && HELM <= 5) {
    // The real head measured in world units (the rig is scaled 1.067x): y 1.715-1.948, z -0.04..0.16, nose tip 0.159 at y 1.80.
    // All helm numbers below are in those world units; headPt() converts to kit space with KS. rows: [y, half width, front z, back z (positive behind origin)]
    const H = [[1.62, 0.076, 0.1, 0.03], [1.66, 0.08, 0.112, 0.04], [1.7, 0.092, 0.138, 0.052], [1.74, 0.104, 0.158, 0.068], [1.78, 0.107, 0.172, 0.0814], [1.82, 0.108, 0.182, 0.0825], [1.86, 0.105, 0.16, 0.0912], [1.9, 0.0985, 0.1365, 0.0831], [1.936, 0.0865, 0.1199, 0.0730], [1.9588, 0.0613, 0.0848, 0.0517], [1.9699, 0.0360, 0.0497, 0.0305], [1.9739, 0.0172, 0.0236, 0.0146], [1.9752, 0.0025, 0.0032, 0.0022]];
    const CZ = 0.05, KS = 1 / 1.067, TOP = HELM === 4 ? 1.968 : 1.9752, DK = (1.9752 - 1.86) / (TOP - 1.86);   // helm 4 has a lower, skull-hugging dome
    let prof = { nf: () => 2.2, beak: () => 0 };
    const headPt = (th, y, o = {}, out = V()) => {
      const [rx, zf, zb] = tab(H, HELM === 4 && y > 1.86 ? 1.86 + (y - 1.86) * DK : y), s = Math.sin(th), c = Math.cos(th), nf = prof.nf(y);
      const ef = 2 / nf, e = c >= 0 ? ef : 2 / 2.2, x = rx * sp(s, e);
      let z = CZ + (c >= 0 ? (zf - CZ) * sp(c, e) : (zb + CZ) * sp(c, e));
      if (c > 0) z += (o.beak ?? prof.beak)(x, y);
      out.set(x, y, z);
      if (o.off) { out.x += o.off * s; out.z += o.off * c; }
      return out.multiplyScalar(KS);
    };
    const HC0 = V(0, 1.82 * KS, 0.04 * KS);
    const shell = (bot, nu = 96, nv = 44) => surf(kit, S.steel, nu, nv, (u, v, out) => { const th = u * TAU, thf = th > Math.PI ? TAU - th : th; return headPt(th, mix(bot(thf), TOP, Math.pow(v, 0.8)), {}, out); },
      { closed: true, color: steelC, ao: 0.3, bind: 'Head', shade: patina(0.8) });
    const rimOf = (bot) => { const r = []; for (let i = 0; i < 96; i++) { const p = V(), thf = Math.min(i / 96 * TAU, TAU - i / 96 * TAU); headPt(i / 96 * TAU, bot(thf), {}, p); r.push(p); } return r; };
    const patch = (slot, th0, th1, y0, y1, off, o = {}) => {
      const fn = (u, v, out) => headPt(mix(th0, th1, u), mix(y0, y1, v), { off: off + (o.edge ? 0 : 0), beak: o.beak }, out);
      const nu = o.nu ?? 32, nv = o.nv ?? 12;
      surf(kit, slot, nu, nv, fn, { color: o.color ?? steelC, ao: 0.3, bind: 'Head', center: HC0, shade: patina(0.8) });
      return surfObj(fn, nu, nv, false, () => HC0);
    };
    const arcP = (y, a, b, off, o = {}, n = 36) => { const r = []; for (let i = 0; i <= n; i++) r.push(headPt(mix(a, b, i / n), y, { off, beak: o.beak }, V())); return r; };
    const lineP = (th, y0, y1, off, o = {}, n = 10) => { const r = []; for (let i = 0; i <= n; i++) r.push(headPt(th, mix(y0, y1, i / n), { off, beak: o.beak }, V())); return r; };
    const tube = (pts, r, color = steel2C, closed = false) => tubeAlong(kit, S.brass, pts, r, () => 'Head', { seg: 6, color, ao: 0.12, closed });
    const slitT = (pts, w = 0.0042) => tubeAlong(kit, S.glow, pts, (t) => [0.0016, w * (0.55 + 0.45 * Math.sin(Math.PI * t))], () => 'Head', { seg: 6, color: 0x1c2024, ao: 0, up: V(0, 1, 0) });
    const dark = (pts, r) => tubeAlong(kit, S.leather, pts, r, () => 'Head', { seg: 5, color: blackC, ao: 0, up: V(0, 1, 0), caps: true });
    const disk = (th, y, off, r = 0.011) => studs(kit, S.brass, 'Head', [{ p: headPt(th, y, { off }), n: V(Math.sin(th), 0, Math.cos(th)), r }], r, steel2C, { flat: 0.5 });
    const rivets = (th0, th1, y, n, off) => { const a = []; for (let i = 0; i < n; i++) { const th = mix(th0, th1, i / Math.max(1, n - 1)); a.push({ p: headPt(th, y, { off }), n: V(Math.sin(th), 0, Math.cos(th)) }); } studs(kit, S.brass, 'Head', a, 0.0024, trimC); };
    const dots = (list, off, r = 0.0028) => studs(kit, S.leather, 'Head', list.map(([th, y]) => ({ p: headPt(th, y, { off }), n: V(Math.sin(th), 0, Math.cos(th)), r })), r, blackC, { flat: 0.35, ao: 0 });
    const comb = (h, y0 = 1.9, y1 = 1.74, w = 0.0035) => {
      const base = [], NB = 36;
      for (let i = 0; i <= NB; i++) { const t = i / NB; base.push(t <= 0.5 ? headPt(0, mix(y0, 1.968, Math.pow(t * 2, 0.7)), { off: 0 }) : headPt(Math.PI, mix(1.968, y1, Math.pow((t - 0.5) * 2, 0.9)), { off: 0 })); }
      surf(kit, S.steel2s, NB, 3, (u, v, out) => { const p = base[Math.min(NB, Math.round(u * NB))], hh = h * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.04 + 0.01)), 0.8) + 0.003; out.copy(p); out.y += hh * v; out.x = 0; }, { color: steelC, ao: 0.3, bind: 'Head', center: V(0, 1.5, 0), flip: false });
    };
    const bot2 = (f, b) => (thf) => mix(f, b, sstep(thf, 0.7, 2.4));
    const mailRing = (yTop, yHem, rTop, rHem, zc = 0.012) => surf(kit, S.mail, 72, 14, (u, v, out) => {
      const a = u * TAU, y = mix(yTop, yHem, v), r = mix(rTop, rHem, Math.pow(v, 0.8)) * (1 + 0.025 * Math.sin(a * 13 + v * 5) * v);
      out.set(Math.sin(a) * r * 1.0, y - 0.008 * Math.abs(Math.sin(a * 17)) * v, zc + Math.cos(a) * r * (Math.cos(a) > 0 ? 0.95 : 1.0));
    }, { closed: true, color: mailC, ao: 0.25, bind: (p) => W.torso(Math.min(p.y, 1.56)), shade: (p, n, u, v) => 1 - 0.2 * v });

    if (HELM === 1) {
      // ARMET: smooth rounded close helm, hinged cheek plates meeting on a centre seam, brow visor, low comb, rear rondel
      prof = { nf: () => 2.35, beak: () => 0 };
      const bot = bot2(1.69, 1.64); shell(bot);
      tube(rimOf(bot), 0.0036, steel2C, true);
      const off = 0.008;
      const Vz = patch(S.steel2s, -1.35, 1.35, 1.815, 1.9, off, { nu: 40, nv: 8 });
      bead(kit, S.brass, Vz, 0, 0.0034, () => 'Head', steel2C, { N: 40 }); bead(kit, S.brass, Vz, 1, 0.0034, () => 'Head', steel2C, { N: 40 });
      slitT(arcP(1.852, -0.78, 0.78, off + 0.0012), 0.0036);
      for (const sx of [1, -1]) {
        const Ck = patch(S.steel2s, sx * 0.045, sx * 1.62, 1.696, 1.812, off, { nu: 30, nv: 10 });
        bead(kit, S.brass, Ck, 1, 0.0032, () => 'Head', steel2C, { N: 30 }); bead(kit, S.brass, Ck, 0, 0.0032, () => 'Head', steel2C, { N: 30 });
        beadU(kit, S.brass, Ck, 0, 0.0038, () => 'Head', steel2C, { N: 10 });
        const tk = []; for (let r = 0; r < 4; r++) tk.push(lineP(sx * (0.35 + r * 0.14), 1.72, 1.775, off + 0.0007, {}, 3));
        for (const l of tk) dark(l, [0.0013, 0.0018]);
        disk(sx * 1.6, 1.78, off, 0.013);
      }
      disk(Math.PI, 1.76, 0.002, 0.026);
      rivets(-2.4, 2.4, 1.8, 24, 0.0012);
    } else if (HELM === 2) {
      // GREAT BASCINET: round dome, flat-faced visor with vertical slits and a breaths pattern, neck collar
      prof = { nf: (y) => mix(2.2, 4.6, sstep(y, 1.85, 1.75)), beak: () => 0 };
      const bot = bot2(1.69, 1.64); shell(bot);
      tube(rimOf(bot), 0.0038, steel2C, true);
      const off = 0.006;
      const Vz = patch(S.steel2s, -0.95, 0.95, 1.705, 1.885, off, { nu: 36, nv: 18 });
      bead(kit, S.brass, Vz, 0, 0.0036, () => 'Head', steel2C, { N: 36 }); bead(kit, S.brass, Vz, 1, 0.0036, () => 'Head', steel2C, { N: 36 });
      beadU(kit, S.brass, Vz, 0, 0.0034, () => 'Head', steel2C, { N: 14 }); beadU(kit, S.brass, Vz, 1, 0.0034, () => 'Head', steel2C, { N: 14 });
      for (const th of [0, 0.34, -0.34]) { const l = lineP(th, th === 0 ? 1.89 - 0.005 : 1.866, th === 0 ? 1.775 : 1.805, off + 0.0012, {}, 12); slitT(l.reverse(), th === 0 ? 0.0034 : 0.003); }
      const ps = []; for (let r = 0; r < 5; r++) for (let k = 0; k < 4; k++) ps.push([-0.2 - k * 0.14 - (r % 2) * 0.07, 1.75 - r * 0.0105]);
      dots(ps, off + 0.0006, 0.0023);
      for (const y of [1.76, 1.735]) tube(arcP(y, 0.35, 0.92, off + 0.002), 0.0022);
      disk(1.0, 1.82, off, 0.012); disk(-1.0, 1.82, off, 0.012);
      rivets(-2.6, 2.6, 1.78, 30, 0.0012);
    } else if (HELM === 3) {
      // SALLET: skull with a long curved tail, brow visor with a narrow slit, and a bevor over the jaw
      prof = { nf: () => 2.4, beak: (x, y) => 0.012 * Math.exp(-Math.pow(x / 0.04, 2)) * sstep(y, 1.78, 1.84) };
      const bot = (thf) => tab([[0, 1.895], [0.7, 1.865], [1.3, 1.80], [2.0, 1.745], [2.7, 1.7], [3.15, 1.68]], thf)[0];
      shell(bot, 96, 40);
      tube(rimOf(bot), 0.0038, steel2C, true);
      // the tail: a curved plate swept back and down over the nape
      const path = (t) => V(0, 1.79 - 0.1 * Math.pow(t, 1.1), -(0.068 + 0.05 * Math.pow(t, 0.75)));
      const tail = (u, v, out) => { const ux = (u - 0.5) * 2, p = path(v), w = 0.088 * (1 - 0.3 * v) * (1 - 0.2 * ux * ux * v); out.set(ux * w, p.y + 0.03 * ux * ux * v, p.z + 0.03 * ux * ux); out.multiplyScalar(KS); };
      surf(kit, S.steel2s, 18, 10, tail, { color: steelC, ao: 0.3, bind: 'Head', center: V(0, 1.7, 0.3), shade: patina(0.9) });
      for (const ex of [0, 1]) { const e = []; for (let i = 0; i <= 12; i++) { const q = V(); tail(ex, i / 12, q); e.push(q); } tube(e, 0.0032); }
      { const e = []; for (let i = 0; i <= 12; i++) { const q = V(); tail(0.5, i / 12, q); q.z -= 0.003; e.push(q); } tube(e, 0.0034); }
      const off = 0.008;
      const Vz = patch(S.steel2s, -1.4, 1.4, 1.795, 1.888, off, { nu: 40, nv: 8, beak: (x, y) => 0.016 * Math.exp(-Math.pow(x / 0.05, 2)) });
      bead(kit, S.brass, Vz, 0, 0.0034, () => 'Head', steel2C, { N: 40 }); bead(kit, S.brass, Vz, 1, 0.0034, () => 'Head', steel2C, { N: 40 });
      slitT(arcP(1.842, -0.95, 0.95, off + 0.0012, {}, 36), 0.0034);
      const Bv = patch(S.steel2s, -1.7, 1.7, 1.69, 1.8, 0.012, { nu: 44, nv: 10, beak: (x, y) => 0.03 * Math.exp(-Math.pow(x / 0.05, 2)) * Math.sin(Math.PI * clamp01((y - 1.69) / 0.11)) });
      bead(kit, S.brass, Bv, 0, 0.0036, () => 'Head', steel2C, { N: 44 }); bead(kit, S.brass, Bv, 1, 0.0036, () => 'Head', steel2C, { N: 44 });
      tube(lineP(0, 1.8, 1.69, 0.016, { beak: (x, y) => 0.03 * Math.sin(Math.PI * clamp01((y - 1.69) / 0.11)) }, 10), 0.003);
      dots([[0.5, 1.76], [0.6, 1.76], [0.5, 1.73], [0.6, 1.73], [-0.5, 1.76], [-0.6, 1.76], [-0.5, 1.73], [-0.6, 1.73]], 0.0125, 0.0026);
      disk(1.45, 1.84, off, 0.011); disk(-1.45, 1.84, off, 0.011);
      rivets(-2.6, 2.6, 1.86, 28, 0.0012);
    } else if (HELM === 4) {
      // BURGONET / close helm: rounded skull with a projecting peak and comb, cheek pieces, and a face-covering bevor
      prof = { nf: () => 2.3, beak: () => 0 };
      const bot = (thf) => tab([[0, 1.875], [0.55, 1.865], [0.95, 1.79], [1.4, 1.70], [2.2, 1.65], [3.15, 1.615]], thf)[0];
      shell(bot, 96, 44);
      tube(rimOf(bot), 0.0038, steel2C, true);
      // dark void of the open face under the peak
      patch(S.leather, -1.0, 1.0, 1.79, 1.87, -0.001, { color: blackC, nu: 24, nv: 6 });
      // peak: a curved brim jutting forward over the eyes
      const peak = (u, v, out) => { const th = mix(-1.3, 1.3, u), p = headPt(th, 1.872 - 0.01 * v, { off: 0.004 }), L = (0.01 + 0.022 * Math.pow(Math.cos(th * 0.8), 2)) * v; out.set(p.x + L * Math.sin(th), p.y - 0.012 * v * v, p.z + L * Math.cos(th)); };
      surf(kit, S.steel2s, 40, 6, peak, { color: steelC, ao: 0.3, bind: 'Head', center: V(0, 1.7, 0.0), shade: patina(0.9), flip: false });
      { const e = []; for (let i = 0; i <= 40; i++) { const q = V(); peak(i / 40, 1, q); e.push(q); } tube(e, 0.0042); }
      // bevor over the lower face and jaw
      const off = 0.011, bv = { beak: (x, y) => 0.024 * Math.exp(-Math.pow(x / 0.045, 2)) * Math.sin(Math.PI * clamp01((y - 1.685) / 0.115)) };
      const Bv = patch(S.steel2s, -2.0, 2.0, 1.685, 1.8, off, { nu: 52, nv: 10, ...bv });
      bead(kit, S.brass, Bv, 0, 0.0036, () => 'Head', steel2C, { N: 52 }); bead(kit, S.brass, Bv, 1, 0.0038, () => 'Head', steel2C, { N: 52 });
      tube(lineP(0, 1.8, 1.685, off + 0.003, bv, 10), 0.0032);
      for (const sx of [1, -1]) for (const y of [1.725, 1.755]) tube(arcP(y, sx * 0.25, sx * 0.85, off + 0.002, bv, 12), 0.0022);
      dots([[0.42, 1.775], [0.52, 1.775], [0.62, 1.775], [-0.42, 1.775], [-0.52, 1.775], [-0.62, 1.775]], off + 0.0006, 0.0026);
      disk(1.5, 1.8, 0.004, 0.011); disk(-1.5, 1.8, 0.004, 0.011);
      for (const sx of [1, -1]) {   // hinged cheek guards over the sides of the face
        const Ck = patch(S.steel2s, sx * 0.9, sx * 1.8, 1.71, 1.83, 0.013, { nu: 20, nv: 8 });
        bead(kit, S.brass, Ck, 0, 0.003, () => 'Head', steel2C, { N: 20 }); bead(kit, S.brass, Ck, 1, 0.003, () => 'Head', steel2C, { N: 20 });
        beadU(kit, S.brass, Ck, 0, 0.003, () => 'Head', steel2C, { N: 8 }); beadU(kit, S.brass, Ck, 1, 0.003, () => 'Head', steel2C, { N: 8 });
        disk(sx * 1.75, 1.82, 0.013, 0.011);
      }
      rivets(-2.6, 2.6, 1.87, 30, 0.0012);
      // Kazuya-style swept steel hair: thick sharp locks rooted in the crown, sweeping back and up, with lower locks falling over the nape
      const hairC = col(C.steel2, 0.5).getHex();
      const lock = (thr, y0, L, rise, out, droop, W, flick) => {
        const R = headPt(thr, y0, { off: -0.005 }), sg = Math.abs(Math.sin(thr)) < 0.05 ? 0 : Math.sign(Math.sin(thr)), pts = [];
        for (let i = 0; i <= 16; i++) { const t = i / 16;
          pts.push(V(R.x + sg * out * Math.pow(t, 1.3) + 0.006 * Math.sin(t * 5 + thr * 3) * t, R.y + rise * Math.pow(t, 0.6) - droop * Math.pow(t, 2.2) + flick * Math.pow(t, 4), R.z - L * t)); }
        tubeAlong(kit, S.brass, pts, (t) => [W * Math.pow(1 - t, 0.85) + 0.0008, 0.4 * W * Math.pow(1 - t, 0.7) + 0.0007], () => 'Head', { seg: 6, color: hairC, ao: 0.2, up: V(0, 1, 0) });
      };
      [[-1.15, 1.9, 0.26, 0.07, 0.06, 0.02, 0.024, 0.02], [-0.76, 1.912, 0.3, 0.085, 0.05, 0.02, 0.028, 0.025], [-0.38, 1.92, 0.33, 0.1, 0.025, 0.03, 0.032, 0.03], [0, 1.925, 0.37, 0.115, 0, 0.03, 0.036, 0.035], [0.38, 1.92, 0.33, 0.1, 0.025, 0.03, 0.032, 0.03], [0.76, 1.912, 0.3, 0.085, 0.05, 0.02, 0.028, 0.025], [1.15, 1.9, 0.26, 0.07, 0.06, 0.02, 0.024, 0.02],
       [-0.9, 1.945, 0.2, 0.07, 0.04, 0.0, 0.026, 0.02], [-0.45, 1.95, 0.24, 0.085, 0.02, 0.0, 0.03, 0.025], [0, 1.952, 0.27, 0.095, 0, 0.0, 0.032, 0.03], [0.45, 1.95, 0.24, 0.085, 0.02, 0.0, 0.03, 0.025], [0.9, 1.945, 0.2, 0.07, 0.04, 0.0, 0.026, 0.02]]
        .forEach((a) => lock(...a));
      [[Math.PI - 0.55, 1.915, 0.16, 0.04, 0.03, 0.11, 0.026, 0], [Math.PI, 1.925, 0.2, 0.05, 0, 0.14, 0.03, 0], [Math.PI + 0.55, 1.915, 0.16, 0.04, 0.03, 0.11, 0.026, 0]]
        .forEach((a) => lock(...a));
    } else if (HELM === 5) {
      // MAXIMILIAN: round fluted helm, heavy rope edge, brow visor with eye slit and a breaths-pierced lower face guard
      prof = { nf: () => 2.3, beak: () => 0 };
      const bot = bot2(1.69, 1.64); shell(bot);
      tube(rimOf(bot), 0.0058, steel2C, true);
      for (let k = 0; k < 16; k++) { const th = (k / 16) * TAU, r = []; for (let i = 0; i <= 14; i++) r.push(headPt(th, mix(1.7, 1.935, Math.pow(i / 14, 0.9)), { off: 0.0022 })); tube(r, 0.003); }
      const off = 0.007;
      const Vz = patch(S.steel2s, -1.3, 1.3, 1.81, 1.895, off, { nu: 40, nv: 8 });
      bead(kit, S.brass, Vz, 0, 0.0036, () => 'Head', steel2C, { N: 40 }); bead(kit, S.brass, Vz, 1, 0.0036, () => 'Head', steel2C, { N: 40 });
      slitT(arcP(1.848, -0.8, 0.8, off + 0.0012), 0.0036);
      const Fg = patch(S.steel2s, -1.5, 1.5, 1.695, 1.806, 0.01, { nu: 44, nv: 10 });
      bead(kit, S.brass, Fg, 1, 0.0034, () => 'Head', steel2C, { N: 44 }); bead(kit, S.brass, Fg, 0, 0.0034, () => 'Head', steel2C, { N: 44 });
      const ds = []; for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) ds.push([0.5 + k * 0.1 + (r % 2) * 0.05, 1.77 - r * 0.026], [-(0.5 + k * 0.1 + (r % 2) * 0.05), 1.77 - r * 0.026]);
      dots(ds, 0.0106, 0.0024);
      disk(1.34, 1.84, off, 0.012); disk(-1.34, 1.84, off, 0.012);
    }
  }

  // ------------------------------------------------------------ pauldrons (layered, ridged) and arms
  for (const A of SIDES) {
    const s = sgn(A), sh = J(A + 'Arm');
    const axC = (d) => V(s * d, sh.y, sh.z), REF = V(0, 1, 0);
    const lame = (d0, d1, rr0, rr1, a0, a1, bone, color = steelC, o = {}) => band(kit, S.steel, {
      c0: axC(d0), c1: axC(d1), d: V(s, 0, 0), ref: REF, sgn: s,
      rA: (v, a) => mix(rr0, rr1, v) + (o.bulge ? o.bulge * Math.sin(v * Math.PI) : 0) + (o.lip ? o.lip * Math.pow(v, 5) : 0) + (o.scal ? o.scal * Math.pow(v, 3) * (0.5 + 0.5 * Math.cos(a * 7)) : 0),
      rB: (v, a) => (mix(rr0, rr1, v) + (o.bulge ? o.bulge * Math.sin(v * Math.PI) : 0) + (o.lip ? o.lip * Math.pow(v, 5) : 0) + (o.scal ? o.scal * Math.pow(v, 3) * (0.5 + 0.5 * Math.cos(a * 7)) : 0)) * (o.asp ?? 1),
      a0, a1, nu: o.nu ?? 28, nv: o.nv ?? 4, n: o.n ?? 2.2, color, ao: 0.3, bind: bone, shade: o.shade ?? ((p, n, u, v) => edgeAO(0.2)(p, n, u, v) * patina()(p, n, u, v)),
    });
    const cx = s * 0.185, cy = 1.51, cz = sh.z;
    const domePt = (u, v, out) => {
      const th = u * TAU, ph = v * 1.3, sx = Math.sin(ph) * Math.cos(th), sz = Math.sin(ph) * Math.sin(th), sy = Math.cos(ph);
      const rim = 0.008 * sstep(v, 0.9, 1), ridge = 0.01 * Math.exp(-Math.pow(Math.sin(th) / 0.14, 2)) * Math.sin(ph), tip = 0.04 * Math.pow(Math.max(0, Math.cos(th)), 5) * sstep(v, 0.55, 1);   // raised ridge fore-aft over the top
      out.set(cx + s * ((0.126 + rim) * sx * (1 + ridge * 8) + tip), cy + 0.09 * sy - 0.016 + ridge * sy * 2.5 - tip * 0.25, cz + (0.13 + rim) * sz * (1 + ridge * 8));
    };
    const dbind = [['Spine2', 0.45], [A + 'Shoulder', 0.55]];
    surf(kit, S.steel, 40, 14, domePt, { closed: true, color: steelC, ao: 0.28, bind: dbind, center: V(cx, cy - 0.02, cz), shade: patina() });
    const DB = surfObj(domePt, 40, 14, true, () => V(cx, cy, cz));
    bead(kit, S.brass, DB, 1, 0.0046, dbind, steel2C, { N: 40 });
    { const c0 = V(cx, cy - 0.02, cz);
      const top = V(); domePt(0.5, 0.1, top);
      for (const [u, L] of [[0, 0.07], [0.07, 0.05], [0.93, 0.05], [0.25, 0.045], [0.75, 0.045]]) {
        const p = V(); domePt(u, 0.96, p); const dr = p.clone().sub(c0).normalize(), tip = p.clone().addScaledVector(dr, L).add(V(0, -0.012, 0));
        tubeAlong(kit, S.steel, [p.clone().addScaledVector(dr, -0.012), p, tip], (t) => 0.011 * (1 - t) + 0.0006, dbind, { seg: 7, color: steelC, ao: 0.2 });
      } }
    // fore-aft ridge rib along the crown
    { const rb = []; for (let i = 0; i <= 14; i++) { const th = i < 8 ? 0 : 0; const ph = mix(0.05, 1.25, i / 14); const p = V(); domePt(0.25, mix(0.03, 0.9, i / 14), p); rb.push(p); } 
      const rb2 = []; for (let i = 0; i <= 14; i++) { const p = V(); domePt(0.75, mix(0.03, 0.9, i / 14), p); rb2.push(p); }
      for (const r of [rb, rb2]) tubeAlong(kit, S.brass, r.map((p) => p.clone().add(V(0, 0.003, 0))), 0.0036, dbind, { seg: 6, color: steel2C, ao: 0.1 }); }
    riveted(kit, S.brass, 'Spine2', DB, [0.1, 0.35, 0.6, 0.85].map((u) => [u, 0.9, 0.001]), 0.0034, trimC);
    // lames cascading down the outer arm, each with a raised spine and a flared lip
    [[0.2, 0.28, 0.13, 0.124], [0.245, 0.32, 0.12, 0.114], [0.288, 0.358, 0.108, 0.102], [0.33, 0.395, 0.094, 0.088]].forEach(([d0, d1, r0, r1], i) => {
      if (A === 'Right' && i === 2) return;   // a lame torn clean off
      const B = lame(d0, d1, r0, r1, -2.3, 2.3, A + 'Arm', i % 2 ? steel2C : steelC, { lip: 0.006, nv: 5, nu: 40, n: 1.7 });
      bead(kit, S.steel, B, 1, 0.0038, () => A + 'Arm', i % 2 ? steelC : steel2C, { N: 32, u0: 0.01, u1: 0.99 });
      for (let k = -2; k <= 2; k++) {
        const a = k * 0.5, rr = r1 + 0.005, base = V(s * d1 - s * 0.01, sh.y + Math.cos(a) * rr, sh.z + Math.sin(a) * rr);
        const nrm = V(0, Math.cos(a), Math.sin(a)), tip = base.clone().addScaledVector(nrm, 0.007).add(V(s * 0.05, -0.004, 0));
        tubeAlong(kit, S.steel, [base.clone().add(V(-s * 0.02, 0, 0)), base, tip], (t) => [0.003 * (1 - t) + 0.0005, 0.012 * (1 - t) + 0.0006], () => A + 'Arm', { seg: 6, color: steelC, ao: 0.2, up: nrm });
      }
      beadU(kit, S.brass, B, 0.5, 0.004, () => A + 'Arm', steel2C, { N: 5 });
      riveted(kit, S.brass, A + 'Arm', B, [0.28, 0.72].map((u) => [u, 0.3, 0.0012]), 0.0032, trimC);
    });
    // rerebrace, couter with wing, vambrace
    let B2 = lame(0.37, 0.435, 0.068, 0.064, 0, TAU, A + 'Arm', steelC, { bulge: 0.003, lip: 0.004, nu: 28 });
    bead(kit, S.steel, B2, 1, 0.0034, () => A + 'Arm', steel2C); bead(kit, S.steel, B2, 0, 0.0034, () => A + 'Arm', steel2C);
    const couter = band(kit, S.steel, {
      c0: axC(0.415), c1: axC(0.5), d: V(s, 0, 0), ref: V(0, 0, -1), sgn: -s, nu: 36, nv: 10, n: 2,
      rA: (v, a) => 0.06 + 0.032 * Math.sin(Math.PI * Math.pow(v, 0.8)) * Math.exp(-Math.pow(a / 1.1, 2)) + 0.007 * Math.sin(Math.PI * v),
      rB: (v, a) => 0.064 + 0.012 * Math.sin(Math.PI * v) + 0.02 * Math.sin(Math.PI * v) * Math.exp(-Math.pow((Math.abs(a) - 1.1) / 0.7, 2)),
      a0: -Math.PI * 0.92, a1: Math.PI * 0.92, color: steelC, ao: 0.3, bind: A + 'ForeArm', shade: (p, n, u, v) => (1 - 0.15 * Math.pow(1 - Math.sin(v * Math.PI), 2)) * patina()(p, n, u, v),
    });
    { const el = J(A + 'ForeArm'), b0 = V(s * 0.455, el.y + 0.002, el.z - 0.06);
      tubeAlong(kit, S.steel, [b0.clone().add(V(0, 0, 0.012)), b0, b0.clone().add(V(s * 0.012, 0.012, -0.075))], (t) => 0.016 * (1 - t) + 0.0008, () => A + 'ForeArm', { seg: 8, color: steelC, ao: 0.2 }); }
    bead(kit, S.brass, couter, 0.02, 0.0034, () => A + 'ForeArm', steel2C, { N: 36 }); bead(kit, S.brass, couter, 0.98, 0.0034, () => A + 'ForeArm', steel2C, { N: 36 });
    lame(0.4, 0.44, 0.06, 0.072, 0, TAU, A + 'Arm', steel2C, { nv: 3, lip: 0.003 });
    B2 = lame(0.495, 0.655, 0.063, 0.05, 0, TAU, A + 'ForeArm', steelC, { bulge: 0.0035, nu: 30, nv: 8, lip: 0.003 });
    bead(kit, S.steel, B2, 0, 0.0035, () => A + 'ForeArm', steel2C); bead(kit, S.steel, B2, 1, 0.0035, () => A + 'ForeArm', steel2C);
    beadU(kit, S.brass, B2, 0.5, 0.0036, () => A + 'ForeArm', steel2C, { N: 8 });
    riveted(kit, S.brass, A + 'ForeArm', B2, [0.1, 0.35, 0.6, 0.85].map((u) => [u, 0.08, 0.001]), 0.003, trimC);
    // gauntlet
    B2 = lame(0.65, 0.725, 0.055, 0.047, 0, TAU, A + 'Hand', steel2C, { lip: 0.009, nv: 4 });
    bead(kit, S.brass, B2, 1, 0.0035, () => A + 'Hand', steelC);
    const hc = (v) => V(s * mix(0.715, 0.805, v), 1.512 - 0.004 * v, -0.05);
    const hand = band(kit, S.steel, { c: hc, d: V(s, 0, 0), ref: REF, sgn: s, nu: 18, nv: 8, n: 2.4, a0: -1.45, a1: 1.45, rA: (v) => 0.03 - 0.008 * v, rB: (v) => 0.05 - 0.002 * v, color: steelC, ao: 0.28, bind: A + 'Hand', shade: patina() });
    bead(kit, S.steel, hand, 1, 0.003, () => A + 'Hand', steel2C, { N: 18 });
    fingerPlates(kit, S.steel, A, { color: steelC, r: 0.0082 });
  }

  // ------------------------------------------------------------ fauld lames and the dark cloth tassets
  {
    const FA = [[0.96, 0.176, 0.138, 0.126], [1.06, 0.172, 0.136, 0.123], [1.12, 0.17, 0.136, 0.121]];
    for (let i = 0; i < 3; i++) {
      const yT = 1.07 - i * 0.032, yB = yT - 0.046, bone = i < 1 ? 'Spine' : 'Hips';
      const fp = (u, v, out) => { const th = u * TAU, y = mix(yT, yB, v), [rx, zf, zb] = tab(FA, y), k = 1 + i * 0.012 + 0.012 * Math.pow(v, 3), e = 2 / 2.5, s = Math.sin(th), c = Math.cos(th); out.set(rx * k * sp(s, e), y, CUCZ + (c >= 0 ? zf * k * sp(c, e) : zb * k * sp(c, e))); };
      surf(kit, S.steel, 64, 4, fp, { closed: true, color: i % 2 ? steel2C : steelC, ao: 0.3, bind: bone, shade: (p, n, u, v) => edgeAO(0.22, 4)(p, n, u, v) * patina()(p, n, u, v) });
      bead(kit, S.steel, surfObj(fp, 64, 4, true, () => V(0, yT, CUCZ)), 1, 0.0032, () => bone, i % 2 ? steelC : steel2C, { N: 64 });
    }
    // belt with a gunmetal buckle
    const pts = []; for (let i = 0; i < 72; i++) { const th = (i / 72) * TAU, s = Math.sin(th), c = Math.cos(th), e = 2 / 2.5; pts.push(V(0.183 * sp(s, e), 1.09, CUCZ + (c >= 0 ? 0.153 * sp(c, e) : 0.14 * sp(c, e)))); }
    strap(kit, S.leather, pts, 0.034, 0.006, () => 'Spine', 0x15130f, { closed: true, vertical: true });
    buckle(kit, S.brass, 'Spine', V(0, 1.09, 0.156), V(0, 0, 1), V(0, 1, 0), 0.015, 0.014, steel2C);
    // long tattered tabard and waist cape: ragged strips hung from the belt, bound to the thigh on their own side
    const skirtBind = (p) => {
      const w = 0.72 * sstep(p.y, 1.0, 0.68);
      return w < 0.02 ? [['Hips', 1]] : [['Hips', 1 - w], [(p.x >= 0 ? 'Left' : 'Right') + 'UpLeg', w]];
    };
    const SK = [[0.3, 0.2, 0.2, 0.2], [0.7, 0.2, 0.19, 0.19], [0.9, 0.186, 0.16, 0.152], [1.04, 0.176, 0.14, 0.13]];
    const strips = (back, n, base, vary, wid, layer, color0) => {
      for (let k = 0; k < n; k++) {
        const hsh = Math.abs(Math.sin(k * 12.9898 + layer * 78.233 + (back ? 3 : 0)) * 43758.5453) % 1;
        const xc = mix(-0.185, 0.185, (k + 0.5) / n), ln = base + vary * hsh, w = wid * (0.85 + 0.3 * hsh), ph = hsh * 6;
        surf(kit, S.cloth, 4, 22, (u, v, out) => {
          const y = mix(1.04 - layer * 0.01, 1.04 - ln, v), tp = 1 - 0.65 * sstep(v, 0.55, 1), xx = xc + (u - 0.5) * w * tp + 0.012 * Math.sin(v * 4 + ph) * v;
          const [rx, zf, zb] = tab(SK, Math.max(0.3, y)), r = back ? zb : zf, ex = Math.min(1, Math.abs(xx) / rx);
          const z = r * Math.sqrt(Math.max(0.15, 1 - ex * ex * 0.9)) + 0.012 + layer * 0.012 + 0.03 * sstep(y, 0.9, 0.55) + 0.014 * Math.sin(y * 9 + ph) * v;
          out.set(xx * (1 + 0.08 * v), y, CUCZ + (back ? -z : z));
        }, { color: hsh > 0.5 ? color0 : col(color0, 0.8).getHex(), ao: 0.3, bind: skirtBind, center: () => V(0, 0.9, back ? 0.4 : -0.4), shade: (p) => 1 - 0.18 * vnoise(p.x * 40, p.y * 10) });
      }
    };
    strips(false, 8, 0.52, 0.2, 0.04, 0, 0x373a3f);
    strips(true, 8, 0.46, 0.22, 0.04, 0, 0x2d3034);
    strips(false, 12, 0.2, 0.1, 0.027, 1, 0x3d4045);   // frayed hip cloth over the thighs
    strips(true, 12, 0.2, 0.1, 0.027, 1, 0x34373c);
  }
  swordAndScabbard(kit, S, { belt: V(0.215, 1.08, 0.0), tip: V(0.29, 0.46, -0.14), bone: 'Hips', grip: 0.1, color: 0x15130f, hiltColor: trimC, cross: 0.2 });

  // ------------------------------------------------------------ legs
  for (const A of SIDES) {
    const s = sgn(A), an = J(A + 'Foot');
    const LC = (y) => legCenter(kit, A, y, new THREE.Vector3());
    const legBand = (y0, y1, extra, o = {}) => band(kit, S.steel, {
      c: (v) => LC(mix(y1, y0, v)), d: V(0, -1, 0), ref: V(0, 0, 1), sgn: s, a0: o.a0 ?? 0, a1: o.a1 ?? TAU, nu: o.nu ?? 32, nv: o.nv ?? 6, n: o.n ?? 2.2,
      rA: (v, a) => { const y = mix(y1, y0, v); return tab(LEG_R, y)[0] + extra(v, a) + (o.zex ?? 0.003); },
      rB: (v, a) => { const y = mix(y1, y0, v); return tab(LEG_R, y)[0] * 0.98 + extra(v, a); },
      color: o.color ?? steelC, ao: 0.3, bind: o.bone, shade: (p, n, u, v) => edgeAO(0.2)(p, n, u, v) * patina()(p, n, u, v),
    });
    const ridge = (a, w = 0.6) => 0.007 * Math.exp(-Math.pow(a / w, 2));
    let B = legBand(0.71, 0.97, (v, a) => 0.012 + ridge(a) - 0.004 * v, { bone: A + 'UpLeg', nv: 8, color: steelC });
    bead(kit, S.steel, B, 1, 0.0035, () => A + 'UpLeg', steel2C);
    B = legBand(0.63, 0.8, (v, a) => 0.014 + ridge(a) - 0.002 * v, { bone: A + 'UpLeg', nv: 6, color: steel2C });
    bead(kit, S.steel, B, 0, 0.0035, () => A + 'UpLeg', steelC); bead(kit, S.steel, B, 1, 0.0035, () => A + 'UpLeg', steelC);
    // poleyn: knee cop with a pointed side wing
    const pol = band(kit, S.steel, {
      c: (v) => LC(mix(0.625, 0.505, v)), d: V(0, -1, 0), ref: V(0, 0, 1), sgn: s, a0: -1.45, a1: 1.45, nu: 36, nv: 14, n: 2,
      rA: (v, a) => 0.07 + 0.036 * Math.sin(Math.PI * Math.pow(v, 0.9)) * Math.exp(-Math.pow(a / 1.2, 2)) + 0.004,
      rB: (v, a) => 0.075 + 0.012 * Math.sin(Math.PI * v) + 0.025 * Math.sin(Math.PI * v) * Math.exp(-Math.pow((a - 0.95) / 0.5, 2)),
      color: steelC, ao: 0.3, bind: A + 'Leg', shade: (p, n, u, v) => (1 - 0.18 * Math.pow(Math.abs(v - 0.5) * 2, 3)) * patina()(p, n, u, v),
    });
    { const c = LC(0.565), b0 = V(c.x, c.y, c.z + 0.095);
      tubeAlong(kit, S.steel, [b0.clone().add(V(0, 0.004, -0.02)), b0, b0.clone().add(V(0, -0.012, 0.062))], (t) => 0.02 * (1 - t) + 0.0008, () => A + 'Leg', { seg: 8, color: steelC, ao: 0.2, up: V(1, 0, 0) }); }
    bead(kit, S.brass, pol, 0.02, 0.0034, () => A + 'Leg', steel2C, { N: 36 }); bead(kit, S.brass, pol, 0.98, 0.0034, () => A + 'Leg', steel2C, { N: 36 });
    legBand(0.585, 0.655, (v, a) => 0.011 + ridge(a, 0.5) * 0.5, { bone: A + 'UpLeg', nv: 3, a0: -1.6, a1: 1.6, nu: 22, color: steel2C });
    // greave with a shin ridge
    B = legBand(0.14, 0.5, (v, a) => 0.009 + 0.01 * Math.exp(-Math.pow(a / 0.35, 2)), { bone: A + 'Leg', nv: 12, nu: 36, color: steelC });
    bead(kit, S.steel, B, 0, 0.0035, () => A + 'Leg', steel2C); bead(kit, S.brass, B, 1, 0.0035, () => A + 'Leg', steel2C);
    for (const y of [0.4, 0.27]) {
      const loop = []; for (let k = 0; k < 28; k++) { const a = (k / 28) * TAU; const r = tab(LEG_R, y)[0] + 0.0145, c = LC(y); loop.push(V(c.x + Math.sin(a) * r, y, c.z + Math.cos(a) * r * 0.98)); }
      strap(kit, S.leather, loop, 0.02, 0.005, () => A + 'Leg', leatherC, { closed: true, vertical: true });
    }
    // sabaton: solid lofted boot with instep ridges
    legBand(0.1, 0.17, () => 0.011, { bone: A + 'Foot', nv: 3, nu: 24, color: steel2C });
    const fx = an.x, TOPY = [[-0.09, 0.1], [0.0, 0.118], [0.08, 0.104], [0.17, 0.072], [0.25, 0.04], [0.3, 0.014]], WID = [[-0.09, 0.034], [-0.03, 0.054], [0.1, 0.056], [0.19, 0.045], [0.26, 0.026], [0.3, 0.006]];
    const shoePt = (u, v, out, off = 0) => {
      const z = mix(-0.09, 0.3, v), top = tab(TOPY, z)[0] + off, w = tab(WID, z)[0] + off, bot = 0.004, mid = (top + bot) / 2, hh = (top - bot) / 2, a = u * TAU;
      out.set(fx + s * 0.005 + w * sp(Math.sin(a), 0.85), mid + hh * sp(Math.cos(a), 0.85), z); return out;
    };
    const sbind = (p) => { const w = sstep(p.z, 0.08, 0.2); return [[A + 'Foot', 1 - w], [A + 'ToeBase', w]]; };
    surf(kit, S.steel, 32, 24, shoePt, { closed: true, color: steelC, ao: 0.3, bind: sbind, center: V(fx, 0.05, 0.1), shade: patina(1.4) });
    for (const z of [0.0, 0.06, 0.12, 0.18]) {
      const v = (z + 0.09) / 0.39, pts = []; for (let i = 0; i <= 14; i++) { const q = V(); shoePt(mix(-0.34, 0.34, i / 14), v, q, 0.003); pts.push(q); }
      tubeAlong(kit, S.brass, pts, 0.0034, sbind, { seg: 6, color: steel2C, ao: 0.12 });
    }
    surf(kit, S.leather, 20, 12, (u, v, out) => {
      const a = (u - 0.5) * TAU * 0.5, z = mix(-0.1, 0.3, v), w = tab([[-0.1, 0.03], [-0.02, 0.05], [0.1, 0.05], [0.18, 0.04], [0.3, 0.004]], z)[0];
      out.set(fx + s * 0.005 + Math.sin(a * 2) * w, mix(0.002, 0.018, Math.abs(Math.cos(a))), z);
    }, { color: 0x14100c, ao: 0.1, bind: A + 'Foot', center: V(fx, 0.06, 0.1) });
  }

  // ------------------------------------------------------------ short tattered cape from the shoulders
  for (let k = 0; k < 9; k++) {
    const hsh = Math.abs(Math.sin(k * 9.31 + 1.7) * 43758.5453) % 1, xc = mix(-0.165, 0.165, (k + 0.5) / 9), ln = 0.44 + 0.14 * hsh, w = 0.05 * (0.9 + 0.3 * hsh), ph = hsh * 6;
    surf(kit, S.cloth, 4, 22, (u, v, out) => {
      const y = mix(1.5, 1.5 - ln, v), tp = 1 - 0.7 * sstep(v, 0.5, 1), xx = xc + (u - 0.5) * w * tp + 0.012 * Math.sin(v * 4 + ph) * v;
      out.set(xx * (1 + 0.12 * v), y, -(0.15 + 0.04 * Math.pow(v, 1.2) + 0.02 * Math.sin(v * 5 + ph) * v + 0.012 * (1 - Math.abs(xx) / 0.17)));
    }, { color: hsh > 0.5 ? 0x2b2d31 : 0x232529, ao: 0.3, bind: (p) => W.torso(Math.max(p.y, 0.95)), center: () => V(0, 1.2, 0.4), shade: (p) => 1 - 0.18 * vnoise(p.x * 40, p.y * 10) });
  }

  return finishKit(kit);
}
