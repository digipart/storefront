import { brotliCompressSync, constants, gzipSync } from 'node:zlib'
import type { H3Event } from 'h3'

// The pages every visitor sees the same (home, categories, products, content pages) are kept in memory once drawn: the next visitor gets the page at once, without Digipart being asked.
// A page is served as it is for a short while (FRESH); after that it is still served at once while a new copy is drawn behind (up to STALE). A publication in Digipart drops every page
// (server/utils/digipart.ts watches the stamp of the site). Never kept: what belongs to one visitor (cart, order, account), a logged-in customer (a professional sees his own prices), a
// theme preview, an address with parameters, and anything while the site is not open to everyone.
interface Page { at: number, html: string, br?: Buffer, gzip?: Buffer, refreshing?: boolean }
const pages = new Map<string, Page>()
const STALE = 10 * 60 * 1000

export const pageFresh = (event: H3Event) => Math.max(5, Math.min(Number(useRuntimeConfig(event).cacheSeconds) || 60, 60)) * 1000
export function clearPages() { pages.clear() }

/** The key of the page of this request when it may be shared between visitors, else ''. */
export function pageKey(event: H3Event): string {
  if (event.method !== 'GET') { return '' }
  const [path, query] = event.path.split('?')
  if (query || !path || path.startsWith('/api/') || path.startsWith('/_nuxt/') || path.startsWith('/s/') || /\.[a-z0-9]{2,5}$/i.test(path)) { return '' }
  if (getCookie(event, 'sf_session') || getCookie(event, 'sf_preview')) { return '' }
  if (/\/(panier|cart|commande|checkout|compte|account|favoris|wishlist|reset|parrainage|referral|recherche|search)(\/|$)/.test(path)) { return '' }
  const host = String(getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host') || '').toLowerCase()
  return host ? host + path : ''
}

export function getPage(key: string): Page | null {
  const page = pages.get(key)
  if (!page) { return null }
  if (Date.now() - page.at > STALE) { pages.delete(key); return null }
  return page
}

export function keepPage(key: string, html: string) {
  pages.set(key, { at: Date.now(), html })
  if (pages.size > 3000) { for (const old of pages.keys()) { pages.delete(old); if (pages.size < 2500) { break } } }
}

/** The page in the encoding the browser takes, compressed once and kept. */
export function pageBody(page: Page, accepted: string): { body: Buffer | string, encoding: string } {
  if (/\bbr\b/.test(accepted)) {
    page.br = page.br || brotliCompressSync(Buffer.from(page.html, 'utf8'), { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } })   // kept, so it can be squeezed harder than a page drawn for one visitor
    return { body: page.br, encoding: 'br' }
  }
  if (/\bgzip\b/.test(accepted)) { page.gzip = page.gzip || gzipSync(Buffer.from(page.html, 'utf8'), { level: 9 }); return { body: page.gzip, encoding: 'gzip' } }
  return { body: page.html, encoding: '' }
}
