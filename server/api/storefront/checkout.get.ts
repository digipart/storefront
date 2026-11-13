// The order page of the visitor: the cart, who orders, the address, and the delivery and payment methods of the country.
export default defineEventHandler(async (event) => {
  const { lang, prefix } = langOf(event)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  return readCheckout(event, lang, prefix, String(getQuery(event).country ?? '').toUpperCase().slice(0, 2))
})
