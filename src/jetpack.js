// The Perfect Shop jetpack: a back-mounted twin-tank pack with real flame jets, plus its flight tuning.
import * as THREE from 'three';

export const JET = { fuel: 220, climb: 9.5, thrust: 34, burn: 30, hoverBurn: 7, regen: 24, regenDelay: 0.9, tap: 0.34, airSpeed: 1.25, ceiling: 38 };

let mats = null;
function materials() {
  if (mats) return mats;
  mats = {
    steel: new THREE.MeshStandardMaterial({ color: 0x8d949c, metalness: 0.85, roughness: 0.32 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x23262b, metalness: 0.6, roughness: 0.55 }),
    band: new THREE.MeshStandardMaterial({ color: 0xd2492b, metalness: 0.4, roughness: 0.45 }),
    bell: new THREE.MeshStandardMaterial({ color: 0x23262b, metalness: 0.6, roughness: 0.55, side: THREE.DoubleSide }),
    strap: new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 0.85 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    core: new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  return mats;
}

// Origin sits between the shoulder blades; +z is the way the wearer faces, so the pack is built toward -z.
export function makeJetpack() {
  const m = materials();
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.46, 0.08), m.dark); frame.position.set(0, 0, -0.04); g.add(frame);
  g.userData.noz = [];
  g.userData.flames = [];
  for (const sx of [-1, 1]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.62, 16), m.steel);
    tank.position.set(sx * 0.12, -0.02, -0.19); g.add(tank);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.steel);
    cap.position.set(sx * 0.12, 0.29, -0.19); g.add(cap);
    for (const y of [0.16, -0.12]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.104, 0.104, 0.05, 16), m.band);
      band.position.set(sx * 0.12, y, -0.19); g.add(band);
    }
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.115, 0.16, 14, 1, true), m.bell);
    bell.position.set(sx * 0.12, -0.4, -0.19); g.add(bell);
    const noz = new THREE.Object3D(); noz.position.set(sx * 0.12, -0.48, -0.19); g.add(noz);
    g.userData.noz.push(noz);
    // Flame: a bright core inside a longer orange cone, both pointing down.
    const cone = (r, h) => new THREE.ConeGeometry(r, h, 12, 1, true).rotateX(Math.PI).translate(0, -h / 2, 0); // base at the nozzle, tip down
    const outer = new THREE.Mesh(cone(0.1, 0.75), m.glow);
    const inner = new THREE.Mesh(cone(0.05, 0.42), m.core);
    noz.add(outer, inner);
    outer.visible = inner.visible = false;
    g.userData.flames.push(outer, inner);
  }
  // Harness straps over the shoulders.
  for (const sx of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.5, 0.03), m.strap);
    strap.position.set(sx * 0.15, 0.06, 0.2); strap.rotation.x = 0.0; g.add(strap);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.thrust = 0;
  return g;
}

const _p = new THREE.Vector3();
// Animate the flames and shed fire, glow and smoke from the nozzles. level 0..1.
export function jetFx(pack, level, fx, dt, t) {
  const fl = pack.userData.flames;
  const on = level > 0.02;
  for (let i = 0; i < fl.length; i++) {
    fl[i].visible = on;
    if (on) {
      const flick = 0.85 + 0.3 * Math.sin(t * 60 + i * 7) * Math.sin(t * 23 + i);
      fl[i].scale.set(0.8 + 0.3 * level, level * flick, 0.8 + 0.3 * level);
    }
  }
  if (!on || !fx) return;
  pack.updateMatrixWorld(true);
  for (const n of pack.userData.noz) {
    n.getWorldPosition(_p);
    const k = Math.max(1, Math.round(level * 3));
    for (let i = 0; i < k; i++) {
      fx.fire.emit({ p: [_p.x + (Math.random() - 0.5) * 0.05, _p.y - Math.random() * 0.2, _p.z + (Math.random() - 0.5) * 0.05], v: [(Math.random() - 0.5) * 0.7, -5 - Math.random() * 4 * level, (Math.random() - 0.5) * 0.7], life: 0.3 + Math.random() * 0.2, s0: 0.3, s1: 0.06, c0: [1, 0.7, 0.25, 0.9], c1: [1, 0.25, 0.05, 0], turb: 1 });
    }
    if (Math.random() < 0.55) fx.smoke.emit({ p: [_p.x, _p.y - 0.5, _p.z], v: [(Math.random() - 0.5) * 0.8, -1.5 - Math.random(), (Math.random() - 0.5) * 0.8], life: 0.9 + Math.random() * 0.6, s0: 0.35, s1: 1.4, c0: [0.7, 0.7, 0.7, 0.3 * level], c1: [0.55, 0.55, 0.55, 0] });
    fx.glow.emit({ p: [_p.x, _p.y - 0.2, _p.z], life: 0.05, s0: 1.2 * level, s1: 1.2 * level, c0: [1, 0.6, 0.2, 0.4], c1: [1, 0.5, 0.15, 0.3] });
  }
}
