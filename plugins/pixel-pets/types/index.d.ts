export type TestRun = {
  passed: number
  failed: number
  skipped: number
  flaky: number
  command: string
}

export type LogLine = {
  id: string
  tool: string
  detail: string
  state: 'run' | 'ok' | 'err'
}

export type ThemeName = 'ice' | 'phosphor' | 'amber' | 'c64'

/** LIVE/DONE, DARK (built, not enabled), PARTIAL, TODO, BLOCKED, PROPOSED, or UNKNOWN. */
export type StoryStatus = 'LIVE' | 'DONE' | 'DARK' | 'PARTIAL' | 'TODO' | 'BLOCKED' | 'PROPOSED' | 'UNKNOWN'

export type StoryTask = { name: string; kind: string; status: StoryStatus }

/** One backlog row, read from the project's markdown (not from an issue tracker). */
export type Story = {
  /** The backlog file it was read from. */
  source: string
  id: string
  title: string
  status: StoryStatus
  statusText: string
  points: number | null
  epic: string
  section: string
  ac: string[]
  tasks: StoryTask[]
  path: string
  mtimeMs: number
}

/** One plan rate-limit window: percent used (0-100) and when it resets (ISO). */
export type UsageWindow = { percent: number; resetsAt: string | null }

export type Usage = {
  fiveHour: UsageWindow | null
  week: UsageWindow | null
  ctxPercent: number | null
  costUsd: number | null
  /** When the figures were last read (ms), so a re-read redraws the reset countdowns. */
  readAt?: number
}

/** The working copy the session is in. `mismatch` names a branch/story disagreement. */
export type GitInfo = { worktree: string; branch: string; dirty: number; mismatch: string | null }

/** The last test run that failed, kept for /defect. */
export type Failure = { command: string; failed: number; names: string[] }

export type PetKind =
  | 'cat' | 'dog' | 'crab' | 'shark' | 'turtle' | 'mouse' | 'fox'
  | 'orca' | 'whale' | 'dolphin' | 'giraffe' | 'tiger' | 'squirrel' | 'penguin'
export type Pet = { kind: PetKind; name: string }

declare module 'claude-code' {
  interface PluginState {
    'pixel-pets': {
      ticket: string | null
      env: string | null
      tokens: number
      turns: number
      tests: TestRun | null
      log: LogLine[]
      isBandHidden: boolean
      blink: boolean
      theme: ThemeName
      storyId: string | null
      story: Story | null
      storyError: string | null
      usage: Usage
      pet: Pet
      petLine: string
      petShown: boolean
      git: GitInfo | null
      guardOff: boolean
      chimeOn: boolean
      lastFailure: Failure | null
    }
  }
}
