// The customer account: `?part=` me (who is logged in, the number of favourites), orders (`page`), order (`id`), loyalty, favorites, addresses (with the countries the shop delivers).
export default defineEventHandler(async (event) => {
  const { lang, prefix } = langOf(event)
  const query = getQuery(event)
  const part = String(query.part ?? 'me')
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  if (part === 'favorites') { return readFavorites(event, lang, prefix) }
  const customer = await profile(event)
  if (part === 'me') { return { Customer: customer, Favorites: (await readFavorites(event, lang, prefix)).Ids } }
  if (!customer) { throw createError({ statusCode: 401, statusMessage: 'login' }) }
  if (part === 'orders') { return readOrders(event, lang, Math.floor(Number(query.page) || 1), customer.Email) }
  if (part === 'order') { return { Order: await readOrder(event, lang, prefix, Math.floor(Number(query.id) || 0), customer.Email) } }
  if (part === 'addresses') {
    const countries = await cartCall(event, 'GET', 'country', { LanguageIsoCode: lang })
    return { Addresses: await readAddresses(event), Countries: (countries?.ActiveCountries || []).map((c: any) => ({ IsoCode: String(c.CountryIsoCode || '').toUpperCase(), Name: String(c.CountryName || '') })) }
  }
  if (part === 'loyalty') { return { Loyalty: await readLoyalty(event, lang) } }
  throw createError({ statusCode: 404, statusMessage: 'not-found' })
})
