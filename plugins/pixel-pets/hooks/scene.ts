// The pet's scene: the animals, the frame drawn in pixels (terminal) and as SVG (desktop, VS Code).
import {
  ANGRY_EYE, ART, HD, HD_H, KID_W, SPRITE_W, babySprite, extrasFor, hdSprite, itemPixels, roundedPath, skinColors, sprite, traceLoops, vectorPet,
} from './art'
import type { ItemId, Mood, PetArt, Pose, SkinId, Stage } from './art'
import type { FestivalId } from './seasons'
import { pixelTitle } from './theme'
import type { WeatherKind } from './weather'
import type { PetKind } from '../types'

// ── Pet: an 8-bit mini game along the bottom of the band ─────────────────────
// Mini sprites, 7×4 pixels facing left; two pixels stack in one cell with ▀/▄,
// so the pet is two terminal rows tall. The ground row is the game's HUD:
//   ♥♥♥♡♡ LV3 XP 042 ◆7 · PIXEL WANDERS
// Hearts are the plan's headroom (the fuller of the 5-hour and weekly windows),
// coins drop for every tool call that succeeds, bugs crawl in on every error and
// the pet hunts them. XP is saved between sessions.
export const PET_ROWS = 3 // 2 rows of pixels (4 px) + the ground row, which carries the HUD
// The pet needs its strip and the READY. line; info rows fill whatever room is left.
export const PET_MIN_ROWS = PET_ROWS + 1
export const GRUMPY_AT = 70
export const FURIOUS_AT = 90

type PetDef = PetArt & {
  /** Sound files in sounds/: its everyday voice and its cross one. */
  voice: { happy: string; cross: string }
  ideas: string[]
  emoji: string
}

const PET_LIFE: Record<PetKind, Omit<PetDef, keyof PetArt>> = {
  cat: { voice: { happy: 'meow', cross: 'meow_grumpy' }, ideas: ['Pixel', 'Mochi', 'Byte', 'Sprite'], emoji: '🐈' },
  dog: { voice: { happy: 'woof', cross: 'woof_grumpy' }, ideas: ['Chip', 'Bitsy', 'Rex64', 'Turbo'], emoji: '🐕' },
  crab: { voice: { happy: 'click', cross: 'click_grumpy' }, ideas: ['Ferris', 'Pinchy', 'Clawde', 'Sidestep'], emoji: '🦀' },
  shark: { voice: { happy: 'chomp', cross: 'grumble_low' }, ideas: ['Finn', 'Chompy', 'Bruce', 'Jawsome'], emoji: '🦈' },
  turtle: { voice: { happy: 'hum', cross: 'grumble_low' }, ideas: ['Shelly', 'Tank', 'Crush', 'Sheldon'], emoji: '🐢' },
  mouse: { voice: { happy: 'squeak', cross: 'grumble_high' }, ideas: ['Cheddar', 'Nibbles', 'Clicky', 'Squeak'], emoji: '🐁' },
  fox: { voice: { happy: 'yip', cross: 'grumble_high' }, ideas: ['Rusty', 'Ember', 'Firefox', 'Todd'], emoji: '🦊' },
  orca: { voice: { happy: 'song', cross: 'grumble_low' }, ideas: ['Tux', 'Domino', 'Shamu', 'Oreo'], emoji: '🐋' },
  whale: { voice: { happy: 'song', cross: 'grumble_low' }, ideas: ['Moby', 'Bubbles', 'Blue', 'Humphrey'], emoji: '🐳' },
  dolphin: { voice: { happy: 'whistle', cross: 'grumble_high' }, ideas: ['Flipper', 'Echo', 'Splash', 'Clicker'], emoji: '🐬' },
  giraffe: { voice: { happy: 'hum', cross: 'grumble_low' }, ideas: ['Stretch', 'Patches', 'Highway', 'Geoffrey'], emoji: '🦒' },
  tiger: { voice: { happy: 'roar', cross: 'grumble_low' }, ideas: ['Stripes', 'Rajah', 'Hobbes', 'Tigger'], emoji: '🐅' },
  squirrel: { voice: { happy: 'chitter', cross: 'grumble_high' }, ideas: ['Nutmeg', 'Acorn', 'Hazel', 'Scrat'], emoji: '🐿' },
  penguin: { voice: { happy: 'honk', cross: 'grumble_high' }, ideas: ['Pingu', 'Waddles', 'Tux', 'Skipper'], emoji: '🐧' },
  dragon: { voice: { happy: 'roar', cross: 'grumble_low' }, ideas: ['Ember', 'Smaug', 'Puff', 'Spark'], emoji: '🐉' },
  unicorn: { voice: { happy: 'whistle', cross: 'grumble_high' }, ideas: ['Sparkle', 'Stardust', 'Twilight', 'Glimmer'], emoji: '🦄' },
  axolotl: { voice: { happy: 'squeak', cross: 'grumble_high' }, ideas: ['Axel', 'Bubblegum', 'Gilly', 'Lotl'], emoji: '🦎' },
}
export const PETS = Object.fromEntries(
  (Object.keys(ART) as PetKind[]).map(k => [k, { ...ART[k], ...PET_LIFE[k] }]),
) as Record<PetKind, PetDef>
export const PET_KINDS = Object.keys(PETS) as PetKind[]
export const isPetKind = (x: unknown): x is PetKind => typeof x === 'string' && (PETS as Record<string, unknown>)[x] !== undefined

function b64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
export const hex = (c: string) => parseInt(c.slice(1), 16)

export type HudSegment = { text: string; color: number }

export type Sky = { kind: WeatherKind; isDay: boolean; windy: boolean; dir: 1 | -1 }

/** A stable pseudo-random number per column, so drops and stars stay put between frames. */
const hash = (n: number) => {
  let x = (n * 2654435761) >>> 0
  x ^= x >>> 15
  return x % 997
}

export type PetFrame = {
  /** The weather behind the pet; drawn first, so nothing of it covers the pet. */
  sky?: Sky | null
  tick?: number
  kind: PetKind
  columns: number
  x: number
  dir: 1 | -1
  pose: Pose
  mood: Mood
  lift: number
  bubble: { glyph: string; color: number } | null
  ballX: number | null
  coins: number[]
  bugs: { x: number }[]
  sparkle: boolean
  bg: string
  ground: string
  /** The C64 cursor, blinking in the top-left cell on the line after READY. */
  cursor: { color: number } | null
  hud: HudSegment[]
  /** Helper pets: one per running subagent; `tag` is drawn above it. */
  kids?: { x: number; dir: 1 | -1; pose: Pose; tag: string; tagColor: number }[]
  /** Its stage (E6-S03); absent means adult. */
  stage?: Stage
  /** What it wears (E6-S02). */
  items?: ItemId[]
  /** A rocket flame under it (E6-S04). */
  flame?: boolean
  /** A friend's pet on a visit (E7-S02). */
  guest?: { kind: PetKind; x: number; dir: 1 | -1; pose: Pose; stage: Stage; items: ItemId[] }
  /** The new look's bigger sprites, 8 pixels tall (E10); absent, the classic 4. */
  hd?: boolean
  /** A colouring from a blind box (E9). */
  skin?: SkinId | null
  /** A blind box being opened beside the pet (E9). */
  box?: { x: number; isOpen: boolean; shake: number } | null
  /** Draw only the scene, no pets (the SVG draws them as shapes). */
  sceneOnly?: boolean
  /** A festival's decorations behind the pet (E8-S03). */
  festival?: FestivalId | null
}

/** How many terminal rows the strip takes: the pixels, two to a row, and the ground. */
export const stripRows = (hd: boolean) => (hd ? HD_H : 4) / 2 + 1
/** The new look's sprites need this many band rows before `auto` picks them. */
export const HD_MIN_ROWS = 10
/** `auto`: the new look's bigger sprites when the band has room; `big` and `small` choose (E10). */
const BOX_BROWN = 0x8d5a2b, BOX_GOLD = 0xffd23f, BOX_RED = 0xe53935

export const COIN = 0xffd23f, COIN_SHINE = 0xfff6a0, BUG = 0xb04cff, BUG_LEGS = 0x6a1fb0

/** One frame's pixels, W × H (H = 4), row-major; null where the sky shows through. */
export function petPixels(f: PetFrame): { px: (number | null)[]; W: number; H: number; x0: number; pw: number } {
  const W = f.columns, H = f.hd ? HD_H : 4
  const px: (number | null)[] = new Array<number | null>(W * H).fill(null)
  const set = (X: number, Y: number, c: number) => {
    if (X >= 0 && X < W && Y >= 0 && Y < H) px[Y * W + X] = c
  }
  if (f.sky) {
    const t = f.tick ?? 0, sky = f.sky
    if (sky.kind === 'clear') {
      if (sky.isDay) {
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) set(W - 6 + dx, dy, 0xffd23f)
      } else {
        for (const [dx, dy] of [[0, 0], [1, 0], [1, 1]] as const) set(W - 6 + dx, dy, 0xf3f0d0)
        for (let x = 1; x < W - 8; x++) if (hash(x) % 11 === 0 && (hash(x + t / 16) | 0) % 3) set(x, hash(x * 7) % 2, 0x8f9bd6)
      }
    }
    if (sky.kind !== 'clear' && sky.kind !== 'fog') {
      const grey = sky.kind === 'storm' ? 0x5c6672 : sky.kind === 'cloudy' ? 0xb8c2cc : 0x8996a3
      const drift = (sky.windy ? 0.5 : 0.12) * sky.dir
      for (let c = 0; c < 3; c++) {
        const span = W + 8
        const cx = Math.round((((c * span) / 3 + t * drift) % span + span) % span) - 6
        for (const [dx, dy] of [[1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1]] as const) set(cx + dx, dy, grey)
      }
    }
    if (sky.kind === 'rain' || sky.kind === 'storm' || sky.kind === 'snow') {
      const isSnow = sky.kind === 'snow'
      for (let x = 0; x < W; x++) {
        if (hash(x) % (isSnow ? 7 : 4) !== 0) continue
        const y = 2 + ((Math.floor(t / (isSnow ? 3 : 1)) + hash(x + 5)) % (H - 2))
        set(x + (sky.windy ? sky.dir * (y - 2) : 0), y, isSnow ? 0xf0f6ff : 0x5fa8ff)
      }
    }
    if (sky.kind === 'storm' && t % 40 < 2) {
      const bx = 6 + (hash(Math.floor(t / 40)) % Math.max(1, W - 12))
      for (const [dx, dy] of [[0, 0], [1, 1], [0, 2], [1, 3]] as const) set(bx + dx, dy, 0xfff36b)
    }
    if (sky.kind === 'fog') {
      for (let x = 0; x < W; x++) if ((x + Math.floor(t / 6)) % 3 === 0) set(x, 1 + (x % 2), 0x6f7a85)
    }
  }
  if (f.festival) drawFestival(set, f.festival, W, H, f.tick ?? 0)
  for (const cx of f.coins) {
    set(Math.round(cx), H - 2, f.sparkle ? COIN_SHINE : COIN)
    set(Math.round(cx), H - 1, COIN)
  }
  for (const b of f.bugs) {
    const bx = Math.round(b.x)
    set(bx, H - 2, BUG)
    set(bx + 1, H - 2, BUG)
    set(f.sparkle ? bx : bx + 1, H - 1, BUG_LEGS)
  }
  if (f.ballX !== null) {
    set(Math.round(f.ballX), H - 1, COIN)
    set(Math.round(f.ballX) + 1, H - 1, COIN)
  }
  if (f.box) {
    // a gift box: shaking, then its lid up and a sparkle (E9)
    const bx = Math.round(f.box.x) + (f.box.shake % 2), w = f.hd ? 5 : 4, h = f.hd ? 4 : 3
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(bx + x, H - h + y, x === Math.floor(w / 2) || y === 0 ? BOX_GOLD : BOX_BROWN)
    if (f.box.isOpen) {
      for (let x = -1; x <= w; x++) set(bx + x, H - h - 2, BOX_RED)
      set(bx + Math.floor(w / 2), H - h - 3, f.sparkle ? COIN_SHINE : BOX_GOLD)
    }
  }
  if (f.sceneOnly) return { px, W, H, x0: Math.round(f.x), pw: 0 }
  const colors: Record<string, number> = { E: ANGRY_EYE, ...PETS[f.kind].colors }
  for (const k of f.kids ?? []) {
    babySprite(f.kind, k.pose).forEach((row, ry) => {
      for (let rx = 0; rx < KID_W; rx++) {
        const c = colors[row[k.dir === 1 ? KID_W - 1 - rx : rx] ?? '.']
        if (c !== undefined) set(Math.round(k.x) + rx, H - 3 + ry, c)
      }
    })
  }
  /** One pet standing on the ground at x, `lift` pixels up: its sprite, what it wears, and a rocket flame when asked. */
  let pw = SPRITE_W
  const drawPet = (kind: PetKind, stage: Stage, pose: Pose, mood: Mood, items: ItemId[], x: number, dir: 1 | -1, lift: number, flame: boolean, skin: SkinId | null) => {
    let rows: string[], palette: Record<string, number>, extras: [number, number, number][]
    if (f.hd) {
      rows = hdSprite(kind, stage, pose, mood)
      const cs = skinColors(HD[kind].colors, skin)
      palette = { ...cs, E: ANGRY_EYE, z: cs[HD[kind].fill] ?? 0x888888 }
      extras = itemPixels(rows, items)
      // a hat on a pet as tall as the strip would be cut off: it sits a pixel lower, over the ear tips
      const over = H - rows.length - lift + Math.min(0, ...extras.map(e => e[1]))
      if (over < 0) extras = extras.map(([x, y, c]) => [x, y + 1, c])
      const sw = Math.max(...rows.map(r => r.length)), t = f.tick ?? 0
      if (stage === 'legend' || stage === 'mythic') extras.push(t % 10 < 5 ? [-1, 0, 0xfff6a0] : [sw, 1, 0xfff6a0])
      if (stage === 'mythic') {
        const up = t % 6 < 3 ? 0 : 1, wx = Math.round(sw * 0.62)
        extras.push([wx, up - 1, 0xf5f5ff], [wx + 1, up - 1, 0xf5f5ff], [wx + 2, up, 0xdde4ff])
      }
    } else {
      rows = stage === 'baby' ? babySprite(kind, pose, mood) : sprite(kind, pose, mood)
      palette = { E: ANGRY_EYE, ...skinColors(PETS[kind].colors, skin) }
      extras = extrasFor(kind, stage, items, f.tick ?? 0)
    }
    const sw = Math.max(...rows.map(r => r.length)), top = H - rows.length - lift
    // the sprite is drawn facing left; facing right mirrors it
    const at = (sx: number) => x + (dir === 1 ? sw - 1 - sx : sx)
    rows.forEach((row, sy) => {
      for (let sx = 0; sx < sw; sx++) {
        const c = palette[row[sx] ?? '.']
        if (c !== undefined) set(at(sx), top + sy, c)
      }
    })
    for (const [sx, sy, c] of extras) set(at(sx), top + sy, c)
    if (flame) {
      const mid = Math.floor(sw / 2), t = f.tick ?? 0
      set(at(mid), top + rows.length, t % 2 ? 0xff9800 : 0xffeb3b)
      set(at(mid + 1), top + rows.length, t % 2 ? 0xffeb3b : 0xff5722)
    }
    return sw
  }
  // a visiting friend's pet (E7-S02), behind the main pet
  if (f.guest) drawPet(f.guest.kind, f.guest.stage, f.guest.pose, 'happy', f.guest.items, Math.round(f.guest.x), f.guest.dir, 0, false, null)
  const x0 = Math.round(f.x)
  pw = drawPet(f.kind, f.stage ?? 'adult', f.pose, f.mood, f.items ?? [], x0, f.dir, f.lift, f.flame ?? false, f.skin ?? null)
  return { px, W, H, x0, pw }
}

const FIREWORK = [0xff5252, 0xffd23f, 0x69f0ae, 0x40c4ff, 0xe040fb]

/**
 * A festival's decorations (E8-S03), drawn behind the pet: red lanterns at Tết, the
 * full moon and mooncakes at Mid-Autumn, a tree in the snow at Christmas, fireworks at New Year.
 */
function drawFestival(set: (x: number, y: number, c: number) => void, id: FestivalId, W: number, H: number, t: number) {
  const tall = H > 4
  if (id === 'tet') {
    for (let i = 0, x = 5; x < W - 4; i++, x += 17) {
      const sway = ((t >> 3) + i) % 4 === 0 ? 1 : 0
      set(x + sway, 0, 0xffc107)
      for (let y = 1; y <= (tall ? 3 : 2); y++) for (let dx = 0; dx < 2; dx++) set(x + dx + sway, y, y === 2 && tall ? 0xffc107 : 0xe53935)
      if (tall) set(x + sway, 4, 0xffc107)
    }
  } else if (id === 'midautumn') {
    // a round full moon, and mooncakes spread along the ground
    const mx = W - 13, disc = tall ? ['.##.', '####', '####', '.##.'] : ['.##.', '####', '.##.']
    disc.forEach((r, dy) => [...r].forEach((ch, dx) => ch === '#' && set(mx + dx, dy, dy === 1 && dx === 1 ? 0xffe28a : 0xfff1b8)))
    for (let i = 0; i < 3; i++) {
      const cx = 6 + i * Math.max(4, Math.floor((W - 22) / 3))
      set(cx, H - 2, 0xe0a85a)
      set(cx + 1, H - 2, 0xe0a85a)
      set(cx, H - 1, 0xb87333)
      set(cx + 1, H - 1, 0xb87333)
    }
  } else if (id === 'valentine') {
    // hearts drifting up and down in the sky
    const heart = tall ? ['r.r', 'rrr', '.r.'] : ['r.r', '.r.']
    for (let i = 0, x = 7; x < W - 8; i++, x += 15) {
      const bob = ((t >> 3) + i) % 2
      heart.forEach((r, dy) => [...r].forEach((ch, dx) => ch === 'r' && set(x + dx, dy + bob, i % 2 ? 0xff4f81 : 0xe53935)))
    }
  } else if (id === 'halloween') {
    // pumpkins on the ground and a bat flapping across the sky
    const pumpkin = tall ? ['.g.', 'ooo', 'ooo'] : ['.g.', 'ooo']
    for (const px0 of [3, W - 12]) {
      pumpkin.forEach((r, dy) => [...r].forEach((ch, dx) => {
        if (ch === '.') return
        set(px0 + dx, H - pumpkin.length + dy, ch === 'g' ? 0x43a047 : dy === pumpkin.length - 1 && dx === 1 && (t >> 3) % 2 ? 0xffd23f : 0xfb8c00)
      }))
    }
    // the bat: wings up (a V) and down (a ^) in turn
    const bx = W - 1 - ((t >> 1) % W), up = (t >> 2) % 2 === 0
    set(bx, 1, 0x9575cd)
    set(bx - 1, up ? 0 : 2, 0x9575cd)
    set(bx + 1, up ? 0 : 2, 0x9575cd)
  } else if (id === 'custom') {
    // confetti falling through the sky
    for (let x = 0; x < W; x++) {
      if (hash(x + 29) % 5 !== 0) continue
      set(x, (Math.floor(t / 2) + hash(x + 5)) % (H - 1), FIREWORK[hash(x) % FIREWORK.length]!)
    }
  } else if (id === 'christmas') {
    for (let x = 0; x < W; x++) {
      if (hash(x + 11) % 6 !== 0) continue
      set(x, (Math.floor(t / 3) + hash(x + 3)) % (H - 1), 0xf0f6ff)
    }
    const tx = W - 16, levels = tall ? [1, 1, 3, 3, 5, 5, 7] : [1, 3, 5]
    set(tx, 0, 0xffd23f)
    levels.forEach((w, i) => {
      const y = i + 1
      if (y >= H - 1) return
      for (let dx = -(w >> 1); dx <= w >> 1; dx++) {
        const bauble = w > 1 && (hash(tx + dx * 7 + y * 13) % 5 === 0)
        set(tx + dx, y, bauble ? ((t >> 2) + dx + y) % 2 ? 0xff5252 : 0xffd23f : 0x2e7d32)
      }
    })
    set(tx, H - 1, 0x795548)
  } else {
    for (let i = 0; i < 2; i++) {
      const life = 28, phase = (t + i * 14) % life, cycle = Math.floor((t + i * 14) / life)
      const cx = 4 + (hash(cycle * 13 + i * 7) % Math.max(1, W - 8)), cy = tall ? 2 : 1
      const c = FIREWORK[(cycle + i) % FIREWORK.length]!
      if (phase < 6) {
        set(cx, H - 1 - Math.round(((H - 1 - cy) * phase) / 6), 0xfff6a0)
      } else if (phase < 22) {
        const r = Math.min(tall ? 3 : 2, 1 + Math.floor((phase - 6) / 4))
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) set(cx + dx * r, cy + Math.round(dy * r * 0.6), c)
      }
    }
  }
}

/** Packs one frame into Raster cells: [codePoint, fg, bg] u32 triplets, row-major. */
export function petCells(f: PetFrame): string {
  const { px, W, H, x0, pw } = petPixels(f)
  const ROWS = H / 2 + 1
  const bg = hex(f.bg), ground = hex(f.ground)
  const words = new Uint32Array(W * ROWS * 3)
  const put = (i: number, cp: number, fg: number, back: number) => {
    words[i * 3] = cp
    words[i * 3 + 1] = fg
    words[i * 3 + 2] = back
  }
  for (let r = 0; r < ROWS - 1; r++) {
    for (let x = 0; x < W; x++) {
      const top = px[r * 2 * W + x] ?? null, bot = px[(r * 2 + 1) * W + x] ?? null
      const i = r * W + x
      if (top === null && bot === null) put(i, 0x20, bg, bg)
      else if (bot === null) put(i, 0x2580, top ?? bg, bg)
      else if (top === null) put(i, 0x2584, bot, bg)
      else put(i, 0x2580, top, bot)
    }
  }
  // the ground: a brick-ish strip, the HUD written over it
  const groundAt = (ROWS - 1) * W
  for (let x = 0; x < W; x++) put(groundAt + x, x % 4 === 3 ? 0x2580 : 0x2594, ground, bg)
  let col = 2
  for (const seg of [{ text: ' ', color: ground }, ...f.hud, { text: ' ', color: ground }]) {
    for (const ch of seg.text) {
      if (col >= W) break
      const cp = ch.codePointAt(0) ?? 0x20
      put(groundAt + col, cp > 0xffff ? 0x3f : cp, seg.color, bg)
      col++
    }
  }
  if (f.cursor && px[0] === null && px[W] === null) put(0, 0x2588, f.cursor.color, bg)
  for (const k of f.kids ?? []) {
    const tx = Math.min(W - 1, Math.max(0, Math.round(k.x) + 2)), ty = (H - 4) / 2
    if (px[ty * 2 * W + tx] === null && px[(ty * 2 + 1) * W + tx] === null) put(ty * W + tx, k.tag.codePointAt(0) ?? 0x3f, k.tagColor, bg)
  }
  if (f.bubble) {
    const bx = Math.min(W - 1, Math.max(0, x0 + (f.dir === 1 ? pw : -1)))
    put(bx, f.bubble.glyph.codePointAt(0) ?? 0x21, f.bubble.color, bg)
  }
  return b64(new Uint8Array(words.buffer))
}

// ── The pet as SVG (E5-S01/S02) ──────────────────────────────────────────────
// The desktop app, VS Code and phones have no pixel grid (Raster), but they draw
// SVG: the same frame, a square per pixel, with the HUD as text on the ground.
export const SVG_PX = 6
export const SVG_EVERY = 4
const SVG_HUD_H = 18
export const SVG_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
export const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Lit pixels of one scene as soft shapes, one path per colour. */
function softRegions(px: (number | null)[], W: number, H: number): string {
  const byColor = new Set<number>()
  for (const c of px) if (c !== null) byColor.add(c)
  let out = ''
  for (const c of byColor) out += `<path d="${roundedPath(traceLoops((x, y) => x >= 0 && y >= 0 && x < W && y < H && px[y * W + x] === c, W, H), 0.5)}" fill="${css(c)}"/>`
  return out
}

/**
 * One frame as an SVG document in the new look (E10): the sky, coins, bugs and
 * any gift box as soft shapes, the pets as outlined cartoons, the HUD on the ground.
 */
export function petSvg(f: PetFrame): string {
  const { px, W, H } = petPixels({ ...f, hd: true, sceneOnly: true })
  // room above the sky for hats, crowns and wings
  const HEAD = 4
  const P = SVG_PX, w = W * P, top = (H + HEAD) * P, h = top + SVG_HUD_H
  const ground = f.ground
  const tick = f.tick ?? 0
  const place = (svg: string, x: number, lift: number, scale = 1) =>
    `<g transform="translate(${x * P} ${top - HD_H * P * scale - lift * P}) scale(${P * scale})">${svg}</g>`
  const pets: string[] = []
  for (const k of f.kids ?? []) {
    pets.push(place(vectorPet({ kind: f.kind, stage: 'baby', pose: k.pose, mood: 'happy', dir: k.dir, tick, isBlinking: false }).svg, Math.round(k.x), 0, 0.6))
  }
  const g = f.guest
  if (g) pets.push(place(vectorPet({ kind: g.kind, stage: g.stage, pose: g.pose, mood: 'happy', items: g.items, dir: g.dir, tick }).svg, Math.round(g.x), 0))
  const me = vectorPet({ kind: f.kind, stage: f.stage ?? 'adult', pose: f.pose, mood: f.mood, items: f.items ?? [], skin: f.skin ?? null, dir: f.dir, tick })
  const x0 = Math.round(f.x)
  if (f.flame) pets.push(`<ellipse cx="${(x0 + me.w / 2) * P}" cy="${top - 2}" rx="${P * 0.9}" ry="${P * 0.7}" fill="${tick % 2 ? '#ff9800' : '#ffeb3b'}"/>`)
  pets.push(place(me.svg, x0, f.lift))
  const hudText = f.hud.map(seg => `<tspan fill="${css(seg.color)}">${esc(seg.text)}</tspan>`).join('')
  const bubble = f.bubble
    ? `<text x="${Math.min(W - 1, Math.max(0, x0 + (f.dir === 1 ? me.w : -1))) * P}" y="${top - HD_H * P + P * 1.2}" font-size="${P * 1.8}" font-family="${SVG_FONT}" fill="${css(f.bubble.color)}">${esc(f.bubble.glyph)}</text>`
    : ''
  const tags = (f.kids ?? []).map(k => `<text x="${(Math.round(k.x) + 2) * P}" y="${top - HD_H * P * 0.6 - 2}" font-size="${P * 1.4}" font-family="${SVG_FONT}" fill="${css(k.tagColor)}">${esc(k.tag)}</text>`).join('')
  const cursor = f.cursor ? `<rect x="0" y="0" width="${P}" height="${P * 2}" fill="${css(f.cursor.color)}"/>` : ''
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<rect width="${w}" height="${h}" fill="${f.bg}"/>`,
    `<g transform="translate(0 ${HEAD * P}) scale(${P})">${softRegions(px, W, H)}</g>`,
    cursor, pets.join(''), tags, bubble,
    `<rect x="0" y="${top}" width="${w}" height="2" fill="${ground}"/>`,
    `<text x="${2 * P}" y="${top + 13}" font-size="12" font-family="${SVG_FONT}" xml:space="preserve">${hudText}</text>`,
    '</svg>',
  ].join('')
}

/** The pixel title as Raster cells (3 rows, half blocks), centred in `columns`. */
export function titleCells(columns: number, fg: string, bg: string): string {
  const rows = pixelTitle(), tw = rows[0]?.length ?? 0
  const left = Math.max(0, Math.floor((columns - tw) / 2))
  const on = hex(fg), back = hex(bg)
  const lit = (x: number, y: number) => y >= 1 && y <= 5 && rows[y - 1]?.[x - left] === '#'
  const words = new Uint32Array(columns * 3 * 3)
  for (let r = 0; r < 3; r++) {
    for (let x = 0; x < columns; x++) {
      const t = lit(x, r * 2), b = lit(x, r * 2 + 1), i = (r * columns + x) * 3
      words[i] = t && b ? 0x2588 : t ? 0x2580 : b ? 0x2584 : 0x20
      words[i + 1] = on
      words[i + 2] = back
    }
  }
  return b64(new Uint8Array(words.buffer))
}

/** The pixel title as SVG, for surfaces without a pixel grid. */
export function titleSvg(fg: string, bg: string, stripes: string[]): string {
  const rows = pixelTitle(), P = 4, tw = (rows[0]?.length ?? 0) * P, h = 7 * P
  const w = tw + 2 * P + stripes.length * 3 * P
  let out = ''
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) if (r[x] === '#') out += `<rect x="${P + x * P}" y="${P + y * P}" width="${P}" height="${P}" fill="${fg}"/>`
  })
  stripes.forEach((c, i) => {
    out += `<rect x="${tw + 2 * P + i * 3 * P}" y="${P}" width="${2 * P}" height="${5 * P}" fill="${c}"/>`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges"><rect width="${w}" height="${h}" fill="${bg}"/>${out}</svg>`
}

/** XP needed grows with the level: LV2 at 15, LV3 at 60, LV4 at 135… */
