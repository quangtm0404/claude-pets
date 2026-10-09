# Claude Pets

A pixel pet game and retro dashboard for [Claude Code](https://claude.com/claude-code): an ice-cyan band above the prompt with your plan usage, the backlog story you're on, your branch, and a tiny pixel pet game that plays itself while Claude works.

```
              **** CLAUDE PETS ****                            ▐▌▐▌▐▌▐▌▐▌
 64K ACME-API ⎇ FEAT/E12-S03 ±3  OPUS · 12.3K TOK
 5H [████████░░] 82% ↻1H12M  WEEK [███░░░░░░░] 31% ↻3D4H  CTX 44%
 STORY E12-S03 [PARTIAL] TO RESET MY PASSWORD BY EMAIL
 E12 · SIGN-IN AND RECOVERY · 5 PTS · TASKS 1/2   TESTS:12 PASS 0 FAIL
 READY.
 █        ▪       █▄█  ▄▀              ▪
          ▪       ▀█▀█▀█          ▄▄   ▪
 ▔▔ ♥♥♡♡♡ LV3 XP 042 ◆7 · PIXEL IS GRUMPY · 5H 82% ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
```

> **Early access.** Claude Pets is a *mod*: a plugin of function hooks. Mods are an early-access Claude Code feature, so they have to be available on your account for Claude Pets to load.
>
> **Not affiliated with Anthropic.** Claude Pets (plugin id `pixel-pets`) is an independent community project; it is not made, endorsed or supported by Anthropic.

## Install

```sh
claude plugin marketplace add quangtm0404/claude-pets
claude plugin install pixel-pets@pixel-pets
```

Or try it from a clone without installing:

```sh
claude --plugin-dir ./plugins/pixel-pets
```

## What it does

### The band
- **Plan usage**: the 5-hour and weekly windows as bars with reset countdowns, plus context fill. They refresh every 30 seconds, with warnings at 80% and 95%, and at 85% context.
- **Branch and worktree**: repo name, branch and uncommitted file count. A red `≠` appears when the branch names a different epic than the story you're tracking.
- **Backlog story**: status, title, epic and tasks read from your markdown backlog (see below), not from an issue tracker.
- **Tests**: pass/fail from the last Playwright, Jest, Vitest, pytest, dotnet or npm test run.
- **Themes**: `/retro theme ice` (cyan on navy, the default), `phosphor` (green CRT), `amber`, or `c64`.

### The pet game
A 7×4-pixel pet walks the bottom of the band. Pick one of 14 with `/pet list` and `/pet <animal>`:

🐈 cat · 🐕 dog · 🦀 crab · 🦈 shark · 🐢 turtle · 🐁 mouse · 🦊 fox · 🐋 orca · 🐳 whale · 🐬 dolphin · 🦒 giraffe · 🐅 tiger · 🐿 squirrel · 🐧 penguin

| Event | In the game |
|---|---|
| A tool call succeeds | A coin drops; the pet collects it (+1 XP) |
| A tool call or test fails | A bug crawls in; the pet hunts and squashes it (+5 XP) |
| A green test run | +10 XP and a happy jump |
| Claude is working | The pet runs alongside |
| Idle for 2 minutes | It naps (`z Z`) |
| A long turn ends (30 s+) | It speaks: a meow, a woof, a roar, a whale song… |

**Hearts are your plan headroom.** At 70% of the fuller window the pet turns **grumpy**: ears back, red eyes, a grumpy voice. At 90% it's **furious**. At 100% it's **GAME OVER**, with a countdown to the reset. XP and levels persist between sessions.

**Helpers for subagents.** Every subagent Claude starts hatches a *helper*: a baby version of your pet with its number above it (#1, #2…). While the subagent works, the helper bustles around and earns +1 XP for each of its tool calls that works (a ◆ flashes). When the subagent finishes, the helper runs back to the main pet and hands its score over, +5 for a finished job: `▶ HELPER #1 IS HOME (Find the auth code) · +8 XP`. Up to four are drawn at once; `/pet stats` lists them all.

`/pet name` asks you for a name (or use `/pet name Mochi` directly), `/pet ball` throws a ball, `/pet pat` pats it, `/pet stats` shows progress, and `/pet` on its own hides or shows the pet.

### Guardrails
- **Generated files**: Claude's edits to files marked `@generated`, `DO NOT EDIT` or "generated from … regenerate" are refused, pointing back at their source.
- **Risky commands**: before `terraform apply`/`destroy`, Azure resource changes, force pushes, pushes to `main`/`release`/`prod`, `kubectl`/`helm` changes, or anything hitting a PROD URL, you're asked: **Run it / Allow for this session / Block it**.
- `/guard` shows the rules; `/guard off` turns them off for a session.

### Helpers
- **Story context**: the tracked story's acceptance criteria are attached to your next prompt when the story is new to the conversation, or when you mention it.
- `/standup64`: a three-line Done / Next / Blockers update, copied to the clipboard. It's written by Haiku from the session's facts.
- `/defect`: after a failed test run, drafts a bug report into the prompt.
- `/qa-pane`: a side pane with the story, tests, usage and a BASIC-style tool log.
- `/ticket PROJ-123 TST`: show an issue key and environment instead of a backlog story.

## Settings

Change them in `/config` under pixel-pets, or in `settings.json` under `pluginConfigs.pixel-pets`:

| Setting | Default | |
|---|---|---|
| `backlogFiles` | `docs/backlog/BACKLOG.md, BACKLOG.md, docs/milestones.md` | Comma-separated markdown files to search for a story id |
| `storyIdPattern` | `\b([A-Z]\d{1,3}-[A-Z]?\d{1,3})\b` | Regex with one capture group; matches `E12-S03`, `M1-14` |
| `defectCommand` | *(empty)* | What `/defect` starts with, e.g. `/report-defect` |
| `petKind` | `cat` | Starting pet |
| `petName` | `Pixel` | Starting name |

### Backlog formats
Claude Pets understands two markdown shapes; the first match wins.

**Story blocks** (status, points, acceptance criteria and a task table):
```markdown
## P2 · Accounts
### E12 · Sign-in and recovery
<details><summary><b>E12-S03</b> - as a <b>user</b>, I want <b>to reset my password by email</b> · 🟡 In progress · 5 pts</summary>

**Acceptance criteria**
- A reset link is emailed within a minute

| Task | Kind | Status |
|---|---|---|
| Reset token service | technical | 🚀 Live |
</details>
```

**Table rows** (under any `##` heading):
```markdown
## Milestone 1 — MVP
| Task | Deliverable | Status |
| --- | --- | --- |
| M1-14 | Helm chart v0.1 | ◐ in progress |
```

Statuses are recognised by words or symbols: live, done/✅, built-not-enabled (dark), in progress/◐/🟡, to do/⬜/✗, blocked/⛔ and proposed/💡.

Pick a story with `/story E12-S03`, or just mention its id in a prompt. A branch named like `feat/e12-s03` selects it at startup.

## Sounds
The only sound is **your current pet's own voice**: a meow, a woof, a roar, a whale song… and a grumpy version once your plan is nearly spent. It plays when a long turn ends, on a level-up, when the mood worsens and when you pat it, at most once every 20 seconds and at a gentle volume.

The 17 voices in `plugins/pixel-pets/sounds/` are synthesised from code by `tools/make_sounds.py`: soft sine harmonics shaped by moving formants (a meow's pitch rises and falls as its vowel slides from *ee* to *ow*), with no buzz or hiss, all at one gentle loudness. They're free to reuse, and you can swap any of them for your own recording with the same file name. `/retro sound off` mutes them.

## Platforms
Claude Pets runs wherever Claude Code's terminal does: **Windows, macOS and Linux**. The band, the pet game, helpers, usage, backlog, git and guardrails are the same everywhere. Sound plays through:

| OS | Player |
|---|---|
| Windows | PowerShell's built-in `Media.SoundPlayer` |
| macOS | Claude Code's own audio (`afplay`) |
| Linux | the first of `paplay` (PulseAudio/PipeWire), `pw-play` or `aplay` that's installed; silent if none is |

The pixel strip needs a terminal with 24-bit colour and Unicode block characters, which covers Windows Terminal, iTerm2, Terminal.app, GNOME Terminal, Konsole, kitty and WezTerm. In the desktop app the pet shows as an emoji line instead.

## Privacy
Everything stays local: the backlog files, git and the transcript are read on your machine, and state is kept in Claude Code's own plugin storage. The one exception is `/standup64`, which sends the session's facts and its last few messages to a Haiku model through your own Claude Code session.

## Development
```sh
claude plugin validate plugins/pixel-pets
claude plugin test plugins/pixel-pets
pip install numpy scipy && python plugins/pixel-pets/tools/make_sounds.py   # regenerate the voices
```

## License
MIT
