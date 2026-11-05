// A real rifle scope (Nutty 2026-11-05: "looking through guns with scopes you only see the crosshair, the scope itself
// is not transparent, make it look like a scope from a real gun"). When you aim down a scoped weapon in first person
// the eye sits just behind the ocular lens and the lens shows a magnified picture of the world: the scene is drawn a
// second time by a narrow camera at the objective lens into a small texture, which is put on the ocular with a
// reticle and a dark vignette over it. The scope body stays solid round it, like the real thing.
import * as THREE from 'three';
import { mats } from './weapons.js';

// The first-person camera sits this far ahead of the rig's eye point (game.js updateCamera).
export const CAM_LEAD = 0.06;
// Eye relief: how far the CAMERA sits behind the ocular lens when aiming: far enough that the disc fills about two
// thirds of the view whatever the lens size, and always past the camera's near plane (0.04).
export const eyeRelief = (ep) => Math.max(0.085, ep.r * 5.7); // metres from the ocular lens to the eye when aiming

// Find the ocular (rear) lens of a weapon model: the lens-material disc that faces the shooter (-z).
// Returns { p: Vector3 (weapon space), r: radius } or null.
export function findEyepiece(w) {
  const lens = mats().lens, pts = [];
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  w.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(w.matrixWorld).invert();
  w.traverse((o) => {
    if (!o.isMesh || o.material !== lens || !o.geometry.attributes.normal) return;
    const P = o.geometry.attributes.position, N = o.geometry.attributes.normal, M = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const R = new THREE.Matrix3().getNormalMatrix(M);
    for (let i = 0; i < P.count; i++) {
      n.fromBufferAttribute(N, i).applyMatrix3(R);
      if (n.z > -0.9) continue;
      v.fromBufferAttribute(P, i).applyMatrix4(M); pts.push(v.x, v.y, v.z);
    }
  });
  if (pts.length < 9) return null;
  const c = new THREE.Vector3();
  for (let i = 0; i < pts.length; i += 3) c.x += pts[i], c.y += pts[i + 1], c.z += pts[i + 2];
  c.divideScalar(pts.length / 3);
  let r = 0;
  for (let i = 0; i < pts.length; i += 3) r = Math.max(r, Math.hypot(pts[i] - c.x, pts[i + 1] - c.y));
  return { p: c, r };
}

function reticleTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.clearRect(0, 0, S, S);
  // Vignette: clear in the middle, black at the rim (a real scope's edge).
  const g = x.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.8, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.95)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  // Duplex reticle: thin centre lines, thick posts toward the edge, mil dots.
  x.strokeStyle = 'rgba(0,0,0,0.9)'; x.lineCap = 'butt';
  x.lineWidth = 2; x.beginPath(); x.moveTo(S * 0.18, S / 2); x.lineTo(S * 0.82, S / 2); x.moveTo(S / 2, S * 0.18); x.lineTo(S / 2, S * 0.82); x.stroke();
  x.lineWidth = 7; x.beginPath();
  x.moveTo(0, S / 2); x.lineTo(S * 0.3, S / 2); x.moveTo(S * 0.7, S / 2); x.lineTo(S, S / 2);
  x.moveTo(S / 2, 0); x.lineTo(S / 2, S * 0.3); x.moveTo(S / 2, S * 0.7); x.lineTo(S / 2, S); x.stroke();
  x.fillStyle = 'rgba(0,0,0,0.9)';
  for (const k of [-0.2, -0.1, 0.1, 0.2]) { x.beginPath(); x.arc(S / 2 + S * k, S / 2, 3, 0, 7); x.fill(); x.beginPath(); x.arc(S / 2, S / 2 + S * k, 3, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class ScopeView {
  constructor(renderer, scene, quality = 1) {
    this.renderer = renderer; this.scene = scene;
    const S = quality === 0 ? 320 : 512;
    this.rt = new THREE.WebGLRenderTarget(S, S, { depthBuffer: true });
    this.cam = new THREE.PerspectiveCamera(10, 1, 0.2, 700);
    // The picture is drawn with our own shader: the render target holds linear light with no tone mapping (three.js
    // skips it for render targets), so the shader applies the game's exposure, ACES filmic curve and sRGB itself, then
    // lays the reticle and vignette over it. Nothing else (realmat overlays, ghosting) touches this material.
    this.viewMat = new THREE.ShaderMaterial({
      uniforms: { tPic: { value: this.rt.texture }, tRet: { value: reticleTexture() }, uExp: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tPic, tRet; uniform float uExp; varying vec2 vUv;
        vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
        void main() {
          vec3 c = aces(texture2D(tPic, vUv).rgb * uExp);
          c = pow(c, vec3(1.0 / 2.2));
          vec4 r = texture2D(tRet, vUv);
          gl_FragColor = vec4(mix(c, r.rgb, r.a), 1.0);
        }`,
      fog: false, toneMapped: false,
    });
    this.view = null; this.ret = null; this.on = false; this.weapon = null;
    this._v = new THREE.Vector3(); this._q = new THREE.Quaternion();
  }

  // Mount the picture on this weapon's ocular lens (once per weapon model).
  attach(w) {
    if (this.weapon === w) return !!this.view;
    this.detach();
    const ep = w.userData.eyepiece === undefined ? (w.userData.eyepiece = findEyepiece(w)) : w.userData.eyepiece;
    this.weapon = w;
    if (!ep) return false;
    const geo = new THREE.CircleGeometry(ep.r * 0.98, 28).rotateY(Math.PI); // faces the shooter; rotateY keeps the picture the right way round
    this.view = new THREE.Mesh(geo, this.viewMat); this.view.position.copy(ep.p).add(this._v.set(0, 0, -0.0012));
    this.view.renderOrder = 2; this.view.visible = false;
    this.viewMat.uniforms.uExp.value = this.renderer.toneMappingExposure || 1;
    w.add(this.view);
    return true;
  }

  detach() {
    if (this.view && this.view.parent) this.view.parent.remove(this.view);
    this.view = null; this.weapon = null; this.on = false;
  }

  // Aim the scope camera: a metre ahead of the eye along the aim, clear of the hands and the gun.
  set(on, eye, dir, fov) {
    this.on = on && !!this.view;
    if (this.view) this.view.visible = this.on;
    if (!this.on) return;
    this.cam.position.copy(eye).addScaledVector(dir, 1.0);
    this.cam.lookAt(this._v.copy(this.cam.position).addScaledVector(dir, 10));
    if (this.cam.fov !== fov) { this.cam.fov = fov; this.cam.updateProjectionMatrix(); }
  }

  // Draw the picture: called just before the main render of a frame.
  render(hide = []) {
    if (!this.on) return;
    const r = this.renderer, was = hide.map((o) => o.visible);
    for (const o of hide) o.visible = false; // your own body and gun sit right in front of the objective
    const prev = r.getRenderTarget();
    r.setRenderTarget(this.rt);
    r.render(this.scene, this.cam);
    r.setRenderTarget(prev);
    hide.forEach((o, i) => (o.visible = was[i]));
  }
}
