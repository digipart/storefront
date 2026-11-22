// Digipart says something changed (class/Storefront/StorefrontPush.php). A poke proves nothing and carries nothing: the site looks at Digipart itself, with its key.
// Anybody may send one, so it only brings forward what the site does anyway, a few times a minute at most.
let last = 0, lastMenu = 0
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const now = Date.now()
  if (now - last < 1000) { return { Done: true } }
  last = now
  const kinds = String((await readBody(event).catch(() => null))?.Kind ?? '').split(',')
  if (kinds.includes('menu') && now - lastMenu > 10000) { lastMenu = now; menuCache.clear(); agePages() }
  poked()
  touchStamp(event)
  return { Done: true }
})
