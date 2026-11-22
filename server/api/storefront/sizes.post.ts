// The weight of the pictures of a page, for the « Performance » panel of a preview (SfPreviewBar.vue): their server does not tell it to the browser of another site.
// A preview only; only the hosts of the shop's pictures (Digipart, its sub-domains, a storage of Amazon, the hosts named in MEDIA_HOSTS); a HEAD request, never the file itself.
const known = new Map<string, number>()

export default defineEventHandler(async (event) => {
  if (!getCookie(event, 'sf_preview') && getQuery(event).preview === undefined) { throw createError({ statusCode: 403, statusMessage: 'preview' }) }
  const config = useRuntimeConfig(event)
  const home = (() => { try { return new URL(String(config.digipartUrl || config.localUrl)).hostname } catch { return '' } })()
  const domain = home.split('.').slice(-2).join('.')
  const extra = String(process.env.MEDIA_HOSTS || '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean)
  const allowed = (host: string) => host === home || (domain.includes('.') && host.endsWith('.' + domain)) || /\.(cloudfront\.net|amazonaws\.com)$/.test(host) || extra.includes(host)
  const body = await readBody<{ Urls?: unknown }>(event).catch(() => null)
  const urls = (Array.isArray(body?.Urls) ? body!.Urls : []).map(String).filter(u => /^https?:\/\//.test(u)).slice(0, 40)
  const sizes: Record<string, number> = {}
  await Promise.all(urls.map(async (url) => {
    let host = ''
    try { host = new URL(url).hostname.toLowerCase() } catch { return }
    if (!allowed(host)) { return }
    if (known.has(url)) { sizes[url] = known.get(url)!; return }
    const answer = await $fetch.raw(url, { method: 'HEAD', timeout: 3000, retry: 0, ignoreResponseError: true }).catch(() => null)
    const bytes = Number(answer?.headers.get('content-length') || 0)
    if (bytes > 0) { sizes[url] = bytes; known.set(url, bytes); if (known.size > 2000) { known.delete(known.keys().next().value as string) } }
  }))
  return { Sizes: sizes }
})
