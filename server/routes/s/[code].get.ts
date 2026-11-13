// A short link of the shop (`/s/<code>`, made in Digipart: Marketing > Liens courts): Digipart says where it leads (api/shortlink, the API every front uses) and the visitor is sent there. A
// link to the automatic login of a customer leads to /account/autologin of this site, which logs in. An unknown or expired code is a page that does not exist.
export default defineEventHandler(async (event) => {
  const code = String(getRouterParam(event, 'code') || '')
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer')
  const found = /^[A-Za-z0-9_-]{1,40}$/.test(code) ? await cartCall(event, 'GET', 'shortlink', { Code: code }) : null
  const target = String(found?.TargetUrl || '')
  const expires = String(found?.ExpireAt || '')
  const expired = /^\d{4}-\d{2}-\d{2}/.test(expires) && !expires.startsWith('0000') && new Date(expires.replace(' ', 'T')).getTime() < Date.now()
  if (!/^https?:\/\/[^\s]+$/i.test(target) || expired) { throw createError({ statusCode: 404, statusMessage: 'Not Found' }) }
  return sendRedirect(event, target, 302)
})
