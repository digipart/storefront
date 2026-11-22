import type { H3Event } from 'h3'

// The country and the currency the visitor chose (footer « pays et langue »): kept in cookies. The currency is one Digipart gives to that country (Configuration > Pays);
// prices, the cart and the payment are asked to Digipart in it.
const COOKIE = 'sf_country', MONEY = 'sf_currency'
export const SHOP_CURRENCY = 'EUR'   // what a visitor who chose nothing sees

export function visitorCurrency(event: H3Event): string {
  const value = String(getCookie(event, MONEY) || '').toUpperCase()
  return /^[A-Z]{3}$/.test(value) ? value : SHOP_CURRENCY
}

export function visitorCountry(event: H3Event): string {
  const value = String(getCookie(event, COOKIE) || '').toUpperCase()
  return /^[A-Z]{2}$/.test(value) ? value : ''
}

export function keepCountry(event: H3Event, iso: string, currency: string, remember: boolean) {
  const options = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: getRequestProtocol(event, { xForwardedProto: true }) === 'https', ...(remember ? { maxAge: 60 * 60 * 24 * 365 } : {}) }
  setCookie(event, COOKIE, iso, options)
  if (currency && currency !== SHOP_CURRENCY) { setCookie(event, MONEY, currency, options) } else { deleteCookie(event, MONEY, { path: '/' }) }
}

export interface Region { IsoCode: string, Name: string, Language: string, Currencies: Array<{ IsoCode: string, Name: string, Sign: string, Main: boolean }> }
/** The countries of the shop, each with its default language (when the site has it) and its currencies, the default one first. */
export async function regions(event: H3Event, lang: string): Promise<Region[]> {
  const [answer, site] = await Promise.all([shopApi<any>(event, 'country', { LanguageIsoCode: lang.toUpperCase() }), digipart(event, '', {}).catch(() => null)])
  const isos = ((site?.Languages || []) as any[]).map(l => String(l.LanguageIsoCode || '').toLowerCase())
  return (Array.isArray(answer?.ActiveCountries) ? answer.ActiveCountries : [])
    .map((c: any) => { const own = String(c.LanguageIsoCode || '').toLowerCase(); const currencies = (Array.isArray(c.CountryCurrencies) ? c.CountryCurrencies : []).map((m: any) => ({ IsoCode: String(m.CurrencyIsoCode || '').toUpperCase(), Name: String(m.CurrencyName || ''), Sign: String(m.CurrencySign || ''), Main: m.IsMainCurrency === true })).filter((m: any) => /^[A-Z]{3}$/.test(m.IsoCode)).sort((a: any, b: any) => Number(b.Main) - Number(a.Main)); return { IsoCode: String(c.CountryIsoCode || '').toUpperCase(), Name: String(c.CountryName || ''), Language: isos.includes(own) ? own : '', Currencies: currencies } })
    .filter((c: any) => /^[A-Z]{2}$/.test(c.IsoCode) && c.Name)
    .sort((a: any, b: any) => a.Name.localeCompare(b.Name, lang))
}
