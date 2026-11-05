// Design 3: the wanderer. A deep green-black cowled half-cloak with a tattered hem over a laced wool tunic, a cowl that shadows the
// eyes above a wrapped face scarf with a trailing tail, long leather bracers, a curved blade at the hip, a satchel and a dagger,
// knee-high weathered leather boots with folded cuffs.
import * as THREE from 'three';
import { makeKit, V, ell, limb } from './armor.js';
import { real } from './realmat.js';
import { clothTube, fabricMat, makeFit, headField, hoodShell, tube, ribbon, torsoField, torsoW, armW, legW, fab, mixC, shade, sstep, clamp, keyed, span, creases, pleats, fbm, noise3, hideBase, bx, slab, torus, shuriken, chainLinks, footTube, spiral, spiralH, armAxis, legAxis, kunaiParts, placeAlong, bandAround, armAng, meshByName } from './ninja_lib.js';

export function buildD3(scene, skin) {
  const C = skin;
  hideBase(scene, /Outfit_Top|Outfit_Bottom|Footwear|Beard/);
  const mats = [
    fabricMat('wool', { scale: 4, bump: 0.18, rough: 0.95, sheen: 0.45, sheenColor: 0x3a4a40, tag: 'd3' }),
    fabricMat('cloth', { scale: 9, bump: 0.2, rough: 0.85, sheen: 0.4, sheenColor: 0x3c4038, tag: 'd3' }),
    fabricMat('leather', { scale: 3, bump: 0.12, cav: 0.12, sheen: 0, rough: 0.62, tag: 'd3' }),
    fabricMat('steel', { metal: 0.85, rough: 0.5, sheen: 0, tag: 'd3' }),
    real('rope', { scale: 1.5 }),
    fabricMat('felt', { scale: 3, bump: 0.5, rough: 1.0, sheen: 0.3, tag: 'd3' }),
  ];
  const kit = makeKit(scene, mats, 'ninja_gear');
  const { J, add, mirror } = kit;
  const fit = makeFit(scene, kit), head = headField(fit);
  const SL = { wool: 0, cloth: 1, leather: 2, steel: 3, rope: 4, felt: 5 };

  // a weathered, shadowed skin tone (the cowl throws no real shadow, so the face and hands are dimmed a little)
  scene.traverse((o) => {
    if (o.isSkinnedMesh && /Wolf3D_Head|Wolf3D_Body/.test(o.name)) { const m = o.material.clone(); m.color = m.color.clone().multiplyScalar(0.78); o.material = m; }
  });

  const green = new THREE.Color(0x1d3025);
  const cloak = mixC(mixC(fab(C.suit || 0x16161b, 0.1, 0.9), green, 0.62), fab(C.wrap || 0x3e3e4a, 0.05, 0.8), 0.1);
  const cloakDust = mixC(cloak, 0x4d4636, 0.35);
  const tunic = mixC(fab(C.suit2 || 0x2a2a33, 0.1, 0.9), 0x2a2c20, 0.55);
  const leatherC = mixC(fab(C.leather || 0x2c2420, 0.07, 0.9), 0x4a3524, 0.55);
  const leatherD = shade(leatherC, 0.72);
  const scarfC = mixC(fab(C.sash || 0xb8202a, 0.0, 0.8), 0x57533c, 0.86);
  const steelC = shade(new THREE.Color(C.trim || 0x9a9aa6), 0.75);
  const brass = new THREE.Color(0x8a6c36);

  // ---------------------------------------------------------------- head: deep cowl, shadowed eye opening, wrapped scarf
  const cowl = hoodShell(kit, SL.wool, head, {
    yB: 1.52, slit: { y0: 1.702, y1: 1.768, xw: 0.066 }, seed: 11, foldAmt: 1.8, apex: 1.9, arch: 0,
    thick: (y, a) => {
      const sa = Math.sin(a), back = Math.max(0, -sa), front = Math.max(0, sa);
      const puff = sstep(y, 1.6, 1.74) * (1 - sstep(y, 1.84, 1.9)) * Math.pow(back, 1.2) * 0.058;
      const brim = sstep(y, 1.775, 1.8) * (1 - sstep(y, 1.84, 1.87)) * Math.pow(front, 1.5) * 0.02;
      const crown = sstep(y, 1.74, 1.84) * 0.02;
      const side = Math.pow(Math.abs(Math.cos(a)), 1.5) * sstep(y, 1.6, 1.7) * 0.02 * (1 - sstep(y, 1.84, 1.9));
      if (y < 1.7) return 0.0085 + 0.012 * (1 - sstep(y, 1.52, 1.6));
      return 0.012 + puff + brim + crown + side;
    },
    color: (y, p) => shade(cloak, 1.0 + 0.1 * sstep(y, 1.7, 1.85)),
  });
  const scarf = hoodShell(kit, SL.cloth, head, { yB: 1.55, yTop: 1.702, seed: 4, seg: 72, foldAmt: 2.2, thick: (y, a) => 0.0215 + 0.006 * Math.sin(a * 2 + y * 28) + 0.005 * Math.sin(a * 5), color: () => scarfC });
  // rolled edge of the cowl round the eye opening, and of the scarf's top edge
  for (const [y, h, off, r, col] of [[1.702, scarf, -0.002, 0.0055, shade(scarfC, 1.18)], [1.768, cowl, -0.002, 0.0075, shade(cloak, 1.25)]]) {
    const pts = [], n = 32;
    for (let i = 0; i <= n; i++) { const t = i / n, a = Math.PI / 2 + (t - 0.5) * 2 * 1.08; pts.push(h.pt(y, a, off)); }
    tube(kit, SL.wool, pts, () => r, () => 'Head', { seg: 8, up: V(0, 1, 0), color: col, ao: 0.25, caps: true });
  }
  // scarf wraps: two crossing bands over the lower face and a loose tail hanging over the chest
  {
    for (const sgn of [1, -1]) {
      const pts = [], nr = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20, a = Math.PI / 2 + sgn * (-1.15 + 2.3 * t), y = 1.60 + 0.085 * (sgn > 0 ? t : 1 - t) * 0.95 - 0.014 * Math.sin(t * Math.PI);
        const r = head.R(y, a) + 0.0215 + 0.0085;
        pts.push(V(Math.cos(a) * r, y, head.cz + Math.sin(a) * r)); nr.push(V(Math.cos(a), 0.15, Math.sin(a)).normalize());
      }
      ribbon(kit, SL.cloth, pts, nr, 0.034, 0.0065, () => 'Head', { color: shade(scarfC, 1.04), fold: (i, a) => 0.0016 * Math.sin(i * 1.2 + a * 2), seg: 10 });
    }
    // trailing tail from the left shoulder across the chest, frayed end
    const tp = [], tn = [], n = 18;
    const start = V(0.075, 1.595, 0.065);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      tp.push(V(start.x - 0.03 * t - 0.055 * Math.sin(t * 2.4), start.y - 0.34 * t, start.z + 0.055 + 0.04 * Math.sin(t * 3) + 0.03 * t)); tn.push(V(0.1, 0.1, 1).normalize());
    }
    ribbon(kit, SL.cloth, tp, tn, (i) => 0.052 * (1 - 0.1 * i / n), 0.0055, (i, k, p) => torsoW(kit, p.y), { color: scarfC, fold: (i, a) => 0.0022 * Math.sin(i * 0.8 + a * 2.5), seg: 10, stitch: shade(scarfC, 1.25) });
  }

  // ---------------------------------------------------------------- tunic (laced wool) under the cloak
  const T = torsoField([
    [0.82, 0.19, 0.14, 0.14, 0.012], [0.92, 0.185, 0.134, 0.134, 0.012], [1.02, 0.176, 0.126, 0.124, 0.012], [1.14, 0.156, 0.11, 0.11, 0.01],
    [1.26, 0.167, 0.118, 0.125, 0.004], [1.36, 0.186, 0.131, 0.13, -0.002], [1.44, 0.2, 0.12, 0.125, -0.01], [1.49, 0.195, 0.1, 0.105, -0.014],
    [1.525, 0.15, 0.088, 0.09, -0.014], [1.55, 0.105, 0.078, 0.08, -0.012], [1.57, 0.08, 0.07, 0.072, -0.010],
  ], 2.2);
  const E = 2 / 2.2;
  const angleAtX = (y, x) => { const hw = T.row(y)[0], q = clamp(Math.abs(x) / hw, 0, 0.999), a0 = Math.acos(Math.pow(q, 1 / E)); return x >= 0 ? a0 : Math.PI - a0; };
  const GROW = 0.005;
  const tunF = (y, a) => pleats(y, a, 3, 8) * 0.004 * sstep(y, 0.82, 0.95) + creases(y, a, 4, 11) * 0.004 + 0.003 * Math.exp(-Math.pow((y - 1.15) / 0.05, 2)) * creases(y, a, 7, 22);
  const surfN = (y, a) => { const p = T.P(y, a, 0), q = T.P(y, a, 0.01); return q.sub(p).normalize(); };
  const ysT = span(0.82, 1.57, 0.012);
  clothTube(kit, SL.cloth, ysT.map((y) => V(0, y, T.cz(y))), (i, a) => T.rad(ysT[i], a, GROW), (i, a) => tunF(ysT[i], a), (i) => torsoW(kit, ysT[i]), { seg: 60, up: V(0, 0, 1), color: tunic, ao: 0.25 });
  // chest lacing: eyelets and criss-cross laces down the centre front
  {
    const ys = [1.46, 1.42, 1.38, 1.34, 1.30, 1.26, 1.22];
    for (const y of ys) for (const sx of [1, -1]) {
      const a = angleAtX(y, sx * 0.022), pp = T.P(y, a, GROW + tunF(y, a) + 0.002);
      add(SL.steel, torus(V(0, 0, 0), 0.0042, 0.0013, V(0, 0.1, 1), 8, 4), 'Spine2', brass, 0.1);
    }
    for (let q = 0; q < ys.length - 1; q++) for (const sg of [1, -1]) {
      const y0 = ys[q], y1 = ys[q + 1], a0 = angleAtX(y0, sg * 0.022), a1 = angleAtX(y1, -sg * 0.022);
      const pa = T.P(y0, a0, GROW + tunF(y0, a0) + 0.003), pb = T.P(y1, a1, GROW + tunF(y1, a1) + 0.003);
      tube(kit, SL.rope, [pa, pa.clone().lerp(pb, 0.5).add(V(0, 0, 0.0014)), pb], () => 0.0021, () => 'Spine2', { seg: 5, up: V(0, 0, 1), color: shade(leatherC, 1.1), ao: 0.2, caps: true });
    }
    // slit neckline edge
    const pts = [], nr = [];
    for (const y of span(1.2, 1.5, 0.02)) { const a = angleAtX(y, 0.03); pts.push(T.P(y, a, GROW + tunF(y, a) + 0.0016)); nr.push(surfN(y, a)); }
    ribbon(kit, SL.cloth, pts, nr, 0.012, 0.0035, (i, k, p) => torsoW(kit, p.y), { color: shade(tunic, 1.2), stitch: shade(tunic, 1.9), seg: 10 });
    const pts2 = [], nr2 = [];
    for (const y of span(1.2, 1.5, 0.02)) { const a = angleAtX(y, -0.03); pts2.push(T.P(y, a, GROW + tunF(y, a) + 0.0016)); nr2.push(surfN(y, a)); }
    ribbon(kit, SL.cloth, pts2, nr2, 0.012, 0.0035, (i, k, p) => torsoW(kit, p.y), { color: shade(tunic, 1.2), stitch: shade(tunic, 1.9), seg: 10 });
  }

  // ---------------------------------------------------------------- the cloak: a mantle over the shoulders and a long back panel, open at the front
  const K = torsoField([
    [0.56, 0.38, 0.2, 0.33, -0.01], [0.7, 0.36, 0.19, 0.31, -0.005], [0.85, 0.325, 0.18, 0.28, 0.0], [1.05, 0.29, 0.17, 0.235, 0.0],
    [1.25, 0.27, 0.16, 0.19, 0.0], [1.40, 0.255, 0.148, 0.165, -0.004], [1.49, 0.236, 0.124, 0.138, -0.012], [1.54, 0.172, 0.103, 0.108, -0.014], [1.575, 0.098, 0.083, 0.088, -0.014], [1.6, 0.083, 0.078, 0.08, -0.012],
  ], 2.4);
  const hemY = (a) => 0.54 + 0.07 * (0.5 + 0.5 * Math.sin(a - 0.6)) + 0.05 * Math.abs(Math.sin(a * 6.5 + 0.8)) + 0.04 * fbm(Math.cos(a) * 3, 1.3, Math.sin(a) * 3) + 0.05 * Math.pow(Math.max(0, Math.cos(a - 0.3)), 2);
  const gapR = (y) => 0.12 + 0.62 * (1 - sstep(y, 1.3, 1.5)), gapL = (y) => 0.12 + 1.0 * (1 - sstep(y, 1.3, 1.5));
  {
    const ys = span(0.5, 1.6, 0.01), seg = 120, n = ys.length;
    const cp = (i) => V(0, ys[i], K.cz(ys[i]));
    const aOf = (y, k) => { const gr = gapR(y), gl = gapL(y); return Math.PI / 2 + gr + (Math.PI * 2 - gr - gl) * (k / (seg - 1)); };
    const fold = (y, a, h) => { const dist = clamp((1.5 - y) / 0.9, 0, 1); const amp = 0.004 + 0.034 * dist * dist; return pleats(y, a, 6, 11, 1.0) * amp + creases(y, a, 3, 9) * 0.004 * (1 + dist * 2) + 0.01 * dist * Math.sin(a * 3 - 0.5); };
    clothTube(kit, SL.wool, ys.map((y, i) => cp(i)), (i, a, k) => { const hy = hemY(a), ye = Math.max(ys[i], hy); return K.rad(ye, a, 0.012); }, (i, a, k) => { const ye = Math.max(ys[i], hemY(a)); return fold(ye, a); },
      (i, k, p) => { const y = p.y; if (y > 1.1) return torsoW(kit, y); const w = sstep(1.1 - y, 0, 0.3) * 0.7; return [['Hips', 0.5 + w * 0.5], ['Spine', 1 - w]]; }, {
        seg, open: true, up: V(0, 0, 1), color: cloak, ao: 0.3,
        angle: (i, k) => aOf(ys[i], k),
        dy: (i, k, a) => Math.max(0, hemY(a) - ys[i]),
        colour: (i, k, p) => {
          const a = aOf(ys[i], k), hy = hemY(a), edge = 1 - sstep(p.y - hy, 0, 0.12);
          const base = mixC(cloak, cloakDust, 0.55 * edge + 0.15 * (1 - sstep(p.y, 0.55, 1.2)));
          return base;
        },
        foldK: 28,
      });
    // rolled front edges of the cloak and a stitched hem line
    for (const sgn of [1, -1]) {
      const yy = span(0.62, 1.545, 0.02), pts = [], nr = [];
      for (const y of yy) { const a = sgn > 0 ? Math.PI / 2 + gapR(y) : Math.PI / 2 - gapL(y); const ye = Math.max(y, hemY(a)); pts.push(K.P(ye, a, 0.012 + fold(ye, a) + 0.0035)); nr.push(V(Math.cos(a), 0.1, Math.sin(a)).normalize()); }
      ribbon(kit, SL.wool, pts, nr, 0.03, 0.0075, (i, k, p) => (p.y > 1.1 ? torsoW(kit, p.y) : [['Hips', 0.7], ['Spine', 0.3]]), { color: shade(cloak, 1.12), stitch: shade(cloak, 1.7), seg: 12 });
    }
    // patches sewn on the back panel
    for (const [y, a, w, h, rot] of [[0.95, Math.PI * 1.5 + 0.55, 0.07, 0.06, 0.1], [0.72, Math.PI * 1.5 - 0.4, 0.05, 0.07, -0.2]]) {
      const pp = K.P(y, a, 0.012 + fold(y, a) + 0.004), nn = V(Math.cos(a), 0, Math.sin(a)).normalize(), ya = Math.atan2(nn.x, nn.z);
      add(SL.felt, slab(pp, [w, h, 0.0035], 0.0018, [0, ya, rot]), 'Spine', mixC(cloak, 0x4a4030, 0.35), 0.3);
    }
    // throat clasp: two brass discs joined by a short chain
    {
      const a = Math.PI / 2, p = K.P(1.525, a, 0.012 + 0.004);
      for (const sx of [1, -1]) add(SL.steel, ell(V(p.x + sx * 0.04, p.y + 0.002, p.z + 0.003), [0.012, 0.012, 0.005], [0.1, sx * 0.3, 0], 12), 'Spine2', brass, 0.2);
      const cu = new THREE.CatmullRomCurve3([V(p.x + 0.04, p.y, p.z + 0.007), V(p.x + 0.015, p.y - 0.012, p.z + 0.012), V(p.x - 0.015, p.y - 0.012, p.z + 0.012), V(p.x - 0.04, p.y, p.z + 0.007)]);
      for (const g of chainLinks(cu, 6, 0.011, 0.007, 0.002)) add(SL.steel, g, 'Spine2', brass, 0.2);
    }
  }

  // ---------------------------------------------------------------- arms: tunic sleeves, long leather bracers, gloves
  mirror((s) => {
    const A = s > 0 ? 'Left' : 'Right', ax = armAxis(kit, A);
    const sR = (d) => keyed([[-0.03, 0.05], [0.05, 0.057], [0.28, 0.058], [0.4, 0.056], [0.52, 0.05]], d);
    const ds = span(-0.03, ax.len - 0.02, 0.011), pts = ds.map((d) => ax.at(d));
    clothTube(kit, SL.cloth, pts, (i) => sR(ds[i]), (i, a) => creases(ds[i], a, 5 + s, 13) * 0.0055 * (0.5 + 1.5 * Math.exp(-Math.pow((ds[i] - ax.lenU) / 0.07, 2))), (i, k, p) => armW(kit, A, p), { seg: 22, up: V(0, 0, 1), color: tunic, ao: 0.25 });
    // long bracer with front lacing
    const d0 = 0.27, d1 = 0.515, dd = span(d0, d1, 0.007), seg = 22;
    const gapA = 0.5;
    clothTube(kit, SL.leather, dd.map((d) => ax.at(d)), (i) => sR(dd[i]) + 0.0045 + 0.0028 * Math.min(sstep(dd[i], d0, d0 + 0.012), 1 - sstep(dd[i], d1 - 0.012, d1)),
      (i, a) => 0.0014 * Math.sin(dd[i] * 90 + a * 2) + creases(dd[i], a, 3 + s, 20) * 0.0018, (i, k, p) => armW(kit, A, p), { seg, up: V(0, 0, 1), color: leatherC, ao: 0.3 });
    // lacing across the outer edge (top side +Y)
    for (let q = 0; q < 9; q++) {
      const d = d0 + 0.018 + q * 0.026, c = ax.at(d), r = sR(d) + 0.0085;
      for (const sg of [1, -1]) {
        const a1 = Math.PI + sg * 0.16, a2 = Math.PI - sg * 0.16;
        const p1 = V(c.x, c.y - Math.cos(a1) * r, c.z + Math.sin(a1) * r), p2 = V(c.x + s * 0.018, c.y - Math.cos(a2) * r, c.z + Math.sin(a2) * r);
        tube(kit, SL.rope, [p1, p1.clone().lerp(p2, 0.5).add(V(0, 0.0015, 0)), p2], () => 0.0017, () => A + 'ForeArm', { seg: 5, up: V(0, 0, 1), color: shade(leatherC, 0.62), ao: 0.2, caps: true });
      }
    }
    for (const d of [0.285, 0.5]) { const c = ax.at(d); bandAround(kit, SL.leather, V(c.x, c.y, c.z), sR(d) + 0.0095, sR(d) + 0.0095, 0.014, 0.005, (i, k, p) => armW(kit, A, p), { color: leatherD, seg: 10, n: 28 }); add(SL.steel, slab(V(c.x, c.y + sR(d) + 0.0125, c.z), [0.0065, 0.0022, 0.0045], 0.0006), A + 'ForeArm', brass, 0.1); }
    // fingerless glove with a wrapped wrist
    {
      const hc = (x) => V(x, ax.wr.y - 0.006, ax.wr.z - 0.007), xs = span(0, 0.108, 0.005);
      tube(kit, SL.leather, xs.map((u) => hc(ax.wr.x - s * 0.02 + s * u)), (i, a) => { const u = xs[i], b = keyed([[0, 0.034], [0.03, 0.036], [0.108, 0.034]], u); const e = Math.min(sstep(u, 0, 0.01), 1 - sstep(u, 0.1, 0.108)); return [b * 0.88 + 0.0028 * e, b * 1.28 + 0.0028 * e]; }, (i, k, p) => armW(kit, A, p), { seg: 20, up: V(0, 0, 1), color: leatherD, ao: 0.3 });
    }
  });

  // ---------------------------------------------------------------- belt, satchel, dagger, curved blade
  {
    const N = 72, pts = [];
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, y = 1.035 + 0.006 * Math.sin(a - 0.5); pts.push(T.P(y, a, GROW + tunF(y, a) + 0.0065)); }
    tube(kit, SL.leather, pts, (i, a) => { const e = 0.5, c = Math.cos(a), sn = Math.sin(a); return [0.0052 * Math.pow(Math.max(Math.abs(c), 1e-3), e - 1), 0.0245 * Math.pow(Math.max(Math.abs(sn), 1e-3), e - 1)]; }, (i, k, p) => torsoW(kit, p.y), { seg: 12, closed: true, up: V(0, 1, 0), color: leatherC, ao: 0.28 });
    const bp = T.P(1.03, Math.PI / 2 - 0.02, GROW + 0.0125);
    add(SL.steel, slab(bp, [0.022, 0.016, 0.0035], 0.0015), 'Hips', brass, 0.15);
    add(SL.leather, slab(bp.clone().add(V(0, 0, 0.0034)), [0.0125, 0.0095, 0.002], 0.001), 'Hips', leatherD, 0.2);
    // satchel on the right hip, with a flap and a buckle
    {
      const a = Math.PI - 0.55, y = 0.92, pp = T.P(y, a, GROW + 0.034), pn = surfN(y, a), ya = Math.atan2(pn.x, pn.z);
      add(SL.leather, slab(pp, [0.05, 0.05, 0.026], 0.008, [0, ya, 0]), 'Hips', leatherC, 0.3);
      add(SL.leather, slab(pp.clone().add(pn.clone().multiplyScalar(0.0265)).add(V(0, 0.018, 0)), [0.052, 0.034, 0.004], 0.002, [0.1, ya, 0]), 'Hips', shade(leatherC, 1.08), 0.3);
      add(SL.steel, slab(pp.clone().add(pn.clone().multiplyScalar(0.033)).add(V(0, -0.002, 0)), [0.009, 0.01, 0.0025], 0.001, [0, ya, 0]), 'Hips', brass, 0.15);
    }
    // a belt dagger on the right-front
    {
      const a = Math.PI - 0.95, y = 1.0, pp = T.P(y, a, GROW + 0.02), pn = surfN(y, a), ya = Math.atan2(pn.x, pn.z);
      add(SL.leather, slab(pp.clone().add(V(0, -0.055, 0)), [0.012, 0.075, 0.009], 0.004, [0, ya, 0]), 'Hips', new THREE.Color(0x1d1a18), 0.2);
      add(SL.rope, ell(pp.clone().add(V(0, 0.058, 0)), [0.011, 0.04, 0.011], [0, ya, 0], 10), 'Hips', shade(leatherC, 0.7), 0.2);
      add(SL.steel, ell(pp.clone().add(V(0, 0.017, 0)), [0.021, 0.004, 0.011], [0, ya, 0], 10), 'Hips', brass, 0.15);
    }
    // curved blade at the left hip: scabbard on a sling, wrapped hilt
    {
      const cu = new THREE.CatmullRomCurve3([V(0.185, 1.03, 0.045), V(0.215, 0.92, 0.035), V(0.245, 0.76, 0.0), V(0.262, 0.6, -0.05), V(0.268, 0.5, -0.1)]);
      const n = 26, ps = [];
      for (let i = 0; i <= n; i++) ps.push(cu.getPoint(i / n));
      tube(kit, SL.leather, ps, (i) => [0.0125 - 0.0018 * (i / n), 0.0185 - 0.003 * (i / n)], (i, k, p) => (p.y > 0.9 ? 'Hips' : [['LeftUpLeg', 0.55], ['Hips', 0.45]]), { seg: 14, up: V(1, 0, 0.0), color: new THREE.Color(0x1c1612), ao: 0.15, caps: true });
      add(SL.steel, ell(ps[0].clone().add(V(0, 0.005, 0)), [0.016, 0.01, 0.021], null, 10), 'Hips', brass, 0.15);
      add(SL.steel, ell(ps[n].clone(), [0.0125, 0.02, 0.016], null, 10), 'Hips', steelC, 0.15);
      // hilt and guard
      const h0 = V(0.178, 1.042, 0.05), h1 = V(0.165, 1.17, 0.058);
      tube(kit, SL.rope, span(0, 1, 0.05).map((t) => h0.clone().lerp(h1, t)), (i, a) => [0.0105, 0.0125], () => 'Hips', { seg: 12, up: V(1, 0, 0), color: shade(leatherC, 0.65), ao: 0.2, caps: true });
      add(SL.steel, slab(V(0.18, 1.045, 0.05), [0.044, 0.004, 0.012], 0.002, [0, 0, 0.12]), 'Hips', steelC, 0.15);
      add(SL.steel, ell(h1.clone().add(V(-0.002, 0.008, 0)), [0.014, 0.012, 0.014], null, 10), 'Hips', steelC, 0.15);
      // sling strap across the belt
      for (const dy of [0.0]) bandAround(kit, SL.leather, V(0.215, 0.925, 0.035), 0.03, 0.026, 0.022, 0.006, () => 'Hips', { color: leatherD, seg: 10, n: 24 });
    }
  }

  // ---------------------------------------------------------------- legs: dark trousers and knee-high boots with folded cuffs
  mirror((s) => {
    const A = s > 0 ? 'Left' : 'Right', lg = legAxis(kit, A), an = J(A + 'Foot');
    const ys = span(1.05, 0.5, 0.012);
    clothTube(kit, SL.cloth, ys.map((y) => lg.at(y)), (i) => keyed([[0.5, 0.071], [0.57, 0.076], [0.75, 0.088], [0.95, 0.096], [1.05, 0.098]], ys[i]),
      (i, a) => creases(ys[i], a, 3 + s, 15) * 0.0045 + 0.004 * Math.exp(-Math.pow((ys[i] - 0.57) / 0.06, 2)) * creases(ys[i], a, 9 + s, 22), (i, k, p) => legW(kit, A, p), { seg: 26, up: V(0, 0, 1), color: shade(tunic, 0.82), ao: 0.25 });
    // boot shaft with a folded cuff
    const yb = span(0.52, 0.06, 0.008);
    clothTube(kit, SL.leather, yb.map((y) => { const p = lg.at(y); return V(p.x, y, p.z + 0.012 * (1 - sstep(y, 0.06, 0.3))); }), (i) => keyed([[0.06, 0.052], [0.14, 0.054], [0.25, 0.056], [0.4, 0.059], [0.5, 0.066], [0.52, 0.07]], yb[i]) + 0.0035,
      (i, a) => 0.0025 * Math.sin(yb[i] * 100 + a * 2) * (1 - sstep(yb[i], 0.25, 0.4)) + creases(yb[i], a, 5 + s, 18) * 0.0028 + 0.004 * Math.exp(-Math.pow((yb[i] - 0.14) / 0.04, 2)) * Math.sin(a * 5), (i, k, p) => legW(kit, A, p), { seg: 28, up: V(0, 0, 1), color: leatherC, ao: 0.28, foldK: 40 });
    // turned-down cuff
    {
      const yc = span(0.44, 0.535, 0.008);
      clothTube(kit, SL.leather, yc.map((y) => lg.at(y)), (i) => 0.0725 + 0.0055 * Math.sin(((yc[i] - 0.44) / 0.095) * Math.PI) * 0.9 - 0.003 * (1 - sstep(yc[i], 0.44, 0.47)), (i, a) => 0.0022 * Math.sin(a * 6 + yc[i] * 20), (i, k, p) => legW(kit, A, p), { seg: 28, up: V(0, 0, 1), color: shade(leatherC, 1.12), ao: 0.28, foldK: 40 });
    }
    // straps with buckles
    for (const y of [0.4, 0.27, 0.15]) { const c = lg.at(y), r = keyed([[0.06, 0.05], [0.14, 0.052], [0.25, 0.058], [0.4, 0.064]], y) + 0.0095; bandAround(kit, SL.leather, V(c.x, y, c.z), r, r, 0.014, 0.0045, (i, k, p) => legW(kit, A, p), { color: leatherD, seg: 10, n: 28 }); add(SL.steel, slab(V(c.x + s * 0.0, y, c.z + r + 0.003), [0.006, 0.0075, 0.0022], 0.0007), A + 'Leg', brass, 0.1); }
    // pointed boot foot with a low heel
    {
      const zs = span(-0.112, 0.222, 0.008);
      const sec = (z) => ({
        yc: keyed([[-0.112, 0.06], [-0.08, 0.066], [-0.04, 0.07], [0, 0.064], [0.05, 0.05], [0.1, 0.04], [0.16, 0.033], [0.2, 0.028], [0.222, 0.024]], z),
        h: keyed([[-0.112, 0.045], [-0.08, 0.06], [-0.04, 0.066], [0, 0.056], [0.05, 0.042], [0.1, 0.032], [0.16, 0.024], [0.2, 0.014], [0.222, 0.006]], z),
        w: keyed([[-0.112, 0.032], [-0.08, 0.04], [-0.04, 0.045], [0, 0.047], [0.05, 0.051], [0.1, 0.05], [0.16, 0.04], [0.2, 0.022], [0.222, 0.008]], z), n: 2.6,
      });
      footTube(kit, SL.leather, A, sec, zs, shade(leatherC, 0.85), { seg: 28 });
      footTube(kit, SL.leather, A, (z) => { const q = sec(z); const heel = z < -0.03 ? 0.011 : 0.0; return { yc: 0.0075 + heel * 0.5, h: 0.0075 + heel, w: q.w + 0.0035, n: 3.4 }; }, zs, new THREE.Color(0x1a1512), { seg: 24 });
      // stitch welt
      const ay = span(0.045, 0.1, 0.01);
    }
  });
  return kit.finish();
}
