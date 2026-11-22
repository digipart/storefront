// Serves a page kept in memory (server/utils/pages.ts) before anything is asked to Digipart. A page past its short life is still served at once, and drawn again behind for the next visitor.
export default defineEventHandler(async (event) => {
  const key = pageKey(event)
  if (!key) { return }
  touchStamp(event)   // a publication in Digipart drops the pages; never waited for
  warmPages(event)
  const page = getRequestHeader(event, 'x-sf-fresh') ? null : getPage(key)
  if (!page) { event.context.sfPageKey = key; return }   // drawn now, then kept (server/plugins/compress.ts)
  const old = !!page.old || Date.now() - page.at > pageFresh(event)
  if (old && !page.refreshing) {
    page.refreshing = true
    const headers: Record<string, string> = { 'x-sf-fresh': '1' }
    for (const name of ['host', 'x-forwarded-host', 'x-forwarded-proto', 'accept-language', 'cookie']) { const value = getRequestHeader(event, name); if (value) { headers[name] = value } }
    // not redrawn (gone, moved, site closed): the old copy must not be served again; a failing Digipart keeps it
    useNitroApp().localFetch(event.path, { headers }).then((answer) => { if (answer.status < 500) { dropPage(key, page) } }).catch(() => {}).finally(() => { page.refreshing = false })
  }
  const { body, encoding } = pageBody(page, String(getRequestHeader(event, 'accept-encoding') || ''))
  setResponseHeaders(event, { 'content-type': 'text/html;charset=utf-8', 'cache-control': !priceMark(event) ? 'public, max-age=0, s-maxage=60, stale-while-revalidate=600' : 'private, no-store', vary: 'Accept-Encoding, Cookie', 'x-sf-cache': old ? 'stale' : 'hit', ...(encoding ? { 'content-encoding': encoding } : {}) })
  return body
})
