// Armour parts shared by the three knight designs: plate bands around arbitrary axes, rolled edges,
// articulated gauntlet fingers, sabatons, straps and buckles, swords and scabbards.
import * as THREE from 'three';
import { V } from './armor.js';
import { surf, tubeAlong, studs, sp, mix, clamp, sstep, TAU, vnoise, hash, tab } from './knight_kit.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _v = new THREE.Vector3();

// A band (full or partial ring) around a curved axis.
// o: { c: (v) => Vector3 | c0, c1, d (axis dir, optional), ref (zero-angle direction), sgn (+1/-1 turn direction),
//      rA: (v, a) => radius along ref, rB: (v, a) => radius along the tangent, a0, a1, nu, nv, n (section squareness),
//      color, bind, ao, shade, center, flip }
// Returns { pt(u, v, out), o } so rims and rivets can follow the edges.
export function band(kit, slot, o) {
  const c = o.c || ((v) => _v.copy(o.c0).lerp(o.c1, v));
  const a0 = o.a0 ?? 0, a1 = o.a1 ?? TAU, full = Math.abs(a1 - a0 - TAU) < 1e-6, sg = o.sgn ?? 1, nn = o.n ?? 2, e = 2 / nn;
  const dirAt = (v) => { const p = c(Math.min(1, v + 0.01)).clone(), q = c(Math.max(0, v - 0.01)).clone(); return p.sub(q).normalize(); };
  const d0 = o.d ? o.d.clone().normalize() : null;
  const frame = (v) => {
    const d = d0 || dirAt(v);
    const ref = o.ref.clone().addScaledVector(d, -o.ref.dot(d)).normalize();
    const tan = new THREE.Vector3().crossVectors(d, ref).multiplyScalar(sg);
    return [ref, tan];
  };
  const rA = o.rA, rB = o.rB || o.rA;
  const pt = (u, v, out) => {
    const a = a0 + (a1 - a0) * u, [ref, tan] = frame(v), ca = Math.cos(a), sa = Math.sin(a);
    const cc = c(v);
    out.copy(cc).addScaledVector(ref, (e === 1 ? ca : sp(ca, e)) * rA(v, a)).addScaledVector(tan, (e === 1 ? sa : sp(sa, e)) * rB(v, a));
    return out;
  };
  const nu = o.nu ?? 32, nv = o.nv ?? 4;
  const g = surf(kit, slot, nu, nv, (u, v, out) => pt(u, v, out), {
    closed: full, color: o.color, ao: o.ao, bind: o.bind, shade: o.shade, uv: o.uv, uvOff: o.uvOff,
    center: o.center || ((u, v) => c(v)), flip: o.flip,
  });
  return { pt, g, o, full, nu, nv, inside: (u, v) => c(v) };
}
// Wrap any surface function as a band-like object so rims and rivets can follow it.
export const surfObj = (pt, nu, nv, full, inside) => ({ pt, nu, nv, full, o: {}, inside });

// A rolled edge / bead running along a band's v = const boundary (or any u-line).
export function bead(kit, slot, B, v, r, bind, color, o = {}) {
  const pts = [], N = o.N ?? B.nu, uA = o.u0 ?? 0, uB = o.u1 ?? 1;
  const cnt = B.full && uA === 0 && uB === 1 ? N : N + 1;
  for (let i = 0; i < cnt; i++) { const p = new THREE.Vector3(); B.pt(uA + (uB - uA) * (i / N), v, p); pts.push(p); }
  return tubeAlong(kit, slot, pts, r, bind, { closed: B.full && uA === 0 && uB === 1, seg: o.seg ?? 6, color, ao: 0.1, up: o.up });
}
// Bead along the u = const edge of a band (a vertical edge).
export function beadU(kit, slot, B, u, r, bind, color, o = {}) {
  const pts = []; const N = o.N ?? B.nv;
  for (let j = 0; j <= N; j++) { const p = new THREE.Vector3(); B.pt(u, j / N, p); pts.push(p); }
  return tubeAlong(kit, slot, pts, r, bind, { seg: o.seg ?? 6, color, ao: 0.1, caps: true, up: o.up });
}
// Rivet heads placed on a band: pts given as [u, v, outwardOffset].
export function riveted(kit, slot, bone, B, list, r, color, o = {}) {
  const arr = [], p = new THREE.Vector3(), q = new THREE.Vector3(), q2 = new THREE.Vector3();
  for (const [u, v, off = 0.0015] of list) {
    B.pt(u, v, p);
    B.pt(u + 0.002, v, q); B.pt(u, v + 0.004, q2);
    const n = new THREE.Vector3().crossVectors(q.clone().sub(p), q2.clone().sub(p)).normalize();
    const c = B.inside ? B.inside(u, v) : B.o.c ? B.o.c(v) : _v.copy(B.o.c0).lerp(B.o.c1, v);
    if (n.dot(p.clone().sub(c)) < 0) n.negate();
    arr.push({ p: p.clone().addScaledVector(n, off), n: n.clone(), r });
  }
  return studs(kit, slot, bone, arr, r, color, o);
}

// ---- leather strap (flat ribbon) along a path, with a brass buckle option
export function strap(kit, slot, pts, w, th, bind, color, o = {}) {
  return tubeAlong(kit, slot, pts, o.vertical ? [th * 0.5, w * 0.5] : [w * 0.5, th * 0.5], bind, { seg: 10, n: 5, color, ao: 0.2, up: o.up, closed: o.closed });
}
// Rectangular buckle frame at p, facing the outward normal n, pin along the strap. size [w, h].
export function buckle(kit, slot, bone, p, n, up, w, h, color) {
  const side = new THREE.Vector3().crossVectors(up, n).normalize(), u2 = new THREE.Vector3().crossVectors(n, side).normalize();
  const pts = [-1, 1, 2, 3].map(() => 0);
  const c = [[-w, -h], [w, -h], [w, h], [-w, h]].map(([a, b]) => p.clone().addScaledVector(side, a).addScaledVector(u2, b).addScaledVector(n, 0.002));
  tubeAlong(kit, slot, c, 0.0022, () => bone, { closed: true, seg: 6, color, ao: 0.1 });
  tubeAlong(kit, slot, [p.clone().addScaledVector(side, -w * 0.9).addScaledVector(n, 0.003), p.clone().addScaledVector(side, w * 0.9).addScaledVector(n, 0.003)], 0.0017, () => bone, { seg: 6, color, ao: 0.1 });
}

// ---- gauntlet fingers: a ridged tube along each finger chain, bound segment by segment to the finger bones.
export function fingerPlates(kit, slot, A, o = {}) {
  const J = kit.J, s = A === 'Left' ? 1 : -1;
  const color = o.color ?? 0xb4bcc6, rad = o.r ?? 0.0092, lames = o.lames ?? 3;
  for (const f of ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb']) {
    const keys = [1, 2, 3, 4].map((i) => A + 'Hand' + f + i);
    if (!keys.every((k) => kit.has(k))) continue;
    const P = keys.map((k) => J(k));
    // extend the tip a little beyond the last joint
    const tip = P[3].clone().addScaledVector(P[3].clone().sub(P[2]).normalize(), 0.006);
    P.push(tip);
    const base = P[0].clone().addScaledVector(P[1].clone().sub(P[0]).normalize(), -0.012);
    P.unshift(base);
    // sample points: per segment `lames` rings
    const pts = [], segOf = [], radii = [], tt = [];
    const segs = P.length - 1;
    const ff = f === 'Thumb' ? 1.08 : f === 'Pinky' ? 0.86 : f === 'Index' ? 1.0 : 1.0;
    for (let sI = 0; sI < segs; sI++) {
      const cnt = sI === 0 ? 2 : lames * 2;
      for (let k = 0; k < cnt; k++) {
        const t = k / cnt;
        pts.push(P[sI].clone().lerp(P[sI + 1], t)); segOf.push(sI);
        // overlapping lame profile: a step up then a taper along each lame
        const lt = (t * (cnt / 2)) % 1;
        const prof = sI === 0 ? 0.9 : 0.93 + 0.12 * Math.pow(1 - lt, 0.6) * (lt < 0.97 ? 1 : 0);
        radii.push(rad * ff * prof * (1 - 0.1 * (sI / segs)));
      }
    }
    pts.push(P[P.length - 1].clone()); segOf.push(segs - 1); radii.push(rad * ff * 0.55);
    const boneFor = (i) => { const sI = segOf[i]; return keys[Math.min(3, Math.max(0, sI - 1 + (sI === 0 ? 1 : 0)))] ; };
    tubeAlong(kit, slot, pts, (i) => { const j = Math.round(i * (pts.length - 1)); const r = radii[j]; return [r * 1.06, r * 0.8]; }, (p) => {
      // weight by nearest segment along the chain
      let best = 0, bd = 1e9;
      for (let i = 0; i < pts.length; i++) { const d = p.distanceToSquared(pts[i]); if (d < bd) { bd = d; best = i; } }
      return boneFor(best);
    }, { seg: 8, color, ao: 0.2, up: V(0, 0, 1) });
  }
}

// ---- a sword hanging from the belt: scabbard (leather over wood, brass locket and chape), hilt, guard, pommel.
// o: { belt (hilt end of the scabbard), tip, bone, grip, wide, thick, color, hiltColor, cross, side, guard: 'z'|'x' }
export function swordAndScabbard(kit, S, o) {
  const { belt, tip, bone, grip = 0.1, wide = 0.052, thick = 0.026, color = 0x3a2a1c, hiltColor = 0xc9a24a, cross = 0.19, steelC = 0x9aa0a8 } = o;
  const a = belt.clone(), b = tip.clone(), d = b.clone().sub(a).normalize();
  const up = V(0, 0, 1);
  const edge = new THREE.Vector3().crossVectors(d, V(1, 0, 0)).normalize();   // direction of the blade width (front-back)
  const N = 16, pts = []; for (let i = 0; i <= N; i++) pts.push(a.clone().lerp(b, i / N));
  const prof = (t) => { const w = mix(wide, wide * 0.52, Math.pow(t, 0.8)); const th = mix(thick, thick * 0.62, t); return [th * 0.5, w * 0.5]; };
  tubeAlong(kit, S.leather, pts, (t) => prof(t), () => bone, { seg: 14, n: 2.6, color, ao: 0.2, up });
  // stitched seam and a locket / chape in brass
  const lock = [a.clone(), a.clone().lerp(b, 0.1)];
  tubeAlong(kit, S.brass, lock, (t) => { const p = prof(t * 0.1); return [p[0] + 0.0035, p[1] + 0.0035]; }, () => bone, { seg: 14, n: 2.6, color: hiltColor, ao: 0.1, up });
  tubeAlong(kit, S.brass, [a.clone().lerp(b, 0.095), a.clone().lerp(b, 0.105)], (t) => { const p = prof(0.1); return [p[0] + 0.006, p[1] + 0.006]; }, () => bone, { seg: 14, n: 2.6, color: hiltColor, ao: 0.1, up });
  const chape = [a.clone().lerp(b, 0.9), a.clone().lerp(b, 0.97), b.clone()];
  tubeAlong(kit, S.brass, chape, (t) => { const p = prof(0.9 + t * 0.1); return [(p[0] + 0.003) * (1 - 0.7 * Math.pow(t, 3)), (p[1] + 0.003) * (1 - 0.7 * Math.pow(t, 3))]; }, () => bone, { seg: 14, n: 2.6, color: hiltColor, ao: 0.1, up });
  // hilt: wire-bound grip, a straight crossguard with drooping quillons, a wheel pommel
  const g0 = a.clone().addScaledVector(d, -0.02), g1 = a.clone().addScaledVector(d, -(0.02 + grip));
  tubeAlong(kit, S.leather, [g0, g0.clone().lerp(g1, 0.5), g1], [0.0125, 0.0105], () => bone, { seg: 10, color: 0x241812, ao: 0.2, up });
  const gc = g0.clone().addScaledVector(d, 0.006), gp = [-1, -0.5, 0, 0.5, 1].map((k) => gc.clone().addScaledVector(edge, k * cross * 0.5).addScaledVector(d, Math.abs(k) * Math.abs(k) * 0.012));
  tubeAlong(kit, S.brass, gp, (t) => [0.006 + 0.003 * (1 - Math.abs(t - 0.5) * 2), 0.0075], () => bone, { seg: 10, n: 2.4, color: hiltColor, ao: 0.1, up: d });
  const pc = g1.clone().addScaledVector(d, -0.016);
  tubeAlong(kit, S.brass, [g1, g1.clone().addScaledVector(d, -0.006), pc, pc.clone().addScaledVector(d, -0.012)], [0.013, 0.015, 0.018, 0.012], () => bone, { seg: 16, color: hiltColor, ao: 0.1, up });
}

// ---- leather shoe / ankle boot: a shaft up the leg and a closed foot with a thin sole.
export function shoe(kit, S, A, o = {}) {
  const J = kit.J, s = A === 'Left' ? 1 : -1, an = J(A + 'Foot'), color = o.color ?? 0x3a2616, sole = o.sole ?? 0x1c1410, top = o.top ?? 0.2;
  const fx = an.x;
  // rows: z, half width, top height (the sole is the ground plane)
  const FR = [[-0.105, 0.03, 0.07], [-0.07, 0.044, 0.125], [-0.03, 0.052, 0.165], [0.02, 0.052, 0.13], [0.08, 0.05, 0.082], [0.14, 0.044, 0.058], [0.2, 0.032, 0.042], [0.245, 0.016, 0.028], [0.262, 0.004, 0.012]];
  const bindFoot = (p) => (p.z > 0.07 ? [[A + 'ToeBase', 1]] : p.z > 0.03 ? [[A + 'ToeBase', 0.5], [A + 'Foot', 0.5]] : [[A + 'Foot', 1]]);
  surf(kit, S.leather, 28, 32, (u, v, out) => {
    const z = mix(-0.105, 0.262, v), [hx, ht] = tab(FR, z), a = u * TAU, ca = Math.cos(a), sa = Math.sin(a), e = 2 / 2.6;
    out.set(fx + s * 0.004 + hx * sp(sa, e), Math.max(0.002, ht * 0.5 + ht * 0.5 * sp(ca, e)), z);
  }, { closed: true, color: (p) => (p.y < 0.012 ? sole : color), ao: 0.22, bind: bindFoot, center: V(fx, 0.04, 0.08), shade: (p, n, u, v) => 1 - 0.08 * vnoise(p.x * 40, p.z * 40) });
  const LC = (y) => { const a = J(A + 'Leg'), b = J(A + 'Foot'); const t = (a.y - y) / (a.y - b.y); return a.clone().lerp(b, t); };
  surf(kit, S.leather, 28, 10, (u, v, out) => {
    const y = mix(0.07, top, v), c = LC(y), r = mix(0.056, 0.06, v) + 0.0022 * Math.sin(u * TAU * 3 + v * 6) * v, a = u * TAU;
    out.set(c.x + Math.sin(a) * r, y, c.z + Math.cos(a) * r * 1.02);
  }, { closed: true, color, ao: 0.22, bind: (p) => [[A + 'Foot', sstep(p.y, 0.17, 0.09)], [A + 'Leg', 1 - sstep(p.y, 0.17, 0.09)]], shade: (p, n, u, v) => 1 - 0.1 * vnoise(p.x * 30, p.y * 30) });
}
// ---- mail glove: fingers as fat tubes along the finger bones, bound segment by segment.
export function mailGlove(kit, slot, A, color, r = 0.0125) {
  const J = kit.J;
  for (const f of ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb']) {
    const keys = [1, 2, 3, 4].map((i) => A + 'Hand' + f + i);
    if (!keys.every((k) => kit.has(k))) continue;
    const P = keys.map((k) => J(k));
    const tip = P[3].clone().addScaledVector(P[3].clone().sub(P[2]).normalize(), 0.008);
    const pts = [P[0].clone().addScaledVector(P[1].clone().sub(P[0]).normalize(), -0.02)];
    for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) pts.push(P[i].clone().lerp(P[i + 1], k / 3));
    pts.push(P[3].clone(), tip);
    const ff = f === 'Thumb' ? 1.05 : f === 'Pinky' ? 0.85 : 1.0;
    tubeAlong(kit, slot, pts, (t) => { const q = t < 0.1 ? 0.85 : t > 0.93 ? 0.6 : 1; return [r * ff * q, r * ff * q * 0.85]; }, (p) => {
      let best = 0, bd = 1e9; pts.forEach((q, i) => { const d = p.distanceToSquared(q); if (d < bd) { bd = d; best = i; } });
      return keys[Math.min(3, Math.floor((best - 1) / 3))] || keys[0];
    }, { seg: 10, color, ao: 0.2, up: V(0, 0, 1) });
  }
  // palm and back of the hand
  const s = A === 'Left' ? 1 : -1, hand = J(A + 'Hand');
  surf(kit, slot, 20, 10, (u, v, out) => {
    const x = mix(0.69, 0.805, v), a = u * TAU, rr = mix(0.04, 0.034, v);
    out.set(s * x, hand.y + Math.cos(a) * mix(0.03, 0.026, v) - 0.002, -0.05 + Math.sin(a) * (0.052 + 0.006 * Math.sin(v * 3)));
  }, { closed: true, color, ao: 0.2, bind: A + 'Hand' });
}
