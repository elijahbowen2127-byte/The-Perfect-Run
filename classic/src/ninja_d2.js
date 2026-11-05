// Design 2: modern stealth operative. Matte gunmetal soft-shell with a high collar, a balaclava hood with a vented mouth
// plate, a light plate-carrier with MOLLE webbing and pouches, a bandolier of throwing knives, polymer shoulder, elbow and knee
// plates, a drop-leg tanto, a short ninjato across the small of the back, cargo trousers bloused into laced combat boots.
import * as THREE from 'three';
import { makeKit, V, ell, limb } from './armor.js';
import { real } from './realmat.js';
import { clothTube, fabricMat, makeFit, headField, hoodShell, tube, ribbon, torsoField, torsoW, armW, legW, fab, mixC, shade, sstep, clamp, keyed, span, creases, pleats, fbm, noise3, hideBase, bx, slab, torus, shuriken, chainLinks, footTube, spiral, spiralH, armAxis, legAxis, kunaiParts, placeAlong, bandAround, armAng } from './ninja_lib.js';

export function buildD2(scene, skin) {
  const C = skin;
  hideBase(scene, /Outfit_Top|Outfit_Bottom|Footwear|Beard/);
  const mats = [
    fabricMat('cloth', { scale: 10, bump: 0.14, rough: 0.72, sheen: 0.6, sheenColor: 0x4a4f58, tag: 'd2' }),
    fabricMat('wool', { scale: 18, bump: 0.35, rough: 0.92, sheen: 0.3, tag: 'd2' }),
    fabricMat('leather', { scale: 3, bump: 0.1, cav: 0.14, sheen: 0, rough: 0.62, tag: 'd2' }),
    fabricMat('plate', { scale: 0.6, bump: 0.4, metal: 0.12, rough: 0.62, sheen: 0, tag: 'd2' }),
    real('steel'), real('rope', { scale: 1.5 }),
  ];
  const kit = makeKit(scene, mats, 'ninja_gear');
  const { J, add, mirror } = kit;
  const fit = makeFit(scene, kit), head = headField(fit);
  const SL = { cloth: 0, web: 1, leather: 2, plate: 3, steel: 4, rope: 5 };

  const cloth = mixC(fab(C.suit || 0x16161b, 0.12, 0.9), 0x5a5f66, 0.16), cloth2 = mixC(fab(C.suit2 || 0x2a2a33, 0.12, 0.9), 0x4a4f52, 0.1);
  const webC = shade(cloth, 0.78);
  const plateC = mixC(fab(C.wrap || 0x3e3e4a, 0.08, 0.8), 0x565a52, 0.6);
  const accent = mixC(fab(C.sash || 0xb8202a, 0.0, 0.85), 0x2a1618, 0.2);
  const leatherC = shade(fab(C.leather || 0x2c2420, 0.07, 0.9), 0.85);
  const steelC = new THREE.Color(C.trim || 0x9a9aa6);

  // ---------------------------------------------------------------- head: balaclava hood, neck gaiter, vented mouth plate
  const hoodC = shade(cloth, 0.95);
  const hood1 = hoodShell(kit, SL.cloth, head, {
    slit: { y0: 1.716, y1: 1.762, xw: 0.06 }, seed: 5, foldAmt: 0.7,
    thick: (y) => 0.0055 + (y < 1.6 ? 0.007 * (1 - sstep(y, 1.53, 1.6)) : 0), color: () => hoodC,
  });
  const gaiter = hoodShell(kit, SL.cloth, head, { yB: 1.54, yTop: 1.716, seed: 9, seg: 72, foldAmt: 1.3, thick: (y, a) => 0.011 + 0.004 * Math.sin(a * 2 + y * 30), color: () => shade(cloth2, 0.92) });
  for (const [y, hoodObj, off, r, col] of [[1.716, gaiter, -0.0015, 0.0028, shade(cloth2, 1.12)], [1.762, hood1, -0.0015, 0.0024, shade(cloth, 1.12)]]) {
    const pts = [], n = 28;
    for (let i = 0; i <= n; i++) { const t = i / n, a = Math.PI / 2 + (t - 0.5) * 2 * 1.0; pts.push(hoodObj.pt(y, a, off)); }
    tube(kit, SL.cloth, pts, () => r, () => 'Head', { seg: 8, up: V(0, 1, 0), color: col, ao: 0.25, caps: true });
  }
  // crown seam from the brow over the top to the nape
  {
    const pts = [], nr = [];
    for (const [y, a] of [[1.776, Math.PI / 2], [1.795, Math.PI / 2], [1.815, Math.PI / 2], [1.832, Math.PI / 2], [1.842, Math.PI / 2], [1.846, 0], [1.842, 3 * Math.PI / 2], [1.83, 3 * Math.PI / 2], [1.81, 3 * Math.PI / 2], [1.785, 3 * Math.PI / 2], [1.755, 3 * Math.PI / 2], [1.725, 3 * Math.PI / 2], [1.69, 3 * Math.PI / 2]]) {
      const p = y > 1.845 ? V(0, 1.851, head.cz) : hood1.pt(y, a, 0.0012); pts.push(p); nr.push(V(0, y > 1.84 ? 1 : 0.3, Math.sin(a) * 0.8).normalize());
    }
    ribbon(kit, SL.cloth, pts, nr, 0.0042, 0.0022, () => 'Head', { color: shade(hoodC, 1.45), seg: 8 });
  }
  // vent plate over the mouth: curved polymer slab with slots
  {
    const y = 1.652;
    const pts = [], nr = [];
    for (let j = 0; j < 3; j++) {
      const yy = y - 0.012 + j * 0.012; pts.length = 0; nr.length = 0;
      for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 + (i / 10 - 0.5) * 1.0, rr = head.R(yy, a) + 0.011 + 0.0042; pts.push(V(Math.cos(a) * rr, yy, head.cz + Math.sin(a) * rr)); nr.push(V(Math.cos(a), 0, Math.sin(a))); }
      ribbon(kit, SL.plate, pts.slice(), nr.slice(), 0.0055, 0.0028, () => 'Head', { color: shade(plateC, 0.7), seg: 8 });
    }
    // frame of the vent plate
    for (const sy of [-1, 1]) {
      const pp = [], nn = [];
      for (let i = 0; i <= 12; i++) { const a = Math.PI / 2 + (i / 12 - 0.5) * 1.1, yy = y + sy * 0.024, rr = head.R(yy, a) + 0.011 + 0.0065; pp.push(V(Math.cos(a) * rr, yy, head.cz + Math.sin(a) * rr)); nn.push(V(Math.cos(a), 0, Math.sin(a))); }
      ribbon(kit, SL.plate, pp, nn, 0.006, 0.0045, () => 'Head', { color: plateC, seg: 8 });
    }
    // ear-piece
    for (const sx of [1, -1]) add(SL.plate, ell(V(sx * 0.098, 1.722, 0.004), [0.0075, 0.02, 0.015], null, 12), 'Head', shade(plateC, 0.8), 0.3);
  }

  // ---------------------------------------------------------------- torso (fitted soft-shell)
  const T = torsoField([
    [0.9, 0.18, 0.13, 0.13, 0.012], [1.02, 0.172, 0.124, 0.122, 0.012], [1.14, 0.152, 0.108, 0.108, 0.01],
    [1.26, 0.166, 0.118, 0.124, 0.004], [1.36, 0.186, 0.132, 0.13, -0.002], [1.44, 0.2, 0.12, 0.125, -0.01], [1.49, 0.195, 0.1, 0.105, -0.014],
    [1.525, 0.15, 0.088, 0.09, -0.014], [1.55, 0.105, 0.078, 0.08, -0.012], [1.57, 0.08, 0.07, 0.072, -0.010],
  ], 2.2);
  const E = 2 / 2.2;
  const angleAtX = (y, x) => { const hw = T.row(y)[0], q = clamp(Math.abs(x) / hw, 0, 0.999), a0 = Math.acos(Math.pow(q, 1 / E)); return x >= 0 ? a0 : Math.PI - a0; };
  const GROW = 0.005;
  const jacketF = (y, a) => creases(y, a, 4, 11) * 0.0032 + 0.003 * Math.exp(-Math.pow((y - 1.2) / 0.06, 2)) * creases(y, a, 9, 22) + 0.002 * Math.sin(a * 5 + y * 14);
  const surfN = (y, a) => { const p = T.P(y, a, 0), q = T.P(y, a, 0.01); return q.sub(p).normalize(); };
  const ysT = span(0.9, 1.57, 0.012);
  clothTube(kit, SL.cloth, ysT.map((y) => V(0, y, T.cz(y))), (i, a) => T.rad(ysT[i], a, GROW), (i, a) => jacketF(ysT[i], a), (i) => torsoW(kit, ysT[i]), {
    seg: 64, up: V(0, 0, 1), color: cloth, ao: 0.25,
    colour: (i, k, p) => (Math.abs(p.x) > 0.145 && p.y < 1.4 ? cloth2 : cloth), // side panels
  });
  // zip placket with teeth, collar
  {
    const ys2 = span(0.93, 1.56, 0.015), a = Math.PI / 2;
    const pts = ys2.map((y) => T.P(y, a, GROW + jacketF(y, a) + 0.0012)), nr = ys2.map(() => V(0, 0.1, 1).normalize());
    ribbon(kit, SL.cloth, pts, nr, 0.022, 0.004, (i, k, p) => torsoW(kit, p.y), { color: shade(cloth, 0.8), stitch: shade(cloth, 1.7), seg: 12 });
    const pts2 = ys2.map((y) => T.P(y, a, GROW + jacketF(y, a) + 0.0036));
    ribbon(kit, SL.steel, pts2, nr, 0.0045, 0.0022, (i, k, p) => torsoW(kit, p.y), { color: shade(steelC, 0.7), stitch: shade(steelC, 1.3), seg: 8 });
    add(SL.steel, slab(T.P(1.5, a, GROW + 0.007), [0.005, 0.012, 0.0025], 0.001), 'Spine2', steelC, 0.1);
  }
  // stand collar over the gaiter
  {
    const ysC = span(1.5, 1.6, 0.008);
    tube(kit, SL.cloth, ysC.map((y) => V(0, y, head.cz)), (i, a) => head.R(Math.min(ysC[i], 1.57), a) * 1.0 + 0.0125 + 0.012 + 0.0022 * (i / ysC.length), (i) => 'Neck', { seg: 56, up: V(0, 0, 1), color: shade(cloth, 1.04), ao: 0.28 });
  }
  // shoulder yoke / side seams
  for (const a of [0.02, Math.PI - 0.02, Math.PI * 1.5]) {
    const ys2 = span(0.93, 1.48, 0.02), pts = ys2.map((y) => T.P(y, a, GROW + jacketF(y, a) + 0.0015)), nr = ys2.map((y) => surfN(y, a));
    ribbon(kit, SL.cloth, pts, nr, 0.0045, 0.002, (i, k, p) => torsoW(kit, p.y), { color: shade(cloth, 1.5), stitch: shade(cloth, 1.9), seg: 8 });
  }

  // ---------------------------------------------------------------- plate carrier on the chest
  {
    const ysR = span(1.185, 1.47, 0.008), seg = 30;
    const xR = 0.158;
    const edge = (u) => 1 - Math.pow(Math.abs(2 * u - 1), 5);
    const rowT = (y) => sstep(y, 1.185, 1.2) * (1 - sstep(y, 1.45, 1.47));
    tube(kit, SL.web, ysR.map((y) => V(0, y, T.cz(y))), (i, a, k) => {
      const y = ysR[i], u = k / (seg - 1);
      return T.rad(y, a, GROW + jacketF(y, a) + 0.0155 * edge(u) * rowT(y) + 0.0008);
    }, (i) => torsoW(kit, ysR[i]), {
      seg, open: true, up: V(0, 0, 1), color: webC, ao: 0.28,
      angle: (i, k) => { const y = ysR[i], a0 = angleAtX(y, xR), a1 = angleAtX(y, -xR); return a0 + (a1 - a0) * (k / (seg - 1)); },
      colour: (i, k) => shade(webC, 1 + 0.06 * Math.sin(ysR[i] * 700)),
    });
    // MOLLE webbing rows and vertical stitch bars
    for (const y of [1.205, 1.232, 1.259, 1.286, 1.313]) {
      const pts = [], nr = [], n = 22;
      for (let i = 0; i <= n; i++) { const u = i / n, x = xR * (1 - 2 * u) * 0.96, a = angleAtX(y, x); pts.push(T.P(y, a, GROW + jacketF(y, a) + 0.0155 * edge(u) + 0.0042)); nr.push(surfN(y, a)); }
      ribbon(kit, SL.web, pts, nr, 0.0085, 0.0045, (i, k, p) => torsoW(kit, p.y), { color: shade(webC, 0.85), stitch: shade(webC, 1.8), seg: 10 });
    }
    // chest pouches with flaps and buckles
    for (const sx of [1, -1]) {
      const y = 1.255, x = sx * 0.082, a = angleAtX(y, x), pp = T.P(y, a, GROW + 0.0155 + 0.024), pn = surfN(y, a), ya = Math.atan2(pn.x, pn.z);
      add(SL.web, slab(pp, [0.036, 0.04, 0.017], 0.006, [0, ya, 0]), 'Spine1', shade(webC, 0.92), 0.3);
      const fp = pp.clone().add(pn.clone().multiplyScalar(0.0185)).add(V(0, 0.026, 0));
      add(SL.web, slab(fp, [0.037, 0.02, 0.004], 0.002, [0.1, ya, 0]), 'Spine1', webC, 0.3);
      add(SL.steel, slab(pp.clone().add(pn.clone().multiplyScalar(0.0235)).add(V(0, 0.01, 0)), [0.009, 0.006, 0.0022], 0.0008, [0, ya, 0]), 'Spine1', steelC, 0.1);
      add(SL.web, slab(pp.clone().add(pn.clone().multiplyScalar(0.0195)).add(V(0, 0.018, 0)), [0.006, 0.011, 0.002], 0.001, [0, ya, 0]), 'Spine1', accent, 0.3); // pull tab
    }
    // upper rig: a curved polymer plate face with a bevelled border
    {
      const ysP = span(1.325, 1.465, 0.007), segP = 24, xP = 0.118;
      const edgeP = (u) => 1 - Math.pow(Math.abs(2 * u - 1), 6), rowP = (y) => Math.min(sstep(y, 1.325, 1.34), 1 - sstep(y, 1.45, 1.465));
      tube(kit, SL.plate, ysP.map((y) => V(0, y, T.cz(y))), (i, a, k) => { const y = ysP[i], u = k / (segP - 1); return T.rad(y, a, GROW + jacketF(y, a) + 0.0155 + 0.0012 + 0.0065 * Math.pow(edgeP(u) * rowP(y), 0.6)); },
        (i) => torsoW(kit, ysP[i]), { seg: segP, open: true, up: V(0, 0, 1), color: plateC, ao: 0.25,
          angle: (i, k) => { const y = ysP[i], a0 = angleAtX(y, xP), a1 = angleAtX(y, -xP); return a0 + (a1 - a0) * (k / (segP - 1)); },
          colour: (i, k) => { const u = k / (segP - 1), y = ysP[i]; return shade(plateC, edgeP(u) * rowP(y) < 0.35 ? 0.78 : 1.05); } });
    }
  }
  // ---------------------------------------------------------------- bandolier of throwing knives
  {
    const pts = [], nr = [];
    for (const [y, x] of [[1.5, -0.118], [1.42, -0.085], [1.34, -0.04], [1.26, 0.0], [1.18, 0.05], [1.11, 0.1], [1.05, 0.15]]) {
      const a = angleAtX(y, x); pts.push(T.P(y, a, GROW + 0.033)); nr.push(surfN(y, a));
    }
    pts.unshift(V(-0.125, 1.53, -0.03)); nr.unshift(V(-0.5, 1, 0).normalize());
    pts.push(V(0.18, 1.0, 0.07)); nr.push(V(1, 0, 0.3).normalize());
    const cu = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5), N = 70, sp = [], sn = [];
    for (let i = 0; i <= N; i++) { const p = cu.getPoint(i / N); sp.push(p); const c = V(0, p.y, T.cz(p.y)); sn.push(p.clone().sub(c).setY(0).normalize()); }
    ribbon(kit, SL.leather, sp, sn, 0.04, 0.007, (i, k, p) => torsoW(kit, p.y), { color: leatherC, stitch: shade(leatherC, 1.9), seg: 12 });
    // knives: handles up, blades riding in the loops
    for (let q = 0; q < 6; q++) {
      const t = 0.22 + q * 0.118, p = cu.getPoint(t), tg = cu.getTangent(t), c = V(0, p.y, T.cz(p.y)), nrm = p.clone().sub(c).setY(0).normalize();
      const dir = V(0.12, -1, 0).addScaledVector(nrm, 0.05).normalize();
      for (const part of kunaiParts(0.15, 0.022)) {
        const g = placeAlong(part.geo.clone(), p.clone().addScaledVector(nrm, 0.01).add(V(0, 0.048, 0)), dir, 0);
        add(part.kind === 'steel' ? SL.steel : SL.web, g, 'Spine2', part.kind === 'steel' ? steelC : webC, 0.15);
      }
      // loop across the strap
      add(SL.leather, slab(p.clone().addScaledVector(nrm, 0.005), [0.015, 0.0085, 0.0045], 0.0015, [0, Math.atan2(nrm.x, nrm.z), 0.5]), 'Spine2', shade(leatherC, 1.1), 0.3);
    }
    add(SL.steel, slab(cu.getPoint(0.12).addScaledVector(V(0, 0, 1), 0.005), [0.012, 0.012, 0.003], 0.0012), 'Spine2', steelC, 0.1);
  }

  // ---------------------------------------------------------------- arms: sleeves, pauldrons, elbow pads, bracers, gloves
  mirror((s) => {
    const A = s > 0 ? 'Left' : 'Right', ax = armAxis(kit, A);
    const sleeveR = (d) => keyed([[-0.03, 0.05], [0.05, 0.057], [0.28, 0.058], [0.4, 0.056], [0.52, 0.05]], d);
    const ds = span(-0.03, ax.len - 0.02, 0.011), pts = ds.map((d) => ax.at(d));
    clothTube(kit, SL.cloth, pts, (i) => sleeveR(ds[i]) + 0.0, (i, a) => creases(ds[i], a, 5 + s, 13) * 0.0045 * (0.5 + 1.5 * Math.exp(-Math.pow((ds[i] - ax.lenU) / 0.07, 2))),
      (i, k, p) => armW(kit, A, p), { seg: 22, up: V(0, 0, 1), color: cloth, ao: 0.25, colour: (i, k, p) => (ds[i] > ax.lenU + 0.02 ? cloth2 : cloth) });
    // pauldron: three overlapping lames over the shoulder
    const lames = [[0.0, 0.058, 0.0], [0.04, 0.098, 0.004], [0.075, 0.13, 0.008]];
    for (const [da, db, lift] of lames) {
      const dd = span(da, db, (db - da) / 6), seg = 14;
      tube(kit, SL.plate, dd.map((d) => ax.at(d)), (i, a) => {
        const d = dd[i], t = (d - da) / (db - da), round = 0.0045 * Math.sqrt(Math.max(0, 1 - Math.pow(2 * t - 1, 4)));
        return sleeveR(d) + 0.009 + lift + round;
      }, (i, k, p) => armW(kit, A, p), { seg, open: true, up: V(0, 0, 1), color: plateC, ao: 0.25, angle: (i, k) => armAng(s, Math.PI - 1.15 + (k / (seg - 1)) * 2.3) });
    }
    // elbow pad on the outer elbow
    {
      const dd = span(ax.lenU - 0.045, ax.lenU + 0.035, 0.01), seg = 10;
      tube(kit, SL.plate, dd.map((d) => ax.at(d)), (i, a) => { const d = dd[i], t = (d - dd[0]) / (dd[dd.length - 1] - dd[0]); return sleeveR(d) + 0.005 + 0.0085 * Math.sqrt(Math.max(0, 1 - Math.pow(2 * t - 1, 2))); },
        (i, k, p) => armW(kit, A, p), { seg, open: true, up: V(0, 0, 1), color: shade(plateC, 0.95), ao: 0.25, angle: (i, k) => armAng(s, 1.5 * Math.PI - 0.85 + (k / (seg - 1)) * 1.7) });
    }
    // forearm bracer: ribbed polymer shell with a strap
    {
      const d0 = 0.34, d1 = 0.5, dd = span(d0, d1, 0.006), seg = 16;
      tube(kit, SL.plate, dd.map((d) => ax.at(d)), (i, a) => { const d = dd[i], t = (d - d0) / (d1 - d0); return sleeveR(d) + 0.006 + 0.0025 * Math.sin(d * 150) + 0.002 * Math.min(1, t * 6) * Math.min(1, (1 - t) * 6); },
        (i, k, p) => armW(kit, A, p), { seg, open: true, up: V(0, 0, 1), color: plateC, ao: 0.25, angle: (i, k) => armAng(s, Math.PI - 1.0 + (k / (seg - 1)) * 2.0) });
      for (const d of [0.345, 0.495]) {
        const c = ax.at(d);
        bandAround(kit, SL.web, V(c.x, c.y, c.z), sleeveR(d) + 0.0095, sleeveR(d) + 0.0095, 0.02, 0.005, (i, k, p) => armW(kit, A, p), { color: webC, seg: 10, n: 28 });
      }
    }
    // fingerless glove: leather back of hand with a knuckle guard
    {
      const hc = (x) => V(x, ax.wr.y - 0.006, ax.wr.z - 0.007), xs = span(0, 0.108, 0.006);
      tube(kit, SL.leather, xs.map((u) => hc(ax.wr.x - s * 0.025 + s * u)), (i, a) => { const u = xs[i], b = keyed([[0, 0.034], [0.03, 0.036], [0.108, 0.034]], u); const e = Math.min(sstep(u, 0, 0.01), 1 - sstep(u, 0.1, 0.108)); return [b * 0.88 + 0.0025 * e, b * 1.28 + 0.0025 * e]; },
        (i, k, p) => armW(kit, A, p), { seg: 20, up: V(0, 0, 1), color: shade(leatherC, 1.0), ao: 0.3 });
      tube(kit, SL.plate, span(0, 0.05, 0.01).map((u) => hc(ax.wr.x + s * (0.04 + u))), (i, a) => [0.0305, 0.0455 - 0.003 * (i / 5)], () => A + 'Hand', { seg: 8, open: true, up: V(0, 0, 1), color: plateC, ao: 0.2, angle: (i, k) => armAng(s, Math.PI - 0.7 + (k / 7) * 1.4) });
    }
  });

  // ---------------------------------------------------------------- belt, pouches, back sword, drop-leg tanto
  {
    const N = 72, pts = [], nr = [];
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, y = 1.04 + 0.004 * Math.sin(a * 2); pts.push(T.P(y, a, GROW + jacketF(y, a) + 0.0055)); nr.push(V(0, 1, 0)); }
    tube(kit, SL.web, pts, (i, a, k) => { const e = 0.5, c = Math.cos(a), sn = Math.sin(a); return [0.0046 * Math.pow(Math.max(Math.abs(c), 1e-3), e - 1), 0.027 * Math.pow(Math.max(Math.abs(sn), 1e-3), e - 1)]; }, (i, k, p) => torsoW(kit, p.y), { seg: 12, closed: true, up: V(0, 1, 0), color: webC, ao: 0.28 });
    // buckle
    const bp = T.P(1.04, Math.PI / 2, GROW + 0.012);
    add(SL.steel, slab(bp, [0.03, 0.021, 0.0035], 0.0015), 'Hips', shade(steelC, 0.8), 0.1);
    add(SL.web, slab(bp.clone().add(V(0, 0, 0.0034)), [0.017, 0.012, 0.002], 0.001), 'Hips', shade(cloth, 0.7), 0.2);
    add(SL.web, slab(V(bp.x + 0.043, bp.y, bp.z - 0.004), [0.012, 0.0075, 0.003], 0.001), 'Hips', accent, 0.2);
    // hip pouches (left), dump pouch (right rear)
    for (const [a, y, w, h, d] of [[0.34, 0.99, 0.04, 0.05, 0.022], [0.14, 0.99, 0.035, 0.05, 0.022], [Math.PI * 1.5 - 0.7, 0.985, 0.05, 0.05, 0.035]]) {
      const pp = T.P(y, a, GROW + 0.0055 + d + 0.012), pn = surfN(y, a), ya = Math.atan2(pn.x, pn.z);
      add(SL.web, slab(pp, [w, h, d], 0.006, [0, ya, 0]), 'Hips', shade(webC, 0.95), 0.3);
      add(SL.web, slab(pp.clone().add(pn.clone().multiplyScalar(d + 0.003)).add(V(0, h * 0.5, 0)), [w + 0.002, h * 0.5, 0.0035], 0.0015, [0.05, ya, 0]), 'Hips', webC, 0.3);
      add(SL.steel, slab(pp.clone().add(pn.clone().multiplyScalar(d + 0.007)).add(V(0, h * 0.1, 0)), [0.008, 0.006, 0.0022], 0.0008, [0, ya, 0]), 'Hips', steelC, 0.1);
    }
    // short ninjato across the small of the back, hilt out on the left
    {
      const P0 = V(-0.2, 0.975, -0.172), P1 = V(0.16, 1.07, -0.172), ax = P1.clone().sub(P0).normalize(), ts = span(0, 1, 0.025);
      tube(kit, SL.leather, ts.map((t) => P0.clone().lerp(P1, t)), (i, a) => [0.0135, 0.0185], () => 'Hips', { seg: 14, up: V(0, 1, 0), color: new THREE.Color(0x16171a), ao: 0.15, caps: true });
      add(SL.steel, ell(P0.clone().add(ax.clone().multiplyScalar(-0.004)), [0.0145, 0.0195, 0.016], null, 10), 'Hips', shade(steelC, 0.75), 0.1);
      add(SL.steel, limb(P1.clone().add(ax.clone().multiplyScalar(-0.04)), P1, 0.0155, 0.0205, 0.0155, 0.0205, V(0, 1, 0), 0.7), 'Hips', shade(steelC, 0.75), 0.1);
      const H1 = P1.clone().add(ax.clone().multiplyScalar(0.19)), hs = span(0, 1, 0.02), hl = P1.distanceTo(H1);
      tube(kit, SL.rope, hs.map((t) => P1.clone().lerp(H1, t)), (i, a) => { const u = hs[i] * hl, ph = Math.sin(u * 220 + a * 0); return [0.0115 + 0.0012 * ph * 0.5, 0.0115 + 0.0012 * ph * 0.5]; }, () => 'Hips', { seg: 14, up: V(0, 1, 0), color: shade(cloth, 0.7), ao: 0.2, caps: true });
      add(SL.steel, ell(P1.clone().add(ax.clone().multiplyScalar(0.012)), [0.034, 0.034, 0.0045], [0, 0, 0], 16), 'Hips', shade(steelC, 0.7), 0.1);
      add(SL.steel, ell(H1.clone().add(ax.clone().multiplyScalar(0.008)), [0.014, 0.014, 0.014], null, 10), 'Hips', shade(steelC, 0.75), 0.1);
      add(SL.web, slab(P0.clone().lerp(P1, 0.3).add(V(0, 0.002, 0.014)), [0.02, 0.026, 0.004], 0.002, [0, 0, 0.24]), 'Hips', webC, 0.3);
      add(SL.web, slab(P0.clone().lerp(P1, 0.75).add(V(0, 0.003, 0.014)), [0.02, 0.026, 0.004], 0.002, [0, 0, 0.24]), 'Hips', webC, 0.3);
    }
  }

  // ---------------------------------------------------------------- legs: cargo trousers, knee pads, drop-leg tanto, boots
  mirror((s) => {
    const A = s > 0 ? 'Left' : 'Right', lg = legAxis(kit, A), an = J(A + 'Foot');
    const ys = span(1.05, 0.22, 0.011);
    clothTube(kit, SL.cloth, ys.map((y) => lg.at(y)), (i) => keyed([[0.22, 0.06], [0.28, 0.07], [0.42, 0.066], [0.57, 0.074], [0.75, 0.092], [0.95, 0.1], [1.05, 0.102]], ys[i]),
      (i, a) => { const y = ys[i]; return creases(y, a, 3 + s, 15) * 0.0042 + 0.0042 * Math.exp(-Math.pow((y - 0.57) / 0.07, 2)) * creases(y, a, 8 + s, 22) + 0.005 * Math.exp(-Math.pow((y - 0.25) / 0.04, 2)) * Math.sin(a * 8 + y * 40); },
      (i, k, p) => legW(kit, A, p), { seg: 28, up: V(0, 0, 1), color: cloth, ao: 0.25 });
    // cargo pocket with flap and tab
    {
      const yc = 0.8, c = lg.at(yc), out = s * (0.103 + 0.012), pc = V(c.x + out, yc, c.z - 0.005);
      add(SL.cloth, slab(pc, [0.0155, 0.062, 0.046], 0.006), A + 'UpLeg', shade(cloth, 1.04), 0.28);
      add(SL.cloth, slab(V(pc.x + s * 0.0035, yc + 0.045, pc.z), [0.0175, 0.026, 0.048], 0.0035), A + 'UpLeg', cloth, 0.28);
      add(SL.web, slab(V(pc.x + s * 0.0065, yc + 0.026, pc.z), [0.003, 0.011, 0.007], 0.001), A + 'UpLeg', accent, 0.25);
    }
    // knee pad: a shell over the front of the knee with a ridge and straps
    {
      const kn = J(A + 'Leg'), c = V(kn.x, kn.y + 0.012, kn.z + 0.082);
      add(SL.plate, ell(c, [0.052, 0.07, 0.03], [0.1, 0, 0], 16, [0.8, 0.8]), A + 'Leg', plateC, 0.28);
      add(SL.plate, ell(V(c.x, c.y + 0.006, c.z + 0.022), [0.038, 0.03, 0.011], [0.1, 0, 0], 12), A + 'Leg', shade(plateC, 1.15), 0.25);
      for (const dy of [0.072, -0.07]) bandAround(kit, SL.web, V(kn.x, kn.y + dy, kn.z + 0.004), 0.078, 0.078, 0.016, 0.0045, (i, k, p) => legW(kit, A, p), { color: webC, seg: 10, n: 36 });
    }
    // boot: tall padded shaft, laced upper, lugged sole
    {
      const zs = span(-0.112, 0.214, 0.008);
      const sec = (z) => ({
        yc: keyed([[-0.112, 0.07], [-0.08, 0.08], [-0.04, 0.085], [0, 0.077], [0.05, 0.06], [0.1, 0.048], [0.15, 0.04], [0.19, 0.034], [0.214, 0.03]], z),
        h: keyed([[-0.112, 0.055], [-0.08, 0.07], [-0.04, 0.078], [0, 0.07], [0.05, 0.052], [0.1, 0.04], [0.15, 0.03], [0.19, 0.024], [0.214, 0.012]], z),
        w: keyed([[-0.112, 0.034], [-0.08, 0.044], [-0.04, 0.047], [0, 0.05], [0.05, 0.056], [0.1, 0.058], [0.15, 0.055], [0.19, 0.042], [0.214, 0.018]], z), n: 2.8,
      });
      footTube(kit, SL.leather, A, sec, zs, shade(leatherC, 0.75), { seg: 28 });
      // rubber sole with lugs
      footTube(kit, SL.leather, A, (z) => { const q = sec(z); const lug = 0.0016 * Math.sign(Math.sin(z * 260)); return { yc: 0.011 + lug * 0.5, h: 0.011 + lug, w: q.w + 0.0045, n: 3.2 }; }, zs, new THREE.Color(0x17171a), { seg: 24 });
      // toe cap
      add(SL.leather, ell(V(an.x + (J(A + 'Toe_End').x - an.x) * 0.9, 0.034, 0.155), [0.044, 0.025, 0.05], [0.2, 0, 0], 14), A + 'ToeBase', shade(leatherC, 0.6), 0.28);
      // shaft
      const ay = span(0.06, 0.25, 0.01);
      clothTube(kit, SL.leather, ay.map((y) => V(an.x + (lg.at(y).x - an.x) * 0.3, y, an.z + 0.006 + (y - 0.126) * 0.05)), (i) => keyed([[0.06, 0.056], [0.2, 0.058], [0.25, 0.062]], ay[i]), (i, a) => 0.0022 * Math.sin(ay[i] * 120 + a * 3) + creases(ay[i], a, 4, 20) * 0.0018, (i, k, p) => legW(kit, A, p), { seg: 22, up: V(0, 0, 1), color: shade(leatherC, 0.78), ao: 0.28 });
      // laces: crossed bars up the throat, and a padded collar
      for (let q = 0; q < 7; q++) {
        const z = 0.075 - q * 0.0125, sc = sec(z), top = sc.yc + sc.h + (q > 3 ? 0.012 + (q - 3) * 0.018 : 0.003);
        const x = an.x + (J(A + 'Toe_End').x - an.x) * clamp((z - an.z) / 0.22, 0, 1) * 0.5;
        for (const sg of [-1, 1]) add(SL.rope, ell(V(x, top, z - (q > 3 ? 0.008 * (q - 3) : 0)), [0.015, 0.0028, 0.0026], [0, 0, sg * 0.5], 6), A + 'Foot', shade(cloth, 0.85), 0.2);
      }
    }
    // drop-leg platform and tanto on the right thigh
    if (s < 0) {
      const c = lg.at(0.8), pc = V(c.x - 0.052, 0.8, c.z + 0.086);
      for (const dy of [0.12, -0.05]) bandAround(kit, SL.web, V(c.x, 0.8 + dy, c.z), 0.101, 0.103, 0.026, 0.005, (i, k, p) => legW(kit, A, p), { color: webC, seg: 10, n: 40 });
      add(SL.leather, slab(V(pc.x, 0.78, pc.z + 0.002), [0.034, 0.1, 0.0075], 0.003, [0, 0.45, 0]), A + 'UpLeg', shade(leatherC, 0.9), 0.3);
      add(SL.leather, slab(V(pc.x - 0.0035, 0.745, pc.z + 0.011), [0.0155, 0.1, 0.01], 0.0045, [0, 0.45, 0]), A + 'UpLeg', new THREE.Color(0x16171a), 0.2);
      add(SL.rope, ell(V(pc.x - 0.0035, 0.88, pc.z + 0.011), [0.011, 0.048, 0.011], [0, 0.45, 0], 10), A + 'UpLeg', shade(cloth, 0.7), 0.2);
      add(SL.steel, ell(V(pc.x - 0.0035, 0.835, pc.z + 0.011), [0.019, 0.004, 0.015], [0, 0.45, 0], 10), A + 'UpLeg', shade(steelC, 0.75), 0.1);
    }
    // blousing band at the boot top
    { const c = lg.at(0.245); bandAround(kit, SL.web, V(c.x, 0.245, c.z), 0.068, 0.07, 0.016, 0.005, (i, k, p) => legW(kit, A, p), { color: shade(cloth, 0.7), seg: 10, n: 32 }); }
  });
  return kit.finish();
}
