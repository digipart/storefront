import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import type { H3Event } from 'h3'

// Reads api/storefront of Digipart for this site, on the SERVER only: the key of the front is sent from here and never reaches the browser. An answer is kept a few seconds in memory (CACHE_SECONDS),
// except a preview (never kept: it shows drafts). A 404 of Digipart (never published, no such page) is `null`; anything else is an error the page shows as "the site cannot be read".
const cache = new Map<string, { at: number, data: unknown }>()
const run = promisify(execFile)
// The stamp of the site (api/storefront/version.php): asked every few seconds; when it changes (the shop published or saved something) everything kept in memory is dropped, so a
// publication shows within seconds while the answers can be kept for minutes.
let stamp = '', stampAt = 0
async function watch(base: string, headers: Record<string, string>, idMarketPlace: string) {
  if (Date.now() - stampAt < 3000) { return }
  stampAt = Date.now()
  try {
    const now = String((await $fetch<any>(base + '/api/storefront/version.php', { query: { IdMarketPlace: idMarketPlace }, headers, timeout: 4000, retry: 0 }))?.Version || '')
    if (now && now !== stamp) { if (stamp) { cache.clear() } stamp = now }
  } catch { /* Digipart did not answer: what is in memory is kept its usual time */ }
}

export async function digipart<T = any>(event: H3Event, path: string, query: Record<string, string | number> = {}): Promise<T | null> {
  const config = useRuntimeConfig(event)
  const full: Record<string, string> = { IdMarketPlace: String(config.idMarketPlace) }
  for (const [name, value] of Object.entries(query)) { if (value !== '' && value !== undefined && value !== null) { full[name] = String(value) } }
  if (config.fixtures) {   // development: a JSON file per answer, e.g. site-fr.json, design-home-fr.json, page-contact-fr.json
    const name = [path.replace(/\.php$/, '') || 'site', full.Key || full.Slug || full.Placement || '', path === '' ? '' : (full.LanguageIsoCode || '')].filter(Boolean).join('-').replace(/[^a-z0-9_-]/gi, '')
    try { return JSON.parse(await readFile(join(config.fixtures, name + '.json'), 'utf8')) as T } catch { return null }
  }
  if (config.localApp) {   // development on the machine where Digipart is installed: its own code answers (dev/bridge.php), always the current state, no key
    try {
      const { stdout } = await run(String(config.localPhp || 'php'), [join(process.cwd(), 'dev', 'bridge.php'), String(config.localApp), path, JSON.stringify(full)], { timeout: 15000, maxBuffer: 20 * 1024 * 1024 })
      return JSON.parse(stdout) as T | null
    } catch (error: any) {
      console.error('[digipart] the local bridge failed for ' + (path || 'the site') + ': ' + String(error?.message || error).slice(0, 300))
      throw createError({ statusCode: 502, statusMessage: 'digipart', message: 'Digipart did not answer.' })
    }
  }
  if (!config.digipartUrl || !config.clientId || !config.clientSecret || !config.idMarketPlace) {
    throw createError({ statusCode: 503, statusMessage: 'setup', message: 'The site is not connected to Digipart yet: DIGIPART_URL, ID_MARKET_PLACE, CLIENT_ID and CLIENT_SECRET are needed in its environment.' })
  }
  const base = String(config.digipartUrl).replace(/\/+$/, ''), keys = { 'X-Client-Id': String(config.clientId), 'X-Client-Secret': String(config.clientSecret) }
  await watch(base, keys, String(config.idMarketPlace))
  const key = path + '?' + new URLSearchParams(full).toString()
  const hit = cache.get(key)
  if (hit && !full.PreviewToken && !full.IP && Date.now() - hit.at < Number(config.cacheSeconds) * 1000) { return hit.data as T }
  try {
    const data = await $fetch<T>(String(config.digipartUrl).replace(/\/+$/, '') + '/api/storefront/' + path, { query: full, headers: { 'X-Client-Id': String(config.clientId), 'X-Client-Secret': String(config.clientSecret) }, retry: 0, timeout: 8000 })
    if (!full.PreviewToken && !full.IP) { cache.set(key, { at: Date.now(), data }); if (cache.size > 500) { cache.delete(cache.keys().next().value as string) } }
    return data
  } catch (error: any) {
    const status = Number(error?.statusCode || error?.response?.status || 0)
    if (status === 404) { return null }
    console.error('[digipart] ' + path + ' answered ' + (status || 'nothing') + (status === 401 ? ': the key of the front is refused' : ''))   // never the key, never the body
    throw createError({ statusCode: 502, statusMessage: 'digipart', message: 'Digipart did not answer.' })
  }
}

/** The preview token of this visit (the address, else the cookie kept by server/middleware/preview.ts): Digipart checks it, and answers the published site when it is wrong or has ended. */
export function previewQuery(event: H3Event): Record<string, string | number> {
  const asked = getQuery(event).preview
  const token = typeof asked === 'string' && asked !== '' ? asked : (getCookie(event, 'sf_preview') || '')
  return token !== 'off' && /^[A-Za-z0-9_.-]{20,120}$/.test(token) ? { PreviewToken: token } : {}
}
