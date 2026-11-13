import type { H3Event } from 'h3'

// The public address of the site as the visitor (or the search engine) wrote it, and the language part of an address: the main language has none, unless the shop asked for one always.
export function siteOrigin(event: H3Event): string {
  const host = getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host') || 'localhost'
  return getRequestProtocol(event, { xForwardedProto: true }) + '://' + host
}

export function languagePrefix(site: any, iso: string): string {
  return iso !== site?.DefaultLanguageIsoCode || site?.UrlPrefix === 'always' ? '/' + iso : ''
}

export const xml = (value: string) => value.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' } as Record<string, string>)[c])
