// Weather (E2): the kinds, their labels and the band's weather row. Fetching stays in register.
import type { RenderChildren } from 'claude-code'
import type { Palette } from './theme'

// ── Weather (E2): Open-Meteo, no key; nothing is fetched until a place is set ──
export type TempUnit = 'both' | 'c' | 'f'
export type WeatherKind = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm'
export type WeatherPlace = { name: string; lat: number; lon: number }
export type Weather = {
  place: string
  tempC: number
  code: number
  kind: WeatherKind
  label: string
  windKmh: number
  isDay: boolean
}
export const WINDY_KMH = 30
export const WEATHER_EVERY_MS = 15 * 60_000

/** WMO weather codes, as Open-Meteo reports them, to a kind and a label. */
export function wmo(code: number): { kind: WeatherKind; label: string } {
  if (code === 0) return { kind: 'clear', label: 'CLEAR' }
  if (code <= 2) return { kind: 'cloudy', label: code === 1 ? 'MAINLY CLEAR' : 'PARTLY CLOUDY' }
  if (code === 3) return { kind: 'cloudy', label: 'OVERCAST' }
  if (code === 45 || code === 48) return { kind: 'fog', label: 'FOG' }
  if (code >= 51 && code <= 57) return { kind: 'rain', label: 'DRIZZLE' }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { kind: 'rain', label: code >= 80 ? 'SHOWERS' : 'RAIN' }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { kind: 'snow', label: 'SNOW' }
  if (code >= 95) return { kind: 'storm', label: 'THUNDERSTORM' }
  return { kind: 'cloudy', label: 'CLOUDY' }
}

export const toF = (c: number) => Math.round((c * 9) / 5 + 32)
export function fmtTemp(c: number, unit: TempUnit): string {
  const C = `${Math.round(c)}°C`, F = `${toF(c)}°F`
  return unit === 'c' ? C : unit === 'f' ? F : `${C} / ${F}`
}
export const fmtWind = (kmh: number, unit: TempUnit) =>
  unit === 'f' ? `${Math.round(kmh * 0.621)} MPH` : `${Math.round(kmh)} KM/H`

function weatherIcon(wx: Weather): string {
  if (wx.kind === 'clear') return wx.isDay ? '☀' : '☾'
  return { cloudy: '☁', fog: '≋', rain: '☂', snow: '❄', storm: '⚡' }[wx.kind]
}

export function weatherRow(Box: unknown, Text: unknown, C: Palette, wx: Weather | null, unit: TempUnit): RenderChildren {
  if (!wx) return null
  const B = Box as never, T = Text as never
  const tone = wx.kind === 'storm' ? C.fail : wx.kind === 'clear' && wx.isDay ? C.warn : C.info
  return h(B, { flexDirection: 'row' },
    h(T, { color: tone, backgroundColor: C.bg, bold: true }, ` ${weatherIcon(wx)} ${fmtTemp(wx.tempC, unit)}`),
    h(T, { color: C.fg, backgroundColor: C.bg }, ` · ${wx.label}`),
    h(T, { color: wx.windKmh >= WINDY_KMH ? C.warn : C.dim, backgroundColor: C.bg }, ` · WIND ${fmtWind(wx.windKmh, unit)}`),
    h(T, { color: C.dim, backgroundColor: C.bg, wrap: 'truncate' }, ` · ${wx.place.toUpperCase()}`),
  ) as RenderChildren
}

/** Finds a place by name (Open-Meteo geocoding). */
