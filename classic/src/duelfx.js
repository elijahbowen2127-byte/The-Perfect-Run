// Shared visuals for the orbiting blades and the fire ring, so an opponent's power-ups can be seen as well as your own.
import * as THREE from 'three';

let bladeGeo = null, bladeMat = null;
export function makeOrbitBlades(n, color = 0xaaccff) {
  if (!bladeGeo) {
    const blade = new THREE.Shape();
    blade.moveTo(0, -0.55); blade.quadraticCurveTo(0.34, -0.1, 0.05, 0.6); blade.quadraticCurveTo(0.0, 0.1, -0.12, -0.2); blade.lineTo(0, -0.55);
    bladeGeo = new THREE.ExtrudeGeometry(blade, { depth: 0.05, bevelEnabled: false });
  }
  const grp = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xdfe8f4, metalness: 0.9, roughness: 0.25, emissive: new THREE.Color(color), emissiveIntensity: 0.55 });
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(bladeGeo, mat);
    const a = (i / n) * Math.PI * 2;
    m.position.set(Math.sin(a) * 2.6, 0, Math.cos(a) * 2.6);
    m.rotation.set(Math.PI / 2, 0, -a);
    grp.add(m);
  }
  grp.userData.n = n;
  return grp;
}

// A glowing ring on the ground that marks the reach of the fire aura.
let ringMat = null;
export function makeAuraRing() {
  if (!ringMat) ringMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48), ringMat);
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 3;
  return m;
}
