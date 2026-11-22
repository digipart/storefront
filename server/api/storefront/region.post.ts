// The visitor chose a country and a currency: {Country, Currency, Remember}. Only a country of the shop and one of its currencies are kept (else its default one).
export default defineEventHandler(async (event) => {
  sameSiteOnly(event)
  const { lang } = langOf(event)
  const body = await readBody(event)
  const country = (await regions(event, lang)).find(c => c.IsoCode === String(body?.Country ?? '').toUpperCase())
  if (!country) { return { Done: false } }
  const asked = String(body?.Currency ?? '').toUpperCase()
  const currency = (country.Currencies.find(m => m.IsoCode === asked) || country.Currencies[0])?.IsoCode || SHOP_CURRENCY
  keepCountry(event, country.IsoCode, currency, body?.Remember === true)
  forget(event)
  return { Done: true, Currency: currency }
})
