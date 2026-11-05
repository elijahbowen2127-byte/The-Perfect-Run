// Skins: every character has a list of looks, the first one being the default.
//
//   id     stable key stored in localStorage and sent to other players (presence field `sk`)
//   name   shown in the character select
//   pp     price in Perfect Points (see meta.js). 0 = free. Nothing is for sale yet: set `pp`
//          on a skin and make `skinUnlocked()` check the owned list in meta to start selling.
//   sw     two or three CSS colours for the little swatch in the picker
//   ...    everything else is read by that character's builder (characters.js, armor.js, chad.js, quill.js)
//
// Giga Tyrone's skins keep his dark brown skin tone (`tone`); only hair dye, outfit, trim and accents change.
// The whole roster shares one skeleton, so a skin only changes materials, colours and small
// accessories; it never needs new animation clips.

const S = (id, name, sw, rest = {}) => ({ id, name, pp: 0, sw, ...rest });

export const SKINS = {
  veteran: [
    S('rifleman', 'Rifleman', ['#4a4a32', '#6e6648']),
    S('navy', 'Navy Officer', ['#27324d', '#b6bfcf'], { suit: { dh: 165, sk: 1.35, lk: 0.95, l0: 0.02 }, gear: { od: '#2a3550', web: '#aab4c4', spots: ['#1c2438', '#3a4a6c', '#12192a', '#566a94'], brass: 0xc9ced8 } }),
    S('winter', 'Winter Patrol', ['#e3e7ec', '#8d97a3'], { suit: { dh: 0, sk: 0.1, lk: 1.45, l0: 0.2 }, gear: { od: '#dfe3e6', web: '#8f98a3', spots: ['#c4cbd1', '#f3f5f7', '#a9b2ba', '#ffffff'], brass: 0xb4bcc8 } }),
  ],
  bonelord: [
    S('bleached', 'Bleached', ['#d9ccad', '#9fe8ff']),
    S('gilded', 'Gilded King', ['#e6b84a', '#ffb020'], { bone: 0xffc95a, eye: 0xffb020, metal: 0.55, crown: true }),
    S('cinder', 'Cinder', ['#4b3b36', '#ff5a1f'], { bone: 0x6a544c, eye: 0xff5a1f, ember: true }),
    S('jade', 'Graveyard Jade', ['#8fd6a8', '#6dff9a'], { bone: 0xa4e6b6, eye: 0x6dff9a }),
  ],
  scalefang: [
    S('swamp', 'Swamp', ['#5d7a2c', '#b8b072']),
    S('ember', 'Ember Drake', ['#b83a1a', '#e8c27a'], { lizard: { base: 0xb23a18, belly: 0xe8c27a, band: 0x3a120a }, eye: ['#ffd23a', '#ff6a00'] }),
    S('glacier', 'Glacier', ['#2f7f9a', '#d8f0f5'], { lizard: { base: 0x2f7f9a, belly: 0xd8f0f5, band: 0x14344a }, eye: ['#e8fbff', '#59d4ff'] }),
  ],
  nyx: [
    S('moonlit', 'Moonlit', ['#f2f2fa', '#16161a'], { outfit: { black: true } }),
    S('crimson', 'Crimson Hunt', ['#d0243a', '#b01c30'], { hair: 0xd0243a, outfit: { h: 350, s: 0.72, l: 0.34 }, eyes: { dh: 56 } }),
    S('violet', 'Violet Dusk', ['#b78cff', '#7b3fd0'], { hair: 0xb78cff, outfit: { h: 268, s: 0.55, l: 0.42 }, eyes: { dh: 170 } }),
  ],
  ironwood: [
    S('verdant', 'Verdant Guard', ['#546b34', '#e6dcc0', '#38e8cf'], {
      tex: { plate: { h: 92, s0: 0.1, sk: 0.34, l0: 0.04, lk: 0.5 }, stripe: { h: 46, s0: 0.12, sk: 0.2, l0: 0.5, lk: 0.55 }, fabric: { h: 100, s0: 0.05, sk: 0.2, l0: 0, lk: 0.5 }, steel: { h: 95, s0: 0.06, sk: 0.3, l0: 0.04, lk: 0.7 } },
      c: { steel: 0x546b34, steel2: 0x65803f, dark: 0x1c2415, trim: 0xe6dcc0, visor: 0x38e8cf, visor2: 0x0b4f56 },
    }),
    S('arctic', 'Arctic Wolf', ['#c9d3dc', '#3f78b8', '#ff5a44'], {
      tex: { plate: { h: 208, s0: 0.05, sk: 0.14, l0: 0.2, lk: 0.62 }, stripe: { h: 205, s0: 0.5, sk: 0.2, l0: 0.45, lk: 0.5, glow: 0.9 }, fabric: { h: 212, s0: 0.1, sk: 0.2, l0: 0.02, lk: 0.55 }, steel: { h: 210, s0: 0.1, sk: 0.2, l0: 0.18, lk: 0.7 } },
      c: { steel: 0xaeb9c4, steel2: 0xc9d3dc, dark: 0x232b36, trim: 0x3f78b8, visor: 0xff5a44, visor2: 0x5a1410 },
    }),
    S('sunforged', 'Sunforged', ['#b88a2e', '#a3241c', '#c48bff'], {
      tex: { plate: { h: 38, s0: 0.35, sk: 0.35, l0: 0.06, lk: 0.62 }, stripe: { h: 2, s0: 0.45, sk: 0.4, l0: 0.2, lk: 0.55 }, fabric: { h: 24, s0: 0.1, sk: 0.3, l0: 0.0, lk: 0.5 }, steel: { h: 40, s0: 0.2, sk: 0.3, l0: 0.05, lk: 0.75 } },
      c: { steel: 0xb08a2e, steel2: 0xd0a43c, dark: 0x2a1a10, trim: 0xa3241c, visor: 0xc48bff, visor2: 0x2e1450 },
    }),
  ],
  gigachad: [
    S('classic', 'Classic', ['#62402e', '#0d0b0a', '#c4222a'], { tone: 0x62402e, hair: 0x0d0b0a, beard: 0x0d0b0a, shades: 0x07080a, lens: 0x0a0c10, trunks: 0xc4222a, trim: 0xf2c94c, shoes: 0xf2f2f2, shoes2: 0xc4222a }),
    S('beach', 'Beach Day', ['#f0c040', '#26b7c4', '#ff7a59'], { tone: 0x6e4833, hair: 0x15100e, beard: 0x15100e, shades: 0xf0f0f0, lens: 0x2a6fa8, trunks: 0x1fb8c6, trim: 0xff7a59, shoes: 0xffb84a, shoes2: 0x1fb8c6, flowers: true }),
    S('neon', 'Neon Nights', ['#e83ad0', '#2de6ff', '#241a3a'], { tone: 0x583826, hair: 0xd8dcff, beard: 0x17121c, shades: 0x1a1030, lens: 0xff2bd6, trunks: 0x241a3a, trim: 0x2de6ff, shoes: 0x241a3a, shoes2: 0xe83ad0, glowTrim: true }),
  ],
  quill: [
    S('clay', 'Clay & Cream', ['#d97757', '#f3e8d2'], { clay: 0xe8a07d, joints: 0xb8664a, coat: 0xd97757, coat2: 0xbd5d3e, trim: 0xf3e8d2, pants: 0x4a3530, boots: 0x7a4a34, hat: 0xf0e4cc, glow: 0xff9a6c, glowCore: 0xfff1de }),
    S('ink', 'Inkwell Night', ['#2c3a63', '#8fb6ff'], { clay: 0x3a4a7c, joints: 0x232e52, coat: 0x2a3150, coat2: 0x1e2440, trim: 0xe8b86a, pants: 0x151a2c, boots: 0x32283a, hat: 0x232a48, glow: 0x7fd4ff, glowCore: 0xeaf8ff }),
    S('sage', 'Sage Scribe', ['#8fae8a', '#e7c98f'], { clay: 0xcf8f5e, joints: 0x9a5a38, coat: 0x9db796, coat2: 0x7b9776, trim: 0xe7c98f, pants: 0x4b4a3a, boots: 0x6a5238, hat: 0xb8cdb0, glow: 0xffe08a, glowCore: 0xfff8dc }),
  ],
  knight: [
    S('ironclad', 'Ironclad', ['#8a9098', '#5c6168', '#c4cad2'], { steel: 0x9aa1aa, steel2: 0x737a84, mail: 0x666c76, tabard: 0x6b7078, tabard2: 0x565b62, emblem: 0x8d939b, heraldry: 'cross', trim: 0xa9b0b9, leather: 0x34302c, plume: 0x6b7078 }),
    S('crusader', 'Crusader', ['#b9c0c8', '#f1ece0', '#b8202a'], { steel: 0xb4bcc6, steel2: 0x8f98a4, mail: 0x6c727c, tabard: 0xefe9da, tabard2: 0xcfc7b4, emblem: 0xb8202a, heraldry: 'cross', trim: 0xd9b45a, leather: 0x4a3222, plume: 0xb8202a }),
    S('blackguard', 'Blackguard', ['#3a3d46', '#1c1620', '#c9a24a'], { steel: 0x4a4e58, steel2: 0x33363e, mail: 0x3a3d45, tabard: 0x1e1724, tabard2: 0x2e2236, emblem: 0xc9a24a, heraldry: 'chevron', trim: 0xc9a24a, leather: 0x2a1c16, plume: 0x6a1e8a }),
    S('azure', 'Azure Lion', ['#d6dde6', '#2a4fa8', '#f0c23c'], { steel: 0xd3dae2, steel2: 0xa9b3bf, mail: 0x7a828e, tabard: 0x2a4fa8, tabard2: 0x1d3a80, emblem: 0xf0c23c, heraldry: 'bars', trim: 0xf0c23c, leather: 0x3c2a1c, plume: 0xf0c23c }),
  ],
  ninja: [
    S('shadow', 'Shadow', ['#15151a', '#b8202a'], { suit: 0x16161b, suit2: 0x2a2a33, wrap: 0x3e3e4a, leather: 0x2c2420, sash: 0xb8202a, trim: 0x9a9aa6, skin: 0xd9a583, eye: 0x1a1410 }),
    S('ash', 'Ash Mist', ['#3a3c44', '#e8e4d8'], { suit: 0x3a3c44, suit2: 0x4c4e5a, wrap: 0x6a6c80, leather: 0x3a2e28, sash: 0xe8e4d8, trim: 0xc0c4d0, skin: 0xcf9d7c, eye: 0x1a1410 }),
    S('viper', 'Viper', ['#101418', '#5ad64a'], { suit: 0x101418, suit2: 0x1e262a, wrap: 0x2e4034, leather: 0x1e2a22, sash: 0x5ad64a, trim: 0x8fd880, skin: 0xd9a583, eye: 0x1c4a18 }),
  ],
  grey: [
    S('slate', 'Slate Grey', ['#b4bac2', '#05060a'], { skin: 0xb4bac2, shade: 0x6f7a88, eye: 0x05060a }),
    S('pale', 'Pale Visitor', ['#d2d6da', '#0a0c14'], { skin: 0xd2d6da, shade: 0x8d97a4, eye: 0x0a0c14 }),
    S('ash', 'Ash Walker', ['#7f8289', '#120a0c'], { skin: 0x7f8289, shade: 0x464b55, eye: 0x120a0c }),
  ],
  // Space-map aliens (mobrig.js builds them on the Visitor's body): one skin each, so each is its own colour.
  mob_zorp: [S('a', 'Zorp', ['#7fd070', '#05060a'], { skin: 0x7fd070, shade: 0x2f8a3a, eye: 0x0a1204 })],
  mob_gloop: [S('a', 'Gloop', ['#3a8aff', '#05060a'], { skin: 0x4a98ff, shade: 0x1c3a9a, eye: 0xfff070 })],
  mob_lanky: [S('a', 'Lanky', ['#b070ff', '#05060a'], { skin: 0xa468f0, shade: 0x4a2a8a, eye: 0xffe040 })],
  mob_stinger: [S('a', 'Stinger', ['#e8c820', '#05060a'], { skin: 0xe8c820, shade: 0x3a2e08, eye: 0x1a0a04 })],
  mob_warden: [S('a', 'Warden', ['#4adbd0', '#05060a'], { skin: 0x4adbd0, shade: 0x1a6a78, eye: 0x061a20 })],
  mob_echo8: [S('a', 'Visitor', ['#c8d0da', '#05060a'], { skin: 0xc8d0da, shade: 0x6f7a88, eye: 0x02030a })],
  mob_boss8: [S('a', 'Visitor', ['#c8d0da', '#05060a'], { skin: 0xc8d0da, shade: 0x6f7a88, eye: 0x02030a })],
  corsair: [
    S('scarlet', 'Scarlet Tide', ['#8e1c22', '#e0b45a', '#2fa84a'], { coat: 0x8e1c22, coat2: 0x5e1216, trim: 0xe0b45a, shirt: 0xefe6d2, sash: 0x2b3a8a, pants: 0x2a2630, boots: 0x3a2618, hat: 0x1c1418, skin: 0xd0956c, beard: 0x3a2214, parrot: 0x2fa84a, parrot2: 0xf0c23c, parrot3: 0x2a5fc4 }),
    S('admiral', 'Admiral', ['#1e3270', '#efe6d2', '#e03030'], { coat: 0x1e3270, coat2: 0x14224e, trim: 0xf0e6c8, shirt: 0xefe6d2, sash: 0xb8202a, pants: 0xf0ead8, boots: 0x1a1414, hat: 0x1e3270, skin: 0xc48a62, beard: 0x5a3a24, parrot: 0xe03030, parrot2: 0xf0c23c, parrot3: 0x2a5fc4 }),
    S('blackflag', 'Black Flag', ['#1a1a1e', '#c0c4cc', '#e8e8f0'], { coat: 0x1a1a1e, coat2: 0x101014, trim: 0xc0c4cc, shirt: 0x8a2028, sash: 0x3a3a44, pants: 0x1e1c22, boots: 0x101010, hat: 0x121214, skin: 0xb07a58, beard: 0x1a1410, parrot: 0xf0f0f4, parrot2: 0xf2d84a, parrot3: 0xc8c8d0 }),
  ],
};

export const DEFAULT_SKIN = (chId) => (SKINS[chId] || [])[0] ? SKINS[chId][0].id : 'default';
export const skinsOf = (chId) => SKINS[chId] || [];
// The skin with this id, or the character's default when the id is unknown (old saves, bad data).
export function skinOf(chId, skinId) {
  const list = SKINS[chId];
  if (!list || !list.length) return { id: 'default', name: 'Default', pp: 0, sw: [] };
  return list.find((s) => s.id === skinId) || list[0];
}
export const validSkin = (chId, skinId) => !!(SKINS[chId] && SKINS[chId].some((s) => s.id === skinId));
export const skinIsFree = (skin) => !(skin.pp > 0);
// Hook for the Perfect Shop: once skins cost PP, return whether this device owns it (e.g. from meta.js).
export const skinUnlocked = (chId, skin) => skinIsFree(skin);
