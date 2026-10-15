import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import {
  ACHIEVEMENTS, BIRTHDAY_XP, BOX_ODDS, BOX_PITY, BOX_REVEAL_MS, CHATTER_EVERY_MS, birthdayAge, breakAfter, collectionText, festivalOn, focusLabel, focusXp,
  midAutumnOf, nextBirthday, noteTestRun, parseBreaks, parseMyFestival, upcomingFestivals, parseFocus, petPixels, rollBox, stageOf, tetOf, toolKind, turnSummary,
} from './register'
import { HD, HD_H, hdSprite, traceLoops, vectorPet } from './art'
import { press, step } from './runner'

const run = (command: string, args: string) => ({
  command,
  args,
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: true, columns: 120 },
})

const band = (bodyColumns: number) => ({
  component: 'AbovePrompt' as const,
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns,
    scroll: { top: 0, bodyRows: 10, totalRows: 0 },
    view: {},
  },
})

const STORY_MD = `## P2 · Accounts - 🟡 In progress

### E12 · Sign-in and recovery - 🟡 In progress · 4 stories

<details><summary><b>E12-S03</b> - as a <b>user</b>, I want <b>to reset my password by email</b> · 🧱 Built, not enabled · 5 pts</summary>

So that I can get back in.

**Acceptance criteria**
- A reset link is emailed within a minute
- The link expires after one use

| Task | Kind | Status |
|---|---|---|
| Reset token service | technical | 🚀 Live |
| Expiry asserted end to end | testing | ⬜ To do |

</details>
`

const TABLE_MD = `## Milestone 1 — MVP

| Task | Deliverable | Status |
| --- | --- | --- |
| M1-14 | Helm chart v0.1; deploy to staging | ◐ chart ready; staging deploy pending |
`

function engine(on: On, md: string, now = Date.parse('2026-10-05T09:00:00Z')) {
  on('clock.now', () => ({ value: now }))
  on('session.root', () => ({ value: '/repo' }))
  on('session.model', () => ({ value: 'claude-opus-5-5[1m]' }))
  on('fs.exists', () => ({ value: true }))
  on('fs.stat', () => ({ value: { kind: 'file' as const, size: md.length, mtimeMs: 1, isLink: false } }))
  on('fs.read', () => ({ value: md }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.close', () => ({ value: undefined }))
}

test('band shows the banner and READY.', async ($, on) => {
  engine(on, '')
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'pixel-pets', surface, ...band(80) } as never)
    expect(await ui.find({ text: /CLAUDE PETS \*/ })).toBeDefined()
    expect(await ui.find({ text: /READY\./ })).toBeDefined()
    await ui.unmount()
  }
})

test('/story reads a story block and its status from BACKLOG.md', async ($, on) => {
  engine(on, STORY_MD)
  const ran = await $.command.run(run('story', 'e12-s03'))
  expect(ran.text).toContain('Tracking E12-S03 [DARK] to reset my password by email')

  const detail = await $.command.run(run('story', ''))
  expect(detail.text).toContain('E12 · Sign-in and recovery · 5 pts')
  expect(detail.text).toContain('- The link expires after one use')
  expect(detail.text).toContain('[TODO] testing: Expiry asserted end to end')

  const ui = await $.ui.mount({ plugin: 'pixel-pets', surface: 'terminal', ...band(100) } as never)
  expect(await ui.find({ text: 'E12-S03' })).toBeDefined()
  expect(await ui.find({ text: ' [DARK] ' })).toBeDefined()
  await ui.unmount()
})

test('/story reads a table row from a milestones file', async ($, on) => {
  engine(on, TABLE_MD)
  const ran = await $.command.run(run('story', 'M1-14'))
  expect(ran.text).toContain('Tracking M1-14 [PARTIAL] Helm chart v0.1; deploy to staging')
})

test('/story with an unknown id says so', async ($, on) => {
  engine(on, STORY_MD)
  const ran = await $.command.run(run('story', 'E99-S01'))
  expect(ran.text).toContain("E99-S01 isn't in the plan")
})

test('/retro theme switches the palette', async ($, on) => {
  engine(on, '')
  const ran = await $.command.run(run('retro', 'theme amber'))
  expect(ran.text).toBe('Theme: AMBER. READY.')
  const ui = await $.ui.mount({ plugin: 'pixel-pets', surface: 'terminal', ...band(80) } as never)
  expect(await ui.find({ text: /CLAUDE PETS · AMBER/ })).toBeDefined()
  await ui.unmount()
})

test('/ticket sets an issue key and environment', async ($, on) => {
  engine(on, '')
  const ran = await $.command.run(run('ticket', 'PROJ-1234 tst'))
  expect(ran.text).toContain('PROJ-1234')
})

test('band and pane show the 5-hour and weekly plan usage, with a warning past 80%', async ($, on) => {
  engine(on, '')
  const toasts: string[] = []
  on('ui.toast', (_$, e) => (toasts.push(e.text), { value: undefined }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))

  await $.session.measure({
    context: { window: 1_000_000, tokens: 440_000, percent: 44 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 82.4, resetsAt: '2026-10-05T10:12:00Z' },
      { kind: 'seven_day', percentUsed: 31, resetsAt: '2026-10-08T13:00:00Z' },
    ],
    changed: ['context', 'rateLimits'],
  })

  const ui = await $.ui.mount({ plugin: 'pixel-pets', surface: 'terminal', ...band(100) } as never)
  expect(await ui.find({ text: ' 82%' })).toBeDefined()
  expect(await ui.find({ text: ' ↻1H12M ' })).toBeDefined()
  expect(await ui.find({ text: ' 31%' })).toBeDefined()
  expect(await ui.find({ text: ' ↻3D4H ' })).toBeDefined()
  expect(await ui.find({ text: ' CTX 44%' })).toBeDefined()
  await ui.unmount()

  expect(toasts).toContain('⚠ 5-HOUR LIMIT 82% USED · RESETS IN 1H12M')
  expect(toasts.some(t => t.includes('WEEKLY'))).toBe(false)

  const pane = await $.ui.mount({
    plugin: 'pixel-pets', surface: 'terminal', component: 'Pane', requestId: 'qa-monitor',
    props: { title: 'QA MONITOR', isFocused: false, bodyColumns: 60, placement: 'dock' },
  } as never)
  expect(await pane.find({ text: '5-HOUR ' })).toBeDefined()
  expect(await pane.find({ text: 'WEEKLY ' })).toBeDefined()
  await pane.unmount()
})

test('before any reading the band says so', async ($, on) => {
  engine(on, '')
  const ui = await $.ui.mount({ plugin: 'pixel-pets', surface: 'terminal', ...band(100) } as never)
  expect(await ui.find({ text: /PLAN USAGE: NO READING YET/ })).toBeDefined()
  await ui.unmount()
})

const tallBand = (surface: 'terminal' | 'desktop' | 'vscode') => ({
  plugin: 'pixel-pets', surface, component: 'AbovePrompt' as const,
  props: { ...band(100).props, maxRows: 14 },
})

test('the pet walks in a strip at the bottom of the band, not in a pane', async ($, on) => {
  engine(on, '')
  const term = await $.ui.mount(tallBand('terminal') as never)
  expect(await term.find({ type: 'Raster', key: 'pet' })).toBeDefined()
  expect(await term.find({ text: /CLAUDE PETS \*/ })).toBeDefined()
  expect(await term.find({ text: ' READY.' })).toBeDefined()
  await term.unmount()

  const desk = await $.ui.mount(tallBand('desktop') as never)
  const art = await desk.find({ type: 'Svg' })
  expect(String(art?.props.alt)).toMatch(/🐈 PIXEL/)
  // the new look (E10): the pet traced into an outlined cartoon, not squares
  expect(String(art?.props.source)).toMatch(/^<svg [^>]*>.*stroke-linejoin="round"/)
  await desk.unmount()
})

test('/pet hides and shows it; /pet crab and /pet name change it', async ($, on) => {
  engine(on, '')
  const hidden = await $.command.run(run('pet', ''))
  expect(hidden.text).toBe('Pixel is resting. /pet brings them back.')
  const off = await $.ui.mount(tallBand('terminal') as never)
  expect(await off.find({ type: 'Raster', key: 'pet' })).toBeUndefined()
  await off.unmount()

  await $.command.run(run('pet', 'crab'))
  const ran = await $.command.run(run('pet', 'name Ferris'))
  expect(ran.text).toBe('Ferris the crab is in the band. READY.')
  const on2 = await $.ui.mount(tallBand('terminal') as never)
  expect(await on2.find({ type: 'Raster', key: 'pet' })).toBeDefined()
  await on2.unmount()

  const bad = await $.command.run(run('pet', 'pegasus'))
  expect(bad.text).toContain('Usage: /pet')
})

test('no TESTS row until a test has run', async ($, on) => {
  engine(on, '')
  const ui = await $.ui.mount(tallBand('terminal') as never)
  expect(await ui.find({ text: /TESTS:/ })).toBeUndefined()
  expect(await ui.find({ text: /NO RUN/ })).toBeUndefined()
  await ui.unmount()
})

// ── The eight helpers ────────────────────────────────────────────────────────
function gitRepo(on: On, branch: string, dirty: number, top = '/home/dev/code/acme-api') {
  on('process.run', (_$, e) => {
    const argv = e.argv.join(' ')
    const out = (stdout: string, exitCode = 0) => ({
      value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    })
    if (argv === 'git rev-parse --show-toplevel') return out(`${top}\n`)
    if (argv.startsWith('git status')) {
      const files = Array.from({ length: dirty }, (_, i) => `1 .M N... 100644 100644 100644 a b f${i}.ts`)
      return out(['# branch.oid abc', `# branch.head ${branch}`, ...files].join('\n'))
    }
    if (argv.startsWith('git branch')) return out(`${branch}\n`)
    return out('', 1)
  })
}

test('1. the band shows worktree, branch, dirty count and flags a branch/story mismatch', async ($, on) => {
  engine(on, STORY_MD)
  gitRepo(on, 'feat/e14-s01', 3)
  await $.command.run(run('story', 'E12-S03'))
  const ui = await $.ui.mount(tallBand('terminal') as never)
  expect(await ui.find({ text: 'ACME-API' })).toBeDefined()
  expect(await ui.find({ text: 'FEAT/E14-S01' })).toBeDefined()
  expect(await ui.find({ text: ' ±3' })).toBeDefined()
  expect(await ui.find({ text: ' ≠ BRANCH IS E14, STORY IS E12-S03' })).toBeDefined()
  await ui.unmount()
})

test('1. a matching or neutral branch raises no flag', async ($, on) => {
  engine(on, STORY_MD)
  gitRepo(on, 'dev', 0)
  await $.command.run(run('story', 'E12-S03'))
  const ui = await $.ui.mount(tallBand('terminal') as never)
  expect(await ui.find({ text: /≠/ })).toBeUndefined()
  expect(await ui.find({ text: / ±/ })).toBeUndefined()
  await ui.unmount()
})

const outcome = (r: { text?: string; deny?: string }) => r.deny ?? r.text ?? ''

test('2. edits to files that mark themselves generated are refused, with the marker as the reason', async ($, on) => {
  engine(on, '<!-- Generated by codegen. DO NOT EDIT. -->\n# api')
  on('tool.call', () => ({ result: {}, text: 'edited' }) as never)
  const edited = await $.tool.call({ tool: 'Edit', file_path: 'C:/r/docs/BACKLOG.md', old_string: 'a', new_string: 'b' } as never)
  expect(outcome(edited)).toContain('BACKLOG.md is generated (Generated by codegen. DO NOT EDIT.)')
  const written = await $.tool.call({ tool: 'Write', file_path: 'C:/r/api.md', content: 'x' } as never)
  expect(outcome(written)).toContain('api.md is generated')
})

test('2. ordinary files edit as usual, and /guard off lifts the guard', async ($, on) => {
  engine(on, '# just a readme')
  on('tool.call', () => ({ result: {}, text: 'edited' }) as never)
  const plain = await $.tool.call({ tool: 'Edit', file_path: 'C:/r/README.md', old_string: 'a', new_string: 'b' } as never)
  expect(outcome(plain)).toBe('edited')
  await $.command.run(run('guard', 'off'))
  const backlog = await $.tool.call({ tool: 'Edit', file_path: 'C:/r/docs/backlog/BACKLOG.md', old_string: 'a', new_string: 'b' } as never)
  expect(outcome(backlog)).toBe('edited')
})

test('3. risky commands are asked about first; a refusal blocks them', async ($, on) => {
  engine(on, '')
  const asked: string[] = []
  let answer = 'Block it'
  on('tool.call', (_$, e) => {
    if (String(e.tool) !== 'AskUserQuestion') return { result: {}, text: 'ran' } as never
    const q = (e as unknown as { questions: { question: string }[] }).questions[0]?.question ?? ''
    asked.push(q)
    return { result: { questions: (e as unknown as { questions: unknown[] }).questions, answers: { [q]: answer } } } as never
  })

  const blocked = await $.tool.call({ tool: 'Bash', command: 'terraform apply -auto-approve' } as never)
  expect(outcome(blocked)).toContain('blocked terraform apply/destroy')
  expect(asked[0]).toContain('terraform apply -auto-approve')

  answer = 'Run it'
  const pushed = await $.tool.call({ tool: 'Bash', command: 'git push origin release/2.4' } as never)
  expect(outcome(pushed)).toBe('ran')

  const safe = await $.tool.call({ tool: 'Bash', command: 'terraform plan -out tf.plan' } as never)
  expect(outcome(safe)).toBe('ran')
  expect(asked.length).toBe(2)
})

test('4. the tracked story rides along with the next prompt, once', async ($, on) => {
  engine(on, STORY_MD)
  gitRepo(on, 'dev', 0)
  const seen: (readonly string[] | undefined)[] = []
  on('prompt.submit', (_$, e) => (seen.push(e.context), { text: e.text, context: e.context }))
  await $.command.run(run('story', 'E12-S03'))
  await $.prompt.submit({ text: 'implement the reset token' } as never)
  await $.prompt.submit({ text: 'now add logging' } as never)
  await $.prompt.submit({ text: 'does this meet the acceptance criteria?' } as never)
  expect(seen[0]?.[0]).toContain('E12-S03 [DARK]')
  expect(seen[0]?.[0]).toContain('- The link expires after one use')
  expect(seen[1]).toBeUndefined()
  expect(seen[2]?.[0]).toContain('E12-S03')
})

test('6. a context warning fires once past 85%', async ($, on) => {
  engine(on, '')
  const toasts: string[] = []
  on('ui.toast', (_$, e) => (toasts.push(e.text), { value: undefined }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  const at = (percent: number) =>
    $.session.measure({ context: { window: 1e6, tokens: percent * 1e4, percent }, rateLimits: [], changed: ['context'] })
  await at(80)
  await at(87)
  await at(90)
  expect(toasts.filter(t => t.includes('CONTEXT')).length).toBe(1)
  expect(toasts.find(t => t.includes('CONTEXT'))).toContain('CONTEXT 87% FULL')
})

test('7. /standup64 writes three lines and copies them', async ($, on) => {
  engine(on, STORY_MD)
  gitRepo(on, 'feat/e12-s03', 1)
  on('session.messages', () => ({ value: [] }) as never)
  on('model.complete', () => ({
    value: {
      isAnswered: true,
      text: 'Done: a\nNext: b\nBlockers: none',
      usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    },
  }) as never)
  let copied = ''
  on('ui.copy', (_$, e) => ((copied = e.text), { value: { isCopied: true } }) as never)
  const ran = await $.command.run(run('standup64', ''))
  expect(ran.text).toContain('Done: a\nNext: b\nBlockers: none')
  expect(ran.text).toContain('(copied to clipboard)')
  expect(copied).toBe('Done: a\nNext: b\nBlockers: none')
})

test('8. a failed run is remembered and /defect drafts the report into the prompt', async ($, on) => {
  engine(on, '')
  on('ui.toast', () => ({ value: undefined }))
  on('tool.call', () => ({
    result: {},
    text: '  1) [chromium] › tests/login.spec.ts:12:5 › rejects a bad password\n\n  1 failed\n  4 passed (12s)',
  }) as never)
  let draft = ''
  on('prompt.fill', (_$, e) => ((draft = e.text), { isFilled: true }) as never)
  await $.command.run(run('ticket', 'PROJ-1234 TST'))
  await $.tool.call({ tool: 'Bash', command: 'npx playwright test tests/login.spec.ts' } as never)
  const ran = await $.command.run(run('defect', ''))
  expect(ran.text).toBe('Defect draft is in the prompt: review it and press Enter.')
  expect(draft).toContain('Draft a bug report for PROJ-1234')
  expect(draft).toContain('1 test(s) failed on TST')
  expect(draft).toContain('- [chromium] › tests/login.spec.ts:12:5 › rejects a bad password')
})

// ── Public build: settings, the roster, naming ───────────────────────────────
test('settings: a custom id pattern and backlog file are honoured', { options: { storyIdPattern: '\\b(STORY-\\d+)\\b', backlogFiles: 'plan.md' } } as never, async ($, on) => {
  engine(on, '| STORY-7 | Dark mode | ✅ done 2026-10-01 |\n')
  const ran = await $.command.run(run('story', 'story-7'))
  expect(ran.text).toContain('Tracking STORY-7 [DONE] Dark mode')
})

test('settings: the starting pet comes from petKind and petName', { options: { petKind: 'penguin', petName: 'Pingu' } } as never, async ($, on) => {
  engine(on, '')
  const desk = await $.ui.mount(tallBand('desktop') as never)
  expect(String((await desk.find({ type: 'Svg' }))?.props.alt)).toMatch(/🐧 PINGU/)
  await desk.unmount()
})

const ROSTER = ['cat', 'dog', 'crab', 'shark', 'turtle', 'mouse', 'fox', 'orca', 'whale', 'dolphin', 'giraffe', 'tiger', 'squirrel', 'penguin']

test('every animal on the roster can be chosen and drawn', async ($, on) => {
  engine(on, '')
  const list = await $.command.run(run('pet', 'list'))
  for (const kind of ROSTER) {
    expect(list.text).toContain(kind)
    const ran = await $.command.run(run('pet', kind))
    expect(ran.text).toContain(`the ${kind} is in the band`)
    const term = await $.ui.mount(tallBand('terminal') as never)
    expect(await term.find({ type: 'Raster', key: 'pet' })).toBeDefined()
    await term.unmount()
  }
})

test('/pet name asks, and takes the answer', async ($, on) => {
  engine(on, '')
  on('tool.call', (_$, e) => {
    if (String(e.tool) !== 'AskUserQuestion') return { result: {}, text: 'ran' } as never
    const q = (e as unknown as { questions: { question: string; options: { label: string }[] }[] }).questions[0]
    expect(q?.question).toBe('What should your cat be called?')
    expect(q?.options.map(o => o.label)).toContain('Mochi')
    return { result: { questions: (e as unknown as { questions: unknown[] }).questions, answers: { [q?.question ?? '']: 'Mochi' } } } as never
  })
  const ran = await $.command.run(run('pet', 'name'))
  expect(ran.text).toBe('Mochi the cat is in the band. READY.')
})

// ── Helpers: a pet per subagent ──────────────────────────────────────────────
test('a subagent hatches a helper pet, which brings its score home when the job is done', async ($, on) => {
  engine(on, '')
  const toasts: string[] = []
  on('ui.toast', (_$, e) => (toasts.push(e.text), { value: undefined }))
  on('agent.spawn', () => ({ agentId: 'agent-1', model: 'haiku' }) as never)
  on('turn.complete', (_$, e) => ({ text: e.answer }) as never)

  await $.agent.spawn({ tool_use_id: 'tu-1', description: 'Find the auth code', subagentType: 'Explore', prompt: 'look' } as never)
  const out = await $.command.run(run('pet', 'stats'))
  expect(out.text).toContain('Helpers: 1 out working (#1 Find the auth code: 0 XP)')

  await $.turn.complete({ answer: 'found it', durationMs: 4000, isAborted: false, turnId: 't-1', agentId: 'agent-1', reason: 'answer' } as never)
  const home = await $.command.run(run('pet', 'stats'))
  expect(home.text).toContain('Helpers: 0 out working · 1 came home (+5 XP)')
  expect(toasts).toContain('▶ HELPER #1 IS HOME (Find the auth code) · +5 XP')
})

test('a helper whose subagent failed comes home without the bonus', async ($, on) => {
  engine(on, '')
  on('ui.toast', () => ({ value: undefined }))
  on('agent.spawn', () => ({ agentId: 'agent-2', model: 'haiku' }) as never)
  on('turn.complete', (_$, e) => ({ text: e.answer }) as never)
  await $.agent.spawn({ tool_use_id: 'tu-2', description: 'Flaky job', prompt: 'x' } as never)
  await $.turn.complete({ answer: '', durationMs: 900, isAborted: false, turnId: 't-2', agentId: 'agent-2', reason: 'error' } as never)
  const home = await $.command.run(run('pet', 'stats'))
  expect(home.text).toContain('1 came home (+0 XP)')
})

test('several subagents hatch numbered helpers', async ($, on) => {
  engine(on, '')
  let n = 0
  on('agent.spawn', () => ({ agentId: `agent-${++n}`, model: 'haiku' }) as never)
  for (const d of ['one', 'two', 'three']) await $.agent.spawn({ tool_use_id: `tu-${d}`, description: d, prompt: d } as never)
  const out = await $.command.run(run('pet', 'stats'))
  expect(out.text).toContain('Helpers: 3 out working (#1 one: 0 XP, #2 two: 0 XP, #3 three: 0 XP)')
  const term = await $.ui.mount(tallBand('terminal') as never)
  expect(await term.find({ type: 'Raster', key: 'pet' })).toBeDefined()
  await term.unmount()
})

test('XP saves add up: another session writing in between is never overwritten', async ($, on) => {
  const store: Record<string, unknown> = { petXp: 100 }
  on('clock.now', () => ({ value: Date.parse('2026-10-09T09:00:00Z') }))
  on('session.root', () => ({ value: '/repo' }))
  on('session.model', () => ({ value: 'claude-opus-5-5[1m]' }))
  on('fs.exists', () => ({ value: false }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('store.get', (_$, e) => ({ value: store[(e as { key: string }).key] }) as never)
  on('store.set', (_$, e) => ((store[(e as { key: string }).key] = (e as { value: unknown }).value), { value: undefined }) as never)
  on('turn.complete', (_$, e) => ({ text: e.answer }) as never)
  const turn = (id: string) =>
    $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: id, reason: 'answer' } as never)

  await turn('t-1') // this session: +2
  expect(store.petXp).toBe(102)
  store.petXp = 150 // another open session saved 48 more meanwhile
  await turn('t-2') // this session: +2 more, on top of the other's
  expect(store.petXp).toBe(152)
})

// ── The plan: per-repo, never an error ──────────────────────────────────────
/** A repo at /repo whose files are exactly `files` (path → markdown); a real store. */
function repo(on: On, files: Record<string, string>, dirs: Record<string, { name: string; kind: string }[]> = {}, toasts: string[] = []) {
  const store: Record<string, unknown> = {}
  // the engine hands hooks absolute, OS-shaped paths (C:\repo\x.md, or cwd-relative made absolute)
  const norm = (p: string) => p.split('\\').join('/').replace(/^[a-z]:/i, '')
  const findIn = <T,>(table: Record<string, T>, path: string): T | undefined => {
    const n = norm(path)
    const key = Object.keys(table).find(k => n === norm(k) || n.endsWith('/' + norm(k)))
    return key === undefined ? undefined : table[key]
  }
  const find = (path: string) => findIn(files, path)
  on('clock.now', () => ({ value: Date.parse('2026-10-09T09:00:00Z') }))
  on('session.root', () => ({ value: '/repo' }))
  on('session.model', () => ({ value: 'claude-opus-5-5[1m]' }))
  on('fs.exists', (_$, e) => ({ value: find((e as { path: string }).path) !== undefined }) as never)
  on('fs.stat', (_$, e) => ({ value: { kind: 'file' as const, size: (find((e as { path: string }).path) ?? '').length, mtimeMs: 1, isLink: false } }) as never)
  on('fs.read', (_$, e) => ({ value: find((e as { path: string }).path) ?? '' }) as never)
  on('fs.list', (_$, e) => ({ value: (findIn(dirs, (e as { path: string }).path) ?? []).map(d => ({ ...d, size: 0, mtimeMs: 0, isLink: false })) }) as never)
  on('store.get', (_$, e) => ({ value: store[(e as { key: string }).key] }) as never)
  on('store.set', (_$, e) => ((store[(e as { key: string }).key] = (e as { value: unknown }).value), { value: undefined }) as never)
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', (_$, e) => (toasts.push(e.text), { value: undefined }))
  on('env.get', () => ({ value: undefined }) as never)
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }) as never)
  return store
}

test('E1-S02: no plan is not an error, and the band asks nothing; /story explains when asked', async ($, on) => {
  repo(on, {})
  const ran = await $.command.run(run('story', 'E12-S03'))
  expect(ran.text).toContain('No plan found for this project')
  expect(ran.text).toContain('/story plan')
  const ui = await $.ui.mount(tallBand('terminal') as never)
  expect(await ui.find({ text: /NO PLAN YET|\/story plan|PLAN [A-Z.]+\.MD/ })).toBeUndefined()
  expect(await ui.find({ text: /ERROR/ })).toBeUndefined()
  expect(await ui.find({ type: 'Raster', key: 'pet' })).toBeDefined()
  await ui.unmount()
})

test('an id mentioned in a prompt is only tracked when the plan has it', async ($, on) => {
  repo(on, { 'docs/backlog/BACKLOG.md': STORY_MD })
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }))
  await $.prompt.submit({ text: 'the L6-V2 model is fine' } as never)
  const none = await $.command.run(run('story', ''))
  expect(none.text).toContain('No story tracked. Plan: docs/backlog/BACKLOG.md (from settings)')
  await $.prompt.submit({ text: 'work on E12-S03 please' } as never)
  const ui = await $.ui.mount(tallBand('terminal') as never)
  expect(await ui.find({ text: 'E12-S03' })).toBeDefined()
  await ui.unmount()
})

test('/story plan <path> points this repo at its own plan', async ($, on) => {
  const store = repo(on, { '/repo/plans/roadmap.md': STORY_MD })
  const before = await $.command.run(run('story', 'E12-S03'))
  expect(before.text).toContain('No plan found')
  const set = await $.command.run(run('story', 'plan plans/roadmap.md'))
  expect(set.text).toBe('Plan for this repo: /repo/plans/roadmap.md (1 story id in it). /story <id> tracks one.')
  expect(store.plans).toEqual({ '/repo': ['/repo/plans/roadmap.md'] })
  const after = await $.command.run(run('story', 'E12-S03'))
  expect(after.text).toContain('Tracking E12-S03 [DARK]')
  const cleared = await $.command.run(run('story', 'plan clear'))
  expect(cleared.text).toContain("This repo's plan is back to the settings")
})

test('/story plan with no plan finds plan-like markdown in the repo and asks which', async ($, on) => {
  repo(on, { '/repo/docs/ROADMAP.md': STORY_MD, '/repo/docs/notes.md': 'nothing' }, {
    '/repo': [{ name: 'docs', kind: 'dir' }, { name: 'node_modules', kind: 'dir' }, { name: 'README.md', kind: 'file' }],
    '/repo/docs': [{ name: 'ROADMAP.md', kind: 'file' }, { name: 'notes.md', kind: 'file' }],
  })
  const asked: string[][] = []
  on('tool.call', (_$, e) => {
    if (String(e.tool) !== 'AskUserQuestion') return { result: {}, text: 'ran' } as never
    const q = (e as unknown as { questions: { question: string; options: { label: string }[] }[] }).questions[0]
    asked.push(q?.options.map(o => o.label) ?? [])
    return { result: { questions: (e as unknown as { questions: unknown[] }).questions, answers: { [q?.question ?? '']: 'docs/ROADMAP.md' } } } as never
  })
  const ran = await $.command.run(run('story', 'plan'))
  expect(asked[0]).toEqual(['docs/ROADMAP.md', 'None of these'])
  expect(ran.text).toBe('Plan for this repo: /repo/docs/ROADMAP.md (1 story id in it). /story <id> tracks one.')
})

test('a short terminal (macOS 80×24) still shows the pet, dropping info rows instead', async ($, on) => {
  engine(on, '')
  for (const maxRows of [4, 6, 8]) {
    const short = band(80)
    const ui = await $.ui.mount({ plugin: 'pixel-pets', surface: 'terminal', ...short, props: { ...short.props, maxRows } } as never)
    expect(await ui.find({ type: 'Raster', key: 'pet' })).toBeDefined()
    expect(await ui.find({ text: ' READY.' })).toBeDefined()
    await ui.unmount()
  }
  const roomy = band(80)
  const ui = await $.ui.mount({ plugin: 'pixel-pets', surface: 'terminal', ...roomy, props: { ...roomy.props, maxRows: 12 } } as never)
  expect(await ui.find({ text: /CLAUDE PETS/ })).toBeDefined()
  await ui.unmount()
})

test('a tiny band (3 rows) leaves the pet out rather than squash it', async ($, on) => {
  engine(on, '')
  const tiny = band(80)
  const ui = await $.ui.mount({ plugin: 'pixel-pets', surface: 'terminal', ...tiny, props: { ...tiny.props, maxRows: 3 } } as never)
  expect(await ui.find({ type: 'Raster', key: 'pet' })).toBeUndefined()
  await ui.unmount()
})

// ── E1: a band you choose ────────────────────────────────────────────────────
test('E1-S01: bandRows picks the rows and their order', { options: { bandRows: 'usage, banner' } } as never, async ($, on) => {
  engine(on, '')
  const ui = await $.ui.mount(tallBand('terminal') as never)
  expect(await ui.find({ text: /CLAUDE PETS/ })).toBeDefined()
  expect(await ui.find({ text: /PLAN USAGE/ })).toBeDefined()
  expect(await ui.find({ text: /64K/ })).toBeUndefined()
  await ui.unmount()
})

// ── E2: weather ──────────────────────────────────────────────────────────────
const GEO = { results: [{ name: 'Hanoi', country: 'Vietnam', latitude: 21.0245, longitude: 105.84117 }] }
const NOW = (code: number, temp: number, wind = 4.7, isDay = 1) =>
  ({ current: { temperature_2m: temp, weather_code: code, wind_speed_10m: wind, is_day: isDay } })

function weatherApi(on: On, current: unknown, next?: { current: unknown }) {
  const urls: string[] = []
  on('http.fetch', (_$, e) => {
    const url = (e as { url: string }).url
    urls.push(url)
    const body = url.includes('geocoding-api') ? GEO : url.includes('api.open-meteo.com') ? (next ? next.current : current) : {}
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(body) } } as never
  })
  return urls
}

test('E2-S01: no place set means no request at all', async ($, on) => {
  repo(on, {})
  const urls = weatherApi(on, NOW(0, 27.8))
  const ran = await $.command.run(run('pet', 'weather ' + ''))
  expect(ran.text).toContain('No place set')
  expect(urls.length).toBe(0)
})

test('E2-S01/S02: /pet weather <city> finds it, shows °C and °F, and /pet weather off forgets it', async ($, on) => {
  const store = repo(on, {})
  weatherApi(on, NOW(0, 27.8))
  const ran = await $.command.run(run('pet', 'weather ' + 'Hanoi'))
  expect(ran.text).toBe('Weather for Hanoi, Vietnam: 28°C / 82°F, clear.')
  expect(store.weatherPlace).toEqual({ name: 'Hanoi, Vietnam', lat: 21.0245, lon: 105.84117 })
  const ui = await $.ui.mount(tallBand('terminal') as never)
  expect(await ui.find({ text: ' ☀ 28°C / 82°F' })).toBeDefined()
  expect(await ui.find({ text: ' · HANOI, VIETNAM' })).toBeDefined()
  await ui.unmount()
  const off = await $.command.run(run('pet', 'weather ' + 'off'))
  expect(off.text).toContain('Weather off')
  const gone = await $.ui.mount(tallBand('terminal') as never)
  expect(await gone.find({ text: /°C/ })).toBeUndefined()
  await gone.unmount()
})

test('E2-S02: temperatureUnit f shows °F and mph only', { options: { temperatureUnit: 'f' } } as never, async ($, on) => {
  repo(on, {})
  weatherApi(on, NOW(61, 10, 40))
  await $.command.run(run('pet', 'weather ' + 'Hanoi'))
  const ui = await $.ui.mount(tallBand('terminal') as never)
  expect(await ui.find({ text: ' ☂ 50°F' })).toBeDefined()
  expect(await ui.find({ text: ' · WIND 25 MPH' })).toBeDefined()
  expect(await ui.find({ text: /°C/ })).toBeUndefined()
  await ui.unmount()
})

test('E2-S03: every sky draws under the pet without error', async ($, on) => {
  repo(on, {})
  const sky = { current: NOW(0, 12) as unknown }
  weatherApi(on, null, sky)
  for (const [code, isDay] of [[0, 1], [0, 0], [3, 1], [45, 1], [61, 1], [73, 1], [95, 1]] as const) {
    sky.current = NOW(code, 12, 35, isDay)
    await $.command.run(run('pet', 'weather ' + 'Hanoi'))
    const ui = await $.ui.mount(tallBand('terminal') as never)
    expect(await ui.find({ type: 'Raster', key: 'pet' })).toBeDefined()
    await ui.unmount()
  }
})

// ── E3: profile, board, streaks, achievements ────────────────────────────────
test('E3-S01/S02/S03: turns build the profile, the board ranks the pet, and the streak starts', async ($, on) => {
  repo(on, {})
  on('turn.complete', (_$, e) => ({ text: e.answer }) as never)
  for (const id of ['t-1', 't-2', 't-3']) {
    await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: id, reason: 'answer' } as never)
  }
  const board = await $.command.run(run('pet', 'board'))
  expect(board.text).toContain('PET BOARD · ')
  expect(board.text).toMatch(/1\. ★ 🐈 Pixel the cat\s+LV1\s+6 XP {2}← now/)
  expect(board.text).toContain('Lifetime: 6 XP · 0 coins · 0 bugs squashed · 0 helpers home · 0 green test runs · 3 turns')
  expect(board.text).toContain('Streak: 1 day (best 1)')
  expect(board.text).toContain('Achievements 0/12: none yet')
})

test('E3-S03: five green test runs unlock GREEN STREAK, once', async ($, on) => {
  const toasts: string[] = []
  repo(on, {}, {}, toasts)
  on('tool.call', () => ({ result: {}, text: '  12 passed (3s)' }) as never)
  for (let i = 0; i < 6; i++) await $.tool.call({ tool: 'Bash', command: 'npx playwright test' } as never)
  expect(toasts.filter(t => t === '▶ ACHIEVEMENT: GREEN STREAK').length).toBe(1)
  const board = await $.command.run(run('pet', 'board'))
  expect(board.text).toContain('6 green test runs')
  expect(board.text).toContain('Achievements 1/12: GREEN STREAK')
})

test('E3-S02: each animal keeps its own XP on the board', async ($, on) => {
  repo(on, {})
  on('turn.complete', (_$, e) => ({ text: e.answer }) as never)
  await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: 'a', reason: 'answer' } as never)
  await $.command.run(run('pet', 'whale'))
  await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: 'b', reason: 'answer' } as never)
  await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: 'c', reason: 'answer' } as never)
  const board = await $.command.run(run('pet', 'board'))
  expect(board.text).toMatch(/1\. ★ 🐳 Pixel the whale\s+LV1\s+4 XP {2}← now/)
  expect(board.text).toMatch(/2\. {3}🐈 cat\s+LV1\s+2 XP/)
})

// ── E4: the shared leaderboard, from the plugin's side ───────────────────────
const BOARD = { leaderboardUrl: 'https://board.test', githubClientId: 'Iv1.test' }

function boardApi(on: On) {
  const calls: { url: string; method: string; body?: string; auth?: string }[] = []
  on('http.fetch', (_$, e) => {
    const { url, init } = e as { url: string; init?: { method?: string; body?: string; headers?: Record<string, string> } }
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body, auth: init?.headers?.authorization })
    const reply = (status: number, body: unknown) => ({ value: { status, ok: status < 300, headers: {}, text: JSON.stringify(body) } }) as never
    if (url === 'https://github.com/login/device/code') {
      return reply(200, { device_code: 'dc1', user_code: 'ABCD-1234', verification_uri: 'https://github.com/login/device', interval: 5, expires_in: 900 })
    }
    if (url === 'https://board.test/v1/board?limit=20') {
      return reply(200, { top: [{ rank: 1, login: 'bob', level: 8, xp: 900, favPet: 'cat', streak: 2, bestStreak: 4 }], me: null })
    }
    if (url === 'https://board.test/v1/score') return reply(200, { rank: 3 })
    if (url === 'https://board.test/v1/me') return { value: { status: 204, ok: true, headers: {}, text: '' } } as never
    return reply(404, {})
  })
  return calls
}

test('E4-S02: with the board turned off, /pet join says so and sends nothing', { options: { leaderboardUrl: '' } } as never, async ($, on) => {
  repo(on, {})
  const calls = boardApi(on)
  const ran = await $.command.run(run('pet', 'join'))
  expect(ran.text).toContain('No shared leaderboard is set up')
  expect(calls.length).toBe(0)
})

test('E4-S02: /pet join starts the GitHub device flow with no scopes', { options: BOARD } as never, async ($, on) => {
  on('clock.after', () => ({ value: { cancel: () => undefined } }) as never)
  repo(on, {})
  const calls = boardApi(on)
  const ran = await $.command.run(run('pet', 'join'))
  expect(ran.text).toContain('Open https://github.com/login/device and enter: ABCD-1234')
  expect(ran.text).toContain('never your GitHub token')
  expect(calls[0]?.url).toBe('https://github.com/login/device/code')
  expect(calls[0]?.body).toBe('client_id=Iv1.test&scope=')
})

test('E4-S03: a joined player\'s score is sent after a turn, with exactly the board fields', { options: BOARD } as never, async ($, on) => {
  const store = repo(on, {})
  store.board = { url: 'https://board.test', login: 'alice', apiKey: 'cp_' + 'a'.repeat(64) }
  const calls = boardApi(on)
  on('turn.complete', (_$, e) => ({ text: e.answer }) as never)
  await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't', reason: 'answer' } as never)
  const put = calls.find(c => c.url === 'https://board.test/v1/score')
  expect(put?.method).toBe('PUT')
  expect(put?.auth).toBe('Bearer cp_' + 'a'.repeat(64))
  expect(JSON.parse(put?.body ?? '{}')).toEqual({ xp: 2, level: 1, favPet: 'cat', streak: 1, bestStreak: 1, look: { wearing: [], fg: '#5FE1FF', bg: '#06131F', skin: null } })
})

test('E4-S04/S02: /pet board world shows the board; /pet leave deletes the entry and forgets the key', { options: BOARD } as never, async ($, on) => {
  const store = repo(on, {})
  store.board = { url: 'https://board.test', login: 'alice', apiKey: 'cp_' + 'a'.repeat(64) }
  const calls = boardApi(on)
  const world = await $.command.run(run('pet', 'board world'))
  expect(world.text).toContain('WORLD BOARD')
  expect(world.text).toMatch(/1\. {3}bob\s+LV8\s+900 XP/)
  const left = await $.command.run(run('pet', 'leave'))
  expect(left.text).toContain("Left the board: alice's entry is deleted")
  expect(calls.some(c => c.url === 'https://board.test/v1/me' && c.method === 'DELETE')).toBe(true)
  expect(store.board).toBe(null)
})

test('1.2.1: the public board is the default, so /pet join works straight after install', async ($, on) => {
  repo(on, {})
  const calls = boardApi(on)
  on('clock.after', () => ({ value: { cancel: () => undefined } }) as never)
  const ran = await $.command.run(run('pet', 'join'))
  expect(ran.text).toContain('Open https://github.com/login/device and enter:')
  expect(calls[0]?.body).toBe('client_id=Ov23liHlgyFS3sCQIQ3l&scope=')
})

// ── E5: everywhere, in your colours ─────────────────────────────────────────
const petPane = (surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') => ({
  plugin: 'pixel-pets', surface, component: 'Pane' as const, requestId: 'pet',
  props: { bodyColumns: 60 },
})

test('E5-S01: the desktop band draws the pixel pet as SVG, with the HUD on its ground', async ($, on) => {
  engine(on, '')
  await $.command.run(run('pet', 'whale'))
  const desk = await $.ui.mount(tallBand('desktop') as never)
  const art = await desk.find({ type: 'Svg' })
  const svg = String(art?.props.source)
  expect(svg).toContain('<rect')
  expect(svg).toContain('#3a6fd0') // the whale's blue
  expect(svg).toContain('LV1')
  expect(svg.length).toBeLessThan(131072)
  expect(await desk.find({ type: 'Raster' })).toBeUndefined()
  await desk.unmount()
})

test('E5-S02: VS Code gets a pet pane: opened by /pet pane, drawn as SVG with buttons', async ($, on) => {
  engine(on, '')
  const opened: string[] = []
  on('ui.open', (_$, e) => (opened.push(e.id), { value: { isPlaced: true } }) as never)
  const ran = await $.command.run(run('pet', 'pane'))
  expect(ran.text).toBe('The pet pane is open. READY.')
  expect(opened).toContain('pet')
  for (const surface of ['vscode', 'desktop', 'mobile'] as const) {
    const pane = await $.ui.mount(petPane(surface) as never)
    expect(String((await pane.find({ type: 'Svg' }))?.props.alt)).toMatch(/PIXEL/)
    expect(await pane.find({ type: 'Button', key: 'ball' })).toBeDefined()
    await pane.unmount()
  }
  const term = await $.ui.mount(petPane('terminal') as never)
  expect(await term.find({ text: /LIVES IN THE BAND/ })).toBeDefined()
  await term.unmount()
})

test('E5-S02: VS Code draws the pet in the band, so no pane opens by itself', async ($, on) => {
  engine(on, '')
  on('session.surfaces', () => ({ value: ['vscode'] }) as never)
  const opened: string[] = []
  on('ui.open', (_$, e) => (opened.push(e.id), { value: { isPlaced: true } }) as never)
  await $.command.run(run('pet', '')) // hides
  await $.command.run(run('pet', '')) // shows again
  expect(opened).not.toContain('pet')
  const vs = await $.ui.mount(tallBand('vscode') as never)
  expect(await vs.find({ type: 'Svg' })).toBeDefined()
  await vs.unmount()
})

test('E5-S03: /retro theme takes presets and your own colours; a bad colour shows help', async ($, on) => {
  engine(on, '')
  const list = await $.command.run(run('retro', 'theme'))
  expect(list.text).toContain('paper')
  expect(list.text).toContain('#FF8800 on #101010')
  const own = await $.command.run(run('retro', 'theme #f80 on #101010'))
  expect(own.text).toBe('Theme: your own colours, #FF8800 ON #101010. READY.')
  const ui = await $.ui.mount({ plugin: 'pixel-pets', surface: 'terminal', ...band(80) } as never)
  const banner = await ui.find({ type: 'Text', text: /CLAUDE PETS \*/ })
  expect(banner?.props.color).toBe('#FF8800')
  expect(banner?.props.backgroundColor).toBe('#101010')
  await ui.unmount()
  const bad = await $.command.run(run('retro', 'theme #12345z'))
  expect(bad.text).toContain('Presets:')
  const preset = await $.command.run(run('retro', 'theme rose'))
  expect(preset.text).toBe('Theme: ROSE. READY.')
})

test('E5-S03: the theme setting colours the band from the start', { options: { theme: '#FF8800' } } as never, async ($, on) => {
  engine(on, '')
  const ui = await $.ui.mount({ plugin: 'pixel-pets', surface: 'terminal', ...band(80) } as never)
  expect((await ui.find({ type: 'Text', text: /CLAUDE PETS \*/ }))?.props.color).toBe('#FF8800')
  await ui.unmount()
})

test('E5-S04: /retro font restyles the banner; pixel draws big letters where there is room', async ($, on) => {
  engine(on, '')
  const ran = await $.command.run(run('retro', 'font bold'))
  expect(ran.text).toBe('Banner font: 𝗕𝗢𝗟𝗗. READY.')
  const ui = await $.ui.mount({ plugin: 'pixel-pets', surface: 'terminal', ...band(80) } as never)
  expect(await ui.find({ text: /𝗖𝗟𝗔𝗨𝗗𝗘 𝗣𝗘𝗧𝗦/ })).toBeDefined()
  await ui.unmount()

  await $.command.run(run('retro', 'font pixel'))
  const term = await $.ui.mount(tallBand('terminal') as never)
  expect(await term.find({ type: 'Raster', key: 'title' })).toBeDefined()
  await term.unmount()
  const desk = await $.ui.mount(tallBand('desktop') as never)
  expect(String((await desk.find({ type: 'Svg' }))?.props.alt)).toBe('CLAUDE PETS')
  await desk.unmount()

  const help = await $.command.run(run('retro', 'font comic'))
  expect(help.text).toContain("The terminal's own font is its setting")
})

test('1.3.1: weather lives under /pet, and /pet help lists every command', async ($, on) => {
  repo(on, {})
  weatherApi(on, NOW(0, 27.8))
  const ran = await $.command.run(run('pet', 'weather Hanoi'))
  expect(ran.text).toContain('Weather for Hanoi, Vietnam')
  const help = await $.command.run(run('pet', 'help'))
  for (const c of ['/pet weather here', '/pet board world', '/retro theme #FF8800', '/retro font', '/story <ID>', '/pet pane']) expect(help.text).toContain(c)
})

// ── E6: play ────────────────────────────────────────────────────────────────
test('E6-S01: with /pet play auto, a long turn offers the runner; its runs score XP, at most 20 a turn', async ($, on) => {
  const store: Record<string, unknown> = { runnerAuto: true }
  const clock = mock.clock(on, { now: Date.parse('2026-10-09T09:00:00Z') })
  on('session.root', () => ({ value: '/repo' }))
  on('session.model', () => ({ value: 'claude-opus-5-5[1m]' }))
  on('fs.exists', () => ({ value: false }))
  on('store.get', (_$, e) => ({ value: store[(e as { key: string }).key] }) as never)
  on('store.set', (_$, e) => ((store[(e as { key: string }).key] = (e as { value: unknown }).value), { value: undefined }) as never)
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }) as never)
  on('turn.start', (_$, e) => ({ turnId: e.turnId }) as never)
  on('turn.complete', (_$, e) => ({ text: e.answer }) as never)
  const working = { ...tallBand('terminal'), props: { ...tallBand('terminal').props, isWorking: true } }

  await $.turn.start({ text: 'build it', turnId: 't-1' } as never)
  const early = await $.ui.mount(working as never)
  expect(await early.find({ type: 'Client' })).toBeUndefined()
  await early.unmount()

  await clock.advance(8000)
  // a band drawn on the terminal: its Client is driven by pointer, frame clock and posts
  type Play = { pointer: (e: unknown) => Promise<void>; advance: (ms: number) => Promise<void>; post: (d: unknown, s?: unknown) => Promise<void> }
  const ui = (await $.ui.mount(working as never)) as unknown as Awaited<ReturnType<typeof $.ui.mount>> & Play
  expect(await ui.find({ type: 'Client' })).toBeDefined()
  expect(await ui.find({ text: /CLICK HERE, THEN SPACE/, in: 'runner' })).toBeDefined()
  await ui.pointer({ type: 'down', x: 3, y: 1, button: 'left', in: 'runner' })
  await ui.advance(120)
  expect(await ui.find({ text: /SCORE 0 · BEST 0/, in: 'runner' })).toBeDefined()

  await ui.post({ type: 'over', score: 35 }, { in: 'runner' })
  await ui.post({ type: 'over', score: 12 }, { in: 'runner' })
  await ui.unmount()
  expect(store.runnerBest).toBe(35)
  await $.turn.complete({ answer: 'ok', durationMs: 9000, isAborted: false, turnId: 't-1', reason: 'answer' } as never)
  const stats = await $.command.run(run('pet', 'stats'))
  expect(stats.text).toContain('XP 22') // 20 from the runner (capped), 2 for the turn

  const after = await $.ui.mount(tallBand('terminal') as never)
  expect(await after.find({ type: 'Client' })).toBeUndefined()
  expect(await after.find({ type: 'Raster', key: 'pet' })).toBeDefined()
  await after.unmount()
})

test('E6-S01: the runner is off by default; /pet play opens it any time and /pet play off closes it', async ($, on) => {
  const store: Record<string, unknown> = {}
  const clock = mock.clock(on, { now: Date.parse('2026-10-09T09:00:00Z') })
  on('session.root', () => ({ value: '/repo' }))
  on('session.model', () => ({ value: 'claude-opus-5-5[1m]' }))
  on('fs.exists', () => ({ value: false }))
  on('store.get', (_$, e) => ({ value: store[(e as { key: string }).key] }) as never)
  on('store.set', (_$, e) => ((store[(e as { key: string }).key] = (e as { value: unknown }).value), { value: undefined }) as never)
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }) as never)
  on('turn.start', (_$, e) => ({ turnId: e.turnId }) as never)
  on('turn.complete', (_$, e) => ({ text: e.answer }) as never)
  const working = { ...tallBand('terminal'), props: { ...tallBand('terminal').props, isWorking: true } }

  await $.turn.start({ text: 'build it', turnId: 't-1' } as never)
  await clock.advance(30000)
  const busy = await $.ui.mount(working as never)
  expect(await busy.find({ type: 'Client' })).toBeUndefined()
  await busy.unmount()
  await $.turn.complete({ answer: 'ok', durationMs: 30000, isAborted: false, turnId: 't-1', reason: 'answer' } as never)

  expect((await $.command.run(run('pet', 'play'))).text).toContain('/pet play off closes it')
  const idle = await $.ui.mount(tallBand('terminal') as never)
  expect(await idle.find({ type: 'Client' })).toBeDefined()
  await idle.unmount()
  // a game you opened outlasts a turn
  await $.turn.start({ text: 'more', turnId: 't-2' } as never)
  await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't-2', reason: 'answer' } as never)
  const still = await $.ui.mount(tallBand('terminal') as never)
  expect(await still.find({ type: 'Client' })).toBeDefined()
  await still.unmount()

  expect((await $.command.run(run('pet', 'play off'))).text).toBe('Runner closed.')
  const closed = await $.ui.mount(tallBand('terminal') as never)
  expect(await closed.find({ type: 'Client' })).toBeUndefined()
  await closed.unmount()
  expect((await $.command.run(run('pet', 'play auto'))).text).toContain('by itself')
  expect(store.runnerAuto).toBe(true)
})

test('E6-S01: the runner jumps, scores the bugs it clears, and a bug underfoot ends the run', () => {
  const g = { isStarted: true, isOver: false, t: 0, y: 0, vy: 0, bugs: [{ x: 11, isCounted: false }], nextBug: 999, score: 0, best: 0, seed: 1 }
  const air = press(g, 0)
  expect(air.vy).toBeGreaterThan(0)
  const cleared = { ...air, bugs: air.bugs.map(b => ({ ...b })) }
  for (let i = 0; i < 30 && !cleared.isOver; i++) step(cleared, 60)
  expect(cleared.isOver).toBe(false)
  expect(cleared.score).toBe(1)
  const hit = { ...g, bugs: [{ x: 9, isCounted: false }] }
  for (let i = 0; i < 20 && !hit.isOver; i++) step(hit, 60)
  expect(hit.isOver).toBe(true)
  const again = press(hit, 0)
  expect(again.isOver).toBe(false)
  expect(again.score).toBe(0)
})

test('E6-S02: coins buy items; one per slot; wearing toggles; a short purse is refused', async ($, on) => {
  const store = repo(on, {})
  store.profile = { since: '2026-10-01', totals: { xp: 0, coins: 100, bugs: 0, helpers: 0, green: 0, turns: 0, balls: 0 }, byKind: {}, streak: { days: 1, best: 1, last: '2026-10-09' }, badges: [] }
  const shop = await $.command.run(run('pet', 'shop'))
  expect(shop.text).toContain('you have ◆100')
  expect(shop.text).toMatch(/crown\s+Crown\s+◆200/)
  expect((await $.command.run(run('pet', 'buy crown'))).text).toContain('costs ◆200; you have ◆100')
  expect((await $.command.run(run('pet', 'buy hat'))).text).toBe('Bought the top hat for ◆60, and put it on. ◆40 left.')
  expect((await $.command.run(run('pet', 'buy bow'))).text).toContain('◆25 left')
  // the same slot: the bow replaced the hat
  expect(store.wallet).toMatchObject({ coins: 25, owned: ['hat', 'bow'], wearing: ['bow'] })
  expect((await $.command.run(run('pet', 'wear hat'))).text).toBe('Wearing the top hat.')
  expect((await $.command.run(run('pet', 'wear hat'))).text).toBe('Took off the top hat.')
  expect((await $.command.run(run('pet', 'wear lantern'))).text).toContain("You don't have the tết lantern yet")
  expect((await $.command.run(run('pet', 'wear none'))).text).toBe('Took everything off.')
})

const FRAME = {
  kind: 'cat' as const, columns: 30, x: 10, dir: -1 as const, pose: 'sit' as const, mood: 'happy' as const, lift: 0,
  bubble: null, ballX: null, coins: [], bugs: [], sparkle: false, bg: '#000000', ground: '#333333', cursor: null, hud: [],
}
const lit = (px: (number | null)[], c?: number) => px.filter(p => (c === undefined ? p !== null : p === c)).length

test('E6-S02/S03: items are drawn on the pet either way it faces; babies are smaller; legends twinkle', () => {
  const plain = petPixels({ ...FRAME, tick: 0 }).px
  expect(lit(plain, 0x2b2b2b)).toBe(0)
  expect(lit(petPixels({ ...FRAME, tick: 0, items: ['hat'] }).px, 0x2b2b2b)).toBeGreaterThan(0)
  for (const dir of [-1, 1] as const) expect(lit(petPixels({ ...FRAME, dir, items: ['scarf'] }).px, 0xe53935)).toBe(2)
  expect(lit(petPixels({ ...FRAME, stage: 'baby' }).px)).toBeLessThan(lit(plain))
  expect(lit(petPixels({ ...FRAME, stage: 'legend', tick: 0 }).px, 0xfff6a0)).toBe(1)
  expect([1, 9, 10, 24, 25, 49, 50, 80].map(stageOf)).toEqual(['baby', 'baby', 'adult', 'adult', 'legend', 'legend', 'mythic', 'mythic'])
})

test('E6-S03: reaching LV10 grows the pet up, and /pet stats shows the stage', async ($, on) => {
  const toasts: string[] = []
  const store = repo(on, {}, {}, toasts)
  store.petXp = 1214 // LV9; LV10 is at 1215
  on('turn.complete', (_$, e) => ({ text: e.answer }) as never)
  expect((await $.command.run(run('pet', 'stats'))).text).toContain('Stage: BABY (ADULT at LV10)')
  await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't-1', reason: 'answer' } as never)
  expect(toasts.some(t => t.includes('GREW UP: ADULT'))).toBe(true)
  expect((await $.command.run(run('pet', 'stats'))).text).toContain('Stage: ADULT (LEGEND at LV25)')
})

test('E6-S04: the pet dances on green, winces on red, rides a rocket on a push, and puzzles over a conflict', async ($, on) => {
  repo(on, {})
  const outputs: Record<string, string> = {
    'npx playwright test': '  12 passed (3.1s)',
    'npx playwright test --grep x': '  2 failed\n  8 passed (10s)',
    'git push origin feature/x': 'To github.com:me/x.git\n   1a2b3c4..5d6e7f8  feature/x -> feature/x',
    'git merge feature': 'CONFLICT (content): Merge conflict in a.ts\nAutomatic merge failed; fix conflicts and then commit the result.',
    'git commit -am fix': '[main 9f9f9f9] fix',
  }
  on('tool.call', (_$, e) => ({ result: {}, text: outputs[(e as { command: string }).command] ?? '' }) as never)
  const now = async (command: string) => {
    await $.tool.call({ tool: 'Bash', command } as never)
    return /^Now: (.*)$/m.exec((await $.command.run(run('pet', 'stats'))).text ?? '')?.[1]
  }
  expect(await now('npx playwright test')).toBe('DANCES: ALL GREEN!')
  expect(await now('npx playwright test --grep x')).toBe('WINCES: 2 FAILING')
  expect(await now('git push origin feature/x')).toBe('RIDES A ROCKET: PUSHED!')
  const merged = await now('git merge feature')
  expect(merged).toContain('PUZZLED BY A MERGE CONFLICT')
  const committed = await now('git commit -am fix')
  expect(committed ?? '').not.toContain('MERGE CONFLICT')
})

// ── E7: share ───────────────────────────────────────────────────────────────
const KEY = 'cp_' + 'a'.repeat(64)
/** The board's E7 routes: alice is joined; bob's fox can be visited; carol takes no visits. */
function friendsApi(on: On, visitors: { login: string; favPet: string }[] = []) {
  const calls: { url: string; method: string; body?: string }[] = []
  on('http.fetch', (_$, e) => {
    const { url, init } = e as { url: string; init?: { method?: string; body?: string } }
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body })
    const reply = (status: number, body: unknown) => ({ value: { status, ok: status < 300, headers: {}, text: JSON.stringify(body) } }) as never
    if (url === 'https://board.test/v1/pet/bob') return reply(200, { login: 'bob', level: 9, favPet: 'fox', wearing: ['scarf'], isFirstToday: true })
    if (url === 'https://board.test/v1/pet/carol') return reply(403, { error: "carol isn't taking visits" })
    if (url === 'https://board.test/v1/me') return reply(200, { visitsOff: true })
    if (url === 'https://board.test/v1/score') return reply(200, { rank: 2, visitors })
    return reply(404, { error: 'not found' })
  })
  return calls
}

test('E7-S01: /pet card gives the badge Markdown for a joined player, and copies it', { options: BOARD } as never, async ($, on) => {
  const store = repo(on, {})
  friendsApi(on)
  let copied = ''
  on('ui.copy', (_$, e) => ((copied = e.text), { value: { isCopied: true } }) as never)
  expect((await $.command.run(run('pet', 'card'))).text).toContain('/pet join first')
  store.board = { url: 'https://board.test', login: 'alice', apiKey: KEY }
  const ran = await $.command.run(run('pet', 'card'))
  const md = "[![alice's Claude Pet](https://board.test/card/alice.svg)](https://github.com/quangtm0404/claude-pets)"
  expect(ran.text).toContain(md)
  expect(copied).toBe(md)
})

test('E7-S02: /pet visit brings a friend\'s pet for a minute, +5 XP the first time a day', { options: BOARD } as never, async ($, on) => {
  const store = repo(on, {})
  store.board = { url: 'https://board.test', login: 'alice', apiKey: KEY }
  friendsApi(on)
  const ran = await $.command.run(run('pet', 'visit @bob'))
  expect(ran.text).toBe("bob's fox (LV9) comes to play for a minute. +5 XP for you both, once a day.")
  const stats = (await $.command.run(run('pet', 'stats'))).text
  expect(stats).toContain("Now: PLAYING WITH BOB'S FOX (LV9)")
  expect(stats).toContain('XP 5')
  expect((await $.command.run(run('pet', 'visit carol'))).text).toBe("carol isn't taking visits.")
})

test('E7-S02: visitors come back with the score: a toast and +5 XP each; /pet visits off tells the board', { options: BOARD } as never, async ($, on) => {
  const toasts: string[] = []
  const store = repo(on, {}, {}, toasts)
  store.board = { url: 'https://board.test', login: 'alice', apiKey: KEY }
  const calls = friendsApi(on, [{ login: 'bob', favPet: 'fox' }])
  on('turn.complete', (_$, e) => ({ text: e.answer }) as never)
  await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't', reason: 'answer' } as never)
  expect(toasts).toContain("▶ BOB'S FOX VISITED PIXEL · +5 XP")
  expect(store.petXp).toBe(7) // 2 for the turn, 5 for the visit
  const off = await $.command.run(run('pet', 'visits off'))
  expect(off.text).toContain('Visits off')
  expect(calls.find(c => c.url === 'https://board.test/v1/me')?.body).toBe('{"visitsOff":true}')
})

test('E7-S03: /pet diary tells the day; the card is an SVG picture', async ($, on) => {
  const store = repo(on, { 'docs/backlog/BACKLOG.md': STORY_MD })
  on('tool.call', () => ({ result: {}, text: '  12 passed (3s)' }) as never)
  on('turn.complete', (_$, e) => ({ text: e.answer }) as never)
  let copied = ''
  on('ui.copy', (_$, e) => ((copied = e.text), { value: { isCopied: true } }) as never)
  await $.command.run(run('story', 'E12-S03'))
  await $.tool.call({ tool: 'Bash', command: 'npx playwright test' } as never)
  await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't', reason: 'answer' } as never)
  const diary = (await $.command.run(run('pet', 'diary'))).text
  expect(diary).toContain("PIXEL'S DIARY · 2026-10-09")
  expect(diary).toContain('Tests: 1 green, 0 red')
  expect(diary).toContain('Turns: 1')
  expect(diary).toContain('Worked on: E12-S03')
  expect((store.diary as { xp: number }).xp).toBe(12) // 10 for green, 2 for the turn
  const card = await $.command.run(run('pet', 'diary card'))
  expect(card.text).toContain('Copied the diary card as SVG')
  expect(copied).toMatch(/^<svg [^>]*>.*PIXEL&#39;S DIARY|^<svg [^>]*>.*PIXEL'S DIARY/)
})

// ── E8: life and seasons ────────────────────────────────────────────────────
const NINE = Date.parse('2026-10-09T09:00:00Z')
/** A session on a clock the test moves: the store, toasts and sounds it records. */
function timed(on: On, seed: Record<string, unknown> = {}, now = NINE) {
  const store: Record<string, unknown> = { ...seed }
  const toasts: string[] = []
  const clock = mock.clock(on, { now })
  on('session.root', () => ({ value: '/repo' }))
  on('session.model', () => ({ value: 'claude-opus-5-5[1m]' }))
  on('fs.exists', () => ({ value: false }))
  on('store.get', (_$, e) => ({ value: store[(e as { key: string }).key] }) as never)
  on('store.set', (_$, e) => ((store[(e as { key: string }).key] = (e as { value: unknown }).value), { value: undefined }) as never)
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', (_$, e) => (toasts.push(e.text), { value: undefined }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }) as never)
  return { store, toasts, clock }
}
const bandText = async ($: { ui: { mount: (x: never) => Promise<{ find: (q: { text: RegExp }) => Promise<unknown>; unmount: () => Promise<void> }> } }, re: RegExp) => {
  const ui = await $.ui.mount(tallBand('terminal') as never)
  const found = await ui.find({ text: re })
  await ui.unmount()
  return found
}

test('E8-S01: focus times parse as Pomodoro rounds; every fourth break is long', () => {
  expect(parseFocus('')).toEqual({ focusMin: 25, breakMin: 5 })
  expect(parseFocus('45')).toEqual({ focusMin: 45, breakMin: 5 })
  expect(parseFocus('45/5')).toEqual({ focusMin: 45, breakMin: 5 })
  expect(parseFocus('50 10')).toEqual({ focusMin: 50, breakMin: 10 })
  expect(parseFocus('soon')).toBeNull()
  expect(parseFocus('500')).toBeNull()
  expect(focusXp(25)).toBe(10)
  expect(focusXp(45)).toBe(18)
  const f = { focusMin: 25, breakMin: 5, phase: 'focus' as const, endsAt: 0, round: 1 }
  expect(breakAfter(f)).toBe(5)
  expect(breakAfter({ ...f, round: 4 })).toBe(15)
  expect(focusLabel({ ...f, endsAt: 61_000 }, 0)).toBe('◷ FOCUS 1:01 · ROUND 1')
})

test('E8-S01: /pet focus 25/5 counts down in the band, pays XP, takes a break, then starts round 2', async ($, on) => {
  const { store, toasts, clock } = timed(on)
  const ran = await $.command.run(run('pet', 'focus 25/5'))
  expect(ran.text).toContain('Focus 25 min, then a 5 min break')
  expect(await bandText($, /◷ FOCUS 25:00 · ROUND 1/)).toBeDefined()
  await clock.advance(10 * 60_000)
  expect(await bandText($, /◷ FOCUS 15:00 · ROUND 1/)).toBeDefined()
  expect((await $.command.run(run('pet', 'stats'))).text).toContain('Now: GUARDING YOUR FOCUS')

  await clock.advance(15 * 60_000)
  expect(toasts).toContain('▶ FOCUS ROUND 1 DONE · +10 XP · 5 MIN BREAK: STAND UP, STRETCH, DRINK SOME WATER')
  expect(store.petXp).toBe(10)
  expect((store.diary as { focus: number }).focus).toBe(1)
  expect(await bandText($, /☕ BREAK 5:00/)).toBeDefined()

  await clock.advance(5 * 60_000)
  expect(toasts.some(t => t.startsWith('▶ BREAK OVER · FOCUS ROUND 2: 25 MIN'))).toBe(true)
  expect(await bandText($, /◷ FOCUS 25:00 · ROUND 2/)).toBeDefined()
})

test('E8-S01: /pet focus stop ends it early with no XP', async ($, on) => {
  const { store, toasts, clock } = timed(on)
  await $.command.run(run('pet', 'focus'))
  await clock.advance(20 * 60_000)
  expect((await $.command.run(run('pet', 'focus stop'))).text).toContain('earns no XP')
  await clock.advance(10 * 60_000)
  expect(store.focus).toBeNull()
  expect(store.petXp).toBeUndefined()
  expect(toasts.filter(t => t.includes('FOCUS'))).toEqual([])
  expect(await bandText($, /◷ FOCUS/)).toBeUndefined()
})

const START = { cwd: '/repo', surface: 'terminal', isInteractive: true } as never
test('E8-S01: the timer survives a reload; one that ended while Claude Code was closed is dropped', async ($, on) => {
  on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
  on('session.surfaces', () => ({ value: ['terminal'] }) as never)
  on('ui.log', () => ({ value: undefined }) as never)
  on('ui.blit', () => ({ value: {} }) as never)
  on('http.fetch', () => ({ value: { status: 500, ok: false, headers: {}, text: '' } }) as never)
  const { store, toasts, clock } = timed(on, { focus: { focusMin: 25, breakMin: 5, phase: 'focus', endsAt: NINE + 60_000, round: 3 } })
  await $.session.start(START)
  expect(await bandText($, /◷ FOCUS 1:00 · ROUND 3/)).toBeDefined()
  await clock.advance(60_000)
  expect(toasts[0]).toContain('FOCUS ROUND 3 DONE · +10 XP')

  store.focus = { focusMin: 25, breakMin: 5, phase: 'focus', endsAt: NINE - 3_600_000, round: 1 }
  await $.session.start(START)
  expect(store.focus).toBeNull()
  // let the session's own first reads settle before the test ends
  await clock.advance(1000)
})

// ── E10: a new look ─────────────────────────────────────────────────────────
test('E10-S01: every animal has a grown-up and a baby sprite that fit, with legs joined to the body', () => {
  for (const kind of Object.keys(HD) as (keyof typeof HD)[]) {
    for (const stage of ['adult', 'baby'] as const) {
      for (const pose of ['walkA', 'walkB', 'sit', 'sleep'] as const) {
        const rows = hdSprite(kind, stage, pose)
        expect(rows.length).toBeLessThanOrEqual(HD_H)
        for (const r of rows) expect(r.length).toBeLessThanOrEqual(stage === 'baby' ? 8 : 12)
        // a leg pixel touches the body above it or a neighbour that does: no floating dots once traced
        const lit = (x: number, y: number) => (rows[y]?.[x] ?? '.') !== '.'
        for (let y = rows.length - 2; y < rows.length; y++) {
          for (let x = 0; x < rows[y]!.length; x++) {
            if (lit(x, y)) expect(lit(x, y - 1) || lit(x - 1, y) || lit(x + 1, y)).toBe(true)
          }
        }
      }
      expect(hdSprite(kind, stage, 'walkA').join('')).toMatch(/e/)
      expect(hdSprite(kind, stage, 'sleep').join('')).not.toMatch(/e/)
    }
  }
})

test('E10-S02: a sprite traces into one rounded, outlined shape with real eyes; skins recolour it', () => {
  expect(traceLoops((x, y) => y === 0 && x < 2, 2, 1)).toEqual([[[0, 0], [2, 0], [2, 1], [0, 1]]])
  const cat = vectorPet({ kind: 'cat', stage: 'adult', pose: 'walkA', mood: 'happy', isBlinking: false })
  expect(cat.svg).toContain('stroke-linejoin="round"')
  expect(cat.svg.match(/<circle [^>]*r="0.5"/g)).toHaveLength(2) // two eyes
  expect(cat.svg).toContain('#f0a040')
  const ghost = vectorPet({ kind: 'cat', stage: 'adult', pose: 'walkA', mood: 'happy', skin: 'ghost', isBlinking: false })
  expect(ghost.svg).not.toContain('#f0a040')
  const asleep = vectorPet({ kind: 'cat', stage: 'adult', pose: 'sleep', mood: 'happy' })
  expect(asleep.svg).not.toMatch(/<circle [^>]*r="0.5"/)
  const hat = vectorPet({ kind: 'cat', stage: 'adult', pose: 'sit', mood: 'happy', items: ['hat'], isBlinking: false })
  expect(hat.svg).toContain('#2b2b2b')
})

test('E10-S03: the terminal shows the bigger pet when the band has room; /pet size small keeps the classic one', async ($, on) => {
  const store = repo(on, {})
  const big = await $.ui.mount(tallBand('terminal') as never)
  expect((await big.find({ type: 'Raster', key: 'pet' }))?.props.rows).toBe(5)
  await big.unmount()
  const short = await $.ui.mount({ ...tallBand('terminal'), props: { ...tallBand('terminal').props, maxRows: 8 } } as never)
  expect((await short.find({ type: 'Raster', key: 'pet' }))?.props.rows).toBe(3)
  await short.unmount()
  expect((await $.command.run(run('pet', 'size small'))).text).toContain('classic')
  expect(store.petSize).toBe('small')
  const small = await $.ui.mount(tallBand('terminal') as never)
  expect((await small.find({ type: 'Raster', key: 'pet' }))?.props.rows).toBe(3)
  await small.unmount()
})

// ── E9: blind boxes ─────────────────────────────────────────────────────────
test('E9-S01: a box rolls its rarity by the odds, and ten without an epic make the next one epic', () => {
  expect(rollBox(0, 0, 0)).toEqual({ rarity: 'common', loot: { kind: 'item', id: 'flower' } })
  expect(rollBox(0.7, 0.5, 0).rarity).toBe('rare')
  expect(rollBox(0.9, 0, 0)).toEqual({ rarity: 'epic', loot: { kind: 'item', id: 'halo' } })
  expect(rollBox(0.99, 0.99, 0)).toEqual({ rarity: 'legendary', loot: { kind: 'pet', id: 'axolotl' } })
  expect(rollBox(0, 0.3, BOX_PITY - 1).rarity).toBe('epic')
  expect(Object.values(BOX_ODDS).reduce((a, b) => a + b, 0)).toBe(100)
})

test('E9-S01: levelling up earns a blind box; /pet box open shakes it in the band, then shows the find', async ($, on) => {
  const { store, toasts, clock } = timed(on, { petXp: 14 })
  on('turn.complete', (_$, e) => ({ text: e.answer }) as never)
  await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't', reason: 'answer' } as never)
  expect(toasts).toContain('▶ +1 BLIND BOX FOR LEVELLING UP · /pet box open')
  expect((store.wallet as { boxes: number }).boxes).toBe(4) // 3 to start with, 1 for LV2
  expect((await $.command.run(run('pet', 'box'))).text).toContain('BLIND BOXES · 4 to open')

  const opened = await $.command.run(run('pet', 'box open'))
  expect(opened.text).toContain('Opening a blind box')
  expect((store.wallet as { boxes: number }).boxes).toBe(3)
  expect((await $.command.run(run('pet', 'stats'))).text).toMatch(/PIXEL|LV2/)
  await clock.advance(BOX_REVEAL_MS)
  const found = toasts.find(t => t.startsWith('▶ BLIND BOX: '))
  expect(found).toMatch(/COMMON|RARE|EPIC|LEGENDARY/)
  const w = store.wallet as { owned: string[]; skins: string[]; pets: string[]; coins: number }
  expect(w.owned.length + w.skins.length + w.pets.length + (w.coins > 0 ? 1 : 0)).toBeGreaterThan(0)
  expect((await $.command.run(run('pet', 'collection'))).text).toContain('COLLECTION')
})

test('E9-S02: box animals and skins need finding first; once found they can be used', async ($, on) => {
  const store = repo(on, {})
  expect((await $.command.run(run('pet', 'dragon'))).text).toContain('only hatches from a blind box')
  expect((await $.command.run(run('pet', 'skin ghost'))).text).toContain("haven't found")
  expect((await $.command.run(run('pet', 'buy halo'))).text).toContain('only comes out of a blind box')
  expect((await $.command.run(run('pet', 'list'))).text).toContain('🔒 dragon')
  store.wallet = { coins: 0, owned: ['halo'], wearing: [], boxes: 0, skins: ['ghost'], skin: null, pets: ['dragon'], sinceEpic: 0 }
  expect((await $.command.run(run('pet', 'dragon'))).text).not.toContain('only hatches')
  expect((await $.command.run(run('pet', 'skin ghost'))).text).toBe('Now ghost.')
  expect((await $.command.run(run('pet', 'wear halo'))).text).toBe('Wearing the halo.')
  expect(store.wallet).toMatchObject({ skin: 'ghost', wearing: ['halo'] })
  expect((await $.command.run(run('pet', 'collection'))).text).toContain('🐉 dragon')
})

// ── The collection as a checklist ───────────────────────────────────────────
test('/pet collection lists every find by rarity, found or locked, with a count', () => {
  const text = collectionText({ coins: 40, owned: ['flower', 'bow'], wearing: ['flower'], boxes: 2, skins: ['ghost'], skin: null, pets: ['dragon'], sinceEpic: 0 })
  expect(text).toContain('COLLECTION · 3/15 found · ◆40 · 2 blind boxes to open')
  expect(text).toMatch(/◇ COMMON\s+✓ flower\* {2}🔒 headphones {2}🔒 bandana/)
  expect(text).toContain('✓ ghost')
  expect(text).toContain('🐉 dragon')
  expect(text).toContain('🔒 unicorn')
  expect(text).toMatch(/Shop items\s+bow/)
})

// ── E8-S02: break reminders ─────────────────────────────────────────────────
const turnDone = async ($: { turn: { complete: (x: never) => Promise<unknown> } }, answer = 'ok', durationMs = 60_000) =>
  $.turn.complete({ answer, durationMs, isAborted: false, turnId: 't', reason: 'answer' } as never)

test('E8-S02: the breaks setting reads minutes or off', () => {
  expect(parseBreaks('')).toBeNull()
  expect(parseBreaks('on')).toBe(60)
  expect(parseBreaks('off')).toBe(0)
  expect(parseBreaks('45 min')).toBe(45)
  expect(parseBreaks('5')).toBeNull()
  expect(parseBreaks('soon')).toBeNull()
})

test('E8-S02: after an hour of work a finished turn brings a stretch reminder, at most once an hour; a pause starts over', async ($, on) => {
  const { store, toasts, clock } = timed(on)
  on('turn.complete', (_$, e) => ({ text: e.answer }) as never)
  const reminders = () => toasts.filter(t => t.includes('MIN OF WORK'))
  // turns every 9 minutes: continuous work
  for (let i = 0; i < 7; i++) {
    await turnDone($)
    await clock.advance(9 * 60_000)
  }
  await turnDone($)
  expect(reminders()).toEqual(['▶ 60 MIN OF WORK · PIXEL STRETCHES: STAND UP, LOOK AWAY, DRINK SOME WATER'])
  expect((await $.command.run(run('pet', 'stats'))).text).toContain('Now: STRETCHES · TIME FOR A BREAK AND SOME WATER')
  for (let i = 0; i < 4; i++) {
    await clock.advance(9 * 60_000)
    await turnDone($)
  }
  expect(reminders()).toHaveLength(1)

  // a 15 minute pause was a break: the clock starts over
  await clock.advance(15 * 60_000)
  await turnDone($)
  await clock.advance(9 * 60_000)
  await turnDone($)
  expect(reminders()).toHaveLength(1)

  expect((await $.command.run(run('pet', 'breaks off'))).text).toBe('Break reminders off.')
  expect(store.breaks).toBe(0)
  for (let i = 0; i < 10; i++) {
    await clock.advance(9 * 60_000)
    await turnDone($)
  }
  expect(reminders()).toHaveLength(1)
  expect((await $.command.run(run('pet', 'breaks 30'))).text).toContain('After 30 min of work')
})

// ── E8-S03: festivals ───────────────────────────────────────────────────────
test('E8-S03: Tết and Mid-Autumn are worked out from the lunar calendar for each year', () => {
  expect([2023, 2024, 2025, 2026, 2027, 2028, 2030].map(tetOf)).toEqual([
    '2023-01-22', '2024-02-10', '2025-01-29', '2026-02-17', '2027-02-06', '2028-01-26', '2030-02-02',
  ])
  expect([2024, 2025, 2026, 2027].map(midAutumnOf)).toEqual(['2024-09-17', '2025-10-06', '2026-09-25', '2027-09-15'])
  expect(festivalOn('2027-02-05')?.id).toBe('tet')
  expect(festivalOn('2026-09-25')?.id).toBe('midautumn')
  expect(festivalOn('2026-12-24')?.id).toBe('christmas')
  expect(festivalOn('2026-12-31')?.line).toContain('HAPPY NEW YEAR 2027')
  expect(festivalOn('2026-10-14')).toBeNull()
})

test('E8-S03: each festival draws its decorations behind the pet', () => {
  const f = { ...FRAME, columns: 60, tick: 12 }
  expect(lit(petPixels(f).px, 0xe53935)).toBe(0)
  expect(lit(petPixels({ ...f, festival: 'tet' }).px, 0xe53935)).toBeGreaterThan(4)
  expect(lit(petPixels({ ...f, festival: 'christmas' }).px, 0x2e7d32)).toBeGreaterThan(3)
  expect(lit(petPixels({ ...f, festival: 'midautumn', hd: true }).px, 0xfff1b8)).toBe(11)
  expect(lit(petPixels({ ...f, festival: 'midautumn' }).px, 0xb87333)).toBe(6)
  expect(lit(petPixels({ ...f, festival: 'newyear' }).px)).toBeGreaterThan(lit(petPixels(f).px))
})

test('E8-S03: the band celebrates on the day; /pet festivals off turns it off', async ($, on) => {
  const { store } = timed(on, {}, Date.parse('2026-12-24T10:00:00'))
  const ran = await $.command.run(run('pet', 'festivals'))
  expect(ran.text).toContain('Today: CHRISTMAS!')
  expect(ran.text).toContain('Coming up: Christmas 2026-12-25 · New Year 2027-01-01 · Tết 2027-02-06')
  expect((await $.command.run(run('pet', 'stats'))).text).toContain('Now: DECORATES THE TREE · MERRY CHRISTMAS!')
  await $.command.run(run('pet', 'festivals off'))
  expect(store.festivals).toBe(false)
  expect((await $.command.run(run('pet', 'stats'))).text).not.toContain('CHRISTMAS')
})

// ── E8-S04: the birthday ────────────────────────────────────────────────────
test('E8-S04: a birthday is the adoption day in a later year; 29 February falls on the 28th', () => {
  expect(birthdayAge('2025-10-09', '2026-10-09')).toBe(1)
  expect(birthdayAge('2026-10-09', '2026-10-09')).toBe(0)
  expect(birthdayAge('2024-02-29', '2025-02-28')).toBe(1)
  expect(birthdayAge('2024-02-29', '2028-02-29')).toBe(4)
  expect(nextBirthday('2026-10-09', '2026-10-09')).toBe('2027-10-09')
})

const PROFILE_SINCE = (since: string) => ({ since, totals: { xp: 0, coins: 0, bugs: 0, helpers: 0, green: 0, turns: 0, balls: 0 }, byKind: {}, streak: { days: 0, best: 0, last: '' }, badges: [] })

test('E8-S04: on its birthday the pet wears a party hat and gets a one-off gift', async ($, on) => {
  const { store, toasts } = timed(on, { profile: PROFILE_SINCE('2025-10-09') })
  const ran = await $.command.run(run('pet', 'birthday'))
  expect(ran.text).toContain("It's Pixel's birthday: 1 today!")
  expect(store.adoptedOn).toBe('2025-10-09')
  expect(store.petXp).toBe(BIRTHDAY_XP)
  expect(toasts).toContain(`▶ HAPPY BIRTHDAY, PIXEL! 1 YEAR TOGETHER TODAY · +${BIRTHDAY_XP} XP`)
  await $.command.run(run('pet', 'birthday'))
  expect(store.petXp).toBe(BIRTHDAY_XP)
  expect((await $.command.run(run('pet', 'buy party'))).text).toContain("comes out by itself on your pet's birthday")
  expect(lit(petPixels({ ...FRAME, columns: 40, hd: true, stage: 'baby', items: ['party'] }).px, 0xff5ca8)).toBeGreaterThan(3)
})

test('E8-S04: a new pet is adopted today; /pet birthday says when the party is', async ($, on) => {
  const { store } = timed(on)
  expect((await $.command.run(run('pet', 'birthday'))).text).toContain('Next birthday: 2027-10-09, in 365 days, turning 1')
  expect(store.adoptedOn).toBe('2026-10-09')
  expect(store.petXp).toBeUndefined()
})

// ── E8-S05: chatter ─────────────────────────────────────────────────────────
test('E8-S05: the summary for chatter holds counts only', () => {
  expect(toolKind('Edit')).toBe('edits')
  expect(toolKind('Bash')).toBe('commands')
  expect(toolKind('mcp__github__create_issue')).toBe('connector calls')
  const s = turnSummary({ counts: { edits: 3, commands: 2 }, failed: 1, tests: { passed: 12, failed: 0 } }, 125_000, 'happy', Date.parse('2026-10-09T15:00:00'), false)
  expect(s).toBe("A turn of 2 minutes in the afternoon. Steps: 3 edits, 2 commands (1 failed). Tests: 12 passed, 0 failed. The pet's mood: happy.")
})

test('E8-S05: chatter is off by default; on, a small model writes a line at most every 20 minutes, from the summary only', async ($, on) => {
  const { store, clock } = timed(on)
  on('turn.complete', (_$, e) => ({ text: e.answer }) as never)
  const sent: { model: string; prompt: string; system?: string }[] = []
  on('model.complete', (_$, e) => {
    sent.push(e as never)
    return { value: { isAnswered: true, text: '"Nice, all done!"', usage: { input_tokens: 90, output_tokens: 8, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } } as never
  })
  const SECRET = 'the answer mentions C:/secret/keys.txt and sk-123'
  await turnDone($, SECRET)
  await clock.advance(100)
  expect(sent).toHaveLength(0)

  expect((await $.command.run(run('pet', 'chatter on'))).text).toContain('Never your files, paths, commands, prompts or answers')
  expect(store.chatter).toBe(true)
  await turnDone($, SECRET, 30_000)
  await clock.advance(100)
  expect(sent).toHaveLength(1)
  expect(sent[0]!.model).toBe('haiku')
  expect(sent[0]!.prompt).toContain('What just happened: A turn of 30 seconds')
  expect(`${sent[0]!.prompt} ${sent[0]!.system}`).not.toMatch(/secret|sk-123|keys/)
  expect((await $.command.run(run('pet', 'stats'))).text).toContain('Now: SAYS: Nice, all done!')

  await clock.advance(5 * 60_000)
  await turnDone($)
  await clock.advance(100)
  expect(sent).toHaveLength(1)
  await clock.advance(CHATTER_EVERY_MS)
  await turnDone($)
  await clock.advance(100)
  expect(sent).toHaveLength(2)
  await $.command.run(run('pet', 'chatter off'))
  await clock.advance(CHATTER_EVERY_MS)
  await turnDone($)
  await clock.advance(100)
  expect(sent).toHaveLength(2)
})

// ── E13-S01: achievements for real work ────────────────────────────────────
test('E13-S01: green runs count in a row; a red run starts over, and the next green is a fix', () => {
  const w = { greenRun: 0, bestGreenRun: 0, fixes: 0, wasRed: false, commits: 0, focus: 0 }
  for (let i = 0; i < 3; i++) noteTestRun(w, 0)
  noteTestRun(w, 2)
  expect(w).toMatchObject({ greenRun: 0, bestGreenRun: 3, fixes: 0, wasRed: true })
  noteTestRun(w, 1)
  noteTestRun(w, 0)
  noteTestRun(w, 0)
  expect(w).toMatchObject({ greenRun: 2, bestGreenRun: 3, fixes: 1, wasRed: false })
  expect(ACHIEVEMENTS.map(a => a.id)).toEqual(expect.arrayContaining(['clean-sheet', 'comeback', 'shipper', 'deep-focus']))
})

test('E13-S01: test runs and commits unlock CLEAN SHEET, COMEBACK and SHIPPER, each once, with a box', async ($, on) => {
  const toasts: string[] = []
  const store = repo(on, {}, {}, toasts)
  on('tool.call', (_$, e) => {
    const cmd = String((e as { command?: string }).command)
    if (cmd.includes('--red')) return { result: {}, text: '  2 failed\n  10 passed (3s)' } as never
    if (cmd === 'git commit -m empty') return { result: {}, text: 'nothing to commit, working tree clean' } as never
    if (cmd.startsWith('git commit')) return { result: {}, text: '[main 1a2b3c4] fix the thing\n 1 file changed' } as never
    return { result: {}, text: '  12 passed (3s)' } as never
  })
  const bash = (command: string) => $.tool.call({ tool: 'Bash', command } as never)
  for (let i = 0; i < 10; i++) await bash('npx playwright test')
  expect(toasts.filter(t => t === '▶ ACHIEVEMENT: CLEAN SHEET')).toHaveLength(1)
  for (let i = 0; i < 5; i++) {
    await bash('npx playwright test --red')
    await bash('npx playwright test')
  }
  expect(toasts.filter(t => t === '▶ ACHIEVEMENT: COMEBACK')).toHaveLength(1)
  for (let i = 0; i < 12; i++) await bash('git commit -m "x"')
  await bash('git commit -m empty')
  await bash('git status')
  expect(toasts.filter(t => t === '▶ ACHIEVEMENT: SHIPPER')).toHaveLength(1)
  const p = store.profile as { work: Record<string, number>; badges: string[] }
  expect(p.work).toMatchObject({ commits: 12, fixes: 5, bestGreenRun: 10 })
  expect(p.badges).toEqual(expect.arrayContaining(['clean-sheet', 'comeback', 'shipper']))
  const board = await $.command.run(run('pet', 'board'))
  expect(board.text).toContain('Work: 12 commits · best 10 green runs in a row · 5 red runs turned green · 0 focus rounds')
  expect(toasts.some(t => t.startsWith('▶ +1 BLIND BOX FOR AN ACHIEVEMENT'))).toBe(true)
})

// ── E13-S02/S03: keepsakes and more festivals ──────────────────────────────
test('E13-S03: Valentine\'s Day and Halloween come round each year; days of your own too', () => {
  expect(festivalOn('2027-02-14')?.id).toBe('valentine')
  expect(festivalOn('2026-10-29')?.id).toBe('halloween')
  expect(festivalOn('2026-10-31')?.line).toBe('CARVES PUMPKINS · TRICK OR TREAT!')
  expect(festivalOn('2026-10-28')).toBeNull()
  const mine = [{ date: '11-20', title: "Teachers' Day" }]
  expect(festivalOn('2026-11-20', mine)).toEqual({ id: 'custom', title: "TEACHERS' DAY", line: "CELEBRATES TEACHERS' DAY!" })
  expect(festivalOn('2026-11-20')).toBeNull()
  expect(parseMyFestival("11-20 Teachers' Day")).toEqual({ date: '11-20', title: "Teachers' Day" })
  expect(parseMyFestival('2026-3-8 Women\'s Day')).toEqual({ date: '03-08', title: "Women's Day" })
  expect(parseMyFestival('02-30 Nope')).toBeNull()
  expect(parseMyFestival('soon party')).toBeNull()
  expect(upcomingFestivals('2026-10-14', mine)).toEqual([['Halloween', '2026-10-31'], ["Teachers' Day", '2026-11-20'], ['Christmas', '2026-12-25'], ['New Year', '2027-01-01']])
})

test('E13-S03: the new festivals draw hearts, pumpkins and confetti', () => {
  const f = { ...FRAME, columns: 60, tick: 12 }
  expect(lit(petPixels({ ...f, festival: 'valentine' }).px, 0xe53935) + lit(petPixels({ ...f, festival: 'valentine' }).px, 0xff4f81)).toBeGreaterThan(3)
  expect(lit(petPixels({ ...f, festival: 'halloween' }).px, 0xfb8c00)).toBeGreaterThan(3)
  expect(lit(petPixels({ ...f, festival: 'halloween' }).px, 0x9575cd)).toBe(3)
  expect(lit(petPixels({ ...f, festival: 'custom' }).px)).toBeGreaterThan(lit(petPixels(f).px) + 3)
})

test('E13-S02/S03: a festival gives its keepsake once; /pet festivals adds and removes days of your own', async ($, on) => {
  const { store, toasts, clock } = timed(on, {}, Date.parse('2026-10-30T10:00:00'))
  const ran = await $.command.run(run('pet', 'festivals'))
  expect(ran.text).toContain('Today: HALLOWEEN!')
  expect(ran.text).toContain('Keepsakes 1/6')
  expect(toasts).toContain('▶ A HALLOWEEN KEEPSAKE: PUMPKIN HAT · /pet wear pumpkin')
  await $.command.run(run('pet', 'festivals'))
  expect(toasts.filter(t => t.includes('KEEPSAKE'))).toHaveLength(1)
  expect((await $.command.run(run('pet', 'wear pumpkin'))).text).toBe('Wearing the pumpkin hat.')
  expect((await $.command.run(run('pet', 'buy santa'))).text).toBe('The santa hat is a christmas keepsake: it comes once, during 20 to 26 December. /pet festivals')
  expect((await $.command.run(run('pet', 'wear santa'))).text).toContain('christmas keepsake')
  expect((await $.command.run(run('pet', 'collection'))).text).toContain('Keepsakes    🔒 lixi  🔒 starlantern  🔒 santa  🔒 sparkler  🔒 hearts  ✓ pumpkin* (one at each festival)')

  expect((await $.command.run(run('pet', "festivals add 10-31 Ana's birthday"))).text).toBe("Added Ana's birthday on 10-31 every year: confetti in the band that day.")
  expect((await $.command.run(run('pet', 'festivals add someday'))).text).toContain('Give a date and a name')
  await $.command.run(run('pet', "festivals add 11-20 Teachers' Day"))
  expect(store.myFestivals).toEqual([{ date: '10-31', title: "Ana's birthday" }, { date: '11-20', title: "Teachers' Day" }])
  const list = await $.command.run(run('pet', 'festivals'))
  expect(list.text).toContain("Your own days: Ana's birthday (10-31) · Teachers' Day (11-20)")
  expect(list.text).toContain("Coming up: Halloween 2026-10-31 · Ana's birthday 2026-10-31")
  // a built-in festival on the same day comes first
  await clock.advance(86_400_000)
  expect((await $.command.run(run('pet', 'festivals'))).text).toContain('Today: HALLOWEEN!')
  expect((await $.command.run(run('pet', "festivals remove teachers' day"))).text).toBe("Removed Teachers' Day.")
  expect((await $.command.run(run('pet', 'festivals remove nope'))).text).toContain('No day of your own called "nope"')
  expect(store.myFestivals).toEqual([{ date: '10-31', title: "Ana's birthday" }])
})
