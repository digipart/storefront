// The look a shop gave to a button in the site builder (class/Storefront/SectionCatalog.php: buttonLook): its style (full, outline, link), its text (size, weight, capitals, letter spacing), its shape (rounded
// corners, inner space, border) and its colours. `prefix` starts the keys of the settings ('' for the button block and the buy button, 'Button' for a section that has its own buttons: ButtonStyle, ButtonSize...).
// Only what differs from the usual button is written, so the style sheet keeps deciding the rest (the theme's colours and corners, the width of the buy button). `light`: a solid button on a picture is white.
export function buttonLook(settings: any, prefix = '', light = false) {
  const s = settings || {}
  const get = (name: string) => s[prefix + name]
  const style = get('Style') === 'outline' ? 'outline' : get('Style') === 'link' ? 'link' : 'solid'
  const custom = get('ColorMode') === 'custom'
  const border = Number(get('BorderWidth')) || 0
  const css: Record<string, string | undefined> = {}
  if (get('Size') && Number(get('Size')) !== 14) { css.fontSize = Number(get('Size')) + 'px' }
  if (get('Weight') && Number(get('Weight')) !== 600) { css.fontWeight = String(get('Weight')) }
  if (get('Case') === 'uppercase') { css.textTransform = 'uppercase' }
  if (get('Spacing') !== undefined && Number(get('Spacing')) !== 0.5) { css.letterSpacing = Number(get('Spacing')) + 'px' }
  if (style !== 'link') {
    if (Number(get('Radius')) > 0) { css.borderRadius = Number(get('Radius')) + 'px' }
    if ((get('PadX') !== undefined && Number(get('PadX')) !== 26) || (get('PadY') !== undefined && Number(get('PadY')) !== 11)) { css.padding = (get('PadY') ?? 11) + 'px ' + (get('PadX') ?? 26) + 'px' }
  }
  if (custom) {
    if (style === 'solid') { css.background = get('Background') }
    css.color = style === 'outline' ? get('Background') : get('Color')
  }
  if (border > 0 && style !== 'link') {
    css.border = border + 'px solid ' + (custom ? (get('BorderColor') || get('Background') || 'currentColor') : 'currentColor')
    css.boxShadow = 'none'
  }
  return { class: ['is-' + style, { 'is-light': light && style === 'solid' && !custom }], style: css }
}
