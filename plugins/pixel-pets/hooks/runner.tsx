// The runner game (E6-S01): drawn by the surface itself, so it runs at its own
// frame rate while Claude works. The pet runs; bugs crawl in from the right;
// space, ↑ or a click jumps. Scores go back to the hooks module by post.
import type { ClientModule } from 'claude-code'

export type RunnerProps = {
  /** The pet's baby sprite (5×3), two running frames, letters mapped by `colors`. */
  frames: [string[], string[]]
  colors: Record<string, string>
  bg: string
  fg: string
  dim: string
  warn: string
  bug: string
  best: number
  columns: number
}

type Game = {
  isStarted: boolean
  isOver: boolean
  t: number
  y: number
  vy: number
  bugs: { x: number; isCounted: boolean }[]
  nextBug: number
  score: number
  best: number
  seed: number
}

const H = 6 // pixel rows: 3 text rows of half blocks
const PET_X = 3
const PET_W = 5
// a jump peaks 3 pixels up and lasts ~20 frames: about 8 cells clear of the ground
const GRAVITY = 0.06
const JUMP = 0.6
const TICK_MS = 60

const rand = (g: Game) => {
  g.seed = (g.seed * 1103515245 + 12345) >>> 0
  return (g.seed >>> 8) / 0x1000000
}

const fresh = (best: number, seed: number): Game => ({
  isStarted: false, isOver: false, t: 0, y: 0, vy: 0, bugs: [], nextBug: 18, score: 0, best, seed,
})

/** One frame of play: bugs move, the pet falls, a bug under the pet ends the run. */
export function step(g: Game, width: number): { scored: boolean; isHit: boolean } {
  g.t++
  let scored = false, isHit = false
  if (!g.isStarted || g.isOver) return { scored, isHit }
  const speed = 0.6 + Math.min(0.6, g.score * 0.02)
  for (const b of g.bugs) {
    b.x -= speed
    if (!b.isCounted && b.x + 2 < PET_X) {
      b.isCounted = true
      g.score++
      scored = true
    }
  }
  g.bugs = g.bugs.filter(b => b.x > -3)
  if (--g.nextBug <= 0) {
    g.bugs.push({ x: width + 1, isCounted: false })
    g.nextBug = Math.round(16 + rand(g) * 22 - Math.min(8, g.score / 3))
  }
  if (g.y > 0 || g.vy > 0) {
    g.y += g.vy
    g.vy -= GRAVITY
    if (g.y <= 0) {
      g.y = 0
      g.vy = 0
    }
  }
  const lift = Math.round(g.y)
  for (const b of g.bugs) {
    const bx = Math.round(b.x)
    if (bx < PET_X + PET_W && bx + 2 > PET_X && lift <= 1) isHit = true
  }
  if (isHit) {
    g.isOver = true
    g.best = Math.max(g.best, g.score)
  }
  return { scored, isHit }
}

/** Space, ↑ or a click: start, jump, or run again after a bump. */
export function press(g: Game, best: number): Game {
  if (!g.isStarted) return { ...g, isStarted: true }
  if (g.isOver) return { ...fresh(Math.max(best, g.best), g.seed), isStarted: true }
  if (g.y === 0) return { ...g, vy: JUMP }
  return g
}

const Runner: ClientModule<RunnerProps, Game> = (props, surface) => {
  const { Box, Text } = surface.elements
  const width = Math.max(20, surface.columns || props.columns)
  let g = surface.state
  if (g === undefined) {
    g = fresh(props.best, (props.best * 7919 + 17) >>> 0)
    surface.every(TICK_MS, () => {
      const cur = surface.state ?? g!
      const next = { ...cur, bugs: cur.bugs.map(b => ({ ...b })) }
      const { scored, isHit } = step(next, Math.max(20, surface.columns || props.columns))
      if (scored) surface.post({ type: 'score', score: next.score })
      if (isHit) surface.post({ type: 'over', score: next.score })
      surface.setState(next)
    })
    const jump = () => surface.setState(press(surface.state ?? g!, props.best))
    surface.onKey(k => {
      if (k.key === ' ' || k.key === 'up' || k.key === 'w' || k.key === 'return') jump()
    })
    surface.onPointer(p => {
      if (p.type === 'down') jump()
    })
  }

  // the pixels: the pet (running, or in the air), then the bugs
  const px: (string | null)[] = new Array<string | null>(width * H).fill(null)
  const set = (x: number, y: number, c: string) => {
    if (x >= 0 && x < width && y >= 0 && y < H) px[y * width + x] = c
  }
  const frame = g.isOver ? props.frames[0] : props.frames[Math.floor(g.t / 3) % 2] ?? props.frames[0]
  const top = H - frame.length - Math.round(g.y)
  frame.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      // facing right, toward the bugs
      const c = props.colors[row[row.length - 1 - rx] ?? '.']
      if (c) set(PET_X + rx, top + ry, c)
    }
  })
  for (const b of g.bugs) {
    const bx = Math.round(b.x)
    set(bx, H - 2, props.bug)
    set(bx + 1, H - 2, props.bug)
    set(g.t % 4 < 2 ? bx : bx + 1, H - 1, props.dim)
  }

  const rows = [0, 1, 2].map(r => {
    const runs: { ch: string; fg: string; bg: string; n: number }[] = []
    for (let x = 0; x < width; x++) {
      const t = px[r * 2 * width + x] ?? null, b = px[(r * 2 + 1) * width + x] ?? null
      const cell = t === null && b === null ? { ch: ' ', fg: props.bg, bg: props.bg }
        : b === null ? { ch: '▀', fg: t!, bg: props.bg }
        : t === null ? { ch: '▄', fg: b, bg: props.bg }
        : { ch: '▀', fg: t, bg: b }
      const last = runs[runs.length - 1]
      if (last && last.ch === cell.ch && last.fg === cell.fg && last.bg === cell.bg) last.n++
      else runs.push({ ...cell, n: 1 })
    }
    return (
      <Box flexDirection="row">
        {runs.map(run => <Text color={run.fg} backgroundColor={run.bg}>{run.ch.repeat(run.n)}</Text>)}
      </Box>
    )
  })
  const best = Math.max(props.best, g.best)
  const info = !g.isStarted ? ` ▶ CLICK HERE, THEN SPACE TO JUMP THE BUGS · BEST ${best}`
    : g.isOver ? ` BONK! SCORE ${g.score} · BEST ${best} · SPACE TO RUN AGAIN`
    : ` SCORE ${g.score} · BEST ${best} · SPACE / ↑ / CLICK: JUMP`
  return (
    <Box flexDirection="column" width={width}>
      {rows}
      <Text color={g.isOver ? props.warn : props.fg} backgroundColor={props.bg} wrap="truncate">
        {info.padEnd(width, ' ')}
      </Text>
    </Box>
  )
}

export default Runner
