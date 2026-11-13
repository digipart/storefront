// What the visitor does with the account: {Action: 'login' | 'register' | 'logout' | 'forgot' | 'reset' | 'profile' | 'newsletter' | 'fav' | 'reward-obtain' | 'loyalty-join' | 'loyalty-leave' | 'ticket-new' | 'ticket-reply', …}. Answers who is logged in after it, with `Error` or `Note`.
export default defineEventHandler(async (event) => {
  sameSiteOnly(event)
  const { lang, prefix } = langOf(event)
  const body = await readBody(event)
  const host = getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host') || ''
  const origin = getRequestProtocol(event, { xForwardedProto: true }) + '://' + host
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  // the loyalty programme and the customer service (server/utils/accountMore.ts): only for a customer who is logged in
  const action = String(body?.Action || '')
  if (['reward-obtain', 'loyalty-join', 'loyalty-leave', 'ticket-new', 'ticket-reply'].includes(action)) {
    const who = await profile(event)
    if (!who || who.Guest) { return { Customer: who, Favorites: [], Error: 'Connectez-vous pour continuer.', Note: '' } }
    if (action === 'reward-obtain') { const got = await obtainReward(event, lang, Math.floor(Number(body?.Id) || 0)); return { Customer: who, Error: got.error, Note: '', Code: got.code || '' } }
    if (action === 'loyalty-join' || action === 'loyalty-leave') { const error = await changeLoyalty(event, lang, body); event.context.sfProfile = undefined; return { Customer: await profile(event), Error: error, Note: '' } }
    const sent = await changeService(event, lang, body)
    return { Customer: who, Error: sent.error, Note: '', Id: sent.id || 0 }
  }
  const result = await changeAccount(event, body, lang, origin)
  return { Customer: await profile(event), Favorites: (await readFavorites(event, lang, prefix)).Ids, Error: result.error, Note: result.error ? '' : (result.note || '') }
})
