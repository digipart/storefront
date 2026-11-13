// One file of the sitemap: /sitemap/<product|category|page>-<language>-<page>.xml. Its addresses are those of this site, in that language, for what its sales channel sells.
export default defineEventHandler(async (event) => {
  const found = String(getRouterParam(event, 'name') || '').match(/^(product|category|page)-([a-z]{2,3})-(\d{1,4})\.xml$/)
  if (!found) { throw createError({ statusCode: 404, statusMessage: 'not-found' }) }
  const [, type, iso, page] = found
  const [site, plan] = await Promise.all([digipart(event, '', {}), digipart(event, 'sitemap.php', {})])
  const group = (plan?.Groups || []).find((g: any) => g.Type === type && g.LanguageIsoCode === iso)
  if (!site || !plan?.Active || site.State !== 'online' || site.Preferences?.PrivateMode || !group || Number(page) < 1 || Number(page) > Number(group.Pages)) { throw createError({ statusCode: 404, statusMessage: 'not-found' }) }
  const list = await digipart(event, 'sitemap.php', { Type: type, LanguageIsoCode: iso, Page: Number(page) })
  const base = siteOrigin(event) + languagePrefix(site, iso)
  const priority = Math.max(0, Math.min(1, Number(group.Priority) || 0.5)).toFixed(1)
  const frequency = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'].includes(String(group.Frequency)) ? String(group.Frequency) : 'weekly'
  const urls = ((list?.Paths || []) as any[]).filter(row => /^[\p{L}\p{N}_.\/-]{0,400}$/u.test(String(row.Path ?? ''))).map((row) => {
    const path = String(row.Path || '')
    const address = base + (path ? '/' + path.split('/').map(encodeURIComponent).join('/') : (base === siteOrigin(event) ? '/' : ''))
    return '  <url><loc>' + xml(address) + '</loc>' + (/^\d{4}-\d{2}-\d{2}$/.test(String(row.LastModified || '')) ? '<lastmod>' + row.LastModified + '</lastmod>' : '') + '<changefreq>' + frequency + '</changefreq><priority>' + (path === '' ? '1.0' : priority) + '</priority></url>'
  })
  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n'
})
