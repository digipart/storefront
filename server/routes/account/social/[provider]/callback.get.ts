// The provider sends the visitor back with a code: checked against the state kept in the cookie, then Digipart says who logged in.
export default defineEventHandler(async (event) => {
  const provider = String(getRouterParam(event, 'provider') || ''), query = getQuery(event)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer')
  let kept: any = null
  try { kept = JSON.parse(getCookie(event, 'sf_social') || 'null') } catch { kept = null }
  deleteCookie(event, 'sf_social', { path: '/account/social' })
  const back = typeof kept?.back === 'string' && /^\/(?!\/)[A-Za-z0-9/_-]{0,200}$/.test(kept.back) ? kept.back : '/'
  const code = typeof query.code === 'string' ? query.code : ''
  const sure = ['google', 'facebook'].includes(provider) && code !== '' && typeof kept?.state === 'string' && kept.state.length >= 16 && query.state === kept.state
  const entered = sure ? await socialFinish(event, provider, code, typeof kept?.lang === 'string' ? kept.lang : '').catch(() => false) : false
  return sendRedirect(event, entered ? back : back + '?social=error', 302)
})
