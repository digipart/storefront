// What the visitor does with the account: {Action: 'login' | 'register' | 'logout' | 'forgot' | 'reset' | 'profile' | 'newsletter' | 'fav', …}. Answers who is logged in after it, with `Error` or `Note`.
export default defineEventHandler(async (event) => {
  sameSiteOnly(event)
  const { lang, prefix } = langOf(event)
  const body = await readBody(event)
  const host = getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host') || ''
  const origin = getRequestProtocol(event, { xForwardedProto: true }) + '://' + host
  const result = await changeAccount(event, body, lang, origin)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  return { Customer: await profile(event), Favorites: (await readFavorites(event, lang, prefix)).Ids, Error: result.error, Note: result.error ? '' : (result.note || '') }
})
