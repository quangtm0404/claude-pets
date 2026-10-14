// ── Seasons (E8-S03/S04): festivals worked out for the year, and the pet's birthday ──
// Tết and Mid-Autumn follow the Vietnamese lunar calendar (UTC+7). Their dates are
// computed from the new moons and the sun's longitude (Hồ Ngọc Đức's method, after
// Meeus), never looked up from a table, so every year works.

const INT = Math.floor
const RAD = Math.PI / 180
/** Vietnam's time zone: lunar months start on the day of the new moon there. */
const VN_TZ = 7

/** The Julian day number of a calendar date. */
export function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12), y = yy + 4800 - a, m = mm + 12 * a - 3
  return dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045
}

/** The calendar date of a Julian day number: [day, month, year]. */
export function jdToDate(jd: number): [number, number, number] {
  const a = jd + 32044, b = INT((4 * a + 3) / 146097), c = a - INT((b * 146097) / 4)
  const d = INT((4 * c + 3) / 1461), e = c - INT((1461 * d) / 4), m = INT((5 * e + 2) / 153)
  return [e - INT((153 * m + 2) / 5) + 1, m + 3 - 12 * INT(m / 10), b * 100 + d - 4800 + INT(m / 10)]
}

/** The k-th new moon after 1900-01-01, as a Julian day (fractional, UTC). */
function newMoon(k: number): number {
  const T = k / 1236.85, T2 = T * T, T3 = T2 * T
  const jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3
    + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * RAD)
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3
  const C1 = (0.1734 - 0.000393 * T) * Math.sin(M * RAD) + 0.0021 * Math.sin(2 * RAD * M)
    - 0.4068 * Math.sin(Mpr * RAD) + 0.0161 * Math.sin(RAD * 2 * Mpr) - 0.0004 * Math.sin(RAD * 3 * Mpr)
    + 0.0104 * Math.sin(RAD * 2 * F) - 0.0051 * Math.sin(RAD * (M + Mpr)) - 0.0074 * Math.sin(RAD * (M - Mpr))
    + 0.0004 * Math.sin(RAD * (2 * F + M)) - 0.0004 * Math.sin(RAD * (2 * F - M)) - 0.0006 * Math.sin(RAD * (2 * F + Mpr))
    + 0.001 * Math.sin(RAD * (2 * F - Mpr)) + 0.0005 * Math.sin(RAD * (2 * Mpr + M))
  const deltaT = T < -11
    ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
    : -0.000278 + 0.000265 * T + 0.000262 * T2
  return jd1 + C1 - deltaT
}

/** Which twelfth of the ecliptic the sun is in at the start of a local day (0 to 11). */
function sunSector(jd: number, tz: number): number {
  const T = (jd - 0.5 - tz / 24 - 2451545.0) / 36525, T2 = T * T
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2
  const DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(RAD * M)
    + (0.019993 - 0.000101 * T) * Math.sin(RAD * 2 * M) + 0.00029 * Math.sin(RAD * 3 * M)
  let L = (L0 + DL) * RAD
  L -= Math.PI * 2 * INT(L / (Math.PI * 2))
  return INT((L / Math.PI) * 6)
}

const newMoonDay = (k: number, tz: number) => INT(newMoon(k) + 0.5 + tz / 24)

/** The day the 11th lunar month (the one with the winter solstice) starts, in the year given. */
function lunarMonth11(yy: number, tz: number): number {
  const k = INT((jdFromDate(31, 12, yy) - 2415021) / 29.530588853)
  const nm = newMoonDay(k, tz)
  return sunSector(nm, tz) >= 9 ? newMoonDay(k - 1, tz) : nm
}

/** Where the leap month falls after the 11th month starting on `a11`. */
function leapMonthOffset(a11: number, tz: number): number {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5)
  let i = 1, arc = sunSector(newMoonDay(k + i, tz), tz), last: number
  do {
    last = arc
    i++
    arc = sunSector(newMoonDay(k + i, tz), tz)
  } while (arc !== last && i < 14)
  return i - 1
}

/** A (non-leap) lunar date as a Julian day number. */
export function lunarToJd(day: number, month: number, year: number, tz = VN_TZ): number {
  const [a11, b11] = month < 11 ? [lunarMonth11(year - 1, tz), lunarMonth11(year, tz)] : [lunarMonth11(year, tz), lunarMonth11(year + 1, tz)]
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853)
  let off = month - 11
  if (off < 0) off += 12
  // a year with 13 months: months after the leap one start a month later
  if (b11 - a11 > 365 && off >= leapMonthOffset(a11, tz)) off += 1
  return newMoonDay(k + off, tz) + day - 1
}

const iso = (jd: number) => {
  const [d, m, y] = jdToDate(jd)
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
/** Tết (the 1st of the 1st lunar month) of a year, YYYY-MM-DD. */
export const tetOf = (year: number) => iso(lunarToJd(1, 1, year))
/** Mid-Autumn (the 15th of the 8th lunar month) of a year, YYYY-MM-DD. */
export const midAutumnOf = (year: number) => iso(lunarToJd(15, 8, year))

export type FestivalId = 'tet' | 'midautumn' | 'christmas' | 'newyear'
export type Festival = { id: FestivalId; title: string; line: string }

/** What each festival is called, and what the pet does for it. */
export const FESTIVALS: Record<FestivalId, { title: string; line: (year: number) => string; when: string }> = {
  tet: { title: 'TẾT', line: () => 'HANGS LANTERNS · CHÚC MỪNG NĂM MỚI!', when: 'three days either side of the lunar new year' },
  midautumn: { title: 'MID-AUTUMN', line: () => 'SHARES A MOONCAKE · TẾT TRUNG THU', when: 'the three days up to the full moon of the 8th lunar month' },
  christmas: { title: 'CHRISTMAS', line: () => 'DECORATES THE TREE · MERRY CHRISTMAS!', when: '20 to 26 December' },
  newyear: { title: 'NEW YEAR', line: y => `WATCHES THE FIREWORKS · HAPPY NEW YEAR ${y}!`, when: '31 December and 1 January' },
}

/** The festival on a local calendar date (YYYY-MM-DD), or null. */
export function festivalOn(day: string): Festival | null {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  const jd = jdFromDate(d, m, y)
  const pick = (id: FestivalId, year = y): Festival => ({ id, title: FESTIVALS[id].title, line: FESTIVALS[id].line(year) })
  if ((m === 12 && d === 31) || (m === 1 && d === 1)) return pick('newyear', m === 12 ? y + 1 : y)
  if (m === 12 && d >= 20 && d <= 26) return pick('christmas')
  const tet = lunarToJd(1, 1, y)
  if (jd >= tet - 3 && jd <= tet + 3) return pick('tet')
  const moon = lunarToJd(15, 8, y)
  if (jd >= moon - 2 && jd <= moon) return pick('midautumn')
  return null
}

/** The festivals still to come from a date, soonest first: [title, YYYY-MM-DD]. */
export function upcomingFestivals(day: string): [string, string][] {
  const y = Number(day.slice(0, 4))
  const all: [string, string][] = []
  for (const year of [y, y + 1]) {
    all.push(['Tết', tetOf(year)], ['Mid-Autumn', midAutumnOf(year)], ['Christmas', `${year}-12-25`], ['New Year', `${year + 1}-01-01`])
  }
  return all.filter(([, d]) => d >= day).sort((a, b) => a[1].localeCompare(b[1])).slice(0, 4)
}

// ── The pet's birthday (E8-S04) ──────────────────────────────────────────────
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

/** How many years old the pet turns on `day`, or 0 when it isn't its birthday (29 Feb falls on the 28th). */
export function birthdayAge(adopted: string, day: string): number {
  const [ay, am, ad] = adopted.split('-').map(Number) as [number, number, number]
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  const bd = am === 2 && ad === 29 && !isLeap(y) ? 28 : ad
  return y > ay && m === am && d === bd ? y - ay : 0
}

/** The pet's next birthday on or after `day`, YYYY-MM-DD. */
export function nextBirthday(adopted: string, day: string): string {
  const [, am, ad] = adopted.split('-').map(Number) as [number, number, number]
  for (let y = Number(day.slice(0, 4)); ; y++) {
    const d = am === 2 && ad === 29 && !isLeap(y) ? 28 : ad
    const at = `${y}-${String(am).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (at > day && at > adopted) return at
    if (at === day && y > Number(adopted.slice(0, 4))) return at
  }
}

/** Whole days from one date to another (YYYY-MM-DD). */
export const daysBetween = (from: string, to: string) => {
  const j = (s: string) => {
    const [y, m, d] = s.split('-').map(Number) as [number, number, number]
    return jdFromDate(d, m, y)
  }
  return j(to) - j(from)
}
