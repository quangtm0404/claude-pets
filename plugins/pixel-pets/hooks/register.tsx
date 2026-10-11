import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { PluginOptions, RenderChildren, SessionUsage } from 'claude-code'

import type {
  Failure, GitInfo, LogLine, PetKind, Story, StoryStatus, StoryTask, TestRun, ThemeName, Usage, UsageWindow,
} from '../types'

// ── Themes ──────────────────────────────────────────────────────────────────
// bg/fg the screen, dim/hi the secondary and emphasised text, then the semantic
// colours every status maps onto.
type Palette = {
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
}

type Tone = Exclude<keyof Palette, 'stripes' | 'banner'>
const ENV_TONE: Record<string, Tone> = { DEV: 'pass', TST: 'warn', UAT: 'info', PROD: 'fail' }
const STATUS_TONE: Record<StoryStatus, Tone> = {
  LIVE: 'pass', DONE: 'pass', DARK: 'info', PARTIAL: 'warn', TODO: 'dim', BLOCKED: 'fail', PROPOSED: 'hi', UNKNOWN: 'dim',
}

// ── Backlog sources: markdown, not an issue tracker ───────────────────────────────────
// The band's rows by name. Drawn in the order the `bandRows` setting lists them;
// when space is short they are dropped in DROP_ORDER, first to go first (E1-S03).
export type BandRow = 'banner' | 'git' | 'usage' | 'weather' | 'story' | 'tests'
const DEFAULT_ROWS: BandRow[] = ['banner', 'git', 'usage', 'weather', 'story', 'tests']
const DROP_ORDER: BandRow[] = ['banner', 'git', 'tests', 'story', 'weather', 'usage']

/** The rows a `bandRows` value names, in its order; unknown names ignored, nothing valid means the default. */
// ── Weather (E2): Open-Meteo, no key; nothing is fetched until a place is set ──
type TempUnit = 'both' | 'c' | 'f'
export type WeatherKind = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm'
export type WeatherPlace = { name: string; lat: number; lon: number }
export type Weather = {
  place: string
  tempC: number
  code: number
  kind: WeatherKind
  label: string
  windKmh: number
  isDay: boolean
}
const WINDY_KMH = 30
const WEATHER_EVERY_MS = 15 * 60_000

/** WMO weather codes, as Open-Meteo reports them, to a kind and a label. */
export function wmo(code: number): { kind: WeatherKind; label: string } {
  if (code === 0) return { kind: 'clear', label: 'CLEAR' }
  if (code <= 2) return { kind: 'cloudy', label: code === 1 ? 'MAINLY CLEAR' : 'PARTLY CLOUDY' }
  if (code === 3) return { kind: 'cloudy', label: 'OVERCAST' }
  if (code === 45 || code === 48) return { kind: 'fog', label: 'FOG' }
  if (code >= 51 && code <= 57) return { kind: 'rain', label: 'DRIZZLE' }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { kind: 'rain', label: code >= 80 ? 'SHOWERS' : 'RAIN' }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { kind: 'snow', label: 'SNOW' }
  if (code >= 95) return { kind: 'storm', label: 'THUNDERSTORM' }
  return { kind: 'cloudy', label: 'CLOUDY' }
}

export const toF = (c: number) => Math.round((c * 9) / 5 + 32)
export function fmtTemp(c: number, unit: TempUnit): string {
  const C = `${Math.round(c)}°C`, F = `${toF(c)}°F`
  return unit === 'c' ? C : unit === 'f' ? F : `${C} / ${F}`
}
export const fmtWind = (kmh: number, unit: TempUnit) =>
  unit === 'f' ? `${Math.round(kmh * 0.621)} MPH` : `${Math.round(kmh)} KM/H`

function weatherIcon(wx: Weather): string {
  if (wx.kind === 'clear') return wx.isDay ? '☀' : '☾'
  return { cloudy: '☁', fog: '≋', rain: '☂', snow: '❄', storm: '⚡' }[wx.kind]
}

function weatherRow(Box: unknown, Text: unknown, C: Palette, wx: Weather | null, unit: TempUnit): RenderChildren {
  if (!wx) return null
  const B = Box as never, T = Text as never
  const tone = wx.kind === 'storm' ? C.fail : wx.kind === 'clear' && wx.isDay ? C.warn : C.info
  return h(B, { flexDirection: 'row' },
    h(T, { color: tone, backgroundColor: C.bg, bold: true }, ` ${weatherIcon(wx)} ${fmtTemp(wx.tempC, unit)}`),
    h(T, { color: C.fg, backgroundColor: C.bg }, ` · ${wx.label}`),
    h(T, { color: wx.windKmh >= WINDY_KMH ? C.warn : C.dim, backgroundColor: C.bg }, ` · WIND ${fmtWind(wx.windKmh, unit)}`),
    h(T, { color: C.dim, backgroundColor: C.bg, wrap: 'truncate' }, ` · ${wx.place.toUpperCase()}`),
  ) as RenderChildren
}

/** Finds a place by name (Open-Meteo geocoding). */
async function geocode($: EngineInterface, query: string): Promise<WeatherPlace | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`
  const r = await $.http.fetch(url)
  if (!r.ok) return null
  const hit = (JSON.parse(r.text) as { results?: { name: string; country?: string; latitude: number; longitude: number }[] }).results?.[0]
  return hit ? { name: [hit.name, hit.country].filter(Boolean).join(', '), lat: hit.latitude, lon: hit.longitude } : null
}

/** Where this machine is, by its IP address: only when the person asks (/weather here). */
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
  if (isPetKind(kind)) CFG.petKind = kind
}

const PANE = 'qa-monitor'

const ticket = atom({ plugin: 'pixel-pets', key: 'ticket' } as const, null)
const env = atom({ plugin: 'pixel-pets', key: 'env' } as const, null)
const tokens = atom({ plugin: 'pixel-pets', key: 'tokens' } as const, 0)
const turns = atom({ plugin: 'pixel-pets', key: 'turns' } as const, 0)
const tests = atom({ plugin: 'pixel-pets', key: 'tests' } as const, null)
const log = atom({ plugin: 'pixel-pets', key: 'log' } as const, [])
const isBandHidden = atom({ plugin: 'pixel-pets', key: 'isBandHidden' } as const, false)
const blink = atom({ plugin: 'pixel-pets', key: 'blink' } as const, true)
const theme = atom({ plugin: 'pixel-pets', key: 'theme' } as const, 'ice')
const isThemeName = (x: unknown): x is ThemeName => typeof x === 'string' && Object.hasOwn(THEMES, x)
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

// ── Pet: an 8-bit mini game along the bottom of the band ─────────────────────
// Mini sprites, 7×4 pixels facing left; two pixels stack in one cell with ▀/▄,
// so the pet is two terminal rows tall. The ground row is the game's HUD:
//   ♥♥♥♡♡ LV3 XP 042 ◆7 · PIXEL WANDERS
// Hearts are the plan's headroom (the fuller of the 5-hour and weekly windows),
// coins drop for every tool call that succeeds, bugs crawl in on every error and
// the pet hunts them. XP is saved between sessions.
const PET_ROWS = 3 // 2 rows of pixels (4 px) + the ground row, which carries the HUD
// The pet needs its strip and the READY. line; info rows fill whatever room is left.
const PET_MIN_ROWS = PET_ROWS + 1
const SPRITE_W = 7

type Pose = 'walkA' | 'walkB' | 'sit' | 'sleep'
export type Mood = 'happy' | 'grumpy' | 'furious' | 'gameover'
const GRUMPY_AT = 70
const FURIOUS_AT = 90

const ANGRY_EYE = 0xff2a2a

type PetDef = {
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
  /** Sound files in sounds/: its everyday voice and its cross one. */
  voice: { happy: string; cross: string }
  ideas: string[]
  emoji: string
}

export const PETS: Record<PetKind, PetDef> = {
  cat: {
    colors: { o: 0xf0a040, e: 0x101010 },
    body: ['o.o...o', 'eoe..o.', 'oooooo.'],
    cross: ['.....oo', 'EoE.oo.', 'oooooo.'],
    legs: { walkA: '.o.o.o.', walkB: 'o.o.o..', sit: 'oooooo.' },
    fill: 'o', tuck: true, voice: { happy: 'meow', cross: 'meow_grumpy' },
    ideas: ['Pixel', 'Mochi', 'Byte', 'Sprite'], emoji: '🐈',
  },
  dog: {
    colors: { w: 0xe8d8c0, b: 0x7a4a20, e: 0x101010 },
    body: ['bb.....', 'wewb..w', 'wwwwww.'],
    cross: ['.b.....', 'wEwb.w.', 'wwwwww.'],
    legs: { walkA: '.w.w.w.', walkB: 'w.w.w..', sit: 'wwwwww.' },
    fill: 'w', tuck: true, voice: { happy: 'woof', cross: 'woof_grumpy' },
    ideas: ['Chip', 'Bitsy', 'Rex64', 'Turbo'], emoji: '🐕',
  },
  crab: {
    colors: { r: 0xe8452c, d: 0xa82a18, e: 0xffffff },
    body: ['d.....d', 'dde.edd', '.rrrrr.'],
    cross: ['dd...dd', 'ddE.Edd', '.rrrrr.'],
    legs: { walkA: 'r.r.r.r', walkB: '.r.r.r.', sit: '.rrrrr.' },
    fill: 'd', tuck: false, voice: { happy: 'click', cross: 'click_grumpy' },
    ideas: ['Ferris', 'Pinchy', 'Clawde', 'Sidestep'], emoji: '🦀',
  },
  shark: {
    colors: { g: 0x7d8ea3, w: 0xe9eef3, e: 0x0d0d0d },
    body: ['...g..g', 'geggggg', 'wwwwgg.'],
    cross: ['...g..g', 'gEggggg', '.w.wgg.'],
    legs: { walkA: '......g', walkB: '.......', sit: '.......' },
    fill: 'g', tuck: false, voice: { happy: 'chomp', cross: 'grumble_low' },
    ideas: ['Finn', 'Chompy', 'Bruce', 'Jawsome'], emoji: '🦈',
  },
  turtle: {
    colors: { s: 0x3f8f3a, d: 0x2e6b2b, k: 0x9ccc65, e: 0x101010 },
    body: ['..sss..', 'kedsds.', '.sssss.'],
    cross: ['..sss..', '.Edsds.', '.sssss.'],
    legs: { walkA: '.k...k.', walkB: '..k.k..', sit: '.......' },
    fill: 'k', tuck: false, voice: { happy: 'hum', cross: 'grumble_low' },
    ideas: ['Shelly', 'Tank', 'Crush', 'Sheldon'], emoji: '🐢',
  },
  mouse: {
    colors: { m: 0xb8b8c4, p: 0xff9eb5, e: 0x101010 },
    body: ['.pp....', 'pemmm..', '.mmmmpp'],
    cross: ['.p.....', 'pEmmm..', '.mmmm.p'],
    legs: { walkA: '.m.m...', walkB: 'm.m....', sit: '.mmm...' },
    fill: 'm', tuck: false, voice: { happy: 'squeak', cross: 'grumble_high' },
    ideas: ['Cheddar', 'Nibbles', 'Clicky', 'Squeak'], emoji: '🐁',
  },
  fox: {
    colors: { f: 0xe8742a, w: 0xf5f5f5, k: 0x2a1a10, e: 0x101010 },
    body: ['f.f....', 'wef..ff', 'ffffffw'],
    cross: ['.....ff', 'wEf.ffw', 'ffffff.'],
    legs: { walkA: '.k.k.k.', walkB: 'k.k.k..', sit: 'ffffff.' },
    fill: 'f', tuck: true, voice: { happy: 'yip', cross: 'grumble_high' },
    ideas: ['Rusty', 'Ember', 'Firefox', 'Todd'], emoji: '🦊',
  },
  orca: {
    colors: { k: 0x151515, w: 0xf0f0f0, e: 0xf0f0f0 },
    body: ['...k...', 'kekkkk.', 'wwwkkkk'],
    legs: { walkA: '......k', walkB: '.....k.', sit: '.......' },
    fill: 'k', tuck: false, voice: { happy: 'song', cross: 'grumble_low' },
    ideas: ['Tux', 'Domino', 'Shamu', 'Oreo'], emoji: '🐋',
  },
  whale: {
    colors: { b: 0x3a6fd0, l: 0x9cc3ff, e: 0x101010 },
    body: ['.l.....', 'bebbbb.', 'llbbbbb'],
    cross: ['.......', 'bEbbbb.', 'llbbbbb'],
    legs: { walkA: '.....bb', walkB: '......b', sit: '.......' },
    fill: 'b', tuck: false, voice: { happy: 'song', cross: 'grumble_low' },
    ideas: ['Moby', 'Bubbles', 'Blue', 'Humphrey'], emoji: '🐳',
  },
  dolphin: {
    colors: { g: 0x6fa8dc, w: 0xdfefff, e: 0x101010 },
    body: ['...g...', '.egggg.', 'gwwwggg'],
    legs: { walkA: '......g', walkB: '.....g.', sit: '.......' },
    fill: 'g', tuck: false, voice: { happy: 'whistle', cross: 'grumble_high' },
    ideas: ['Flipper', 'Echo', 'Splash', 'Clicker'], emoji: '🐬',
  },
  giraffe: {
    colors: { y: 0xf2c14e, o: 0xa0522d, e: 0x101010 },
    body: ['eyo....', '.y.....', '.yoyoyo'],
    legs: { walkA: '.y.y.y.', walkB: 'y.y.y..', sit: '.yyyyy.' },
    fill: 'y', tuck: false, voice: { happy: 'hum', cross: 'grumble_low' },
    ideas: ['Stretch', 'Patches', 'Highway', 'Geoffrey'], emoji: '🦒',
  },
  tiger: {
    colors: { t: 0xf08a24, k: 0x1a1a1a, e: 0x101010 },
    body: ['t.t...t', 'ete..t.', 'tktktk.'],
    cross: ['.....tt', 'EtE.tt.', 'tktktk.'],
    legs: { walkA: '.t.t.t.', walkB: 't.t.t..', sit: 'tktktk.' },
    fill: 't', tuck: true, voice: { happy: 'roar', cross: 'grumble_low' },
    ideas: ['Stripes', 'Rajah', 'Hobbes', 'Tigger'], emoji: '🐅',
  },
  squirrel: {
    colors: { r: 0xb5651d, c: 0xf3d9b1, e: 0x101010 },
    body: ['r...rr.', 'err.rrr', 'crrrrr.'],
    legs: { walkA: '.r.r...', walkB: 'r.r....', sit: '.rrr...' },
    fill: 'r', tuck: false, voice: { happy: 'chitter', cross: 'grumble_high' },
    ideas: ['Nutmeg', 'Acorn', 'Hazel', 'Scrat'], emoji: '🐿',
  },
  penguin: {
    colors: { k: 0x1c1c28, w: 0xf2f2f2, y: 0xffa31a, e: 0x101010 },
    body: ['.kk....', 'yewk...', '.wwk...'],
    legs: { walkA: '.y..y..', walkB: '..yy...', sit: '.yy....' },
    fill: 'w', tuck: false, voice: { happy: 'honk', cross: 'grumble_high' },
    ideas: ['Pingu', 'Waddles', 'Tux', 'Skipper'], emoji: '🐧',
  },
}
export const PET_KINDS = Object.keys(PETS) as PetKind[]
export const isPetKind = (x: unknown): x is PetKind => typeof x === 'string' && (PETS as Record<string, unknown>)[x] !== undefined

/** The 4 pixel rows of one pose and mood, facing left. */
/** A helper (a subagent's pet): the parent's front half, 5×3 pixels (face, body, legs). */
export function babySprite(kind: PetKind, pose: Pose): string[] {
  return sprite(kind, pose).slice(1).map(row => row.slice(0, KID_W))
}
const KID_W = 5

export function sprite(kind: PetKind, pose: Pose, mood: Mood = 'happy'): string[] {
  const def = PETS[kind]
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

function b64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
const hex = (c: string) => parseInt(c.slice(1), 16)

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
}

const COIN = 0xffd23f, COIN_SHINE = 0xfff6a0, BUG = 0xb04cff, BUG_LEGS = 0x6a1fb0

/** Packs one frame into Raster cells: [codePoint, fg, bg] u32 triplets, row-major. */
export function petCells(f: PetFrame): string {
  const W = f.columns, H = (PET_ROWS - 1) * 2
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
        const y = 2 + ((Math.floor(t / (isSnow ? 3 : 1)) + hash(x + 5)) % 2)
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
  const colors: Record<string, number> = { E: ANGRY_EYE, ...PETS[f.kind].colors }
  for (const k of f.kids ?? []) {
    babySprite(f.kind, k.pose).forEach((row, ry) => {
      for (let rx = 0; rx < KID_W; rx++) {
        const c = colors[row[k.dir === 1 ? KID_W - 1 - rx : rx] ?? '.']
        if (c !== undefined) set(Math.round(k.x) + rx, 1 + ry, c)
      }
    })
  }
  const x0 = Math.round(f.x), y0 = -f.lift
  sprite(f.kind, f.pose, f.mood).forEach((row, ry) => {
    for (let rx = 0; rx < SPRITE_W; rx++) {
      const c = colors[row[f.dir === 1 ? SPRITE_W - 1 - rx : rx] ?? '.']
      if (c !== undefined) set(x0 + rx, y0 + ry, c)
    }
  })

  const bg = hex(f.bg), ground = hex(f.ground)
  const words = new Uint32Array(W * PET_ROWS * 3)
  const put = (i: number, cp: number, fg: number, back: number) => {
    words[i * 3] = cp
    words[i * 3 + 1] = fg
    words[i * 3 + 2] = back
  }
  for (let r = 0; r < PET_ROWS - 1; r++) {
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
  const groundAt = (PET_ROWS - 1) * W
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
    const tx = Math.min(W - 1, Math.max(0, Math.round(k.x) + 2))
    if (px[tx] === null && px[W + tx] === null) put(tx, k.tag.codePointAt(0) ?? 0x3f, k.tagColor, bg)
  }
  if (f.bubble) {
    const bx = Math.min(W - 1, Math.max(0, x0 + (f.dir === 1 ? SPRITE_W : -1)))
    put(bx, f.bubble.glyph.codePointAt(0) ?? 0x21, f.bubble.color, bg)
  }
  return b64(new Uint8Array(words.buffer))
}

/** XP needed grows with the level: LV2 at 15, LV3 at 60, LV4 at 135… */
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
  sitUntil: 0,
  react: null as null | { glyph: string; tone: Tone; until: number; jump: boolean },
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

function petReact(glyph: string, tone: Tone, ms: number, now: number, jump = false) {
  petSim.react = { glyph, tone, until: now + ms, jump }
}

/** The pet, or the settings' starting pet until one has been chosen or named. */
async function readPet($: EngineInterface): Promise<{ kind: PetKind; name: string }> {
  const p = await read($, petState)
  return p.name ? p : { kind: CFG.petKind, name: CFG.petName }
}

/** A coin drops somewhere the pet is not standing (a successful tool call). */
function spawnCoin() {
  const s = petSim
  if (s.columns < SPRITE_W + 4 || s.coins.length >= 6) return
  for (let tries = 0; tries < 6; tries++) {
    const x = 2 + Math.floor(Math.random() * (s.columns - 4))
    if (x < s.x - 1 || x > s.x + SPRITE_W) {
      s.coins.push(x)
      return
    }
  }
}

/** A bug crawls in from the edge furthest from the pet (an error). */
function spawnBug() {
  const s = petSim
  if (s.columns < SPRITE_W + 4 || s.bugs.length >= 4) return
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
  if (after > before) {
    const pet = await readPet($)
    petReact('★', 'warn', 3000, await $.clock.now(), true)
    $.ui.toast(`▶ LEVEL UP! ${pet.name.toUpperCase()} IS NOW LV${after}`, { timeoutMs: 6000 })
    void petVoice($)
    await saveXp($)
  }
}

// ── Profile, pet board, streaks and achievements (E3) ───────────────────────
export type XpReason = 'coin' | 'bug' | 'helper' | 'green' | 'turn' | 'ball' | 'other'
export type Profile = {
  since: string
  totals: { xp: number; coins: number; bugs: number; helpers: number; green: number; turns: number; balls: number }
  byKind: Record<string, number>
  streak: { days: number; best: number; last: string }
  badges: string[]
}
const COUNTER: Partial<Record<XpReason, keyof Profile['totals']>> = {
  coin: 'coins', bug: 'bugs', helper: 'helpers', green: 'green', turn: 'turns', ball: 'balls',
}

export const ACHIEVEMENTS: { id: string; title: string; hint: string; earned: (p: Profile, level: number) => boolean }[] = [
  { id: 'first-coin', title: 'FIRST COIN', hint: 'collect a coin', earned: p => p.totals.coins >= 1 },
  { id: 'bug-squasher', title: 'BUG SQUASHER', hint: 'squash 10 bugs', earned: p => p.totals.bugs >= 10 },
  { id: 'pack-leader', title: 'PACK LEADER', hint: 'welcome 10 helpers home', earned: p => p.totals.helpers >= 10 },
  { id: 'green-streak', title: 'GREEN STREAK', hint: '5 green test runs', earned: p => p.totals.green >= 5 },
  { id: 'week-streak', title: "A WEEK'S STREAK", hint: 'play 7 days in a row', earned: p => p.streak.days >= 7 },
  { id: 'lv5', title: 'LEVEL 5', hint: 'reach LV5', earned: (_p, lv) => lv >= 5 },
  { id: 'lv10', title: 'LEVEL 10', hint: 'reach LV10', earned: (_p, lv) => lv >= 10 },
  { id: 'zoo-keeper', title: 'ZOO KEEPER', hint: 'raise 5 different animals', earned: p => Object.keys(p.byKind).length >= 5 },
]

/** A local calendar date, YYYY-MM-DD. */
export const dayOf = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** One day's play updates the streak: the same day does nothing, the next day adds one, a gap starts over. */
export function nextStreak(st: Profile['streak'], today: string): Profile['streak'] {
  if (st.last === today) return st
  const yesterday = dayOf(Date.parse(`${today}T12:00:00`) - 86_400_000)
  const days = st.last === yesterday ? st.days + 1 : 1
  return { days, best: Math.max(st.best, days), last: today }
}

function freshProfile(today: string): Profile {
  return {
    since: today,
    totals: { xp: 0, coins: 0, bugs: 0, helpers: 0, green: 0, turns: 0, balls: 0 },
    byKind: {},
    streak: { days: 0, best: 0, last: '' },
    badges: [],
  }
}

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
  const p = await bumpProfile($, prof => {
    prof.totals.xp += n
    prof.byKind[pet.kind] = (prof.byKind[pet.kind] ?? 0) + n
    const counter = COUNTER[why]
    if (counter) prof.totals[counter] += why === 'coin' || why === 'bug' ? count : 1
    if (why === 'turn') prof.streak = nextStreak(prof.streak, today)
  }, n)
  // achievements unlock once each, with a notice
  const fresh = ACHIEVEMENTS.filter(a => !p.badges.includes(a.id) && a.earned(p, level))
  if (fresh.length) {
    await bumpProfile($, prof => {
      for (const a of fresh) if (!prof.badges.includes(a.id)) prof.badges.push(a.id)
    })
    for (const a of fresh) $.ui.toast(`▶ ACHIEVEMENT: ${a.title}`, { timeoutMs: 7000 })
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
      body: JSON.stringify(await boardScore($)),
    })
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

async function petTick($: EngineInterface) {
  const s = petSim
  if (!s.isMounted || s.columns < SPRITE_W + 2) return
  const now = await $.clock.now()
  if (s.lastActive === 0) s.lastActive = now
  await loadXp($)
  const [pet, themeName] = await Promise.all([readPet($), read($, theme)])
  const C = THEMES[themeName]
  const name = pet.name.toUpperCase()
  s.tick++
  if (s.react && s.react.until < now) s.react = null
  const maxX = s.columns - SPRITE_W
  const sparkle = s.tick % 6 < 3

  // bugs crawl
  for (const b of s.bugs) {
    if (s.tick % 3 === 0) b.x += 0.5 * b.dir
    if (b.x <= 0 || b.x >= s.columns - 2) b.dir = b.dir === 1 ? -1 : 1
  }
  const nearestBug = s.bugs.slice().sort((a, b) => Math.abs(a.x - s.x) - Math.abs(b.x - s.x))[0]
  const nearestCoin = s.coins.slice().sort((a, b) => Math.abs(a - s.x) - Math.abs(b - s.x))[0]

  let pose: Pose = 'sit', lift = 0, speed = 0, line: string
  let bubble: PetFrame['bubble'] = null
  const walk = (every: number) => (Math.floor(s.tick / every) % 2 ? 'walkA' : 'walkB') as Pose
  const face = (target: number) => {
    s.dir = target > s.x + SPRITE_W / 2 ? 1 : -1
  }

  if (s.mood === 'gameover') {
    pose = 'sleep'
    bubble = { glyph: s.tick % 16 < 8 ? 'x' : 'X', color: hex(C.fail) }
    line = `GAME OVER${s.resetText ? ` · CONTINUE IN ${s.resetText}` : ''}`
  } else if (s.ballX !== null) {
    speed = 1.1
    face(s.ballX)
    pose = walk(1)
    line = `${name} CHASES THE BALL`
    const mouth = s.x + (s.dir === 1 ? SPRITE_W - 2 : 0)
    if (Math.abs(s.ballX - mouth) < 1.5) {
      s.ballX = null
      petReact('♥', 'fail', 2500, now, true)
      void gainXp($, 2, 'ball')
    }
  } else if (s.react) {
    lift = s.react.jump && s.tick % 4 < 2 ? 1 : 0
    bubble = { glyph: s.react.glyph, color: hex(C[s.react.tone]) }
    line = s.react.glyph === '♥' ? `${name} IS HAPPY`
      : s.react.glyph === '★' ? `${name} LEVELLED UP`
      : s.react.glyph === '*' ? `${name} SQUASHED A BUG`
      : `${name} SAW AN ERROR`
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
      k.dir = s.x + SPRITE_W / 2 > k.x + KID_W / 2 ? 1 : -1
      k.x += 1.3 * k.dir
      if (Math.abs(k.x + KID_W / 2 - (s.x + SPRITE_W / 2)) < 3 || now - k.doneAt > 8000) await bringHome($, k)
    }
    if (k.x <= 0) { k.x = 0; k.dir = 1 }
    if (k.x >= s.columns - KID_W) { k.x = s.columns - KID_W; k.dir = -1 }
  }
  const working = s.kids.filter(k => k.state === 'work').length
  if (working && !s.react && s.mood !== 'gameover') line = `${line} · ${working} HELPER${working === 1 ? '' : 'S'} OUT`

  // pick-ups and stomps
  const left = s.x - 0.5, right = s.x + SPRITE_W - 0.5
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

  const cells = petCells({
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
  })
  s.lastCells = cells
  const shown = await $.ui.blit({ requestId: s.requestId, key: 'pet', cells, columns: s.columns, rows: PET_ROWS })
  if (shown.deny !== undefined) s.isMounted = false
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
  const side = s.dir === 1 ? -KID_W - 1 : SPRITE_W + 1
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
  const maxX = Math.max(SPRITE_W, s.columns - 3)
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
    description: 'An 8-bit pet game in the band: /pet (show/hide) · /pet board · /pet board world · /pet join · /pet leave · /pet stats · /pet list · /pet <animal> · /pet name [Mochi] · /pet ball · /pet pat',
  },
  // not `standup`: other plugins commonly own that name
  { name: 'standup64', description: 'Three-line standup (Done / Next / Blockers) from this session, copied to the clipboard' },
  { name: 'defect', description: 'Draft a bug report for the last failed test run into the prompt' },
  { name: 'weather', description: 'Local weather in the band: /weather <city> · /weather here (IP lookup) · /weather off · /weather' },
  { name: 'guard', description: 'Claude Pets guardrails: /guard (status) · /guard off · /guard on' },
  { name: 'retro', description: 'Toggle the Claude Pets band · /retro theme ice|phosphor|amber|c64 · /retro sound on|off' },
]

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
    if ((await $.store.get('chimeOn')) === false) await update($, chimeOn, () => false)
    void refreshGit($)
    $.clock.every(10000, () => void refreshGit($))
    $.clock.every(140, () => void petTick($))
    const savedTheme = await $.store.get('theme')
    if (isThemeName(savedTheme)) {
      await update($, theme, () => savedTheme)
    }
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
      return { text: `Pets: ${PET_KINDS.map(k => `${PETS[k].emoji} ${k}`).join(' · ')}\nSwitch with /pet <animal>; your XP and name stay.` }
    }
    if (isPetKind(kind)) {
      const k: PetKind = kind
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
          `Mood: ${petSim.mood.toUpperCase()}${petSim.limitLabel ? ` (${petSim.limitLabel}${petSim.resetText ? `, resets in ${petSim.resetText}` : ''})` : ''}`,
          `This session: ◆${petSim.collected} coins · ${petSim.bugs.length} bug(s) loose`,
          `Helpers: ${petSim.kids.filter(k => k.state === 'work').length} out working${petSim.kids.length ? ` (${petSim.kids.map(k => `#${k.n} ${k.label || 'subagent'}: ${k.xp} XP`).join(', ')})` : ''} · ${petSim.kidsHome} came home (+${petSim.kidXp} XP)`,
          'XP: +1 coin (a tool call that worked) · +5 bug squashed (an error) · +10 green test run · +2 per turn · +2 ball · helpers: +1 per subagent call that worked, +5 when its job is done',
        ].join('\n'),
      }
    } else if (args === '') {
      const shown = await update($, petShown, v => !v)
      await $.store.set('petShown', shown)
      const pet = await readPet($)
      return {
        text: shown ? `${pet.name} the ${pet.kind} joins the band. READY.` : `${pet.name} is resting. /pet brings them back.`,
      }
    } else {
      return { text: 'Usage: /pet (show/hide) · /pet board · /pet board world · /pet join · /pet leave · /pet stats · /pet list · /pet <animal> · /pet name [Mochi] · /pet ball · /pet pat' }
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
    const m = /^theme\s+(\w+)/i.exec(e.args.trim())
    if (m) {
      const name = (m[1] ?? '').toLowerCase()
      if (!isThemeName(name)) {
        return { text: 'Themes: ice (cyan on navy) · phosphor (green CRT) · amber · c64' }
      }
      await update($, theme, () => name)
      await $.store.set('theme', name)
      return { text: `Theme: ${name.toUpperCase()}. READY.` }
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

  on('command.run', { command: 'weather' }, async ($, e) => {
    const args = e.args.trim()
    if (/^(off|clear|none)$/i.test(args)) {
      await $.store.set('weatherPlace', null)
      await refreshWeather($)
      return { text: 'Weather off: no place is stored, and nothing is fetched.' }
    }
    if (!args) {
      const wx = await read($, weather)
      const place = await readPlace($)
      if (!place) return { text: 'No place set. /weather <city> sets one; /weather here looks yours up from your IP address.' }
      return {
        text: wx
          ? `${wx.place}: ${fmtTemp(wx.tempC, CFG.temperatureUnit)}, ${wx.label.toLowerCase()}, wind ${fmtWind(wx.windKmh, CFG.temperatureUnit).toLowerCase()} (Open-Meteo, every 15 minutes).`
          : `${place.name}: no reading yet.`,
      }
    }
    const isHere = /^here$/i.test(args)
    const place = isHere ? await placeFromIp($).catch(() => null) : await geocode($, args).catch(() => null)
    if (!place) return { text: isHere ? 'Could not look up your place from your IP address. Try /weather <city>.' : `No place called "${args}" found.` }
    await $.store.set('weatherPlace', place)
    await refreshWeather($)
    const wx = await read($, weather)
    return {
      text: `Weather for ${place.name}${isHere ? ' (from your IP address, via ipapi.co)' : ''}`
        + (wx ? `: ${fmtTemp(wx.tempC, CFG.temperatureUnit)}, ${wx.label.toLowerCase()}.` : '.'),
    }
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
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      isWorking = false
      petSim.isWorking = false
      petSim.lastActive = await $.clock.now()
      const u = e.usage
      if (u) await update($, tokens, n => n + u.input_tokens + u.output_tokens + u.cache_creation_input_tokens)
      await update($, turns, n => n + 1)
      // a plan that can't be read never costs the turn its XP
      await loadStory($).catch(() => undefined)
      void refreshStatus($)
      void refreshGit($)
      if (!e.isAborted) await gainXp($, 2, 'turn')
      if (!e.isAborted && e.durationMs >= DONE_SOUND_AFTER_MS) {
        $.ui.toast(`▶ DONE IN ${fmtDuration(e.durationMs)}. READY.`, { timeoutMs: 6000 })
        void petVoice($)
      }
      await saveXp($)
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
    const ran = await next(e)
    const ok = ran.deny === undefined && ran.isError !== true
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

    if (String(e.tool) === 'Bash' && TEST_CMD_RE.test(line.detail)) {
      const res = parseTests(line.detail, ran.text ?? '')
      if (res) {
        await update($, tests, () => res)
        petReact(res.failed ? '!' : '♥', 'fail', 3500, await $.clock.now(), res.failed === 0)
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
    if (e.props.hasSurvey || (await read($, isBandHidden))) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const W = Math.max(20, e.props.bodyColumns)
    const isTerminal = e.surface === 'terminal'
    const wantsPet = (await read($, petShown)) && e.props.maxRows >= PET_MIN_ROWS
    const withStrip = wantsPet && isTerminal
    const [t, en, tok, res, model, cursor, entries, themeName, s, err, u, now, pet, line] = await Promise.all([
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
      wantsPet && !isTerminal ? read($, petLine) : Promise.resolve(''),
    ])
    const g = await read($, git)
    const plan = await read($, planLabel)
    const wx = await read($, weather)
    const C = THEMES[themeName]
    let strip: RenderChildren = null
    if (withStrip && e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      const columns = Math.max(SPRITE_W + 2, Math.min(512, W - 2))
      if (petSim.columns !== columns || !petSim.lastCells) {
        petSim.columns = columns
        if (petSim.x > columns - SPRITE_W) petSim.x = columns - SPRITE_W
        petSim.lastCells = petCells({
          kind: pet.kind, columns, x: petSim.x, dir: petSim.dir, pose: 'sit', mood: petSim.mood, lift: 0,
          bubble: null, ballX: petSim.ballX, coins: petSim.coins, bugs: petSim.bugs, sparkle: false,
          bg: C.bg, ground: C.dim, cursor: null,
          hud: hud(C, pet.name.toUpperCase(), `${pet.name.toUpperCase()} THE ${pet.kind.toUpperCase()}`),
        })
      }
      petSim.requestId = e.requestId
      petSim.isMounted = true
      strip = <Raster key="pet" columns={columns} rows={PET_ROWS} cells={petSim.lastCells} />
    } else {
      petSim.isMounted = false
    }
    const left = Math.max(0, Math.floor((W - 2 - C.banner.length) / 2))
    const running = entries.filter(l => l.state === 'run').pop()
    const doneTasks = s ? s.tasks.filter(x => x.status === 'LIVE' || x.status === 'DONE').length : 0

    // Each row, or null when it has nothing to show (E1-S02: no plan, no story and
    // no ticket means no story row at all, rather than a prompt to set one up).
    const rows: Record<BandRow, RenderChildren> = {
      banner: (
        <Box flexDirection="row">
          <Text color={C.fg} backgroundColor={C.bg} bold>
            {pad(' '.repeat(left) + C.banner, W - 2 - C.stripes.length * 2)}
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
    const room = e.props.maxRows - 1 - (strip ? PET_ROWS : e.props.isWorking ? 0 : 1)
    const present = CFG.bandRows.filter(r => rows[r] !== null && rows[r] !== undefined && rows[r] !== false)
    const kept = keepRows(present, room)

    return (
      <Box flexDirection="column" width={W} backgroundColor={C.bg} paddingX={1}>
        {present.filter(r => kept.has(r)).map(r => rows[r])}
        {e.props.isWorking ? (
          <Text color={C.warn} backgroundColor={C.bg} wrap="truncate">
            {` RUN ${running ? `${running.tool.toUpperCase()} ${running.detail}` : ''}`.trimEnd() + '…'}
          </Text>
        ) : (
          <Text color={C.fg} backgroundColor={C.bg}>{' READY.'}</Text>
        )}
        {strip}
        {!strip && !e.props.isWorking && (
          <Text color={cursor ? C.fg : C.bg} backgroundColor={C.bg}>{' █'}</Text>
        )}
        {wantsPet && !isTerminal && (
          <Text color={C.dim} backgroundColor={C.bg} wrap="truncate">
            {` ${PETS[pet.kind].emoji} ${line || pet.name.toUpperCase()}`}
          </Text>
        )}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const W = Math.max(24, e.props.bodyColumns)
    const [t, en, res, entries, themeName, s, err, u, now] = await Promise.all([
      read($, ticket), read($, env), read($, tests), read($, log), read($, theme), read($, story), read($, storyError),
      read($, usage), $.clock.now(),
    ])
    const C = THEMES[themeName]
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
