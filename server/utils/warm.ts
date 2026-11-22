import type { H3Event } from 'h3'

// Warm-up: after a start or a publication, the engine draws its own pages (home, the links found from page to page, the sitemap) so the first visitors find them in memory (server/utils/pages.ts).
const MOST = 2000, TOGETHER = 2, WAIT = 20000
let done = 0, timer: ReturnType<typeof setTimeout> | null = null

export function warmPages(event: H3Event) {
  const round = pagesCleared()
  if (round === done || timer) { return }
  const config = useRuntimeConfig(event)
  const wanted = String(config.warmPages)
  if (wanted === '0' || ((config.localApp || config.fixtures) && wanted !== '1')) { done = round; return }
  const headers: Record<string, string> = {}
  for (const name of ['host', 'x-forwarded-host', 'x-forwarded-proto']) { const value = getRequestHeader(event, name); if (value) { headers[name] = value } }
  // waits a little: several saves in a row in the builder start one warm-up only
  timer = setTimeout(() => { timer = null; done = pagesCleared(); run(headers, done).catch(() => {}) }, WAIT)
}

async function run(headers: Record<string, string>, round: number) {
  const app = useNitroApp()
  const read = async (path: string) => { try { const answer = await app.localFetch(path, { headers }); return answer.status === 200 ? await answer.text() : '' } catch { return '' } }
  const local = (address: string) => { try { const url = new URL(address, 'http://x'); return url.search ? '' : url.pathname } catch { return '' } }
  const paths = new Set<string>(['/'])
  const home = await read('/')
  // home not kept = site closed or pages not shareable: nothing to warm
  if (!getPage(String(headers['x-forwarded-host'] || headers.host || '').toLowerCase() + '/')) { return }
  // the links of a page drawn are warmed too: products are reached even without a sitemap
  const follow = (html: string) => { for (const link of html.matchAll(/<a[^>]+href="(\/[^"#?]*)"/g)) { const path = link[1]!; if (paths.size < MOST && !personalPath(path) && !/\.[a-z0-9]{2,5}$/i.test(path)) { paths.add(path) } } }
  follow(home)
  const files = [...(await read('/sitemap.xml')).matchAll(/<loc>([^<]+)<\/loc>/g)].map(found => local(found[1]!)).filter(Boolean)
  // categories and pages before products
  files.sort((a, b) => Number(a.includes('product')) - Number(b.includes('product')))
  for (const file of files) {
    if (paths.size >= MOST || pagesCleared() !== round) { break }
    for (const found of (await read(file)).matchAll(/<loc>([^<]+)<\/loc>/g)) { const path = local(found[1]!.replace(/&amp;/g, '&')); if (path && paths.size < MOST) { paths.add(path) } }
  }
  const seen = new Set<string>(['/'])   // the home page is already drawn
  const worker = async () => {
    while (pagesCleared() === round) {
      const path = [...paths].find(one => !seen.has(one))
      if (!path) { return }
      seen.add(path)
      follow(await read(path))
    }
  }
  await Promise.all(Array.from({ length: TOGETHER }, worker))
}
