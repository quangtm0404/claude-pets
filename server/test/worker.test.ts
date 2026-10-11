// Run with: node --test server/test/   (Node 22.18+ runs TypeScript directly)
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { handle, levelOf, LIMITS, type Env } from '../src/worker.ts'

const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')

/** D1's prepare/bind/first/run/all over node:sqlite, so the real SQL runs. */
function d1(db: DatabaseSync): Env['DB'] {
  return {
    prepare(sql: string) {
      const st = db.prepare(sql)
      let args: unknown[] = []
      const self = {
        bind(...v: unknown[]) { args = v; return self },
        async first<T>() { return (st.get(...(args as never[])) as T) ?? null },
        async run() { st.run(...(args as never[])); return { success: true } },
        async all<T>() { return { results: st.all(...(args as never[])) as T[] } },
      }
      return self
    },
  }
}

let env: Env
let db: DatabaseSync
const users: Record<string, { id: number; login: string }> = {
  'gho_alice': { id: 1, login: 'alice' },
  'gho_bob': { id: 2, login: 'bob' },
  'gho_carol': { id: 3, login: 'carol' },
}
const realFetch = globalThis.fetch

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec(schema)
  env = { DB: d1(db), GITHUB_API: 'https://gh.test' }
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const auth = new Headers(init?.headers).get('authorization') ?? ''
    const u = users[auth.replace('Bearer ', '')]
    if (String(input) === 'https://gh.test/user' && u) return new Response(JSON.stringify(u), { status: 200 })
    return new Response('{"message":"Bad credentials"}', { status: 401 })
  }) as typeof fetch
})
process.on('exit', () => { globalThis.fetch = realFetch })

const T0 = Date.parse('2026-10-11T09:00:00Z')
const call = async (method: string, path: string, opts: { key?: string; body?: unknown; now?: number } = {}) => {
  const res = await handle(new Request(`https://board.test${path}`, {
    method,
    headers: opts.key ? { authorization: `Bearer ${opts.key}` } : {},
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  }), env, opts.now ?? T0)
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}
const join = async (token: string) => (await call('POST', '/v1/join', { body: { githubToken: token } })).body as { login: string; apiKey: string }
const score = (xp: number, extra: Record<string, unknown> = {}) =>
  ({ xp, level: levelOf(xp), favPet: 'whale', streak: 3, bestStreak: 5, ...extra })

test('E4-S02: join checks the token with GitHub, returns a key, and stores only its hash', async () => {
  const r = await call('POST', '/v1/join', { body: { githubToken: 'gho_alice' } })
  assert.equal(r.status, 200)
  assert.equal(r.body.login, 'alice')
  assert.match(r.body.apiKey, /^cp_[0-9a-f]{64}$/)
  const row = db.prepare('SELECT * FROM players').get() as Record<string, unknown>
  assert.equal(row.login, 'alice')
  assert.notEqual(row.key_hash, r.body.apiKey)
  assert.equal(JSON.stringify(row).includes('gho_alice'), false, 'the GitHub token is never stored')
})

test('E4-S02: a token GitHub rejects gets no key', async () => {
  const r = await call('POST', '/v1/join', { body: { githubToken: 'gho_nobody' } })
  assert.equal(r.status, 401)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM players').get()?.n, 0)
})

test('E4-S02: re-joining rotates the key and keeps the score', async () => {
  const first = await join('gho_alice')
  await call('PUT', '/v1/score', { key: first.apiKey, body: score(479) })
  const again = await join('gho_alice')
  assert.notEqual(again.apiKey, first.apiKey)
  assert.equal((await call('PUT', '/v1/score', { key: first.apiKey, body: score(480), now: T0 + 120_000 })).status, 401)
  const board = await call('GET', '/v1/board', { key: again.apiKey })
  assert.equal(board.body.me.xp, 479)
})

test('E4-S01/S04: the board ranks by XP, shows only board fields, and finds my rank', async () => {
  const a = await join('gho_alice'), b = await join('gho_bob'), c = await join('gho_carol')
  await call('PUT', '/v1/score', { key: a.apiKey, body: score(479) })
  await call('PUT', '/v1/score', { key: b.apiKey, body: score(900, { favPet: 'cat' }) })
  await call('PUT', '/v1/score', { key: c.apiKey, body: score(50, { favPet: 'fox' }) })
  const r = await call('GET', '/v1/board?limit=2', { key: c.apiKey })
  assert.equal(r.status, 200)
  assert.deepEqual(r.body.top.map((p: { login: string; rank: number }) => [p.rank, p.login]), [[1, 'bob'], [2, 'alice']])
  assert.deepEqual(Object.keys(r.body.top[0]).sort(), ['bestStreak', 'favPet', 'level', 'login', 'rank', 'streak', 'xp'])
  assert.deepEqual(r.body.me, { rank: 3, login: 'carol', level: levelOf(50), xp: 50, favPet: 'fox', streak: 3, bestStreak: 5 })
  const anon = await call('GET', '/v1/board')
  assert.equal(anon.body.me, null)
})

test('E4-S01: a player who has not sent a score yet is not on the board', async () => {
  await join('gho_alice')
  assert.deepEqual((await call('GET', '/v1/board')).body.top, [])
})

test('E4-S01: leaving deletes the row entirely', async () => {
  const a = await join('gho_alice')
  await call('PUT', '/v1/score', { key: a.apiKey, body: score(479) })
  assert.equal((await call('DELETE', '/v1/me', { key: a.apiKey })).status, 204)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM players').get()?.n, 0)
  assert.equal((await call('DELETE', '/v1/me', { key: a.apiKey })).status, 401)
})

test('E4-S03: impossible scores are refused', async () => {
  const a = await join('gho_alice')
  const send = (body: unknown, now = T0) => call('PUT', '/v1/score', { key: a.apiKey, body, now })
  assert.equal((await send(score(479, { level: 9 }))).status, 422, 'level must match XP')
  assert.equal((await send(score(479, { favPet: 'dragon' }))).status, 422, 'unknown pet')
  assert.equal((await send(score(479, { streak: 6, bestStreak: 5 }))).status, 422, 'best below streak')
  assert.equal((await send(score(479, { xp: 4.5, level: 1 }))).status, 422, 'whole XP')
  assert.equal((await send(score(LIMITS.firstScoreMax + 1))).status, 422, 'first score capped')
  assert.equal((await send(score(479))).status, 200, 'a possible first score')
  assert.equal((await send(score(480), T0 + 30_000)).status, 429, 'one a minute')
  assert.equal((await send(score(470), T0 + 120_000)).status, 422, 'XP may not go down')
  assert.equal((await send(score(479 + 500), T0 + 120_000)).status, 422, 'too fast: 500 XP in 2 minutes')
  assert.equal((await send(score(479 + 20), T0 + 120_000)).status, 200, '20 XP in 2 minutes is fine')
  assert.equal((await send(score(499 + 590, { streak: 3 }), T0 + 3_720_000)).status, 200, '590 XP an hour later is fine')
  assert.equal((await send(score(1089, { streak: 9, bestStreak: 9 }), T0 + 3_800_000)).status, 422, 'streak cannot jump 6 days in an hour')
})

test('unknown routes and keys', async () => {
  assert.equal((await call('GET', '/nope')).status, 404)
  assert.equal((await call('PUT', '/v1/score', { key: 'cp_' + '0'.repeat(64), body: score(1) })).status, 401)
  assert.equal((await call('POST', '/v1/join', { body: {} })).status, 400)
})
