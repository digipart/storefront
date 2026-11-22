// The countries a visitor may choose with their currencies, and the country and currency of this visit (chosen, else France, else the first).
export default defineEventHandler(async (event) => {
  const { lang } = langOf(event)
  const list = await regions(event, lang)
  const chosen = visitorCountry(event)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  return { Countries: list, Current: (list.find(c => c.IsoCode === chosen) || list.find(c => c.IsoCode === 'FR') || list[0])?.IsoCode || '', Currency: visitorCurrency(event) }
})
