// The link « Se connecter à sa place » of Digipart: logs the member of the shop in as the customer, then goes to the page asked (a page of THIS site only), so that the token leaves the
// address bar at once. A token Digipart refuses leads to the account page, which shows the login form.
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const asked = typeof query.redirect === 'string' ? query.redirect : ''
  const target = /^\/(?!\/)[A-Za-z0-9/_-]{0,200}$/.test(asked) ? asked : '/account'
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer')
  await autoLogin(event, typeof query.email === 'string' ? query.email : '', typeof query.token === 'string' ? query.token : '').catch(() => false)
  return sendRedirect(event, target, 302)
})
