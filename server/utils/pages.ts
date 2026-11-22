import { brotliCompressSync, brotliDecompressSync, constants, gzipSync } from 'node:zlib'
import type { H3Event } from 'h3'

// The pages every visitor sees the same (home, categories, products, content pages) are kept in memory once drawn: the next visitor gets the page at once, without Digipart being asked.
// A page is served as it is for a short while (FRESH); after that it is still served at once while a new copy is drawn behind (up to STALE). A publication in Digipart drops every page; a product change
// only marks them old: they are served once more and redrawn behind (server/utils/digipart.ts). Never kept: what belongs to one visitor (cart, order, account), a logged-in customer (a professional sees his own prices), a
// theme preview, an address with parameters, and anything while the site is not open to everyone.
// kept compressed only: a page weighs about 10 KB in memory
interface Page { at: number, br: Buffer, gzip?: Buffer, old?: boolean, refreshing?: boolean }
const pages = new Map<string, Page>()
const STALE = 24 * 60 * 60 * 1000
const MOST = 5000
let cleared = 1   // counts the full drops: the warm-up starts again after each (server/utils/warm.ts)

export const pageFresh = (event: H3Event) => Math.max(5, Math.min(Number(useRuntimeConfig(event).cacheSeconds) || 60, 60)) * 1000
export const pagesCleared = () => cleared
export function clearPages() { pages.clear(); cleared++ }
export function agePages() { for (const page of pages.values()) { page.old = true } }
/** Drops the page unless it was redrawn since (`page` is the copy that was served). */
export function dropPage(key: string, page: Page) { if (pages.get(key) === page) { pages.delete(key) } }

export const personalPath = (path: string) => /\/(panier|cart|commande|checkout|compte|account|favoris|wishlist|reset|parrainage|referral|recherche|search)(\/|$)/.test(path)

/** The key of the page of this request when it may be shared between visitors, else ''. */
export function pageKey(event: H3Event): string {
  if (event.method !== 'GET') { return '' }
  const [path, query] = event.path.split('?')
  if (query || !path || path.startsWith('/api/') || path.startsWith('/_nuxt/') || path.startsWith('/s/') || /\.[a-z0-9]{2,5}$/i.test(path)) { return '' }
  if (getCookie(event, 'sf_session') || getCookie(event, 'sf_preview')) { return '' }
  if (personalPath(path)) { return '' }
  const host = String(getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host') || '').toLowerCase()
  // a page carries prices: one copy per currency
  return host ? host + path + priceMark(event) : ''
}

export function getPage(key: string): Page | null {
  const page = pages.get(key)
  if (!page) { return null }
  if (Date.now() - page.at > STALE) { pages.delete(key); return null }
  return page
}

export function keepPage(key: string, html: string) {
  pages.delete(key)   // re-inserted last: the oldest keys go first
  pages.set(key, { at: Date.now(), br: brotliCompressSync(Buffer.from(html, 'utf8'), { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }) })
  if (pages.size > MOST) { for (const old of pages.keys()) { pages.delete(old); if (pages.size < MOST * 0.9) { break } } }
}

/** The page in the encoding the browser takes. */
export function pageBody(page: Page, accepted: string): { body: Buffer | string, encoding: string } {
  if (/\bbr\b/.test(accepted)) { return { body: page.br, encoding: 'br' } }
  const html = brotliDecompressSync(page.br)
  if (/\bgzip\b/.test(accepted)) { page.gzip = page.gzip || gzipSync(html, { level: 9 }); return { body: page.gzip, encoding: 'gzip' } }
  return { body: html.toString('utf8'), encoding: '' }
}
