import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { PluginOptions, RenderChildren, SessionUsage } from 'claude-code'
import type { RunnerProps } from './runner'
import {
  ANGRY_EYE, BABY_W, BOX_PETS, HD_W, ITEMS, ITEM_IDS, KID_W, SKINS, SKIN_IDS, SPRITE_W, babySprite, isItemId, isSkinId, nextStage, stageOf, vectorPet,
} from './art'
import type { ItemId, Mood, Pose, Rarity, SkinId } from './art'
import { FESTIVALS, birthdayAge, daysBetween, festivalOn, nextBirthday, parseMyFestival, upcomingFestivals } from './seasons'
import type { Festival, FestivalId, MyFestival } from './seasons'

export { ITEMS, babySprite, extrasFor, sprite, stageOf } from './art'
export type { ItemId, Mood, Stage } from './art'
export { birthdayAge, festivalOn, midAutumnOf, nextBirthday, parseMyFestival, tetOf, upcomingFestivals } from './seasons'

import type {
  Failure, FontName, GitInfo, LogLine, PetKind, Story, StoryStatus, StoryTask, TestRun, Usage, UsageWindow,
} from '../types'

import { THEME_NAMES, parseTheme, paletteOf, FONT_NAMES, isFontName, styleText, cellsOf, ENV_TONE, STATUS_TONE, isThemeName, setFallbackTheme } from './theme'
import type { Palette, Tone } from './theme'
export { THEME_NAMES, normHex, mix, parseTheme, paletteOf, FONT_NAMES, isFontName, styleText, cellsOf, PIXEL_TITLE, pixelTitle } from './theme'
import { WINDY_KMH, WEATHER_EVERY_MS, wmo, fmtTemp, fmtWind, weatherRow } from './weather'
import type { TempUnit, WeatherPlace, Weather } from './weather'
export { wmo, toF, fmtTemp, fmtWind } from './weather'
export type { WeatherKind, WeatherPlace, Weather } from './weather'
import {
  PET_ROWS, PET_MIN_ROWS, GRUMPY_AT, FURIOUS_AT, PETS, PET_KINDS, isPetKind, hex, stripRows, HD_MIN_ROWS, petCells, SVG_EVERY, SVG_FONT, css, esc, petSvg, titleCells, titleSvg, BUG,
} from './scene'
import type { HudSegment, PetFrame } from './scene'
import { ACHIEVEMENTS, COUNTER, dayOf, freshProfile, nextStreak, noteTestRun, workOf } from './profile'
import type { Profile, Work, XpReason } from './profile'
export { ACHIEVEMENTS, dayOf, nextStreak, noteTestRun } from './profile'
export type { Profile, Work, XpReason } from './profile'
export { PETS, PET_KINDS, isPetKind, stripRows, petPixels, petCells, SVG_PX, petSvg, titleCells, titleSvg } from './scene'
export type { HudSegment, Sky, PetFrame } from './scene'

// ── Backlog sources: markdown, not an issue tracker ───────────────────────────────────
// The band's rows by name. Drawn in the order the `bandRows` setting lists them;
// when space is short they are dropped in DROP_ORDER, first to go first (E1-S03).
export type BandRow = 'banner' | 'git' | 'usage' | 'weather' | 'story' | 'tests'
const DEFAULT_ROWS: BandRow[] = ['banner', 'git', 'usage', 'weather', 'story', 'tests']
const DROP_ORDER: BandRow[] = ['banner', 'git', 'tests', 'story', 'weather', 'usage']

/** The rows a `bandRows` value names, in its order; unknown names ignored, nothing valid means the default. */
async function geocode($: EngineInterface, query: string): Promise<WeatherPlace | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`
  const r = await $.http.fetch(url)
  if (!r.ok) return null
  const hit = (JSON.parse(r.text) as { results?: { name: string; country?: string; latitude: number; longitude: number }[] }).results?.[0]
  return hit ? { name: [hit.name, hit.country].filter(Boolean).join(', '), lat: hit.latitude, lon: hit.longitude } : null
}

/** Where this machine is, by its IP address: only when the person asks (/pet weather here). */
async function placeFromIp($: EngineInterface): Promise<WeatherPlace | null> {
  const r = await $.http.fetch('https://ipapi.co/json/')
  if (!r.ok) return null
  const d = JSON.parse(r.text) as { city?: string; country_name?: string; latitude?: number; longitude?: number }
  return typeof d.latitude === 'number' && typeof d.longitude === 'number'
    ? { name: [d.city, d.country_name].filter(Boolean).join(', ') || 'HERE', lat: d.latitude, lon: d.longitude }
    : null
}

async function readPlace($: EngineInterface): Promise<WeatherPlace | null> {
  const v = await $.store.get('weatherPlace')
  const p = v as Partial<WeatherPlace> | undefined
  return p && typeof p.lat === 'number' && typeof p.lon === 'number' && typeof p.name === 'string' ? (p as WeatherPlace) : null
}

/** Current conditions for the stored place; a failed fetch keeps the last reading. */
async function refreshWeather($: EngineInterface) {
  const place = await readPlace($)
  if (!place) {
    if ((await read($, weather)) !== null) await update($, weather, () => null)
    petSim.wx = null
    return
  }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}`
      + '&current=temperature_2m,weather_code,wind_speed_10m,is_day&wind_speed_unit=kmh&timezone=auto'
    const r = await $.http.fetch(url)
    if (!r.ok) return
    const cur = (JSON.parse(r.text) as { current?: { temperature_2m: number; weather_code: number; wind_speed_10m: number; is_day: number } }).current
    if (!cur) return
    const w = wmo(cur.weather_code)
    const next: Weather = {
      place: place.name, tempC: cur.temperature_2m, code: cur.weather_code, kind: w.kind, label: w.label,
      windKmh: cur.wind_speed_10m, isDay: cur.is_day === 1,
    }
    await update($, weather, () => next)
    petSim.wx = next
  } catch {
    // offline or refused: keep what we had
  }
}

export function parseRows(value: string): BandRow[] {
  const rows = value.split(',').map(r => r.trim().toLowerCase())
    .filter((r): r is BandRow => (DEFAULT_ROWS as string[]).includes(r))
  return rows.length ? [...new Set(rows)] : [...DEFAULT_ROWS]
}

/** Which of the present rows fit in `room`, keeping the most important (E1-S03). */
export function keepRows(present: BandRow[], room: number): Set<BandRow> {
  const keep = new Set(present)
  for (const r of DROP_ORDER) {
    if (keep.size <= Math.max(0, room)) break
    keep.delete(r)
  }
  return keep
}

// The plugin's settings (`userConfig` in plugin.json, changed from /config).
const DEFAULT_ID = /\b([A-Z]\d{1,3}-[A-Z]?\d{1,3})\b/i
const CFG = {
  /** Markdown files a story id is looked up in, first hit wins; relative to the session's directory or absolute. */
  backlogFiles: ['docs/backlog/BACKLOG.md', 'BACKLOG.md', 'docs/milestones.md'] as string[],
  /** A backlog id, one capture group: E12-S03, M1-14 by default. */
  storyId: DEFAULT_ID,
  /** What /defect starts the draft with: a slash command such as /report-defect, or plain words. */
  defectCommand: '',
  petName: 'Pixel',
  petKind: 'cat' as PetKind,
  /** The band's rows, in the order they are drawn (E1-S01). */
  bandRows: [...DEFAULT_ROWS] as BandRow[],
  temperatureUnit: 'both' as TempUnit,
  /** A place to look up at startup when none is stored yet (E2-S01). */
  weatherPlace: '',
  /** The name on the pet board (E3-S01); empty means git's user.name, else the OS user. */
  playerName: '',
  /** The shared leaderboard (E4): its Worker URL and GitHub OAuth app; empty means no shared board. */
  leaderboardUrl: '',
  githubClientId: '',
  /** The theme until /retro theme picks one (E5-S03): a preset, `#accent` or `#accent on #background`. */
  theme: 'ice',
  /** The banner's letters until /retro font picks (E5-S04). */
  font: 'plain' as FontName,
  /** Minutes of work before the pet suggests a break, 0 for never, until /pet breaks sets it (E8-S02). */
  breaks: 60,
  /** Festivals in the band, until /pet festivals sets it (E8-S03). */
  festivals: true,
}

export function configure(options: PluginOptions) {
  const str = (k: string) => (typeof options[k] === 'string' ? (options[k] as string).trim() : '')
  const files = str('backlogFiles').split(',').map(f => f.trim()).filter(Boolean)
  if (files.length) CFG.backlogFiles = files
  const pattern = str('storyIdPattern')
  if (pattern) {
    try {
      CFG.storyId = new RegExp(pattern, 'i')
    } catch {
      CFG.storyId = DEFAULT_ID
    }
  }
  CFG.defectCommand = str('defectCommand')
  if (str('petName')) CFG.petName = str('petName').slice(0, 16)
  CFG.bandRows = parseRows(str('bandRows'))
  const unit = str('temperatureUnit').toLowerCase()
  CFG.temperatureUnit = unit === 'c' || unit === 'f' ? unit : 'both'
  CFG.weatherPlace = str('weatherPlace')
  CFG.playerName = str('playerName').slice(0, 32)
  CFG.leaderboardUrl = str('leaderboardUrl').replace(/\/+$/, '')
  CFG.githubClientId = str('githubClientId')
  const kind = str('petKind')
  if (isPetKind(kind) && !BOX_PETS.includes(kind)) CFG.petKind = kind
  CFG.theme = parseTheme(str('theme')) ?? 'ice'
  setFallbackTheme(CFG.theme)
  const f = str('font').toLowerCase()
  CFG.font = isFontName(f) ? f : 'plain'
  CFG.breaks = parseBreaks(str('breaks')) ?? 60
  CFG.festivals = !/^(off|no|false|0)$/i.test(str('festivals'))
}

/** `60`, `45 min`, `off`: minutes of work before a break reminder, 0 for never; null when it isn't one. */
export function parseBreaks(v: string): number | null {
  const a = v.trim().toLowerCase()
  if (!a || a === 'on') return a ? 60 : null
  if (/^(off|no|never|false|0)$/.test(a)) return 0
  const m = /^(\d{1,3})\s*(m|min|mins|minutes)?$/.exec(a)
  const n = m ? Number(m[1]) : NaN
  return n >= 15 && n <= 240 ? n : null
}

const PANE = 'qa-monitor'
/** The pet's own pane, for surfaces that draw no band (VS Code, phones) (E5-S02). */
const PET_PANE = 'pet'

const ticket = atom({ plugin: 'pixel-pets', key: 'ticket' } as const, null)
const env = atom({ plugin: 'pixel-pets', key: 'env' } as const, null)
const tokens = atom({ plugin: 'pixel-pets', key: 'tokens' } as const, 0)
const turns = atom({ plugin: 'pixel-pets', key: 'turns' } as const, 0)
const tests = atom({ plugin: 'pixel-pets', key: 'tests' } as const, null)
const log = atom({ plugin: 'pixel-pets', key: 'log' } as const, [])
const isBandHidden = atom({ plugin: 'pixel-pets', key: 'isBandHidden' } as const, false)
const blink = atom({ plugin: 'pixel-pets', key: 'blink' } as const, true)
const theme = atom({ plugin: 'pixel-pets', key: 'theme' } as const, '')
const font = atom({ plugin: 'pixel-pets', key: 'font' } as const, 'plain')
/** The pet drawn as SVG for the desktop app, VS Code and phones, redrawn as it moves (E5-S01). */
const petArt = atom({ plugin: 'pixel-pets', key: 'petArt' } as const, '')
/** The runner game is offered in the band (E6-S01). */
const runnerOn = atom({ plugin: 'pixel-pets', key: 'runnerOn' } as const, false)
/** The focus timer's countdown for the band, or '' (E8-S01). */
const focusText = atom({ plugin: 'pixel-pets', key: 'focusText' } as const, '')
const storyId = atom({ plugin: 'pixel-pets', key: 'storyId' } as const, null)
const story = atom({ plugin: 'pixel-pets', key: 'story' } as const, null)
const storyError = atom({ plugin: 'pixel-pets', key: 'storyError' } as const, null)
const planLabel = atom({ plugin: 'pixel-pets', key: 'planLabel' } as const, null)
const weather = atom({ plugin: 'pixel-pets', key: 'weather' } as const, null)
const usage = atom({ plugin: 'pixel-pets', key: 'usage' } as const, { fiveHour: null, week: null, ctxPercent: null, costUsd: null })
const petState = atom({ plugin: 'pixel-pets', key: 'pet' } as const, { kind: 'cat', name: '' })
const petLine = atom({ plugin: 'pixel-pets', key: 'petLine' } as const, '')
const petShown = atom({ plugin: 'pixel-pets', key: 'petShown' } as const, true)
const git = atom({ plugin: 'pixel-pets', key: 'git' } as const, null)
const guardOff = atom({ plugin: 'pixel-pets', key: 'guardOff' } as const, false)
const chimeOn = atom({ plugin: 'pixel-pets', key: 'chimeOn' } as const, true)
const lastFailure = atom({ plugin: 'pixel-pets', key: 'lastFailure' } as const, null)

// ── Plan usage: the 5-hour and weekly windows, as /usage and the status line report them ──
const WARN_AT = [80, 95]

export function toUsage(u: Pick<SessionUsage, 'rateLimits' | 'context' | 'cost'>): Usage {
  const win = (kind: string): UsageWindow | null => {
    const r = u.rateLimits.find(x => x.kind === kind)
    return r ? { percent: r.percentUsed, resetsAt: r.resetsAt ?? null } : null
  }
  return {
    fiveHour: win('five_hour'),
    week: win('seven_day'),
    ctxPercent: u.context.percent ?? null,
    costUsd: u.cost?.usd ?? null,
  }
}

/** Time until an ISO reset as `2H14M` or `3D4H`; '' when unknown or past. */
export function fmtReset(iso: string | null, now: number): string {
  if (!iso) return ''
  const ms = Date.parse(iso) - now
  if (!(ms > 0)) return ''
  const min = Math.ceil(ms / 60000)
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60
  return d > 0 ? `${d}D${h}H` : h > 0 ? `${h}H${String(m).padStart(2, '0')}M` : `${m}M`
}

const usageTone = (pct: number): Tone => (pct >= 85 ? 'fail' : pct >= 60 ? 'warn' : 'pass')
const bar = (pct: number, width: number) => {
  const full = Math.max(0, Math.min(width, Math.round((pct / 100) * width)))
  return ['█'.repeat(full), '░'.repeat(width - full)] as const
}

const TICKET_RE = /\b([A-Z][A-Z0-9]{1,15}-\d{1,6})\b/
const NOT_TICKETS = new Set(['UTF', 'ISO', 'SHA', 'MD', 'RFC', 'CVE', 'TLS', 'SSL', 'GPT', 'HTTP'])
const ENV_RE = /\b(DEV|TST|UAT|PROD)\b|\b(?:on|in|against|to) (dev|tst|uat|prod)\b/i
const TEST_CMD_RE = /playwright\s+test|\bwdio\b|\bnpm\s+(run\s+)?test|\bnpx\s+jest|\bvitest\b|\bdotnet\s+test|\bpytest\b|\bpnpm\s+(run\s+)?test/

const fmtTokens = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n)

const fmtModel = (id: string) =>
  id.replace(/^claude-/, '').replace(/\[1m\]/i, ' 1M').replace(/-(\d+)-(\d+)/, ' $1.$2').toUpperCase()

const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length))
const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').trim()

function findTicket(text: string): string | null {
  const m = TICKET_RE.exec(text)
  const key = m?.[1]
  if (!key) return null
  if (CFG.storyId.test(key)) return null
  return NOT_TICKETS.has(key.split('-')[0] ?? '') ? null : key
}

// Bare DEV/TST/UAT/PROD must be uppercase; "on dev" / "in tst" may be any case.
function findEnv(text: string): string | null {
  const m = ENV_RE.exec(text)
  if (!m) return null
  if (m[1] !== undefined) return m[1] === m[1].toUpperCase() ? m[1] : null
  return m[2]?.toUpperCase() ?? null
}

function findStoryId(text: string): string | null {
  const id = CFG.storyId.exec(text)?.[1]
  return id ? id.toUpperCase() : null
}

export function toStatus(text: string): StoryStatus {
  const t = text.toLowerCase()
  if (t.includes('✅') || /\bdone\b/.test(t)) return 'DONE'
  if (t.includes('live')) return 'LIVE'
  if (t.includes('not enabled') || t.includes('dark')) return 'DARK'
  if (t.includes('blocked') || t.includes('⛔')) return 'BLOCKED'
  if (t.includes('proposed') || t.includes('💡')) return 'PROPOSED'
  if (t.includes('progress') || t.includes('partial') || t.includes('◐') || t.includes('🟡')) return 'PARTIAL'
  if (t.includes('to do') || t.includes('todo') || t.includes('⬜') || t.includes('✗')) return 'TODO'
  return 'UNKNOWN'
}

const lastHeading = (md: string, before: number, re: RegExp) => {
  let found = ''
  for (const m of md.slice(0, before).matchAll(re)) found = (m[1] ?? '').trim()
  return found
}

/** A story block: `<details><summary><b>E12-S03</b> - as a … · 🚀 Live · 5 pts</summary>`, ACs and a task table inside. */
export function parseStoryBlock(md: string, id: string): Omit<Story, 'path' | 'mtimeMs'> | null {
  const at = md.indexOf(`<summary><b>${id}</b>`)
  if (at < 0) return null
  const head = md.slice(at, md.indexOf('</summary>', at))
  const parts = stripTags(head.replace(`<summary><b>${id}</b>`, '')).replace(/^-\s*/, '').split(' · ')
  const pts = /(\d+)\s*pts?/.exec(parts[parts.length - 1] ?? '')
  if (pts) parts.pop()
  const statusText = (parts.pop() ?? '').replace(/^[^\p{L}]+/u, '').trim()
  const want = parts.join(' · ').replace(/^as an? [^,]+, I want /i, '')

  const end = md.indexOf('</details>', at)
  const body = md.slice(at, end < 0 ? undefined : end)
  const acBlock = body.split('**Acceptance criteria**')[1] ?? ''
  const ac = acBlock.split(/\n\s*\n/)[0]?.split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2).trim()) ?? []
  const tasks: StoryTask[] = []
  for (const row of body.matchAll(/^\|\s*([^|]+?)\s*\|\s*(technical|testing|deployment)\s*\|\s*([^|]+?)\s*\|$/gim)) {
    tasks.push({ name: row[1] ?? '', kind: row[2] ?? '', status: toStatus(row[3] ?? '') })
  }
  const epic = lastHeading(md, at, /^### ([^\n]+?)(?: - [^\n]*)?$/gm)
  const section = lastHeading(md, at, /^## ([^\n]+?)(?: - [^\n]*)?$/gm)

  return {
    source: '', id, title: want, status: toStatus(statusText), statusText,
    points: pts ? Number(pts[1]) : null, epic, section, ac, tasks,
  }
}

/** A table row: `| M1-14 | deliverable | status |` under a `## Milestone 1 — …` heading. */
export function parseTableRow(md: string, id: string): Omit<Story, 'path' | 'mtimeMs'> | null {
  const re = new RegExp(`^\\|\\s*${id}\\s*\\|\\s*(.+?)\\s*\\|\\s*(.+?)\\s*\\|\\s*$`, 'm')
  const m = re.exec(md)
  if (!m) return null
  const statusText = (m[2] ?? '').trim()
  const section = lastHeading(md, m.index, /^#{2,3} ([^\n]+)$/gm)
  return {
    source: '', id, title: (m[1] ?? '').replace(/`/g, ''), status: toStatus(statusText),
    statusText: statusText.replace(/^[✅◐✗]\s*/u, ''), points: null, epic: section, section: '',
    ac: [], tasks: [],
  }
}

async function firstExisting($: EngineInterface, paths: string[]): Promise<string | null> {
  for (const p of paths) {
    try {
      if (await $.fs.exists(p)) return p
    } catch {
      // a path the host refuses is skipped
    }
  }
  return null
}

// ── The plan: the markdown a project's stories live in ──────────────────────
// Each repo can point at its own (/story plan), stored by repo root; otherwise the
// settings' backlogFiles apply. A story id is only ever tracked if the plan has it.
const normPath = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '')
const isAbsPath = (p: string) => /^([a-z]:)?\//i.test(normPath(p))
const baseName = (p: string) => normPath(p).split('/').pop() ?? p

async function repoRoot($: EngineInterface): Promise<string> {
  return normPath(await $.session.root())
}

async function storeMap($: EngineInterface, key: string): Promise<Record<string, unknown>> {
  const v = await $.store.get(key)
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

/** The files this repo's plan is read from, and whether the repo chose them itself. */
async function planFiles($: EngineInterface): Promise<{ files: string[]; isRepo: boolean; root: string }> {
  const root = await repoRoot($)
  const mine = (await storeMap($, 'plans'))[root]
  if (Array.isArray(mine) && mine.length && mine.every(f => typeof f === 'string')) {
    return { files: mine as string[], isRepo: true, root }
  }
  return { files: CFG.backlogFiles, isRepo: false, root }
}

async function setRepoPlan($: EngineInterface, root: string, files: string[] | null) {
  const plans = await storeMap($, 'plans')
  if (files) plans[root] = files
  else delete plans[root]
  await $.store.set('plans', plans)
}

async function existingFiles($: EngineInterface, files: string[]): Promise<string[]> {
  const out: string[] = []
  for (const f of files) if (await firstExisting($, [f])) out.push(f)
  return out
}

/** Finds a story in the plan, reading nothing else; `existing` is the plan files that exist. */
async function lookupStory($: EngineInterface, id: string): Promise<{ story: Story | null; existing: string[]; files: string[] }> {
  const { files } = await planFiles($)
  const existing: string[] = []
  for (const path of files) {
    if (!(await firstExisting($, [path]))) continue
    existing.push(path)
    const { mtimeMs } = await $.fs.stat(path)
    const md = String(await $.fs.read(path))
    const parsed = parseStoryBlock(md, id) ?? parseTableRow(md, id)
    if (parsed) return { story: { ...parsed, source: baseName(path), path, mtimeMs }, existing, files }
  }
  return { story: null, existing, files }
}

async function setPlanLabel($: EngineInterface, existing: string[]) {
  const label = existing[0] ? baseName(existing[0]) : null
  if ((await read($, planLabel)) !== label) await update($, planLabel, () => label)
}

const PLAN_NAME = /(^|[-_ .])(backlog|roadmap|plan|planning|milestones?|todo|stories|tasks|sprint)([-_ .]|$)/i
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'bin', 'obj', 'out', '.venv', 'venv', '__pycache__', '.next', 'coverage', 'target'])

/** Markdown in the repo that looks like a plan, the ones with the most story ids first. */
async function discoverPlans($: EngineInterface, root: string): Promise<{ path: string; ids: number }[]> {
  const hits: string[] = []
  let queue: string[] = [root]
  for (let depth = 0, visited = 0; depth <= 3 && queue.length && visited < 300; depth++) {
    const next: string[] = []
    for (const dir of queue) {
      if (++visited > 300) break
      let entries: { name: string; kind: string }[] = []
      try {
        entries = await $.fs.list(dir)
      } catch {
        continue
      }
      for (const en of entries) {
        if (en.kind === 'dir' && !SKIP_DIRS.has(en.name) && !en.name.startsWith('.')) next.push(`${dir}/${en.name}`)
        else if (en.kind === 'file' && /\.md$/i.test(en.name) && PLAN_NAME.test(en.name.replace(/\.md$/i, ''))) hits.push(`${dir}/${en.name}`)
      }
    }
    queue = next
  }
  const ids = new RegExp(CFG.storyId.source, 'gi')
  const scored: { path: string; ids: number }[] = []
  for (const path of hits.slice(0, 16)) {
    try {
      const md = String(await $.fs.read(path))
      scored.push({ path, ids: new Set(md.match(ids) ?? []).size })
    } catch {
      // unreadable: skipped
    }
  }
  return scored.sort((x, y) => y.ids - x.ids || x.path.length - y.path.length)
}

/** Asks which file is the plan: up to four found ones, or a path typed under Other. */
async function askPlan($: EngineInterface, root: string, found: { path: string; ids: number }[]): Promise<string | undefined> {
  const rel = (p: string) => (p.startsWith(root + '/') ? p.slice(root.length + 1) : p)
  const shown = found.slice(0, 4)
  const labels = shown.map(f => rel(f.path))
  try {
    const answer = await $.ui.ask('Which file is this project\'s plan?', {
      header: 'Plan',
      options: labels.length >= 2 ? labels : [...labels, 'None of these'],
    })
    if (answer === 'None of these') return undefined
    const i = labels.indexOf(answer)
    if (i >= 0) return shown[i]?.path
    const typed = answer.trim()
    return typed ? (isAbsPath(typed) ? normPath(typed) : `${root}/${normPath(typed).replace(/^\.\//, '')}`) : undefined
  } catch {
    return undefined
  }
}

/** Re-reads the selected story's markdown; `force` skips the unchanged-mtime check. */
async function loadStory($: EngineInterface, force = false) {
  const id = await read($, storyId)
  if (!id) {
    await update($, story, () => null)
    await update($, storyError, () => null)
    await setPlanLabel($, await existingFiles($, (await planFiles($)).files))
    return
  }
  const current = await read($, story)
  if (!force && current?.id === id) {
    try {
      if ((await $.fs.stat(current.path)).mtimeMs === current.mtimeMs) return
    } catch {
      // moved or deleted: look again
    }
  }
  const hit = await lookupStory($, id)
  await setPlanLabel($, hit.existing)
  if (!hit.story) {
    // not an error: the band says the id isn't in the plan and how to change it
    await update($, storyError, () => id)
    await update($, story, () => null)
    return
  }
  const next: Story = hit.story
  const changed = current?.id === id && current.status !== next.status
  await update($, story, () => next)
  await update($, storyError, () => null)
  if (changed) $.ui.toast(`▶ ${id}: ${current?.status} → ${next.status}`, { timeoutMs: 6000 })
}

/** Tracks a story for this repo (each repo remembers its own). */
/** What /story says when nothing is tracked: where the plan is, or how to set one. */
async function planHint($: EngineInterface): Promise<string> {
  const missing = await read($, storyError)
  const { files, isRepo } = await planFiles($)
  const existing = await existingFiles($, files)
  if (!existing.length) {
    return `No plan found for this project (looked for ${files.join(', ')}). Run /story plan to pick one, or /story plan path/to/plan.md.`
  }
  const where = existing.join(', ') + (isRepo ? '' : ' (from settings)')
  return missing
    ? `${missing} isn't in the plan (${where}). /story <id> tracks another, /story plan points at a different file.`
    : `No story tracked. Plan: ${where}. /story <id> tracks one.`
}

async function selectStory($: EngineInterface, id: string | null) {
  await update($, storyId, () => id)
  const root = await repoRoot($)
  const stories = await storeMap($, 'stories')
  if (id) stories[root] = id
  else delete stories[root]
  await $.store.set('stories', stories)
  await loadStory($, true)
  await refreshStatus($)
  await refreshGit($)
}

function parseTests(command: string, out: string): TestRun | null {
  const n = (re: RegExp) => Number(re.exec(out)?.[1] ?? 0)
  const run: TestRun = {
    passed: n(/(\d+)\s+passed/i),
    failed: n(/(\d+)\s+failed/i),
    skipped: n(/(\d+)\s+skipped/i),
    flaky: n(/(\d+)\s+flaky/i),
    command,
  }
  return run.passed + run.failed + run.skipped + run.flaky > 0 ? run : null
}

function describe(e: Record<string, unknown>): string {
  const pick = (k: string) => (typeof e[k] === 'string' ? (e[k] as string) : '')
  const path = pick('file_path') || pick('path') || pick('notebook_path')
  if (path) return path.split(/[\\/]/).pop() ?? path
  return (pick('command') || pick('pattern') || pick('url') || pick('description') || pick('skill')).replace(/\s+/g, ' ')
}

async function refreshStatus($: EngineInterface) {
  const [t, en, tok, tr, s, model] = await Promise.all([
    read($, ticket),
    read($, env),
    read($, tokens),
    read($, turns),
    read($, story),
    $.session.model(),
  ])
  const where = s
    ? `${s.id} ${s.status}`
    : t ? `${t}${en ? '@' + en : ''}` : en ? `ENV ${en}` : 'NO STORY'
  const run = tr ? ` │ ${tr} TURN${tr === 1 ? '' : 'S'}` : ''
  const res = await read($, tests)
  const testBit = res ? ` │ ✓${res.passed} ✗${res.failed}` : ''
  const u = await read($, usage)
  const lim = [u.fiveHour && `5H ${Math.round(u.fiveHour.percent)}%`, u.week && `WK ${Math.round(u.week.percent)}%`]
    .filter(Boolean).join(' ')
  const limBit = lim ? ` │ ${lim}` : ''
  $.ui.status(`▌PETS▐ READY. │ ${fmtModel(model)} │ ${where}${limBit} │ ${fmtTokens(tok)} TOK${run}${testBit}`)
}

let petSize: 'auto' | 'big' | 'small' = 'auto'
export const levelOf = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 15)) + 1

export function moodOf(limit: number | null): Mood {
  if (limit === null) return 'happy'
  if (limit >= 100) return 'gameover'
  if (limit >= FURIOUS_AT) return 'furious'
  if (limit >= GRUMPY_AT) return 'grumpy'
  return 'happy'
}

// The game lives in the module, not in $.state: it is animation, redrawn by
// blit, and a reload simply starts the round over (XP is in $.store).
const petSim = {
  x: 4,
  dir: -1 as 1 | -1,
  tick: 0,
  columns: 0,
  isMounted: false,
  requestId: '',
  lastCells: '',
  /** Where a remote surface (desktop, VS Code, phone) shows the pet as SVG: the band, the pet pane. */
  remote: { band: false, pane: false },
  lastArt: '',
  sitUntil: 0,
  react: null as null | { glyph: string; tone: Tone; until: number; jump: boolean; text?: string; kind?: ReactKind },
  /** A merge conflict seen and not yet resolved (E6-S04). */
  isConflict: false,
  /** A command running now: since when, and what (E6-S04). */
  toolSince: null as number | null,
  toolName: '',
  wearing: [] as ItemId[],
  /** A colouring from a blind box (E9). */
  skin: null as SkinId | null,
  /** The new look's bigger sprites (E10): a remote surface always, the terminal when it has room. */
  hd: false,
  /** A blind box being opened: when it pops, and what was in it (E9). */
  opening: null as null | { x: number; openAt: number; until: number; label: string },
  /** The focus timer, mirrored from the store (E8-S01). */
  focus: null as null | Focus,
  /** Today's festival, if any and if they are on (E8-S03). */
  festival: null as null | Festival,
  /** How old the pet turns today, 0 when it isn't its birthday (E8-S04). */
  birthday: 0,
  /** A friend's pet visiting for a minute (E7-S02). */
  guest: null as null | { login: string; kind: PetKind; level: number; wearing: ItemId[]; x: number; dir: 1 | -1; pose: Pose; until: number },
  ballX: null as number | null,
  lastActive: 0,
  isWorking: false,
  line: '',
  coins: [] as number[],
  bugs: [] as { x: number; dir: 1 | -1 }[],
  collected: 0,
  xp: 0,
  isXpLoaded: false,
  /** The XP last read from or written to the save; what this session earned since is xp - savedXp. */
  savedXp: 0,
  limit: null as number | null,
  limitLabel: '',
  resetText: '',
  mood: 'happy' as Mood,
  wx: null as Weather | null,
  kids: [] as Kid[],
  kidSerial: 0,
  kidsHome: 0,
  kidXp: 0,
}

/** How wide the pet is now: the new look's sprites are bigger, a baby smaller. */
function petW(): number {
  if (!petSim.hd) return SPRITE_W
  return stageOf(levelOf(petSim.xp)) === 'baby' ? BABY_W : HD_W
}

type ReactKind = 'dance' | 'rocket' | 'stretch'

/** What the pet wears now: on its birthday, a party hat in place of anything on its head (E8-S04). */
const worn = (): ItemId[] => (petSim.birthday ? [...petSim.wearing.filter(i => ITEMS[i].slot !== 'head'), 'party'] : petSim.wearing)

function petReact(glyph: string, tone: Tone, ms: number, now: number, jump = false, more: { text?: string; kind?: ReactKind } = {}) {
  petSim.react = { glyph, tone, until: now + ms, jump, ...more }
}

/** The pet, or the settings' starting pet until one has been chosen or named. */
async function readPet($: EngineInterface): Promise<{ kind: PetKind; name: string }> {
  const p = await read($, petState)
  return p.name ? p : { kind: CFG.petKind, name: CFG.petName }
}

/** A coin drops somewhere the pet is not standing (a successful tool call). */
function spawnCoin() {
  const s = petSim
  if (s.columns < petW() + 4 || s.coins.length >= 6) return
  for (let tries = 0; tries < 6; tries++) {
    const x = 2 + Math.floor(Math.random() * (s.columns - 4))
    if (x < s.x - 1 || x > s.x + petW()) {
      s.coins.push(x)
      return
    }
  }
}

/** A bug crawls in from the edge furthest from the pet (an error). */
function spawnBug() {
  const s = petSim
  if (s.columns < petW() + 4 || s.bugs.length >= 4) return
  const fromLeft = s.x > s.columns / 2
  s.bugs.push({ x: fromLeft ? 0 : s.columns - 2, dir: fromLeft ? 1 : -1 })
}

// The pet's voice is the only sound, and it speaks at most once in this long.
const SOUND_GAP_MS = 20_000
let lastSoundAt = 0

// Linux has no player the engine can use: the first of these that is installed plays.
const LINUX_PLAYERS = [['paplay'], ['pw-play'], ['aplay', '-q']]
let linuxPlayer: string[] | null | undefined

/** Plays one of the pet's voices: Windows' own player, the engine's on macOS, a desktop player on Linux. */
async function playSound($: EngineInterface, name: string) {
  if (!(await read($, chimeOn))) return
  const now = await $.clock.now()
  if (now - lastSoundAt < SOUND_GAP_MS) return
  lastSoundAt = now
  try {
    if (await $.fs.exists('C:/Windows/Media')) {
      const file = `${$.plugin.root}/sounds/${name}.wav`.replace(/\//g, '\\')
      await $.process.run([
        'powershell', '-NoProfile', '-NonInteractive', '-Command',
        `(New-Object Media.SoundPlayer '${file.replace(/'/g, "''")}').PlaySync()`,
      ])
    } else if (await $.fs.exists('/usr/bin/afplay')) {
      await $.audio.play({ asset: `sounds/${name}.wav` })
    } else {
      const file = `${$.plugin.root}/sounds/${name}.wav`
      if (linuxPlayer === undefined) {
        linuxPlayer = null
        for (const cmd of LINUX_PLAYERS) {
          const which = await $.process.run(['sh', '-c', `command -v ${cmd[0]}`]).catch(() => null)
          if (which && which.exitCode === 0) {
            linuxPlayer = cmd
            break
          }
        }
      }
      if (linuxPlayer) await $.process.run([...linuxPlayer, file])
    }
  } catch {
    // no player
  }
}

/** The pet's own voice: content when things are fine, cross when the plan is nearly spent. */
async function petVoice($: EngineInterface) {
  const pet = await readPet($)
  const v = PETS[pet.kind].voice
  await playSound($, petSim.mood === 'happy' ? v.happy : v.cross)
}

let xpLoading: Promise<void> | null = null

/** Reads the save once; every caller waits on the same read, so nothing is counted twice. */
function loadXp($: EngineInterface): Promise<void> {
  xpLoading ??= (async () => {
    const saved = await $.store.get('petXp')
    const base = typeof saved === 'number' ? saved : 0
    // XP earned before the save was read (a coin on the first frame) is kept on top
    petSim.xp += base
    petSim.savedXp = base
    petSim.isXpLoaded = true
  })()
  return xpLoading
}

/**
 * Adds what this session earned since its last save to what the save holds now,
 * so several open sessions add up instead of overwriting one another.
 */
async function saveXp($: EngineInterface) {
  await loadXp($)
  const saved = await $.store.get('petXp')
  const now = (typeof saved === 'number' ? saved : 0) + (petSim.xp - petSim.savedXp)
  await $.store.set('petXp', now)
  petSim.xp = now
  petSim.savedXp = now
}

async function gainXp($: EngineInterface, n: number, why: XpReason = 'other', count = 1) {
  await loadXp($)
  const before = levelOf(petSim.xp)
  petSim.xp += n
  const after = levelOf(petSim.xp)
  await recordXp($, n, why, count, after)
  if (why === 'coin') await addCoins($, count)
  if (after > before) {
    const pet = await readPet($)
    const grew = stageOf(after) !== stageOf(before) ? stageOf(after) : null
    petReact('★', 'warn', grew ? 6000 : 3000, await $.clock.now(), true, grew ? { text: `GREW UP: ${grew.toUpperCase()}!` } : {})
    $.ui.toast(grew
      ? `▶ LEVEL UP! ${pet.name.toUpperCase()} IS LV${after} AND GREW UP: ${grew.toUpperCase()}!`
      : `▶ LEVEL UP! ${pet.name.toUpperCase()} IS NOW LV${after}`, { timeoutMs: 6000 })
    void petVoice($)
    await saveXp($)
    await earnBox($, after - before, 'LEVELLING UP')
  }
}

// ── Wallet (E6-S02): coins to spend, kept apart from lifetime coins ─────────
export type Wallet = {
  coins: number; owned: ItemId[]; wearing: ItemId[]
  /** Unopened blind boxes, the skins and animals they gave, the skin worn, and boxes since an epic (E9). */
  boxes: number; skins: SkinId[]; skin: SkinId | null; pets: PetKind[]; sinceEpic: number
}
/** Blind boxes came in 1.7.0: everyone starts with a few to open. */
const STARTER_BOXES = 3

async function readWallet($: EngineInterface): Promise<Wallet> {
  const w = (await $.store.get('wallet')) as Partial<Wallet> | undefined
  const more = (x: Partial<Wallet> | undefined) => ({
    boxes: typeof x?.boxes === 'number' ? x.boxes : STARTER_BOXES,
    skins: (x?.skins ?? []).filter(isSkinId),
    skin: isSkinId(x?.skin) ? x.skin : null,
    pets: (x?.pets ?? []).filter(k => BOX_PETS.includes(k)),
    sinceEpic: typeof x?.sinceEpic === 'number' ? x.sinceEpic : 0,
  })
  if (w && typeof w.coins === 'number') {
    return { coins: w.coins, owned: (w.owned ?? []).filter(isItemId), wearing: (w.wearing ?? []).filter(isItemId), ...more(w) }
  }
  // the first time: every coin collected so far is spendable
  const p = (await $.store.get('profile')) as Profile | undefined
  return { coins: p?.totals?.coins ?? 0, owned: [], wearing: [], ...more(undefined) }
}

async function writeWallet($: EngineInterface, w: Wallet) {
  await $.store.set('wallet', w)
  petSim.wearing = w.wearing
  petSim.skin = w.skin
}

async function addCoins($: EngineInterface, n: number) {
  const w = await readWallet($)
  await writeWallet($, { ...w, coins: w.coins + n })
}

export function shopText(w: Wallet): string {
  return [
    `COIN SHOP · you have ◆${w.coins}`,
    ...ITEM_IDS.filter(id => ITEMS[id].price > 0 || w.owned.includes(id)).map(id => {
      const it = ITEMS[id]
      const mark = w.wearing.includes(id) ? 'WEARING' : w.owned.includes(id) ? 'owned' : `◆${it.price}`
      return `  ${id.padEnd(11)} ${it.name.padEnd(14)} ${mark}${it.rarity ? ` (${it.rarity}, from a box)` : it.festival ? ` (${FESTIVALS[it.festival as Keepsake].title.toLowerCase()} keepsake)` : ''}`
    }),
    '/pet buy <item> · /pet wear <item> (again to take it off) · /pet wear none',
    `Blind boxes hold items you can't buy here: ${w.boxes} to open · /pet box`,
  ].join('\n')
}

/** Buying or wearing; returns what to say. */
export async function shopCommand($: EngineInterface, verb: 'buy' | 'wear', what: string): Promise<string> {
  const w = await readWallet($)
  const id = what.toLowerCase().replace(/[^a-z]/g, '')
  if (verb === 'wear' && id === 'none') {
    await writeWallet($, { ...w, wearing: [] })
    return 'Took everything off.'
  }
  if (!isItemId(id)) return `No item called "${what}". ${ITEM_IDS.filter(i => !ITEMS[i].isEvent).join(' · ')}`
  const it = ITEMS[id]
  if (it.isEvent) return `The ${it.name.toLowerCase()} comes out by itself on your pet's birthday. /pet birthday`
  if (it.festival && !(verb === 'wear' && w.owned.includes(id))) {
    const f = FESTIVALS[it.festival as Keepsake]
    return `The ${it.name.toLowerCase()} is a ${f.title.toLowerCase()} keepsake: it comes once, during ${f.when}. /pet festivals`
  }
  if (verb === 'buy') {
    if (it.price <= 0 && !w.owned.includes(id)) return `The ${it.name.toLowerCase()} only comes out of a blind box (${it.rarity}). /pet box`
    if (w.owned.includes(id)) return `You already have the ${it.name.toLowerCase()}. /pet wear ${id}`
    if (w.coins < it.price) return `The ${it.name.toLowerCase()} costs ◆${it.price}; you have ◆${w.coins}. Coins drop for every tool call that works.`
    const wearing = [...w.wearing.filter(x => ITEMS[x].slot !== it.slot), id]
    await writeWallet($, { ...w, coins: w.coins - it.price, owned: [...w.owned, id], wearing })
    return `Bought the ${it.name.toLowerCase()} for ◆${it.price}, and put it on. ◆${w.coins - it.price} left.`
  }
  if (!w.owned.includes(id)) return it.price > 0 ? `You don't have the ${it.name.toLowerCase()} yet: /pet buy ${id} (◆${it.price}).` : `You haven't found the ${it.name.toLowerCase()} yet: it comes out of blind boxes.`
  if (w.wearing.includes(id)) {
    await writeWallet($, { ...w, wearing: w.wearing.filter(x => x !== id) })
    return `Took off the ${it.name.toLowerCase()}.`
  }
  await writeWallet($, { ...w, wearing: [...w.wearing.filter(x => ITEMS[x].slot !== it.slot), id] })
  return `Wearing the ${it.name.toLowerCase()}.`
}

// ── Blind boxes (E9) ─────────────────────────────────────────────────────────
// One for each level up, each achievement and every fourth focus round. Each holds
// one find: a box-only item, a skin, or (rarely) a box-only animal. A find you
// already have turns into coins, and ten boxes without an epic make the next one epic.
export type Loot = { kind: 'item'; id: ItemId } | { kind: 'skin'; id: SkinId } | { kind: 'pet'; id: PetKind }
export const BOX_ODDS: Record<Rarity, number> = { common: 60, rare: 27, epic: 10, legendary: 3 }
export const BOX_PITY = 10
export const SPARE_COINS: Record<Rarity, number> = { common: 10, rare: 25, epic: 60, legendary: 150 }
export const LOOT: Record<Rarity, Loot[]> = {
  common: [{ kind: 'item', id: 'flower' }, { kind: 'item', id: 'headphones' }, { kind: 'item', id: 'bandana' }],
  rare: [{ kind: 'item', id: 'cape' }, { kind: 'item', id: 'wizard' }, { kind: 'item', id: 'rainbow' }],
  epic: [{ kind: 'item', id: 'halo' }, { kind: 'skin', id: 'pastel' }, { kind: 'skin', id: 'shadow' }, { kind: 'skin', id: 'ghost' }],
  legendary: [{ kind: 'skin', id: 'golden' }, { kind: 'skin', id: 'galaxy' }, { kind: 'pet', id: 'dragon' }, { kind: 'pet', id: 'unicorn' }, { kind: 'pet', id: 'axolotl' }],
}
const RARITY_TAG: Record<Rarity, string> = { common: '◇ COMMON', rare: '◆ RARE', epic: '★ EPIC', legendary: '✦ LEGENDARY' }
const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary']

/** One box, from two random numbers in [0, 1): its rarity (the pity lifts it), then which find. */
export function rollBox(a: number, b: number, sinceEpic: number): { rarity: Rarity; loot: Loot } {
  const roll = a * 100
  let rarity: Rarity = roll < BOX_ODDS.common ? 'common'
    : roll < BOX_ODDS.common + BOX_ODDS.rare ? 'rare'
    : roll < 100 - BOX_ODDS.legendary ? 'epic' : 'legendary'
  if (sinceEpic >= BOX_PITY - 1 && (rarity === 'common' || rarity === 'rare')) rarity = 'epic'
  const pool = LOOT[rarity]
  return { rarity, loot: pool[Math.min(pool.length - 1, Math.floor(b * pool.length))]! }
}

export const lootName = (l: Loot) =>
  l.kind === 'item' ? ITEMS[l.id].name : l.kind === 'skin' ? `${SKINS[l.id].name} skin` : `${l.id[0]!.toUpperCase()}${l.id.slice(1)} (a new animal)`
const lootHow = (l: Loot) => (l.kind === 'item' ? `/pet wear ${l.id}` : l.kind === 'skin' ? `/pet skin ${l.id}` : `/pet ${l.id}`)

async function earnBox($: EngineInterface, n: number, why: string) {
  if (n <= 0) return
  const w = await readWallet($)
  await writeWallet($, { ...w, boxes: w.boxes + n })
  $.ui.toast(`▶ +${n} BLIND BOX${n === 1 ? '' : 'ES'} FOR ${why} · /pet box open`, { timeoutMs: 7000 })
}

export const BOX_REVEAL_MS = 1500
const BOX_SHOW_MS = 6000

/** Opens one box: the pet shakes it in the band, then the find pops out. */
async function openBox($: EngineInterface): Promise<string> {
  const w = await readWallet($)
  if (w.boxes < 1) return 'No blind boxes to open. You get one for each level up, each achievement and every 4 focus rounds.'
  const { rarity, loot } = rollBox(Math.random(), Math.random(), w.sinceEpic)
  const has = hasLoot(w, loot)
  const next: Wallet = { ...w, boxes: w.boxes - 1, sinceEpic: rarity === 'epic' || rarity === 'legendary' ? 0 : w.sinceEpic + 1 }
  if (has) next.coins += SPARE_COINS[rarity]
  else if (loot.kind === 'item') next.owned = [...w.owned, loot.id]
  else if (loot.kind === 'skin') next.skins = [...w.skins, loot.id]
  else next.pets = [...w.pets, loot.id]
  await writeWallet($, next)
  const label = `${RARITY_TAG[rarity]} · ${lootName(loot).toUpperCase()}${has ? ` (A SPARE: +◆${SPARE_COINS[rarity]})` : ''}`
  const now = await $.clock.now()
  const s = petSim
  const boxX = Math.max(0, Math.min(Math.max(0, s.columns - 6), s.dir === 1 ? s.x + petW() + 1 : s.x - 6))
  s.opening = { x: boxX, openAt: now + BOX_REVEAL_MS, until: now + BOX_REVEAL_MS + BOX_SHOW_MS, label }
  $.clock.after(BOX_REVEAL_MS, () => {
    $.ui.toast(`▶ BLIND BOX: ${label}${has ? '' : ` · ${lootHow(loot)}`}`, { timeoutMs: 9000 })
    void $.clock.now().then(t => petReact('★', 'warn', 3000, t, true))
    void petVoice($)
  })
  return `📦 Opening a blind box… watch the band. ${next.boxes} left.`
}

export function boxText(w: Wallet): string {
  const pct = (r: Rarity) => `${RARITY_TAG[r]} ${BOX_ODDS[r]}%: ${LOOT[r].map(lootName).join(', ')}`
  return [
    `BLIND BOXES · ${w.boxes} to open${w.boxes ? ' · /pet box open' : ''}`,
    'You get one for each level up, each achievement and every 4 focus rounds.',
    ...RARITIES.map(r => `  ${pct(r)}`),
    `A find you already have is worth coins instead. ${BOX_PITY} boxes in a row without an epic make the next one epic.`,
  ].join('\n')
}

/** Whether a find is in the wallet. */
export const hasLoot = (w: Wallet, l: Loot) =>
  l.kind === 'item' ? w.owned.includes(l.id) : l.kind === 'skin' ? w.skins.includes(l.id) : w.pets.includes(l.id)

/** Every find a box can hold, by rarity: ✓ found (* in use), 🔒 not yet; then the shop items owned. */
export function collectionText(w: Wallet): string {
  const all = RARITIES.flatMap(r => LOOT[r])
  const found = all.filter(l => hasLoot(w, l)).length
  const inUse = (l: Loot) => (l.kind === 'item' ? w.wearing.includes(l.id) : l.kind === 'skin' && w.skin === l.id)
  const mark = (l: Loot) => {
    if (!hasLoot(w, l)) return `🔒 ${l.id}`
    return l.kind === 'pet' ? `${PETS[l.id].emoji} ${l.id}` : `✓ ${l.id}${inUse(l) ? '*' : ''}`
  }
  const bought = w.owned.filter(id => ITEMS[id].price > 0)
  return [
    `COLLECTION · ${found}/${all.length} found · ◆${w.coins} · ${w.boxes} blind box${w.boxes === 1 ? '' : 'es'} to open`,
    ...RARITIES.map(r => `  ${RARITY_TAG[r].padEnd(12)} ${LOOT[r].map(mark).join('  ')}`),
    `  Shop items   ${bought.length ? bought.map(id => `${id}${w.wearing.includes(id) ? '*' : ''}`).join('  ') : 'none yet (/pet shop)'}`,
    `  Keepsakes    ${KEEPSAKES.map(id => (w.owned.includes(id) ? `✓ ${id}${w.wearing.includes(id) ? '*' : ''}` : `🔒 ${id}`)).join('  ')} (one at each festival)`,
    '* in use · /pet wear <item> · /pet skin <name>|none · /pet <animal> · /pet box open',
  ].join('\n')
}

/** What the pet is reacting to right now, for /pet stats (E6-S04). */
async function nowLine($: EngineInterface): Promise<string[]> {
  if (petSim.isConflict) return ['Now: PUZZLED BY A MERGE CONFLICT (resolve it and commit)']
  if (petSim.focus) return [`Now: ${petSim.focus.phase === 'focus' ? 'GUARDING YOUR FOCUS' : 'ON A BREAK'} · ${focusLabel(petSim.focus, await $.clock.now())}`]
  const g = petSim.guest
  if (g && g.until > (await $.clock.now())) return [`Now: PLAYING WITH ${g.login.toUpperCase()}'S ${g.kind.toUpperCase()} (LV${g.level})`]
  const r = petSim.react
  if (r?.text && r.until > (await $.clock.now())) return [`Now: ${r.text}`]
  if (petSim.birthday) return [`Now: TURNS ${petSim.birthday} TODAY · HAPPY BIRTHDAY!`]
  return petSim.festival ? [`Now: ${petSim.festival.line}`] : []
}

// ── The runner game (E6-S01) ─────────────────────────────────────────────────
// Off unless asked for: `/pet play` opens it in the band until `/pet play off`, and
// `/pet play auto` offers it by itself once a turn has run a few seconds. The game
// runs in runner.tsx, on the surface. Its runs score XP, at most RUNNER_XP_CAP a turn.
const RUNNER_AFTER_MS = 8000
export const RUNNER_XP_CAP = 20
const game = { live: 0, credited: 0, best: 0, isManual: false, timer: null as null | { cancel: () => void } }

/** Closes the runner; a run still going counts as it stands. */
async function closeRunner($: EngineInterface) {
  game.timer?.cancel()
  game.isManual = false
  await update($, runnerOn, () => false)
  if (game.live > 0) await creditRun($, game.live)
  game.live = 0
}

async function creditRun($: EngineInterface, score: number) {
  if (score > game.best) {
    game.best = score
    await $.store.set('runnerBest', score)
  }
  const gain = Math.min(score, RUNNER_XP_CAP - game.credited)
  if (gain > 0) {
    game.credited += gain
    await gainXp($, gain, 'game')
  }
}

// ── The focus timer (E8-S01): Pomodoro rounds the pet guards ────────────────
// Kept in $.store so it outlives a reload. Every open session arms its own clock;
// the one that still finds the phase unfinished in the store closes it.
export type Focus = { focusMin: number; breakMin: number; phase: 'focus' | 'break'; endsAt: number; round: number }
/** Every fourth break is a long one, three times the usual. */
export const LONG_BREAK_EVERY = 4
/** A phase that ended longer ago than this (Claude Code was closed) is dropped, not credited. */
const FOCUS_MISSED_MS = 60_000
const focusClock = { timer: null as null | { cancel: () => void }, text: '' }

/** XP for a finished focus round: 10 for 25 minutes, 18 for 45. */
export const focusXp = (min: number) => Math.max(1, Math.round(min * 0.4))

/** `''` (25/5), `45` (45/5), `45/5`, `50 10`; null when it isn't a timer. */
export function parseFocus(arg: string): { focusMin: number; breakMin: number } | null {
  const a = arg.trim()
  if (!a) return { focusMin: 25, breakMin: 5 }
  const m = /^(\d{1,3})(?:\s*[/\s]\s*(\d{1,2}))?$/.exec(a)
  if (!m) return null
  const focusMin = Number(m[1]), breakMin = m[2] === undefined ? 5 : Number(m[2])
  return focusMin >= 1 && focusMin <= 180 && breakMin <= 60 ? { focusMin, breakMin } : null
}

export const breakAfter = (f: Focus) => (f.round % LONG_BREAK_EVERY === 0 ? f.breakMin * 3 : f.breakMin)

export function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function focusLabel(f: Focus, now: number): string {
  return f.phase === 'focus' ? `◷ FOCUS ${mmss(f.endsAt - now)} · ROUND ${f.round}` : `☕ BREAK ${mmss(f.endsAt - now)}`
}

async function readFocus($: EngineInterface): Promise<Focus | null> {
  const f = (await $.store.get('focus')) as Focus | null | undefined
  return f && typeof f === 'object' && typeof f.endsAt === 'number' ? f : null
}

/** The band's countdown, redrawn only when the text changes (once a second while a timer runs). */
async function refreshFocusText($: EngineInterface) {
  const f = petSim.focus
  const text = f ? focusLabel(f, await $.clock.now()) : ''
  if (text === focusClock.text) return
  focusClock.text = text
  await update($, focusText, () => text)
}

/** Stores the timer (or clears it) and arms this session's clock for the phase's end. */
async function setFocus($: EngineInterface, f: Focus | null) {
  await $.store.set('focus', f)
  petSim.focus = f
  focusClock.timer?.cancel()
  focusClock.timer = null
  if (f) focusClock.timer = $.clock.after(Math.max(0, f.endsAt - (await $.clock.now())), () => void endPhase($, f))
  await refreshFocusText($)
}

async function endPhase($: EngineInterface, armed: Focus) {
  const f = await readFocus($)
  // another session already moved it on, or it was stopped or restarted
  if (!f || f.endsAt !== armed.endsAt || f.phase !== armed.phase) {
    petSim.focus = f
    return
  }
  const now = await $.clock.now()
  const pet = await readPet($)
  if (f.phase === 'focus') {
    const xp = focusXp(f.focusMin)
    const rest = breakAfter(f)
    await setFocus($, rest > 0 ? { ...f, phase: 'break', endsAt: now + rest * 60_000 } : null)
    await gainXp($, xp, 'focus')
    await saveXp($)
    petReact('★', 'warn', 5000, now, true, { text: `GUARDED FOCUS ROUND ${f.round}` })
    if (f.round % LONG_BREAK_EVERY === 0) await earnBox($, 1, `${LONG_BREAK_EVERY} FOCUS ROUNDS`)
    $.ui.toast(rest > 0
      ? `▶ FOCUS ROUND ${f.round} DONE · +${xp} XP · ${rest} MIN BREAK: STAND UP, STRETCH, DRINK SOME WATER`
      : `▶ FOCUS DONE · +${xp} XP`, { timeoutMs: 10_000 })
  } else {
    await setFocus($, { ...f, phase: 'focus', round: f.round + 1, endsAt: now + f.focusMin * 60_000 })
    $.ui.toast(`▶ BREAK OVER · FOCUS ROUND ${f.round + 1}: ${f.focusMin} MIN. ${pet.name.toUpperCase()} IS ON GUARD`, { timeoutMs: 8000 })
  }
  void playSound($, PETS[pet.kind].voice.happy)
}

/** After a reload: picks the timer up again, or drops one that ended while nobody was here. */
async function resumeFocus($: EngineInterface) {
  const f = await readFocus($)
  if (!f) return
  if ((await $.clock.now()) - f.endsAt > FOCUS_MISSED_MS) await setFocus($, null)
  else await setFocus($, f)
}

export const FOCUS_HELP = [
  'FOCUS TIMER (Pomodoro): your pet guards your focus, then reminds you to take a break.',
  '  /pet focus             25 min focus, 5 min break, round after round',
  '  /pet focus 45/5        any focus/break in minutes: 45/5, 50/10, 90/15 · /pet focus 45 means 45/5',
  `  /pet focus stop        ends it; a round cut short earns no XP`,
  `Each finished round: a chime, a toast and XP (10 for 25 min). Every ${LONG_BREAK_EVERY}th break is three times as long.`,
].join('\n')

async function focusCommand($: EngineInterface, arg: string): Promise<string> {
  const a = arg.trim().toLowerCase()
  const now = await $.clock.now()
  const cur = await readFocus($)
  if (/^(stop|off|end|cancel)$/.test(a)) {
    await setFocus($, null)
    return cur ? 'Focus timer stopped. A round cut short earns no XP.' : 'No focus timer is running.'
  }
  if (/^(help|\?)$/.test(a)) return FOCUS_HELP
  if (!a && cur) return `${focusLabel(cur, now)} · ${cur.focusMin}/${cur.breakMin} · /pet focus stop ends it.`
  const p = parseFocus(a)
  if (!p) return FOCUS_HELP
  await setFocus($, { ...p, phase: 'focus', round: 1, endsAt: now + p.focusMin * 60_000 })
  const pet = await readPet($)
  return `Focus ${p.focusMin} min${p.breakMin ? `, then a ${p.breakMin} min break, round after round` : ', one round'}. ${pet.name.toUpperCase()} is on guard: the countdown is in the band. /pet focus stop ends it.`
}

// ── Break reminders (E8-S02) ─────────────────────────────────────────────────
// Work is continuous until a pause this long; a turn ending after the set time of it
// gets the reminder, so it never lands in the middle of one. At most once an hour.
const BREAK_GAP_MS = 10 * 60_000
const BREAK_EVERY_MS = 60 * 60_000
const BREAK_SHOW_MS = 20_000
const work = { since: 0, lastAt: 0 }

/** Notes a moment of work: a pause longer than BREAK_GAP_MS was a break, and the clock starts over. */
function noteWork(now: number) {
  if (!work.lastAt || now - work.lastAt > BREAK_GAP_MS) work.since = now
  work.lastAt = now
}

async function breakMinutes($: EngineInterface): Promise<number> {
  const v = await $.store.get('breaks')
  return typeof v === 'number' ? v : CFG.breaks
}

/** After a turn: the reminder, once the work has gone on long enough and none came in the last hour. */
async function maybeBreak($: EngineInterface, now: number) {
  const mins = await breakMinutes($)
  // a focus timer has breaks of its own
  if (!mins || petSim.focus || now - work.since < mins * 60_000) return
  const last = await $.store.get('lastBreakAt')
  if (typeof last === 'number' && now - last < BREAK_EVERY_MS) return
  await $.store.set('lastBreakAt', now)
  work.since = now
  const pet = await readPet($)
  petReact('~', 'info', BREAK_SHOW_MS, now, false, { text: 'STRETCHES · TIME FOR A BREAK AND SOME WATER', kind: 'stretch' })
  $.ui.toast(`▶ ${mins} MIN OF WORK · ${pet.name.toUpperCase()} STRETCHES: STAND UP, LOOK AWAY, DRINK SOME WATER`, { timeoutMs: 10_000 })
  void playSound($, PETS[pet.kind].voice.happy)
}

// ── Festivals and the birthday (E8-S03/S04) ─────────────────────────────────
/** A birthday's one-off gift. */
export const BIRTHDAY_XP = 50

/** The day the pet was adopted: stored the first time, from the earliest date the saves hold. */
async function adoptedOn($: EngineInterface): Promise<string> {
  const v = await $.store.get('adoptedOn')
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const p = (await $.store.get('profile')) as Partial<Profile> | undefined
  const d = (await $.store.get('diary')) as Partial<Diary> | undefined
  const dates = [p?.since, d?.day, dayOf(await $.clock.now())].filter((x): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x))
  const first = dates.sort()[0]!
  await $.store.set('adoptedOn', first)
  return first
}

/** The festivals that give a keepsake (all but your own days). */
type Keepsake = Exclude<FestivalId, 'custom'>
/** One keepsake for each festival, given the first time the festival is seen (E13-S02). */
export const KEEPSAKES = ITEM_IDS.filter(id => ITEMS[id].festival)

async function myFestivals($: EngineInterface): Promise<MyFestival[]> {
  const v = await $.store.get('myFestivals')
  return Array.isArray(v) ? (v as MyFestival[]) : []
}

/** A festival's keepsake, once: into the wallet with a toast. */
async function giveKeepsake($: EngineInterface, f: Festival) {
  const id = KEEPSAKES.find(k => ITEMS[k].festival === f.id)
  if (!id) return
  const w = await readWallet($)
  if (w.owned.includes(id)) return
  await writeWallet($, { ...w, owned: [...w.owned, id] })
  $.ui.toast(`▶ A ${f.title} KEEPSAKE: ${ITEMS[id].name.toUpperCase()} · /pet wear ${id}`, { timeoutMs: 10_000 })
  petReact('★', 'warn', 4000, await $.clock.now(), true)
}

/** Today's festival and birthday; the birthday's gift and the festival's keepsake the first time they are seen. */
async function refreshCalendar($: EngineInterface) {
  const today = dayOf(await $.clock.now())
  const pick = await $.store.get('festivals')
  petSim.festival = (typeof pick === 'boolean' ? pick : CFG.festivals) ? festivalOn(today, await myFestivals($)) : null
  if (petSim.festival) await giveKeepsake($, petSim.festival)
  const age = birthdayAge(await adoptedOn($), today)
  petSim.birthday = age
  if (!age || (await $.store.get('birthdayGift')) === today) return
  await $.store.set('birthdayGift', today)
  const pet = await readPet($)
  petReact('♥', 'fail', 8000, await $.clock.now(), true, { text: `TURNS ${age} TODAY · HAPPY BIRTHDAY!` })
  $.ui.toast(`▶ HAPPY BIRTHDAY, ${pet.name.toUpperCase()}! ${age} YEAR${age === 1 ? '' : 'S'} TOGETHER TODAY · +${BIRTHDAY_XP} XP`, { timeoutMs: 10_000 })
  await gainXp($, BIRTHDAY_XP, 'other')
  await saveXp($)
  void petVoice($)
}

async function birthdayText($: EngineInterface): Promise<string> {
  await refreshCalendar($)
  const pet = await readPet($)
  const adopted = await adoptedOn($)
  const today = dayOf(await $.clock.now())
  if (petSim.birthday) return `🎂 It's ${pet.name}'s birthday: ${petSim.birthday} today! The party hat is on, and the gift (+${BIRTHDAY_XP} XP) is in.`
  const next = nextBirthday(adopted, today)
  const days = daysBetween(today, next)
  return `${pet.name} was adopted on ${adopted} (${daysBetween(adopted, today)} days ago). Next birthday: ${next}, in ${days} day${days === 1 ? '' : 's'}, turning ${Number(next.slice(0, 4)) - Number(adopted.slice(0, 4))}: a party hat and +${BIRTHDAY_XP} XP.`
}

async function festivalsText($: EngineInterface, arg: string): Promise<string> {
  if (/^(on|off)$/i.test(arg)) {
    const isOn = /on/i.test(arg)
    await $.store.set('festivals', isOn)
    await refreshCalendar($)
    return isOn ? 'Festivals on: Tết, Mid-Autumn, Christmas, New Year, Valentine\'s Day, Halloween and your own days.' : 'Festivals off.'
  }
  const mine = await myFestivals($)
  const add = /^add\s+(.+)$/i.exec(arg)
  if (add) {
    const f = parseMyFestival(add[1]!)
    if (!f) return 'Give a date and a name: /pet festivals add 11-20 Teachers\' Day (or 2026-11-20 Teachers\' Day).'
    if (mine.length >= 12) return 'You have 12 days of your own already. /pet festivals remove <name> first.'
    await $.store.set('myFestivals', [...mine.filter(x => x.date !== f.date), f])
    await refreshCalendar($)
    return `Added ${f.title} on ${f.date} every year: confetti in the band that day.`
  }
  const remove = /^(remove|rm|delete)\s+(.+)$/i.exec(arg)
  if (remove) {
    const what = remove[2]!.trim().toLowerCase()
    const left = mine.filter(x => x.title.toLowerCase() !== what && x.date !== what)
    if (left.length === mine.length) return `No day of your own called "${remove[2]!.trim()}". ${mine.map(x => `${x.title} (${x.date})`).join(' · ') || 'You have none.'}`
    await $.store.set('myFestivals', left)
    await refreshCalendar($)
    return `Removed ${mine.filter(x => !left.includes(x)).map(x => x.title).join(', ')}.`
  }
  await refreshCalendar($)
  const today = dayOf(await $.clock.now())
  const now = petSim.festival
  const w = await readWallet($)
  return [
    now ? `Today: ${now.title}! ${now.line.toLowerCase()}` : 'No festival today.',
    `Coming up: ${upcomingFestivals(today, mine).map(([t, d]) => `${t} ${d}`).join(' · ')}`,
    `Your own days: ${mine.length ? mine.map(x => `${x.title} (${x.date})`).join(' · ') : 'none yet'}`,
    `Keepsakes ${KEEPSAKES.filter(id => w.owned.includes(id)).length}/${KEEPSAKES.length}: one comes the first time you see each festival`,
    'Tết and Mid-Autumn follow the lunar calendar (worked out for each year).',
    '/pet festivals on|off · /pet festivals add 11-20 Teachers\' Day · /pet festivals remove <name>',
  ].join('\n')
}

// ── Chatter (E8-S05): now and then, a line from the pet (opt-in) ────────────
// A small model writes it from a summary of the turn built here: how long it took,
// how many edits, commands and tests ran. No file, path, command, prompt or answer
// text is ever sent. It shows in the HUD and is never added to the conversation.
export const CHATTER_EVERY_MS = 20 * 60_000
const CHATTER_SHOW_MS = 9000
type TurnLog = { counts: Record<string, number>; failed: number; tests: { passed: number; failed: number } | null }
const turnLog: TurnLog = { counts: {}, failed: 0, tests: null }
let lastChatAt = 0

/** A tool's kind for the summary: never its input. */
export function toolKind(tool: string): string {
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) return 'edits'
  if (/^(Bash|PowerShell)$/.test(tool)) return 'commands'
  if (/^(Read|Glob|Grep|LS)$/.test(tool)) return 'file reads'
  if (/^Web/.test(tool)) return 'web lookups'
  if (/^(Agent|Task)$/.test(tool)) return 'helpers'
  if (tool.startsWith('mcp__')) return 'connector calls'
  return 'other steps'
}

const partOfDay = (ms: number) => {
  const h = new Date(ms).getHours()
  return h < 5 ? 'late at night' : h < 12 ? 'in the morning' : h < 18 ? 'in the afternoon' : h < 22 ? 'in the evening' : 'late at night'
}

/** What the model is told about the turn: counts and the pet's state only. */
export function turnSummary(t: TurnLog, durationMs: number, mood: Mood, at: number, isError: boolean): string {
  const counts = Object.entries(t.counts).map(([k, n]) => `${n} ${k}`).join(', ')
  return [
    `A turn of ${durationMs < 60_000 ? `${Math.max(1, Math.round(durationMs / 1000))} seconds` : `${Math.round(durationMs / 60_000)} minutes`} ${partOfDay(at)}${isError ? ' that ended in an error' : ''}.`,
    counts ? `Steps: ${counts}${t.failed ? ` (${t.failed} failed)` : ''}.` : 'No tools used, just talk.',
    t.tests ? `Tests: ${t.tests.passed} passed, ${t.tests.failed} failed.` : '',
    `The pet's mood: ${mood}.`,
  ].filter(Boolean).join(' ')
}

async function chatter($: EngineInterface, summary: string) {
  const pet = await readPet($)
  const r = await $.model.complete({
    model: 'haiku',
    system: `You are ${pet.name}, a small pixel ${pet.kind} who lives in a developer's terminal. Reply with one short, warm, playful line (at most 60 characters) about what just happened. No quotes, emoji or hashtags.`,
    prompt: `What just happened: ${summary}`,
    maxTokens: 40,
    effort: 'low',
    timeoutMs: 10_000,
  }).catch(() => null)
  if (!r?.isAnswered) return
  const line = r.text.split('\n')[0]!.replace(/^["'“”\s]+|["'“”\s]+$/g, '').slice(0, 70)
  if (line) petReact('"', 'info', CHATTER_SHOW_MS, await $.clock.now(), false, { text: `SAYS: ${line}` })
}

/** After a main turn: a line, if chatter is on and the last was long enough ago. */
async function maybeChatter($: EngineInterface, durationMs: number, isError: boolean) {
  if ((await $.store.get('chatter')) !== true) return
  const now = await $.clock.now()
  const last = await $.store.get('lastChatAt')
  if (now - Math.max(lastChatAt, typeof last === 'number' ? last : 0) < CHATTER_EVERY_MS) return
  lastChatAt = now
  await $.store.set('lastChatAt', now)
  void chatter($, turnSummary(turnLog, durationMs, petSim.mood, now, isError))
}

const LONG_TOOL_MS = 60_000
const VISIT_MS = 60_000
const PUSH_RE = /\bgit\s+push\b/
const COMMIT_RE = /\bgit\s+(-C\s+\S+\s+)?commit\b/
const CONFLICT_RE = /CONFLICT \(|Automatic merge failed|could not apply [0-9a-f]+|Unmerged paths/
const SETTLE_RE = /\bgit\s+(commit|status|merge\s+--(continue|abort)|rebase\s+--(continue|abort|skip)|cherry-pick\s+--(continue|abort))\b/

// ── The diary (E7-S03): one day of play, kept on this machine ───────────────
export type Diary = {
  day: string
  xp: number; coins: number; bugs: number; helpers: number; turns: number; runnerXp: number; visits: number; focus: number
  green: number; red: number
  stories: string[]
}
const freshDiary = (day: string): Diary => ({ day, xp: 0, coins: 0, bugs: 0, helpers: 0, turns: 0, runnerXp: 0, visits: 0, focus: 0, green: 0, red: 0, stories: [] })

async function readDiary($: EngineInterface): Promise<Diary> {
  const today = dayOf(await $.clock.now())
  const d = (await $.store.get('diary')) as Diary | undefined
  return d && d.day === today ? { ...freshDiary(today), ...d } : freshDiary(today)
}

async function bumpDiary($: EngineInterface, change: (d: Diary) => void) {
  const d = await readDiary($)
  change(d)
  await $.store.set('diary', d)
}

export function diaryText(d: Diary, pet: { kind: PetKind; name: string }, wx: Weather | null, unit: TempUnit): string {
  const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`
  return [
    `${pet.name.toUpperCase()}'S DIARY · ${d.day}`,
    `Dear diary, today I collected ◆${d.coins}, squashed ${n(d.bugs, 'bug')} and earned ${d.xp} XP.`,
    `Tests: ${d.green} green, ${d.red} red · Helpers home: ${d.helpers} · Turns: ${d.turns} · Runner: ${d.runnerXp} XP · Visits: ${d.visits} · Focus rounds: ${d.focus}`,
    d.stories.length ? `Worked on: ${d.stories.join(', ')}` : 'Worked on: no tracked story',
    wx ? `Weather: ${wx.place}, ${fmtTemp(wx.tempC, unit)}, ${wx.label.toLowerCase()}.` : '',
  ].filter(Boolean).join('\n')
}

/** The diary as an SVG card: the pet, then the day's lines. */
export function diarySvg(text: string, pet: { kind: PetKind }, level: number, items: ItemId[], C: Palette, skin: SkinId | null = null): string {
  const lines = text.split('\n')
  const w = 640, h = 44 + lines.length * 20
  const art = vectorPet({ kind: pet.kind, stage: stageOf(level), pose: 'sit', mood: 'happy', items, skin, dir: 1, isBlinking: false })
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="8" fill="${C.bg}" stroke="${C.dim}" stroke-width="2"/>`,
    `<g transform="translate(18 ${h / 2 - 40}) scale(7)">${art.svg}</g>`,
    `<g font-family="${SVG_FONT}" font-size="13">`,
    ...lines.map((l, i) => `<text x="112" y="${30 + i * 20}" fill="${i === 0 ? C.hi : i === 1 ? C.fg : C.dim}"${i === 0 ? ' font-weight="bold"' : ''}>${esc(l)}</text>`),
    '</g></svg>',
  ].join('')
}

// ── Profile, pet board, streaks and achievements (E3) ───────────────────────
/**
 * Reads the profile. The first time, it starts from the XP the current pet already
 * had, less `pending`: XP just gained that the caller is about to record itself.
 */
async function readProfile($: EngineInterface, pending = 0): Promise<Profile> {
  const v = await $.store.get('profile')
  if (v && typeof v === 'object' && 'totals' in (v as object)) return v as Profile
  await loadXp($)
  const p = freshProfile(dayOf(await $.clock.now()))
  const pet = await readPet($)
  const earlier = Math.max(0, petSim.xp - pending)
  if (earlier > 0) {
    p.totals.xp = earlier
    p.byKind[pet.kind] = earlier
  }
  return p
}

/**
 * Applies one change to the profile as it is in the store right now, so several
 * open sessions add up rather than overwrite one another (E3-S01).
 */
async function bumpProfile($: EngineInterface, change: (p: Profile) => void, pending = 0): Promise<Profile> {
  const p = await readProfile($, pending)
  change(p)
  await $.store.set('profile', p)
  return p
}

async function recordXp($: EngineInterface, n: number, why: XpReason, count: number, level: number) {
  const pet = await readPet($)
  const today = dayOf(await $.clock.now())
  await bumpDiary($, d => {
    d.xp += n
    if (why === 'coin') d.coins += count
    if (why === 'bug') d.bugs += count
    if (why === 'helper') d.helpers += 1
    if (why === 'turn') d.turns += 1
    if (why === 'game') d.runnerXp += n
    if (why === 'visit') d.visits += 1
    if (why === 'focus') d.focus += 1
  })
  const p = await bumpProfile($, prof => {
    prof.totals.xp += n
    prof.byKind[pet.kind] = (prof.byKind[pet.kind] ?? 0) + n
    const counter = COUNTER[why]
    if (counter) prof.totals[counter] += why === 'coin' || why === 'bug' ? count : 1
    if (why === 'turn') prof.streak = nextStreak(prof.streak, today)
    if (why === 'focus') workOf(prof).focus++
  }, n)
  await unlockAchievements($, p, level)
}

/** Real work (E13-S01): a test run, a commit. Counted in the profile, and it can earn achievements. */
async function recordWork($: EngineInterface, change: (w: Work) => void) {
  await loadXp($)
  const p = await bumpProfile($, prof => change(workOf(prof)))
  await unlockAchievements($, p, levelOf(petSim.xp))
}

/** Achievements unlock once each, with a notice and a blind box. */
async function unlockAchievements($: EngineInterface, p: Profile, level: number) {
  const fresh = ACHIEVEMENTS.filter(a => !p.badges.includes(a.id) && a.earned(p, level))
  if (fresh.length) {
    await bumpProfile($, prof => {
      for (const a of fresh) if (!prof.badges.includes(a.id)) prof.badges.push(a.id)
    })
    for (const a of fresh) $.ui.toast(`▶ ACHIEVEMENT: ${a.title}`, { timeoutMs: 7000 })
    await earnBox($, fresh.length, fresh.length === 1 ? 'AN ACHIEVEMENT' : 'ACHIEVEMENTS')
    petReact('★', 'warn', 2500, await $.clock.now(), true)
    void petVoice($)
  }
}

/** The player's name: the setting, else git's user.name, else the OS user. */
async function playerName($: EngineInterface): Promise<string> {
  if (CFG.playerName) return CFG.playerName
  try {
    const g = await $.process.run(['git', 'config', 'user.name'])
    if (g.exitCode === 0 && g.stdout.trim()) return g.stdout.trim()
  } catch {
    // no git
  }
  try {
    return (await $.env.get('USERNAME')) ?? (await $.env.get('USER')) ?? 'PLAYER'
  } catch {
    return 'PLAYER'
  }
}

/** /pet board: the pets you have raised, ranked, and your record under them (E3-S02, E3-S03). */
export function boardText(p: Profile, name: string, current: { kind: PetKind; name: string }): string {
  const ranked = Object.entries(p.byKind).sort((a, b) => b[1] - a[1])
  if (!ranked.some(([k]) => k === current.kind)) ranked.push([current.kind, 0])
  const rows = ranked.map(([kind, xp], i) => {
    const isCur = kind === current.kind
    const who = isCur ? `${current.name} the ${kind}` : kind
    return ` ${String(i + 1).padStart(2)}. ${isCur ? '★' : ' '} ${PETS[kind as PetKind]?.emoji ?? '?'} ${who.padEnd(24)} LV${String(levelOf(xp)).padEnd(3)} ${String(xp).padStart(6)} XP${isCur ? '  ← now' : ''}`
  })
  const t = p.totals
  const got = ACHIEVEMENTS.filter(a => p.badges.includes(a.id))
  const locked = ACHIEVEMENTS.filter(a => !p.badges.includes(a.id))
  return [
    `PET BOARD · ${name} · playing since ${p.since}`,
    ...rows,
    '',
    `Lifetime: ${t.xp} XP · ${t.coins} coins · ${t.bugs} bugs squashed · ${t.helpers} helpers home · ${t.green} green test runs · ${t.turns} turns`,
    `Streak: ${p.streak.days} day${p.streak.days === 1 ? '' : 's'} (best ${p.streak.best})`,
    ...(p.work ? [`Work: ${p.work.commits} commits · best ${p.work.bestGreenRun} green runs in a row · ${p.work.fixes} red runs turned green · ${p.work.focus} focus rounds`] : []),
    `Achievements ${got.length}/${ACHIEVEMENTS.length}: ${got.map(a => a.title).join(' · ') || 'none yet'}`,
    locked.length ? `Still to earn: ${locked.map(a => `${a.title} (${a.hint})`).join(' · ')}` : 'All achievements earned!',
  ].join('\n')
}

// ── Shared leaderboard (E4): opt-in, via the service in server/ ─────────────
type BoardLink = { url: string; login: string; apiKey: string }
type WorldRow = { rank: number; login: string; level: number; xp: number; favPet: string; streak: number; bestStreak: number }
const SYNC_GAP_MS = 60_000
const boardSync = { lastAt: 0, isOff: false, isJoining: false }

async function readLink($: EngineInterface): Promise<BoardLink | null> {
  const v = (await $.store.get('board')) as Partial<BoardLink> | null | undefined
  return v && typeof v.apiKey === 'string' && typeof v.url === 'string' && typeof v.login === 'string' ? (v as BoardLink) : null
}

const boardReady = () => Boolean(CFG.leaderboardUrl && CFG.githubClientId)
const NOT_SET_UP = 'No shared leaderboard is set up for this plugin (the leaderboardUrl and githubClientId settings), so nothing is sent. server/README.md shows how to run one.'

/** The profile as the board sees it: lifetime XP and level, the favourite pet, the streak. */
async function boardScore($: EngineInterface) {
  const p = await readProfile($)
  const fav = Object.entries(p.byKind).sort((a, b) => b[1] - a[1])[0]?.[0] ?? (await readPet($)).kind
  return { xp: p.totals.xp, level: levelOf(p.totals.xp), favPet: fav, streak: p.streak.days, bestStreak: Math.max(p.streak.best, p.streak.days) }
}

/** What the badge and visitors see (E7): what the pet wears and the theme's colours. */
async function boardLook($: EngineInterface) {
  const C = paletteOf(await read($, theme))
  return { wearing: petSim.wearing, fg: C.fg, bg: C.bg, skin: petSim.skin }
}

/** Sends a joined player's score, at most once a minute; a refusal stops it for the session (E4-S03). */
async function syncScore($: EngineInterface, force = false) {
  const link = await readLink($)
  if (!link || boardSync.isOff) return
  const now = await $.clock.now()
  if (!force && now - boardSync.lastAt < SYNC_GAP_MS) return
  boardSync.lastAt = now
  try {
    const r = await $.http.fetch(`${link.url}/v1/score`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${link.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ...(await boardScore($)), look: await boardLook($) }),
    })
    if (r.ok) {
      // friends who visited since the last score (E7-S02)
      const d = JSON.parse(r.text || '{}') as { visitors?: { login: string; favPet: string }[] }
      const pet = await readPet($)
      for (const v of (d.visitors ?? []).slice(0, 5)) {
        $.ui.toast(`▶ ${v.login.toUpperCase()}'S ${v.favPet.toUpperCase()} VISITED ${pet.name.toUpperCase()} · +5 XP`, { timeoutMs: 7000 })
        await gainXp($, 5, 'visit')
      }
      if (d.visitors?.length) await saveXp($)
    }
    if (r.status === 401) {
      await $.store.set('board', null)
      $.ui.toast('▶ THE BOARD NO LONGER KNOWS THIS KEY · /pet join TO REJOIN', { timeoutMs: 8000 })
    } else if (r.status === 400 || r.status === 422) {
      boardSync.isOff = true
      $.ui.log(`pixel-pets: the board refused this score (${r.text.slice(0, 160)}); not sending again this session`)
    }
  } catch {
    // offline: try again after the next turn
  }
}

type DeviceCode = { device_code: string; user_code: string; verification_uri: string; interval: number; expires_in: number }

/** Polls GitHub until the person approves the code, then joins the board with the token (E4-S02). */
async function pollDevice($: EngineInterface, flow: DeviceCode, until: number, intervalMs: number) {
  const now = await $.clock.now()
  if (now > until) {
    boardSync.isJoining = false
    $.ui.toast('▶ THE GITHUB CODE EXPIRED · /pet join TO TRY AGAIN', { timeoutMs: 8000 })
    return
  }
  let next = intervalMs
  try {
    const r = await $.http.fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
      body: `client_id=${encodeURIComponent(CFG.githubClientId)}&device_code=${encodeURIComponent(flow.device_code)}&grant_type=urn:ietf:params:oauth:grant-type:device_code`,
    })
    const d = JSON.parse(r.text) as { access_token?: string; error?: string; interval?: number }
    if (d.access_token) {
      const joined = await $.http.fetch(`${CFG.leaderboardUrl}/v1/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ githubToken: d.access_token }),
      })
      boardSync.isJoining = false
      // the GitHub token goes no further than this: only the board's own key is kept
      if (!joined.ok) {
        $.ui.toast(`▶ THE BOARD REFUSED THE SIGN-IN (${joined.status})`, { timeoutMs: 8000 })
        return
      }
      const j = JSON.parse(joined.text) as { login: string; apiKey: string }
      await $.store.set('board', { url: CFG.leaderboardUrl, login: j.login, apiKey: j.apiKey })
      boardSync.isOff = false
      $.ui.toast(`▶ JOINED THE BOARD AS ${j.login.toUpperCase()} · /pet board world`, { timeoutMs: 8000 })
      void petVoice($)
      await syncScore($, true)
      return
    }
    if (d.error === 'access_denied' || d.error === 'expired_token') {
      boardSync.isJoining = false
      $.ui.toast(d.error === 'access_denied' ? '▶ SIGN-IN CANCELLED · NOTHING WAS SHARED' : '▶ THE GITHUB CODE EXPIRED', { timeoutMs: 8000 })
      return
    }
    if (d.error === 'slow_down') next = intervalMs + 5000
  } catch {
    // a network blip: keep polling until the code expires
  }
  $.clock.after(next, () => void pollDevice($, flow, until, next))
}

/** /pet board world: the top 20, and my own rank under them when I'm further down (E4-S04). */
export function worldText(top: WorldRow[], me: WorldRow | null, joinedAs: string | null): string {
  const row = (r: WorldRow) => {
    const mine = joinedAs !== null && r.login === joinedAs
    return ` ${String(r.rank).padStart(3)}. ${mine ? '★' : ' '} ${r.login.padEnd(20)} LV${String(r.level).padEnd(3)} ${String(r.xp).padStart(7)} XP  ${PETS[r.favPet as PetKind]?.emoji ?? '?'}  ${r.streak}-day streak`
  }
  const lines = ['WORLD BOARD', ...(top.length ? top.map(row) : ['   nobody has scored yet'])]
  if (me && !top.some(r => r.login === me.login)) lines.push('   …', row(me))
  if (!joinedAs) lines.push('', '/pet join puts you on it (GitHub sign-in; only name, level, XP, favourite pet and streak are shared).')
  return lines.join('\n')
}

/** The plan's fuller window drives the mood; a worse mood is announced once, in its voice. */
async function setLimit($: EngineInterface, u: Usage) {
  const windows = [
    u.fiveHour && { label: '5H', ...u.fiveHour },
    u.week && { label: 'WEEK', ...u.week },
  ].filter((w): w is { label: string; percent: number; resetsAt: string | null } => Boolean(w))
  const worst = windows.sort((a, b) => b.percent - a.percent)[0]
  const s = petSim
  s.limit = worst ? worst.percent : null
  s.limitLabel = worst ? `${worst.label} ${Math.round(worst.percent)}%` : ''
  s.resetText = worst ? fmtReset(worst.resetsAt, await $.clock.now()) : ''
  const was = s.mood
  s.mood = moodOf(s.limit)
  const rank: Record<Mood, number> = { happy: 0, grumpy: 1, furious: 2, gameover: 3 }
  if (rank[s.mood] > rank[was]) {
    const pet = await readPet($)
    const name = pet.name.toUpperCase()
    const msg = {
      happy: '',
      grumpy: `▶ ${name} IS GRUMPY · ${s.limitLabel} USED`,
      furious: `▶ ${name} IS FURIOUS · ${s.limitLabel} USED${s.resetText ? ` · RESETS IN ${s.resetText}` : ''}`,
      gameover: `▶ GAME OVER · ${s.limitLabel}${s.resetText ? ` · CONTINUE IN ${s.resetText}` : ''}`,
    }[s.mood]
    $.ui.toast(msg, { timeoutMs: 8000 })
    void petVoice($)
  }
}

async function openPetPane($: EngineInterface) {
  const pet = await readPet($)
  return $.ui.open({ id: PET_PANE, title: `CLAUDE PETS · ${pet.name.toUpperCase()}` })
}

/** Fits the game to a new width, keeping the pet on screen. */
function sizeSim(columns: number) {
  petSim.columns = columns
  if (petSim.x > columns - petW()) petSim.x = columns - petW()
}

/** A frame of the pet sitting, drawn before the first tick has run. */
function stillFrame(pet: { kind: PetKind; name: string }, C: Palette, columns: number): PetFrame {
  const name = pet.name.toUpperCase()
  return {
    kind: pet.kind, columns, x: petSim.x, dir: petSim.dir, pose: 'sit', mood: petSim.mood, lift: 0,
    bubble: null, ballX: petSim.ballX, coins: petSim.coins, bugs: petSim.bugs, sparkle: false,
    bg: C.bg, ground: C.dim, cursor: null,
    hud: hud(C, name, petSim.line || `${name} THE ${pet.kind.toUpperCase()}`),
    stage: stageOf(levelOf(petSim.xp)), items: worn(), hd: petSim.hd, skin: petSim.skin, festival: petSim.festival?.id ?? null,
  }
}

/** The SVG to draw on a remote surface: the latest frame, or a still one until the game ticks. */
function remoteArt(art: string, pet: { kind: PetKind; name: string }, C: Palette, columns: number): string {
  // a terminal on the same session sets the width; otherwise this surface does
  if (!petSim.isMounted && petSim.columns !== Math.max(petW() + 2, columns)) {
    sizeSim(Math.max(petW() + 2, columns))
    petSim.lastArt = ''
  }
  return art || petSvg(stillFrame(pet, C, petSim.columns))
}

function hud(C: Palette, name: string, line: string): HudSegment[] {
  const s = petSim
  const hearts = s.limit === null ? 5 : Math.max(0, Math.min(5, Math.ceil((100 - s.limit) / 20)))
  return [
    { text: '♥'.repeat(hearts), color: hex(C.fail) },
    { text: '♡'.repeat(5 - hearts), color: hex(C.dim) },
    { text: ` LV${levelOf(s.xp)}`, color: hex(C.hi) },
    { text: ` XP ${String(s.xp).padStart(3, '0')}`, color: hex(C.fg) },
    { text: ` ◆${s.collected}`, color: hex(C.warn) },
    { text: ` · ${line || name}`, color: hex(s.mood === 'happy' ? C.dim : s.mood === 'grumpy' ? C.warn : C.fail) },
  ]
}

/** The idle line on a birthday or a festival day, else null. */
function seasonLine(name: string): string | null {
  if (petSim.birthday) return `${name} TURNS ${petSim.birthday} TODAY · HAPPY BIRTHDAY!`
  return petSim.festival ? `${name} ${petSim.festival.line}` : null
}

async function petTick($: EngineInterface) {
  const s = petSim
  const isRemote = s.remote.band || s.remote.pane
  if ((!s.isMounted && !isRemote) || s.columns < petW() + 2) return
  const now = await $.clock.now()
  if (s.lastActive === 0) s.lastActive = now
  await loadXp($)
  const [pet, themeName] = await Promise.all([readPet($), read($, theme)])
  const C = paletteOf(themeName)
  const name = pet.name.toUpperCase()
  s.tick++
  if (s.react && s.react.until < now) s.react = null
  const maxX = s.columns - petW()
  const sparkle = s.tick % 6 < 3

  // bugs crawl
  for (const b of s.bugs) {
    if (s.tick % 3 === 0) b.x += 0.5 * b.dir
    if (b.x <= 0 || b.x >= s.columns - 2) b.dir = b.dir === 1 ? -1 : 1
  }
  const nearestBug = s.bugs.slice().sort((a, b) => Math.abs(a.x - s.x) - Math.abs(b.x - s.x))[0]
  const nearestCoin = s.coins.slice().sort((a, b) => Math.abs(a - s.x) - Math.abs(b - s.x))[0]

  let pose: Pose = 'sit', lift = 0, speed = 0, line: string, flame = false
  let bubble: PetFrame['bubble'] = null
  const walk = (every: number) => (Math.floor(s.tick / every) % 2 ? 'walkA' : 'walkB') as Pose
  const face = (target: number) => {
    s.dir = target > s.x + petW() / 2 ? 1 : -1
  }

  if (s.opening && now >= s.opening.until) s.opening = null
  const op = s.opening
  if (op) {
    // a blind box: the pet sits by it while it shakes, then jumps for joy at the find
    const isOpen = now >= op.openAt
    face(op.x)
    lift = isOpen && s.tick % 4 < 2 ? 1 : 0
    bubble = isOpen ? { glyph: '★', color: hex(C.warn) } : s.tick % 6 < 3 ? { glyph: '?', color: hex(C.info) } : null
    line = isOpen ? `${name} FOUND ${op.label}` : `${name} OPENS A BLIND BOX…`
  } else if (s.mood === 'gameover') {
    pose = 'sleep'
    bubble = { glyph: s.tick % 16 < 8 ? 'x' : 'X', color: hex(C.fail) }
    line = `GAME OVER${s.resetText ? ` · CONTINUE IN ${s.resetText}` : ''}`
  } else if (s.ballX !== null) {
    speed = 1.1
    face(s.ballX)
    pose = walk(1)
    line = `${name} CHASES THE BALL`
    const mouth = s.x + (s.dir === 1 ? petW() - 2 : 0)
    if (Math.abs(s.ballX - mouth) < 1.5) {
      s.ballX = null
      petReact('♥', 'fail', 2500, now, true)
      void gainXp($, 2, 'ball')
    }
  } else if (s.react) {
    lift = s.react.jump && s.tick % 4 < 2 ? 1 : 0
    bubble = { glyph: s.react.glyph, color: hex(C[s.react.tone]) }
    line = s.react.text ? `${name} ${s.react.text}`
      : s.react.glyph === '♥' ? `${name} IS HAPPY`
      : s.react.glyph === '★' ? `${name} LEVELLED UP`
      : s.react.glyph === '*' ? `${name} SQUASHED A BUG`
      : `${name} SAW AN ERROR`
    if (s.react.kind === 'dance') {
      pose = walk(1)
      if (s.tick % 3 === 0) s.dir = s.dir === 1 ? -1 : 1
    }
    if (s.react.kind === 'rocket') {
      lift = 1
      flame = true
    }
    if (s.react.kind === 'stretch') {
      lift = s.tick % 16 < 8 ? 1 : 0
      pose = s.tick % 32 < 16 ? 'sit' : walk(4)
    }
  } else if (s.toolSince !== null && now - s.toolSince > LONG_TOOL_MS) {
    pose = 'sleep'
    bubble = { glyph: ['.', ':', '⁝'][Math.floor(s.tick / 6) % 3] ?? '.', color: hex(C.dim) }
    line = `${name} NAPS WHILE ${s.toolName.toUpperCase()} RUNS · ${fmtDuration(now - s.toolSince)}`
  } else if (s.isConflict) {
    bubble = { glyph: '?', color: hex(C.warn) }
    line = `${name} IS PUZZLED BY A MERGE CONFLICT`
  } else if (s.focus && !s.isWorking && s.focus.phase === 'focus') {
    // on guard: sits facing out, glancing round now and then
    if (s.tick % 60 === 0) s.dir = s.dir === 1 ? -1 : 1
    bubble = s.tick % 40 < 6 ? { glyph: '!', color: hex(C.info) } : null
    line = `${name} GUARDS YOUR FOCUS · ${mmss(s.focus.endsAt - now)}`
  } else if (s.focus && !s.isWorking) {
    // a break: stretches up and down
    lift = s.tick % 16 < 8 ? 1 : 0
    pose = s.tick % 32 < 16 ? 'sit' : walk(4)
    line = `${name} STRETCHES · BREAK ${mmss(s.focus.endsAt - now)} · STAND UP, DRINK SOME WATER`
  } else if (nearestBug && !s.isWorking) {
    speed = s.mood === 'happy' ? 0.8 : 1.0
    face(nearestBug.x)
    pose = walk(1)
    line = `${name} HUNTS A BUG`
  } else if (s.isWorking) {
    speed = s.mood === 'happy' ? 0.9 : 0.5
    pose = walk(s.mood === 'happy' ? 1 : 2)
    line = s.mood === 'happy' ? `${name} IS HELPING…` : `${name} WORKS, GRUDGINGLY · ${s.limitLabel}`
  } else if (s.mood === 'furious') {
    // sits fuming, hissing now and then
    pose = s.tick % 40 < 30 ? 'sit' : walk(1)
    lift = s.tick % 40 >= 36 ? 1 : 0
    bubble = { glyph: s.tick % 8 < 4 ? '#' : '!', color: hex(C.fail) }
    line = `${name} IS FURIOUS · ${s.limitLabel}${s.resetText ? ` · ↻${s.resetText}` : ''}`
  } else if (now - s.lastActive > 120_000) {
    pose = 'sleep'
    bubble = { glyph: s.tick % 16 < 8 ? 'z' : 'Z', color: hex(C.dim) }
    line = `${name} IS NAPPING`
  } else if (s.wx && (s.wx.kind === 'rain' || s.wx.kind === 'storm')) {
    // shelters: sits still, glancing up now and then
    bubble = s.tick % 24 < 4 ? { glyph: '☂', color: hex(C.info) } : null
    line = `${name} SHELTERS FROM THE ${s.wx.kind === 'storm' ? 'STORM' : 'RAIN'}`
  } else if (s.wx && s.wx.kind === 'clear' && s.wx.isDay && s.wx.tempC >= 28 && now < s.sitUntil + 20_000) {
    pose = 'sleep'
    line = `${name} BASKS IN THE SUN · ${fmtTemp(s.wx.tempC, CFG.temperatureUnit)}`
  } else if (now < s.sitUntil) {
    line = s.mood === 'grumpy' ? `${name} SULKS · ${s.limitLabel}` : `${name} SITS`
    if (s.mood === 'happy') line = seasonLine(name) ?? line
    if (s.mood === 'grumpy' && s.tick % 30 < 6) bubble = { glyph: '#', color: hex(C.warn) }
  } else {
    // wanders, heading for coins; a grumpy pet stomps along slower
    speed = s.mood === 'grumpy' ? 0.2 : 0.35
    pose = walk(s.mood === 'grumpy' ? 4 : 3)
    if (nearestCoin !== undefined) face(nearestCoin)
    line = s.mood === 'grumpy' ? `${name} IS GRUMPY · ${s.limitLabel}` : nearestCoin !== undefined ? `${name} GOES FOR A COIN` : `${name} WANDERS`
    if (s.wx?.kind === 'snow' && s.mood === 'happy') {
      speed = 0.55
      lift = s.tick % 10 < 2 ? 1 : 0
      line = `${name} PLAYS IN THE SNOW`
    }
    if (s.mood === 'happy') line = seasonLine(name) ?? line
    if (s.mood === 'grumpy' && s.tick % 30 < 6) bubble = { glyph: '#', color: hex(C.warn) }
    if (Math.random() < (s.mood === 'grumpy' ? 0.012 : 0.006)) s.sitUntil = now + 3000 + Math.random() * 4000
    if (nearestCoin === undefined && Math.random() < 0.004) s.dir = s.dir === 1 ? -1 : 1
  }

  s.x += speed * s.dir
  // strong wind pushes the pet along (E2-S04)
  if (s.wx && s.wx.windKmh >= WINDY_KMH && pose !== 'sleep') s.x += 0.12
  if (s.x <= 0) { s.x = 0; s.dir = 1 }
  if (s.x >= maxX) { s.x = maxX; s.dir = -1 }

  // helpers: bustle while their subagent works, run home when it is done
  for (const k of [...s.kids]) {
    if (k.state === 'work' && now - k.bornAt > KID_STALE_MS) {
      k.state = 'home'
      k.doneAt = now
    }
    if (k.state === 'work') {
      if (Math.random() < 0.04) k.dir = k.dir === 1 ? -1 : 1
      k.x += 0.5 * k.dir
    } else {
      k.dir = s.x + petW() / 2 > k.x + KID_W / 2 ? 1 : -1
      k.x += 1.3 * k.dir
      if (Math.abs(k.x + KID_W / 2 - (s.x + petW() / 2)) < 3 || now - k.doneAt > 8000) await bringHome($, k)
    }
    if (k.x <= 0) { k.x = 0; k.dir = 1 }
    if (k.x >= s.columns - KID_W) { k.x = s.columns - KID_W; k.dir = -1 }
  }
  const working = s.kids.filter(k => k.state === 'work').length
  if (working && !s.react && s.mood !== 'gameover') line = `${line} · ${working} HELPER${working === 1 ? '' : 'S'} OUT`

  // a visiting pet walks up to ours, and they play until the minute is up (E7-S02)
  if (s.guest && now > s.guest.until) s.guest = null
  const g = s.guest
  if (g) {
    const side = g.x > s.x ? 1 : -1
    const target = s.x + side * (petW() + 2)
    if (Math.abs(g.x - target) > 1) {
      g.dir = target > g.x ? 1 : -1
      g.x += 0.6 * g.dir
      g.pose = walk(1)
    } else {
      g.dir = s.x > g.x ? 1 : -1
      g.pose = s.tick % 20 < 10 ? 'sit' : walk(2)
      if (!s.react && s.mood !== 'gameover' && s.tick % 20 < 6) bubble = { glyph: '♥', color: hex(C.fail) }
    }
    g.x = Math.max(0, Math.min(s.columns - petW(), g.x))
    if (!s.react && s.mood !== 'gameover') line = `${name} PLAYS WITH ${g.login.toUpperCase()}'S ${g.kind.toUpperCase()}`
  }

  // pick-ups and stomps
  const left = s.x - 0.5, right = s.x + petW() - 0.5
  const kept = s.coins.filter(c => c < left || c > right)
  if (kept.length < s.coins.length) {
    const got = s.coins.length - kept.length
    s.coins = kept
    s.collected += got
    void gainXp($, got, 'coin', got)
  }
  const alive = s.bugs.filter(b => b.x + 1 < left || b.x > right)
  if (alive.length < s.bugs.length) {
    const squashed = s.bugs.length - alive.length
    s.bugs = alive
    petReact('*', 'warn', 900, now, true)
    void gainXp($, 5 * squashed, 'bug', squashed)
  }

  const frame: PetFrame = {
    sky: s.wx ? { kind: s.wx.kind, isDay: s.wx.isDay, windy: s.wx.windKmh >= WINDY_KMH, dir: 1 } : null, tick: s.tick,
    kind: pet.kind, columns: s.columns, x: s.x, dir: s.dir, pose, mood: s.mood, lift, bubble,
    ballX: s.ballX, coins: s.coins, bugs: s.bugs, sparkle, bg: C.bg, ground: C.dim,
    kids: s.kids.slice(0, KID_MAX_SHOWN).map(k => ({
      x: k.x, dir: k.dir, pose: (s.tick + k.n) % 2 ? 'walkA' : 'walkB',
      tag: now < k.flashUntil ? '◆' : k.state === 'home' ? '♥' : String(k.n % 10),
      tagColor: hex(now < k.flashUntil ? C.warn : k.state === 'home' ? C.fail : C.info),
    })),
    cursor: !s.isWorking && s.tick % 8 < 4 ? { color: hex(C.fg) } : null,
    hud: hud(C, name, line),
    stage: stageOf(levelOf(s.xp)), items: worn(), flame, hd: s.hd, skin: s.skin, festival: s.festival?.id ?? null,
    box: op ? { x: op.x, isOpen: now >= op.openAt, shake: now < op.openAt ? s.tick : 0 } : null,
    guest: s.guest ? { kind: s.guest.kind, x: s.guest.x, dir: s.guest.dir, pose: s.guest.pose, stage: stageOf(s.guest.level), items: s.guest.wearing } : undefined,
  }
  if (s.isMounted) {
    const cells = petCells(frame)
    s.lastCells = cells
    const shown = await $.ui.blit({ requestId: s.requestId, key: 'pet', cells, columns: s.columns, rows: stripRows(s.hd) })
    if (shown.deny !== undefined) s.isMounted = false
  }
  // remote surfaces redraw the whole tree, so they get a frame every 4 ticks (~0.5 s), and only when it changed
  if (isRemote && s.tick % SVG_EVERY === 0) {
    const art = petSvg(frame)
    if (art !== s.lastArt) {
      s.lastArt = art
      await update($, petArt, () => art)
    }
  }
  if (line !== s.line) {
    s.line = line
    await update($, petLine, () => line)
  }
}

// ── Helpers: a pet per subagent ─────────────────────────────────────────────
type Kid = {
  agentId: string
  n: number
  label: string
  x: number
  dir: 1 | -1
  xp: number
  state: 'work' | 'home'
  bornAt: number
  doneAt: number
  flashUntil: number
}
const KID_BONUS = 5
const KID_MAX_SHOWN = 4
const KID_STALE_MS = 30 * 60_000

/** A subagent started: a helper hatches beside the main pet. */
function spawnKid(agentId: string, label: string, now: number) {
  const s = petSim
  if (s.kids.some(k => k.agentId === agentId)) return
  s.kidSerial++
  const side = s.dir === 1 ? -KID_W - 1 : petW() + 1
  const x = Math.max(0, Math.min(Math.max(0, s.columns - KID_W), s.x + side))
  s.kids.push({
    agentId, n: s.kidSerial, label: label.replace(/\s+/g, ' ').trim().slice(0, 40), x, dir: s.dir === 1 ? -1 : 1,
    xp: 0, state: 'work', bornAt: now, doneAt: 0, flashUntil: 0,
  })
}

/** One of a subagent's tool calls worked: its helper earns the point. */
function creditKid(agentId: string, ok: boolean, now: number): boolean {
  const k = petSim.kids.find(x => x.agentId === agentId)
  if (!k) return false
  if (ok) {
    k.xp += 1
    k.flashUntil = now + 700
  }
  return true
}

/** A subagent's run ended: its helper heads home (straight home when nothing is drawn). */
async function kidDone($: EngineInterface, agentId: string, isOk: boolean) {
  const k = petSim.kids.find(x => x.agentId === agentId)
  if (!k || k.state === 'home') return
  k.state = 'home'
  k.doneAt = await $.clock.now()
  if (isOk) k.xp += KID_BONUS
  if (!petSim.isMounted) await bringHome($, k)
}

/** The helper reached the main pet: its score is handed over. */
async function bringHome($: EngineInterface, k: Kid) {
  const s = petSim
  if (!s.kids.includes(k)) return
  s.kids = s.kids.filter(x => x !== k)
  s.kidsHome++
  s.kidXp += k.xp
  await gainXp($, k.xp, 'helper')
  petReact('♥', 'fail', 1800, await $.clock.now(), true)
  $.ui.toast(`▶ HELPER #${k.n} IS HOME${k.label ? ` (${k.label})` : ''} · +${k.xp} XP`, { timeoutMs: 6000 })
}

async function throwBall($: EngineInterface) {
  const s = petSim
  const maxX = Math.max(petW(), s.columns - 3)
  // land it on the far side of the pet so there is a chase
  s.ballX = s.x < maxX / 2 ? maxX - Math.random() * (maxX / 3) : Math.random() * (maxX / 3)
  s.lastActive = await $.clock.now()
}

async function patPet($: EngineInterface) {
  const now = await $.clock.now()
  petSim.lastActive = now
  petReact(petSim.mood === 'happy' ? '♥' : '#', petSim.mood === 'happy' ? 'fail' : 'warn', 2500, now, petSim.mood === 'happy')
  void petVoice($)
}

// ── 1. Branch and worktree ──────────────────────────────────────────────────
/** The story's own scope: E12 for E12-S03, M1 for M1-14. */
export const storyScope = (id: string) => (id.split('-')[0] ?? '').toUpperCase()

/** The scope a branch names in the same shape (`feat/e64-s01` → E64 for an E-story), if any. */
export function branchScope(branch: string, scope: string): string | null {
  const letters = /^[A-Z]+/i.exec(scope)?.[0]
  if (!letters) return null
  const m = new RegExp(`(?:^|[^a-z0-9])${letters}(\\d{1,3})(?![0-9])`, 'i').exec(branch)
  return m ? `${letters.toUpperCase()}${m[1]}` : null
}

async function refreshGit($: EngineInterface) {
  try {
    const top = await $.process.run(['git', 'rev-parse', '--show-toplevel'])
    if (top.exitCode !== 0) {
      await update($, git, () => null)
      return
    }
    const st = await $.process.run(['git', 'status', '--porcelain=v2', '--branch'])
    const lines = st.stdout.split('\n')
    const head = lines.find(l => l.startsWith('# branch.head '))?.slice(14).trim() ?? '?'
    const dirty = lines.filter(l => l !== '' && !l.startsWith('#')).length
    const worktree = top.stdout.trim().split(/[\\/]/).pop() ?? ''
    const id = await read($, storyId)
    const scope = id ? branchScope(head, storyScope(id)) : null
    const mismatch = id && scope && scope !== storyScope(id) ? `BRANCH IS ${scope}, STORY IS ${id}` : null
    const info: GitInfo = { worktree, branch: head === '(detached)' ? 'DETACHED' : head, dirty, mismatch }
    const prev = await read($, git)
    if (JSON.stringify(prev) !== JSON.stringify(info)) await update($, git, () => info)
  } catch {
    // no git on PATH
  }
}

// ── 2. Generated files are edited at their source ───────────────────────────
const GENERATED_MARK = /@generated|\bDO NOT EDIT\b|(generated (from|by)|auto-?generated)[^\n]{0,120}(do not edit|don't edit|edit that|regenerate)/i

/** Why `path` must not be edited by hand, or null when it may be. */
async function generatedReason($: EngineInterface, path: string): Promise<string | null> {
  const name = path.split(/[\\/]/).pop() ?? path
  try {
    if (!(await $.fs.exists(path))) return null
    const head = String(await $.fs.read(path)).slice(0, 1500)
    const m = GENERATED_MARK.exec(head)
    if (!m) return null
    const line = head.split('\n').find(l => GENERATED_MARK.test(l))?.replace(/[#*/<>!-]+/g, ' ').trim() ?? m[0]
    return `${name} is generated (${line.slice(0, 140)}): edit its source and regenerate`
  } catch {
    return null
  }
}

// ── 3. Production guardrails ────────────────────────────────────────────────
const RISKY: { re: RegExp; why: string }[] = [
  { re: /\bterraform\s+(apply|destroy)\b/i, why: 'terraform apply/destroy' },
  { re: /\baz\s+(containerapp|webapp|functionapp|aks|postgres|sql|keyvault|storage|group|deployment|apim|redis)\b[^|;&]*\b(update|create|delete|restart|up|deploy|purge|stop)\b/i, why: 'an Azure resource change' },
  { re: /\bgit\s+push\b[^|;&]*\s(-f|--force|--force-with-lease)\b/i, why: 'a force push' },
  { re: /\bgit\s+push\b[^|;&]*(?:\s|:)(main|master|release[\w./-]*|prod[\w./-]*)(?=\s|$|[;&|])/i, why: 'a push to main/release/prod' },
  { re: /\b(kubectl\s+(apply|delete|rollout)|helm\s+(upgrade|install|uninstall|rollback))\b/i, why: 'a cluster change' },
  { re: /\bcurl\b[^|;&]*-X\s*(POST|PUT|PATCH|DELETE)\b[^|;&]*https?:\/\/[^\s'"]*\bprod/i, why: 'a write to a PROD URL' },
  { re: /https?:\/\/[^\s'"]*(\bprod\b|-prod[.-]|\.prod\.)[^\s'"]*/i, why: 'a PROD URL' },
]
export function riskOf(command: string): string | null {
  return RISKY.find(r => r.re.test(command))?.why ?? null
}
const approvedRisks = new Set<string>()

async function confirmRisk($: EngineInterface, why: string, command: string): Promise<boolean> {
  if (approvedRisks.has(why)) return true
  try {
    const answer = await $.ui.ask(`Claude Pets guard: ${why}.\n\n${command.slice(0, 300)}\n\nRun it?`, {
      header: 'Guard',
      options: ['Run it', 'Allow for this session', 'Block it'],
    })
    if (answer === 'Allow for this session') approvedRisks.add(why)
    return answer === 'Run it' || answer === 'Allow for this session'
  } catch {
    return false // nobody to ask (headless), or dismissed
  }
}

// ── 4. The tracked story rides along with prompts ───────────────────────────
export function storyContext(s: Story): string {
  return [
    `Active backlog story (tracked by Claude Pets, read from ${s.path}; status is the markdown's, not an issue tracker's):`,
    `${s.id} [${s.status}] ${s.title}`,
    `${s.epic}${s.points ? ` · ${s.points} pts` : ''}${s.section ? ` · ${s.section}` : ''} · status: ${s.statusText}`,
    ...(s.ac.length ? ['Acceptance criteria:', ...s.ac.map(a => `- ${a}`)] : []),
    ...(s.tasks.length ? ['Tasks:', ...s.tasks.map(t => `- [${t.status}] ${t.kind}: ${t.name}`)] : []),
  ].join('\n')
}
let lastStoryContext = ''

/** The guardrails' verdict on one tool call: a reason to refuse it, or null to let it run. */
async function guardCall($: EngineInterface, e: Record<string, unknown>): Promise<string | null> {
  if (await read($, guardOff)) return null
  const tool = String(e.tool)
  if (tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit' || tool === 'NotebookEdit') {
    const path = String(e.file_path ?? e.notebook_path ?? '')
    const why = path ? await generatedReason($, path) : null
    return why ? `Claude Pets guard: ${why}. (/guard off disables this for the session.)` : null
  }
  if (tool === 'Bash' || tool === 'PowerShell') {
    const command = String(e.command ?? '')
    const risk = riskOf(command)
    if (risk && !(await confirmRisk($, risk, command))) {
      return `Claude Pets guard: blocked ${risk}. Ask the person to run it, or they can allow it when asked.`
    }
  }
  return null
}

/** The tracked story's ACs, attached when they are new to the conversation or asked about. */
async function storyNote($: EngineInterface, text: string): Promise<string | null> {
  if (text.startsWith('/')) return null
  const s = await read($, story)
  if (!s) return null
  const ctx = storyContext(s)
  const mentioned = text.toUpperCase().includes(s.id) || /\b(acceptance criteria|ACs?)\b/i.test(text)
  if (ctx === lastStoryContext && !mentioned) return null
  lastStoryContext = ctx
  return ctx
}

// ── 5. The pet speaks when a long turn ends (see petVoice) ─────────────────
const DONE_SOUND_AFTER_MS = 30_000
const fmtDuration = (ms: number) => {
  const sec = Math.round(ms / 1000)
  return sec >= 60 ? `${Math.floor(sec / 60)}M${String(sec % 60).padStart(2, '0')}S` : `${sec}S`
}

// ── 6. Context filling up ───────────────────────────────────────────────────
const CTX_WARN = 85
let ctxWarned = false

// ── 7. /standup64 ─────────────────────────────────────────────────────────────
async function standup($: EngineInterface): Promise<string> {
  const [s, g, res, entries, t] = await Promise.all([read($, story), read($, git), read($, tests), read($, log), read($, ticket)])
  const edited = [...new Set(entries.filter(l => /^(Edit|Write|NotebookEdit|MultiEdit)$/.test(l.tool)).map(l => l.detail))]
  const facts = [
    s ? `Story: ${s.id} [${s.status}] ${s.title} (${s.epic})` : t ? `Ticket: ${t}` : 'No tracked story',
    g ? `Repo: ${g.worktree} on ${g.branch}, ${g.dirty} uncommitted file(s)` : '',
    edited.length ? `Files changed: ${edited.slice(0, 15).join(', ')}` : 'No files changed',
    res ? `Last test run: ${res.passed} passed, ${res.failed} failed (${res.command})` : 'No test run',
  ].filter(Boolean)
  let recent = ''
  try {
    const msgs = await $.session.messages()
    if (Array.isArray(msgs)) {
      recent = msgs.slice(-8).map(m => `${m.role}: ${m.text.replace(/\s+/g, ' ').slice(0, 280)}`).join('\n')
    }
  } catch {
    // transcript unavailable
  }
  const local = [
    `Done: ${edited.length ? `changed ${edited.slice(0, 5).join(', ')}` : 'investigation'}${s ? ` on ${s.id}` : ''}`,
    `Next: ${s ? `${s.id} is ${s.status}` : 'continue'}${res?.failed ? `; fix ${res.failed} failing test(s)` : ''}`,
    `Blockers: ${res?.failed ? `${res.failed} failing test(s)` : 'none'}`,
  ].join('\n')
  const r = await $.model.complete({
    model: 'haiku',
    maxTokens: 300,
    system: 'You write terse standup updates for a software engineer. Exactly three lines: "Done: …", "Next: …", "Blockers: …". No preamble, no markdown.',
    prompt: `Facts:\n${facts.join('\n')}\n\nRecent conversation:\n${recent || '(none)'}`,
  })
  return r.isAnswered && r.text.trim() ? r.text.trim() : local
}

// ── 8. Failed test → defect draft ───────────────────────────────────────────
export function failingTests(out: string): string[] {
  const names = new Set<string>()
  for (const m of out.matchAll(/^\s*\d+\)\s+(.+?)\s*$/gm)) names.add((m[1] ?? '').replace(/\s+─+$/, ''))
  for (const m of out.matchAll(/^\s*[✘×✗]\s+\d*\s*(.+?)\s*(\(\d+(\.\d+)?m?s\))?$/gm)) names.add(m[1] ?? '')
  for (const m of out.matchAll(/^FAILED\s+(\S+)/gm)) names.add(m[1] ?? '')
  return [...names].filter(Boolean).slice(0, 8)
}

/** Reads the session's current figures (free: no request) and takes them. */
async function pollUsage($: EngineInterface) {
  try {
    await takeUsage($, await $.session.usage())
  } catch {
    // no reading yet
  }
}

// Warn once per window as it crosses each WARN_AT threshold (re-armed when it resets lower).
const warned: Record<string, number> = {}

async function takeUsage($: EngineInterface, u: Pick<SessionUsage, 'rateLimits' | 'context' | 'cost'>) {
  const next: Usage = { ...toUsage(u), readAt: await $.clock.now() }
  await update($, usage, () => next)
  await setLimit($, next)
  const now = await $.clock.now()
  for (const [label, w] of [['5-HOUR', next.fiveHour], ['WEEKLY', next.week]] as const) {
    if (!w) continue
    const hit = WARN_AT.filter(t => w.percent >= t).pop() ?? 0
    if (hit > (warned[label] ?? 0)) {
      const reset = fmtReset(w.resetsAt, now)
      $.ui.toast(`⚠ ${label} LIMIT ${Math.round(w.percent)}% USED${reset ? ` · RESETS IN ${reset}` : ''}`, { timeoutMs: 8000 })
    }
    warned[label] = hit
  }
  const ctx = next.ctxPercent ?? 0
  if (ctx >= CTX_WARN && !ctxWarned) {
    ctxWarned = true
    $.ui.toast(`⚠ CONTEXT ${Math.round(ctx)}% FULL · RUN /compact BEFORE IT CUTS OFF`, { timeoutMs: 8000 })
  } else if (ctx < 70) {
    ctxWarned = false
  }
  await refreshStatus($)
}

type El = (props: Record<string, unknown>, ...children: unknown[]) => unknown

/** One `5H [██████░░░░] 62% ↻1H12M` cell group per window, then context fill. */
function usageRow(Box: unknown, Text: unknown, C: Palette, u: Usage, now: number, barW: number) {
  const B = Box as El, T = Text as El
  const cell = (label: string, w: UsageWindow | null) => {
    if (!w) return null
    const [on, off] = bar(w.percent, barW)
    const reset = fmtReset(w.resetsAt, now)
    return h(B as never, { flexDirection: 'row' },
      h(T as never, { color: C.dim, backgroundColor: C.bg }, ` ${label} `),
      h(T as never, { color: C[usageTone(w.percent)], backgroundColor: C.bg }, on),
      h(T as never, { color: C.dim, backgroundColor: C.bg }, off),
      h(T as never, { color: C[usageTone(w.percent)], backgroundColor: C.bg, bold: true }, ` ${Math.round(w.percent)}%`),
      h(T as never, { color: C.dim, backgroundColor: C.bg }, reset ? ` ↻${reset} ` : ' '),
    )
  }
  if (!u.fiveHour && !u.week) {
    return h(T as never, { color: C.dim, backgroundColor: C.bg, wrap: 'truncate' },
      ` PLAN USAGE: NO READING YET${u.ctxPercent !== null ? `   CTX ${Math.round(u.ctxPercent)}%` : ''}`)
  }
  return h(B as never, { flexDirection: 'row', flexWrap: 'wrap' },
    cell('5H', u.fiveHour),
    cell('WEEK', u.week),
    u.ctxPercent !== null
      ? h(T as never, { color: C[usageTone(u.ctxPercent)], backgroundColor: C.bg }, ` CTX ${Math.round(u.ctxPercent)}%`)
      : null,
  )
}

const COMMANDS: { name: string; description: string }[] = [
  { name: 'qa-pane', description: 'Open the retro QA MONITOR pane' },
  {
    name: 'story',
    description: 'Track a backlog story from markdown: /story E12-S03 · /story clear · /story plan (pick this repo\'s plan file)',
  },
  { name: 'ticket', description: 'Show an issue key and environment in the band: /ticket PROJ-123 DEV, or /ticket clear' },
  {
    name: 'pet',
    description: 'Claude Pets: /pet help lists everything · /pet box [open] · /pet collection · /pet skin · /pet focus [25/5|45/5|stop] · /pet breaks · /pet festivals · /pet birthday · /pet chatter on|off · /pet (show/hide) · /pet weather <city>|here|off · /pet pane · /pet board · /pet board world · /pet join · /pet leave · /pet stats · /pet list · /pet <animal> · /pet name [Mochi] · /pet ball · /pet pat',
  },
  // not `standup`: other plugins commonly own that name
  { name: 'standup64', description: 'Three-line standup (Done / Next / Blockers) from this session, copied to the clipboard' },
  { name: 'defect', description: 'Draft a bug report for the last failed test run into the prompt' },
  { name: 'guard', description: 'Claude Pets guardrails: /guard (status) · /guard off · /guard on' },
  { name: 'retro', description: 'Toggle the Claude Pets band · /retro theme <preset>|#accent [on #background] · /retro font plain|bold|mono|double|wide|pixel · /retro sound on|off' },
]

/** `/pet help`: every command, grouped. */
export const PET_HELP = [
  'CLAUDE PETS · COMMANDS',
  '',
  'PET',
  '  /pet                      show or hide the pet',
  '  /pet list · /pet <animal>  the 14 animals; switch (XP and name stay)',
  '  /pet name [Mochi]          rename it (no name: pick from ideas)',
  '  /pet ball · /pet pat       play with it',
  '  /pet stats                 level, stage, XP, mood, coins, helpers',
  '  /pet shop                  spend coins: bow, scarf, shades, hat, lantern, crown',
  '  /pet buy <item> · /pet wear <item>|none   buy it; put it on or take it off',
  '  /pet focus [45/5] · stop  a Pomodoro timer your pet guards (25/5 by default); /pet focus help',
  '  /pet box [open]            blind boxes: one per level up, achievement and 4 focus rounds',
  '  /pet collection            every find, ✓ found or 🔒 not yet · /pet skin <name>|none',
  '  /pet size auto|big|small   the bigger, detailed pet or the small classic one',
  '  /pet breaks [60|off]       a stretch-and-water reminder after an hour of work',
  '  /pet festivals [on|off]    Tết, Mid-Autumn, Christmas, New Year, Valentine\'s, Halloween',
  '  /pet festivals add 11-20 Teachers\' Day   a day of your own (remove <name> to drop it)',
  '  /pet birthday              when your pet was adopted; its birthday is a party',
  '  /pet chatter on|off        now and then, a line from your pet (a small model; off by default)',
  '  /pet play [off]            open (or close) the runner game in the band; click it, then space to jump',
  '  /pet play auto [off]       open it by itself while Claude works (off by default)',
  '  /pet pane                  the pet in a pane of its own (VS Code opens it by itself)',
  '',
  'WEATHER',
  '  /pet weather               the current conditions',
  '  /pet weather <city>        set your place (Open-Meteo)',
  '  /pet weather here          look your place up from your IP address',
  '  /pet weather off           forget the place; nothing is fetched',
  '',
  'BOARDS',
  '  /pet board                 your profile, streak and achievements',
  '  /pet board world           the world board',
  '  /pet join · /pet leave     join it with GitHub, or delete your entry',
  '  /pet card                  a live badge of your pet for your GitHub README',
  '  /pet visit <github login>  bring your pet to a friend\'s for a minute (+5 XP each, once a day)',
  '  /pet visits on|off         let friends visit you, or not',
  '  /pet diary [card]          today, in your pet\'s words; card copies it as a picture',
  '',
  'LOOK',
  '  /retro                     show or hide the band',
  '  /retro theme <preset>      ice, phosphor, amber, c64, mint, rose, mono, paper',
  '  /retro theme #FF8800 [on #101010]   your own colours',
  '  /retro font <style>        plain, bold, mono, double, wide, pixel',
  '  /retro sound on|off        the pet\'s voice',
  '',
  'WORK',
  '  /story <ID> · /story plan  track a backlog story; pick this repo\'s plan file',
  '  /ticket KEY-123 DEV        an issue key and environment in the band',
  '  /standup64 · /defect       a standup from this session; a bug draft from the last failed run',
  '  /guard on|off · /qa-pane   guardrails; the QA monitor pane',
].join('\n')

const THEME_HELP = [
  `Presets: ${THEME_NAMES.join(' · ')}`,
  'Your own colours: /retro theme #FF8800 (an accent; the background is mixed from it) or /retro theme #FF8800 on #101010',
].join('\n')
const FONT_HELP = [
  `Banner fonts: ${FONT_NAMES.map(n => (n === 'pixel' ? 'pixel (big pixel letters)' : `${n} ${styleText('PETS', n)}`)).join(' · ')}`,
  "The terminal's own font is its setting, not a plugin's: Windows Terminal: Settings › your profile › Appearance › Font face; macOS Terminal: Settings › Profiles › Text; VS Code: terminal.integrated.fontFamily.",
].join('\n')

/** Registers each command on its own, so a name another plugin owns costs that command alone. */
async function registerCommands($: EngineInterface) {
  const clashes: string[] = []
  for (const c of COMMANDS) {
    try {
      await $.command.register(c)
    } catch {
      clashes.push(`/${c.name}`)
    }
  }
  if (clashes.length) $.ui.log(`pixel-pets: ${clashes.join(', ')} not registered: another plugin owns the name`)
}

/** `/pet weather …`: show, set (a city, or here by IP address) or forget the place (E2). */
async function weatherCommand($: EngineInterface, args: string): Promise<{ text: string }> {
  if (/^(off|clear|none)$/i.test(args)) {
    await $.store.set('weatherPlace', null)
    await refreshWeather($)
    return { text: 'Weather off: no place is stored, and nothing is fetched.' }
  }
  if (!args) {
    const wx = await read($, weather)
    const place = await readPlace($)
    if (!place) return { text: 'No place set. /pet weather <city> sets one; /pet weather here looks yours up from your IP address.' }
    return {
      text: wx
        ? `${wx.place}: ${fmtTemp(wx.tempC, CFG.temperatureUnit)}, ${wx.label.toLowerCase()}, wind ${fmtWind(wx.windKmh, CFG.temperatureUnit).toLowerCase()} (Open-Meteo, every 15 minutes).`
        : `${place.name}: no reading yet.`,
    }
  }
  const isHere = /^here$/i.test(args)
  const place = isHere ? await placeFromIp($).catch(() => null) : await geocode($, args).catch(() => null)
  if (!place) return { text: isHere ? 'Could not look up your place from your IP address. Try /pet weather <city>.' : `No place called "${args}" found.` }
  await $.store.set('weatherPlace', place)
  await refreshWeather($)
  const wx = await read($, weather)
  return {
    text: `Weather for ${place.name}${isHere ? ' (from your IP address, via ipapi.co)' : ''}`
      + (wx ? `: ${fmtTemp(wx.tempC, CFG.temperatureUnit)}, ${wx.label.toLowerCase()}.` : '.'),
  }
}

/** Asks for a name: four ideas, or anything typed under Other (16 characters at most). */
async function askPetName($: EngineInterface): Promise<string | undefined> {
  const pet = await readPet($)
  try {
    const answer = await $.ui.ask(`What should your ${pet.kind} be called?`, {
      header: 'Pet name',
      options: PETS[pet.kind].ideas.filter(n => n !== pet.name).slice(0, 4),
    })
    const name = answer.replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 16)
    return name || undefined
  } catch {
    return undefined
  }
}

export const register: Register = (on, options) => {
  configure(options)
  let isWorking = false

  on('session.start', async ($, e, next) => {
    await registerCommands($)

    // a pet saved earlier wins over the settings' starting pet
    const savedPet = await $.store.get('pet')
    if (savedPet && typeof savedPet === 'object') {
      const p = savedPet as { kind?: unknown; name?: unknown }
      if (isPetKind(p.kind) && typeof p.name === 'string') {
        const kind: PetKind = p.kind, name = p.name
        await update($, petState, () => ({ kind, name }))
      }
    }
    if ((await $.store.get('petShown')) === false) await update($, petShown, () => false)
    const wallet = await readWallet($)
    petSim.wearing = wallet.wearing
    petSim.skin = wallet.skin
    const size = await $.store.get('petSize')
    if (size === 'big' || size === 'small' || size === 'auto') petSize = size
    const best = await $.store.get('runnerBest')
    if (typeof best === 'number') game.best = best
    if ((await $.store.get('chimeOn')) === false) await update($, chimeOn, () => false)
    void refreshGit($)
    $.clock.every(10000, () => void refreshGit($))
    $.clock.every(140, () => void petTick($))
    await resumeFocus($)
    $.clock.every(1000, () => void refreshFocusText($))
    await refreshCalendar($)
    $.clock.every(60_000, () => void refreshCalendar($))
    // a theme or font picked with /retro wins over the settings'
    const savedTheme = await $.store.get('theme')
    const themeSpec = (typeof savedTheme === 'string' && parseTheme(savedTheme)) || CFG.theme
    await update($, theme, () => themeSpec)
    const savedFont = await $.store.get('font')
    const fontPick: FontName = isFontName(savedFont) ? savedFont : CFG.font
    await update($, font, () => fontPick)
    // VS Code draws no band: the pet gets a pane of its own there (E5-S02)
    if ((await $.session.surfaces()).includes('vscode') && (await read($, petShown))) void openPetPane($)
    if ((await read($, storyId)) === null) {
      const saved = (await storeMap($, 'stories'))[await repoRoot($)]
      let id = typeof saved === 'string' ? saved : null
      try {
        const branch = await $.process.run(['git', 'branch', '--show-current'])
        const fromBranch = findStoryId(branch.stdout)
        if (fromBranch && (await lookupStory($, fromBranch)).story) id = fromBranch
      } catch {
        // not a git checkout
      }
      await update($, storyId, () => id)
    }
    void loadStory($, true).then(() => refreshStatus($))
    void (async () => {
      // a place named in the settings is looked up once, when none is stored yet
      if (CFG.weatherPlace && !(await readPlace($))) {
        const found = await geocode($, CFG.weatherPlace).catch(() => null)
        if (found) await $.store.set('weatherPlace', found)
      }
      await refreshWeather($)
    })()
    $.clock.every(WEATHER_EVERY_MS, () => void refreshWeather($))
    void pollUsage($)
    // Re-read between turns so the bars and the reset countdowns stay current.
    $.clock.every(30000, () => void pollUsage($))

    $.clock.every(530, () => {
      if (!isWorking) void update($, blink, b => !b)
    })
    // Pick up edits to the markdown made outside a turn (regenerated backlog, a hand edit).
    $.clock.every(15000, () => void loadStory($).then(() => refreshStatus($)))

    return next(e)
  })

  on('command.run', { command: 'qa-pane' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: 'QA MONITOR' })
    return { text: opened.isPlaced ? 'LOAD "QA MONITOR",8,1 … READY.' : 'QA MONITOR waiting for room: widen the terminal.' }
  })

  on('command.run', { command: 'pet' }, async ($, e) => {
    const args = e.args.trim()
    const kind = args.toLowerCase()
    let named = /^name\s+(.{1,16})$/i.exec(args)?.[1]?.trim()
    if (/^name$/i.test(args)) named = await askPetName($)
    if (/^name$/i.test(args) && !named) return { text: 'Kept the name.' }
    if (/^(list|pets|animals)$/i.test(args)) {
      const w = await readWallet($)
      const locked = (k: PetKind) => BOX_PETS.includes(k) && !w.pets.includes(k)
      return { text: `Pets: ${PET_KINDS.map(k => (locked(k) ? `🔒 ${k}` : `${PETS[k].emoji} ${k}`)).join(' · ')}\nSwitch with /pet <animal>; your XP and name stay. 🔒 animals hatch from blind boxes (/pet box).` }
    }
    if (isPetKind(kind)) {
      const k: PetKind = kind
      if (BOX_PETS.includes(k) && !(await readWallet($)).pets.includes(k)) {
        return { text: `The ${k} only hatches from a blind box (✦ legendary). /pet box` }
      }
      const pet = await update($, petState, p => ({ ...(p.name ? p : { kind: CFG.petKind, name: CFG.petName }), kind: k }))
      await $.store.set('pet', pet)
    } else if (named) {
      const pet = await update($, petState, p => ({ ...(p.name ? p : { kind: CFG.petKind, name: CFG.petName }), name: named }))
      await $.store.set('pet', pet)
    } else if (/^ball$/i.test(args)) {
      await throwBall($)
    } else if (/^pat$/i.test(args)) {
      await patPet($)
    } else if (/^join$/i.test(args)) {
      if (!boardReady()) return { text: NOT_SET_UP }
      const link = await readLink($)
      if (link) return { text: `Already on the board as ${link.login}. /pet board world shows it; /pet leave removes you.` }
      if (boardSync.isJoining) return { text: 'Already waiting for you to approve the code at github.com/login/device.' }
      const r = await $.http.fetch('https://github.com/login/device/code', {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
        body: `client_id=${encodeURIComponent(CFG.githubClientId)}&scope=`,
      }).catch(() => null)
      if (!r || !r.ok) return { text: `Could not reach GitHub to start the sign-in${r ? ` (${r.status})` : ''}.` }
      const flow = JSON.parse(r.text) as DeviceCode
      boardSync.isJoining = true
      const now = await $.clock.now()
      $.clock.after(flow.interval * 1000, () => void pollDevice($, flow, now + flow.expires_in * 1000, flow.interval * 1000))
      return {
        text: [
          `Open ${flow.verification_uri} and enter: ${flow.user_code}`,
          'GitHub will ask to share your public profile only (no scopes). Claude Pets finishes joining once you approve, and keeps only the board\'s own key, never your GitHub token.',
          'Shared: your GitHub login, level, XP, favourite pet and streak. /pet leave deletes it all.',
        ].join('\n'),
      }
    } else if (/^leave$/i.test(args)) {
      const link = await readLink($)
      if (!link) return { text: 'You are not on the shared board.' }
      const r = await $.http.fetch(`${link.url}/v1/me`, { method: 'DELETE', headers: { authorization: `Bearer ${link.apiKey}` } }).catch(() => null)
      await $.store.set('board', null)
      return {
        text: r && (r.status === 204 || r.status === 401)
          ? `Left the board: ${link.login}'s entry is deleted, and nothing more will be sent.`
          : 'Forgot the board key here, but could not reach the board to delete your entry; /pet join and /pet leave again later to remove it.',
      }
    } else if (/^board\s+world$/i.test(args)) {
      const link = await readLink($)
      const url = link?.url ?? CFG.leaderboardUrl
      if (!url) return { text: NOT_SET_UP }
      const r = await $.http.fetch(`${url}/v1/board?limit=20`, link ? { headers: { authorization: `Bearer ${link.apiKey}` } } : undefined).catch(() => null)
      if (!r || !r.ok) return { text: `Could not reach the board${r ? ` (${r.status})` : ''}.` }
      const d = JSON.parse(r.text) as { top: WorldRow[]; me: WorldRow | null }
      return { text: worldText(d.top, d.me, link?.login ?? null) }
    } else if (/^(board|leaderboard|profile)$/i.test(args)) {
      return { text: boardText(await readProfile($), await playerName($), await readPet($)) }
    } else if (/^(stats|status|xp)$/i.test(args)) {
      await loadXp($)
      const pet = await readPet($)
      const lv = levelOf(petSim.xp)
      const nextAt = 15 * lv * lv
      return {
        text: [
          `${pet.name} the ${pet.kind} · LV${lv} · XP ${petSim.xp} (LV${lv + 1} at ${nextAt})`,
          `Adopted ${await adoptedOn($)}${petSim.birthday ? ` · 🎂 ${petSim.birthday} TODAY` : ''}`,
          `Stage: ${stageOf(lv).toUpperCase()}${nextStage(lv) ? ` (${nextStage(lv)!.stage.toUpperCase()} at LV${nextStage(lv)!.at})` : ' (fully grown)'}${petSim.wearing.length ? ` · wearing: ${petSim.wearing.map(i => ITEMS[i].name.toLowerCase()).join(', ')}` : ''}`,
          ...(await nowLine($)),
          `Mood: ${petSim.mood.toUpperCase()}${petSim.limitLabel ? ` (${petSim.limitLabel}${petSim.resetText ? `, resets in ${petSim.resetText}` : ''})` : ''}`,
          `This session: ◆${petSim.collected} coins · ${petSim.bugs.length} bug(s) loose`,
          `Helpers: ${petSim.kids.filter(k => k.state === 'work').length} out working${petSim.kids.length ? ` (${petSim.kids.map(k => `#${k.n} ${k.label || 'subagent'}: ${k.xp} XP`).join(', ')})` : ''} · ${petSim.kidsHome} came home (+${petSim.kidXp} XP)`,
          'XP: +1 coin (a tool call that worked) · +5 bug squashed (an error) · +10 green test run · +2 per turn · +2 ball · runner: +1 a bug jumped, up to 20 a turn · helpers: +1 per subagent call that worked, +5 when its job is done',
        ].join('\n'),
      }
    } else if (/^card$/i.test(args)) {
      const link = await readLink($)
      if (!link) return { text: 'The badge is for players on the world board: /pet join first.' }
      const md = `[![${link.login}'s Claude Pet](${link.url}/card/${link.login}.svg)](https://github.com/quangtm0404/claude-pets)`
      const copied = await $.ui.copy({ text: md })
      return { text: `Your live badge, for a GitHub README (it updates as you play):\n\n${md}\n\n${copied.isCopied ? '(copied to the clipboard)' : '(copy it from here)'}` }
    } else if (/^visit\s+\S+$/i.test(args)) {
      const link = await readLink($)
      if (!link) return { text: 'Visits are for players on the world board: /pet join first.' }
      const who = args.replace(/^visit\s+@?/i, '')
      const r = await $.http.fetch(`${link.url}/v1/pet/${encodeURIComponent(who)}`, { headers: { authorization: `Bearer ${link.apiKey}` } }).catch(() => null)
      if (!r) return { text: 'Could not reach the board.' }
      const d = JSON.parse(r.text || '{}') as { login?: string; level?: number; favPet?: string; wearing?: string[]; isFirstToday?: boolean; error?: string }
      if (!r.ok || !d.login || !isPetKind(d.favPet)) return { text: d.error ? `${d.error}.` : `Could not visit ${who} (${r.status}).` }
      const now = await $.clock.now()
      petSim.guest = {
        login: d.login, kind: d.favPet, level: d.level ?? 1, wearing: (d.wearing ?? []).filter(isItemId),
        x: Math.max(0, petSim.columns - petW() - 1), dir: -1, pose: 'walkA', until: now + VISIT_MS,
      }
      if (d.isFirstToday) await gainXp($, 5, 'visit')
      return { text: `${d.login}'s ${d.favPet} (LV${d.level}) comes to play for a minute.${d.isFirstToday ? ' +5 XP for you both, once a day.' : ''}` }
    } else if (/^visits\s+(on|off)$/i.test(args)) {
      const link = await readLink($)
      if (!link) return { text: 'Visits are for players on the world board: /pet join first.' }
      const isOff = /off$/i.test(args)
      const r = await $.http.fetch(`${link.url}/v1/me`, {
        method: 'PUT',
        headers: { authorization: `Bearer ${link.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ visitsOff: isOff }),
      }).catch(() => null)
      if (!r?.ok) return { text: 'Could not reach the board.' }
      return { text: isOff ? 'Visits off: nobody can bring their pet to yours.' : 'Visits on: friends can /pet visit you.' }
    } else if (/^diary(\s+card)?$/i.test(args)) {
      const [d, pet, wx, themeName] = await Promise.all([readDiary($), readPet($), read($, weather), read($, theme)])
      const text = diaryText(d, pet, wx, CFG.temperatureUnit)
      if (!/card$/i.test(args)) return { text: `${text}\n\n/pet diary card copies it as an SVG picture to share.` }
      await loadXp($)
      const copied = await $.ui.copy({ text: diarySvg(text, pet, levelOf(petSim.xp), petSim.wearing, paletteOf(themeName), petSim.skin) })
      return { text: copied.isCopied ? 'Copied the diary card as SVG: paste it into a file named diary.svg to share it.' : 'Could not copy the card here.' }
    } else if (/^(play|game)(\s+(on|off|stop|auto|auto\s+off))?$/i.test(args)) {
      const opt = args.replace(/^(play|game)\s*/i, '').toLowerCase().replace(/\s+/g, ' ')
      if (opt === 'auto' || opt === 'auto off') {
        await $.store.set('runnerAuto', opt === 'auto')
        return { text: opt === 'auto' ? 'The runner will open by itself once Claude has worked 8 s. /pet play auto off stops that.' : 'The runner opens only when you ask: /pet play.' }
      }
      if (opt === 'off' || opt === 'stop') {
        await closeRunner($)
        return { text: 'Runner closed.' }
      }
      game.timer?.cancel()
      game.isManual = true
      await update($, runnerOn, () => true)
      return { text: 'The runner is in the band: click it, then space to jump the bugs. /pet play off closes it.' }
    } else if (/^focus\b/i.test(args)) {
      return { text: await focusCommand($, args.replace(/^focus\s*/i, '')) }
    } else if (/^breaks?(\s+\S+)?$/i.test(args)) {
      const opt = args.replace(/^breaks?\s*/i, '')
      if (!opt) {
        const mins = await breakMinutes($)
        return { text: mins ? `Break reminders: after ${mins} min of work (at most once an hour, never during a turn). /pet breaks <minutes>|off` : 'Break reminders are off. /pet breaks on (60 min) or /pet breaks <minutes>' }
      }
      const mins = parseBreaks(opt)
      if (mins === null) return { text: 'Usage: /pet breaks 60 (15 to 240 minutes) · /pet breaks off · /pet breaks on' }
      await $.store.set('breaks', mins)
      return { text: mins ? `After ${mins} min of work, your pet will stretch and suggest a break (at most once an hour, never during a turn).` : 'Break reminders off.' }
    } else if (/^(festivals?|seasons?)(\s+.*)?$/i.test(args)) {
      return { text: await festivalsText($, args.replace(/^(festivals?|seasons?)\s*/i, '')) }
    } else if (/^(birthday|bday|age)$/i.test(args)) {
      return { text: await birthdayText($) }
    } else if (/^chatter(\s+(on|off))?$/i.test(args)) {
      const opt = args.replace(/^chatter\s*/i, '').toLowerCase()
      const pet = await readPet($)
      if (opt) await $.store.set('chatter', opt === 'on')
      const isOn = (await $.store.get('chatter')) === true
      return {
        text: isOn
          ? [
            `Chatter on: after a turn, at most once every ${CHATTER_EVERY_MS / 60_000} minutes, ${pet.name} says a line in the band.`,
            'A small model (haiku) writes it from a short summary made here: how long the turn took and how many edits, commands and tests ran.',
            'Never your files, paths, commands, prompts or answers, and the line never goes into the conversation. A few hundred tokens each. /pet chatter off',
          ].join('\n')
          : `Chatter off: ${pet.name} keeps quiet. /pet chatter on`,
      }
    } else if (/^box(es)?(\s+open)?$/i.test(args)) {
      return { text: /open$/i.test(args) ? await openBox($) : boxText(await readWallet($)) }
    } else if (/^(collection|inventory|bag)$/i.test(args)) {
      return { text: collectionText(await readWallet($)) }
    } else if (/^skins?(\s+\S+)?$/i.test(args)) {
      const want = args.replace(/^skins?\s*/i, '').toLowerCase()
      const w = await readWallet($)
      if (!want) return { text: `Skins: ${w.skins.length ? w.skins.join(', ') : 'none yet: they come out of blind boxes (★ epic, ✦ legendary)'}${w.skin ? ` · wearing ${w.skin}` : ''}\n/pet skin <name> · /pet skin none` }
      if (want === 'none' || want === 'off') {
        await writeWallet($, { ...w, skin: null })
        return { text: 'Back to its own colours.' }
      }
      if (!isSkinId(want)) return { text: `No skin called "${want}". Skins: ${SKIN_IDS.join(', ')}` }
      if (!w.skins.includes(want)) return { text: `You haven't found the ${SKINS[want].name.toLowerCase()} skin yet: it comes out of blind boxes (${SKINS[want].rarity}).` }
      await writeWallet($, { ...w, skin: want })
      return { text: `Now ${SKINS[want].name.toLowerCase()}.` }
    } else if (/^size(\s+(auto|big|small))?$/i.test(args)) {
      const want = args.replace(/^size\s*/i, '').toLowerCase()
      if (!want) return { text: `Pet size: ${petSize} (auto: the bigger, detailed pet when the band has room, the small classic one when it doesn't). /pet size auto|big|small` }
      petSize = want as typeof petSize
      await $.store.set('petSize', petSize)
      petSim.lastCells = ''
      return { text: want === 'small' ? 'The small classic pet, always.' : want === 'big' ? 'The bigger, detailed pet, always (it takes two more rows).' : 'Bigger when the band has room, small when it does not.' }
    } else if (/^shop$/i.test(args)) {
      return { text: shopText(await readWallet($)) }
    } else if (/^(buy|wear)\s+\S/i.test(args)) {
      const [verb, ...rest] = args.split(/\s+/)
      return { text: await shopCommand($, verb!.toLowerCase() as 'buy' | 'wear', rest.join(' ')) }
    } else if (/^weather\b/i.test(args)) {
      return weatherCommand($, args.replace(/^weather\s*/i, ''))
    } else if (/^(help|\?|commands)$/i.test(args)) {
      return { text: PET_HELP }
    } else if (/^(pane|window)$/i.test(args)) {
      const opened = await openPetPane($)
      return { text: opened.isPlaced ? 'The pet pane is open. READY.' : 'The pet pane is waiting for room.' }
    } else if (args === '') {
      const shown = await update($, petShown, v => !v)
      await $.store.set('petShown', shown)
      const pet = await readPet($)
      if (shown && (await $.session.surfaces()).includes('vscode')) await openPetPane($)
      if (!shown) await $.ui.close({ id: PET_PANE })
      return {
        text: shown ? `${pet.name} the ${pet.kind} joins the band. READY.` : `${pet.name} is resting. /pet brings them back.`,
      }
    } else {
      return { text: 'Usage: /pet help · /pet (show/hide) · /pet weather · /pet pane · /pet board · /pet board world · /pet join · /pet leave · /pet stats · /pet list · /pet <animal> · /pet name [Mochi] · /pet ball · /pet pat' }
    }
    await update($, petShown, () => true)
    const pet = await readPet($)
    return { text: `${pet.name} the ${pet.kind} is in the band. READY.` }
  })

  on('command.run', { command: 'retro' }, async ($, e) => {
    const ch = /^(?:sound|chime)\s+(on|off)$/i.exec(e.args.trim())?.[1]?.toLowerCase()
    if (ch) {
      const isOn = ch === 'on'
      await update($, chimeOn, () => isOn)
      await $.store.set('chimeOn', isOn)
      return { text: isOn ? 'Sound on: the pet speaks when a long turn ends, and on level-ups and moods.' : 'Sound off.' }
    }
    const m = /^theme(?:\s+(.+))?$/i.exec(e.args.trim())
    if (m) {
      const spec = parseTheme(m[1] ?? '')
      if (!spec) return { text: THEME_HELP }
      await update($, theme, () => spec)
      await $.store.set('theme', spec)
      return { text: isThemeName(spec) ? `Theme: ${spec.toUpperCase()}. READY.` : `Theme: your own colours, ${spec.toUpperCase()}. READY.` }
    }
    const f = /^font(?:\s+(\w+))?$/i.exec(e.args.trim())
    if (f) {
      const name = (f[1] ?? '').toLowerCase()
      if (!isFontName(name)) return { text: FONT_HELP }
      await update($, font, () => name)
      await $.store.set('font', name)
      return { text: `Banner font: ${styleText(name.toUpperCase(), name)}. READY.` }
    }
    const hidden = await update($, isBandHidden, h => !h)
    return { text: hidden ? 'Band hidden. /retro brings it back.' : 'Band shown. READY.' }
  })

  on('command.run', { command: 'story' }, async ($, e, next) => {
    const args = e.args.trim()
    if (/^plan\b/i.test(args)) return next(e)
    if (/^(clear|reset|none)$/i.test(args)) {
      await selectStory($, null)
      return { text: 'Story cleared.' }
    }
    if (args === '' || /^refresh$/i.test(args)) {
      await loadStory($, true)
      const s = await read($, story)
      if (!s) return { text: await planHint($) }
      const lines = [
        `${s.id} [${s.status}] ${s.title}`,
        `${s.epic}${s.points ? ` · ${s.points} pts` : ''} · ${s.section}`,
        `Status: ${s.statusText}`,
        ...s.ac.map(a => `  - ${a}`),
        ...s.tasks.map(t => `  [${t.status}] ${t.kind}: ${t.name}`),
        `Source: ${s.path}`,
      ]
      return { text: lines.join('\n') }
    }
    const id = findStoryId(args)
    if (!id) return { text: 'Usage: /story E12-S03 · /story M1-14 · /story clear' }
    await selectStory($, id)
    const s = await read($, story)
    return { text: s ? `Tracking ${s.id} [${s.status}] ${s.title}` : await planHint($) }
  })

  // /story plan …: which markdown is this repo's plan (Claude Code owns /plan itself)
  on('command.run', { command: 'story' }, async ($, e, next) => {
    if (!/^plan\b/i.test(e.args.trim())) return next(e)
    const args = e.args.trim().replace(/^plan\s*/i, '')
    const { files, isRepo, root } = await planFiles($)
    const use = async (path: string) => {
      await setRepoPlan($, root, [path])
      await loadStory($, true)
      await refreshStatus($)
      const ids = new Set(String(await $.fs.read(path)).match(new RegExp(CFG.storyId.source, 'gi')) ?? []).size
      return { text: `Plan for this repo: ${path} (${ids} story id${ids === 1 ? '' : 's'} in it). /story <id> tracks one.` }
    }
    if (/^(clear|reset|default)$/i.test(args)) {
      await setRepoPlan($, root, null)
      await loadStory($, true)
      return { text: `This repo's plan is back to the settings: ${CFG.backlogFiles.join(', ')}.` }
    }
    if (args && !/^pick$/i.test(args)) {
      const path = isAbsPath(args) ? normPath(args) : `${root}/${normPath(args).replace(/^\.\//, '')}`
      if (!(await firstExisting($, [path]))) return { text: `${path} doesn't exist. /story plan pick lists the plan-like files in this repo.` }
      return use(path)
    }
    if (!args) {
      const existing = await existingFiles($, files)
      if (existing.length) {
        return {
          text: [`Plan for ${root}${isRepo ? '' : ' (from settings)'}:`, ...existing.map(f => `  ${f}`), '/story plan pick chooses another · /story plan <file> · /story plan clear'].join('\n'),
        }
      }
    }
    const found = await discoverPlans($, root)
    if (!found.length) return { text: `No plan-like markdown (backlog, roadmap, plan, milestones…) found in ${root}. Point at yours: /story plan path/to/plan.md` }
    const picked = await askPlan($, root, found)
    if (!picked) return { text: 'Plan unchanged.' }
    if (!(await firstExisting($, [picked]))) return { text: `${picked} doesn't exist.` }
    return use(picked)
  })

  on('command.run', { command: 'ticket' }, async ($, e) => {
    const args = e.args.trim()
    if (/^(clear|reset|none)$/i.test(args)) {
      await update($, ticket, () => null)
      await update($, env, () => null)
      await refreshStatus($)
      return { text: 'Ticket cleared.' }
    }
    const t = findTicket(args.toUpperCase())
    const en = /\b(DEV|TST|UAT|PROD)\b/i.exec(args)?.[1]?.toUpperCase() ?? null
    if (!t && !en) return { text: 'Usage: /ticket PROJ-123 [DEV|TST|UAT|PROD]  or  /ticket clear' }
    if (t) await update($, ticket, () => t)
    if (en) await update($, env, () => en)
    await refreshStatus($)
    return { text: `Active: ${t ?? (await read($, ticket)) ?? '—'} ${en ? '@ ' + en : ''}`.trim() }
  })

  on('prompt.submit', async ($, e, next) => {
    petSim.lastActive = await $.clock.now()
    noteWork(petSim.lastActive)
    if (e.text.startsWith('/')) return next(e)
    const t = findTicket(e.text)
    const en = findEnv(e.text)
    const id = findStoryId(e.text)
    if (t) await update($, ticket, () => t)
    if (en) await update($, env, () => en)
    if (id && id !== (await read($, storyId)) && (await lookupStory($, id)).story) await selectStory($, id)
    else if (t || en) void refreshStatus($)
    const note = await storyNote($, e.text)
    return note ? next({ ...e, context: [...(e.context ?? []), note] }) : next(e)
  })

  on('session.measure', async ($, e, next) => {
    await takeUsage($, e)
    return next(e)
  })

  // A subagent starting hatches a helper pet.
  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.agentId) spawnKid(started.agentId, e.description ?? e.subagentType ?? '', await $.clock.now())
    return started
  })

  on('turn.start', async ($, e, next) => {
    isWorking = true
    petSim.isWorking = true
    noteWork(await $.clock.now())
    turnLog.counts = {}
    turnLog.failed = 0
    turnLog.tests = null
    game.credited = 0
    game.timer?.cancel()
    if (!game.isManual && (await $.store.get('runnerAuto')) === true) {
      game.live = 0
      game.timer = $.clock.after(RUNNER_AFTER_MS, () => {
        if (isWorking) void update($, runnerOn, () => true)
      })
    }
    return next(e)
  })

  // the runner's scores (E6-S01)
  on('ui.message', async ($, e, next) => {
    if (e.element === 'runner') {
      const d = e.data as { type?: string; score?: number }
      const score = typeof d.score === 'number' ? Math.max(0, Math.floor(d.score)) : 0
      if (d.type === 'score') game.live = score
      if (d.type === 'over') {
        game.live = 0
        await creditRun($, score)
      }
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      isWorking = false
      petSim.isWorking = false
      petSim.lastActive = await $.clock.now()
      // a game the turn offered closes with it; one you opened stays until /pet play off
      if (game.isManual) game.timer?.cancel()
      else await closeRunner($)
      const u = e.usage
      if (u) await update($, tokens, n => n + u.input_tokens + u.output_tokens + u.cache_creation_input_tokens)
      await update($, turns, n => n + 1)
      // a plan that can't be read never costs the turn its XP
      await loadStory($).catch(() => undefined)
      void refreshStatus($)
      void refreshGit($)
      if (!e.isAborted) await gainXp($, 2, 'turn')
      const sid = await read($, storyId)
      if (sid && (await read($, story))) await bumpDiary($, d => void (d.stories.includes(sid) || d.stories.push(sid)))
      if (!e.isAborted && e.durationMs >= DONE_SOUND_AFTER_MS) {
        $.ui.toast(`▶ DONE IN ${fmtDuration(e.durationMs)}. READY.`, { timeoutMs: 6000 })
        void petVoice($)
      }
      await saveXp($)
      noteWork(petSim.lastActive)
      await refreshCalendar($)
      await maybeBreak($, petSim.lastActive)
      if (!e.isAborted) await maybeChatter($, e.durationMs, e.reason === 'error')
    } else {
      await kidDone($, e.agentId, !e.isAborted && e.reason !== 'error')
    }
    const done = await next(e)
    // the world board hears about it once the engine has finished the turn (E4-S03)
    if (e.agentId === undefined) await syncScore($)
    return done
  })

  on('tool.call', async ($, e, next) => {
    const refused = await guardCall($, e as unknown as Record<string, unknown>)
    if (refused) {
      petReact('!', 'fail', 2000, await $.clock.now())
      return { deny: refused }
    }
    const line: LogLine = {
      id: e.tool_use_id,
      tool: String(e.tool).replace(/^mcp__[^_]+(?:_[^_]+)*__/, '').slice(0, 14),
      detail: describe(e as unknown as Record<string, unknown>),
      state: 'run',
    }
    await update($, log, list => [...list, line].slice(-100))
    const isMainBash = String(e.tool) === 'Bash' && (e as { agentId?: string }).agentId === undefined
    if (isMainBash) {
      petSim.toolSince = await $.clock.now()
      petSim.toolName = (line.detail.split(/\s+/)[0] ?? 'it').slice(0, 12)
    }
    const ran = await next(e).finally(() => {
      if (isMainBash) petSim.toolSince = null
    })
    const ok = ran.deny === undefined && ran.isError !== true
    if ((e as { agentId?: string }).agentId === undefined) {
      const k = toolKind(String(e.tool))
      turnLog.counts[k] = (turnLog.counts[k] ?? 0) + 1
      if (!ok) turnLog.failed++
    }
    const done: LogLine['state'] = ok ? 'ok' : 'err'
    await update($, log, list => list.map(l => (l.id === line.id ? { ...l, state: done } : l)))
    const agentId = (e as { agentId?: string }).agentId
    if (agentId !== undefined && creditKid(agentId, ok, await $.clock.now())) {
      // a subagent's call: its helper's score, not the main pet's
    } else if (ran.isError === true) {
      petReact('!', 'fail', 2000, await $.clock.now())
      spawnBug()
    } else if (ok) {
      spawnCoin()
    }

    if (isMainBash) {
      const out = ran.text ?? ''
      if (CONFLICT_RE.test(out)) petSim.isConflict = true
      else if (ok && SETTLE_RE.test(line.detail)) petSim.isConflict = false
      if (ok && COMMIT_RE.test(line.detail) && !/nothing to commit|no changes added/.test(out)) await recordWork($, w => w.commits++)
      if (ok && PUSH_RE.test(line.detail) && !/\[rejected\]|error:|fatal:/.test(out)) {
        petReact('^', 'warn', 4000, await $.clock.now(), false, { text: 'RIDES A ROCKET: PUSHED!', kind: 'rocket' })
      }
    }
    if (String(e.tool) === 'Bash' && TEST_CMD_RE.test(line.detail)) {
      const res = parseTests(line.detail, ran.text ?? '')
      if (res) {
        turnLog.tests = { passed: res.passed, failed: res.failed }
        await update($, tests, () => res)
        await bumpDiary($, d => (res.failed ? d.red++ : d.green++))
        await recordWork($, w => noteTestRun(w, res.failed))
        if (res.failed) petReact('!', 'fail', 3500, await $.clock.now(), false, { text: `WINCES: ${res.failed} FAILING` })
        else petReact('♪', 'pass', 4000, await $.clock.now(), true, { text: 'DANCES: ALL GREEN!', kind: 'dance' })
        if (res.failed) {
          for (let i = 0; i < Math.min(3, res.failed); i++) spawnBug()
        } else {
          await gainXp($, 10, 'green')
        }
        if (res.failed) {
          const failure: Failure = { command: res.command, failed: res.failed, names: failingTests(ran.text ?? '') }
          await update($, lastFailure, () => failure)
        }
        $.ui.toast(
          `▶ TEST RUN: ${res.passed} PASSED, ${res.failed} FAILED${res.flaky ? `, ${res.flaky} FLAKY` : ''}${res.failed ? ' · /defect TO DRAFT A BUG' : ''}`,
          { timeoutMs: 7000 },
        )
        void refreshStatus($)
      }
    }
    return ran
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isBandHidden))) {
      if (e.surface !== 'terminal') petSim.remote.band = false
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const W = Math.max(20, e.props.bodyColumns)
    const isTerminal = e.surface === 'terminal'
    const wantsPet = (await read($, petShown)) && e.props.maxRows >= PET_MIN_ROWS
    const withStrip = wantsPet && isTerminal
    // the runner game during a long turn (E6-S01): terminal and desktop draw Clients
    const isPlaying = wantsPet && (e.props.isWorking || game.isManual) && (await read($, runnerOn)) && (isTerminal || e.surface === 'desktop')
    const [t, en, tok, res, model, cursor, entries, themeName, s, err, u, now, pet, art, fontName] = await Promise.all([
      read($, ticket),
      read($, env),
      read($, tokens),
      read($, tests),
      $.session.model(),
      // the strip blinks its own cursor, so the band need not redraw for it
      withStrip ? Promise.resolve(true) : read($, blink),
      read($, log),
      read($, theme),
      read($, story),
      read($, storyError),
      read($, usage),
      $.clock.now(),
      readPet($),
      wantsPet && !isTerminal ? read($, petArt) : Promise.resolve(''),
      read($, font),
    ])
    const g = await read($, git)
    const plan = await read($, planLabel)
    const wx = await read($, weather)
    // read so the countdown redraws each second; drawn from the timer itself, so it is never stale
    await read($, focusText)
    const fx = petSim.focus ? focusLabel(petSim.focus, now) : ''
    const C = paletteOf(themeName)
    let strip: RenderChildren = null
    let stripH = PET_ROWS
    if (isPlaying && (e.surface === 'terminal' || e.surface === 'desktop')) {
      const { Client } = $.ui.resolve(e)
      const columns = Math.max(24, Math.min(160, W - 2))
      const colors: Record<string, string> = { E: css(ANGRY_EYE) }
      for (const [k, v] of Object.entries(PETS[pet.kind].colors)) colors[k] = css(v)
      const props: RunnerProps = {
        frames: [babySprite(pet.kind, 'walkA'), babySprite(pet.kind, 'walkB')], colors,
        bg: C.bg, fg: C.fg, dim: C.dim, warn: C.warn, bug: css(BUG), best: game.best, columns,
      }
      if (isTerminal) petSim.isMounted = false
      else petSim.remote.band = false
      strip = <Client key="runner" module="./runner.tsx" props={props} width={columns} height={PET_ROWS + 1} />
    } else if (withStrip && e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      const hd = petSize === 'big' || (petSize === 'auto' && e.props.maxRows >= HD_MIN_ROWS)
      if (petSim.hd !== hd) {
        petSim.hd = hd
        petSim.lastCells = ''
      }
      const columns = Math.max(petW() + 2, Math.min(512, W - 2))
      if (petSim.columns !== columns || !petSim.lastCells) {
        sizeSim(columns)
        petSim.lastCells = petCells(stillFrame(pet, C, columns))
      }
      petSim.requestId = e.requestId
      petSim.isMounted = true
      stripH = stripRows(hd)
      strip = <Raster key="pet" columns={columns} rows={stripH} cells={petSim.lastCells} />
    } else if (isTerminal) {
      petSim.isMounted = false
    } else {
      // the desktop app (and any remote band): the same pet as SVG (E5-S01)
      petSim.remote.band = wantsPet
      if (wantsPet && !petSim.isMounted) petSim.hd = true
      if (wantsPet) {
        const { Svg } = $.ui.resolve(e)
        strip = <Svg key="pet" source={remoteArt(art, pet, C, Math.min(140, W - 2))} alt={`${PETS[pet.kind].emoji} ${petSim.line || pet.name.toUpperCase()}`} />
      }
    }
    const isPixelTitle = fontName === 'pixel'
    const titleText = styleText(C.banner, fontName)
    const left = Math.max(0, Math.floor((W - 2 - cellsOf(titleText)) / 2))
    const running = entries.filter(l => l.state === 'run').pop()
    const doneTasks = s ? s.tasks.filter(x => x.status === 'LIVE' || x.status === 'DONE').length : 0

    // Each row, or null when it has nothing to show (E1-S02: no plan, no story and
    // no ticket means no story row at all, rather than a prompt to set one up).
    const rows: Record<BandRow, RenderChildren> = {
      banner: (
        <Box flexDirection="row">
          <Text color={C.fg} backgroundColor={C.bg} bold wrap="truncate">
            {' '.repeat(left) + titleText + ' '.repeat(Math.max(0, W - 2 - C.stripes.length * 2 - left - cellsOf(titleText)))}
          </Text>
          {C.stripes.map(c => (
            <Text color={c} backgroundColor={C.bg}>▐▌</Text>
          ))}
        </Box>
      ),
      git: g ? (
        <Box flexDirection="row">
          <Text color={C.dim} backgroundColor={C.bg}>{' 64K '}</Text>
          <Text color={C.hi} backgroundColor={C.bg}>{g.worktree.toUpperCase()}</Text>
          <Text color={C.dim} backgroundColor={C.bg}>{' ⎇ '}</Text>
          <Text color={C.fg} backgroundColor={C.bg} wrap="truncate">{g.branch.toUpperCase()}</Text>
          {g.dirty > 0 && <Text color={C.warn} backgroundColor={C.bg}>{` ±${g.dirty}`}</Text>}
          {g.mismatch && <Text color={C.fail} backgroundColor={C.bg} bold>{` ≠ ${g.mismatch}`}</Text>}
          <Text color={C.dim} backgroundColor={C.bg} wrap="truncate">{`  ${fmtModel(model)} · ${fmtTokens(tok)} TOK`}</Text>
        </Box>
      ) : (
        <Text color={C.dim} backgroundColor={C.bg} wrap="truncate">
          {` 64K RAM SYSTEM  ${fmtModel(model)}  ${fmtTokens(tok)} TOKENS USED`}
        </Text>
      ),
      usage: usageRow(Box, Text, C, u, now, W >= 90 ? 10 : 6),
      weather: weatherRow(Box, Text, C, wx, CFG.temperatureUnit),
      story: s ? (
        <Box flexDirection="row">
          <Text color={C.dim} backgroundColor={C.bg}>{' STORY '}</Text>
          <Text color={C.hi} backgroundColor={C.bg} bold>{s.id}</Text>
          <Text color={C[STATUS_TONE[s.status]]} backgroundColor={C.bg} bold>{` [${s.status}] `}</Text>
          <Text color={C.fg} backgroundColor={C.bg} wrap="truncate">{s.title.toUpperCase()}</Text>
        </Box>
      ) : t || en ? (
        <Box flexDirection="row">
          <Text color={C.dim} backgroundColor={C.bg}>{' TICKET:'}</Text>
          <Text color={C.hi} backgroundColor={C.bg} bold>{t ?? '----'}</Text>
          <Text color={C.dim} backgroundColor={C.bg}>{'  ENV:'}</Text>
          <Text color={en ? C[ENV_TONE[en] ?? 'hi'] : C.dim} backgroundColor={C.bg} bold>{en ?? '---'}</Text>
        </Box>
      ) : err && plan ? (
        <Text color={C.dim} backgroundColor={C.bg} wrap="truncate">
          {` ${err} ISN'T IN ${plan.toUpperCase()} · /story plan TO CHANGE`}
        </Text>
      ) : null,
      tests: s || res ? (
        <Box flexDirection="row">
          {s && (
            <Text color={C.dim} backgroundColor={C.bg} wrap="truncate">
              {` ${s.epic.toUpperCase()}${s.points ? ` · ${s.points} PTS` : ''}${s.tasks.length ? ` · TASKS ${doneTasks}/${s.tasks.length}` : ''}  `}
            </Text>
          )}
          {res && (
            <Box flexDirection="row">
              <Text color={C.dim} backgroundColor={C.bg}>{s ? 'TESTS:' : ' TESTS:'}</Text>
              <Text color={C.pass} backgroundColor={C.bg}>{`${res.passed} PASS `}</Text>
              <Text color={res.failed ? C.fail : C.dim} backgroundColor={C.bg}>{`${res.failed} FAIL`}</Text>
            </Box>
          )}
        </Box>
      ) : null,
    }
    // Row budget: the pet and READY. first (a short terminal, macOS's 80×24, leaves ~8 rows).
    const room = e.props.maxRows - 1 - (strip ? stripH + (isPlaying ? 1 : 0) : e.props.isWorking ? 0 : 1)
    const present = CFG.bandRows.filter(r => rows[r] !== null && rows[r] !== undefined && rows[r] !== false)
    const kept = keepRows(present, room)
    // big pixel letters take 3 rows: only when there is room for them, else the plain banner (E5-S04)
    if (isPixelTitle && kept.has('banner') && room - kept.size >= 2) {
      if (isTerminal) {
        const { Raster } = $.ui.resolve(e)
        const columns = Math.max(1, Math.min(512, W - 2))
        rows.banner = <Raster key="title" columns={columns} rows={3} cells={titleCells(columns, C.fg, C.bg)} />
      } else {
        const { Svg } = $.ui.resolve(e)
        rows.banner = <Svg key="title" source={titleSvg(C.fg, C.bg, C.stripes)} alt="CLAUDE PETS" />
      }
    }

    return (
      <Box flexDirection="column" width={W} backgroundColor={C.bg} paddingX={1}>
        {present.filter(r => kept.has(r)).map(r => rows[r])}
        <Box flexDirection="row">
          {fx && <Text color={C.hi} backgroundColor={C.bg} bold>{` ${fx} `}</Text>}
          {e.props.isWorking ? (
            <Text color={C.warn} backgroundColor={C.bg} wrap="truncate">
              {` RUN ${running ? `${running.tool.toUpperCase()} ${running.detail}` : ''}`.trimEnd() + '…'}
            </Text>
          ) : (
            <Text color={C.fg} backgroundColor={C.bg}>{' READY.'}</Text>
          )}
        </Box>
        {strip}
        {!strip && !e.props.isWorking && (
          <Text color={cursor ? C.fg : C.bg} backgroundColor={C.bg}>{' █'}</Text>
        )}
      </Box>
    )
  })

  // The pet pane (E5-S02): where there is no band, the pet, its HUD, usage and weather.
  on('ui.render', { component: 'Pane', requestId: PET_PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const W = Math.max(24, e.props.bodyColumns)
    const [themeName, fontName, pet, art, line, u, wx, now] = await Promise.all([
      read($, theme), read($, font), readPet($), read($, petArt), read($, petLine), read($, usage), read($, weather), $.clock.now(),
    ])
    const C = paletteOf(themeName)
    let drawing: RenderChildren
    if (e.surface === 'terminal') {
      petSim.remote.pane = false
      drawing = <Text color={C.dim} backgroundColor={C.bg} wrap="wrap">{`${PETS[pet.kind].emoji} ${pet.name.toUpperCase()} LIVES IN THE BAND ABOVE THE PROMPT HERE.`}</Text>
    } else {
      petSim.remote.pane = true
      if (!petSim.isMounted) petSim.hd = true
      const { Svg } = $.ui.resolve(e)
      drawing = <Svg key="pet" source={remoteArt(art, pet, C, Math.min(100, W - 2))} alt={`${PETS[pet.kind].emoji} ${line || pet.name.toUpperCase()}`} />
    }
    return (
      <Box flexDirection="column" backgroundColor={C.bg} width={W} paddingX={1}>
        <Text color={C.fg} backgroundColor={C.bg} bold wrap="truncate">{styleText(C.banner, fontName === 'pixel' ? 'plain' : fontName)}</Text>
        {drawing}
        <Text color={C.dim} backgroundColor={C.bg} wrap="truncate">{line || `${pet.name.toUpperCase()} THE ${pet.kind.toUpperCase()}`}</Text>
        {usageRow(Box, Text, C, u, now, W >= 60 ? 10 : 6)}
        {weatherRow(Box, Text, C, wx, CFG.temperatureUnit)}
        <Box flexDirection="row" gap={1}>
          <Button key="ball" label="BALL" onPress={() => throwBall($)} />
          <Button key="pat" label="PAT" onPress={() => patPet($)} />
          <Button key="close" role="dismiss" label="CLOSE" onPress={() => $.ui.close({ id: PET_PANE })} />
        </Box>
      </Box>
    )
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PET_PANE) petSim.remote.pane = false
    return next(e)
  })

  // VS Code attaching to a running session gets the pet pane too
  on('session.attach', async ($, e, next) => {
    const r = await next(e)
    if (e.surface === 'vscode' && (await read($, petShown))) void openPetPane($)
    return r
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const W = Math.max(24, e.props.bodyColumns)
    const [t, en, res, entries, themeName, s, err, u, now] = await Promise.all([
      read($, ticket), read($, env), read($, tests), read($, log), read($, theme), read($, story), read($, storyError),
      read($, usage), $.clock.now(),
    ])
    const C = paletteOf(themeName)
    const storyRows = s ? 4 + s.ac.length + s.tasks.length : 2
    const room = Math.max(3, (e.viewport?.rows ?? 30) - 19 - storyRows)
    const shown = entries.slice(-room)
    const first = entries.length - shown.length

    const total = res ? res.passed + res.failed + res.skipped + res.flaky : 0
    const barW = Math.max(8, W - 18)
    const okW = res && total ? Math.round((res.passed / total) * barW) : 0
    const badW = res && total ? Math.round(((res.failed + res.flaky) / total) * barW) : 0

    return (
      <Box flexDirection="column" backgroundColor={C.bg} width={W} paddingX={1}>
        <Text color={C.hi} backgroundColor={C.bg} bold>{'*** QA MONITOR 64 ***'}</Text>
        <Text color={C.fg} backgroundColor={C.bg}> </Text>

        <Text color={C.hi} backgroundColor={C.bg}>BACKLOG</Text>
        {s ? (
          <Box flexDirection="column">
            <Box flexDirection="row">
              <Text color={C.hi} backgroundColor={C.bg} bold>{s.id}</Text>
              <Text color={C[STATUS_TONE[s.status]]} backgroundColor={C.bg} bold>{` [${s.status}]`}</Text>
              <Text color={C.dim} backgroundColor={C.bg} wrap="truncate">{` ${s.statusText}`}</Text>
            </Box>
            <Text color={C.fg} backgroundColor={C.bg} wrap="wrap">{s.title}</Text>
            <Text color={C.dim} backgroundColor={C.bg} wrap="truncate">
              {`${s.epic}${s.points ? ` · ${s.points} PTS` : ''}${s.section ? ` · ${s.section}` : ''}`}
            </Text>
            {s.ac.map((a, i) => (
              <Text color={C.fg} backgroundColor={C.bg} wrap="truncate">{`AC${i + 1} ${a}`}</Text>
            ))}
            {s.tasks.map(x => (
              <Box flexDirection="row">
                <Text color={C[STATUS_TONE[x.status]]} backgroundColor={C.bg}>{pad(x.status, 9)}</Text>
                <Text color={C.dim} backgroundColor={C.bg}>{pad(x.kind.toUpperCase(), 11)}</Text>
                <Text color={C.fg} backgroundColor={C.bg} wrap="truncate">{x.name}</Text>
              </Box>
            ))}
          </Box>
        ) : (
          <Text color={C.dim} backgroundColor={C.bg} wrap="truncate">
            {err ? `${err} ISN'T IN THE PLAN · /story plan TO CHANGE` : 'NO STORY. /story <ID> · /story plan TO SET THE PLAN'}
          </Text>
        )}
        <Text color={C.fg} backgroundColor={C.bg}> </Text>

        {(t || en) && (
          <Box flexDirection="row">
            <Text color={C.dim} backgroundColor={C.bg}>{'TICKET '}</Text>
            <Text color={C.hi} backgroundColor={C.bg} bold>{t ?? '----'}</Text>
            <Text color={C.dim} backgroundColor={C.bg}>{'  ENV '}</Text>
            <Text color={en ? C[ENV_TONE[en] ?? 'hi'] : C.dim} backgroundColor={C.bg} bold>{en ?? '---'}</Text>
          </Box>
        )}
        <Box flexDirection="row">
          <Text color={C.dim} backgroundColor={C.bg}>{'TESTS  '}</Text>
          {res ? (
            <Box flexDirection="row">
              <Text color={C.pass} backgroundColor={C.bg}>{'█'.repeat(okW)}</Text>
              <Text color={C.fail} backgroundColor={C.bg}>{'█'.repeat(badW)}</Text>
              <Text color={C.dim} backgroundColor={C.bg}>{'░'.repeat(Math.max(0, barW - okW - badW))}</Text>
              <Text color={C.hi} backgroundColor={C.bg}>{` ${res.passed}/${total}`}</Text>
            </Box>
          ) : (
            <Text color={C.dim} backgroundColor={C.bg}>NO RUN YET</Text>
          )}
        </Box>
        <Text color={C.fg} backgroundColor={C.bg}> </Text>

        <Text color={C.hi} backgroundColor={C.bg}>USAGE</Text>
        {[['5-HOUR ', u.fiveHour], ['WEEKLY ', u.week]].map(([label, w]) => {
          const win = w as UsageWindow | null
          if (!win) return <Text color={C.dim} backgroundColor={C.bg}>{`${label}NO READING`}</Text>
          const [onB, offB] = bar(win.percent, Math.max(8, W - 26))
          const reset = fmtReset(win.resetsAt, now)
          return (
            <Box flexDirection="row">
              <Text color={C.dim} backgroundColor={C.bg}>{label as string}</Text>
              <Text color={C[usageTone(win.percent)]} backgroundColor={C.bg}>{onB}</Text>
              <Text color={C.dim} backgroundColor={C.bg}>{offB}</Text>
              <Text color={C[usageTone(win.percent)]} backgroundColor={C.bg} bold>{` ${pad(`${Math.round(win.percent)}%`, 4)}`}</Text>
              <Text color={C.dim} backgroundColor={C.bg}>{reset ? ` ↻${reset}` : ''}</Text>
            </Box>
          )
        })}
        {(u.ctxPercent !== null || u.costUsd !== null) && (
          <Text color={C.dim} backgroundColor={C.bg}>
            {`CONTEXT ${u.ctxPercent !== null ? `${Math.round(u.ctxPercent)}%` : '--'}${u.costUsd !== null ? `   SESSION $${u.costUsd.toFixed(2)}` : ''}`}
          </Text>
        )}
        <Text color={C.fg} backgroundColor={C.bg}> </Text>

        <Text color={C.hi} backgroundColor={C.bg}>LIST</Text>
        {shown.length === 0 && <Text color={C.dim} backgroundColor={C.bg}>NO PROGRAM.</Text>}
        {shown.map((l, i) => (
          <Box flexDirection="row">
            <Text color={C.dim} backgroundColor={C.bg}>{pad(String((first + i + 1) * 10), 5)}</Text>
            <Text color={C.info} backgroundColor={C.bg}>{pad(l.tool.toUpperCase(), 9)}</Text>
            <Text color={C.fg} backgroundColor={C.bg}>{pad(l.detail, Math.max(4, W - 2 - 5 - 9 - 4))}</Text>
            <Text color={l.state === 'ok' ? C.pass : l.state === 'err' ? C.fail : C.warn} backgroundColor={C.bg}>
              {l.state === 'ok' ? ' OK' : l.state === 'err' ? ' ?ER' : ' ..'}
            </Text>
          </Box>
        ))}
        <Text color={C.fg} backgroundColor={C.bg}>READY.</Text>
        <Box flexDirection="row" gap={1}>
          <Button key="refresh" hotkey="f" label="RELOAD MD" onPress={() => loadStory($, true).then(() => refreshStatus($))} />
          <Button key="clear" hotkey="c" label="CLR LIST" onPress={() => update($, log, () => [])} />
          <Button key="close" hotkey="x" role="dismiss" label="CLOSE" onPress={() => $.ui.close({ id: PANE })} />
        </Box>
      </Box>
    )
  })

  // 7. /standup64
  on('command.run', { command: 'standup64' }, async $ => {
    const text = await standup($)
    const copied = await $.ui.copy({ text })
    return { text: `${text}\n\n${copied.isCopied ? '(copied to clipboard)' : '(could not copy: select and copy it from here)'}` }
  })

  // 8. /defect
  on('command.run', { command: 'defect' }, async $ => {
    const f = await read($, lastFailure)
    if (!f) return { text: 'No failed test run this session.' }
    const [s, t, en] = await Promise.all([read($, story), read($, ticket), read($, env)])
    const under = s?.id ?? t
    const draft = [
      `${CFG.defectCommand || 'Draft a bug report for'} ${under ?? ''}`.trim(),
      `${f.failed} test(s) failed${en ? ` on ${en}` : ''} running \`${f.command}\`.`,
      ...(f.names.length ? ['Failing:', ...f.names.map(n => `- ${n}`)] : []),
      'Use the run\'s report.json / trace for steps to reproduce, expected vs actual and evidence.',
    ].join('\n')
    const filled = await $.prompt.fill({ text: draft, mode: 'replace' })
    return { text: filled.isFilled ? 'Defect draft is in the prompt: review it and press Enter.' : draft }
  })

  // /guard
  on('command.run', { command: 'guard' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'off' || arg === 'on') {
      await update($, guardOff, () => arg === 'off')
      if (arg === 'on') approvedRisks.clear()
      return { text: arg === 'off' ? 'Guardrails OFF for this session. /guard on restores them.' : 'Guardrails ON.' }
    }
    const off = await read($, guardOff)
    return {
      text: [
        `Guardrails: ${off ? 'OFF' : 'ON'}`,
        'Refused: hand edits to files marked @generated, DO NOT EDIT, or "generated from … regenerate".',
        'Asked first: terraform apply/destroy, Azure resource changes, force pushes, pushes to main/release/prod, kubectl/helm changes, PROD URLs.',
        approvedRisks.size ? `Allowed this session: ${[...approvedRisks].join(', ')}` : '',
      ].filter(Boolean).join('\n'),
    }
  })
}
