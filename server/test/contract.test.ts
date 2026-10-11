// The plugin and the service must agree, or every score is refused. Run with: node --test test/contract.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PETS, levelOf, parseLook } from '../src/worker.ts'

const plugin = readFileSync(new URL('../../plugins/pixel-pets/hooks/register.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const types = readFileSync(new URL('../../plugins/pixel-pets/types/index.d.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('the roster is the same on both sides', () => {
  const union = /export type PetKind =([\s\S]*?)\nexport/.exec(types)?.[1] ?? ''
  const kinds = [...union.matchAll(/'([a-z]+)'/g)].map(m => m[1])
  assert.deepEqual(kinds, PETS)
})

test('the level curve is the same on both sides', () => {
  const line = /export const levelOf = (\(xp: number\) => [^\n]+)/.exec(plugin)?.[1]
  assert.ok(line, 'levelOf found in the plugin')
  const pluginLevelOf = new Function(`return ${line.replace('(xp: number)', '(xp)')}`)() as (xp: number) => number
  for (const xp of [0, 1, 14, 15, 59, 60, 134, 135, 479, 1500, 99_999, 1_000_000]) assert.equal(pluginLevelOf(xp), levelOf(xp), `xp ${xp}`)
})

test('the plugin sends exactly the fields the service reads', () => {
  const body = /return \{ xp: p\.totals\.xp, level: levelOf\(p\.totals\.xp\), favPet: fav, streak: p\.streak\.days, bestStreak: [^}]+\}/.exec(plugin)
  assert.ok(body, 'boardScore() shape found in the plugin')
  for (const field of ['xp', 'level', 'favPet', 'streak', 'bestStreak']) assert.ok(body[0].includes(`${field}:`), field)
  assert.ok(plugin.includes("JSON.stringify({ githubToken: d.access_token })"), 'join sends githubToken')
  assert.ok(plugin.includes('`${link.url}/v1/score`') && plugin.includes('`${CFG.leaderboardUrl}/v1/join`') && plugin.includes('/v1/board?limit=20') && plugin.includes('`${link.url}/v1/me`'), 'routes')
})

test('the look the plugin sends is one the service keeps (E7)', () => {
  assert.ok(plugin.includes('look: await boardLook($)'), 'the score carries the look')
  assert.ok(/return \{ wearing: petSim\.wearing, fg: C\.fg, bg: C\.bg \}/.test(plugin), 'boardLook() shape')
  assert.deepEqual(parseLook({ wearing: ['hat', 'scarf'], fg: '#5FE1FF', bg: '#06131F' }), { wearing: ['hat', 'scarf'], fg: '#5FE1FF', bg: '#06131F' })
  assert.ok(plugin.includes('/v1/pet/${encodeURIComponent(who)}') && plugin.includes('`${link.url}/v1/me`'), 'visit routes')
})
