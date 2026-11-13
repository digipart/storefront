// The preview of a theme. A preview link of the library of themes of Digipart is the address of the site with `?preview=<token>`: the token is kept in a cookie the scripts of the page cannot read, so the
// visitor then browses the site at its usual addresses and keeps seeing the theme. `?preview=off` ends it. The token is checked by Digipart at every reading (signed, one theme, a week): this server
// only carries it.
export default defineEventHandler((event) => {
  const value = getQuery(event).preview
  if (typeof value !== 'string' || event.path.startsWith('/api/') || event.path.startsWith('/_nuxt/')) { return }
  if (value === 'off') { deleteCookie(event, 'sf_preview', { path: '/' }); event.context.sfPreview = ''; return }
  if (/^[A-Za-z0-9_.-]{20,120}$/.test(value)) {
    setCookie(event, 'sf_preview', value, { path: '/', httpOnly: true, sameSite: 'lax', secure: getRequestProtocol(event, { xForwardedProto: true }) === 'https', maxAge: 60 * 60 * 12 })
  }
})
