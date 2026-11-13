// What the visitor does on the order page: {Action: 'contact' | 'login' | 'logout' | 'carrier', …}. Answers the page after it, with `Error` (and `Code`) when it was refused.
export default defineEventHandler(async (event) => {
  sameSiteOnly(event)
  const { lang, prefix } = langOf(event)
  const body = await readBody(event)
  const result = await changeCheckout(event, body, lang)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  return { ...(await readCheckout(event, lang, prefix, String(body?.CountryIsoCode ?? '').toUpperCase().slice(0, 2))), Error: result.error, Code: result.code || '' }
})
