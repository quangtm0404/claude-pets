// The pets' pixel art: sprites, growing up and what they wear. Shared by the
// plugin and the board service (server/), which draws the same pet on badges.
// Pure data and functions: no engine, no DOM.
import type { PetKind } from '../types'

export const SPRITE_W = 7
export const SPRITE_ROWS = 4

export type Pose = 'walkA' | 'walkB' | 'sit' | 'sleep'
export type Mood = 'happy' | 'grumpy' | 'furious' | 'gameover'
export const KID_W = 5
export const ANGRY_EYE = 0xff2a2a

export type PetArt = {
  /** Pixel letters to colours; `e` is the eye, `E` the cross eye. */
  colors: Record<string, number>
  /** Ears or fin / face / body, 7 pixels wide, facing left. */
  body: [string, string, string]
  /** The same three rows when grumpy: ears back, teeth, a tail up. Absent: just the cross eye. */
  cross?: [string, string, string]
  /** The bottom row per pose: legs for walkers, a flicking tail for swimmers. */
  legs: Record<'walkA' | 'walkB' | 'sit', string>
  /** The letter a closed eye becomes. */
  fill: string
  /** Whether a calm pet tucks its tail (top-right of the sprite) when it sits. */
  tuck: boolean
}

export const ART: Record<PetKind, PetArt> = {
  cat: {
    colors: { o: 0xf0a040, e: 0x101010 },
    body: ['o.o...o', 'eoe..o.', 'oooooo.'],
    cross: ['.....oo', 'EoE.oo.', 'oooooo.'],
    legs: { walkA: '.o.o.o.', walkB: 'o.o.o..', sit: 'oooooo.' },
    fill: 'o', tuck: true,
  },
  dog: {
    colors: { w: 0xe8d8c0, b: 0x7a4a20, e: 0x101010 },
    body: ['bb.....', 'wewb..w', 'wwwwww.'],
    cross: ['.b.....', 'wEwb.w.', 'wwwwww.'],
    legs: { walkA: '.w.w.w.', walkB: 'w.w.w..', sit: 'wwwwww.' },
    fill: 'w', tuck: true,
  },
  crab: {
    colors: { r: 0xe8452c, d: 0xa82a18, e: 0xffffff },
    body: ['d.....d', 'dde.edd', '.rrrrr.'],
    cross: ['dd...dd', 'ddE.Edd', '.rrrrr.'],
    legs: { walkA: 'r.r.r.r', walkB: '.r.r.r.', sit: '.rrrrr.' },
    fill: 'd', tuck: false,
  },
  shark: {
    colors: { g: 0x7d8ea3, w: 0xe9eef3, e: 0x0d0d0d },
    body: ['...g..g', 'geggggg', 'wwwwgg.'],
    cross: ['...g..g', 'gEggggg', '.w.wgg.'],
    legs: { walkA: '......g', walkB: '.......', sit: '.......' },
    fill: 'g', tuck: false,
  },
  turtle: {
    colors: { s: 0x3f8f3a, d: 0x2e6b2b, k: 0x9ccc65, e: 0x101010 },
    body: ['..sss..', 'kedsds.', '.sssss.'],
    cross: ['..sss..', '.Edsds.', '.sssss.'],
    legs: { walkA: '.k...k.', walkB: '..k.k..', sit: '.......' },
    fill: 'k', tuck: false,
  },
  mouse: {
    colors: { m: 0xb8b8c4, p: 0xff9eb5, e: 0x101010 },
    body: ['.pp....', 'pemmm..', '.mmmmpp'],
    cross: ['.p.....', 'pEmmm..', '.mmmm.p'],
    legs: { walkA: '.m.m...', walkB: 'm.m....', sit: '.mmm...' },
    fill: 'm', tuck: false,
  },
  fox: {
    colors: { f: 0xe8742a, w: 0xf5f5f5, k: 0x2a1a10, e: 0x101010 },
    body: ['f.f....', 'wef..ff', 'ffffffw'],
    cross: ['.....ff', 'wEf.ffw', 'ffffff.'],
    legs: { walkA: '.k.k.k.', walkB: 'k.k.k..', sit: 'ffffff.' },
    fill: 'f', tuck: true,
  },
  orca: {
    colors: { k: 0x151515, w: 0xf0f0f0, e: 0xf0f0f0 },
    body: ['...k...', 'kekkkk.', 'wwwkkkk'],
    legs: { walkA: '......k', walkB: '.....k.', sit: '.......' },
    fill: 'k', tuck: false,
  },
  whale: {
    colors: { b: 0x3a6fd0, l: 0x9cc3ff, e: 0x101010 },
    body: ['.l.....', 'bebbbb.', 'llbbbbb'],
    cross: ['.......', 'bEbbbb.', 'llbbbbb'],
    legs: { walkA: '.....bb', walkB: '......b', sit: '.......' },
    fill: 'b', tuck: false,
  },
  dolphin: {
    colors: { g: 0x6fa8dc, w: 0xdfefff, e: 0x101010 },
    body: ['...g...', '.egggg.', 'gwwwggg'],
    legs: { walkA: '......g', walkB: '.....g.', sit: '.......' },
    fill: 'g', tuck: false,
  },
  giraffe: {
    colors: { y: 0xf2c14e, o: 0xa0522d, e: 0x101010 },
    body: ['eyo....', '.y.....', '.yoyoyo'],
    legs: { walkA: '.y.y.y.', walkB: 'y.y.y..', sit: '.yyyyy.' },
    fill: 'y', tuck: false,
  },
  tiger: {
    colors: { t: 0xf08a24, k: 0x1a1a1a, e: 0x101010 },
    body: ['t.t...t', 'ete..t.', 'tktktk.'],
    cross: ['.....tt', 'EtE.tt.', 'tktktk.'],
    legs: { walkA: '.t.t.t.', walkB: 't.t.t..', sit: 'tktktk.' },
    fill: 't', tuck: true,
  },
  squirrel: {
    colors: { r: 0xb5651d, c: 0xf3d9b1, e: 0x101010 },
    body: ['r...rr.', 'err.rrr', 'crrrrr.'],
    legs: { walkA: '.r.r...', walkB: 'r.r....', sit: '.rrr...' },
    fill: 'r', tuck: false,
  },
  penguin: {
    colors: { k: 0x1c1c28, w: 0xf2f2f2, y: 0xffa31a, e: 0x101010 },
    body: ['.kk....', 'yewk...', '.wwk...'],
    legs: { walkA: '.y..y..', walkB: '..yy...', sit: '.yy....' },
    fill: 'w', tuck: false,
  },
  // only from a blind box (E9)
  dragon: {
    colors: { g: 0x43a047, d: 0x1b5e20, y: 0xffe082, e: 0x101010 },
    body: ['d..d.dd', 'geg.ddg', 'yggggg.'],
    legs: { walkA: '.g.g.g.', walkB: 'g.g.g..', sit: 'yggggg.' },
    fill: 'g', tuck: false,
  },
  unicorn: {
    colors: { w: 0xf7f4ff, h: 0xffc83d, m: 0xff7ac0, e: 0x101010 },
    body: ['h.m....', 'wwmm..m', '.ewwwww'],
    legs: { walkA: '.w...w.', walkB: 'w.w.w..', sit: '.wwwww.' },
    fill: 'w', tuck: false,
  },
  axolotl: {
    colors: { p: 0xffaecb, d: 0xff4f8b, e: 0x101010 },
    body: ['d.d....', 'peppp..', 'ppppppp'],
    legs: { walkA: '.p..p..', walkB: 'p..p...', sit: '.......' },
    fill: 'p', tuck: false,
  },
}

/** The animals only a blind box hatches (E9). */
export const BOX_PETS: PetKind[] = ['dragon', 'unicorn', 'axolotl']

// ── Growing up (E6-S03) ──────────────────────────────────────────────────────
// A baby until LV10 (the helpers' 5×3 shape), then the full sprite; legends
// twinkle, and mythic pets grow wings. XP is the player's, so switching animals
// never undoes a stage.
export type Stage = 'baby' | 'adult' | 'legend' | 'mythic'
export const STAGES: { stage: Stage; at: number }[] = [
  { stage: 'baby', at: 1 }, { stage: 'adult', at: 10 }, { stage: 'legend', at: 25 }, { stage: 'mythic', at: 50 },
]
export const stageOf = (level: number): Stage => STAGES.filter(x => level >= x.at).pop()?.stage ?? 'baby'
export const nextStage = (level: number) => STAGES.find(x => x.at > level) ?? null

// ── The coin shop (E6-S02) ───────────────────────────────────────────────────
// Each item is a few pixels placed from the pet's eye: [forward, down, colour],
// forward being the way the pet faces. One item per slot.
export type ItemId = 'bow' | 'scarf' | 'shades' | 'hat' | 'lantern' | 'crown'
  | 'flower' | 'headphones' | 'bandana' | 'cape' | 'wizard' | 'halo' | 'rainbow'
  | 'party'
type Slot = 'head' | 'face' | 'neck' | 'hand' | 'back'
/** Shop items have a price; box-only items (E9) have none and a rarity instead; the party hat is for birthdays (E8-S04). */
export const ITEMS: Record<ItemId, { name: string; price: number; slot: Slot; px: [number, number, number][]; rarity?: Rarity; isEvent?: boolean }> = {
  bow: { name: 'Pink bow', price: 15, slot: 'head', px: [[-2, -1, 0xff7eb6], [-3, -1, 0xff7eb6]] },
  scarf: { name: 'Red scarf', price: 25, slot: 'neck', px: [[-1, 1, 0xe53935], [-2, 1, 0xe53935], [-3, 2, 0xb71c1c]] },
  shades: { name: 'Sunglasses', price: 40, slot: 'face', px: [[0, 0, 0x33ccff], [-1, 0, 0x111111], [1, 0, 0x111111]] },
  hat: { name: 'Top hat', price: 60, slot: 'head', px: [[1, -1, 0x2b2b2b], [0, -1, 0x2b2b2b], [-1, -1, 0x2b2b2b], [0, -2, 0x2b2b2b]] },
  lantern: { name: 'Tết lantern', price: 88, slot: 'hand', px: [[1, 1, 0xe53935], [1, 2, 0xffc107]] },
  crown: { name: 'Crown', price: 200, slot: 'head', px: [[1, -1, 0xffd23f], [0, -1, 0xff3b3b], [-1, -1, 0xffd23f], [0, -2, 0xffd23f]] },
  flower: { name: 'Flower crown', price: 0, rarity: 'common', slot: 'head', px: [[1, -1, 0xff8fc8], [0, -1, 0x66bb6a], [-1, -1, 0xffe066]] },
  headphones: { name: 'Headphones', price: 0, rarity: 'common', slot: 'head', px: [[1, -1, 0x37474f], [0, -1, 0x37474f], [-1, -1, 0x37474f], [-1, 0, 0x26c6da]] },
  bandana: { name: 'Blue bandana', price: 0, rarity: 'common', slot: 'neck', px: [[-1, 1, 0x1e88e5], [-2, 1, 0x1e88e5]] },
  cape: { name: 'Hero cape', price: 0, rarity: 'rare', slot: 'back', px: [[-3, 0, 0xc62828], [-4, 0, 0xc62828], [-4, 1, 0xc62828]] },
  wizard: { name: 'Wizard hat', price: 0, rarity: 'rare', slot: 'head', px: [[1, -1, 0x5e35b1], [0, -1, 0x5e35b1], [-1, -1, 0x5e35b1], [0, -2, 0xffd23f]] },
  rainbow: { name: 'Rainbow scarf', price: 0, rarity: 'rare', slot: 'neck', px: [[-1, 1, 0xef5350], [-2, 1, 0xffee58], [-3, 1, 0x42a5f5]] },
  halo: { name: 'Halo', price: 0, rarity: 'epic', slot: 'head', px: [[1, -2, 0xffe57f], [0, -2, 0xffe57f], [-1, -2, 0xffe57f]] },
  party: { name: 'Party hat', price: 0, isEvent: true, slot: 'head', px: [[1, -1, 0xff5ca8], [0, -1, 0x42a5f5], [-1, -1, 0xff5ca8], [0, -2, 0xffd23f]] },
}
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[]
export const isItemId = (x: unknown): x is ItemId => typeof x === 'string' && Object.hasOwn(ITEMS, x)

/** Where the eye is in a sprite (source coordinates, facing left), or null. */
export function eyeOf(rows: string[]): [number, number] | null {
  for (let y = 0; y < rows.length; y++) {
    const x = rows[y]!.search(/[eE]/)
    if (x >= 0) return [x, y]
  }
  return null
}

/** Pixels drawn over the pet in its own coordinates: stage effects, then what it wears. */
export function extrasFor(kind: PetKind, stage: Stage, items: ItemId[], tick: number): [number, number, number][] {
  const out: [number, number, number][] = []
  const shape = stage === 'baby' ? babySprite(kind, 'walkA') : sprite(kind, 'walkA')
  const sw = shape[0]?.length ?? SPRITE_W
  if (stage === 'legend' || stage === 'mythic') out.push(tick % 10 < 5 ? [-1, 0, 0xfff6a0] : [sw, 1, 0xfff6a0])
  if (stage === 'mythic') {
    const up = tick % 6 < 3
    out.push([sw - 3, up ? 0 : 1, 0xf5f5ff], [sw - 2, up ? 0 : 1, 0xf5f5ff], [sw - 1, up ? 0 : 1, 0xdde4ff])
  }
  const eye = eyeOf(shape)
  if (eye) for (const id of items) for (const [fwd, dy, c] of ITEMS[id].px) out.push([eye[0] - fwd, eye[1] + dy, c])
  return out
}

/** A helper (a subagent's pet), or a baby: the full sprite's front half, 5×3 pixels (face, body, legs). */
export function babySprite(kind: PetKind, pose: Pose, mood: Mood = 'happy'): string[] {
  return sprite(kind, pose, mood).slice(1).map(row => row.slice(0, KID_W))
}
export function sprite(kind: PetKind, pose: Pose, mood: Mood = 'happy'): string[] {
  const def = ART[kind]
  const isCross = mood === 'grumpy' || mood === 'furious'
  let body: string[] = isCross ? (def.cross ?? def.body.map(r => r.replace(/e/g, 'E'))) : def.body.slice()
  // eyes closed while asleep
  if (pose === 'sleep') body = body.map(row => row.replace(/[eE]/g, def.fill))
  // tail tucked in while sitting calmly (a cross pet keeps it up)
  if ((pose === 'sit' || pose === 'sleep') && def.tuck && !isCross) {
    body = body.map((row, i) => (i <= 1 ? row.slice(0, 4) + '...' : row))
  }
  return [...body, def.legs[pose === 'sleep' ? 'sit' : pose]]
}

// ── The new look (E10): bigger sprites, drawn as pixels or as smooth shapes ──
// Each animal has a grown-up sprite (12 wide, up to 8 tall) and a baby one (8
// wide, 5 tall), facing left. Letters are colours; `e` is an eye. The terminal
// draws them as pixels; the desktop app, VS Code and the badge trace them into
// rounded, outlined shapes with real eyes (vectorPet).
type Legs = Record<'walkA' | 'walkB' | 'sit', string[]>
export type HdArt = {
  colors: Record<string, number>
  /** The body colour: the outline is drawn round it. */
  fill: string
  body: string[]
  legs: Legs
  baby: { body: string[]; legs: Legs }
}
export const HD_H = 8
export const HD_W = 12
export const BABY_W = 8

/** Four legs, two pixels long: apart on one step, close on the next; `foot` colours the bottom pixel. */
const walkers = (leg: string, apart: number[], close: number[], sit: string[], foot = leg): Legs => {
  const row = (xs: number[], c: string) => Array.from({ length: HD_W }, (_, x) => (xs.includes(x) ? c : '.')).join('')
  return { walkA: [row(apart, leg), row(apart, foot)], walkB: [row(close, leg), row(close, foot)], sit }
}

export const HD: Record<PetKind, HdArt> = {
  cat: {
    colors: { o: 0xf0a040, d: 0xc76f1e, c: 0xfde7c4, p: 0xff8fa8, e: 0x1a1a1a },
    fill: 'o',
    body: [
      '.o...o......',
      '.oo.oo....o.',
      'ooooooo...o.',
      'oeoooeodoodo',
      'occpccoooooo',
      '.cccccdoodo.',
    ],
    legs: walkers('o', [1, 3, 8, 10], [2, 3, 8, 9], ['.oo..oooooo.', '.cc..oooooo.']),
    baby: {
      body: ['.o..o...', 'oooooo.o', 'oeooeooo', 'ocpcoooo'],
      legs: { walkA: ['.o..o.o.'], walkB: ['o..o.o..'], sit: ['.cc.oo..'] },
    },
  },
  dog: {
    colors: { w: 0xead9bd, b: 0x8a5a2b, k: 0x2a1a10, p: 0xff7f9a, e: 0x1a1a1a },
    fill: 'w',
    body: [
      '...www......',
      '..wwwwb.....',
      '.wewwwb....w',
      'kwwwwwb...w.',
      'wwwwwwwwwww.',
      '.pwwwwbbbww.',
    ],
    legs: walkers('w', [2, 4, 8, 10], [3, 4, 8, 9], ['.ww..wwwwww.', '.ww..wwwww..']),
    baby: {
      body: ['..www...', '.wewb..w', 'kwwwbww.', '.pwwwww.'],
      legs: { walkA: ['.w..w.w.'], walkB: ['..w.w.w.'], sit: ['.ww.ww..'] },
    },
  },
  crab: {
    colors: { r: 0xe8452c, d: 0xa82a18, s: 0xa82a18, e: 0x1a1a1a },
    fill: 'r',
    body: [
      'dd..e..e..dd',
      'd.d.s..s.d.d',
      '.dd.rrrr.dd.',
      '..drrrrrrd..',
      '..rrrrrrrr..',
      '...rrrrrr...',
    ],
    legs: { walkA: ['..rrrrrrrr..', '..r.r..r.r..'], walkB: ['..rrrrrrrr..', '...r.rr.r...'], sit: ['..rrrrrrrr..', '..r.r..r.r..'] },
    baby: {
      body: ['d.e..e.d', 'dd.ss.dd', '.rrrrrr.', '..rrrr..'],
      legs: { walkA: ['..r..r..'], walkB: ['...rr...'], sit: ['..rrrr..'] },
    },
  },
  shark: {
    colors: { g: 0x7d8ea3, w: 0xe9eef3, k: 0x5a6b80, e: 0x1a1a1a },
    fill: 'g',
    body: [
      '......k.....',
      '.....gk....k',
      '..ggggggg.kk',
      '.geggggggggk',
      'gwwwgggggg.k',
      '.wwwwwwgg...',
    ],
    legs: { walkA: ['...g........'], walkB: ['....g.......'], sit: ['............'] },
    baby: {
      body: ['....k...', '.ggggg.k', 'geggggkk', '.wwwgg.k'],
      legs: { walkA: ['..g.....'], walkB: ['...g....'], sit: ['........'] },
    },
  },
  turtle: {
    colors: { s: 0x3f8f3a, d: 0x2e6b2b, k: 0x9ccc65, e: 0x1a1a1a },
    fill: 's',
    body: [
      '....ssss....',
      '...sdsdss...',
      '.kksdsdsds..',
      'kekdsdsdsds.',
      'kkkssssssssk',
      '....kkkkkk..',
    ],
    legs: { walkA: ['....kk..kk..'], walkB: ['.....k..k...'], sit: ['............'] },
    baby: {
      body: ['...sds..', 'kksdsds.', 'kesssss.', 'kk.kkkk.'],
      legs: { walkA: ['.k..k...'], walkB: ['...k.k..'], sit: ['........'] },
    },
  },
  mouse: {
    colors: { m: 0xb8b8c4, p: 0xff9eb5, w: 0xe6e6ee, e: 0x1a1a1a },
    fill: 'm',
    body: [
      '..mm........',
      '.mppm.......',
      '.mmmmmmmm...',
      'mmemmmmmmm..',
      'pmmmmmmmmmm.',
      '..wwwwwmm.pp',
    ],
    legs: { walkA: ['..m..m.m....'], walkB: ['..m.m..m....'], sit: ['..mm..mm....'] },
    baby: {
      body: ['.mm.....', 'mppmmm..', 'memmmmm.', 'pmmmmmpp'],
      legs: { walkA: ['..m.m...'], walkB: ['.m.m....'], sit: ['..mm....'] },
    },
  },
  fox: {
    colors: { f: 0xe8742a, w: 0xf5f5f5, k: 0x2a1a10, e: 0x1a1a1a },
    fill: 'f',
    body: [
      '.k..k.......',
      '.ff.ff....ff',
      '.fffff...fff',
      'fefefff.ffww',
      'kwwwwfffffw.',
      '.wwwffffff..',
    ],
    legs: walkers('k', [1, 3, 7, 9], [2, 3, 7, 8], ['.kk..ffffff.', '.kk..fffff..']),
    baby: {
      body: ['k..k....', 'ffff..ff', 'efef.fww', 'kwwfff..'],
      legs: { walkA: ['.k..k...'], walkB: ['k..k....'], sit: ['.kk.kk..'] },
    },
  },
  orca: {
    colors: { k: 0x1d1d22, w: 0xf0f0f0, e: 0x0a0a0a },
    fill: 'k',
    body: [
      '.....k......',
      '....kk......',
      '.kkkkkkkk..k',
      'kwekkkkkkkkk',
      'wwwwkkkkkk.k',
      '.wwwwwkkk...',
    ],
    legs: { walkA: ['...k........'], walkB: ['....k.......'], sit: ['............'] },
    baby: {
      body: ['...k....', '.kkkkk.k', 'kwekkkkk', '.wwwkk..'],
      legs: { walkA: ['..k.....'], walkB: ['...k....'], sit: ['........'] },
    },
  },
  whale: {
    colors: { b: 0x3a6fd0, l: 0x9cc3ff, s: 0xbfe3ff, e: 0x1a1a1a },
    fill: 'b',
    body: [
      '.s.s........',
      '..s.........',
      '.bbbbbbb....',
      'bebbbbbbbb.b',
      'llllbbbbbbbb',
      '.lllllbbb..b',
    ],
    legs: { walkA: ['...b........'], walkB: ['....b.......'], sit: ['............'] },
    baby: {
      body: ['.s.s....', '.bbbbb..', 'bebbbbbb', 'llllbb.b'],
      legs: { walkA: ['..b.....'], walkB: ['...b....'], sit: ['........'] },
    },
  },
  dolphin: {
    colors: { g: 0x6fa8dc, w: 0xdfefff, e: 0x1a1a1a },
    fill: 'g',
    body: [
      '.....g......',
      '....gg......',
      '...gggggg...',
      'ggegggggggg.',
      '.wwwwgggggg.',
      '....wwwgg.gg',
    ],
    legs: { walkA: ['.....g......'], walkB: ['......g.....'], sit: ['............'] },
    baby: {
      body: ['...g....', '..ggggg.', 'ggeggggg', '.wwwgg.g'],
      legs: { walkA: ['..g.....'], walkB: ['...g....'], sit: ['........'] },
    },
  },
  giraffe: {
    colors: { y: 0xf2c14e, o: 0xa0522d, k: 0x5a3a1a, e: 0x1a1a1a },
    fill: 'y',
    body: [
      '.k.k........',
      '.yyy........',
      'yeyy........',
      '..yo........',
      '..oyyoyyoyy.',
      '..yyoyyoyyyy',
    ],
    legs: walkers('y', [2, 4, 8, 10], [3, 4, 8, 9], ['..yy...yy...', '..kk...kk...'], 'k'),
    baby: {
      body: ['.k.k....', 'yeyy....', '.yoyoyy.', '.yyoyyo.'],
      legs: { walkA: ['.k...k..'], walkB: ['..k..k..'], sit: ['.kk..kk.'] },
    },
  },
  tiger: {
    colors: { t: 0xf08a24, k: 0x1a1a1a, w: 0xf8f0e0, p: 0xff8fa8, e: 0x1a1a1a },
    fill: 't',
    body: [
      '.t...t......',
      '.tt.tt.....t',
      'ttktktt....k',
      'tetttetkttkt',
      'twwpwwttktkt',
      '.wwwwwtktkt.',
    ],
    legs: walkers('t', [1, 3, 8, 10], [2, 3, 8, 9], ['.tt..tktktk.', '.ww..tttttt.'], 'w'),
    baby: {
      body: ['.t..t...', 'ttkktt.k', 'tettetkt', 'twpwtkt.'],
      legs: { walkA: ['.t..t.t.'], walkB: ['t..t.t..'], sit: ['.tt.tt..'] },
    },
  },
  squirrel: {
    colors: { r: 0xb5651d, c: 0xf3d9b1, e: 0x1a1a1a },
    fill: 'r',
    body: [
      '........rr..',
      '.r.r...rrrr.',
      '.rrr...rr.rr',
      'rerrr..rr..r',
      'crrrrrrrr...',
      '.ccrrrrr....',
    ],
    legs: walkers('r', [1, 3, 5, 7], [2, 3, 5, 6], ['..rr.rr.....', '..cc.rr.....']),
    baby: {
      body: ['r.r...r.', 'rrr..rrr', 'errrrr.r', 'ccrrr...'],
      legs: { walkA: ['.r.r....'], walkB: ['r.r.....'], sit: ['.rr.....'] },
    },
  },
  penguin: {
    colors: { k: 0x1c1c28, w: 0xf2f2f2, y: 0xffa31a, e: 0x0a0a0a },
    fill: 'k',
    body: [
      '..kkkk......',
      '.kkkkkk.....',
      'ykwekkk.....',
      '.kwwwkk.....',
      '.kwwwwkk....',
      '.kwwwwkk....',
    ],
    legs: { walkA: ['.kwwwkk.....', '..yy.yy.....'], walkB: ['.kwwwkk.....', '.yy..yy.....'], sit: ['.kwwwwk.....', '..yyyy......'] },
    baby: {
      body: ['.kkk....', 'ykwek...', '.kwwk...', '.kwwk...'],
      legs: { walkA: ['.yy.y...'], walkB: ['..yy....'], sit: ['.yyy....'] },
    },
  },
  dragon: {
    colors: { g: 0x43a047, d: 0x1b5e20, y: 0xffe082, h: 0xffb74d, e: 0x1a1a1a },
    fill: 'g',
    body: [
      '.h...h......',
      '.gg.gg.dd...',
      'ggggg.dddd..',
      'gegggddgdd..',
      'yyggggggggg.',
      '.yyyygggg.gg',
    ],
    legs: walkers('g', [1, 3, 6, 8], [2, 3, 6, 7], ['.gg..gggg...', '.yy..gggg...']),
    baby: {
      body: ['.h.h....', 'gggg.dd.', 'geggddg.', 'yyggggg.'],
      legs: { walkA: ['.g..g...'], walkB: ['g..g....'], sit: ['.gg.gg..'] },
    },
  },
  unicorn: {
    colors: { w: 0xf7f4ff, h: 0xffc83d, m: 0xff7ac0, n: 0x8c9eff, k: 0xb0a8c8, e: 0x1a1a1a },
    fill: 'w',
    body: [
      'h...........',
      '.hm.........',
      'wwmn........',
      'ewwmn......n',
      'wwwwwwwwwwmm',
      '.wwwwwwwwww.',
    ],
    legs: walkers('w', [1, 3, 8, 10], [2, 3, 8, 9], ['.ww..wwwww..', '.kk..kkkkk..'], 'k'),
    baby: {
      body: ['h.......', '.wmn....', 'ewwmn..n', 'wwwwwwmm'],
      legs: { walkA: ['.k..k...'], walkB: ['k..k....'], sit: ['.kk.kk..'] },
    },
  },
  axolotl: {
    colors: { p: 0xffaecb, d: 0xff4f8b, l: 0xffe0ea, e: 0x1a1a1a },
    fill: 'p',
    body: [
      'd...d.......',
      'dpppd.......',
      'ppepepppppp.',
      'plllpppppppp',
    ],
    legs: { walkA: ['.p..p..p..p.'], walkB: ['p..p..p..p..'], sit: ['.pp...pp....'] },
    baby: {
      body: ['d..d....', 'pepep...', 'plpppppp'],
      legs: { walkA: ['.p..p...'], walkB: ['p..p....'], sit: ['.pp.....'] },
    },
  },
}

/** A pet's sprite in the new look: baby or grown, the pose's legs, eyes for the mood. */
export function hdSprite(kind: PetKind, stage: Stage, pose: Pose, mood: Mood = 'happy'): string[] {
  const a = HD[kind]
  const src = stage === 'baby' ? a.baby : a
  const isCross = mood === 'grumpy' || mood === 'furious'
  let body = src.body.slice()
  if (isCross) body = body.map(r => r.replace(/e/g, 'E'))
  // eyes closed while asleep: `z` is drawn as the body in pixels, a lid in shapes
  if (pose === 'sleep') body = body.map(r => r.replace(/[eE]/g, 'z'))
  return [...body, ...src.legs[pose === 'sleep' ? 'sit' : pose]]
}

// ── Skins (E9): rare colourings from a blind box, any animal can wear them ──
export type SkinId = 'golden' | 'shadow' | 'pastel' | 'ghost' | 'galaxy'
export const SKINS: Record<SkinId, { name: string; rarity: Rarity }> = {
  pastel: { name: 'Pastel', rarity: 'epic' },
  shadow: { name: 'Shadow', rarity: 'epic' },
  ghost: { name: 'Ghost', rarity: 'epic' },
  golden: { name: 'Golden', rarity: 'legendary' },
  galaxy: { name: 'Galaxy', rarity: 'legendary' },
}
export const SKIN_IDS = Object.keys(SKINS) as SkinId[]
export const isSkinId = (x: unknown): x is SkinId => typeof x === 'string' && Object.hasOwn(SKINS, x)

const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255] as const
const pack = (r: number, g: number, b: number) => (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)
const lum = (c: number) => {
  const [r, g, b] = rgb(c)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}
export const mixC = (a: number, b: number, t: number) => {
  const x = rgb(a), y = rgb(b)
  return pack(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t)
}
/** Light to dark, a ramp a skin maps each colour onto by its lightness. */
const ramp = (stops: number[], t: number) => {
  const i = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)))
  return mixC(stops[i]!, stops[i + 1]!, t * (stops.length - 1) - i)
}
const SKIN_RAMPS: Record<SkinId, number[]> = {
  golden: [0x5a3a00, 0xb8860b, 0xffd23f, 0xfff4c2],
  shadow: [0x0b0614, 0x2a1a40, 0x4b2e6e, 0x8e6bbf],
  pastel: [0x9c8fb8, 0xc3b6e8, 0xffd6e8, 0xfffaf0],
  ghost: [0x7d8fa8, 0xb8c8e0, 0xe4eefc, 0xffffff],
  galaxy: [0x0a0a3a, 0x2d1b69, 0x6a3fb5, 0x9fd3ff],
}
/** The animal's colours in a skin; eyes stay eyes (a shadow pet's glow). */
export function skinColors(colors: Record<string, number>, skin: SkinId | null | undefined): Record<string, number> {
  if (!skin) return colors
  const out: Record<string, number> = {}
  for (const [k, c] of Object.entries(colors)) {
    out[k] = k === 'e' ? (skin === 'shadow' || skin === 'galaxy' ? 0xfff176 : c) : ramp(SKIN_RAMPS[skin], lum(c))
  }
  return out
}

// ── Items in the new look ────────────────────────────────────────────────────
// Each is a small picture placed at an anchor found on the sprite: the top of
// the head above the front eye, the eyes, the neck below them, or the front foot.
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
export type ItemArt = { at: 'head' | 'face' | 'neck' | 'hand' | 'back'; rows: string[]; colors: Record<string, number>; ax: number; ay: number }
export const ITEM_ART: Record<string, ItemArt> = {
  bow: { at: 'head', rows: ['pkp'], colors: { p: 0xff7eb6, k: 0xd6408a }, ax: 1, ay: 0 },
  scarf: { at: 'neck', rows: ['rrrr', '.d..'], colors: { r: 0xe53935, d: 0xb71c1c }, ax: 2, ay: 0 },
  shades: { at: 'face', rows: ['kkbkkk'], colors: { k: 0x111111, b: 0x33ccff }, ax: 1, ay: 0 },
  hat: { at: 'head', rows: ['.kkk.', '.kkk.', '.rrr.', 'kkkkk'], colors: { k: 0x2b2b2b, r: 0xd32f2f }, ax: 2, ay: 3 },
  lantern: { at: 'hand', rows: ['.y', 'rr', 'rr', '.y'], colors: { r: 0xe53935, y: 0xffc107 }, ax: 1, ay: 0 },
  crown: { at: 'head', rows: ['y.r.y', 'yyyyy'], colors: { y: 0xffd23f, r: 0xff3b3b }, ax: 2, ay: 1 },
  // box-only (E9)
  flower: { at: 'head', rows: ['p.y.p', 'gpgpg'], colors: { p: 0xff8fc8, y: 0xffe066, g: 0x66bb6a }, ax: 2, ay: 1 },
  headphones: { at: 'head', rows: ['.kkk.', 'k...k', 'c...c'], colors: { k: 0x37474f, c: 0x26c6da }, ax: 2, ay: 2 },
  bandana: { at: 'neck', rows: ['bwbb', '.bb.'], colors: { b: 0x1e88e5, w: 0xe3f2fd }, ax: 2, ay: 0 },
  cape: { at: 'back', rows: ['rrr', 'rrrr', '.rrrr', '..rrr'], colors: { r: 0xc62828 }, ax: 0, ay: 0 },
  wizard: { at: 'head', rows: ['..p..', '.pyp.', '.ppp.', 'ppppp'], colors: { p: 0x5e35b1, y: 0xffd23f }, ax: 2, ay: 3 },
  halo: { at: 'head', rows: ['yyyy', '....'], colors: { y: 0xffe57f }, ax: 1, ay: 1 },
  party: { at: 'head', rows: ['..y..', '..p..', '.pbp.', 'pbpbp'], colors: { p: 0xff5ca8, b: 0x42a5f5, y: 0xffd23f }, ax: 2, ay: 3 },
  rainbow: { at: 'neck', rows: ['roygbp'], colors: { r: 0xef5350, o: 0xffa726, y: 0xffee58, g: 0x66bb6a, b: 0x42a5f5, p: 0xab47bc }, ax: 3, ay: 0 },
}

/** Where each anchor is on a sprite (facing left): [x, y] in its own pixels. */
export function anchorsOf(rows: string[]) {
  const eyes: [number, number][] = []
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) if ('eEz'.includes(r[x]!)) eyes.push([x, y])
  })
  const lit = (x: number, y: number) => (rows[y]?.[x] ?? '.') !== '.'
  const front = eyes[0] ?? [1, 1]
  const back = eyes[1] ?? front
  // the top of the head: the highest lit pixel over the eyes
  let top = front[1]
  for (let x = front[0]; x <= back[0]; x++) for (let y = front[1]; y >= 0; y--) if (lit(x, y)) top = Math.min(top, y)
  const width = Math.max(...rows.map(r => r.length))
  return {
    head: [Math.round((front[0] + back[0]) / 2), top - 1] as [number, number],
    face: [front[0], front[1]] as [number, number],
    neck: [(back[0] === front[0] ? front[0] + 1 : back[0]) + 1, front[1] + 2] as [number, number],
    hand: [Math.max(0, front[0] - 1), rows.length - 4] as [number, number],
    back: [Math.min(width - 4, back[0] + 2), front[1]] as [number, number],
  }
}

/** The pixels an item adds to a sprite: [x, y, colour] in the sprite's own pixels. */
export function itemPixels(rows: string[], items: string[]): [number, number, number][] {
  const a = anchorsOf(rows)
  const out: [number, number, number][] = []
  for (const id of items) {
    const art = ITEM_ART[id]
    if (!art) continue
    const [x0, y0] = a[art.at]
    art.rows.forEach((r, iy) => {
      for (let ix = 0; ix < r.length; ix++) {
        const c = art.colors[r[ix]!]
        if (c !== undefined) out.push([x0 - art.ax + ix, y0 - art.ay + iy, c])
      }
    })
  }
  return out
}

// ── Tracing pixels into smooth shapes ────────────────────────────────────────
type Pt = [number, number]

/** The outlines of the lit cells, as closed loops of corners (diagonal touches stay apart). */
export function traceLoops(on: (x: number, y: number) => boolean, W: number, H: number): Pt[][] {
  const edges = new Map<string, Pt[]>()
  const add = (a: Pt, b: Pt) => {
    const k = `${a[0]},${a[1]}`
    const list = edges.get(k)
    if (list) list.push(b)
    else edges.set(k, [b])
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!on(x, y)) continue
      if (!on(x, y - 1)) add([x, y], [x + 1, y])
      if (!on(x + 1, y)) add([x + 1, y], [x + 1, y + 1])
      if (!on(x, y + 1)) add([x + 1, y + 1], [x, y + 1])
      if (!on(x - 1, y)) add([x, y + 1], [x, y])
    }
  }
  const loops: Pt[][] = []
  for (const [key, first] of edges) {
    while (first.length) {
      const start = key.split(',').map(Number) as Pt
      const loop: Pt[] = [start]
      let prev = start, cur = first.shift()!
      for (let guard = 0; guard < 100_000 && (cur[0] !== start[0] || cur[1] !== start[1]); guard++) {
        loop.push(cur)
        const outs = edges.get(`${cur[0]},${cur[1]}`)
        if (!outs?.length) break
        // at a pinch, turn right: the loop keeps to its own cell
        const d: Pt = [cur[0] - prev[0], cur[1] - prev[1]]
        let best = 0, bestTurn = -2
        outs.forEach((o, i) => {
          const turn = d[0] * (o[1] - cur[1]) - d[1] * (o[0] - cur[0])
          if (turn > bestTurn) { bestTurn = turn; best = i }
        })
        prev = cur
        cur = outs.splice(best, 1)[0]!
      }
      // drop corners on a straight line
      const n = loop.length
      loops.push(loop.filter((p, i) => {
        const a = loop[(i + n - 1) % n]!, b = loop[(i + 1) % n]!
        return (p[0] - a[0]) * (b[1] - p[1]) !== (p[1] - a[1]) * (b[0] - p[0])
      }))
    }
  }
  return loops.filter(l => l.length >= 3)
}

const f2 = (n: number) => String(Math.round(n * 100) / 100)

/** Loops as one SVG path, every corner rounded by up to `r` pixels. */
export function roundedPath(loops: Pt[][], r: number): string {
  let d = ''
  for (const loop of loops) {
    const n = loop.length
    const cut = (from: Pt, to: Pt): Pt => {
      const len = Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1])
      const t = Math.min(r, len / 2) / len
      return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]
    }
    for (let i = 0; i < n; i++) {
      const p = loop[i]!, a = loop[(i + n - 1) % n]!, b = loop[(i + 1) % n]!
      const s = cut(p, a), e = cut(p, b)
      d += `${i === 0 ? 'M' : 'L'}${f2(s[0])} ${f2(s[1])}Q${f2(p[0])} ${f2(p[1])} ${f2(e[0])} ${f2(e[1])}`
    }
    d += 'Z'
  }
  return d
}

const hexOf = (c: number) => `#${c.toString(16).padStart(6, '0')}`
const outlineOf = (c: number) => (lum(c) < 0.22 ? mixC(c, 0xffffff, 0.45) : mixC(c, 0x000000, 0.55))

export type VectorPetOpts = {
  kind: PetKind
  stage: Stage
  pose: Pose
  mood: Mood
  items?: string[]
  skin?: SkinId | null
  tick?: number
  /** Facing right mirrors the sprite. */
  dir?: 1 | -1
  /** Blinks now and then; off for still pictures. */
  isBlinking?: boolean
}

/**
 * One pet as an SVG group in its own pixel units, its feet on y = HD_H (the
 * caller scales and places it). Silhouette and outline, patches, items, then eyes
 * with a glint, lids or cross brows, and a blush when it is happy.
 */
export function vectorPet(o: VectorPetOpts): { svg: string; w: number; h: number } {
  const art = HD[o.kind]
  const rows = hdSprite(o.kind, o.stage, o.pose, o.mood)
  const colors = skinColors(art.colors, o.skin)
  const sw = Math.max(...rows.map(r => r.length)), sh = rows.length
  const top = HD_H - sh
  const at = (x: number, y: number) => rows[y]?.[x] ?? '.'
  const lit = (x: number, y: number) => at(x, y) !== '.'
  const base = colors[art.fill] ?? 0x888888
  const parts: string[] = []
  const t = o.tick ?? 0
  // a mythic pet's wings go behind it
  if (o.stage === 'mythic') {
    const up = t % 12 < 6
    const wx = Math.round(sw * 0.62)
    let wy = 0
    while (wy < sh - 1 && !lit(wx, wy)) wy++
    wy += top + 0.4
    const lift = up ? 2.8 : 1.8
    parts.push(`<path d="M${f2(wx - 1)} ${f2(wy)}C${f2(wx - 1)} ${f2(wy - lift)} ${f2(wx + 2.5)} ${f2(wy - lift - 0.6)} ${f2(wx + 3.2)} ${f2(wy - lift + 0.2)}C${f2(wx + 2.2)} ${f2(wy - 0.6)} ${f2(wx + 1)} ${f2(wy + 0.2)} ${f2(wx - 1)} ${f2(wy)}Z" fill="#f5f7ff" stroke="#9fa9d6" stroke-width="0.3"/>`)
  }
  const back = itemPixels(rows, (o.items ?? []).filter(id => ITEM_ART[id]?.at === 'back'))
  const front = itemPixels(rows, (o.items ?? []).filter(id => ITEM_ART[id]?.at !== 'back'))
  const itemShapes = (px: [number, number, number][]) => {
    const byColor = new Map<number, Set<string>>()
    for (const [x, y, c] of px) {
      const s = byColor.get(c) ?? new Set<string>()
      s.add(`${x},${y}`)
      byColor.set(c, s)
    }
    let out = ''
    for (const [c, cells] of byColor) {
      // items reach past the sprite (a crown above it): trace them on a grid with room round it
      const loops = traceLoops((x, y) => cells.has(`${x - 6},${y - 6}`), sw + 12, sh + 12).map(l => l.map(([x, y]) => [x - 6, y - 6 + top] as Pt))
      out += `<path d="${roundedPath(loops, 0.45)}" fill="${hexOf(c)}" stroke="${hexOf(outlineOf(c))}" stroke-width="0.3" stroke-linejoin="round" paint-order="stroke"/>`
    }
    return out
  }
  if (back.length) parts.push(itemShapes(back))
  // the body: one rounded silhouette with an outline, then the patches of colour on it
  const shift = (loops: Pt[][]) => loops.map(l => l.map(([x, y]) => [x, y + top] as Pt))
  parts.push(`<path d="${roundedPath(shift(traceLoops(lit, sw, sh)), 0.9)}" fill="${hexOf(base)}" stroke="${hexOf(outlineOf(base))}" stroke-width="0.5" stroke-linejoin="round" paint-order="stroke"/>`)
  const letters = new Set(rows.join('').replace(/[.eEz]/g, '').replace(new RegExp(art.fill, 'g'), ''))
  for (const ch of letters) {
    const c = colors[ch]
    if (c === undefined) continue
    parts.push(`<path d="${roundedPath(shift(traceLoops((x, y) => at(x, y) === ch, sw, sh)), 0.6)}" fill="${hexOf(c)}"/>`)
  }
  if (front.length) parts.push(itemShapes(front))
  // eyes
  const eyeColor = colors.e ?? 0x1a1a1a
  const isBlink = o.isBlinking !== false && t % 47 < 2
  let first = true
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const ch = r[x]!
      if (!'eEz'.includes(ch)) continue
      const cx = x + 0.5, cy = top + y + 0.5
      // the skin under the eye, so a lid matches it
      const lid = colors[at(x + 1, y)] ?? colors[at(x - 1, y)] ?? base
      if (ch === 'z' || isBlink) {
        parts.push(`<path d="M${f2(cx - 0.42)} ${f2(cy - 0.05)}Q${f2(cx)} ${f2(cy + 0.42)} ${f2(cx + 0.42)} ${f2(cy - 0.05)}" fill="none" stroke="${hexOf(outlineOf(lid))}" stroke-width="0.2" stroke-linecap="round"/>`)
      } else {
        parts.push(`<circle cx="${f2(cx)}" cy="${f2(cy)}" r="0.5" fill="${hexOf(ch === 'E' ? 0x3a0a0a : eyeColor)}"/>`)
        parts.push(`<circle cx="${f2(cx - 0.16)}" cy="${f2(cy - 0.18)}" r="0.17" fill="#ffffff"/>`)
        if (ch === 'E') parts.push(`<path d="M${f2(cx - 0.6)} ${f2(cy - 0.95)}L${f2(cx + 0.55)} ${f2(cy - 0.45)}" stroke="#ff3b3b" stroke-width="0.24" stroke-linecap="round"/>`)
      }
      if (first && ch === 'e' && o.mood === 'happy' && o.pose !== 'sleep') {
        parts.push(`<ellipse cx="${f2(cx - 0.1)}" cy="${f2(cy + 0.95)}" rx="0.42" ry="0.22" fill="#ff7fa8" opacity="0.45"/>`)
      }
      first = false
    }
  })
  // legends twinkle
  if (o.stage === 'legend' || o.stage === 'mythic') {
    const sx = t % 20 < 10 ? -0.8 : sw + 0.2, sy = top + (t % 20 < 10 ? 0.4 : 1.4), s = 0.7
    parts.push(`<path d="M${f2(sx)} ${f2(sy - s)}L${f2(sx + 0.2)} ${f2(sy - 0.2)}L${f2(sx + s)} ${f2(sy)}L${f2(sx + 0.2)} ${f2(sy + 0.2)}L${f2(sx)} ${f2(sy + s)}L${f2(sx - 0.2)} ${f2(sy + 0.2)}L${f2(sx - s)} ${f2(sy)}L${f2(sx - 0.2)} ${f2(sy - 0.2)}Z" fill="#fff6a0"/>`)
  }
  if (o.skin === 'galaxy') {
    for (let i = 0; i < 4; i++) {
      const x = 1 + ((i * 5 + Math.floor(t / 8)) % Math.max(2, sw - 2)), y = top + 1 + ((i * 3) % Math.max(1, sh - 2))
      if (lit(x, y - top) && !'eEz'.includes(at(x, y - top))) parts.push(`<circle cx="${x + 0.5}" cy="${f2(y + 0.5)}" r="0.13" fill="#ffffff" opacity="0.85"/>`)
    }
  }
  const body = parts.join('')
  const svg = o.dir === 1 ? `<g transform="translate(${sw} 0) scale(-1 1)">${body}</g>` : `<g>${body}</g>`
  return { svg, w: sw, h: HD_H }
}
