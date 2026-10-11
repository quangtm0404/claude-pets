/**
 * Claude Pets shared leaderboard: a Cloudflare Worker over one D1 table (E4).
 *
 *   POST   /v1/join   { githubToken }        → { login, apiKey }   (E4-S02)
 *   PUT    /v1/score  { xp, level, favPet, streak, bestStreak }   (E4-S03)
 *   GET    /v1/board?limit=20                → { top, me? }        (E4-S01, E4-S04)
 *   DELETE /v1/me                                                  (E4-S01)
 *
 * Signed-in calls carry `Authorization: Bearer <apiKey>`. The GitHub token sent to
 * /v1/join is used once to read the login and is never stored; only a SHA-256 hash
 * of the API key is kept. No dependencies; erasable TypeScript only, so Node runs
 * it directly in the tests.
 */

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

export async function handle(req: Request, env: Env, now = Date.now()): Promise<Response> {
  const url = new URL(req.url)
  const route = `${req.method} ${url.pathname.replace(/\/+$/, '')}`

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
    await env.DB.prepare(
      'UPDATE players SET xp = ?, level = ?, fav_pet = ?, streak = ?, best_streak = ?, updated_at = ? WHERE github_id = ?',
    ).bind(score.xp, score.level, score.favPet, score.streak, score.bestStreak, now, me.github_id).run()
    return json(200, { rank: await rankOf(env, score.xp as number) })
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
    return json(204, null)
  }

  return fail(404, 'not found')
}

export default {
  fetch: (req: Request, env: Env) => handle(req, env),
}
