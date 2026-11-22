import type { H3Event } from 'h3'

// Where the visitor shops from. Countries, zones, taxes and currencies are Digipart's (api/storefront/countries.php); a cookie is only a wish, checked against them at each request
// (server/middleware/0.currency.ts).
const COOKIE = 'sf_country', MONEY = 'sf_currency'
export const SHOP_CURRENCY = 'EUR'   // what a visitor who chose nothing sees
// not offered: no two decimals (amounts are sent in cents), or a rate that takes usual prices over 1 000 (API finding A266)
const NOT_CENTS = 'BIF CLP DJF GNF JPY KMF KRW MGA PYG RWF UGX VND VUV XAF XOF XPF ISK HUF TWD BHD JOD KWD OMR TND'.split(' ')
const MOST_RATE = 3

interface Money { IsoCode: string, Name: string, Sign: string, Rate: number, Main: boolean }
interface Place { IsoCode: string, TaxRate: number, Currencies: Money[] }
export interface Region { IsoCode: string, Name: string, Language: string, Currencies: Money[] }

async function places(event: H3Event): Promise<{ main: number | null, list: Place[] }> {
  if (event.context.sfPlaces) { return event.context.sfPlaces }
  const answer = await digipart<any>(event, 'countries.php', {}).catch(() => null)
  const list = (Array.isArray(answer?.Countries) ? answer.Countries : []).map((c: any) => {
    const money = (Array.isArray(c.Currencies) ? c.Currencies : [])
      .map((m: any) => ({ IsoCode: String(m.CurrencyIsoCode || ''), Name: String(m.CurrencyName || ''), Sign: String(m.CurrencySign || ''), Rate: Number(m.CurrencyConversionRate) || 0, Main: m.IsMainCurrency === true }))
      .filter((m: Money) => m.IsoCode === SHOP_CURRENCY || (/^[A-Z]{3}$/.test(m.IsoCode) && !NOT_CENTS.includes(m.IsoCode) && m.Rate > 0 && m.Rate <= MOST_RATE))
    return { IsoCode: String(c.CountryIsoCode || ''), TaxRate: Number(c.TaxRate) || 0, Currencies: money.length ? money : [{ IsoCode: SHOP_CURRENCY, Name: 'Euro', Sign: '€', Rate: 1, Main: true }] }
  })
  event.context.sfPlaces = { main: typeof answer?.MainTaxRate === 'number' ? answer.MainTaxRate : null, list }
  return event.context.sfPlaces
}

/** The sign of each currency as the shop wrote it (Digipart > Devises), for the prices of the pages: { GBP: '£' }. */
export async function currencySigns(event: H3Event): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const place of (await places(event).catch(() => ({ list: [] as Place[] }))).list) {
    for (const m of place.Currencies) { const sign = m.Sign.trim(); if (sign && sign.length <= 5 && !out[m.IsoCode]) { out[m.IsoCode] = sign } }
  }
  return out
}

/** The tax prices are shown with, when it is not the one they are stored with (the main tax). */
function setTax(event: H3Event, main: number | null, place?: Place) {
  event.context.sfTax = place && main !== null && Math.abs(place.TaxRate - main) > 0.00001 ? place.TaxRate : undefined
}

/** Reads the cookies against Digipart, before anything reads a price. */
export async function checkRegion(event: H3Event) {
  const country = String(getCookie(event, COOKIE) || '').toUpperCase()
  if (!/^[A-Z]{2}$/.test(country)) { return }
  const { main, list } = await places(event)
  const place = list.find(c => c.IsoCode === country)
  if (!place) { return }
  event.context.sfCountry = country
  setTax(event, main, place)
  const asked = String(getCookie(event, MONEY) || '').toUpperCase(), money = place.Currencies.find(m => m.IsoCode === asked)
  if (money && asked !== SHOP_CURRENCY) { event.context.sfCurrency = asked; event.context.sfRate = money.Rate }
}

/** The country of delivery is known: its tax applies, and a foreign currency only stays when Digipart gives it to that country. */
export async function settleCountry(event: H3Event, iso: string) {
  const { main, list } = await places(event)
  const place = list.find(c => c.IsoCode === iso.toUpperCase())
  if (place) { setTax(event, main, place) }
  const money = place?.Currencies.find(m => m.IsoCode === visitorCurrency(event))
  event.context.sfCurrency = money && money.IsoCode !== SHOP_CURRENCY ? money.IsoCode : undefined
  event.context.sfRate = event.context.sfCurrency ? money!.Rate : undefined
}

/** Writes the country and its zone on the cart: api/cart keeps the first one it was given, api/carrier replaces it (tax and delivery follow). */
export async function placeCart(event: H3Event, iso: string) {
  const id = cartId(event)
  if (!id || !/^[A-Z]{2}$/.test(iso)) { return }
  await cartCall(event, 'GET', 'carrier', { IdCart: id, CountryIsoCode: iso, Address1: '-', Postcode: '-', City: '-', Country: iso, CarrierType: 'Home', CurrencyIsoCode: visitorCurrency(event) })
}

export const visitorCurrency = (event: H3Event): string => String(event.context.sfCurrency || SHOP_CURRENCY)
export const visitorCountry = (event: H3Event): string => String(event.context.sfCountry || '')
/** An amount of the visitor in the currency of the shop (the limits of the payment methods are in it). */
export const inShopCurrency = (event: H3Event, amount: number): number => amount / (Number(event.context.sfRate) || 1)
/** '' when the visitor has the usual prices, else what tells their prices apart (the kept pages). */
export const priceMark = (event: H3Event): string => (event.context.sfCurrency || event.context.sfTax !== undefined ? '#' + visitorCurrency(event) + ':' + (event.context.sfRate ?? 1) + '@' + (event.context.sfTax ?? '') : '')

/** Prices with the tax of the visitor's country, worked out from the price without tax as api/cart does. */
export function taxed<T extends { Price: number, PriceOld: number, PriceTaxExcl: number, PriceOldTaxExcl: number }>(event: H3Event, product: T | null): T | null {
  const rate = event.context.sfTax
  if (!product || rate === undefined || !(product.PriceTaxExcl > 0)) { return product }
  const incl = (amount: number) => Math.round(amount * (1 + rate) * 100) / 100
  return { ...product, Price: incl(product.PriceTaxExcl), PriceOld: product.PriceOldTaxExcl > 0 ? incl(product.PriceOldTaxExcl) : 0 }
}

export function keepCountry(event: H3Event, iso: string, currency: string, remember: boolean) {
  const options = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: getRequestProtocol(event, { xForwardedProto: true }) === 'https', ...(remember ? { maxAge: 60 * 60 * 24 * 365 } : {}) }
  setCookie(event, COOKIE, iso, options)
  if (currency !== SHOP_CURRENCY) { setCookie(event, MONEY, currency, options) } else { deleteCookie(event, MONEY, { path: '/' }) }
}

/** The countries a visitor may choose: active, in a delivery zone, with their name, their language (when the site has it) and their currencies. */
export async function regions(event: H3Event, lang: string): Promise<Region[]> {
  const [answer, site, { list }] = await Promise.all([shopApi<any>(event, 'country', { LanguageIsoCode: lang.toUpperCase() }), digipart<any>(event, '', {}).catch(() => null), places(event)])
  const isos = ((site?.Languages || []) as any[]).map(l => String(l.LanguageIsoCode || '').toLowerCase())
  const named = new Map<string, any>((Array.isArray(answer?.ActiveCountries) ? answer.ActiveCountries : []).map((c: any) => [String(c.CountryIsoCode || '').toUpperCase(), c]))
  return list.filter(c => named.get(c.IsoCode)?.CountryName).map((c) => {
    const own = String(named.get(c.IsoCode).LanguageIsoCode || '').toLowerCase()
    return { IsoCode: c.IsoCode, Name: String(named.get(c.IsoCode).CountryName), Language: isos.includes(own) ? own : '', Currencies: c.Currencies }
  }).sort((a, b) => a.Name.localeCompare(b.Name, lang))
}
