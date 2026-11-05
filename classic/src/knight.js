// Sir Aldric, the knight. Looks picked with skin.design (1 to 5); default 5.4 = battle-torn polished-steel knight with the low burgonet and flowing steel hair.
//   1  late-medieval full harness: bascinet with the visor raised over a mail aventail, articulated plate, tabard
//   2  crusader: great helm over a mail coif, hauberk with mittens, long wool surcoat with a cross, kite shield
//   3  battle-worn man-at-arms: open sallet, brigandine, mail sleeves, wool and leather
//   4  slim grey Nord/Imperial-style plate knight: closed helm with a T slit and crest, ridged pauldrons, dark cloth
// The base model (veteran.glb) only supplies the real head, hands and ankles; everything else is built here
// as one skinned mesh (see knight_kit.js for the toolkit and knight_body.js for the under-layers).
import { buildKnightD1 } from './knight_d1.js';
import { buildKnightD2 } from './knight_d2.js';
import { buildKnightD3 } from './knight_d3.js';
import { buildKnightD4 } from './knight_d4.js';
import { buildKnightD5 } from './knight_d5.js';

export function buildKnight(scene, skin) {
  if (!skin || !skin.design) skin = { ...skin, design: 5.4 };
  const d = +skin.design;   // design 5.1 to 5.5 picks helm type 1 to 5 (dev viewer)
  if (d === 2) return buildKnightD2(scene, skin);
  if (Math.floor(d) === 5) return buildKnightD5(scene, skin);
  if (d === 4) return buildKnightD4(scene, skin);
  if (d === 3) return buildKnightD3(scene, skin);
  return buildKnightD1(scene, skin);
}
