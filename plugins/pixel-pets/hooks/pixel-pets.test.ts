import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

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

const tallBand = (surface: 'terminal' | 'desktop') => ({
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
  expect(String(art?.props.source)).toMatch(/^<svg [^>]*shape-rendering="crispEdges"/)
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

  const bad = await $.command.run(run('pet', 'unicorn'))
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
  const ran = await $.command.run(run('weather', ''))
  expect(ran.text).toContain('No place set')
  expect(urls.length).toBe(0)
})

test('E2-S01/S02: /weather <city> finds it, shows °C and °F, and /weather off forgets it', async ($, on) => {
  const store = repo(on, {})
  weatherApi(on, NOW(0, 27.8))
  const ran = await $.command.run(run('weather', 'Hanoi'))
  expect(ran.text).toBe('Weather for Hanoi, Vietnam: 28°C / 82°F, clear.')
  expect(store.weatherPlace).toEqual({ name: 'Hanoi, Vietnam', lat: 21.0245, lon: 105.84117 })
  const ui = await $.ui.mount(tallBand('terminal') as never)
  expect(await ui.find({ text: ' ☀ 28°C / 82°F' })).toBeDefined()
  expect(await ui.find({ text: ' · HANOI, VIETNAM' })).toBeDefined()
  await ui.unmount()
  const off = await $.command.run(run('weather', 'off'))
  expect(off.text).toContain('Weather off')
  const gone = await $.ui.mount(tallBand('terminal') as never)
  expect(await gone.find({ text: /°C/ })).toBeUndefined()
  await gone.unmount()
})

test('E2-S02: temperatureUnit f shows °F and mph only', { options: { temperatureUnit: 'f' } } as never, async ($, on) => {
  repo(on, {})
  weatherApi(on, NOW(61, 10, 40))
  await $.command.run(run('weather', 'Hanoi'))
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
    await $.command.run(run('weather', 'Hanoi'))
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
  expect(board.text).toContain('Achievements 0/8: none yet')
})

test('E3-S03: five green test runs unlock GREEN STREAK, once', async ($, on) => {
  const toasts: string[] = []
  repo(on, {}, {}, toasts)
  on('tool.call', () => ({ result: {}, text: '  12 passed (3s)' }) as never)
  for (let i = 0; i < 6; i++) await $.tool.call({ tool: 'Bash', command: 'npx playwright test' } as never)
  expect(toasts.filter(t => t === '▶ ACHIEVEMENT: GREEN STREAK').length).toBe(1)
  const board = await $.command.run(run('pet', 'board'))
  expect(board.text).toContain('6 green test runs')
  expect(board.text).toContain('Achievements 1/8: GREEN STREAK')
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
  expect(JSON.parse(put?.body ?? '{}')).toEqual({ xp: 2, level: 1, favPet: 'cat', streak: 1, bestStreak: 1 })
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

test('E5-S02: in a VS Code session, /pet shows the pet by opening its pane', async ($, on) => {
  engine(on, '')
  on('session.surfaces', () => ({ value: ['vscode'] }) as never)
  const opened: string[] = []
  on('ui.open', (_$, e) => (opened.push(e.id), { value: { isPlaced: true } }) as never)
  await $.command.run(run('pet', '')) // hides
  await $.command.run(run('pet', '')) // shows again
  expect(opened).toContain('pet')
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
