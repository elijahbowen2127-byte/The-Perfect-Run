// Wings (tier-3 gear): a pair of feathered wings worn on the back, plus their flight tuning.
// X flaps (each press lifts a little, so you climb bit by bit); in the air, hold Sprint to spread them and soar.
import * as THREE from 'three';

export const WING = { stam: 100, flapCost: 7, flapLift: 11, climbCap: 14, flapCd: 0.2, soarSpeed: 31, soarCost: 9, soarMin: 8, regenGround: 45, regenAir: 5, ceiling: 60, sink: -2 };

let mats = null;
function materials() {
  if (mats) return mats;
  mats = {
    feather: new THREE.MeshStandardMaterial({ color: 0xf1ece0, roughness: 0.8, metalness: 0, side: THREE.DoubleSide }),
    tip: new THREE.MeshStandardMaterial({ color: 0xb8c4d8, roughness: 0.8, metalness: 0, side: THREE.DoubleSide }),
    bone: new THREE.MeshStandardMaterial({ color: 0x5b4a3a, roughness: 0.6, metalness: 0.2 }),
  };
  return mats;
}

// Origin between the shoulder blades, +z is the way the wearer faces. Each wing is a pivot at the shoulder with a fan of feathers
// pointing out along its own side (+x for the right wing, -x for the left).
export function makeWings() {
  const m = materials(), g = new THREE.Group();
  g.userData.wings = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.1, 0.05, -0.1);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.75, 8).rotateZ(Math.PI / 2), m.bone);
    arm.position.x = side * 0.375; pivot.add(arm);
    const N = 9;
    for (let i = 0; i < N; i++) {
      const f = i / (N - 1), len = 0.62 + 0.5 * Math.sin(f * Math.PI * 0.9 + 0.2) + (i === 0 ? 0.15 : 0);
      const a = -0.55 + f * 0.9; // fan: the far feathers sweep back, the near ones forward
      const feather = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6).scale(len / 2, 0.012, 0.075 + 0.02 * (1 - f)), i > N - 3 ? m.tip : m.feather);
      feather.position.set(side * (0.05 + (len / 2) * Math.cos(a)), 0, -(len / 2) * Math.sin(a) * 0.5 - i * 0.012);
      feather.rotation.y = side * a * 0.5;
      feather.castShadow = true;
      pivot.add(feather);
    }
    g.add(pivot);
    g.userData.wings.push({ pivot, side });
  }
  g.userData.t = 0;
  setWings(g, 0, 0);
  return g;
}

// spread 0 = folded up against the back, 1 = held out level; flap adds the beat (-1..1).
export function setWings(g, spread, flap) {
  for (const { pivot, side } of g.userData.wings) pivot.rotation.z = side * (1.25 * (1 - spread) + (spread > 0.5 ? -0.05 : 0.15) * spread + flap * 0.75);
}
