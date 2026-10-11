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
}

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
type Slot = 'head' | 'face' | 'neck' | 'hand'
export const ITEMS: Record<ItemId, { name: string; price: number; slot: Slot; px: [number, number, number][] }> = {
  bow: { name: 'Pink bow', price: 15, slot: 'head', px: [[-2, -1, 0xff7eb6], [-3, -1, 0xff7eb6]] },
  scarf: { name: 'Red scarf', price: 25, slot: 'neck', px: [[-1, 1, 0xe53935], [-2, 1, 0xe53935], [-3, 2, 0xb71c1c]] },
  shades: { name: 'Sunglasses', price: 40, slot: 'face', px: [[0, 0, 0x33ccff], [-1, 0, 0x111111], [1, 0, 0x111111]] },
  hat: { name: 'Top hat', price: 60, slot: 'head', px: [[1, -1, 0x2b2b2b], [0, -1, 0x2b2b2b], [-1, -1, 0x2b2b2b], [0, -2, 0x2b2b2b]] },
  lantern: { name: 'Tết lantern', price: 88, slot: 'hand', px: [[1, 1, 0xe53935], [1, 2, 0xffc107]] },
  crown: { name: 'Crown', price: 200, slot: 'head', px: [[1, -1, 0xffd23f], [0, -1, 0xff3b3b], [-1, -1, 0xffd23f], [0, -2, 0xffd23f]] },
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
