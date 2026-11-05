// Captain Saltvane, the pirate captain, built on the veteran's real textured body. Three looks via skin.design:
//   1  crimson frock coat captain: tricorn and plume, gold-laced coat, jabot, baldric and cutlass
//   2  rough buccaneer: linen shirt, leather vest, bandana and battered hat, pistols, slouch boots
//   3  navy privateer officer: blue coat with white facings, bicorne, sash, small-sword and spyglass
import { buildCorsairD1 } from './corsair_d1.js';
import { buildCorsairD2 } from './corsair_d2.js';
import { buildCorsairD3 } from './corsair_d3.js';

export function buildCorsair(scene, skin) {
  const d = skin && skin.design ? +skin.design : 1;
  const s = skin || {};
  if (d === 2) return buildCorsairD2(scene, s);
  if (d === 3) return buildCorsairD3(scene, s);
  return buildCorsairD1(scene, s);
}
