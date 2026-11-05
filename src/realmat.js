// Realistic surface materials for the hand-built heroes (knight, samurai, ninja, corsair, quill).
// Kit geometry has no UVs, so every pattern is triplanar in object space and drives a bump normal, a
// cavity tint and a roughness variation. Vertex colours still carry the base colour and baked occlusion.
//   real('steel' | 'plate' | 'gilt' | 'cloth' | 'wool' | 'silk' | 'leather' | 'lacquer' | 'felt' | 'rope' | 'bone', { scale, bump })
import * as THREE from 'three';

const KINDS = {
  // plate steel: forged and polished, with fine brushing, shallow hammer dents and scratches
  steel: { metal: 0.92, rough: 0.34, rv: 0.28, bump: 0.18, sc: 1, h: 'steel', cav: 0.3 },
  // darker blackened or lacquered-iron plate
  plate: { metal: 0.85, rough: 0.46, rv: 0.3, bump: 0.18, sc: 1, h: 'steel', cav: 0.4 },
  gilt: { metal: 1, rough: 0.3, rv: 0.2, bump: 0.25, sc: 1, h: 'steel', cav: 0.3 },
  // woven linen / cotton: a visible twill
  cloth: { metal: 0, rough: 0.9, rv: 0.1, bump: 0.12, sc: 0.45, h: 'twill', cav: 0.5, sheen: 0.35 },
  // heavier wool / broadcloth: coarser and fuzzier
  wool: { metal: 0, rough: 0.96, rv: 0.1, bump: 0.2, sc: 0.35, h: 'twill', cav: 0.5, sheen: 0.55 },
  // silk and satin: a fine weave with a sheen
  silk: { metal: 0, rough: 0.5, rv: 0.2, bump: 0.08, sc: 0.6, h: 'twill', cav: 0.2, sheen: 1 },
  leather: { metal: 0.02, rough: 0.58, rv: 0.28, bump: 0.5, sc: 1, h: 'leather', cav: 0.55 },
  // urushi lacquer over iron: deep gloss, barely any surface detail
  lacquer: { metal: 0.15, rough: 0.16, rv: 0.06, bump: 0.12, sc: 1, h: 'steel', cav: 0.15, clear: 0.9 },
  felt: { metal: 0, rough: 1, rv: 0.05, bump: 0.7, sc: 0.8, h: 'felt', cav: 0.4, sheen: 0.4 },
  rope: { metal: 0, rough: 0.95, rv: 0.1, bump: 1.2, sc: 1.2, h: 'rope', cav: 0.6 },
  bone: { metal: 0, rough: 0.7, rv: 0.15, bump: 0.4, sc: 1, h: 'leather', cav: 0.4 },
  // bare skin: fine pores over soft wrinkle noise, a faint sheen and a thin glossy film
  skin: { metal: 0, rough: 0.5, rv: 0.22, bump: 0.16, sc: 1.6, h: 'leather', cav: 0.1, sheen: 0.8, clear: 0.18, ccr: 0.32 },
};

const GLSL = `
varying vec3 rmP; varying vec3 rmN;
float rmH;
float rh3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float rn3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(rh3(i), rh3(i + vec3(1,0,0)), f.x), mix(rh3(i + vec3(0,1,0)), rh3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(rh3(i + vec3(0,0,1)), rh3(i + vec3(1,0,1)), f.x), mix(rh3(i + vec3(0,1,1)), rh3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float rfbm(vec3 p){ return rn3(p) * 0.55 + rn3(p * 2.03 + 7.1) * 0.3 + rn3(p * 4.1 + 3.3) * 0.15; }
// plane patterns: u in "cells"
float rTwill(vec2 u){ float a = sin((u.x + u.y) * 6.2832) * 0.5 + 0.5; float t = sin(u.x * 6.2832) * sin(u.y * 6.2832); return a * 0.6 + t * 0.25; }
float rLeather(vec2 u){ vec2 i = floor(u), f = fract(u); float d = 9.0; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 o = vec2(rh3(vec3(i + g, 1.0)), rh3(vec3(i + g, 5.0))); d = min(d, length(g + o - f)); } return smoothstep(0.0, 0.55, d); }
float rRope(vec2 u){ return sin((u.x * 1.0 + u.y * 3.0) * 6.2832) * 0.5 + 0.5; }
float rHeight(vec3 p, vec3 w, int kind, float sc) {
  if (kind == 0) { // steel: brushing along local Y, hammer dents, hairline scratches
    float brush = rn3(vec3(p.x * 150.0, p.y * 6.0, p.z * 150.0) * sc);
    float dent = rfbm(p * 22.0 * sc);
    float scr = smoothstep(0.93, 1.0, rn3(vec3(p.x * 60.0 + p.y * 40.0, p.z * 20.0, p.y * 60.0) * sc));
    return brush * 0.1 + dent * 0.6 - scr * 0.25;
  }
  if (kind == 1) { float u = 60.0 * sc; return (rTwill(p.yz * u) * w.x + rTwill(p.xz * u) * w.y + rTwill(p.xy * u) * w.z) * 0.8 + rfbm(p * 40.0) * 0.2; }
  if (kind == 2) { float u = 30.0 * sc; return (rLeather(p.yz * u) * w.x + rLeather(p.xz * u) * w.y + rLeather(p.xy * u) * w.z) * 0.7 + rfbm(p * 25.0) * 0.3; }
  if (kind == 3) { return rfbm(p * 45.0 * sc) * 0.7 + rn3(p * 110.0 * sc) * 0.3; }
  float u = 45.0 * sc; return (rRope(p.yz * u) * w.x + rRope(p.xz * u) * w.y + rRope(p.xy * u) * w.z);
}
vec3 rPerturb(vec3 surfPos, vec3 surfNorm, vec2 dH, float faceDir) {
  vec3 sx = normalize(dFdx(surfPos)), sy = normalize(dFdy(surfPos));
  vec3 r1 = cross(sy, surfNorm), r2 = cross(surfNorm, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}
`;

const cache = new Map();
export function real(kind = 'steel', { scale, bump, rough, metal } = {}) {
  const K = KINDS[kind] || KINDS.steel;
  const key = [kind, scale, bump, rough, metal].join('|');
  if (cache.has(key)) return cache.get(key);
  const hk = { steel: 0, twill: 1, leather: 2, felt: 3, rope: 4 }[K.h];
  const sc = (scale || 1) * K.sc, bp = (bump == null ? 1 : bump) * K.bump;
  const Mat = K.clear ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const m = new Mat({ vertexColors: true, color: 0xffffff, metalness: metal ?? K.metal, roughness: rough ?? K.rough });
  if (K.clear) { m.clearcoat = K.clear; m.clearcoatRoughness = K.ccr ?? 0.08; }
  if (K.sheen) { m.sheen = K.sheen; m.sheenRoughness = 0.5; m.sheenColor = new THREE.Color(0.7, 0.7, 0.7); }
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 rmP; varying vec3 rmN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nrmP = position; rmN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 rmW = pow(abs(normalize(rmN)), vec3(4.0)); rmW /= (rmW.x + rmW.y + rmW.z);
        rmH = rHeight(rmP, rmW, ${hk}, ${sc.toFixed(3)});
        float rmCav = rmH - 0.5;
        diffuseColor.rgb *= 1.0 + rmCav * ${K.cav.toFixed(2)};`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * (1.0 + (rmH - 0.5) * ${(K.rv * 2).toFixed(2)}), 0.04, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = rPerturb(-vViewPosition, normal, vec2(dFdx(rmH), dFdy(rmH)) * ${(bp * 0.6).toFixed(3)} * 9.0, faceDirection);`);
  };
  m.customProgramCacheKey = () => 'real' + key;
  cache.set(key, m);
  return m;
}
