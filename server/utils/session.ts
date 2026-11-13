import type { H3Event } from 'h3'

// Who the visitor is: the token Digipart gives when a customer logs in or orders as a guest. It is kept in a cookie the scripts of the page cannot read (`sf_session`) and sent to Digipart from this
// server only. It lasts a day (Digipart's own limit); a token Digipart no longer accepts is simply dropped.
const COOKIE = 'sf_session'

export function sessionToken(event: H3Event): string {
  if (event.context.sfToken !== undefined) { return String(event.context.sfToken) }
  const value = getCookie(event, COOKIE) || ''
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value) && value.length < 4000 ? value : ''
}

export function setSession(event: H3Event, token: string) {
  event.context.sfToken = token
  if (token) { setCookie(event, COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: getRequestProtocol(event, { xForwardedProto: true }) === 'https', maxAge: 60 * 60 * 23 }) } else { deleteCookie(event, COOKIE, { path: '/' }) }
}

// A customer who gave a password (or came by the « log in as » link of Digipart) is LOGGED IN, even when Digipart still holds the row as a « guest »: someone who first ordered without an
// account, then chose a password with « Mot de passe oublié », has a password and is still marked guest. A visitor who only typed an address on the order page is a guest and nothing more.
const LOGIN = 'sf_login'

export function loggedIn(event: H3Event): boolean {
  return event.context.sfLogin !== undefined ? !!event.context.sfLogin : getCookie(event, LOGIN) === '1'
}

export function setLoggedIn(event: H3Event, on: boolean) {
  event.context.sfLogin = on
  if (on) { setCookie(event, LOGIN, '1', { path: '/', httpOnly: true, sameSite: 'lax', secure: getRequestProtocol(event, { xForwardedProto: true }) === 'https', maxAge: 60 * 60 * 23 }) } else { deleteCookie(event, LOGIN, { path: '/' }) }
}

/** Only the pages of this site may change something (a form of another site cannot act for a visitor). */
export function sameSiteOnly(event: H3Event) {
  const origin = getRequestHeader(event, 'origin') || ''
  const host = getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host') || ''
  const site = getRequestHeader(event, 'sec-fetch-site') || ''
  let foreign = false
  try { foreign = !!origin && !!host && new URL(origin).host !== host } catch { foreign = true }
  if ((site && site !== 'same-origin') || foreign) { throw createError({ statusCode: 403, statusMessage: 'forbidden' }) }
}
