// Real-looking gunfire (Nutty 2026-11-05: "bullets look like bright white puffs... make them look real like Call of
// Duty"). Two pieces, both pooled so a minigun stays cheap:
//  - bullet(a, b, color): a thin hot tracer streak that actually travels from the muzzle to the hit at bullet speed,
//    fading out toward its tail, instead of a line of glowing puffs that appears all at once.
//  - flash(p, dir, size): a short muzzle flash: a star burst facing the camera plus two flame tongues along the barrel,
//    gone in about 1/25 s.
import * as THREE from 'three';

const MAXB = 160, MAXF = 16;
const SPEED = 420; // m/s the streak travels at (real rounds are faster, but then nobody would see them)
const STREAK = 3.2; // metres of glowing tail
const SKIP = 0.45; // the streak starts this far past the muzzle so it never shows inside the gun

function flashTexture(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.translate(64, 64);
  if (kind === 'star') {
    // A ragged star: a hot core and 6 uneven spikes.
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 60);
    g.addColorStop(0, 'rgba(255,250,225,1)'); g.addColorStop(0.18, 'rgba(255,214,120,0.95)'); g.addColorStop(0.5, 'rgba(255,140,40,0.45)'); g.addColorStop(1, 'rgba(255,90,10,0)');
    x.fillStyle = g;
    x.beginPath();
    const n = 6;
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 + 0.2, r = i % 2 === 0 ? 58 - (i % 4) * 7 : 13;
      x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    x.closePath(); x.fill();
    const g2 = x.createRadialGradient(0, 0, 0, 0, 0, 22);
    g2.addColorStop(0, 'rgba(255,255,245,1)'); g2.addColorStop(1, 'rgba(255,220,150,0)');
    x.fillStyle = g2; x.beginPath(); x.arc(0, 0, 22, 0, 7); x.fill();
  } else {
    // A flame tongue along +x: wide and hot at the muzzle (left), tapering to a point.
    x.translate(-64, 0);
    const g = x.createLinearGradient(0, 0, 128, 0);
    g.addColorStop(0, 'rgba(255,245,210,1)'); g.addColorStop(0.35, 'rgba(255,190,90,0.85)'); g.addColorStop(1, 'rgba(255,100,20,0)');
    x.fillStyle = g;
    x.beginPath(); x.moveTo(0, -22); x.quadraticCurveTo(50, -26, 128, 0); x.quadraticCurveTo(50, 26, 0, 22); x.closePath(); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Ballistics {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    // Tracer streaks: one instanced thin cylinder, head bright, tail black (additive, so black = invisible).
    const geo = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true).rotateX(Math.PI / 2); // along +z, from -0.5 (tail) to +0.5 (head)
    const P = geo.attributes.position, col = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) { const k = P.getZ(i) > 0 ? 1 : 0; col[i * 3] = k; col[i * 3 + 1] = k; col[i * 3 + 2] = k; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, fog: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAXB);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.renderOrder = 5;
    scene.add(this.mesh);
    this.list = [];
    // Muzzle flashes.
    const star = new THREE.MeshBasicMaterial({ map: flashTexture('star'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide });
    const tongue = new THREE.MeshBasicMaterial({ map: flashTexture('tongue'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide });
    const quad = new THREE.PlaneGeometry(1, 1), side = new THREE.PlaneGeometry(1, 0.4).translate(0.5, 0, 0);
    this.flashes = [];
    for (let i = 0; i < MAXF; i++) {
      const g = new THREE.Group();
      const s = new THREE.Mesh(quad, star.clone());
      const t1 = new THREE.Mesh(side, tongue.clone()), t2 = new THREE.Mesh(side, t1.material);
      t2.rotation.x = Math.PI / 2; // the two tongues cross along the barrel
      const along = new THREE.Group(); along.add(t1, t2);
      g.add(s, along); g.visible = false; g.renderOrder = 6;
      g.userData = { s, along, life: 0, max: 0.045, size: 0.3 };
      scene.add(g); this.flashes.push(g);
    }
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._c = new THREE.Color();
  }

  bullet(a, b, color = [1, 0.78, 0.42]) {
    const A = new THREE.Vector3(a[0], a[1], a[2]), B = new THREE.Vector3(b[0], b[1], b[2]);
    const dir = B.clone().sub(A), len = dir.length();
    if (len < SKIP + 0.2) return;
    dir.divideScalar(len);
    if (this.list.length >= MAXB) this.list.shift();
    // Close hits still show for a few frames.
    const speed = Math.min(SPEED, Math.max(60, len / 0.07));
    // Warm the colour toward a hot tracer: brighter than the old puffs' halo, but thin.
    const c = new THREE.Color(Math.min(3, color[0] * 2.6 + 0.3), Math.min(3, color[1] * 2.3 + 0.2), Math.min(3, color[2] * 1.8 + 0.1));
    this.list.push({ A, dir, len, d: SKIP, speed, c, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir) });
  }

  flash(p, dir, size = 0.3) {
    let f = this.flashes.find((o) => !o.visible) || this.flashes.reduce((m, o) => (o.userData.life < m.userData.life ? o : m));
    const u = f.userData;
    f.position.set(p[0], p[1], p[2]);
    let d = this._v.set(dir[0], dir[1], dir[2]);
    if (d.lengthSq() < 1e-6) d = this.camera.getWorldDirection(this._v);
    d.normalize();
    u.along.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d);
    u.along.rotateX(Math.random() * Math.PI);
    u.spin = Math.random() * Math.PI * 2;
    u.size = size * (0.8 + Math.random() * 0.45); u.life = u.max = 0.04 + Math.random() * 0.015;
    f.visible = true;
  }

  update(dt) {
    const cam = this.camera.position, m = this._m;
    let n = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      s.d += s.speed * dt;
      const head = Math.min(s.d, s.len), tail = Math.max(SKIP, s.d - STREAK);
      if (tail >= s.len) { this.list.splice(i, 1); continue; }
      const L = head - tail;
      if (L <= 0.01) continue;
      const mid = this._v.copy(s.A).addScaledVector(s.dir, (head + tail) / 2);
      // Keep the streak a pixel or two wide however far away it is.
      const r = Math.min(0.06, Math.max(0.006, mid.distanceTo(cam) * 0.0011));
      m.compose(mid, s.q, this._s.set(r, r, L));
      this.mesh.setMatrixAt(n, m);
      // Fade the last stretch as it reaches the target.
      const fade = Math.min(1, (s.len - tail) / STREAK + 0.25);
      this.mesh.setColorAt(n, this._c.copy(s.c).multiplyScalar(fade));
      n++;
    }
    this.mesh.count = n;
    if (n) { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; }
    for (const f of this.flashes) {
      if (!f.visible) continue;
      const u = f.userData;
      u.life -= dt;
      if (u.life <= 0) { f.visible = false; continue; }
      const k = u.life / u.max, sz = u.size * (0.75 + 0.5 * (1 - k));
      u.s.quaternion.copy(this.camera.quaternion); u.s.rotateZ(u.spin);
      u.s.scale.setScalar(sz * 0.9);
      u.along.scale.set(sz * 1.5, sz * 0.9, sz * 0.9);
      u.s.material.opacity = k; u.along.children[0].material.opacity = k;
    }
  }
}
