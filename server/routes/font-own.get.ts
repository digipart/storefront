// A font file of the shop itself (Digipart: the settings of the theme, « Vos polices »), served by this site: read once from the storage of the shop, kept in memory and cached for a year by the
// browser (its address holds a hash of the file). Only a file the theme of this site names is read: this is not a way to fetch any address.
import { OWN_FONT, knownOwnFonts, ownFonts } from '../utils/fonts'

const cache = new Map<string, Uint8Array>()

export default defineEventHandler(async (event) => {
  const url = String(getQuery(event).u ?? '')
  if (!OWN_FONT.test(url) || url.includes('..')) { throw createError({ statusCode: 404 }) }
  if (!cache.has(url)) {
    if (!knownOwnFonts.has(url)) {   // not seen since the server started: is it a font of the theme online?
      const site = await digipart<any>(event, '', previewQuery(event)).catch(() => null)
      if (!ownFonts((site?.Theme?.Fonts || []).filter((font: any) => Array.isArray(font?.Files))).urls.includes(url)) { throw createError({ statusCode: 404 }) }
    }
    try {
      const file = new Uint8Array(await $fetch<ArrayBuffer>(url, { responseType: 'arrayBuffer', retry: 0, timeout: 8000 }))
      if (file.length > 1048576 || String.fromCharCode(file[0]!, file[1]!, file[2]!, file[3]!) !== 'wOF2') { throw new Error('not a font') }
      if (cache.size > 40) { cache.delete(cache.keys().next().value as string) }
      cache.set(url, file)
    } catch { throw createError({ statusCode: 404 }) }
  }
  setResponseHeader(event, 'Content-Type', 'font/woff2')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return cache.get(url)
})
