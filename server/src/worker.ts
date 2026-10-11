/**
 * Claude Pets shared leaderboard: a Cloudflare Worker over one D1 table (E4).
 *
 *   POST   /v1/join   { githubToken }        → { login, apiKey }   (E4-S02)
 *   PUT    /v1/score  { xp, level, favPet, streak, bestStreak }   (E4-S03)
 *   GET    /v1/board?limit=20                → { top, me? }        (E4-S01, E4-S04)
 *   DELETE /v1/me                                                  (E4-S01)
 *   PUT    /v1/me     { visitsOff }                               (E7-S02)
 *   GET    /v1/pet/:login                    → the pet, to visit   (E7-S02)
 *   GET    /card/:login.svg                  → a live badge        (E7-S01)
 *
 * Signed-in calls carry `Authorization: Bearer <apiKey>`. The GitHub token sent to
 * /v1/join is used once to read the login and is never stored; only a SHA-256 hash
 * of the API key is kept. No dependencies; erasable TypeScript only, so Node runs
 * it directly in the tests.
 */

import { ART, ITEMS, babySprite, extrasFor, sprite, stageOf } from '../../plugins/pixel-pets/hooks/art.ts'
import type { ItemId } from '../../plugins/pixel-pets/hooks/art.ts'
import type { PetKind } from '../../plugins/pixel-pets/types/index.d.ts'

export type Row = {
  github_id: number
  login: string
  key_hash: string
  xp: number
  level: number
  fav_pet: string
  streak: number
  best_streak: number
  joined_at: number
  updated_at: number | null
  look: string
  visits_off: number
}

/** What a pet looks like on a badge and on a visit (E7): what it wears and the player's colours. */
export type Look = { wearing: ItemId[]; fg: string; bg: string }
const DEFAULT_LOOK: Look = { wearing: [], fg: '#5FE1FF', bg: '#06131F' }
const HEX = /^#[0-9A-Fa-f]{6}$/

/** A look sent with a score, kept only if every part is valid; null otherwise. */
export function parseLook(v: unknown): Look | null {
  if (!v || typeof v !== 'object') return null
  const l = v as Record<string, unknown>
  const wearing = Array.isArray(l.wearing) ? l.wearing : []
  if (wearing.length > 4 || !wearing.every(w => typeof w === 'string' && Object.hasOwn(ITEMS, w))) return null
  if (typeof l.fg !== 'string' || !HEX.test(l.fg) || typeof l.bg !== 'string' || !HEX.test(l.bg)) return null
  return { wearing: [...new Set(wearing as ItemId[])], fg: l.fg.toUpperCase(), bg: l.bg.toUpperCase() }
}
const lookOf = (r: Row): Look => {
  try {
    return parseLook(JSON.parse(r.look)) ?? DEFAULT_LOOK
  } catch {
    return DEFAULT_LOOK
  }
}

type Statement = {
  bind(...values: unknown[]): Statement
  first<T = Record<string, unknown>>(): Promise<T | null>
  run(): Promise<unknown>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
}

export type Env = {
  DB: { prepare(sql: string): Statement }
  /** Overridden in tests; GitHub's API otherwise. */
  GITHUB_API?: string
}

export const PETS = [
  'cat', 'dog', 'crab', 'shark', 'turtle', 'mouse', 'fox',
  'orca', 'whale', 'dolphin', 'giraffe', 'tiger', 'squirrel', 'penguin',
]
/** The plugin's level curve: LV2 at 15 XP, LV3 at 60, LV4 at 135… */
export const levelOf = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 15)) + 1

export const LIMITS = {
  /** A player sends at most once a minute. */
  minGapMs: 60_000,
  /** XP may rise at most this much per hour since the last score (and at least `xpFloor`). */
  xpPerHour: 600,
  xpFloor: 10,
  /** The first score after joining may carry earlier progress, up to this. */
  firstScoreMax: 100_000,
  maxXp: 1_000_000_000,
  maxStreak: 3650,
  boardMax: 100,
}

const json = (status: number, body: unknown) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
const fail = (status: number, error: string) => json(status, { error })

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

function newKey(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return 'cp_' + [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
}

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

export type Score = { xp: number; level: number; favPet: string; streak: number; bestStreak: number }

/**
 * Whether a score is possible, given the player's last one (E4-S03). Returns the
 * reason it is refused, or null.
 */
export function refuseScore(score: Partial<Score>, prev: Row, now: number): string | null {
  const { xp, level, favPet, streak, bestStreak } = score
  if (!isInt(xp, 0, LIMITS.maxXp)) return 'xp must be a whole number of XP'
  if (level !== levelOf(xp)) return `level ${String(level)} does not match ${xp} XP (expected ${levelOf(xp)})`
  if (typeof favPet !== 'string' || !PETS.includes(favPet)) return 'favPet must be one of the roster'
  if (!isInt(streak, 0, LIMITS.maxStreak) || !isInt(bestStreak, 0, LIMITS.maxStreak)) return 'streaks must be whole days'
  if (bestStreak < streak) return 'bestStreak may not be below streak'
  if (prev.updated_at === null) {
    return xp > LIMITS.firstScoreMax ? `a first score may carry at most ${LIMITS.firstScoreMax} XP` : null
  }
  if (xp < prev.xp) return 'xp may not go down'
  const hours = (now - prev.updated_at) / 3_600_000
  const allowed = Math.max(LIMITS.xpFloor, Math.ceil(LIMITS.xpPerHour * hours))
  if (xp - prev.xp > allowed) return `xp rose by ${xp - prev.xp}, more than ${allowed} allowed since the last score`
  const days = Math.floor(hours / 24)
  if (streak > prev.streak + days + 1) return 'streak grew faster than the days that passed'
  return null
}

async function caller(req: Request, env: Env): Promise<Row | null> {
  const auth = req.headers.get('authorization') ?? ''
  const key = /^Bearer\s+(cp_[0-9a-f]{64})$/.exec(auth)?.[1]
  if (!key) return null
  return env.DB.prepare('SELECT * FROM players WHERE key_hash = ?').bind(await sha256(key)).first<Row>()
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  const text = await req.text()
  if (text.length > 4096) return null
  try {
    const v = JSON.parse(text) as unknown
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

async function rankOf(env: Env, xp: number): Promise<number> {
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM players WHERE updated_at IS NOT NULL AND xp > ?').bind(xp).first<{ n: number }>()
  return Number(r?.n ?? 0) + 1
}

const publicRow = (r: Row, rank: number) => ({
  rank, login: r.login, level: r.level, xp: r.xp, favPet: r.fav_pet, streak: r.streak, bestStreak: r.best_streak,
})

// ── The badge (E7-S01) ───────────────────────────────────────────────────────
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const hex6 = (c: number) => `#${c.toString(16).padStart(6, '0')}`
const mixHex = (a: string, b: string, t: number) => {
  const x = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), y = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16))
  return '#' + x.map((v, i) => Math.round(v + ((y[i] ?? 0) - v) * t).toString(16).padStart(2, '0')).join('')
}

const isLight = (c: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
  return (0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)) / 255 > 0.5
}

/** The pet's pixels as rects, facing right, its top-left at (x, y), `p` pixels a side. */
export function petRects(kind: PetKind, level: number, wearing: ItemId[], x: number, y: number, p: number): string {
  const stage = stageOf(level)
  const rows = stage === 'baby' ? babySprite(kind, 'sit') : sprite(kind, 'sit')
  const sw = rows[0]?.length ?? 7, top = 4 - rows.length
  const colors = ART[kind].colors
  const at = (sx: number) => x + (sw - 1 - sx) * p
  let out = ''
  rows.forEach((row, sy) => {
    for (let sx = 0; sx < sw; sx++) {
      const c = colors[row[sx] ?? '.']
      if (c !== undefined) out += `<rect x="${at(sx)}" y="${y + (top + sy) * p}" width="${p}" height="${p}" fill="${hex6(c)}"/>`
    }
  })
  for (const [sx, sy, c] of extrasFor(kind, stage, wearing, 0)) {
    out += `<rect x="${at(sx)}" y="${y + (top + sy) * p}" width="${p}" height="${p}" fill="${hex6(c)}"/>`
  }
  return out
}

export function cardSvg(r: Row): string {
  const look = lookOf(r)
  const { fg, bg } = look
  const dim = mixHex(bg, fg, 0.55)
  const kind = (PETS.includes(r.fav_pet) ? r.fav_pet : 'cat') as PetKind
  const w = 420, h = 110, font = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(r.login)}'s Claude Pet: LV${r.level}, ${r.xp} XP">`,
    `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="8" fill="${bg}" stroke="${dim}" stroke-width="2"/>`,
    `<g shape-rendering="crispEdges">${petRects(kind, r.level, look.wearing, 24, 32, 10)}</g>`,
    `<rect x="16" y="${32 + 40 + 2}" width="88" height="3" fill="${dim}"/>`,
    `<g font-family="${font}">`,
    `<text x="124" y="34" font-size="18" font-weight="bold" fill="${fg}">${esc(r.login)}</text>`,
    `<text x="124" y="58" font-size="14" fill="${mixHex(fg, isLight(bg) ? '#000000' : '#FFFFFF', 0.6)}">LV${r.level} ${esc(stageOf(r.level).toUpperCase())} ${esc(kind.toUpperCase())} · ${r.xp.toLocaleString('en-US')} XP</text>`,
    `<text x="124" y="80" font-size="13" fill="${dim}">streak ${r.streak} day${r.streak === 1 ? '' : 's'} · best ${r.best_streak}</text>`,
    `<text x="124" y="98" font-size="11" fill="${dim}">**** CLAUDE PETS ****</text>`,
    '</g></svg>',
  ].join('')
}

const svg = (status: number, body: string) =>
  new Response(body, {
    status,
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
      // a badge draws itself; nothing in it may run or load
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
    },
  })
const NO_CARD = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="40" viewBox="0 0 420 40"><rect width="420" height="40" rx="6" fill="#06131F"/><text x="14" y="25" font-family="monospace" font-size="13" fill="#2E7A99">not on the Claude Pets board</text></svg>`

export const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export async function handle(req: Request, env: Env, now = Date.now()): Promise<Response> {
  const url = new URL(req.url)
  const route = `${req.method} ${url.pathname.replace(/\/+$/, '')}`

  const card = /^GET \/card\/([^/]+)\.svg$/.exec(route)
  if (card) {
    const login = decodeURIComponent(card[1] ?? '')
    if (!LOGIN.test(login)) return svg(404, NO_CARD)
    const r = await env.DB.prepare('SELECT * FROM players WHERE login = ? COLLATE NOCASE AND updated_at IS NOT NULL').bind(login).first<Row>()
    return r ? svg(200, cardSvg(r)) : svg(404, NO_CARD)
  }

  const visit = /^GET \/v1\/pet\/([^/]+)$/.exec(route)
  if (visit) {
    const me = await caller(req, env)
    if (!me) return fail(401, 'unknown key: run /pet join')
    const login = decodeURIComponent(visit[1] ?? '')
    const host = LOGIN.test(login)
      ? await env.DB.prepare('SELECT * FROM players WHERE login = ? COLLATE NOCASE AND updated_at IS NOT NULL').bind(login).first<Row>()
      : null
    if (!host) return fail(404, `${login} is not on the board`)
    if (host.github_id === me.github_id) return fail(400, 'that is your own pet')
    if (host.visits_off) return fail(403, `${host.login} isn't taking visits`)
    const day = dayOf(now)
    const before = await env.DB.prepare('SELECT 1 AS n FROM visits WHERE visitor_id = ? AND host_id = ? AND day = ?').bind(me.github_id, host.github_id, day).first()
    if (!before) await env.DB.prepare('INSERT INTO visits (visitor_id, host_id, day) VALUES (?, ?, ?)').bind(me.github_id, host.github_id, day).run()
    return json(200, { login: host.login, level: host.level, favPet: host.fav_pet, wearing: lookOf(host).wearing, isFirstToday: !before })
  }

  if (route === 'PUT /v1/me') {
    const me = await caller(req, env)
    if (!me) return fail(401, 'unknown key')
    const body = await readJson(req)
    if (typeof body?.visitsOff !== 'boolean') return fail(400, 'visitsOff must be true or false')
    await env.DB.prepare('UPDATE players SET visits_off = ? WHERE github_id = ?').bind(body.visitsOff ? 1 : 0, me.github_id).run()
    return json(200, { visitsOff: body.visitsOff })
  }

  if (route === 'POST /v1/join') {
    const body = await readJson(req)
    const token = typeof body?.githubToken === 'string' ? body.githubToken : ''
    if (!token) return fail(400, 'githubToken is required')
    const gh = await fetch(`${env.GITHUB_API ?? 'https://api.github.com'}/user`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'claude-pets-leaderboard' },
    })
    if (!gh.ok) return fail(401, 'GitHub did not accept that token')
    const user = (await gh.json()) as { id?: unknown; login?: unknown }
    if (typeof user.id !== 'number' || typeof user.login !== 'string') return fail(502, 'unexpected answer from GitHub')
    const apiKey = newKey()
    // re-joining rotates the key and keeps the score
    await env.DB.prepare(
      `INSERT INTO players (github_id, login, key_hash, joined_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(github_id) DO UPDATE SET login = excluded.login, key_hash = excluded.key_hash`,
    ).bind(user.id, user.login, await sha256(apiKey), now).run()
    return json(200, { login: user.login, apiKey })
  }

  if (route === 'PUT /v1/score') {
    const me = await caller(req, env)
    if (!me) return fail(401, 'unknown key: run /pet join')
    if (me.updated_at !== null && now - me.updated_at < LIMITS.minGapMs) return fail(429, 'at most one score a minute')
    const body = await readJson(req)
    if (!body) return fail(400, 'a JSON body is required')
    const score = body as Partial<Score>
    const refused = refuseScore(score, me, now)
    if (refused) return fail(422, refused)
    // the look is optional, and an invalid one keeps the last good one
    const look = parseLook(body.look)
    await env.DB.prepare(
      'UPDATE players SET xp = ?, level = ?, fav_pet = ?, streak = ?, best_streak = ?, updated_at = ?, look = COALESCE(?, look) WHERE github_id = ?',
    ).bind(score.xp, score.level, score.favPet, score.streak, score.bestStreak, now, look ? JSON.stringify(look) : null, me.github_id).run()
    // who came visiting since the last score (E7-S02)
    const { results } = await env.DB.prepare(
      `SELECT p.login AS login, p.fav_pet AS favPet FROM visits v JOIN players p ON p.github_id = v.visitor_id
       WHERE v.host_id = ? AND v.seen = 0 ORDER BY v.day LIMIT 20`,
    ).bind(me.github_id).all<{ login: string; favPet: string }>()
    if (results.length) await env.DB.prepare('UPDATE visits SET seen = 1 WHERE host_id = ? AND seen = 0').bind(me.github_id).run()
    return json(200, { rank: await rankOf(env, score.xp as number), visitors: results })
  }

  if (route === 'GET /v1/board') {
    const limit = Math.min(LIMITS.boardMax, Math.max(1, Number(url.searchParams.get('limit')) || 20))
    const { results } = await env.DB.prepare(
      'SELECT * FROM players WHERE updated_at IS NOT NULL ORDER BY xp DESC, updated_at ASC LIMIT ?',
    ).bind(limit).all<Row>()
    const top = results.map((r, i) => publicRow(r, i + 1))
    const me = await caller(req, env)
    return json(200, {
      top,
      me: me && me.updated_at !== null ? publicRow(me, await rankOf(env, me.xp)) : null,
    })
  }

  if (route === 'DELETE /v1/me') {
    const me = await caller(req, env)
    if (!me) return fail(401, 'unknown key')
    await env.DB.prepare('DELETE FROM players WHERE github_id = ?').bind(me.github_id).run()
    await env.DB.prepare('DELETE FROM visits WHERE visitor_id = ? OR host_id = ?').bind(me.github_id, me.github_id).run()
    return json(204, null)
  }

  return fail(404, 'not found')
}

export default {
  fetch: (req: Request, env: Env) => handle(req, env),
}
