// The sitemap of the site: the list of its files, one per kind of content (products, categories, pages), language and page, as the module Sitemap of Digipart is set (api/storefront/sitemap.php).
// A site whose module is switched off, or that is not open yet, has no sitemap (404).
export default defineEventHandler(async (event) => {
  const [site, plan] = await Promise.all([digipart(event, '', {}), digipart(event, 'sitemap.php', {})])
  if (!site || !plan?.Active || site.State !== 'online' || site.Preferences?.PrivateMode) { throw createError({ statusCode: 404, statusMessage: 'not-found' }) }
  const origin = siteOrigin(event)
  const files: string[] = []
  for (const group of plan.Groups || []) {
    for (let page = 1; page <= Math.min(500, Number(group.Pages) || 0); page++) { files.push(origin + '/sitemap/' + group.Type + '-' + group.LanguageIsoCode + '-' + page + '.xml') }
  }
  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
  return '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + files.map(file => '  <sitemap><loc>' + xml(file) + '</loc></sitemap>').join('\n') + '\n</sitemapindex>\n'
})
