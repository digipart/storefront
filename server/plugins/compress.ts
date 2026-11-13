import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

// The HTML of a page is sent compressed (Brotli, else gzip) when the browser takes it: a page of 30 KB travels as 6. The scripts and the styles are already compressed when the site is built
// (nuxt.config.ts: compressPublicAssets); a server in front of the site that compresses too simply finds nothing left to do.
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('render:response', async (response, { event }) => {
    const body = response.body
    // a page every visitor sees the same is kept for the next ones (server/utils/pages.ts): only a real page (200), and only while the site is open to everyone
    if (event.context.sfPageKey && typeof body === 'string' && (response.statusCode || 200) === 200 && /text\/html/.test(String(response.headers?.['content-type'] || 'text/html'))) {
      const site = await digipart(event, '').catch(() => null)
      if (site && site.State === 'online' && site.Status?.IsLive !== false && !site.Preview) { keepPage(String(event.context.sfPageKey), body) }
    }
    if (typeof body !== 'string' || body.length < 1024 || response.headers?.['content-encoding']) { return }
    const accepted = String(getRequestHeader(event, 'accept-encoding') || '')
    const type = /\bbr\b/.test(accepted) ? 'br' : /\bgzip\b/.test(accepted) ? 'gzip' : ''
    if (!type) { return }
    const raw = Buffer.from(body, 'utf8')
    response.body = (type === 'br' ? brotliCompressSync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 5, [constants.BROTLI_PARAM_SIZE_HINT]: raw.length } }) : gzipSync(raw, { level: 6 })) as any
    response.headers = { ...response.headers, 'content-encoding': type, vary: [response.headers?.vary, 'Accept-Encoding'].filter(Boolean).join(', ') }
  })
})
