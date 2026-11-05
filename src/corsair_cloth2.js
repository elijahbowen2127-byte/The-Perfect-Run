// More cloth for the pirate captain: loose linen shirt and billowing sleeves, bandana, sash, rope, stockings.
import * as THREE from 'three';
import { V } from './armor.js';
import * as K from './corsair_lib.js';
import { SL } from './corsair_base.js';
const { TAU, sstep, clamp, mix, fbm, vnoise, skinGeo, gridGeo, surfGeo, ribbonGeo, tubeGeo, bodyBind, torsoBind, armBind, legBind, col, shade } = K;


const TP = [[0.9, 0.19, 0.155], [0.97, 0.18, 0.15], [1.05, 0.165, 0.138], [1.12, 0.157, 0.128], [1.22, 0.158, 0.128], [1.32, 0.168, 0.133], [1.42, 0.178, 0.137], [1.5, 0.165, 0.118], [1.56, 0.1, 0.085], [1.62, 0.07, 0.065]];
export function torsoE(y) { let i = 0; while (i < TP.length - 2 && y > TP[i + 1][0]) i++; const a = TP[i], b = TP[i + 1], t = clamp((y - a[0]) / (b[0] - a[0]), 0, 1), k = t * t * (3 - 2 * t); return [mix(a[1], b[1], k), mix(a[2], b[2], k)]; }

// A loose shirt body from the collar to the hem, hanging over the belt, with an open V at the neck.
// o: { color, top, hem, blouse, openW, openY, fit }
export function shirtBody(ctx, o = {}) {
  const { kit, surf } = ctx, y1 = o.top ?? 1.6, y0 = o.hem ?? 0.93, NJ = 60, NS = 128, cz = 0.012, color = o.color ?? 0xe4dac2;
  const rows = [], openW = o.openW ?? 0.055, openY = o.openY ?? 1.36;
  const neckR = 0.088;
  for (let j = 0; j <= NJ; j++) {
    const v = j / NJ, y = mix(y1, y0, v), ring = [];
    const tOp = clamp((y - openY) / (y1 - openY), 0, 1), hw = tOp > 0 ? 0.012 + openW * 1.4 * Math.pow(tOp, 0.85) : 0, te = Math.asin(clamp(hw / (y > 1.55 ? 0.09 : Math.max(torsoE(y)[1], 0.09)), 0, 0.95));
    for (let i = 0; i <= NS; i++) {
      const th = mix(te, TAU - te, i / NS);
      const [rx, rz] = torsoE(y);
      let r = (1 / Math.hypot(Math.sin(th) / rx, Math.cos(th) / rz)) * (o.fit ?? 1.0) + 0.006;
      const sh = sstep(y, 1.5, 1.6); r = mix(r, neckR * (1 + 0.1 * Math.abs(Math.sin(th))), sh);
      const puff = (o.blouse ?? 0.07) * ((1 - sstep(y, 0.98, 1.06)) + 0.3 * (1 - sstep(y, 0.93, 0.98)));
      const fold = 1 + 0.026 * Math.sin(th * 11 + y * 9 + 1.3 * Math.sin(th * 3)) * (0.4 + (1 - v)) + 0.012 * (fbm(th * 3, y * 18) - 0.5);
      const hemJag = (y < 1.0 ? 0.015 * Math.sin(th * 7) * (1 - sstep(y, 0.94, 1.0)) : 0);
      r = (r * (1 + puff + 0.16 * (1 - sstep(y, 0.97, 1.1))) + 0.01) * fold;
      ring.push(V(Math.sin(th) * r, y - hemJag * v, cz + Math.cos(th) * r));
    }
    rows.push(ring);
  }
  const g = gridGeo(rows, { closed: false, flip: true });
  skinGeo(kit, SL.linen, g, { bind: bodyBind(kit, { legTop: 1.0, legBot: 0.9, maxLeg: 0.3 }), color: (p, n) => { const dirt = fbm(p.x * 14 + 2, p.y * 9), cr = Math.sin(Math.atan2(p.x, p.z) * 11 + p.y * 9) * 0.5 + 0.5, k = 0.76 + 0.26 * dirt + 0.1 * n.y + 0.12 * cr; return col(color).multiplyScalar(k).lerp(col(0x8a7a5a), 0.18 * (1 - sstep(p.y, 0.95, 1.4))); }, ao: 0.35 });
  // open collar: a band that stands at the back and folds down over the shoulders, parting at the front
  { const NR = 8, NC = 48, rows2 = [];
    for (let k = 0; k <= NR; k++) {
      const v = k / NR, row = [], th0 = 0.45 + 0.5 * v;
      for (let i = 0; i <= NC; i++) {
        const th = mix(th0, TAU - th0, i / NC), bk = (1 - Math.cos(th)) / 2; // 0 front .. 1 back
        const r = 0.094 + 0.075 * Math.pow(v, 0.9) * (0.7 + 0.5 * bk), y = 1.62 - 0.025 * bk * (1 - v) - 0.085 * Math.pow(v, 0.8) * (1 - 0.25 * bk) + 0.004 * Math.sin(th * 7 + v * 3);
        row.push(V(Math.sin(th) * r, y, cz + Math.cos(th) * r * 0.97 + 0.004));
      }
      rows2.push(row);
    }
    skinGeo(kit, SL.linen, gridGeo(rows2, { flip: true }), { bind: torsoBind(kit), color: (p, n) => col(color).multiplyScalar(0.85 + 0.15 * n.y + 0.12 * fbm(p.x * 30, p.z * 30)), ao: 0.3 });
  }
  return g;
}

// A billowing sleeve along an arm (T-pose axis): gathers at the shoulder, puffs over the forearm, gathered into a cuff.
export function billowSleeve(ctx, A, o = {}) {
  const { kit, J } = ctx, s = A === 'Left' ? 1 : -1, sh = J(A + 'Arm'), el = J(A + 'ForeArm'), wr = J(A + 'Hand');
  const color = o.color ?? 0xe4dac2, NJ = 36, NS = 28, x0 = 0.15, x1 = o.end ?? 0.715;
  const axisAt = (xa) => { const t = xa < el.x ? (xa - sh.x) / (el.x - sh.x) : 1 + (xa - el.x) / (wr.x - el.x); return xa <= el.x ? sh.clone().lerp(el, (xa - sh.x) / (el.x - sh.x)) : el.clone().lerp(wr, (xa - el.x) / (wr.x - el.x)); };
  const rows = [];
  for (let j = 0; j <= NJ; j++) {
    const u = j / NJ, xa = mix(x0, x1, u), c = axisAt(xa).clone(); c.x = xa * s;
    const cc = axisAt(xa * 1); // axis in the left arm's coordinates; mirror for the right arm
    const centre = V(s * xa, mix(sh.y, wr.y, 0), cc.z);
    centre.y = cc.y;
    // radius profile: snug at the shoulder, bellying out over the forearm, pinched at the cuff
    const bell = Math.exp(-Math.pow((u - 0.52) / 0.3, 2));
    let r = 0.06 + (o.puff ?? 0.04) * bell + 0.012 * sstep(u, 0.0, 0.2) - 0.015 * sstep(u, 0.88, 0.97);
    const cuffZone = sstep(u, 0.9, 0.96);
    const ring = [];
    for (let i = 0; i < NS; i++) {
      const a = (i / NS) * TAU, fold = 1 + 0.07 * Math.sin(a * 4 + u * 11 + (s > 0 ? 0 : 1.7)) * bell + 0.035 * Math.sin(a * 9 + u * 31) * bell + 0.02 * (fbm(a * 2 + u * 5, u * 9 + (s > 0 ? 0 : 7)) - 0.5);
      const sag = 0.012 * bell * Math.max(0, -Math.sin(a)); // belly sags downwards
      ring.push(V(centre.x, centre.y + Math.cos(a) * r * fold - sag, centre.z + Math.sin(a) * r * fold));
    }
    rows.push(ring);
  }
  const bind = armBind(kit, A);
  skinGeo(kit, SL.linen, gridGeo(rows, { closed: true, flip: s > 0 }), { bind, color: (p, n) => { const f = fbm(p.x * 16 + p.z * 11, p.y * 14); return col(color).multiplyScalar(0.8 + 0.3 * f + 0.1 * n.y).lerp(col(0x8a7a5a), 0.14 * f); }, ao: 0.35 });
  // gathered cuff band and a ruffled frill that falls over the back of the hand
  const cx = (u) => { const xa = mix(x0, x1, u), cc = axisAt(xa); return V(s * xa, cc.y, cc.z); };
  const band = []; for (const [u, r] of [[0.9, 0.0635], [1.0, 0.0635]]) { const c = cx(u), ring = []; for (let i = 0; i < NS; i++) { const a = (i / NS) * TAU; ring.push(V(c.x, c.y + Math.cos(a) * r, c.z + Math.sin(a) * r)); } band.push(ring); }
  skinGeo(kit, o.cuffSlot ?? SL.linen, gridGeo(band, { closed: true, flip: s > 0 }), { bind, color: () => shade(o.cuffColor ?? color, 0.92), ao: 0.3 });
  if (o.frill !== false) {
    const fr = []; for (let j = 0; j <= 5; j++) { const v = j / 5, c = cx(1.0), ring = []; const xs = s * v * 0.05; for (let i = 0; i < NS * 2; i++) { const a = (i / (NS * 2)) * TAU, r = 0.058 + 0.026 * v + 0.012 * v * Math.sin(a * 11); ring.push(V(c.x + xs, c.y + Math.cos(a) * r - 0.012 * v * v, c.z + Math.sin(a) * r)); } fr.push(ring); }
    skinGeo(kit, SL.linen, gridGeo(fr, { closed: true, flip: s > 0 }), { bind, color: (p, n) => shade(color, 0.85 + 0.2 * n.y), ao: 0.35 });
  }
}

// Bandana over the scalp, knotted at the back with two tails.
export function bandana(ctx, o = {}) {
  const { kit, hs } = ctx, color = o.color ?? 0x9a1c1c, rows = [], NS = 56, NJ = 14;
  for (let j = 0; j <= NJ; j++) {
    const v = j / NJ, el = mix(o.elLow ?? 0.12, 1.45, Math.pow(v, 1.1)), ring = [];
    for (let i = 0; i < NS; i++) {
      const az = (i / NS) * TAU - Math.PI, brow = (o.brow ?? 0.0) * Math.cos(az), e = el + brow * (1 - v);
      const fold = 0.0025 * Math.sin(az * 9 + v * 7) * (1 - v * 0.5);
      ring.push(hs.pt(az, Math.min(e, 1.5), 0.007 + fold + (v < 0.15 ? 0.002 : 0)));
    }
    rows.push(ring);
  }
  const pat = (p) => { const k = 0.8 + 0.3 * fbm(p.x * 90, p.z * 90 + p.y * 40), dots = (Math.sin(p.x * 330) * Math.sin(p.y * 330 + p.z * 330) > 0.8) ? 1 : 0; return col(color).multiplyScalar(k).lerp(col(o.dot ?? 0xe8dcc8), 0.7 * dots); };
  skinGeo(kit, SL.silk, gridGeo(rows, { closed: true, flip: true }), { bind: 'Head', color: pat, ao: 0.3 });
  // knot and two tails at the back
  const knot = hs.pt(Math.PI, 0.18, 0.012), g = new THREE.SphereGeometry(0.018, 10, 8); g.scale(1, 0.8, 1.1); g.translate(knot.x, knot.y, knot.z - 0.004);
  skinGeo(kit, SL.silk, g, { bind: 'Head', color: pat, ao: 0.3 });
  for (const sd of [-1, 1]) {
    const R = [], pts = [knot.clone().add(V(0, -0.005, -0.012)), knot.clone().add(V(sd * 0.025, -0.05, -0.03)), knot.clone().add(V(sd * 0.04, -0.11, -0.04)), knot.clone().add(V(sd * 0.035, -0.17, -0.03))];
    const curve = new THREE.CatmullRomCurve3(pts), P = curve.getPoints(14);
    skinGeo(kit, SL.silk, ribbonGeo(P, (t) => 0.03 + 0.012 * t, 0.003, V(0, 0, 1), { caps: false }), { bind: 'Head', color: pat, ao: 0.3 });
  }
}

// Wide silk sash wound round the waist with a knot at the hip and two fringed tails. o: { color, y, width, knotX }
export function sash(ctx, o = {}) {
  const { kit, surf } = ctx, y = o.y ?? 1.08, w = o.width ?? 0.11, NS = 72, NJ = 6, color = o.color ?? 0x7a1820, cz = 0.012;
  const rows = [];
  for (let j = 0; j <= NJ; j++) {
    const v = j / NJ, ring = [];
    for (let i = 0; i <= NS; i++) {
      const th = (i / NS) * TAU - Math.PI, r = Math.max(nR(ctx, y, th), 0.15) + (o.off ?? 0.018) + 0.012 * Math.sin(v * Math.PI) + 0.006 * Math.sin(th * 14 + v * 5);
      ring.push(V(Math.sin(th) * r, y + (v - 0.5) * w + 0.008 * Math.sin(th * 3 + 1) + 0.01 * Math.sin(th * 1 + 0.5), cz + Math.cos(th) * r));
    }
    rows.push(ring);
  }
  const pat = (p) => { const f = fbm(p.x * 40 + p.z * 40, p.y * 90) , stripe = o.stripe ? (Math.sin(p.y * 260) > 0.6 ? 1 : 0) : 0; return col(color).multiplyScalar(0.72 + 0.4 * f).lerp(col(o.stripe ?? color), 0.5 * stripe); };
  skinGeo(kit, SL.silk, gridGeo(rows, { flip: false }), { bind: 'Hips', color: pat, ao: 0.35 });
  // knot at the hip with two tails
  const kx = (o.knotX ?? 0.2) , kp = V(kx, y - 0.01, 0.07 + 0.0);
  const kn = new THREE.SphereGeometry(0.032, 12, 10); kn.scale(1, 0.9, 1); kn.translate(kp.x + 0.015, kp.y, kp.z); skinGeo(kit, SL.silk, kn, { bind: 'Hips', color: pat, ao: 0.3 });
  for (const [dx, dz, len, lag] of [[0.02, 0.02, 0.3, 0], [0.04, -0.02, 0.24, 1]]) {
    const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(V(kp.x + 0.03 + dx * t + 0.02 * Math.sin(t * 5 + lag), kp.y - t * len, kp.z + dz * t + 0.01 * Math.sin(t * 7))); }
    skinGeo(kit, SL.silk, ribbonGeo(pts, (t) => 0.05 + 0.02 * t, 0.004, V(0, 0, 1), { caps: false }), { bind: [['Hips', 0.6], ['LeftUpLeg', 0.4]], color: pat, ao: 0.35 });
    // fringe
    for (let f = 0; f < 9; f++) { const e = pts[12], ox = (f / 8 - 0.5) * 0.06; skinGeo(kit, SL.silk, tubeGeo([V(e.x + ox, e.y, e.z), V(e.x + ox * 1.1, e.y - 0.03, e.z), V(e.x + ox * 1.15, e.y - 0.06, e.z + 0.004)], 0.0016, 4, 4, {}), { bind: [['Hips', 0.6], ['LeftUpLeg', 0.4]], color: () => col(o.fringe ?? 0xd9b350), ao: 0.2 }); }
  }
}
const nR = (ctx, y, th) => Math.max(ctx.surf(y, th), ctx.surf(y, th + 0.14), ctx.surf(y, th - 0.14), ctx.surf(y + 0.03, th), ctx.surf(y - 0.03, th));

// A coil of rope hung on the belt: a stack of tilted loops.
export function ropeCoil(ctx, at, o = {}) {
  const { kit } = ctx, R = o.r ?? 0.07, turns = o.turns ?? 5, color = o.color ?? 0x9a8458;
  const pts = []; const N = turns * 24;
  for (let i = 0; i <= N; i++) { const t = i / N, a = t * turns * TAU, r = R * (1 - 0.06 * t) ; pts.push(V(at.x + Math.sin(a) * r * 0.2 * 0 + Math.cos(a) * r * (o.ex ?? 0.35), at.y + Math.sin(a) * r, at.z + t * 0.05 - 0.025 + Math.cos(a) * 0.0)); }
  skinGeo(kit, SL.matte, tubeGeo(pts, 0.0105, 8, N, {}), { bind: o.bind || 'Hips', color: (p) => { const a = Math.atan2(p.y - at.y, (p.x - at.x) / (o.ex ?? 0.35)); return col(color).multiplyScalar(0.62 + 0.3 * (0.5 + 0.5 * Math.sin(a * 55 + p.z * 900)) + 0.2 * fbm(p.x * 60, p.y * 60 + p.z * 30)); }, ao: 0.4 });
}

// An open sleeveless leather vest over the shirt: a V front with smooth piped edges, armholes, scalloped hem, brass buttons.
export function vest(ctx, o = {}) {
  const { kit } = ctx, y1 = o.top ?? 1.56, y0 = o.hem ?? 1.01, NJ = 40, NS = 90, cz = 0.012, color = o.color ?? 0x4a2e1a, ow = o.openW ?? 0.015;
  const bind = bodyBind(kit, { legTop: 1.0, legBot: 0.9, maxLeg: 0.3 });
  const edgeX = (y) => ow + 0.05 * Math.pow(clamp((y - 1.04) / 0.5, 0, 1), 0.9) + 0.01;
  const radius = (th, y) => { const [rx, rz] = torsoE(y); let r = (1 / Math.hypot(Math.sin(th) / rx, Math.cos(th) / rz)) * 1.01 + 0.012 + 0.016 * (1 - sstep(y, 1.0, 1.12)); r = mix(r, 0.1, sstep(y, 1.5, 1.58)); return r * (1 + 0.004 * Math.sin(th * 5 + y * 7) + 0.004 * (fbm(th * 3, y * 6) - 0.5)); };
  const topY = (th) => mix(y1 - 0.05 * Math.max(0, -Math.cos(th)) - 0.015 * (1 - sstep(Math.abs(Math.sin(th)), 0.0, 0.6)), 1.37, sstep(Math.abs(Math.sin(th)), 0.45, 0.95));
  const hemY = (th) => y0 - 0.03 * Math.max(0, Math.cos(th)) * Math.pow(Math.abs(Math.cos(th)), 6) + 0.012 * Math.sin(th * 6);
  const P = (u, v) => {
    // th0 chosen from the front-edge position at the row height, then the arc runs round the back
    const y0r = mix(topY(0.0), hemY(0.0), v), te = Math.asin(clamp(edgeX(y0r) / torsoE(y0r)[0], 0, 0.9));
    const th = mix(te, TAU - te, u), y = mix(topY(th), hemY(th), v), r = radius(th, y);
    return V(Math.sin(th) * r, y, cz + Math.cos(th) * r);
  };
  const rows = []; for (let j = 0; j <= NJ; j++) { const row = []; for (let i = 0; i <= NS; i++) row.push(P(i / NS, j / NJ)); rows.push(row); }
  const g = gridGeo(rows, { closed: false, flip: false });
  skinGeo(kit, SL.leather, g, { bind, color: (p, n) => { const f = fbm(p.x * 25 + p.z * 22, p.y * 20), wear = fbm(p.x * 8 + 3, p.y * 8); return col(color).multiplyScalar(0.7 + 0.5 * f).lerp(col(0x8a6a48), 0.35 * Math.max(0, wear - 0.5) * 2); }, ao: 0.35 });
  // lining visible at the edges is not needed: the vest is double-sided via the leather inside being dark
  const path = []; for (let j = 0; j <= NJ; j += 2) path.push(rows[j][0]);
  for (let i = 1; i <= NS; i += 2) path.push(rows[NJ][i]);
  for (let j = NJ - 2; j >= 0; j -= 2) path.push(rows[j][NS]);
  for (let i = NS - 1; i >= 1; i -= 2) path.push(rows[0][i]);
  const pipe = path.map((p) => p.clone());
  for (const seg of [pipe.slice(0, NJ / 2 + 1), pipe.slice(NJ / 2, NJ / 2 + NS / 2 + 1), pipe.slice(NJ / 2 + NS / 2, NJ + NS / 2 + 1), pipe.slice(NJ + NS / 2)]) {
    if (seg.length < 3) continue;
    const out = seg.map((p) => { const d = V(p.x, 0, p.z - cz).normalize(); return p.clone().addScaledVector(d, 0.002); });
    skinGeo(kit, SL.leather, tubeGeo(out, 0.0042, 6, out.length * 2, {}), { bind, color: () => col(o.trim ?? 0x2a190e), ao: 0.3 });
  }
  if (o.buttons !== false) for (const sd of [-1, 1]) for (let k = 3; k < NJ - 3; k += 6) { const q = rows[k][sd > 0 ? 0 : NS]; const b = new THREE.SphereGeometry(0.0085, 8, 6); b.scale(1, 1, 0.55); b.translate(q.x - sd * 0.006, q.y, q.z + 0.004); skinGeo(kit, SL.gilt, b, { bind, color: () => col(0xb08a3a), ao: 0.2 }); }
  return g;
}
