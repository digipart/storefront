// The site for a page address: the language the address is in (its first segment when it is a language of the site), the rest of the address, and the site in that language (theme, header, footer).
export default defineEventHandler(async (event) => {
  const path = String(getQuery(event).path ?? '/')
  const preview = previewQuery(event)
  const base = await digipart(event, '', preview)
  if (!base) { throw createError({ statusCode: 404, statusMessage: 'no-site', message: 'This sales channel has no site run by Digipart Commerce.' }) }
  const segments = path.split('?')[0].split('/').filter(Boolean)
  const first = (segments[0] || '').toLowerCase()
  const languages: string[] = (base.Languages || []).map((l: any) => l.LanguageIsoCode)
  const prefixed = languages.includes(first) && (first !== base.DefaultLanguageIsoCode || base.UrlPrefix === 'always')
  const language = prefixed ? first : base.DefaultLanguageIsoCode
  let site = language === base.LanguageIsoCode ? base : await digipart(event, '', { ...preview, LanguageIsoCode: language })
  // a closed site (maintenance, opening soon): Digipart is asked again with the address of the visitor, to know whether this visitor sees the real site anyway (the allowed addresses of the shop)
  if (site?.Status && !site.Status.IsLive && !site.Preview) {
    const ip = getRequestIP(event, { xForwardedFor: true }) || ''
    if (ip) { site = (await digipart(event, '', { ...preview, LanguageIsoCode: language, IP: ip })) || site }
  }
  // a preview: where its theme is edited in Digipart (shown in the bar of the preview, to whoever holds the link)
  // the back-office of Digipart (shown in the bar of a preview only: the product or the category of the page is opened there)
  const admin = site?.Preview ? String(useRuntimeConfig(event).digipartUrl || useRuntimeConfig(event).localUrl).replace(/\/+$/, '') + '/index.php' : ''
  const edit = site?.Preview ? String(useRuntimeConfig(event).digipartUrl || useRuntimeConfig(event).localUrl).replace(/\/+$/, '') + '/index.php?module=storefront/builder&idMarketPlace=' + site.IdMarketPlace + '&theme=' + site.Theme.IdTheme : ''
  // the fonts of the theme, ready for the head of the page: their CSS and the files to load at once (server/utils/fonts.ts)
  // the header drawn over the banner of the home page (En-tête > « Transparent sur la bannière de l'accueil »): only on the home page, and only when its first section is a banner or a carousel
  const rest = (prefixed ? segments.slice(1) : segments).join('/')
  let overHero = false
  if (rest === '' && (site?.Header?.Sections || []).some((section: any) => section.Type === 'main_header' && section.Settings?.OverHero === true)) {
    const home = await digipart<any>(event, 'design.php', { ...preview, LanguageIsoCode: language, Key: 'home' }).catch(() => null)
    overHero = ['hero', 'slideshow'].includes(String(home?.Sections?.[0]?.Type || ''))
  }
  // a font of the shop itself comes with its files (`Files`); the others are read by their name
  const own = ownFonts((site?.Theme?.Fonts || []).filter((font: any) => Array.isArray(font?.Files)))
  const listed = await themeFonts((site?.Theme?.Fonts || []).filter((font: any) => !Array.isArray(font?.Files)).map((font: any) => font?.Name)).catch(() => ({ css: '', files: [] }))
  const fonts = { css: own.css + listed.css, files: [...own.files, ...listed.files].slice(0, 3) }
  // the page of a closed site, when the shop drew it in the site builder (`ClosedDesignKey`), and the one a preview of the builder asks to see (`closed=maintenance`), whatever the state of the site
  const asked = Object.keys(preview).length && ['maintenance', 'coming_soon'].includes(String(getQuery(event).closed ?? '')) ? String(getQuery(event).closed) : ''
  const closedKey = asked || (['maintenance', 'coming_soon'].includes(String(site?.ClosedDesignKey || '')) ? String(site.ClosedDesignKey) : '')
  const closedDesign = closedKey ? await withCode(event, await digipart<any>(event, 'design.php', { ...preview, LanguageIsoCode: language, Key: closedKey }).catch(() => null)) : null
  // the code sections of the header and of the footer (server/utils/liquid.ts)
  if (site?.Header) { site = { ...site, Header: await withCode(event, site.Header) } }
  if (site?.Footer) { site = { ...site, Footer: await withCode(event, site.Footer) } }
  return { ...site, ClosedDesign: closedDesign, ClosedForced: !!asked, FontCss: fonts.css, FontFiles: fonts.files, Origin: siteOrigin(event), Pro: !!useRuntimeConfig(event).forcePro || site?.PriceBaseType === 'wholesale', PreviewEditUrl: edit, PreviewAdminUrl: admin, Route: { LanguageIsoCode: language, Rest: rest, OverHero: overHero, Prefix: prefixed || base.UrlPrefix === 'always' ? '/' + language : '' } }
})
