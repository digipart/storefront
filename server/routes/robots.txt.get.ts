// What search engines may read. An open site: everything but the pages of one visitor (cart, order, account, search results), and where its sitemap is. A site that is not open yet, in
// private mode or reserved to professionals: nothing.
export default defineEventHandler(async (event) => {
  const site = await digipart(event, '', {}).catch(() => null)
  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
  const closed = !site || site.State !== 'online' || site.Preferences?.PrivateMode || (site.Status && site.Status.IsLive === false)
  if (closed) { return 'User-agent: *\nDisallow: /\n' }
  const own = ['panier', 'cart', 'commande', 'checkout', 'compte', 'account', 'favoris', 'wishlist', 'recherche', 'search']
  const prefixes = ['', ...(site.Languages || []).map((l: any) => '/' + l.LanguageIsoCode)]
  const lines = ['User-agent: *', 'Disallow: /api/', ...prefixes.flatMap(prefix => own.map(name => 'Disallow: ' + prefix + '/' + name)), '', 'Sitemap: ' + siteOrigin(event) + '/sitemap.xml']
  return lines.join('\n') + '\n'
})
