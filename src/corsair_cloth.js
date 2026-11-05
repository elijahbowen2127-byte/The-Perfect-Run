// Cloth pieces for the pirate captain: frock-coat skirts with pleats, turned-back cuffs, a ruffled jabot, baldric,
// belts, sash. All conform to the veteran's own tailoring via ctx.surf (radius of his jacket per height and angle).
import * as THREE from 'three';
import { V } from './armor.js';
import * as K from './corsair_lib.js';
import { SL } from './corsair_base.js';
const { TAU, sstep, clamp, mix, fbm, vnoise, skinGeo, gridGeo, surfGeo, ribbonGeo, tubeGeo, bodyBind, col, shade } = K;

// Coat skirt: two sheets (character's left and right) hanging from the waist seam, open at the front (cut-away)
// and vented at the back. o: { y0, cz, hemF, hemS, hemB, flare:[rx,rz], openTop, openHem, vent, fold, color, color2, trim }
// Returns edge curves { front: [R, L], hem: [R, L], vent: [R, L] } for lace trim.
export function coatSkirt(ctx, o) {
  const { kit, surf } = ctx, cz = o.cz ?? 0.012, y0 = o.y0 ?? 1.12;
  const NT = o.nt ?? 26, NJ = o.nj ?? 42, bind = bodyBind(kit, { legTop: 1.04, legBot: 0.7, maxLeg: 0.8, spread: 0.14 });
  const hem = (th) => { // hem height by angle (0 front, pi back): rises at the cut-away front, lowest at the back
    const c = Math.cos(th);
    return mix(o.hemS ?? 0.62, c > 0 ? (o.hemF ?? 0.7) : (o.hemB ?? 0.52), Math.pow(Math.abs(c), 1.3));
  };
  const edges = { front: {}, hem: {}, vent: {} };
  const rad = (th, t, y) => {
    const base = Math.max(surf(y0, th), 0.15) * 0.97;
    const fl = (o.flare ?? [0.5, 0.45]);
    const sn = Math.abs(Math.sin(th)), f = Math.pow(t, o.flareP ?? 1.15), sidePleat = Math.exp(-Math.pow((Math.abs(th) - 1.75) / 0.3, 2)) + Math.exp(-Math.pow((Math.abs(th) - 2.6) / 0.22, 2)) * 0.6;
    let r = base * (1 + (fl[0] * sn + fl[1] * (1 - sn)) * f) + (o.minOut ?? 0.035) * sstep(t, 0.02, 0.2);
    const A = (o.fold ?? 1) * (0.006 + 0.035 * Math.pow(t, 1.2));
    r *= 1 + A * (Math.sin(th * 7.0 + 0.4 + 1.4 * Math.sin(th * 2.3)) * 0.65 + Math.sin(th * 13.0 + 2.0) * 0.25) + 0.13 * f * sidePleat * (o.fold ?? 1) * (0.8 + 0.4 * Math.sin(th * 21.0)) + 0.012 * (fbm(th * 4.0, t * 6.0) - 0.5) * f * 4.0;
    return r;
  };
  const sheet = (s) => {
    const rows = [], cols = [];
    for (let j = 0; j <= NJ; j++) {
      const t = j / NJ, row = [];
      for (let i = 0; i <= NT; i++) {
        const u = i / NT;
        const te = (o.openTop ?? 0.5) + ((o.openHem ?? 1.15) - (o.openTop ?? 0.5)) * Math.pow(t, 1.4), tv = Math.PI - ((o.vent ?? 0.1) * sstep(t, 0.3, 1.0) - 0.05 * (1 - sstep(t, 0.3, 0.8)));
        const th = mix(te, tv, u), hh = hem(th), y = y0 - (y0 - hh) * t + (o.sag ?? 0.0) * Math.sin(th * 5) * t;
        const r = rad(th, t, y);
        row.push(V(s * Math.sin(th) * r, y, cz + Math.cos(th) * r));
      }
      rows.push(row);
    }
    return rows;
  };
  const trimPts = [];
  for (const s of [1, -1]) {
    const rows = sheet(s), g = gridGeo(rows, { flip: s < 0 });
    skinGeo(kit, SL.wool, g, {
      bind,
      color: (p, n) => {
        const th = Math.atan2(p.x, p.z - cz), t = clamp((y0 - p.y) / (y0 - 0.55), 0, 1), f = fbm(p.x * 22 + p.z * 9, p.y * 14);
        let c = col(o.color).multiplyScalar(0.84 + 0.3 * f);
        const dim = 0.86 + 0.14 * Math.cos(th * 7.0 + 0.4 + 1.4 * Math.sin(th * 2.3)) * (1 - 0.4 * t); // fold shading
        c.multiplyScalar(dim);
        return c;
      }, ao: 0.32,
    });
    edges.front[s] = rows.map((r) => r[0]); edges.hem[s] = rows[NJ].slice(); edges.vent[s] = rows.map((r) => r[NT]);
  }
  edges.sideX = (y) => { let m = 0; for (let k = 0; k <= 24; k++) { const th = 1.0 + k * 0.06, hh = hem(th), t = clamp((y0 - y) / (y0 - hh), 0, 1); m = Math.max(m, rad(th, t, Math.max(y, hh)) * Math.sin(th)); } return m; };
  edges.hemY = hem;
  edges.pt = (s, th, y, off = 0) => { const t = clamp((y0 - y) / (y0 - hem(th)), 0, 1), r = rad(th, t, y) + off; return V(s * Math.sin(th) * r, y, cz + Math.cos(th) * r); };
  return edges;
}

// A flat lace/braid band along a polyline, lying on the cloth: width w, with a woven diamond pattern in vertex colours.
export function laceBand(ctx, pts, w, { color = 0xd9b350, dark = 0x6a4a18, slot = SL.gilt, bind, off = 0.003, thick = 0.003, pattern = 0.014, normal = false } = {}) {
  const { kit } = ctx;
  // offset the band outward by `off` along an outward estimate (away from the body axis)
  const P = pts.map((p) => { const d = V(p.x, 0, p.z - 0.012); if (d.lengthSq() > 1e-6) d.normalize(); return p.clone().addScaledVector(d, off); });
  const g = ribbonGeo(P, w, thick, normal ? (p) => V(p.x, 0, p.z - 0.012).normalize() : V(0, 1, 0));
  let dist = 0; const acc = [0]; for (let i = 1; i < P.length; i++) acc.push(acc[i - 1] + P[i].distanceTo(P[i - 1]));
  skinGeo(kit, slot, g, {
    bind: bind || bodyBind(kit, { legTop: 1.04, legBot: 0.7, maxLeg: 0.8, spread: 0.14 }),
    color: (p) => { let best = 0, bd = 1e9; for (let i = 0; i < P.length; i += 1) { const d = p.distanceToSquared(P[i]); if (d < bd) { bd = d; best = i; } } const ph = (acc[best] / pattern) % 1; return col(color).lerp(col(dark), 0.55 * Math.abs(Math.sin(ph * Math.PI))); },
    ao: 0.2,
  });
}

// Turned-back cuff on a forearm: a flared band with a gold lace edge and buttons. A = 'Left' | 'Right'.
export function cuff(ctx, A, o) {
  const { kit, J } = ctx, s = A === 'Left' ? 1 : -1;
  const el = J(A + 'ForeArm'), wr = J(A + 'Hand'), ax = wr.clone().sub(el), len = ax.length(), dir = ax.clone().normalize();
  const x0 = o.from ?? 0.58, x1 = o.to ?? 0.7, rows = [], NS = 28, NJ = 14;
  const cen = (x) => el.clone().addScaledVector(dir, (x - el.x * s) * s / dir.x / s * 1) ;
  const at = (xa) => { const t = (xa * s - el.x * s) / (wr.x * s - el.x * s); return el.clone().lerp(wr, t); };
  const bnd = (p) => { const t = sstep(Math.abs(p.x), Math.abs(el.x) - 0.07, Math.abs(el.x) + 0.07); return [[A + 'Arm', 1 - t], [A + 'ForeArm', t]]; };
  const prof = (u) => { // u 0..1 from the elbow side to the wrist edge -> radius
    const flare = o.flare ?? 0.03;
    return (o.r0 ?? 0.064) + flare * Math.pow(u, 1.7) + 0.004 * Math.sin(u * Math.PI);
  };
  for (let j = 0; j <= NJ; j++) {
    const u = j / NJ, xa = s * mix(x0, x1, u), c = at(xa), r = prof(u), row = [];
    for (let k = 0; k < NS; k++) { const a = (k / NS) * TAU; row.push(V(c.x, c.y + Math.cos(a) * r * 0.98, c.z + Math.sin(a) * r * 1.04)); }
    rows.push(row);
  }
  const edgeRing = (u, rr) => { const xa = s * mix(x0, x1, u), c = at(xa), row = []; for (let k = 0; k < NS; k++) { const a = (k / NS) * TAU; row.push(V(c.x, c.y + Math.cos(a) * rr * 0.98, c.z + Math.sin(a) * rr * 1.04)); } return row; };
  const g = gridGeo(rows, { closed: true, flip: s > 0 });
  skinGeo(kit, o.slot ?? SL.wool, g, { bind: bnd, color: (p) => col(o.color).multiplyScalar(0.85 + 0.3 * fbm(p.x * 25 + p.z * 9, p.y * 25)), ao: 0.3 });
  // roll at the open edge and the elbow edge
  for (const [u, rr, th] of [[1, prof(1) + 0.002, 0.006], [0.0, prof(0) + 0.002, 0.005]]) {
    const xa = s * mix(x0, x1, u), c = at(xa), tg = new THREE.TorusGeometry(rr, th, 6, 28);
    tg.scale(1.04, 0.98, 1); tg.rotateY(Math.PI / 2); tg.translate(c.x, c.y, c.z);
    skinGeo(kit, o.trimSlot ?? SL.gilt, tg, { bind: bnd, color: () => col(o.trim ?? 0xd9b350), ao: 0.15 });
  }
  // buttons along the outer-top of the cuff
  for (let k = 0; k < (o.buttons ?? 3); k++) {
    const u = 0.35 + k * 0.2, xa = s * mix(x0, x1, u), c = at(xa), r = prof(u) + 0.002;
    const sp = new THREE.SphereGeometry(0.0075, 10, 8); sp.scale(1, 1, 0.8);
    sp.translate(c.x, c.y + r * 0.98 * Math.cos(0.1), c.z - r * 1.04 * 0.995 * 0 + 0);
    const gg = new THREE.SphereGeometry(0.0075, 10, 8); gg.translate(c.x, c.y + r, c.z + 0.0);
    skinGeo(kit, SL.gilt, gg, { bind: bnd, color: () => col(o.trim ?? 0xd9b350), ao: 0.1 });
  }
}

// A pocket flap on the skirt: a slanted rectangle of cloth with a gold-laced edge and buttons. s: side, th: angle, y: top height.
export function pocketFlap(ctx, ed, s, th, yTop, o = {}) {
  const { kit } = ctx, bind = bodyBind(kit, { legTop: 1.04, legBot: 0.7, maxLeg: 0.8, spread: 0.14 });
  const w = o.w ?? 0.2, h = o.h ?? 0.065, rows = [];
  for (let j = 0; j <= 4; j++) {
    const v = j / 4, row = [];
    for (let i = 0; i <= 10; i++) {
      const u = i / 10 * 2 - 1, a = th + u * w * 0.5, y = yTop - v * h - (o.slant ?? 0.02) * (u * 0.5 + 0.5) - 0.006 * Math.pow(v, 2) * 0;
      row.push(ed.pt(s, a, y, 0.006 + 0.006 * v));
    }
    rows.push(row);
  }
  skinGeo(kit, SL.wool, gridGeo(rows, { flip: s < 0 }), { bind, color: () => col(o.color).multiplyScalar(0.95), ao: 0.3 });
  const edge = []; for (let i = 0; i <= 10; i++) edge.push(rows[4][i].clone()); const left = rows.map((r) => r[0].clone()), right = rows.map((r) => r[10].clone());
  const top = rows[0].map((p) => p.clone());
  for (const path of [edge, left.reverse(), right]) laceBand(ctx, path, 0.012, { color: o.trim ?? 0xd9b350, off: 0.002, pattern: 0.01, thick: 0.0025 });
  for (let k = 0; k < (o.buttons ?? 3); k++) { const p = rows[0][Math.round(2 + k * 3)].clone(); const q = rows[4][Math.round(2 + k * 3)].clone(); const m = p.lerp(q, 0.55); const g = new THREE.SphereGeometry(0.0085, 10, 8); const nrm = V(m.x, 0, m.z - 0.012).normalize(); g.translate(m.x + nrm.x * 0.004, m.y, m.z + nrm.z * 0.004); skinGeo(kit, SL.gilt, g, { bind, color: () => o.trim ?? 0xd9b350, ao: 0.1 }); }
}

// A row of gold buttons along a polyline.
export function buttonRow(ctx, pts, every, r, o = {}) {
  const { kit } = ctx, bind = o.bind || bodyBind(kit, { legTop: 1.04, legBot: 0.7, maxLeg: 0.8, spread: 0.14 });
  let acc = 0, next = o.start ?? 0.02;
  for (let i = 1; i < pts.length; i++) {
    const seg = pts[i].distanceTo(pts[i - 1]);
    while (acc + seg >= next) {
      const p = pts[i - 1].clone().lerp(pts[i], (next - acc) / seg), n = V(p.x, 0, p.z - 0.012).normalize();
      const g = new THREE.SphereGeometry(r, 10, 8); g.scale(1, 1, 0.8); g.translate(p.x + n.x * (o.off ?? 0.004), p.y, p.z + n.z * (o.off ?? 0.004));
      skinGeo(kit, SL.gilt, g, { bind, color: () => o.color ?? 0xd9b350, ao: 0.1 }); next += every;
    }
    acc += seg;
  }
}
