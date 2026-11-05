// The title backdrop: a green alpine valley in daylight. Snow-capped ridged peaks rise behind a
// cliff, a waterfall pours off it into a plunge pool, and the river winds down the meadow toward
// the camera through drifting mist. Built once; MenuScene shows it on the title and hides it in
// the lobby, where the dusk cliff with your character stays.
import * as THREE from 'three';
import { makeNoise } from './rng.js';
import * as TX from './textures.js';
import { rockMaterial } from './elements.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export const FALLS = { x: 7, z: -62, top: 36 }; // where the waterfall is, and how high the cliff stands
export const SUN_DIR = new THREE.Vector3(0.55, 0.62, 0.3).normalize();

// GLSL value noise shared by the sky, water and waterfall shaders.
const NOISE_GLSL = `
float hash21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  float a=hash21(i), b=hash21(i+vec2(1,0)), c=hash21(i+vec2(0,1)), d=hash21(i+vec2(1,1));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*vnoise(p); p=p*2.03+vec2(17.1,9.3); a*=0.5; } return v; }
`;

// Where the river runs (x for a given z) on the valley floor.
const riverX = (z) => FALLS.x + Math.sin((z - FALLS.z) * 0.07) * 3 * clamp01((z - FALLS.z) / 30);

export function makeHeight() {
  const N1 = makeNoise(101), N2 = makeNoise(202), N3 = makeNoise(303), N4 = makeNoise(404);
  const { x: XW, z: ZC, top: TOP } = FALLS;
  return (x, z) => {
    const wobble = (N4.fbm(x * 0.045 + 2, 7, 3) - 0.5) * 10 * sstep(2, 8, Math.abs(x - XW)); // the cliff line wanders, but is straight at the falls
    const wall = sstep(ZC + 2.5 + wobble, ZC - 2.5 + wobble, z); // 0 on the valley floor, 1 up on the plateau behind the cliff
    const meadow = (N1.fbm(x * 0.05 + 3, z * 0.05, 3) - 0.5) * 3 + 0.6 + (N2.fbm(x * 0.3, z * 0.3, 2) - 0.5) * 0.5;
    const flat = sstep(9, 2, Math.abs(x - XW)) * sstep(18, 0, ZC - z); // the river bed on top stays level
    const plateau = TOP + (N2.fbm(x * 0.02, z * 0.02, 3) - 0.5) * 8 * (1 - flat);
    const back = clamp01((ZC - z) / 120);
    const rid = Math.pow(N3.ridged(x * 0.012 + 11, z * 0.012, 5), 1.6);
    const peaks = rid * (18 + 80 * back) * (0.6 + 0.5 * N1.fbm(x * 0.006, z * 0.006, 2)) * (1 - flat * 0.9);
    let h = meadow + wall * (plateau + peaks);
    // Scree piled at the foot of the cliff.
    h += (1 - wall) * sstep(16, 0, z - ZC - wobble) * (5 + 3 * N3.fbm(x * 0.1, z * 0.1, 2)) * sstep(3, 9, Math.abs(x - XW));
    // Slopes rising either side of the valley, so the meadow sits in a bowl.
    const side = sstep(22, 70, Math.abs(x - XW));
    h += side * (1 - wall) * (6 + 34 * Math.pow(N4.ridged(x * 0.015, z * 0.015 + 5, 4), 1.5));
    // The river channel, the plunge pool, and the notch the falls pour through.
    const dr = Math.abs(x - riverX(z));
    h -= (1 - wall) * sstep(5, 1.2, dr) * 2.4;
    h -= (1 - wall) * sstep(15, 3, Math.hypot(x - XW, z - (ZC + 9))) * 2.6;
    h -= wall * sstep(5, 1, Math.abs(x - XW)) * 3.5 * sstep(14, 0, ZC - z);
    return h;
  };
}

// Sky dome with a day/dusk blend: dusk is the lobby's old sunset, day is the title's blue sky with clouds.
export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uDay: { value: 1 }, t: { value: 0 }, sunDir: { value: SUN_DIR.clone() } },
    vertexShader: `varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 vP; uniform float uDay, t; uniform vec3 sunDir; ${NOISE_GLSL}
      void main(){ float y = vP.y;
        vec3 dusk = mix(vec3(0.55,0.2,0.18), vec3(0.04,0.03,0.09), smoothstep(-0.05,0.45,y));
        dusk += vec3(1.0,0.45,0.2)*pow(max(0.0,1.0-abs(y+0.02)*6.0),3.0)*0.6;
        vec3 day = mix(vec3(0.80,0.87,0.93), vec3(0.17,0.42,0.85), smoothstep(-0.02,0.6,y));
        day = mix(day, vec3(0.88,0.91,0.94), pow(max(0.0,1.0-abs(y)*3.0),2.0)*0.45);
        float sd = max(dot(normalize(vP), sunDir), 0.0);
        day += vec3(1.0,0.95,0.85)*pow(sd, 10.0)*0.18;
        if (y > 0.0) {
          vec2 cp = vP.xz/(y+0.12)*1.5 + vec2(t*0.012, t*0.004);
          float cl = smoothstep(0.52, 0.74, fbm(cp) + 0.06*fbm(cp*3.0));
          vec3 cc = mix(vec3(0.72,0.76,0.83), vec3(1.0), smoothstep(0.45, 0.85, fbm(cp*2.0+1.7)));
          day = mix(day, cc, cl*smoothstep(0.0,0.18,y)*0.92);
        }
        gl_FragColor = vec4(mix(dusk, day, uDay), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), mat);
  sky.renderOrder = -3;
  return sky;
}

export function buildVista(fx, quality) {
  const G = new THREE.Group(); G.name = 'vista';
  const H = makeHeight();
  const { x: XW, z: ZC } = FALLS;

  // ---- the land: one big heightfield with vertex colours (grass, forest, rock, snow, river gravel)
  const W = 420, D = 260, SX = quality >= 1 ? 230 : 150, SZ = quality >= 1 ? 170 : 110;
  const geo = new THREE.PlaneGeometry(W, D, SX, SZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -100); // z from -230 (far peaks) to +30 (under the camera)
  const pos = geo.attributes.position, n = pos.count;
  for (let i = 0; i < n; i++) pos.setY(i, H(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal, col = new Float32Array(n * 3), NC = makeNoise(505);
  const grass1 = [0.15, 0.40, 0.10], grass2 = [0.36, 0.58, 0.17], forest = [0.06, 0.22, 0.07], rock = [0.42, 0.41, 0.39], rock2 = [0.26, 0.25, 0.24], snow = [0.93, 0.95, 0.98], gravel = [0.40, 0.37, 0.28];
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), slope = 1 - nrm.getY(i);
    const t = NC.fbm(x * 0.03, z * 0.03, 3);
    let c = mix3(grass1, grass2, t);
    c = mix3(c, forest, sstep(0.55, 0.75, NC.fbm(x * 0.012 + 9, z * 0.012, 3)) * sstep(60, 10, y) * 0.8);
    const band = NC.fbm(x * 0.05, y * 0.18, 3); // strata across the cliff faces
    c = mix3(c, mix3(rock, rock2, band), sstep(0.3, 0.55, slope + (t - 0.5) * 0.15));
    const snowLine = 56 + (t - 0.5) * 14;
    c = mix3(c, snow, sstep(snowLine - 6, snowLine + 8, y) * sstep(0.75, 0.3, slope));
    if (z > ZC && y < 2) c = mix3(c, gravel, sstep(5, 1.5, Math.abs(x - riverX(z))) * 0.9);
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const nm = TX.rockMaps([0.4, 0.4, 0.4]).normalMap.clone();
  nm.wrapS = nm.wrapT = THREE.RepeatWrapping; nm.repeat.set(90, 60); nm.needsUpdate = true;
  const land = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, normalMap: nm, normalScale: new THREE.Vector2(0.22, 0.22) }));
  land.receiveShadow = true;
  G.add(land);

  // ---- conifers on the lower slopes (two instanced meshes: canopy and trunk)
  const NT = quality >= 1 ? 700 : 350, NF = makeNoise(606), RT = makeNoise(707);
  const tiers = mergeGeometries([new THREE.ConeGeometry(1.15, 2.2, 8).translate(0, 1.6, 0), new THREE.ConeGeometry(0.9, 2.0, 8).translate(0, 2.7, 0), new THREE.ConeGeometry(0.6, 1.8, 8).translate(0, 3.7, 0)]);
  const canopy = new THREE.InstancedMesh(tiers, new THREE.MeshStandardMaterial({ roughness: 0.95, color: 0xffffff }), NT);
  canopy.castShadow = true;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.2, 1.2, 5).translate(0, 0.55, 0), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 }), NT);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p3 = new THREE.Vector3(), tc = new THREE.Color();
  let placed = 0, tries = 0;
  while (placed < NT && tries++ < NT * 40) {
    const x = XW + rnd(-95, 95), z = rnd(-205, 8);
    const y = H(x, z), dr = Math.abs(x - riverX(z));
    if (y < 0.3 || y > 30 || (z > ZC && dr < 4.5) || Math.abs(x - XW) < 5) continue;
    const forestiness = NF.fbm(x * 0.02 + 4, z * 0.02, 3);
    if (Math.random() > sstep(0.42, 0.7, forestiness) + 0.04) continue;
    const e = 0.9, sl = Math.abs(H(x + e, z) - H(x - e, z)) + Math.abs(H(x, z + e) - H(x, z - e));
    if (sl > 2.4) continue;
    const s = rnd(1.1, 2.1);
    sc.set(s * rnd(0.85, 1.15), s, s * rnd(0.85, 1.15)); p3.set(x, y - 0.2, z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28);
    m4.compose(p3, q, sc); canopy.setMatrixAt(placed, m4); trunk.setMatrixAt(placed, m4);
    const g = 0.22 + RT.fbm(x * 0.1, z * 0.1, 2) * 0.2;
    tc.setRGB(0.03 + g * 0.25, g, 0.03 + g * 0.2); canopy.setColorAt(placed, tc);
    placed++;
  }
  canopy.count = trunk.count = placed; canopy.instanceMatrix.needsUpdate = true; trunk.instanceMatrix.needsUpdate = true;
  if (canopy.instanceColor) canopy.instanceColor.needsUpdate = true;
  G.add(canopy, trunk);

  // ---- boulders round the pool
  const boulder = rockMaterial([0.42, 0.42, 0.4]);
  for (let i = 0; i < 14; i++) {
    const a = rnd(0, 6.28), r = rnd(7, 14), x = XW + Math.cos(a) * r, z = ZC + 12 + Math.abs(Math.sin(a)) * r * 0.8;
    const sz = rnd(0.8, 2.0);
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(sz, 1), boulder);
    b.position.set(x, Math.min(H(x, z), H(x + 1, z), H(x - 1, z), H(x, z + 1), H(x, z - 1)) - sz * 0.35, z); b.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); b.scale.y = rnd(0.55, 0.85);
    G.add(b);
  }

  // ---- water: the pool and river below, and the stretch of river on top feeding the falls
  const waterMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { t: { value: 0 }, sunDir: { value: SUN_DIR.clone() }, falls: { value: new THREE.Vector2(XW, ZC + 2.5) } }]),
    vertexShader: `varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; vec4 mvPosition = viewMatrix*w; gl_Position = projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float t; uniform vec3 sunDir; uniform vec2 falls; varying vec3 vW;
      #include <fog_pars_fragment>
      ${NOISE_GLSL}
      void main(){
        vec2 p = vW.xz;
        float n1 = fbm(p*0.9 + vec2(t*0.25, t*0.9));
        float n2 = fbm(p*1.7 - vec2(t*0.35, -t*1.3));
        vec3 nrm = normalize(vec3((n1-0.5)*0.4, 1.0, (n2-0.5)*0.4));
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(nrm, V), 0.0), 3.0);
        vec3 c = mix(vec3(0.02,0.10,0.11), vec3(0.10,0.34,0.30), n1*0.6);
        c = mix(c, vec3(0.62,0.78,0.92), 0.25 + fres*0.6);
        c += vec3(1.0,0.97,0.9) * pow(max(dot(reflect(-sunDir, nrm), V), 0.0), 120.0) * 1.6;
        float d = distance(p, falls);
        float foam = smoothstep(9.0, 2.0, d) * (0.55 + 0.45*fbm(p*2.5 + vec2(0.0, -t*1.8)));
        foam += smoothstep(0.62, 0.8, fbm(p*3.0 + vec2(0.0, -t*1.2))) * smoothstep(24.0, 6.0, d) * 0.5;
        c = mix(c, vec3(0.9,0.95,0.97), clamp(foam, 0.0, 1.0));
        gl_FragColor = vec4(c, 0.88);
        #include <fog_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(64, 94, 1, 1).rotateX(-Math.PI / 2).translate(XW, -1.0, ZC + 46), waterMat);
  water.renderOrder = 2;
  const upper = new THREE.Mesh(new THREE.PlaneGeometry(7, 20, 1, 1).rotateX(-Math.PI / 2).translate(XW, H(XW, ZC - 8) + 0.25, ZC - 12), waterMat);
  upper.renderOrder = 2;
  G.add(water, upper);

  // ---- the waterfall: a sheet that follows the cliff face, with streaks sliding down it
  const fallsMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { t: { value: 0 } }]),
    vertexShader: `varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float t; varying vec2 vUv;
      #include <fog_pars_fragment>
      ${NOISE_GLSL}
      void main(){
        vec2 uv = vUv; float fall = uv.y + t*1.35;
        float streak = smoothstep(0.42, 0.78, fbm(vec2(uv.x*7.0, fall*4.0)));
        float fine = smoothstep(0.55, 0.9, vnoise(vec2(uv.x*40.0, fall*9.0)));
        float edge = smoothstep(0.0, 0.12, uv.x) * smoothstep(1.0, 0.88, uv.x);
        float a = (streak*0.8 + fine*0.5) * edge * mix(1.0, 0.75, uv.y);
        a += smoothstep(0.2, 0.0, uv.y) * 0.55 * edge;
        vec3 c = mix(vec3(0.74,0.85,0.95), vec3(1.0), fine);
        gl_FragColor = vec4(c, clamp(a, 0.0, 0.95));
        #include <fog_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const M = 40, C = 8, fp = [], fuv = [], fidx = [];
  for (let j = 0; j <= M; j++) {
    const v = j / M, z = (ZC + 3.0) - v * 6.0, y = H(XW, z) + 0.7, half = lerp(3.4, 2.4, v);
    for (let i = 0; i <= C; i++) { const u = i / C; fp.push(XW + (u - 0.5) * 2 * half, y, z + 0.35); fuv.push(u, v); }
  }
  for (let j = 0; j < M; j++) for (let i = 0; i < C; i++) { const a = j * (C + 1) + i, b = a + 1, c = a + C + 1, d = c + 1; fidx.push(a, c, b, b, c, d); }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  fg.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2));
  fg.setIndex(fidx);
  const falls = new THREE.Mesh(fg, fallsMat); falls.renderOrder = 3;
  G.add(falls);

  // ---- daylight
  const sun = new THREE.DirectionalLight(0xfff3df, 2.6);
  sun.position.copy(SUN_DIR).multiplyScalar(160).add(new THREE.Vector3(XW, 0, -40));
  sun.target.position.set(XW, 0, -40);
  sun.castShadow = quality >= 1;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 400 });
  sun.shadow.bias = -0.0008;
  G.add(sun, sun.target, new THREE.HemisphereLight(0x9fc8ff, 0x3a5a2a, 0.9));

  // Mist at the foot of the falls and haze drifting down the valley.
  const update = (dt, t) => {
    waterMat.uniforms.t.value = t; fallsMat.uniforms.t.value = t;
    for (let k = 0; k < 2; k++) fx.smoke.emit({ p: [XW + rnd(-3, 3), -0.6 + rnd(0, 1.5), ZC + 3.5 + rnd(-1, 2.5)], v: [rnd(-0.6, 0.6), rnd(0.8, 1.8), rnd(0.4, 1.4)], life: rnd(2, 3.5), s0: rnd(1.5, 2.5), s1: rnd(5, 8), c0: [0.9, 0.94, 0.98, 0.26], c1: [0.9, 0.94, 0.98, 0], drag: 0.6 });
    if (Math.random() < 0.12) fx.smoke.emit({ p: [XW + rnd(-30, 30), rnd(1, 6), rnd(ZC + 5, -10)], v: [rnd(0.2, 0.8), 0.1, rnd(0.1, 0.4)], life: rnd(8, 14), s0: 9, s1: 16, c0: [0.85, 0.9, 0.95, 0.06], c1: [0.85, 0.9, 0.95, 0] });
  };
  return { group: G, update, height: H };
}
