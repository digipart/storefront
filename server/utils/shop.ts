import type { H3Event } from 'h3'

// The public shop APIs of Digipart (api/product, api/category: the ones every front of Digipart reads; untouched), asked from the SERVER for the sales channel of this site, with a short memory cache.
// An answer that cannot be read is `null`: a section is then drawn without its products, never an error page.
const cache = new Map<string, { at: number, data: unknown }>()

/** Forgets what was kept of these products (their answers, and every list of a category: a listing carries prices and stock); `all`: everything. */
export function forgetProducts(ids: number[], all: boolean) {
  if (all) { cache.clear(); return }
  for (const key of [...cache.keys()]) {
    if (key.startsWith('category/') || ids.some(id => key.startsWith('product/' + id + '?') || key.includes('IdProduct=' + id + '&') || key.endsWith('IdProduct=' + id))) { cache.delete(key) }
  }
}

export async function shopApi<T = any>(event: H3Event, path: string, query: Record<string, string | number> = {}, keepSeconds?: number): Promise<T | null> {   // keepSeconds: a shorter memory (the live stock)
  const config = useRuntimeConfig(event)
  const base = String(config.digipartUrl || config.localUrl).replace(/\/+$/, '')
  if (!base) { return null }
  const full: Record<string, string> = { IdMarketPlace: String(config.idMarketPlace) }
  for (const [name, value] of Object.entries(query)) { if (value !== '' && value !== undefined && value !== null) { full[name] = String(value) } }
  const key = path + '?' + new URLSearchParams(full).toString()
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < (keepSeconds ?? Number(config.cacheSeconds)) * 1000) { return hit.data as T }
  try {
    const raw = await $fetch<string>(base + '/api/' + path, { query: full, responseType: 'text', retry: 0, timeout: 10000 })
    const start = raw.search(/[[{]/)   // a development server may print a notice before its JSON
    const data = start >= 0 ? JSON.parse(raw.slice(start)) : null
    if (cache.size > 2000) { cache.delete(cache.keys().next().value as string) }
    cache.set(key, { at: Date.now(), data })
    return data as T
  } catch { return null }
}

export interface ShopVariant { Id: number, Label: string, Size: string, Color: string, Attributes: { Group: string, Name: string }[], Available: boolean, Quantity: number }
export interface ShopProduct {
  Id: number, IdCategory: number, Name: string, Reference: string, Brand: string, Slug: string, Url: string, Canonical: string, Alternates: Record<string, string>, Images: string[], ImageSets: string[], Currency: string, Price: number, PriceOld: number, Discount: number, PriceTaxExcl: number, PriceOldTaxExcl: number, TaxExcl: boolean, PriceState: 'ok' | 'login' | 'pending' | 'business',
  Description: string, DescriptionShort: string, SeoTitle: string, SeoDescription: string, Variants: ShopVariant[], Available: boolean, LookUrl?: string,
}

/** A product of the product API as the theme draws it: one flat shape, whatever the API left empty. `prefix` = the language part of the addresses of the page ('' or '/en'). */
export function shapeProduct(raw: any, lang: string, prefix: string): ShopProduct | null {
  const name = String(raw?.Description?.Title || '').trim()
  const id = Number(raw?.IdProduct || 0)
  if (!raw || !id || !name) { return null }
  const seo = (Array.isArray(raw.SEO) ? raw.SEO : []).find((s: any) => String(s.LanguageIsoCode || '').toLowerCase() === lang) || (Array.isArray(raw.SEO) ? raw.SEO[0] : null) || {}
  const categorySeo = raw.Category?.Main?.SEO
  const categorySlug = String((Array.isArray(categorySeo) ? (categorySeo.find((s: any) => String(s.LanguageIsoCode || '').toLowerCase() === lang) || categorySeo[0])?.URL : '') || '').replace(/^\/+|\/+$/g, '')
  const sets = raw.Media?.Images && typeof raw.Media.Images === 'object' ? raw.Media.Images : {}
  const set = sets.product_large || sets.product_medium || (Object.values(sets)[0] as any[]) || []
  const images = (Array.isArray(set) ? set : []).map((image: any) => String(image?.Src || '')).filter((src: string) => /^https?:\/\//.test(src))
  // the same picture in the sizes Digipart made of it: the browser takes the one that fits the place and the screen (`srcset`)
  const sizes = ['product_small', 'product_medium', 'product_large', 'product_xlarge'].map(name => (Array.isArray(sets[name]) ? sets[name] : []))
  const imageSets = images.map((_: string, index: number) => sizes.map(list => list[index]).filter((image: any) => image && /^https?:\/\//.test(String(image.Src || '')) && Number(image.Width) > 0)
    // the very large file (3000 px, about a megabyte) is left to the zoom: on the page a picture never needs more than the 1500 px one, even on a large high-density screen
    .filter((image: any, _at: number, all: any[]) => Number(image.Width) <= 2000 || !all.some((other: any) => Number(other.Width) >= 1200 && Number(other.Width) <= 2000))
    .map((image: any) => String(image.Src).replace(/ /g, '%20') + ' ' + Number(image.Width) + 'w').join(', '))
  // its address in each language of its description (for the search engines): <category address>/<product address>, without the language
  const alternates: Record<string, string> = {}
  for (const row of (Array.isArray(raw.SEO) ? raw.SEO : [])) {
    const iso = String(row?.LanguageIsoCode || '').toLowerCase(), own = String(row?.URL || '').replace(/^\/+|\/+$/g, '')
    const category = String((Array.isArray(categorySeo) ? categorySeo.find((s: any) => String(s.LanguageIsoCode || '').toLowerCase() === iso)?.URL : '') || '').replace(/^\/+|\/+$/g, '')
    if (/^[a-z]{2,3}$/.test(iso) && own && category) { alternates[iso] = category + '/' + own }
  }
  const regular = Number(raw.Price?.RegularPrice?.PriceTaxIncl || 0)
  const promo = Number(raw.Price?.PromotionalPrice?.PriceTaxIncl || 0)
  const onSale = promo > 0 && regular > 0 && promo < regular
  const regularExcl = Number(raw.Price?.RegularPrice?.PriceTaxExcl || 0), promoExcl = Number(raw.Price?.PromotionalPrice?.PriceTaxExcl || 0)
  const slug = String(seo.URL || '').replace(/^\/+|\/+$/g, '') || 'produit'
  const variants: ShopVariant[] = (Array.isArray(raw.Variant) ? raw.Variant : []).map((variant: any) => {
    const attributes = Array.isArray(variant?.Combination?.Attributes) ? variant.Combination.Attributes : []
    const of = (group: RegExp) => String((attributes.find((a: any) => group.test(String(a.GroupName || ''))) || {}).AttributeName || '')
    const size = of(/size|taille/i), color = of(/colou?r|couleur/i)
    return { Id: Number(variant?.Combination?.IdProductAttribute || 0), Label: attributes.map((a: any) => String(a.AttributeName || '')).filter(Boolean).join(' / '), Size: size, Color: color, Attributes: attributes.map((a: any) => ({ Group: String(a.GroupName || ''), Name: String(a.AttributeName || '') })).filter((a: any) => a.Name), Available: !!variant.Available, Quantity: Number(variant.Quantity || 0) }
  }).filter((variant: ShopVariant) => variant.Id > 0)
  return {
    Canonical: categorySlug && seo.URL ? categorySlug + '/' + String(seo.URL).replace(/^\/+|\/+$/g, '') : '', Alternates: alternates, ImageSets: imageSets,
    Id: id, IdCategory: Number(raw.Category?.Main?.IdCategory || 0), Name: name, Reference: String(raw.Reference || ''), Brand: String(raw.Brand?.Name || raw.Brand?.BrandName || ''), Slug: slug, Url: prefix + '/' + (categorySlug || 'p') + '/' + slug + '-' + id, Images: images,
    Currency: String(raw.Price?.Currency?.CurrencyIsoCode || 'EUR'), Price: onSale ? promo : regular, PriceOld: onSale ? regular : 0, Discount: onSale ? Math.round(100 - (promo * 100) / regular) : 0, PriceTaxExcl: onSale ? promoExcl : regularExcl, PriceOldTaxExcl: onSale ? regularExcl : 0, TaxExcl: false, PriceState: 'ok',
    Description: String(raw.Description?.Description || ''), DescriptionShort: String(raw.Description?.DescriptionShort || ''), SeoTitle: String(seo.MetaTitle || name), SeoDescription: String(seo.MetaDescription || ''),
    Variants: variants, Available: variants.length ? variants.some(variant => variant.Available) : raw.Active === 1,
  }
}

/** What the product API leaves empty when it cannot call its own sub-endpoints (a development server): the price and the pictures are asked apart. In production the product comes whole and nothing more is asked. */
async function complete(event: H3Event, raw: any, currency: string, priceBase: string): Promise<any> {
  if (!raw || !raw.IdProduct) { return raw }
  const [price, media] = await Promise.all([
    raw.Price ? null : shopApi(event, 'product/price', { IdProduct: raw.IdProduct, CurrencyIsoCode: currency, PriceBaseType: priceBase || 'retail' }),
    raw.Media?.Images ? null : shopApi(event, 'product/media', { IdProduct: raw.IdProduct }),
  ])
  return { ...raw, Price: raw.Price || (price && (price as any).RegularPrice ? price : null), Media: raw.Media?.Images ? raw.Media : (media || raw.Media) }
}

/**
 * How prices are shown to this visitor. On a professional site (a channel in wholesale prices) the prices are without tax, and only a professional customer whose account the shop activated
 * sees them: anyone else gets no price at all from this server (never a price hidden by the page). `state`: ok | login (not logged in) | business (a private customer's account) | pending
 * (a professional account not activated yet). Worked out once per request.
 */
export async function pricing(event: H3Event): Promise<{ wholesale: boolean, state: 'ok' | 'login' | 'pending' | 'business' }> {
  if (event.context.sfPricing) { return event.context.sfPricing }
  const config = useRuntimeConfig(event)
  const site = await digipart(event, '', {}).catch(() => null)
  const wholesale = !!config.forcePro || site?.PriceBaseType === 'wholesale'
  let state: 'ok' | 'login' | 'pending' | 'business' = 'ok'
  if (wholesale) {
    const who = await profile(event)
    state = !who || who.Guest ? 'login' : !who.Business ? 'business' : !who.Active ? 'pending' : 'ok'
  }
  event.context.sfPricing = { wholesale, state }
  return event.context.sfPricing
}

/** A product as this visitor may see it: prices without tax on a professional site, and no price for who may not see them. */
export function priced<T extends ShopProduct | null>(product: T, policy: { wholesale: boolean, state: 'ok' | 'login' | 'pending' | 'business' }): T {
  if (!product || !policy.wholesale) { return product }
  if (policy.state !== 'ok') { return { ...product, Price: 0, PriceOld: 0, PriceTaxExcl: 0, PriceOldTaxExcl: 0, Discount: 0, TaxExcl: true, PriceState: policy.state } }
  return { ...product, Price: product.PriceTaxExcl, PriceOld: product.PriceOldTaxExcl, TaxExcl: true }
}

/** The products that have a look (« Shop the look »: products associated with them in Digipart): their card and their page lead to it. Asked once and kept like every answer of Digipart. */
async function withLook<T extends ShopProduct | null>(event: H3Event, product: T, prefix: string): Promise<T> {
  if (!product) { return product }
  const ids: number[] = ((await digipart(event, 'looks.php', {}).catch(() => null))?.ProductIds as number[]) || []
  return ids.includes(product.Id) ? { ...product, LookUrl: prefix + '/shop-the-look/' + product.Slug + '-' + product.Id } : product
}

export async function loadProduct(event: H3Event, id: number, lang: string, prefix: string, currency = 'EUR', priceBase = 'retail'): Promise<ShopProduct | null> {
  const policy = await pricing(event)
  if (policy.wholesale) { priceBase = 'wholesale' }
  const raw = await shopApi(event, 'product/' + id, { LanguageIsoCode: lang.toUpperCase(), CurrencyIsoCode: currency, Track: 0 })
  if (!raw || raw.status === 'error') { return null }
  return withLook(event, priced(shapeProduct(await complete(event, raw, currency, priceBase), lang, prefix), policy), prefix)
}

export async function shapeListed(event: H3Event, products: any[], lang: string, prefix: string, currency = 'EUR', priceBase = 'retail'): Promise<ShopProduct[]> {
  const policy = await pricing(event)
  if (policy.wholesale) { priceBase = 'wholesale' }
  const shaped = await Promise.all((Array.isArray(products) ? products : []).map(async raw => priced(shapeProduct(policy.wholesale && raw ? await complete(event, { ...raw, Price: null }, currency, priceBase) : await complete(event, raw, currency, priceBase), lang, prefix), policy)))
  return (await Promise.all(shaped.map(product => withLook(event, product, prefix)))).filter((product): product is ShopProduct => product !== null)
}

/** The language of a request (two or three letters) and the language part of its addresses, as the page gave them. */
export function langOf(event: H3Event): { lang: string, prefix: string } {
  const query = getQuery(event)
  const lang = /^[a-z]{2,3}$/i.test(String(query.lang ?? '')) ? String(query.lang).toLowerCase() : 'fr'
  const prefix = /^\/[a-z]{2,3}$/.test(String(query.prefix ?? '')) ? String(query.prefix) : ''
  return { lang, prefix }
}
