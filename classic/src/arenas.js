// Duel Arena variants. World.arenaIdx picks one of DUEL_BIOMES (data.js): 0 Green Plains (the original, built in world.js),
// 1 Sun Dunes, 2 Frostfield. Everything here is deterministic from the match seed and symmetric between the two spawn points
// ((+-34, 0) facing each other), so every client builds the same arena and neither fighter gets the better side.
// All cover is merged into one mesh per material, and the backdrop is instanced, so an arena costs only a handful of draw calls.
import * as THREE from 'three';
import { mulberry32 } from './rng.js';
import * as TX from './textures.js';
import { stoneMat, crystalCluster } from './props.js';
import { softBox, lathe, merge, paint, clamp, noise3 } from './geo.js';

const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Ground height. The meadow is dead flat. Sun Dunes has a sandy plateau in the middle of the ring and big dunes beyond the wall;
// Frostfield is a flat frozen lake with gentle snow hills beyond the wall. Nothing outside the ring is reachable (World.collide).
export const PLATEAU = 3.0; // Sun Dunes: height of the sandy plateau in the middle of the ring
export function duelHeight(idx, x, z) {
  if (!idx) return 0;
  const r = Math.hypot(x, z);
  if (idx === 1) {
    let h = PLATEAU * (1 - sm(5, 14, r));
    const k = sm(44, 92, r) * (1 - 0.45 * sm(125, 178, r));
    if (k > 0) h += k * (9.5 + 4.2 * Math.sin(x * 0.05 + Math.sin(z * 0.031) * 1.8) + 3 * Math.sin(z * 0.045 - x * 0.021 + 1.1) + 1.4 * Math.sin(x * 0.11 + z * 0.09));
    return h;
  }
  const k = sm(52, 105, r) * (1 - 0.4 * sm(120, 175, r));
  return k > 0 ? k * (5 + 2.4 * Math.sin(x * 0.041 + 1.0) + 1.9 * Math.sin(z * 0.036 + x * 0.012) + 0.9 * Math.sin(x * 0.09 - z * 0.07)) : 0;
}

// The pieces the arenas are made of. Each one adds its look to a named geometry group and its physics to the world:
//   drum (flat-topped, or a domed snow drift): a round step you can jump onto (a platform, one jump high) that also stops bullets (a solid)
//   block / pillar / spire: tall enough to hide behind (colliders), and they stop bullets and rockets (solids)
function kit(world) {
  const cx = world.arena.x, cz = world.arena.z;
  const groups = {};
  let seed = 400;
  const put = (grp, g) => (groups[grp] = groups[grp] || []).push(g);
  const shade = (g, h) => paint(g, (xx, yy) => 0.62 + 0.38 * clamp((yy + 0.4) / (h + 0.4)));
  return {
    drum(grp, u, v, r, h, dome = false) {
      const prof = dome
        ? [[r + 1.0, -0.4], [r + 0.6, 0.05], [r + 0.25, h * 0.55], [r - 0.05, h - 0.04], [r - 0.3, h], [0.01, h]]
        : [[r + 0.18, -0.4], [r + 0.1, 0.0], [r, 0.08], [r, h - 0.1], [r - 0.1, h], [0.01, h]];
      const g = lathe(prof, { seg: 28, noiseAmp: dome ? 0.02 : 0.012, seed: seed++, crease: 70, uvScale: 0.3 });
      put(grp, shade(g, h).translate(u, 0, v));
      world.platforms.push({ x: cx + u, z: cz + v, r, top: h });
      world.solids.push({ t: 'c', x: cx + u, z: cz + v, r, top: h });
      world.blobs.push({ x: cx + u, z: cz + v, y: 0, r: r * 1.35 });
    },
    // A slab: len along the angle ang, h tall, th thick, with a plinth and a cap.
    block(grp, u, v, ang, len, h, th, crown) {
      const parts = [
        softBox(len, h, th, { r: 0.14, seed: seed++, uvScale: 0.3 }).translate(0, h / 2 - 0.2, 0),
        softBox(len + 0.7, 0.7, th + 0.7, { r: 0.12, seed: seed++, uvScale: 0.3 }).translate(0, 0.15, 0),
        softBox(len + 0.45, 0.55, th + 0.45, { r: 0.12, seed: seed++, uvScale: 0.3 }).translate(0, h - 0.2, 0),
      ];
      if (crown) parts.push(crown(len, h, th));
      const g = merge(parts);
      paint(g, (xx, yy) => 0.6 + 0.4 * clamp((yy + 0.2) / h));
      put(grp, g.rotateY(-ang).translate(u, 0, v));
      const c = Math.cos(ang), s = Math.sin(ang);
      world.solids.push({ t: 'b', x: cx + u, z: cz + v, hx: len / 2, hz: th / 2, c, s, top: h - 0.2 });
      for (let d = -len / 2 + 0.6; d <= len / 2 - 0.6 + 1e-6; d += 1.2) world.addCollider(cx + u + c * d, cz + v + s * d, th / 2 + 0.2);
      world.blobs.push({ x: cx + u, z: cz + v, y: 0, r: Math.max(len, th) * 0.62 });
    },
    // A fluted column with a base and a capital, or (broken) a jagged stump.
    pillar(grp, u, v, r, h, broken) {
      const col = lathe([[r * 1.25, -0.4], [r * 1.25, 0.2], [r * 1.0, 0.7], [r * 0.93, h * 0.5], [r * 0.9, h - 0.8], [r * 1.0, h - 0.4], [r * 1.0, h], [0.01, h]], { seg: 20, lobes: 10, lobeAmp: 0.035, noiseAmp: 0.02, seed: seed++, crease: 60, uvScale: 0.3 });
      const parts = [col, softBox(r * 3.0, 0.55, r * 3.0, { r: 0.1, seed: seed++, uvScale: 0.3 }).translate(0, 0.0, 0)];
      if (broken) {
        const p = col.attributes.position, nz = noise3(seed++);
        for (let k = 0; k < p.count; k++) { const yy = p.getY(k); if (yy > h - 1.6) p.setY(k, yy - Math.max(0, nz.fbm(p.getX(k) * 2, 3, p.getZ(k) * 2, 3) - 0.3) * 3 * ((yy - h + 1.6) / 1.6)); }
      } else parts.push(softBox(r * 2.7, 0.6, r * 2.7, { r: 0.1, seed: seed++, uvScale: 0.3 }).translate(0, h + 0.15, 0));
      const g = merge(parts);
      paint(g, (xx, yy) => 0.55 + 0.45 * clamp((yy + 0.4) / 3));
      put(grp, g.translate(u, 0, v));
      world.addCollider(cx + u, cz + v, r * 1.05);
      world.solids.push({ t: 'c', x: cx + u, z: cz + v, r: r * 1.05, top: h });
      world.blobs.push({ x: cx + u, z: cz + v, y: 0, r: r * 2 });
    },
    // A six-sided ice spire with a pointed tip.
    spire(grp, u, v, r, h) {
      const g = lathe([[r * 1.2, -0.4], [r * 1.0, 0.3], [r * 0.96, h * 0.76], [0.01, h]], { seg: 6, seed: seed++, crease: 30 });
      paint(g, (xx, yy) => 0.7 + 0.3 * clamp((yy + 0.4) / (h * 0.5)));
      put(grp, g.translate(u, 0, v));
      world.addCollider(cx + u, cz + v, r * 0.95);
      world.solids.push({ t: 'c', x: cx + u, z: cz + v, r: r * 0.88, top: h * 0.72 });
      world.blobs.push({ x: cx + u, z: cz + v, y: 0, r: r * 2 });
    },
    mesh(grp, mat) {
      const m = new THREE.Mesh(merge(groups[grp]), mat);
      m.castShadow = m.receiveShadow = true;
      world.group.add(m);
      return m;
    },
  };
}

// Sun Dunes: a sunlit sandstone ruin. A sandy plateau (the ground itself, see duelHeight) with a sun disc, a ring of
// slabs round it, tall columns in front of each fighter and low steps to hop on. Open in the middle, covered at the edges.
export function buildDunes(world) {
  const k = kit(world);
  const stone = stoneMat(world.biome.stone);
  world.runeDecal(world.arena.x, PLATEAU + 0.08, world.arena.z, 12, world.biome.rune);
  for (const [u, v, broken] of [[24.5, 0, 0], [-24.5, 0, 0], [0, 26, 1], [0, -26, 1]]) k.pillar('stone', u, v, 1.55, broken ? 7.2 : 9.6, !!broken);
  for (const su of [1, -1]) for (const sv of [1, -1]) {
    const u = 17.5 * su, v = 12.5 * sv;
    k.block('stone', u, v, Math.atan2(v, u) + Math.PI / 2, 6.6, 4.8, 3.0);
    k.drum('stone', 9 * su, 21 * sv, 2.8, 1.1);
    k.drum('stone', 31 * su, 12 * sv, 2.4, 1.1);
  }
  k.mesh('stone', stone);
}

// Frostfield: a frozen lake. Four ice walls point at the middle like spokes, a crystal spire stands in the centre, a block of ice
// guards each fighter's flank and low snow drifts make steps. The lanes along both axes stay open.
export function buildFrost(world) {
  const k = kit(world);
  const im = TX.iceMaps();
  const ice = new THREE.MeshStandardMaterial({ color: 0xb8deff, map: im.map, normalMap: im.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), vertexColors: true, roughness: 0.2, metalness: 0.05, envMapIntensity: 1.25, emissive: 0x2f6fa8, emissiveIntensity: 0.22 });
  const snow = new THREE.MeshStandardMaterial({ color: 0xf6f9ff, vertexColors: true, roughness: 0.85, metalness: 0 });
  const crown = (len, h) => crystalCluster(11, 4, 1.1).translate(0, h - 0.1, 0);
  k.spire('ice', 0, 0, 2.2, 11);
  for (const su of [1, -1]) for (const sv of [1, -1]) {
    k.spire('ice', 4.6 * su, 4.6 * sv, 1.0, 6.5);
    const u = 13.5 * su, v = 13.5 * sv;
    k.block('ice', u, v, Math.atan2(v, u), 11, 4.8, 1.8);
    k.block('ice', 29 * su, 13 * sv, 0.5 * su * sv, 5.4, 5.0, 5.4, crown);
    k.drum('snow', 8 * su, 22 * sv, 3.4, 1.1, true);
    k.drum('snow', 22 * su, 4 * sv, 3.0, 1.1, true);
  }
  k.mesh('ice', ice);
  k.mesh('snow', snow);
}

// ---------- backdrop: buttes round the dunes, ice crystals and pine groves round the lake ----------
// Placed far outside the wall on the hills, instanced and cast-shadow-free; these never matter for play.
function butte(R, H, seed) {
  const g = lathe([[R * 1.3, -3], [R * 1.2, 0], [R, H * 0.22], [R * 1.07, H * 0.24], [R * 0.9, H * 0.5], [R * 0.97, H * 0.52], [R * 0.8, H * 0.8], [R * 0.85, H * 0.82], [R * 0.76, H * 0.98], [0.01, H]], { seg: 22, lobes: 7, lobeAmp: 0.05, noiseAmp: 0.05, seed, crease: 60 });
  const nz = noise3(seed + 5);
  paint(g, (x, y, z) => {
    const b = 0.5 + 0.5 * Math.sin(y * (30 / H) * 1.1 + nz.fbm(x * 0.2, y * 0.2, z * 0.2, 2) * 4);
    const w = clamp((y + 3) / (H * 0.3));
    return [(1 - 0.16 * b + 0.04) * (0.6 + 0.4 * w), (1 - 0.3 * b) * (0.6 + 0.4 * w), (1 - 0.46 * b) * (0.6 + 0.4 * w)];
  });
  return g;
}

function pine(seed) {
  const g = lathe([[0.01, 0], [0.3, 0], [0.3, 1.3], [2.1, 1.3], [0.8, 3.3], [1.6, 3.1], [0.6, 5.1], [1.15, 4.9], [0.3, 6.9], [0.01, 7.6]], { seg: 8, noiseAmp: 0.04, seed, crease: 30 });
  paint(g, (x, y, z, nx, ny) => (y < 1.3 ? [0.4, 0.3, 0.22] : ny > 0.55 ? [0.96, 0.98, 1.0] : [0.12 + 0.08 * clamp((y - 1.3) / 6), 0.46, 0.3]));
  return g;
}

export function buildDuelScenery(world) {
  const id = world.biome.id, Q = world.quality;
  const rnd = mulberry32(world.seed * 29 + 77);
  // One InstancedMesh per backdrop piece (not split into cells like the gameplay props): a few dozen instances ringing the arena
  // are always about half in view, so splitting them only multiplies the draw calls.
  const put = (geo, mat, list) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => im.setMatrixAt(i, it.m));
    im.computeBoundingSphere();
    world.group.add(im);
  };
  const spot = (a, d, s, sink, tilt = 0) => {
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, world.heightAt(x, z) - sink * s, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * tilt, rnd() * 6.28, (rnd() - 0.5) * tilt)), new THREE.Vector3(s, s, s));
    return { m, x, z };
  };
  if (id === 'dunes') {
    const stone = stoneMat(world.biome.stone);
    const wide = [], tall = [];
    const n = [7, 9, 11][Q];
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.2 + rnd() * 0.6) / n) * Math.PI * 2, d = 112 + rnd() * 26;
      (i % 2 ? tall : wide).push(spot(a, d, 0.8 + rnd() * 0.9, 0.12));
    }
    put(butte(9, 13, 3), stone, wide);
    put(butte(5, 20, 7), stone, tall);
  } else {
    const crystal = new THREE.MeshStandardMaterial({ color: 0xcfeaff, vertexColors: true, emissive: 0x4a90d0, emissiveIntensity: 0.35, roughness: 0.15, metalness: 0, envMapIntensity: 1.5, flatShading: true });
    const cl = [], nc = [10, 14, 18][Q];
    for (let i = 0; i < nc; i++) cl.push(spot(((i + 0.2 + rnd() * 0.6) / nc) * Math.PI * 2, 84 + rnd() * 42, 4.5 + rnd() * 6, 0.1, 0.3));
    put(crystalCluster(3, 6, 1), crystal, cl);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
    const trees = [], groves = [6, 8, 10][Q];
    for (let i = 0; i < groves; i++) {
      const a = ((i + 0.5 + (rnd() - 0.5) * 0.5) / groves) * Math.PI * 2, d = 68 + rnd() * 52, cxg = Math.cos(a) * d, czg = Math.sin(a) * d;
      for (let j = 0; j < 5; j++) {
        const ox = cxg + (rnd() - 0.5) * 18, oz = czg + (rnd() - 0.5) * 18;
        trees.push(spot(Math.atan2(oz, ox), Math.hypot(ox, oz), 1.0 + rnd() * 1.1, 0.05, 0.1));
      }
    }
    put(pine(5), mat, trees);
  }
}
