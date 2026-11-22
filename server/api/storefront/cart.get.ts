// The cart of the visitor (empty when there is none yet).
export default defineEventHandler(async (event) => {
  const { lang, prefix } = langOf(event)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  return remember(event, 'cart:' + lang + ':' + prefix + ':' + visitorCurrency(event) + ':' + visitorCountry(event), () => readCart(event, lang, prefix))   // kept a few seconds per visitor, dropped as soon as the visitor changes something
})
