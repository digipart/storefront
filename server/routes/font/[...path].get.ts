// A font file of the theme (see fonts.css.get.ts): read once from the font host by this server, then kept in memory and cached for a year by the browser (the address changes with the file).
const cache = new Map<string, Uint8Array>()

export default defineEventHandler(async (event) => {
  const path = String(getRouterParam(event, 'path') || '')
  if (!/^s\/[a-z0-9]+\/v\d+\/[A-Za-z0-9_-]+\.woff2$/.test(path)) { throw createError({ statusCode: 404 }) }
  if (!cache.has(path)) {
    try {
      const file = await $fetch<ArrayBuffer>('https://fonts.gstatic.com/' + path, { responseType: 'arrayBuffer', retry: 0, timeout: 8000 })
      if (cache.size > 400) { cache.delete(cache.keys().next().value as string) }
      cache.set(path, new Uint8Array(file))
    } catch { throw createError({ statusCode: 404 }) }
  }
  setResponseHeader(event, 'Content-Type', 'font/woff2')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return cache.get(path)
})
