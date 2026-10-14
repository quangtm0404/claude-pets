// The profile (E3): lifetime totals, the daily streak, real work (E13-S01) and the achievements they earn.

export type XpReason = 'coin' | 'bug' | 'helper' | 'green' | 'turn' | 'ball' | 'game' | 'visit' | 'focus' | 'other'
export type Profile = {
  since: string
  totals: { xp: number; coins: number; bugs: number; helpers: number; green: number; turns: number; balls: number }
  byKind: Record<string, number>
  streak: { days: number; best: number; last: string }
  badges: string[]
  /** Real work, counted from 1.9.0 (E13-S01); missing in older saves. */
  work?: Work
}
export type Work = {
  /** Green test runs in a row now, and the most ever. */
  greenRun: number; bestGreenRun: number
  /** Failing runs turned green, and whether the last run failed. */
  fixes: number; wasRed: boolean
  commits: number
  focus: number
}
export const freshWork = (): Work => ({ greenRun: 0, bestGreenRun: 0, fixes: 0, wasRed: false, commits: 0, focus: 0 })
/** The work record of a profile, made when it has none. */
export const workOf = (p: Profile): Work => (p.work ??= freshWork())

/** A test run's result: green adds to the run (and is a fix after a red one), red starts the run over. */
export function noteTestRun(w: Work, failed: number): void {
  if (failed > 0) {
    w.greenRun = 0
    w.wasRed = true
    return
  }
  w.greenRun++
  w.bestGreenRun = Math.max(w.bestGreenRun, w.greenRun)
  if (w.wasRed) w.fixes++
  w.wasRed = false
}
export const COUNTER: Partial<Record<XpReason, keyof Profile['totals']>> = {
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
  // real work (E13-S01)
  { id: 'clean-sheet', title: 'CLEAN SHEET', hint: '10 green test runs in a row', earned: p => (p.work?.bestGreenRun ?? 0) >= 10 },
  { id: 'comeback', title: 'COMEBACK', hint: 'turn failing tests green 5 times', earned: p => (p.work?.fixes ?? 0) >= 5 },
  { id: 'shipper', title: 'SHIPPER', hint: 'make 10 commits', earned: p => (p.work?.commits ?? 0) >= 10 },
  { id: 'deep-focus', title: 'DEEP FOCUS', hint: 'finish 10 focus rounds', earned: p => (p.work?.focus ?? 0) >= 10 },
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

export function freshProfile(today: string): Profile {
  return {
    since: today,
    totals: { xp: 0, coins: 0, bugs: 0, helpers: 0, green: 0, turns: 0, balls: 0 },
    byKind: {},
    streak: { days: 0, best: 0, last: '' },
    badges: [],
  }
}
