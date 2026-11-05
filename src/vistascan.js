// Scan build: the title valley re-dressed with photo-scanned surfaces (Poly Haven, CC0).
//  - the land gets real grass, cliff rock, snow and river gravel textures instead of flat vertex colour
//  - the cone trees become the game's own pines; scanned boulders, logs and stumps sit round the pool
//  - grass tufts across the near meadow, clearer air so the cliff reads at distance
import * as THREE from 'three';
import { FALLS, makeHeight } from './vista.js';
import { propLibrary } from './props.js';
import * as TX from './textures.js';
import { groundTex, scanReady, scanGeo, scanMat, scanVariants, SCAN_ON } from './scan.js';

const LAND_PARS = /* glsl */ `
uniform sampler2D gA, gR, gS, gG, nA, nR, nS, nG;
uniform float uOn;
varying vec3 vWP; varying vec3 vWN; varying vec4 vLW;
vec4 tri(sampler2D t, vec3 p, vec3 w, float k) { return texture2D(t, p.zy * k) * w.x + texture2D(t, p.xz * k) * w.y + texture2D(t, p.xy * k) * w.z; }
`;
const LAND_MAP = /* glsl */ `
  vec3 lw = vLW.xyz; float lg = vLW.w;
  vec3 tw = pow(abs(normalize(vWN)), vec3(4.0)); tw /= (tw.x + tw.y + tw.z);
  vec2 gp = vWP.xz;
  float far = smoothstep(60.0, 220.0, length(cameraPosition - vWP));
  vec4 cA = mix(texture2D(gA, gp / 3.2), texture2D(gA, gp / 13.0 + 0.37), 0.35 + far * 0.4);
  vec4 cR = mix(tri(gR, vWP, tw, 1.0 / 6.0), tri(gR, vWP, tw, 1.0 / 23.0), 0.45 + far * 0.25);
  vec4 cS = texture2D(gS, gp / 5.0);
  vec4 cG = texture2D(gG, gp / 2.6);
  float wA = max(0.0, 1.0 - lw.x - lw.y - lg);
  vec4 wv = vec4(wA, lw.x, lw.y, lg);
  vec4 hh = vec4(cA.a, cR.a, cS.a, cG.a);
  vec4 sc = wv + hh * 0.4 * sqrt(wv);
  float mx = max(max(sc.x, sc.y), max(sc.z, sc.w));
  vec4 ww = max(sc - (mx - 0.25), 0.0); ww /= (ww.x + ww.y + ww.z + ww.w);
  // leafy_grass is half dead leaves: pull it toward living green, keep its photo detail as luminance
  float gl = dot(cA.rgb, vec3(0.3, 0.59, 0.11));
  vec3 grassC = mix(cA.rgb, gl * vec3(0.5, 1.0, 0.22), 0.9) * 0.62;
  // cliff: lichen rock, mostly grey so the wall reads as stone, not a green blanket
  float rl = dot(cR.rgb, vec3(0.3, 0.59, 0.11));
  vec3 rockC = mix(cR.rgb, vec3(rl) * vec3(1.02, 1.0, 0.97), 0.55) * 1.05;
  vec3 alb = ww.x * grassC + ww.y * rockC + ww.z * cS.rgb * 1.05 + ww.w * cG.rgb;
  // vertex colour carries the old palette: keep its broad light/dark variation, not its flat hue
  float macro = clamp(dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15)) * 2.2, 0.6, 1.15);
  vec3 scanned = alb * mix(macro, 1.0, 0.55);
  diffuseColor.rgb = mix(diffuseColor.rgb, scanned, uOn);
  vec4 nA4 = texture2D(nA, gp / 3.2), nR4 = tri(nR, vWP, tw, 1.0 / 6.0), nS4 = texture2D(nS, gp / 5.0), nG4 = texture2D(nG, gp / 2.6);
  float landRough = ww.x * nA4.a + ww.y * nR4.a + ww.z * nS4.a + ww.w * nG4.a;
  vec3 landD = ww.x * vec3(nA4.x * 2.0 - 1.0, 0.0, nA4.y * 2.0 - 1.0) + ww.z * vec3(nS4.x * 2.0 - 1.0, 0.0, nS4.y * 2.0 - 1.0) + ww.w * vec3(nG4.x * 2.0 - 1.0, 0.0, nG4.y * 2.0 - 1.0)
    + ww.y * (tw.y * vec3(nR4.x * 2.0 - 1.0, 0.0, nR4.y * 2.0 - 1.0) + tw.x * vec3(0.0, nR4.y * 2.0 - 1.0, nR4.x * 2.0 - 1.0) + tw.z * vec3(nR4.x * 2.0 - 1.0, nR4.y * 2.0 - 1.0, 0.0)) * 1.6;
  landD *= uOn * (1.0 - far * 0.7);
`;

export function upgradeVistaScan(menu, q) {
  if (!SCAN_ON) return;
  const G = menu.vista.group, H = menu.vista.height || makeHeight();
  // Clearer, slightly warm afternoon air: the old haze washed the cliff out to grey.
  const day0 = menu.setDay.bind(menu);
  menu.setDay = (day) => { const was = menu.day; day0(day); if (day && was !== day) { menu.scene.fog.color.set(0xd4dce4); menu.scene.fog.density = 0.0026; menu.fx.setFog(0.0026); } };
  if (menu.day) { menu.scene.fog.color.set(0xd4dce4); menu.scene.fog.density = 0.0026; menu.fx.setFog(0.0026); }
  G.traverse((o) => {
    if (o.isDirectionalLight) { o.color.setRGB(1.0, 0.9, 0.76); o.intensity = 3.0; }
    if (o.isHemisphereLight) { o.intensity = 0.7; o.groundColor.setRGB(0.3, 0.27, 0.18); }
  });

  // ---- land
  const land = G.children.find((o) => o.isMesh && o.material && o.material.vertexColors && o.geometry.attributes.position.count > 10000);
  if (land) {
    const geo = land.geometry, pos = geo.attributes.position, nrm = geo.attributes.normal, n = pos.count;
    const lw = new Float32Array(n * 4);
    const rx = (z) => FALLS.x + Math.sin((z - FALLS.z) * 0.07) * 3 * Math.max(0, Math.min(1, (z - FALLS.z) / 30));
    const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), slope = 1 - nrm.getY(i);
      const rock = ss(0.28, 0.5, slope);
      const snowLine = 56 + Math.sin(x * 0.05) * 6;
      const snow = ss(snowLine - 6, snowLine + 8, y) * ss(0.75, 0.3, slope);
      const gravel = z > FALLS.z && y < 2.2 ? ss(5.5, 1.5, Math.abs(x - rx(z))) * 0.95 : 0;
      lw[i * 4] = rock * (1 - snow); lw[i * 4 + 1] = snow; lw[i * 4 + 3] = gravel * (1 - rock);
    }
    geo.setAttribute('aLW', new THREE.BufferAttribute(lw, 4));
    const U = { uOn: { value: 0 } };
    const L = { A: 'leafy_grass', R: 'mossy_rock', S: 'snow_02', G: 'gravel_ground_01' };
    let loaded = 0;
    for (const k of Object.keys(L)) {
      const t = groundTex(L[k], () => { if (++loaded === 4) U.uOn.value = 1; });
      U['g' + k] = { value: t.albedo }; U['n' + k] = { value: t.normal };
    }
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 aLW; varying vec3 vWP; varying vec3 vWN; varying vec4 vLW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal); vLW = aLW;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + LAND_PARS)
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + LAND_MAP)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(roughness, clamp(landRough, 0.82, 1.0), uOn);')
        .replace('#include <normal_fragment_maps>', 'normal = normalize(normal + (viewMatrix * vec4(landD, 0.0)).xyz);');
    };
    mat.customProgramCacheKey = () => 'vistascan';
    land.material = mat;
  }

  // ---- cone trees -> the in-game pines, on the same spots
  const inst = [];
  G.traverse((o) => { if (o.isInstancedMesh) inst.push(o); });
  const [canopy, trunk] = inst;
  if (canopy && trunk) {
    const lib = propLibrary({ id: 'meadow' }, Math.min(q, 1));
    const pine = lib.pine();
    const groups = pine.variants.map((parts) => parts.map((p) => {
      const m = new THREE.InstancedMesh(p.geo, p.mat, canopy.count);
      m.castShadow = true; m.receiveShadow = true; m.count = 0; return m;
    }));
    const m4 = new THREE.Matrix4(), s = new THREE.Matrix4().makeScale(0.62, 0.62, 0.62), c = new THREE.Color();
    for (let i = 0; i < canopy.count; i++) {
      canopy.getMatrixAt(i, m4); m4.multiply(s);
      const gset = groups[i % groups.length];
      const k = 0.75 + ((i * 0.618) % 1) * 0.45;
      for (const m of gset) { m.setMatrixAt(m.count, m4); m.setColorAt(m.count, c.setRGB(k, k * (0.95 + ((i * 0.37) % 1) * 0.1), k * 0.9)); m.count++; }
    }
    for (const gset of groups) for (const m of gset) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; G.add(m); }
    canopy.visible = trunk.visible = false;
  }

  // ---- scanned boulders replace the dodecahedrons; more rocks, logs and stumps across the meadow
  if (scanReady()) {
    const old = G.children.filter((o) => o.isMesh && o.geometry && o.geometry.type === 'DodecahedronGeometry');
    for (const o of old) o.visible = false;
    const rockFiles = [...scanVariants('rock_moss_set_01').slice(0, 6), ...scanVariants('boulder_01'), ...scanVariants('namaqualand_boulder_02')];
    const rockMatOf = (f) => scanMat(f.startsWith('rock_moss_set_01') ? 'rock_moss_set_01' : f.startsWith('boulder_01') ? 'boulder_01' : 'namaqualand_boulder_02');
    const place = (file, mat, x, z, s, ry, sink = 0.15) => {
      const g = scanGeo(file, { radius: 1 }); if (!g || !mat) return;
      const m = new THREE.Mesh(g, mat);
      const y = Math.min(H(x, z), H(x + s, z), H(x - s, z), H(x, z + s), H(x, z - s));
      m.position.set(x, y - sink * s, z); m.rotation.y = ry; m.scale.setScalar(s);
      m.castShadow = true; m.receiveShadow = true; G.add(m);
    };
    for (const o of old) place(rockFiles[(old.indexOf(o) * 3) % rockFiles.length], rockMatOf(rockFiles[(old.indexOf(o) * 3) % rockFiles.length]), o.position.x, o.position.z, o.scale.x * 1.6 + 0.6, o.rotation.y);
    let r = 7;
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let i = 0, t = 0; i < 46 && t < 600; t++) {
      const x = FALLS.x + (rnd() - 0.5) * 120, z = -48 + rnd() * 80, y = H(x, z);
      if (y < 0.4 || y > 18 || Math.abs(x - FALLS.x) < 6) continue;
      const f = rockFiles[i % rockFiles.length];
      place(f, rockMatOf(f), x, z, 0.5 + rnd() * 1.6, rnd() * 6.28);
      i++;
    }
    const logF = scanVariants('dead_tree_trunk')[0], stF = scanVariants('tree_stump_01')[0];
    for (let i = 0, t = 0; i < 10 && t < 300; t++) {
      const x = FALLS.x + (rnd() - 0.5) * 110, z = -40 + rnd() * 70, y = H(x, z);
      if (y < 0.4 || y > 14 || Math.abs(x - FALLS.x) < 6) continue;
      if (i % 2 && logF) place(logF, scanMat('dead_tree_trunk'), x, z, 1.4 + rnd(), rnd() * 6.28, 0.05);
      else if (stF) place(stF, scanMat('tree_stump_01'), x, z, 0.7 + rnd() * 0.4, rnd() * 6.28, 0.05);
      i++;
    }
  }

  // ---- grass tufts across the near meadow
  const tex = TX.sprayMaps('grass');
  const cards = [];
  for (let k = 0; k < 3; k++) cards.push(new THREE.PlaneGeometry(1, 1, 1, 2).translate(0, 0.5, 0).rotateY((k / 3) * Math.PI));
  const geo = mergeCards(cards);
  const mat = new THREE.MeshStandardMaterial({ map: tex.map, alphaMap: tex.alphaMap, alphaTest: 0.45, roughness: 0.9, color: 0xa8c080, alphaToCoverage: q >= 1 });
  const N = [1500, 3500, 6000][Math.max(0, Math.min(2, q))];
  const grass = new THREE.InstancedMesh(geo, mat, N);
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), sc = new THREE.Vector3();
  let n = 0, r2 = 99;
  const rnd2 = () => ((r2 = (r2 * 16807) % 2147483647) / 2147483647);
  for (let t = 0; t < N * 4 && n < N; t++) {
    const x = FALLS.x + (rnd2() - 0.5) * 150, z = -50 + rnd2() * 85;
    const y = H(x, z);
    if (y < 0.35 || y > 14) continue;
    const e = 0.8, sl = Math.abs(H(x + e, z) - H(x - e, z)) + Math.abs(H(x, z + e) - H(x, z - e));
    if (sl > 1.2) continue;
    const s = 0.7 + rnd2() * 0.8;
    m4.compose(p.set(x, y - 0.05, z), qq.setFromAxisAngle(up, rnd2() * 6.28), sc.set(s, s * (0.8 + rnd2() * 0.5), s));
    grass.setMatrixAt(n++, m4);
  }
  grass.count = n; grass.instanceMatrix.needsUpdate = true; grass.receiveShadow = true;
  G.add(grass);
}

function mergeCards(list) {
  const pos = [], uv = [], nor = [], idx = [];
  let base = 0;
  for (const g of list) {
    const P = g.attributes.position, U = g.attributes.uv;
    for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); uv.push(U.getX(i), U.getY(i)); nor.push(0, 1, 0); }
    // both windings with the normal kept pointing up: DoubleSide would flip it down and turn the back faces black
    for (let i = 0; i < g.index.count; i += 3) {
      const a = g.index.getX(i) + base, b = g.index.getX(i + 1) + base, c = g.index.getX(i + 2) + base;
      idx.push(a, b, c, a, c, b);
    }
    base += P.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}
