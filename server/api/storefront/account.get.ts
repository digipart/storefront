// The customer account: `?part=` me (who is logged in, the number of favourites), orders (`page`), order (`id`), tracking (`id` of the order), loyalty (with the rewards and the wallet link), service, ticket (`id`), referral, favorites, addresses (with the countries the shop delivers).
export default defineEventHandler(async (event) => {
  const { lang, prefix } = langOf(event)
  const query = getQuery(event)
  const part = String(query.part ?? 'me')
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  if (part === 'favorites') { return readFavorites(event, lang, prefix) }
  if (part === 'me') { return remember(event, 'me:' + lang, async () => { const [who, favorites] = await Promise.all([profile(event), favoriteIds(event, lang)]); return { Customer: who, Favorites: favorites } }) }   // the two at the same time, kept a few seconds per visitor
  const customer = await profile(event)
  if (!customer) { throw createError({ statusCode: 401, statusMessage: 'login' }) }
  if (part === 'orders') { return readOrders(event, lang, Math.floor(Number(query.page) || 1), customer.Email) }
  if (part === 'order') { return { Order: await readOrder(event, lang, prefix, String(query.id ?? ''), customer.Email) } }
  if (part === 'addresses') {
    const countries = await cartCall(event, 'GET', 'country', { LanguageIsoCode: lang })
    return { Addresses: await readAddresses(event), Countries: (countries?.ActiveCountries || []).map((c: any) => ({ IsoCode: String(c.CountryIsoCode || '').toUpperCase(), Name: String(c.CountryName || '') })) }
  }
  if (part === 'loyalty') { const [loyalty, rewards, wallet] = await Promise.all([readLoyalty(event, lang), readRewards(event, lang).catch(() => null), readWallet(event).catch(() => '')]); return { Loyalty: loyalty, Rewards: rewards, Wallet: wallet } }
  if (part === 'tracking') { return { Tracking: await readTracking(event, lang, prefix, String(query.id ?? '')) } }
  if (part === 'service') { return readService(event, lang) }
  if (part === 'ticket') { return { Ticket: await readTicket(event, lang, Math.floor(Number(query.id) || 0)) } }
  if (part === 'referral') {
    const host = getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host') || ''
    return { Referral: await readReferral(event, lang, getRequestProtocol(event, { xForwardedProto: true }) + '://' + host, prefix) }
  }
  // the overview: the loyalty state and the last order, asked at the same time
  if (part === 'home') { const [loyalty, orders] = await Promise.all([readLoyalty(event, lang).catch(() => null), readOrders(event, lang, 1, customer.Email, 1).catch(() => null)]); return { Loyalty: loyalty, LastOrder: orders?.Orders?.[0] || null, Orders: orders?.Total || 0, Currency: orders?.Currency || 'EUR' } }
  throw createError({ statusCode: 404, statusMessage: 'not-found' })
})
