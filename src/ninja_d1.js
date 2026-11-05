// Design 1: classic shinobi shozoku. Charcoal cotton uwagi crossed right over left with a knotted sash, tapered trousers
// gathered over indigo kyahan leg wraps, split-toe tabi, tekko forearm guards, a zukin hood with a layered face cloth,
// a straight ninjato slung on the back with a long cord, a kunai/shuriken pouch and a chain.
import * as THREE from 'three';
import { makeKit, V, ell, limb } from './armor.js';
import { real } from './realmat.js';
import { clothTube, fabricMat, makeFit, headField, hoodShell, tube, ribbon, torsoField, torsoW, armW, legW, fab, mixC, shade, sstep, clamp, keyed, span, creases, pleats, fbm, noise3, hideBase, bx, slab, torus, shuriken, chainLinks, footTube, spiral, spiralH, armAxis, legAxis, kunaiParts, placeAlong, armAng } from './ninja_lib.js';

export function buildD1(scene, skin) {
  const C = skin;
  hideBase(scene, /Outfit_Top|Outfit_Bottom|Footwear|Beard/);
  const mats = [fabricMat('cloth', { scale: 9, bump: 0.16, rough: 0.78, sheenColor: 0x555a68 }), fabricMat('wool', { scale: 8, bump: 0.3, rough: 0.9, sheen: 0.8 }), fabricMat('leather', { scale: 5, bump: 0.25, cav: 0.22, sheen: 0.0, rough: 0.55 }), real('steel'), real('lacquer'), real('rope', { scale: 1.5 })];
  const kit = makeKit(scene, mats, 'ninja_gear');
  const { J, add, mirror } = kit;
  const fit = makeFit(scene, kit), head = headField(fit);
  const SL = { cloth: 0, wool: 1, leather: 2, steel: 3, lac: 4, rope: 5 };

  const cloth = fab(C.suit || 0x16161b, 0.11, 0.9), cloth2 = fab(C.suit2 || 0x2a2a33, 0.12, 0.9);
  const indigo = mixC(fab(C.wrap || 0x3e3e4a, 0.05, 0.8), 0x1d2a52, 0.55);
  const sashC = mixC(fab(C.sash || 0xb8202a, 0.0, 0.85), 0x1d1214, 0.5);
  const leatherC = fab(C.leather || 0x2c2420, 0.07, 0.9);
  const steelC = new THREE.Color(C.trim || 0x9a9aa6);
  const skinC = C.skin || 0xd9a583;

  // ---------------------------------------------------------------- head: zukin hood + face cloth
  const hoodC = shade(cloth, 1.0);
  const hood1 = hoodShell(kit, SL.cloth, head, {
    slit: { y0: 1.712, y1: 1.768, xw: 0.064 }, seed: 3,
    thick: (y, a) => 0.0065 + (y < 1.6 ? 0.009 * (1 - sstep(y, 1.53, 1.6)) : 0), color: () => hoodC,
  });
  // face cloth: a second layer from the neck up to the eye slit, wrapped round the head
  const hood2 = hoodShell(kit, SL.cloth, head, {
    yB: 1.54, yTop: 1.712, seed: 8, seg: 72,
    thick: (y, a) => 0.0125 + 0.003 * Math.sin(a * 3), color: () => shade(cloth2, 0.95),
  });


  // rolled hems along the eye slit
  for (const [y, hoodObj, off, r] of [[1.712, hood2, -0.0015, 0.0028], [1.768, hood1, -0.0015, 0.0024]]) {
    const pts = [], n = 28;
    for (let i = 0; i <= n; i++) { const t = i / n, a = Math.PI / 2 + (t - 0.5) * 2 * (y > 1.74 ? 1.02 : 1.1); pts.push(hoodObj.pt(y, a, off)); }
    tube(kit, SL.cloth, pts, () => r, () => 'Head', { seg: 8, up: V(0, 1, 0), color: shade(cloth, y > 1.74 ? 1.08 : 1.15), ao: 0.25, caps: true });
  }

  // ---------------------------------------------------------------- torso
  const T = torsoField([
    [0.84, 0.2, 0.15, 0.15, 0.012], [0.92, 0.19, 0.14, 0.14, 0.012], [1.02, 0.178, 0.128, 0.125, 0.012], [1.14, 0.158, 0.112, 0.112, 0.01],
    [1.26, 0.168, 0.118, 0.125, 0.004], [1.36, 0.185, 0.13, 0.13, -0.002], [1.44, 0.2, 0.12, 0.125, -0.01], [1.49, 0.195, 0.1, 0.105, -0.014],
    [1.525, 0.15, 0.088, 0.09, -0.014], [1.55, 0.105, 0.078, 0.08, -0.012], [1.57, 0.08, 0.07, 0.072, -0.010],
  ], 2.25);
  const E = 2 / 2.25;
  const angleAtX = (y, x) => { const hw = T.row(y)[0], q = clamp(Math.abs(x) / hw, 0, 0.999), a0 = Math.acos(Math.pow(q, 1 / E)); return x >= 0 ? a0 : Math.PI - a0; };
  const jacketF = (y, a) => pleats(y, a, 2, 9) * 0.0065 * sstep(y, 0.84, 1.0) * (1 - sstep(y, 1.1, 1.2)) + creases(y, a, 4, 10) * 0.0045 + 0.004 * Math.exp(-Math.pow((y - 1.17) / 0.05, 2)) * creases(y, a, 9, 22);
  const GROW = 0.006;
  const surfN = (y, a) => { const p = T.P(y, a, 0), q = T.P(y, a, 0.01); return q.sub(p).normalize(); };
  const ysT = span(0.84, 1.57, 0.012);
  const xE = (y) => -0.045 + 0.34 * (1.52 - y), xU = (y) => 0.05 - 0.55 * (1.52 - y); // over-panel edge, under-collar edge
  const yV = 1.52 - 0.095 / 0.89; // where the two collars cross
  clothTube(kit, SL.cloth, ysT.map((y) => V(0, y, T.cz(y))), (i, a) => T.rad(ysT[i], a, GROW), (i, a) => jacketF(ysT[i], a), (i) => torsoW(kit, ysT[i]), {
    seg: 64, up: V(0, 0, 1), color: cloth, ao: 0.25,
    colour: (i, k, p) => { // the shirt showing in the V of the neckline
      const y = p.y;
      if (y > yV && p.z > 0 && p.x > xE(y) - 0.004 && p.x < xU(y) + 0.004 && y < 1.57) return shade(cloth2, 0.8);
      return cloth;
    },
  });
  // right-over-left: the right front panel as a slightly raised layer ending in a diagonal edge
  {
    const ys = span(0.86, 1.525, 0.012), seg = 40, aEnd = Math.PI * 1.5;
    tube(kit, SL.cloth, ys.map((y) => V(0, y, T.cz(y))), (i, a, k) => {
      const y = ys[i], u = k / (seg - 1);
      const off = 0.0075 * sstep(u, 0.0, 0.05) * (1 - sstep(u, 0.7, 1.0)) + 0.0004;
      return T.rad(y, a, GROW + jacketF(y, a) + off);
    }, (i) => torsoW(kit, ys[i]), {
      seg, open: true, up: V(0, 0, 1), color: shade(cloth, 1.03), ao: 0.25,
      angle: (i, k) => { const a0 = angleAtX(ys[i], xE(ys[i])), u = k / (seg - 1); return a0 + (aEnd - a0) * u; },
    });
    // collar bands (eri) along both edges, stitched
    const edgePts = (xf, off, y0, y1, a2) => span(y0, y1, 0.02).map((y) => T.P(y, angleAtX(y, xf(y)), off + GROW + 0.0015));
    const mk = (xf, off, y0, y1, w, col) => {
      const ys2 = span(y0, y1, 0.02), pts = ys2.map((y) => T.P(y, angleAtX(y, xf(y)), off + GROW + jacketF(y, angleAtX(y, xf(y))) + 0.0015));
      const nr = ys2.map((y) => surfN(y, angleAtX(y, xf(y))));
      ribbon(kit, SL.cloth, pts, nr, w, 0.0045, (i, k, p) => torsoW(kit, p.y), { color: col, stitch: shade(col, 1.7), seg: 12 });
    };
    mk(xE, 0.0075, 0.9, 1.53, 0.034, cloth2);          // over collar
    mk(xU, 0.0, yV - 0.0, 1.55, 0.03, shade(cloth2, 0.9)); // under collar, ends where the panel covers it
  }

  // ---------------------------------------------------------------- arms: sleeves
  mirror((s) => {
    const A = s > 0 ? 'Left' : 'Right', ax = armAxis(kit, A);
    const ds = span(-0.03, ax.len - 0.02, 0.011);
    const pts = ds.map((d) => ax.at(d));
    clothTube(kit, SL.cloth, pts, (i) => keyed([[-0.03, 0.05], [0.05, 0.058], [0.28, 0.062], [0.4, 0.06], [0.52, 0.054]], ds[i]),
      (i, a) => creases(ds[i], a, 5 + s, 13) * 0.0065 * (0.6 + 1.4 * Math.exp(-Math.pow((ds[i] - ax.lenU) / 0.07, 2))) + 0.0025 * Math.sin(ds[i] * 70 + a) * Math.exp(-Math.pow((ds[i] - ax.len + 0.03) / 0.05, 2)),
      (i, k, p) => armW(kit, A, p), { seg: 22, up: V(0, 0, 1), color: cloth, ao: 0.25 });
  });

  // ---------------------------------------------------------------- legs: tapered trousers, kyahan wraps, tabi
  mirror((s) => {
    const A = s > 0 ? 'Left' : 'Right', lg = legAxis(kit, A), an = J(A + 'Foot');
    const ys = span(1.05, 0.46, 0.011);
    clothTube(kit, SL.cloth, ys.map((y) => lg.at(y)), (i) => keyed([[0.46, 0.066], [0.5, 0.084], [0.56, 0.082], [0.66, 0.09], [0.8, 0.101], [0.95, 0.106], [1.05, 0.106]], ys[i]) - (ys[i] < 0.5 ? 0.004 : 0),
      (i, a) => { const y = ys[i], gather = Math.exp(-Math.pow((y - 0.5) / 0.05, 2)); return pleats(y, a, 11 + s, 8) * 0.0065 + creases(y, a, 3, 14) * 0.0045 + gather * 0.006 * Math.sin(a * 9 + y * 40) + 0.006 * Math.exp(-Math.pow((y - 0.6) / 0.06, 2)) * creases(y, a, 6 + s, 20); },
      (i, k, p) => legW(kit, A, p), { seg: 28, up: V(0, 0, 1), color: cloth, ao: 0.25 });
    // knee gather: a soft bulge of cloth where the trouser leg bends
    // kyahan: spiral-wound indigo strips from under the knee to the ankle
    const yw = span(0.52, 0.085, 0.004);
    tube(kit, SL.wool, yw.map((y) => lg.at(y)), (i, a) => {
      const y = yw[i], base = keyed([[0.085, 0.05], [0.12, 0.05], [0.2, 0.049], [0.3, 0.056], [0.42, 0.063], [0.52, 0.066]], y);
      const u = 0.52 - y + 0.006 * fbm(a, y * 9, s), ph = spiral(u, a, 0.04, 1);
      return base + spiralH(ph, 0.0065 * (0.8 + 0.5 * noise3(u * 30, 0.5, s))) + fbm(a * 2, y * 30, s) * 0.0015;
    }, (i, k, p) => legW(kit, A, p), { seg: 36, up: V(0, 0, 1), color: indigo, ao: 0.3,
      colour: (i, k, p) => { const y = yw[i], a = (k / 36) * Math.PI * 2, ph = spiral(0.52 - y + 0.006 * fbm(a, y * 9, s), a, 0.04, 1); return shade(indigo, 0.8 + 0.45 * ph * ph); } });
    // ties: cords at the ankle and under the knee
    for (const [y, r] of [[0.14, 0.058], [0.455, 0.075]]) {
      const c = lg.at(y);
      add(SL.rope, torus(V(c.x, y, c.z), r, 0.0032, V(0, 1, 0), 22, 5), A + (y > 0.4 ? 'Leg' : 'Foot'), mixC(indigo, 0x5a5a6a, 0.3), 0.2);
    }
    // tabi: split-toe cloth shoe with a flat sole
    const zs = span(-0.108, 0.208, 0.008);
    const sec = (z) => ({
      yc: keyed([[-0.108, 0.056], [-0.08, 0.062], [-0.04, 0.07], [0, 0.066], [0.05, 0.05], [0.1, 0.037], [0.15, 0.03], [0.19, 0.027], [0.208, 0.025]], z),
      h: keyed([[-0.108, 0.04], [-0.08, 0.056], [-0.04, 0.066], [0, 0.058], [0.05, 0.042], [0.1, 0.03], [0.15, 0.022], [0.19, 0.016], [0.208, 0.006]], z) ,
      w: keyed([[-0.108, 0.03], [-0.08, 0.04], [-0.04, 0.043], [0, 0.046], [0.05, 0.05], [0.1, 0.053], [0.15, 0.05], [0.19, 0.035], [0.208, 0.012]], z), n: 2.6,
    });
    const medial = A === 'Left' ? -0.25 : 0.25;
    footTube(kit, SL.cloth, A, (z) => { const q = sec(z); return { ...q, yc: q.yc + 0.003, h: q.h - 0.0 }; }, zs, shade(cloth, 1.05), { seg: 28, colour: (i, k, p) => { const a = (k / 28) * Math.PI * 2; return shade(cloth, 1 + 0.08 * Math.sin(p.z * 60)); } });
    footTube(kit, SL.leather, A, (z) => { const q = sec(z); return { yc: 0.007, h: 0.0075, w: q.w + 0.004, n: 3.5 }; }, zs.slice(0, -1).concat([0.206]), new THREE.Color(0x1c1a1c), { seg: 24 });
    // ankle cuff of the tabi up under the wraps
    const ay = span(0.045, 0.16, 0.012);
    tube(kit, SL.cloth, ay.map((y) => V(an.x + (lg.at(y).x - an.x) * 0.0 + 0, y, an.z + (y - 0.126) * 0.08)), (i, a) => 0.047 - 0.0005 * i, () => A + 'Foot', { seg: 20, up: V(0, 0, 1), color: cloth, ao: 0.3 });
    // kohaze clasps down the back of the ankle
    for (let q = 0; q < 3; q++) add(SL.steel, slab(V(an.x, 0.07 + q * 0.018, an.z - 0.049 - 0.002 * q), [0.007, 0.0045, 0.0018], 0.0008), A + 'Foot', steelC, 0.1);
  });

  // ---------------------------------------------------------------- obi: two turns of sash, a knot and two tails
  {
    const N = 72;
    const loop = (yc, tilt, wid, thick, col, seed) => {
      const pts = [], nr = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2, y = yc + tilt * Math.sin(a - Math.PI / 2 + seed) + 0.003 * fbm(Math.cos(a) * 2 + seed, 0, Math.sin(a) * 2);
        const off = GROW + jacketF(y, a) + thick * 0.5 - 0.0005;
        pts.push(T.P(y, a, off)); nr.push(V(0, 1, 0));
      }
      tube(kit, SL.wool, pts, (i, a, k) => {
        const e = 0.5, c = Math.cos(a), sn = Math.sin(a), f = fbm(i * 0.31 + seed, k * 0.7, seed) * 0.0016;
        return [thick / 2 * Math.pow(Math.max(Math.abs(c), 1e-3), e - 1) + f, wid / 2 * Math.pow(Math.max(Math.abs(sn), 1e-3), e - 1) + f];
      }, (i, k, p) => torsoW(kit, p.y), { seg: 14, closed: true, up: V(0, 1, 0), color: col, ao: 0.3,
        colour: (i, k) => shade(col, 1 + (k % 14 === 3 || k % 14 === 4 ? 0.12 : 0)) });
    };
    loop(1.075, 0.008, 0.062, 0.016, sashC, 1);
    loop(1.135, -0.01, 0.068, 0.018, shade(sashC, 1.06), 2);
    // knot at the left front hip
    const ka = 0.62, kp = T.P(1.1, ka, 0.03), kn = surfN(1.1, ka);
    add(SL.wool, ell(kp.clone(), [0.036, 0.034, 0.024], [0.3, -0.5, 0.2], 14), 'Hips', shade(sashC, 0.95), 0.35);
    add(SL.wool, ell(kp.clone().add(V(0.012, 0.012, 0.014)), [0.024, 0.02, 0.016], [0.1, -0.7, 0.5], 12), 'Hips', shade(sashC, 1.08), 0.35);
    // tails
    for (const [dx, len, sw] of [[0.02, 0.36, 0.05], [-0.015, 0.27, -0.03]]) {
      const tp = [], tn = [];
      const n = 14;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), y = 1.1 - len * t;
        const a = ka + 0.1 + dx * 4 + 0.12 * t;
        const base = T.P(Math.max(y, 0.86), a, GROW + 0.02 + 0.01 * t + 0.02 * Math.sin(t * 3 + sw * 10) * t);
        tp.push(V(base.x + sw * t + 0.01 * Math.sin(t * 9) * t, y, base.z + 0.018 * t)); tn.push(V(0.2, 0.2, 0.96).normalize());
      }
      ribbon(kit, SL.wool, tp, tn, (i) => 0.048 * (1 - 0.12 * (i / n)), 0.007, (i, k, p) => { const w = sstep(0.95 - p.y, 0.05, 0.2) * 0.55; return [['Hips', 1 - w], ['LeftUpLeg', w]]; },
        { color: shade(sashC, 0.97), fold: (i, a) => 0.0015 * Math.sin(i * 0.9 + a * 2), seg: 10 });
    }
  }

  // ---------------------------------------------------------------- hood details: headband, back knot, hems
  {
    const yb = 1.783, hsh = head;
    const N = 64, pts = [], nr = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2, y = yb + 0.007 * Math.sin(a - Math.PI * 1.5) * -1;
      const r = hsh.R(y, a) + 0.0065 + 0.004;
      pts.push(V(Math.cos(a) * r, y, hsh.cz + Math.sin(a) * r)); nr.push(V(0, 1, 0));
    }
    tube(kit, SL.wool, pts, (i, a, k) => {
      const e = 0.5, c = Math.cos(a), sn = Math.sin(a), f = fbm(i * 0.4, k * 0.5, 3) * 0.0012;
      return [0.0038 * Math.pow(Math.max(Math.abs(c), 1e-3), e - 1) + f, 0.016 * Math.pow(Math.max(Math.abs(sn), 1e-3), e - 1) + f];
    }, () => 'Head', { seg: 12, closed: true, up: V(0, 1, 0), color: indigo, ao: 0.28 });
    // knot and tails at the back of the head
    const kp = V(0.004, yb - 0.002, hsh.cz - hsh.R(yb, Math.PI * 1.5) - 0.018);
    add(SL.wool, ell(kp, [0.022, 0.017, 0.016], [0.2, 0, 0.3], 12), 'Head', indigo, 0.35);
    add(SL.wool, ell(kp.clone().add(V(-0.012, -0.004, -0.004)), [0.014, 0.012, 0.011], [0, 0.5, 0], 10), 'Head', shade(indigo, 1.1), 0.35);
    for (const [sx, ex, ez, ln] of [[1, 0.05, -0.19, 0.2], [-1, -0.035, -0.215, 0.26]]) {
      const tp = [], tn = [], n = 12;
      for (let i = 0; i < n; i++) { const t = i / (n - 1); tp.push(V(kp.x + sx * 0.012 * (1 - t) + ex * t * t * 0.9 + 0.008 * Math.sin(t * 7 + sx), kp.y - ln * t * 0.62, kp.z - 0.02 * t - (-0.19 - ez) * 0 + ez * 0.12 * t * t + 0.01 * Math.sin(t * 5 + sx))); tn.push(V(0, 0.2, -1).normalize()); }
      ribbon(kit, SL.wool, tp, tn, (i) => 0.026 * (1 - 0.15 * i / n), 0.004, () => 'Head', { color: shade(indigo, 1.05), fold: (i, a) => 0.001 * Math.sin(i * 1.3 + a * 2), seg: 8 });
    }
  }

  // ---------------------------------------------------------------- ninjato on the back with a chest strap and cord
  {
    const A = V(0.14, 0.88, -0.166), B = V(-0.075, 1.545, -0.168), Cc = V(-0.115, 1.775, -0.172);
    const ax = B.clone().sub(A), L1 = ax.length(); ax.normalize();
    const pt = (t) => A.clone().lerp(B, t);
    // saya (lacquered scabbard)
    const ts = span(0, 1, 0.02);
    tube(kit, SL.lac, ts.map(pt), (i, a) => { const t = ts[i]; return [0.0185 - 0.003 * (1 - t) * 0.6, 0.0135 - 0.002 * (1 - t) * 0.6]; }, () => 'Spine2',
      { seg: 14, up: V(0, 0, 1), color: new THREE.Color(0x15151a), ao: 0.15, caps: true });
    // fittings: kojiri, koiguchi, kurigata
    const tAt = (t) => ({ p: pt(t) });
    add(SL.steel, ell(pt(0.0), [0.02, 0.016, 0.016], null, 10), 'Spine2', steelC, 0.1);
    add(SL.steel, limb(pt(0.955), pt(1.0), 0.0215, 0.0155, 0.0215, 0.0155, V(0, 0, 1), 0.7), 'Spine2', steelC, 0.1);
    add(SL.steel, ell(pt(0.22).add(V(0.012, 0, 0.012)), [0.008, 0.016, 0.006], null, 8), 'Spine2', shade(steelC, 0.8), 0.1);
    // hilt (tsuka) with a diamond ito wrap
    const hs = span(0, 1, 0.012), H0 = B.clone().add(ax.clone().multiplyScalar(0.012)), H1 = Cc;
    const hp = (t) => H0.clone().lerp(H1, t), hlen = H0.distanceTo(H1);
    tube(kit, SL.rope, hs.map(hp), (i, a) => {
      const t = hs[i], u = t * hlen, p1 = (u / 0.04 + a / (Math.PI * 2)) * Math.PI * 2, p2 = (u / 0.04 - a / (Math.PI * 2)) * Math.PI * 2;
      const lat = Math.max(Math.pow(Math.abs(Math.sin(p1 * 0.5)), 3), Math.pow(Math.abs(Math.sin(p2 * 0.5)), 3));
      return [0.0128 + 0.0014 * lat, 0.0108 + 0.0014 * lat];
    }, () => 'Spine2', { seg: 20, up: V(0, 0, 1), ao: 0.2, caps: true,
      colour: (i, k, p) => { const t = hs[i], u = t * hlen, a = (k / 20) * Math.PI * 2, p1 = (u / 0.04 + a / (Math.PI * 2)) * Math.PI * 2, p2 = (u / 0.04 - a / (Math.PI * 2)) * Math.PI * 2; const lat = Math.max(Math.pow(Math.abs(Math.sin(p1 * 0.5)), 3), Math.pow(Math.abs(Math.sin(p2 * 0.5)), 3)); return lat > 0.5 ? indigo : mixC(indigo, 0xd8d0be, 0.5); } });
    // tsuba: a squared guard with a slot, tilted to the blade
    {
      const g = new THREE.Shape(), w = 0.042, r = 0.01;
      g.moveTo(-w + r, -w); g.lineTo(w - r, -w); g.quadraticCurveTo(w, -w, w, -w + r); g.lineTo(w, w - r); g.quadraticCurveTo(w, w, w - r, w); g.lineTo(-w + r, w); g.quadraticCurveTo(-w, w, -w, w - r); g.lineTo(-w, -w + r); g.quadraticCurveTo(-w, -w, -w + r, -w);
      const hole = new THREE.Path(); hole.moveTo(-0.017, -0.0085); hole.lineTo(0.017, -0.0085); hole.lineTo(0.017, 0.0085); hole.lineTo(-0.017, 0.0085); hole.lineTo(-0.017, -0.0085); g.holes.push(hole);
      const eg = new THREE.ExtrudeGeometry(g, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1 });
      eg.translate(0, 0, -0.002);
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), ax);
      eg.applyMatrix4(new THREE.Matrix4().compose(B.clone().add(ax.clone().multiplyScalar(0.01)), q, V(1, 1, 1)));
      add(SL.steel, eg, 'Spine2', shade(steelC, 0.7), 0.1);
    }
    add(SL.steel, ell(H1.clone().add(ax.clone().multiplyScalar(0.006)), [0.0165, 0.012, 0.0135], null, 10), 'Spine2', steelC, 0.1); // kashira
    add(SL.steel, limb(H0.clone().add(ax.clone().multiplyScalar(-0.012)), H0.clone().add(ax.clone().multiplyScalar(0.012)), 0.0165, 0.0135, 0.0165, 0.0135, V(0, 0, 1), 0.7), 'Spine2', steelC, 0.1); // fuchi
    // strap across the chest: from a collar on the scabbard over the right shoulder, down across the chest to the left hip and back round
    {
      const pts = [], nr = [];
      const put = (y, a, off) => { pts.push(T.P(y, a, off + GROW + 0.0075 + 0.012)); nr.push(surfN(y, a)); };
      const saya = (t) => { const p = pt(t); pts.push(p.clone().add(V(0, 0, 0.0)).add(V(0.0, 0, 0.0))); nr.push(V(0, 0.2, 1).normalize()); };
      pts.push(pt(0.8).add(V(0.0, 0, 0.02))); nr.push(V(0, 0, -1));
      for (const [x, y, z] of [[-0.1, 1.49, -0.122], [-0.118, 1.54, -0.06], [-0.118, 1.553, 0.0], [-0.11, 1.535, 0.055]]) { pts.push(V(x, y, z)); nr.push(V(-0.3, 1, 0).normalize()); }
      for (const [y, x] of [[1.47, -0.075], [1.42, -0.05], [1.32, -0.0], [1.22, 0.06], [1.12, 0.12], [1.04, 0.17]]) { const a = angleAtX(y, x); put(y, a, 0.0); }
      put(0.985, 0.12, 0); put(0.97, -0.55, 0); put(0.975, -1.2, 0);
      pts.push(pt(0.14).add(V(0.0, 0, 0.02))); nr.push(V(0, 0, -1));
      const cu = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5), N = 110;
      const sp = [], sn = [];
      for (let i = 0; i <= N; i++) { const p = cu.getPoint(i / N); sp.push(p); const c = V(0, p.y, T.cz(p.y)); const nn = p.clone().sub(c).setY(0).normalize(); sn.push(p.z < -0.14 && Math.abs(p.x) < 0.2 ? V(0, 0, -1) : nn); }
      ribbon(kit, SL.leather, sp, sn, 0.034, 0.008, (i, k, p) => torsoW(kit, p.y), { color: leatherC, stitch: shade(leatherC, 1.9), seg: 12 });
      // buckle on the chest
      const bp = cu.getPoint(0.42);
      { const g = torus(V(0, 0, 0), 0.015, 0.0022, V(0, 0.15, 1), 4, 4, 1, 0.9).rotateZ(Math.PI / 4); g.translate(bp.x, bp.y, bp.z + 0.006); add(SL.steel, g, 'Spine2', steelC, 0.1); }
      // leather collars round the scabbard where the strap hooks on
      for (const t of [0.14, 0.8]) {
        const c = pt(t);
        tube(kit, SL.leather, [c.clone().addScaledVector(ax, -0.016), c.clone().addScaledVector(ax, 0.016)], () => [0.0205, 0.0155], () => 'Spine2', { seg: 14, up: V(0, 0, 1), color: leatherC, ao: 0.3, caps: false });
        add(SL.steel, slab(c.clone().add(V(0, 0, 0.016)), [0.006, 0.01, 0.003], 0.001), 'Spine2', steelC, 0.1);
      }
    }
    // sageo: the long cord from the scabbard, looped and knotted, hanging at the left hip
    {
      const k0 = pt(0.22).add(V(0.014, 0, 0.01));
      const cu = new THREE.CatmullRomCurve3([k0, V(0.2, 1.0, -0.19), V(0.215, 0.93, -0.12), V(0.225, 0.86, -0.02), V(0.21, 0.78, 0.04), V(0.205, 0.7, 0.06)]);
      const n = 34, ps = [];
      for (let i = 0; i <= n; i++) ps.push(cu.getPoint(i / n));
      tube(kit, SL.rope, ps, () => 0.0042, (i, k, p) => { const w = sstep(1.05 - p.y, 0.05, 0.3) * 0.5; return [['Spine2', 1 - w * 0.6], ['Hips', w * 0.6]]; }, { seg: 7, up: V(0, 0, 1), color: mixC(indigo, 0x3a3a46, 0.3), ao: 0.2, caps: true });
      add(SL.rope, ell(ps[n].clone(), [0.009, 0.02, 0.009], null, 8), 'Hips', mixC(indigo, 0x3a3a46, 0.3), 0.2);
    }
  }

  // ---------------------------------------------------------------- forearms: tekko guards and hand wraps
  mirror((s) => {
    const A = s > 0 ? 'Left' : 'Right', ax = armAxis(kit, A);
    const sleeveR = (d) => keyed([[-0.03, 0.05], [0.05, 0.058], [0.28, 0.062], [0.4, 0.06], [0.52, 0.054]], d);
    // leather bracer under the plates
    const d0 = 0.31, d1 = 0.505, ds = span(d0, d1, 0.008);
    tube(kit, SL.leather, ds.map((d) => ax.at(d)), (i, a) => {
      const d = ds[i], end = Math.min(sstep(d, d0, d0 + 0.012), 1 - sstep(d, d1 - 0.012, d1));
      return sleeveR(d) + 0.0035 + 0.003 * end + 0.0008 * fbm(a * 3, d * 40, s);
    }, (i, k, p) => armW(kit, A, p), { seg: 20, up: V(0, 0, 1), color: leatherC, ao: 0.3 });
    // five iron splints on the back of the forearm, lashed with cord
    const plates = [[0.325, 0.375], [0.38, 0.425], [0.43, 0.47], [0.475, 0.505]];
    for (const [pa, pb] of plates) {
      const dd = span(pa, pb, (pb - pa) / 5), seg = 10;
      tube(kit, SL.steel, dd.map((d) => ax.at(d)), (i, a, k) => {
        const d = dd[i], t = (d - pa) / (pb - pa), round = 0.0018 * Math.sqrt(Math.max(0, 1 - Math.pow(2 * t - 1, 6)));
        return sleeveR(d) + 0.0055 + round;
      }, (i, k, p) => armW(kit, A, p), {
        seg, open: true, up: V(0, 0, 1), color: shade(steelC, 0.55), ao: 0.2,
        angle: (i, k) => armAng(s, Math.PI - 0.62 + (k / (seg - 1)) * 1.24),
      });
    }
    // cord lacing along both edges of the splints
    for (const sgn of [-1, 1]) {
      const dd = span(0.32, 0.51, 0.006);
      tube(kit, SL.rope, dd.map((d) => { const a = Math.PI + sgn * 0.7, r = sleeveR(d) + 0.0095, c = ax.at(d); return V(c.x, c.y - Math.cos(a) * r, c.z + Math.sin(a) * r); }), () => 0.0022, (i, k, p) => armW(kit, A, p), { seg: 6, up: V(0, 0, 1), color: mixC(indigo, 0x6a6a7a, 0.3), ao: 0.2 });
    }
    // buckled straps round the bracer
    for (const d of [0.335, 0.495]) {
      const c = ax.at(d), r = sleeveR(d) + 0.0075;
      add(SL.leather, torus(V(c.x, c.y, c.z), r, 0.0034, V(1, 0, 0), 20, 5, 1, 1), A + 'ForeArm', shade(leatherC, 0.9), 0.3);
      add(SL.steel, slab(V(c.x, c.y + r + 0.003, c.z), [0.005, 0.0022, 0.0075], 0.0007), A + 'ForeArm', steelC, 0.1);
    }
    // hand wrap: spiral cloth over the wrist and back of the hand, fingers free
    const hx = ax.sh.x, wrx = ax.wr.x, hc = (x) => V(x, ax.wr.y - 0.006, ax.wr.z - 0.007);
    const xs = span(0, 0.108, 0.004), sgn = s;
    tube(kit, SL.wool, xs.map((u) => hc(wrx - s * 0.02 + s * u)), (i, a) => {
      const u = xs[i], ph = spiral(u, a, 0.026, 1), base = keyed([[0, 0.034], [0.03, 0.036], [0.108, 0.034]], u);
      const e = Math.min(sstep(u, 0, 0.01), 1 - sstep(u, 0.1, 0.108));
      return [base * 0.85 + spiralH(ph, 0.0035) * e + 0.002, base * 1.28 + spiralH(ph, 0.0035) * e + 0.002];
    }, (i, k, p) => armW(kit, A, p), { seg: 22, up: V(0, 0, 1), color: indigo, ao: 0.3, caps: false,
      colour: (i, k) => { const u = xs[i], a = (k / 22) * Math.PI * 2, ph = spiral(u, a, 0.026, 1); return shade(indigo, 0.85 + 0.35 * ph * ph); } });
    // knuckle plate (tekko-kogai) with a finger loop
    {
      const g = tube(kit, SL.steel, span(0, 0.052, 0.01).map((u) => hc(wrx + s * (0.035 + u))), (i, a) => [0.0268 + 0.0025, 0.0405 + 0.0025 - 0.003 * (i / 5)], (i, k, p) => A + 'Hand', {
        seg: 8, open: true, up: V(0, 0, 1), color: shade(steelC, 0.55), ao: 0.2, angle: (i, k) => armAng(s, Math.PI - 0.7 + (k / 7) * 1.4) });
      add(SL.rope, torus(V(wrx + s * 0.1, ax.wr.y - 0.006, ax.wr.z - 0.04), 0.011, 0.0022, V(1, 0, 0), 12, 5), A + 'Hand', indigo, 0.2);
    }
  });

  // ---------------------------------------------------------------- belt gear: shuriken pouch, kunai, chain
  {
    const yaw = (n) => Math.atan2(n.x, n.z);
    // pouch on the right hip, hung from the sash by a leather loop
    const a = Math.PI - 0.62, pp = T.P(1.0, a, GROW + 0.036), pn = surfN(1.0, a), ya = yaw(pn);
    add(SL.leather, slab(pp, [0.037, 0.047, 0.02], 0.007, [0, ya, 0]), 'Hips', leatherC, 0.3);
    const fp = pp.clone().add(pn.clone().multiplyScalar(0.0205)).add(V(0, 0.022, 0));
    add(SL.leather, slab(fp, [0.039, 0.027, 0.004], 0.0025, [0.12, ya, 0]), 'Hips', shade(leatherC, 1.08), 0.3);
    const bp = pp.clone().add(pn.clone().multiplyScalar(0.0265)).add(V(0, -0.006, 0));
    add(SL.steel, slab(bp, [0.007, 0.0095, 0.0022], 0.0008, [0, ya, 0]), 'Hips', steelC, 0.1);
    // belt loop strap
    const lp = T.P(1.06, a, GROW + 0.012), ln = surfN(1.06, a);
    ribbon(kit, SL.leather, [T.P(1.115, a, GROW + 0.019), T.P(1.07, a, GROW + 0.034), T.P(1.04, a, GROW + 0.041)], [ln, ln, ln], 0.02, 0.004, () => 'Hips', { color: leatherC, stitch: shade(leatherC, 1.8), seg: 10 });
    // two shuriken peeking out of the flap side
    for (const [dx, dy, r] of [[0.01, 0.03, 0.4], [-0.012, 0.026, -0.3]]) {
      const g = shuriken(0.024, 0.002); g.rotateZ(r); g.rotateY(ya + 0.15); g.translate(pp.x + pn.x * 0.012 + Math.cos(ya) * dx, pp.y + 0.052 + dy * 0.2, pp.z + pn.z * 0.012 - Math.sin(ya) * dx);
      add(SL.steel, g, 'Hips', steelC, 0.1);
    }
    // two kunai crossed across the small of the back, hilt rings at the sides
    for (const sx of [1, -1]) {
      const pos = T.P(0.965, Math.PI * 1.5 + sx * 0.12, GROW + 0.02), dir = V(-sx * 0.9, 0.26, 0).add(V(0, 0, -0.05));
      for (const part of kunaiParts(0.2, 0.03)) {
        const g = placeAlong(part.geo.clone(), pos, dir.clone().setY(0.26 * sx).normalize(), 0);
        add(part.kind === 'steel' ? SL.steel : SL.rope, g, 'Hips', part.kind === 'steel' ? steelC : indigo, 0.15);
      }
    }
    // kusari chain hung from the sash at the left hip, with an iron weight
    {
      const cu = new THREE.CatmullRomCurve3([V(0.19, 1.085, -0.06), V(0.205, 1.02, -0.09), V(0.2, 0.955, -0.115), V(0.17, 0.915, -0.13), V(0.14, 0.935, -0.14)]);
      add(SL.steel, torus(V(0.19, 1.09, -0.06), 0.014, 0.0028, V(0.6, 0, 0.8), 12, 5), 'Hips', steelC, 0.1);
      for (const g of chainLinks(cu, 16, 0.017, 0.0105, 0.0028)) add(SL.steel, g, 'Hips', shade(steelC, 0.8), 0.15);
      const e = cu.getPoint(1);
      add(SL.steel, limb(e.clone().add(V(0, 0.0, 0.0)), e.clone().add(V(-0.01, 0.045, 0.01)), 0.012, 0.012, 0.014, 0.014, V(0, 0, 1), 0.8), 'Hips', shade(steelC, 0.45), 0.2);
    }
  }

  // ---------------------------------------------------------------- seams, hems and the tied face cloth
  {
    const seamBind = (i, k, p) => torsoW(kit, p.y);
    const seamC = shade(cloth, 1.45);
    // hem roll round the skirt, and a double stitch line above it
    for (const [y, w, th, col] of [[0.845, 0.01, 0.007, shade(cloth, 1.05)], [0.88, 0.003, 0.002, seamC]]) {
      const N = 80, pts = [], nr = [];
      for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; pts.push(T.P(y, a, GROW + jacketF(y, a) + th * 0.5 + 0.0005)); nr.push(surfN(y, a)); }
      ribbon(kit, SL.cloth, pts, nr, w, th, seamBind, { closed: true, color: col, seg: 8 });
    }
    // centre-back seam and side seams (raised stitch lines)
    for (const a of [Math.PI * 1.5, 0.02, Math.PI - 0.02]) {
      const ys2 = span(0.9, 1.5, 0.02), pts = ys2.map((y) => T.P(y, a, GROW + jacketF(y, a) + 0.0016)), nr = ys2.map((y) => surfN(y, a));
      ribbon(kit, SL.cloth, pts, nr, 0.0045, 0.0022, seamBind, { color: seamC, stitch: shade(seamC, 1.3), seg: 8 });
    }
    // sleeve seams and cuff hems
    mirror((s) => {
      const A = s > 0 ? 'Left' : 'Right', ax = armAxis(kit, A);
      const ds = span(0.03, 0.51, 0.02);
      const sR = (d) => keyed([[-0.03, 0.05], [0.05, 0.058], [0.28, 0.062], [0.4, 0.06], [0.52, 0.054]], d);
      const pts = ds.map((d) => { const c = ax.at(d); return V(c.x, c.y - sR(d) - 0.0018, c.z); });
      ribbon(kit, SL.cloth, pts, ds.map(() => V(0, -1, 0)), 0.0045, 0.0022, (i, k, p) => armW(kit, A, p), { color: seamC, stitch: shade(seamC, 1.3), seg: 8 });
    });
    // face cloth: diagonal wrap folds and a knot with two tails at the back of the head
    const hs = head, yk = 1.665;
    for (const sgn of [1, -1]) {
      const pts = [], nr = [];
      for (let i = 0; i <= 18; i++) {
        const t = i / 18, a = Math.PI / 2 + sgn * (-1.0 + 2.2 * t), y = 1.612 + 0.092 * t * (sgn > 0 ? 1 : 0.8) + 0.0 - 0.012 * Math.sin(t * Math.PI);
        const r = hs.R(y, a) + 0.0125 + 0.0075;
        pts.push(V(Math.cos(a) * r, y, hs.cz + Math.sin(a) * r)); nr.push(V(Math.cos(a), 0.2, Math.sin(a)).normalize());
      }
      ribbon(kit, SL.cloth, pts, nr, 0.028, 0.005, () => 'Head', { color: shade(cloth2, 1.02), fold: (i, a) => 0.0012 * Math.sin(i * 1.1 + a * 2), stitch: null, seg: 10 });
    }
    {
      const kp = V(-0.008, yk, hs.cz - hs.R(yk, Math.PI * 1.5) - 0.02);
      add(SL.cloth, ell(kp, [0.02, 0.016, 0.015], [0.2, 0.2, 0.2], 12), 'Head', shade(cloth2, 0.95), 0.35);
      for (const [sx, ln] of [[1, 0.16], [-1, 0.2]]) {
        const tp = [], tn = [], n = 10;
        for (let i = 0; i < n; i++) { const t = i / (n - 1); tp.push(V(kp.x + sx * (0.012 + 0.03 * t), kp.y - ln * t * 0.8, kp.z - 0.015 * t - 0.028 * Math.sin(t * 2.2) * 0.4 + 0.01 * Math.sin(t * 6 + sx))); tn.push(V(0, 0.1, -1).normalize()); }
        ribbon(kit, SL.cloth, tp, tn, (i) => 0.024 * (1 - 0.2 * i / n), 0.0045, () => ['Head'], { color: shade(cloth2, 1.0), fold: (i, a) => 0.001 * Math.sin(i * 1.3 + a * 2 + sx), seg: 8 });
      }
    }
  }
  return kit.finish();
}
