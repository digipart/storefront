// The relay points of a carrier near the customer's delivery address (or near a postcode and a city the visitor typed).
export default defineEventHandler(async (event) => {
  const { lang } = langOf(event)
  const query = getQuery(event)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  return readRelays(event, lang, Math.floor(Number(query.carrier) || 0), { postcode: String(query.postcode ?? ''), city: String(query.city ?? '') })
})
