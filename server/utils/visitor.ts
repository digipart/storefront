import type { H3Event } from 'h3'

// What one visitor's pages ask again and again (the cart, who is logged in, the favourites) is kept a few seconds in memory, per visitor: going from a page to the next does not ask Digipart
// again. It is dropped the moment this visitor changes anything (a product added, a login, an address...), so a page never shows less than what the visitor just did.
const kept = new Map<string, { at: number, data: unknown }>()
const LIFE = 20000

/** Who this visitor is for the memory: the cart and the session of the request (never shared between two visitors). */
function owner(event: H3Event): string {
  const cart = String(getCookie(event, 'sf_cart') || '').replace(/\D/g, '').slice(0, 12)
  const session = String(getCookie(event, 'sf_session') || '')
  const fav = String(getCookie(event, 'sf_fav') || '').replace(/\D/g, '').slice(0, 12)
  return cart + '|' + fav + '|' + session.slice(-24)
}

/** `read()` once per visitor every few seconds; a visitor with no cart, no session and no favourites is never kept (there is nothing to ask for them anyway). */
export async function remember<T>(event: H3Event, what: string, read: () => Promise<T>): Promise<T> {
  const who = owner(event)
  if (who === '||' || event.context.sfChanged) { return read() }
  const key = who + '#' + what
  const hit = kept.get(key)
  if (hit && Date.now() - hit.at < LIFE) { return hit.data as T }
  const data = await read()
  // what the request changed meanwhile (a new cart, a new session) is not kept under the old visitor
  if (!event.context.sfChanged && owner(event) === who) {
    kept.set(key, { at: Date.now(), data })
    if (kept.size > 20000) { for (const old of kept.keys()) { kept.delete(old); if (kept.size < 15000) { break } } }
  }
  return data
}

/** This visitor changed something: nothing kept for them is used any more. */
export function forget(event: H3Event) {
  event.context.sfChanged = true
  const who = owner(event)
  if (who === '||') { return }
  for (const key of kept.keys()) { if (key.startsWith(who + '#')) { kept.delete(key) } }
}
