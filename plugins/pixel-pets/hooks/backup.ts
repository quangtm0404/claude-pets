// ── A backup of the pet (E16-S01) ────────────────────────────────────────────
// /pet backup turns the save into one line of text to paste on another
// computer: /pet restore <code>. The leaderboard key and the weather place are
// left out (one is a secret, the other where you live).

/** The saved values a backup holds, as they are kept in the store. */
export const BACKUP_KEYS = [
  'pet', 'petXp', 'wallet', 'profile', 'adoptedOn', 'myFestivals', 'runnerBest', 'diary', 'diaryDays',
  'petShown', 'petSize', 'motion', 'theme', 'font', 'chimeOn', 'festivals', 'breaks', 'chatter', 'runnerAuto',
] as const
export type BackupKey = (typeof BACKUP_KEYS)[number]
export type Backup = Partial<Record<BackupKey, unknown>>

const PREFIX = 'PETS1-'
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function utf8(text: string): number[] {
  const bytes: number[] = []
  for (const part of encodeURIComponent(text).split(/(%[0-9A-F]{2})/i)) {
    if (part.startsWith('%')) bytes.push(parseInt(part.slice(1), 16))
    else for (const ch of part) bytes.push(ch.charCodeAt(0))
  }
  return bytes
}

function fromUtf8(bytes: number[]): string {
  return decodeURIComponent(bytes.map(b => `%${b.toString(16).padStart(2, '0')}`).join(''))
}

/** Base64 for URLs, without padding: safe to paste anywhere. */
export function toBase64(bytes: number[]): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    const chars = [(n >> 18) & 63, (n >> 12) & 63, (n >> 6) & 63, n & 63].slice(0, Math.min(4, bytes.length - i + 1))
    out += chars.map(c => B64[c]).join('')
  }
  return out
}

export function fromBase64(text: string): number[] | null {
  const bytes: number[] = []
  for (let i = 0; i < text.length; i += 4) {
    const quad = text.slice(i, i + 4)
    if (quad.length === 1) return null
    let n = 0
    for (let j = 0; j < 4; j++) {
      const v = j < quad.length ? B64.indexOf(quad[j]!) : 0
      if (v < 0) return null
      n = (n << 6) | v
    }
    bytes.push((n >> 16) & 255)
    if (quad.length > 2) bytes.push((n >> 8) & 255)
    if (quad.length > 3) bytes.push(n & 255)
  }
  return bytes
}

/** The backup code for these saved values. */
export function encodeBackup(data: Backup): string {
  const kept: Backup = {}
  for (const k of BACKUP_KEYS) if (data[k] !== undefined && data[k] !== null) kept[k] = data[k]
  return PREFIX + toBase64(utf8(JSON.stringify(kept)))
}

/** The saved values in a backup code, or null when it isn't one (cut short, mistyped, another app's). */
export function decodeBackup(code: string): Backup | null {
  const text = code.trim().replace(/\s+/g, '')
  if (!text.startsWith(PREFIX)) return null
  const bytes = fromBase64(text.slice(PREFIX.length))
  if (!bytes) return null
  try {
    const data = JSON.parse(fromUtf8(bytes)) as unknown
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null
    const out: Backup = {}
    for (const k of BACKUP_KEYS) if (k in data) out[k] = (data as Record<string, unknown>)[k]
    const pet = out.pet as { kind?: unknown; name?: unknown } | undefined
    if (!pet || typeof pet.kind !== 'string' || typeof pet.name !== 'string' || typeof out.petXp !== 'number') return null
    return out
  } catch {
    return null
  }
}
