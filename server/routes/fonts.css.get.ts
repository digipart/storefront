// The fonts of the theme, served by the site itself: the visitor's browser never calls another company for them. The stylesheet of each family is read once from Google Fonts by THIS server, its font
// files are given at /font/... (server/routes/font), and both are kept in memory. `f` = the family names (those of the theme settings of Digipart).
const cache = new Map<string, string>()

export default defineEventHandler(async (event) => {
  const asked = getQuery(event).f
  const families = (Array.isArray(asked) ? asked : [asked]).filter((name): name is string => typeof name === 'string' && /^[A-Za-z0-9 ]{2,40}$/.test(name)).slice(0, 4)
  let css = ''
  for (const family of families) {
    if (!cache.has(family)) {
      try {
        const sheet = await $fetch<string>('https://fonts.googleapis.com/css2', { query: { family: family + ':wght@400;500;600;700', display: 'swap' }, responseType: 'text', retry: 0, timeout: 6000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' } })   // a recent browser: the answer is woff2, split by alphabet
        cache.set(family, sheet.replace(/https:\/\/fonts\.gstatic\.com\//g, '/font/'))
      } catch { cache.set(family, '') }   // the theme falls back on the fonts of the device
    }
    css += cache.get(family)
  }
  setResponseHeader(event, 'Content-Type', 'text/css; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')
  return css
})
