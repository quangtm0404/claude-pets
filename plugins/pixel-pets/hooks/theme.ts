// Themes, your own colours and the banner's fonts (E5-S03/S04).
import type { FontName, StoryStatus, ThemeName } from '../types'

// ── Themes ──────────────────────────────────────────────────────────────────
// bg/fg the screen, dim/hi the secondary and emphasised text, then the semantic
// colours every status maps onto.
export type Palette = {
  bg: string; fg: string; dim: string; hi: string
  pass: string; fail: string; warn: string; info: string
  stripes: string[]
  banner: string
}

const THEMES: Record<ThemeName, Palette> = {
  // Ice cyan on deep navy, an 80s terminal: the default.
  ice: {
    bg: '#06131F', fg: '#5FE1FF', dim: '#2E7A99', hi: '#D8F7FF',
    pass: '#7CF29A', fail: '#FF6B6B', warn: '#FFD166', info: '#B39DFF',
    stripes: ['#0B2A3D', '#12506E', '#1E86A8', '#5FE1FF', '#D8F7FF'],
    banner: '**** CLAUDE PETS ****',
  },
  // Green-phosphor CRT (IBM 5151 / Apple II monitor).
  phosphor: {
    bg: '#0B140D', fg: '#33FF66', dim: '#1E8C3E', hi: '#C8FFD4',
    pass: '#8CFF5A', fail: '#FF5F56', warn: '#FFD23F', info: '#5FD7FF',
    stripes: ['#0F3D1C', '#18692F', '#22A043', '#33FF66', '#C8FFD4'],
    banner: '**** CLAUDE PETS · PHOSPHOR ****',
  },
  // Amber monochrome terminal (DEC VT220 / IBM 3270 amber).
  amber: {
    bg: '#120C02', fg: '#FFB000', dim: '#9A6A00', hi: '#FFE2A8',
    pass: '#9BE564', fail: '#FF5A4E', warn: '#FFFFFF', info: '#7FD8F0',
    stripes: ['#4A3000', '#7A5000', '#B87900', '#FFB000', '#FFE2A8'],
    banner: '**** CLAUDE PETS · AMBER ****',
  },
  // The original Commodore 64 blue (Pepto palette).
  c64: {
    bg: '#40318D', fg: '#7869C4', dim: '#5A4DA8', hi: '#FFFFFF',
    pass: '#94E089', fail: '#B86962', warn: '#BFCE72', info: '#67B6BD',
    stripes: ['#883932', '#8B5429', '#BFCE72', '#55A049', '#67B6BD'],
    banner: '**** CLAUDE PETS · C64 ****',
  },
  // Mint on charcoal, softer than phosphor.
  mint: {
    bg: '#0E1715', fg: '#7FFFD4', dim: '#3C8C78', hi: '#E0FFF6',
    pass: '#A6F28C', fail: '#FF7A7A', warn: '#FFD97A', info: '#8CC8FF',
    stripes: ['#143A31', '#1F6655', '#33A387', '#7FFFD4', '#E0FFF6'],
    banner: '**** CLAUDE PETS · MINT ****',
  },
  // Rose on deep wine.
  rose: {
    bg: '#1A0D12', fg: '#FF8FB1', dim: '#A34D6B', hi: '#FFE0EA',
    pass: '#9BE58C', fail: '#FF5A5A', warn: '#FFD166', info: '#7FD0FF',
    stripes: ['#3D1724', '#6E2840', '#B8496E', '#FF8FB1', '#FFE0EA'],
    banner: '**** CLAUDE PETS · ROSE ****',
  },
  // Plain white on black, no tint.
  mono: {
    bg: '#000000', fg: '#E6E6E6', dim: '#7A7A7A', hi: '#FFFFFF',
    pass: '#8FE388', fail: '#FF6B6B', warn: '#FFD166', info: '#8CC8FF',
    stripes: ['#262626', '#4D4D4D', '#808080', '#B3B3B3', '#FFFFFF'],
    banner: '**** CLAUDE PETS · MONO ****',
  },
  // Dark ink on cream, for light terminals and editors.
  paper: {
    bg: '#F7F1E3', fg: '#1F3A5F', dim: '#8A8270', hi: '#0B1A2E',
    pass: '#2E7D32', fail: '#C62828', warn: '#B26A00', info: '#1565C0',
    stripes: ['#E3D9C0', '#C9B994', '#8A8270', '#1F3A5F', '#0B1A2E'],
    banner: '**** CLAUDE PETS · PAPER ****',
  },
}
export const THEME_NAMES = Object.keys(THEMES) as ThemeName[]
export const isThemeName = (x: unknown): x is ThemeName => typeof x === 'string' && Object.hasOwn(THEMES, x)

/** The settings' theme, used when a spec names none; set by configure. */
let fallbackTheme = 'ice'
export const setFallbackTheme = (spec: string) => {
  fallbackTheme = spec
}

// ── Your own colours (E5-S03) ────────────────────────────────────────────────
// A theme is a preset's name or one accent colour, optionally on a background of
// your own: `#FF8800` or `#FF8800 on #101010`. The rest of the palette is mixed
// from those two, so any pair stays readable.
const HEX_RE = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i
export function normHex(s: string): string | null {
  const m = HEX_RE.exec(s.trim())?.[1]
  if (!m) return null
  const six = m.length === 3 ? [...m].map(c => c + c).join('') : m
  return `#${six.toUpperCase()}`
}
const rgb = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)) as [number, number, number]
const toHex = (r: number[]) => `#${r.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`
/** `a` moved toward `b` by `t` (0..1). */
export const mix = (a: string, b: string, t: number) => {
  const x = rgb(a), y = rgb(b)
  return toHex(x.map((v, i) => v + ((y[i] ?? 0) - v) * t))
}
const luma = (c: string) => {
  const [r, g, b] = rgb(c)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/** A theme spec read leniently: a preset name, `#accent` or `#accent on #background`; null when neither. */
export function parseTheme(spec: string): string | null {
  const s = spec.trim().toLowerCase()
  if (isThemeName(s)) return s
  const m = /^(#?[0-9a-f]{3,6})(?:\s+(?:on\s+)?(#?[0-9a-f]{3,6}))?$/i.exec(s)
  if (!m) return null
  const accent = normHex(m[1] ?? '')
  const back = m[2] ? normHex(m[2]) : null
  if (!accent || (m[2] && !back)) return null
  return back ? `${accent} on ${back}` : accent
}

const paletteCache = new Map<string, Palette>()
/** The palette for a theme spec; none (or an unknown one) means the settings' theme. */
export function paletteOf(spec: string): Palette {
  const key = parseTheme(spec) ?? fallbackTheme
  if (isThemeName(key)) return THEMES[key]!
  const hit = paletteCache.get(key)
  if (hit) return hit
  const [a, b] = key.split(' on ')
  const fg = a ?? '#5FE1FF'
  const isLightAccent = luma(fg) > 0.5
  // no background given: a deep shade of the accent itself (or near-white for a dark accent)
  const bg = b ?? (isLightAccent ? mix(fg, '#000000', 0.9) : mix(fg, '#FFFFFF', 0.92))
  const isLight = luma(bg) > 0.5
  const ink = isLight ? '#000000' : '#FFFFFF'
  const p: Palette = {
    bg, fg,
    dim: mix(bg, fg, 0.55),
    hi: mix(fg, ink, 0.7),
    pass: isLight ? '#2E7D32' : '#7CF29A',
    fail: isLight ? '#C62828' : '#FF6B6B',
    warn: isLight ? '#B26A00' : '#FFD166',
    info: isLight ? '#1565C0' : '#8CC8FF',
    stripes: [mix(bg, fg, 0.2), mix(bg, fg, 0.45), mix(bg, fg, 0.7), fg, mix(fg, ink, 0.7)],
    banner: '**** CLAUDE PETS ****',
  }
  paletteCache.set(key, p)
  return p
}

// ── Banner fonts (E5-S04) ────────────────────────────────────────────────────
// A plugin can't change the terminal's own font (that is the terminal's setting),
// but the banner can be set in Unicode letter styles every font carries, or drawn
// as big pixel letters.
export const FONT_NAMES: FontName[] = ['plain', 'bold', 'mono', 'double', 'wide', 'pixel']
export const isFontName = (x: unknown): x is FontName => typeof x === 'string' && (FONT_NAMES as string[]).includes(x)
const STYLE_BASE: Record<'bold' | 'mono' | 'double', { upper: number; lower: number; digit: number }> = {
  bold: { upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec },
  mono: { upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6 },
  double: { upper: 0x1d538, lower: 0x1d552, digit: 0x1d7d8 },
}
// double-struck capitals that live in the Letterlike Symbols block instead
const DOUBLE_HOLES: Record<string, number> = { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 }

/** The text in a letter style; `pixel` is drawn, not typed, so its text is plain. */
export function styleText(text: string, font: FontName): string {
  if (font === 'plain' || font === 'pixel') return text
  return [...text].map(ch => {
    const c = ch.codePointAt(0) ?? 0
    if (font === 'wide') {
      if (ch === ' ') return '　'
      return c >= 0x21 && c <= 0x7e ? String.fromCodePoint(c - 0x21 + 0xff01) : ch
    }
    const base = STYLE_BASE[font]
    if (font === 'double' && DOUBLE_HOLES[ch]) return String.fromCodePoint(DOUBLE_HOLES[ch])
    if (c >= 0x41 && c <= 0x5a) return String.fromCodePoint(base.upper + c - 0x41)
    if (c >= 0x61 && c <= 0x7a) return String.fromCodePoint(base.lower + c - 0x61)
    if (c >= 0x30 && c <= 0x39) return String.fromCodePoint(base.digit + c - 0x30)
    return ch
  }).join('')
}
/** Terminal cells the styled text takes: fullwidth letters take two. */
export const cellsOf = (text: string) => [...text].reduce((n, ch) => n + ((ch.codePointAt(0) ?? 0) >= 0x3000 && (ch.codePointAt(0) ?? 0) <= 0xffef ? 2 : 1), 0)

// 3×5 pixel letters for the banner, '#' lit.
const PIXEL_FONT: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'],
  L: ['#..', '#..', '#..', '#..', '###'], P: ['##.', '#.#', '##.', '#..', '#..'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '.##'], ' ': ['...', '...', '...', '...', '...'],
}
export const PIXEL_TITLE = 'CLAUDE PETS'
/** The title as a pixel grid: one string per pixel row, '#' lit. */
export function pixelTitle(text = PIXEL_TITLE): string[] {
  const rows = ['', '', '', '', '']
  for (const ch of text.toUpperCase()) {
    const g = PIXEL_FONT[ch] ?? PIXEL_FONT[' ']!
    for (let y = 0; y < 5; y++) rows[y] += (g[y] ?? '...') + '.'
  }
  return rows.map(r => r.slice(0, -1))
}

export type Tone = Exclude<keyof Palette, 'stripes' | 'banner'>
export const ENV_TONE: Record<string, Tone> = { DEV: 'pass', TST: 'warn', UAT: 'info', PROD: 'fail' }
export const STATUS_TONE: Record<StoryStatus, Tone> = {
  LIVE: 'pass', DONE: 'pass', DARK: 'info', PARTIAL: 'warn', TODO: 'dim', BLOCKED: 'fail', PROPOSED: 'hi', UNKNOWN: 'dim',
}
