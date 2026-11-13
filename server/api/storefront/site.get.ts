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
  const edit = site?.Preview ? String(useRuntimeConfig(event).digipartUrl || useRuntimeConfig(event).localUrl).replace(/\/+$/, '') + '/index.php?module=storefront/builder&idMarketPlace=' + site.IdMarketPlace + '&theme=' + site.Theme.IdTheme : ''
  return { ...site, Origin: siteOrigin(event), Pro: !!useRuntimeConfig(event).forcePro || site?.PriceBaseType === 'wholesale', PreviewEditUrl: edit, Route: { LanguageIsoCode: language, Rest: (prefixed ? segments.slice(1) : segments).join('/'), Prefix: prefixed || base.UrlPrefix === 'always' ? '/' + language : '' } }
})
