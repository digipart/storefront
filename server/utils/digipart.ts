import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import type { H3Event } from 'h3'

// Reads api/storefront of Digipart for this site, on the SERVER only: the key of the front is sent from here and never reaches the browser. An answer is kept a few seconds in memory (CACHE_SECONDS),
// and a preview two seconds only (it shows drafts). A 404 of Digipart (never published, no such page) is `null`; anything else is an error the page shows as "the site cannot be read".
const cache = new Map<string, { at: number, data: unknown }>()
const run = promisify(execFile)
// The stamp of the site (api/storefront/version.php): asked every few seconds; when it changes (the shop published or saved something) everything kept in memory is dropped, so a
// publication shows within seconds while the answers can be kept for minutes.
let stamp = '', stampAt = 0
async function watch(read: () => Promise<any>) {
  if (Date.now() - stampAt < 3000) { return }
  stampAt = Date.now()
  try {
    const now = String((await read())?.Version || '')
    if (now && now !== stamp) { if (stamp) { cache.clear(); clearPages() } stamp = now }
  } catch { /* Digipart did not answer: what is in memory is kept its usual time */ }
}
// the same question asked several times at once (a page asks for the site in several places while it is drawn) is asked to Digipart once
const asking = new Map<string, Promise<unknown>>()

/** Looks whether the shop published something (at most every few seconds), without making the request wait: the pages kept in memory are dropped when it did (server/utils/pages.ts). */
export function touchStamp(event: H3Event) {
  const config = useRuntimeConfig(event)
  if (config.fixtures || Date.now() - stampAt < 3000) { return }
  const id = String(config.idMarketPlace)
  if (config.localApp) {
    watch(async () => JSON.parse((await run(String(config.localPhp || 'php'), [join(process.cwd(), 'dev', 'bridge.php'), String(config.localApp), 'version.php', JSON.stringify({ IdMarketPlace: id })], { timeout: 15000 })).stdout)).catch(() => {})
  } else if (config.digipartUrl && config.clientId && config.clientSecret) {
    const base = String(config.digipartUrl).replace(/\/+$/, '')
    watch(() => $fetch<any>(base + '/api/storefront/version.php', { query: { IdMarketPlace: id }, headers: { 'X-Client-Id': String(config.clientId), 'X-Client-Secret': String(config.clientSecret) }, timeout: 4000, retry: 0 })).catch(() => {})
  }
}

export async function digipart<T = any>(event: H3Event, path: string, query: Record<string, string | number> = {}): Promise<T | null> {
  const config = useRuntimeConfig(event)
  const full: Record<string, string> = { IdMarketPlace: String(config.idMarketPlace) }
  for (const [name, value] of Object.entries(query)) { if (value !== '' && value !== undefined && value !== null) { full[name] = String(value) } }
  if (config.fixtures) {   // development: a JSON file per answer, e.g. site-fr.json, design-home-fr.json, page-contact-fr.json
    const name = [path.replace(/\.php$/, '') || 'site', full.Key || full.Slug || full.Placement || '', path === '' ? '' : (full.LanguageIsoCode || '')].filter(Boolean).join('-').replace(/[^a-z0-9_-]/gi, '')
    try { return JSON.parse(await readFile(join(config.fixtures, name + '.json'), 'utf8')) as T } catch { return null }
  }
  // development on the machine where Digipart is installed: its own code answers (dev/bridge.php), no key. Each answer costs a PHP start, so it is kept like any other, for a shorter time.
  const local = !!config.localApp
  const bridge = async (what: string, fields: Record<string, string>) => {
    const { stdout } = await run(String(config.localPhp || 'php'), [join(process.cwd(), 'dev', 'bridge.php'), String(config.localApp), what, JSON.stringify(fields)], { timeout: 15000, maxBuffer: 20 * 1024 * 1024 })
    return JSON.parse(stdout)
  }
  if (!local && (!config.digipartUrl || !config.clientId || !config.clientSecret || !config.idMarketPlace)) {
    throw createError({ statusCode: 503, statusMessage: 'setup', message: 'The site is not connected to Digipart yet: DIGIPART_URL, ID_MARKET_PLACE, CLIENT_ID and CLIENT_SECRET are needed in its environment.' })
  }
  const base = String(config.digipartUrl).replace(/\/+$/, ''), keys = { 'X-Client-Id': String(config.clientId), 'X-Client-Secret': String(config.clientSecret) }
  if (path === 'stripe-notify.php' || path === 'paypal-notify.php') { return local ? await bridge(path, full).catch(() => null) as T | null : null }   // a local action, never kept (server/utils/pay.ts)
  await watch(local ? () => bridge('version.php', { IdMarketPlace: full.IdMarketPlace }) : () => $fetch<any>(base + '/api/storefront/version.php', { query: { IdMarketPlace: full.IdMarketPlace }, headers: keys, timeout: 4000, retry: 0 }))
  const key = path + '?' + new URLSearchParams(full).toString()
  // a preview (it shows drafts) and an answer that depends on the visitor's address are kept two seconds: long enough for the page being drawn, never for the next change
  const life = full.PreviewToken || full.IP ? 2000 : Math.min(Number(config.cacheSeconds), local ? 30 : Infinity) * 1000
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < life) { return hit.data as T }
  const running = asking.get(key)
  if (running) { return running as Promise<T | null> }
  const ask = (async (): Promise<T | null> => {
    try {
      const data = local ? await bridge(path, full) as T | null : await $fetch<T>(base + '/api/storefront/' + path, { query: full, headers: keys, retry: 0, timeout: 8000 })
      cache.set(key, { at: Date.now(), data })
      if (cache.size > 500) { cache.delete(cache.keys().next().value as string) }
      return data
    } catch (error: any) {
      if (local) {
        console.error('[digipart] the local bridge failed for ' + (path || 'the site') + ': ' + String(error?.message || error).slice(0, 300))
        throw createError({ statusCode: 502, statusMessage: 'digipart', message: 'Digipart did not answer.' })
      }
      const status = Number(error?.statusCode || error?.response?.status || 0)
      if (status === 404) { return null }
      console.error('[digipart] ' + path + ' answered ' + (status || 'nothing') + (status === 401 ? ': the key of the front is refused' : ''))   // never the key, never the body
      throw createError({ statusCode: 502, statusMessage: 'digipart', message: 'Digipart did not answer.' })
    } finally { asking.delete(key) }
  })()
  asking.set(key, ask)
  return ask
}

/** The preview token of this visit (the address, else the cookie kept by server/middleware/preview.ts): Digipart checks it, and answers the published site when it is wrong or has ended. */
export function previewQuery(event: H3Event): Record<string, string | number> {
  const asked = getQuery(event).preview
  const token = typeof asked === 'string' && asked !== '' ? asked : (getCookie(event, 'sf_preview') || '')
  return token !== 'off' && /^[A-Za-z0-9_.-]{20,120}$/.test(token) ? { PreviewToken: token } : {}
}
