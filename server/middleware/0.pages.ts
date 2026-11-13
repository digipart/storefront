// Serves a page kept in memory (server/utils/pages.ts) before anything is asked to Digipart. A page past its short life is still served at once, and drawn again behind for the next visitor.
export default defineEventHandler(async (event) => {
  const key = pageKey(event)
  if (!key) { return }
  touchStamp(event)   // a publication in Digipart drops the pages; never waited for
  const page = getRequestHeader(event, 'x-sf-fresh') ? null : getPage(key)
  if (!page) { event.context.sfPageKey = key; return }   // drawn now, then kept (server/plugins/compress.ts)
  const old = Date.now() - page.at > pageFresh(event)
  if (old && !page.refreshing) {
    page.refreshing = true
    const headers: Record<string, string> = { 'x-sf-fresh': '1' }
    for (const name of ['host', 'x-forwarded-host', 'x-forwarded-proto', 'accept-language', 'cookie']) { const value = getRequestHeader(event, name); if (value) { headers[name] = value } }
    useNitroApp().localFetch(event.path, { headers }).catch(() => {}).finally(() => { page.refreshing = false })
  }
  const { body, encoding } = pageBody(page, String(getRequestHeader(event, 'accept-encoding') || ''))
  setResponseHeaders(event, { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=600', vary: 'Accept-Encoding', 'x-sf-cache': old ? 'stale' : 'hit', ...(encoding ? { 'content-encoding': encoding } : {}) })
  return body
})
