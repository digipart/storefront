import { randomBytes } from 'node:crypto'

// « Continuer avec Google / Facebook »: sends the visitor to the provider. What must come back (a random state), the page to return to and the language wait in a cookie.
export default defineEventHandler(async (event) => {
  const provider = String(getRouterParam(event, 'provider') || ''), query = getQuery(event)
  const back = typeof query.back === 'string' && /^\/(?!\/)[A-Za-z0-9/_-]{0,200}$/.test(query.back) ? query.back : '/'
  const lang = typeof query.lang === 'string' && /^[a-z]{2,3}$/.test(query.lang) ? query.lang : ''
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const state = randomBytes(24).toString('base64url')
  const url = ['google', 'facebook'].includes(provider) ? await socialStart(event, provider, state) : ''
  if (!url) { return sendRedirect(event, back + '?social=error', 302) }
  setCookie(event, 'sf_social', JSON.stringify({ state, back, lang }), { path: '/account/social', httpOnly: true, sameSite: 'lax', secure: getRequestProtocol(event, { xForwardedProto: true }) === 'https', maxAge: 600 })
  return sendRedirect(event, url, 302)
})
