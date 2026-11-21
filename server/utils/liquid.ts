// The CODE SECTIONS of a theme (Digipart: class/Storefront/ThemeCode.php): a section the shop wrote itself in Liquid, with its own settings. A page names one by a section of type `code`
// (`Settings.File`, `Settings.Values`); its template and its schema are read from Digipart (api/storefront/code.php) and drawn HERE, on the server, before the page leaves:
//
// - liquidjs draws the template: every value is escaped (`outputEscape`), a template reads no file (include, render and layout are closed), and it is stopped when it is too long to read or to
//   draw (parseLimit, renderLimit, memoryLimit);
// - what comes out is cleaned as the « HTML personnalisé » section is cleaned in Digipart (CustomCode): the tags of a page of content only, no script, no frame, no form, no `on…` attribute,
//   links and pictures in https or inside the site;
// - the settings are read against the schema of the file: one that is missing or not of its kind takes its default.
//
// The objects follow the API of Digipart (UpperCamelCase): `Section.Id`, `Section.Settings.<Key>`, `Section.Blocks` (each Block has `Id`, `Type`, `Settings`), `Site.Name`, `Site.Url`, `Site.LanguageIsoCode`, and what the page is about, as the API gives
// it: `Product` (a product page), `Category` (a page of the catalogue), `Page` (a content page). Filters and tags are the ones of Liquid, in snake_case, plus `money`.
import { Liquid } from 'liquidjs'
import sanitizeHtml from 'sanitize-html'
import type { H3Event } from 'h3'

const closed = { parse () { throw new Error('this tag is not available in a code section: a section holds in its file') }, render () { return '' } }
const noFiles = { exists: async () => false, existsSync: () => false, readFile: async () => { throw new Error('no file') }, readFileSync: () => { throw new Error('no file') }, resolve: () => '', contains: async () => false, containsSync: () => false, sep: '/', dirname: () => '' }
const engine = new Liquid({ outputEscape: 'escape', ownPropertyOnly: true, strictFilters: true, strictVariables: false, parseLimit: 120000, renderLimit: 400, memoryLimit: 4e6, fs: noFiles as any, relativeReference: false, cache: false })
for (const tag of ['include', 'render', 'layout', 'block', 'schema']) { engine.registerTag(tag, closed as any) }
// {{ 49.9 | money }} => 49,90 € in the language of the page; {{ 49.9 | money: 'USD' }}
engine.registerFilter('money', function (this: any, value: unknown, currency?: unknown) {
  const amount = Number(value), iso = String(this?.context?.get(['Site', 'LanguageIsoCode']) || 'fr'), code = /^[A-Z]{3}$/.test(String(currency || '')) ? String(currency) : 'EUR'
  if (!Number.isFinite(amount)) { return '' }
  try { return new Intl.NumberFormat(iso, { style: 'currency', currency: code }).format(amount) } catch { return amount.toFixed(2) + ' ' + code }
})

const TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'small', 'mark', 'sub', 'sup', 'ul', 'ol', 'li', 'blockquote', 'span', 'div', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'main',
  'figure', 'figcaption', 'details', 'summary', 'a', 'img', 'picture', 'source', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'time', 'address', 'dl', 'dt', 'dd']
const ADDRESS = /^(https:\/\/[^\s"'<>]+|\/(?!\/)[^\s"'<>]*|#[^\s"'<>]*|mailto:[^\s"'<>]+|tel:[+0-9 ().-]+)$/i
/** What a code section drew, made safe for the page. */
export function cleanHtml (html: string): string {
  return sanitizeHtml(String(html).slice(0, 400000), {
    allowedTags: TAGS,
    allowedAttributes: { '*': ['class', 'id', 'style', 'title', 'lang', 'dir', 'hidden', 'role', 'aria-*', 'data-*'], a: ['href', 'target', 'rel'], img: ['src', 'srcset', 'sizes', 'alt', 'width', 'height', 'loading', 'decoding'],
      source: ['srcset', 'sizes', 'media', 'type'], th: ['colspan', 'rowspan', 'scope'], td: ['colspan', 'rowspan'], time: ['datetime'] },
    allowedSchemes: ['https', 'mailto', 'tel'], allowedSchemesAppliedToAttributes: ['href', 'src'], allowProtocolRelative: false, disallowedTagsMode: 'discard', enforceHtmlBoundary: false,
    transformTags: { '*': (tagName: string, attribs: Record<string, string>) => {
      const kept: Record<string, string> = {}
      for (const [name, value] of Object.entries(attribs)) {
        if (name === 'style' && /url\s*\(|expression|javascript|@import|behaviou?r|binding|\\|</i.test(value)) { continue }   // a style that could load or run something
        if ((name === 'href' || name === 'src') && !ADDRESS.test(value.trim())) { continue }
        if (name === 'srcset' && !value.split(',').every(part => ADDRESS.test(part.trim().split(/\s+/)[0] || ''))) { continue }
        kept[name] = value
      }
      if (tagName === 'a' && kept.target === '_blank') { kept.rel = 'noopener' }
      return { tagName, attribs: kept }
    } },
  })
}

/** The settings of a section read against the schema of its file: each of its kind, else its default. */
export function codeSettings (schema: any, given: any): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const setting of (Array.isArray(schema?.Settings) ? schema.Settings : []).slice(0, 30)) {
    const key = String(setting?.Key || ''), type = String(setting?.Type || '')
    if (!/^[A-Z][A-Za-z0-9]{0,39}$/.test(key)) { continue }
    const has = given && typeof given === 'object' && Object.prototype.hasOwnProperty.call(given, key), value = has ? given[key] : setting.Default, fallback = setting.Default
    if (type === 'toggle') { values[key] = value === true || value === 1 || value === '1' }
    else if (type === 'range') { const n = Number(value); values[key] = Number.isFinite(n) ? Math.max(Number(setting.Min) || 0, Math.min(Number(setting.Max) || 0, n)) : Number(fallback) || 0 }
    else if (type === 'category' || type === 'page') { values[key] = Math.max(0, Math.floor(Number(value) || 0)) }
    else if (type === 'select') { values[key] = setting.Options && Object.prototype.hasOwnProperty.call(setting.Options, String(value)) ? String(value) : String(fallback ?? '') }
    else if (type === 'color') { values[key] = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value)) ? String(value) : String(fallback || '#000000') }
    else if (type === 'url') { values[key] = /^(https?:\/\/|\/(?!\/)|#)[^\s"'<>]*$/i.test(String(value || '')) ? String(value).slice(0, 500) : '' }
    else if (type === 'image') { values[key] = /^(https:\/\/[^\s"'<>]+|\/(?!\/)[^\s"'<>]*)$/i.test(String(value || '')) ? String(value).slice(0, 500) : '' }
    else { values[key] = typeof value === 'string' ? value.slice(0, 5000) : (typeof value === 'number' ? String(value) : '') }
  }
  return values
}

/** Draws one template with its objects. `Error` says what went wrong (shown in a preview only). */
export async function drawCode (template: string, objects: Record<string, unknown>): Promise<{ Html: string, Error: string }> {
  try { return { Html: cleanHtml(await engine.parseAndRender(String(template || ''), objects)), Error: '' } }
  catch (error: any) { return { Html: '', Error: String(error?.message || error).replace(/\s+/g, ' ').slice(0, 300) } }
}

/**
 * A design with its code sections drawn: each section of type `code` receives `Html` (what its file draws for this page). In a preview, a section that could not be drawn says why (`Error`).
 * `objects`: what the page is about (Product, Category, Page), as the API gives it.
 */
export async function withCode<T extends { Sections?: any[] } | null | undefined> (event: H3Event, design: T, objects: Record<string, unknown> = {}): Promise<T> {
  const sections = design && Array.isArray(design.Sections) ? design.Sections : []
  if (!sections.some((section: any) => section?.Type === 'code')) { return design }
  const preview = previewQuery(event), lang = langOf(event)
  const site = await digipart<any>(event, '', { ...preview, LanguageIsoCode: lang.lang }).catch(() => null)
  const Site = { Name: String(site?.Name || ''), Url: siteOrigin(event) + (lang.prefix || '') + '/', LanguageIsoCode: lang.lang, Currency: 'EUR' }
  const drawn = await Promise.all(sections.map(async (section: any) => {
    if (section?.Type !== 'code') { return section }
    const file = String(section.Settings?.File || '')
    const code = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(file) ? await digipart<any>(event, 'code.php', { ...preview, Key: 'section.' + file }).catch(() => null) : null
    if (!code || typeof code.Template !== 'string') { return { ...section, Html: '', Error: Object.keys(preview).length ? 'This theme has no code section named « ' + file + ' » (or it is not published yet).' : '' } }
    // the texts written in the language of the page come over the ones of the main language (`Translations`, by language; the API writes the language name with a capital)
    const all = section.Settings?.Translations && typeof section.Settings.Translations === 'object' ? section.Settings.Translations : {}
    const own = Object.entries(all).find(([iso]) => iso.toLowerCase() === lang.lang)?.[1] as Record<string, unknown> | undefined
    const texts = Object.fromEntries(Object.entries(own && typeof own === 'object' ? own : {}).filter(([key, value]) => typeof value === 'string' && value !== '' && (code.Schema?.Settings || []).some((setting: any) => setting?.Key === key && (setting.Type === 'text' || setting.Type === 'textarea'))))
    const Settings = codeSettings(code.Schema, { ...(section.Settings?.Values || {}), ...texts })
    // the blocks of the section (repeated pieces the shop adds in the builder): each read against the settings of its kind; one whose kind the file no longer has is left out
    const kinds: any[] = Array.isArray(code.Schema?.Blocks) ? code.Schema.Blocks : []
    const translated = (item: any, schema: any) => {
      const mine = Object.entries(item?.Translations && typeof item.Translations === 'object' ? item.Translations : {}).find(([iso]) => iso.toLowerCase() === lang.lang)?.[1] as Record<string, unknown> | undefined
      return Object.fromEntries(Object.entries(mine && typeof mine === 'object' ? mine : {}).filter(([key, value]) => typeof value === 'string' && value !== '' && (schema?.Settings || []).some((setting: any) => setting?.Key === key && (setting.Type === 'text' || setting.Type === 'textarea'))))
    }
    const Blocks = (Array.isArray(section.Settings?.Items) ? section.Settings.Items : []).slice(0, Math.max(0, Math.min(30, Number(code.Schema?.MaxBlocks) || 0))).map((item: any) => {
      const kind = kinds.find(one => one?.Type === item?.Type)
      return kind ? { Id: String(item.Id || ''), Type: String(kind.Type), Settings: codeSettings(kind, { ...(item.Values || {}), ...translated(item, kind) }) } : null
    }).filter(Boolean)
    const out = await drawCode(code.Template, { ...objects, Site, Section: { Id: String(section.Id || ''), File: file, Settings, Blocks } })
    return { ...section, Html: out.Html, Error: Object.keys(preview).length ? out.Error : '' }
  }))
  return { ...design, Sections: drawn } as T
}
