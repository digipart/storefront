/** The logo of the shop: the SVG, else the smallest picture at least 72 px high, else the largest; '' without one. */
export function shopLogo(site: any): string {
  const svg = site?.LogoFiles?.Svg?.Src
  if (svg) { return String(svg) }
  const copies = [...(site?.Logo || [])].filter((c: any) => c.Src).sort((x: any, y: any) => (x.Height || 0) - (y.Height || 0))
  return String((copies.find((c: any) => (c.Height || 0) >= 72) || copies[copies.length - 1])?.Src || '')
}
