// The cart of the visitor (empty when there is none yet).
export default defineEventHandler(async (event) => {
  const { lang, prefix } = langOf(event)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  return readCart(event, lang, prefix)
})
