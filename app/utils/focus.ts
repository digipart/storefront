// Framing of a cropped picture per device, as CSS variables in percent (builder fields `<y>`, `<y>Pct`, `<y>Mobile`, `<y>MobilePct`, same for `<x>`).
const SIDES: Record<string, number> = { top: 0, left: 0, center: 50, bottom: 100, right: 100 }
const one = (value: unknown, pct: unknown, fallback: number): number =>
  value === 'custom' ? Math.max(0, Math.min(100, Number(pct) || 0)) : SIDES[String(value)] ?? fallback

export interface Focus { x: number, y: number, xm: number, ym: number }

export function focusOf(s: Record<string, any>, y: string, x: string, from: Focus = { x: 50, y: 50, xm: 50, ym: 50 }): Focus {
  const fx = one(s[x], s[x + 'Pct'], from.x), fy = one(s[y], s[y + 'Pct'], from.y)
  const same = (key: string) => !s[key + 'Mobile'] || s[key + 'Mobile'] === 'same'
  // « same » follows this picture's own desktop framing when it has one, else what it inherits
  return { x: fx, y: fy, xm: same(x) ? (s[x] && s[x] !== 'inherit' ? fx : from.xm) : one(s[x + 'Mobile'], s[x + 'MobilePct'], from.xm), ym: same(y) ? (s[y] && s[y] !== 'inherit' ? fy : from.ym) : one(s[y + 'Mobile'], s[y + 'MobilePct'], from.ym) }
}

export const focusVars = (f: Focus, prefix = 'f') => ({ ['--' + prefix + 'x-d']: f.x + '%', ['--' + prefix + 'y-d']: f.y + '%', ['--' + prefix + 'x-m']: f.xm + '%', ['--' + prefix + 'y-m']: f.ym + '%' })
