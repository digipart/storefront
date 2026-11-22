// The products of a "Sélection de produits" section, among those the channel sells: the newest, those of a category, a chosen list, or recommendations (`mode`). Digipart gives the ids
// (api/storefront/products.php), each product is then read from the product API.
// Rankings (top_viewed | top_cart | top_sales, over `days` days) and « Pour vous » (personal, with `fallback`): see below.
// Recommendations: on a product page (`product` = its id) the products Digipart recommends with it (api/product/recommendation, `reco` = crosssell | upsell); when it has none, the other products of
// its category, then the newest. Elsewhere there is no visitor to recommend for yet: the newest products.
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { lang, prefix } = langOf(event)
  const limit = Math.max(1, Math.min(24, Number(query.limit) || 4))
  const site = await digipart(event, '').catch(() => null)
  const priceBase = site?.PriceBaseType || 'retail'
  const load = (ids: number[]) => Promise.all(ids.map(id => loadProduct(event, id, lang, prefix, visitorCurrency(event), priceBase))).then(list => list.filter(Boolean) as any[])
  const idsOf = async (mode: string, category = 0, ids = '', count = limit, more: Record<string, string | number> = {}): Promise<number[]> => ((await digipart(event, 'products.php', { Mode: mode, IdCategory: category > 0 ? category : '', ProductIds: ids, Limit: count, ...more }).catch(() => null))?.ProductIds as number[]) || []   // no category: no IdCategory (Digipart refused 0)
  const rankings = ['top_viewed', 'top_cart', 'top_sales']
  const days = Math.max(1, Math.min(365, Math.floor(Number(query.days) || 30)))
  // a list shorter than asked (a new shop has few views or sales yet) is completed with the newest products
  const fill = async (ids: number[]) => { const have = new Set(ids); return ids.length >= limit ? ids : ids.concat((await idsOf('latest', 0, '', limit + ids.length)).filter(id => !have.has(id) && have.add(id))).slice(0, limit) }

  // the products most viewed, most put in a cart, most sold over the last `days` days (Digipart counts them, an hour at a time)
  if (rankings.includes(String(query.mode))) {
    return { Products: await load(await fill(await idsOf(String(query.mode), 0, '', limit, { Days: days }))) }
  }
  // « Pour vous »: for a signed-in customer, what Digipart suggests to him (the recommendation service, else what he looked at without buying it), completed with the section's other choice;
  // for anyone else, that other choice. Read for this visitor only: never kept by a cache.
  if (String(query.mode) === 'personal') {
    setResponseHeader(event, 'Cache-Control', 'private, no-store')
    const other = rankings.includes(String(query.fallback)) ? String(query.fallback) : 'latest'
    const who = await profile(event).catch(() => null)
    const mine = who && who.Id && !who.Guest ? await idsOf('personal', 0, '', limit, { IdCustomer: who.Id }) : []
    const have = new Set(mine)
    const rest = mine.length >= limit ? [] : (other === 'latest' ? await idsOf('latest', 0, '', limit + mine.length) : await idsOf(other, 0, '', limit + mine.length, { Days: days })).filter(id => !have.has(id) && have.add(id))
    return { Products: await load(await fill(mine.concat(rest).slice(0, limit))) }
  }

  if (String(query.mode) === 'recommendation') {
    const current = /^\d{1,10}$/.test(String(query.product ?? '')) ? Number(query.product) : 0
    let products: any[] = []
    if (current) {
      const answer = await shopApi(event, 'product/recommendation', { IdProduct: current, Mode: String(query.reco) === 'upsell' ? 'upsell' : 'crosssell', LanguageIsoCode: lang.toUpperCase(), CurrencyIsoCode: visitorCurrency(event) })
      const list: any[] = Array.isArray(answer) ? answer : (Array.isArray(answer?.Products) ? answer.Products : [])
      const ids = [...new Set(list.map(item => Number(item?.IdProduct || item?.Id || 0)).filter(id => id > 0 && id !== current))].slice(0, limit)
      products = await load(ids)
      if (products.length < limit) {   // nothing (or not enough) recommended yet: the other products of its category, then the newest
        const self = await loadProduct(event, current, lang, prefix, visitorCurrency(event), priceBase)
        const have = new Set([current, ...products.map(p => p.Id)])
        const more = [...(self?.IdCategory ? await idsOf('category', self.IdCategory, '', limit + 1) : []), ...(await idsOf('latest', 0, '', limit + 1))].filter(id => !have.has(id) && have.add(id))
        products = products.concat(await load(more.slice(0, limit - products.length)))
      }
    } else {
      products = await load(await idsOf('latest'))
    }
    return { Products: products }
  }
  const mode = ['category', 'manual'].includes(String(query.mode)) ? String(query.mode) : 'latest'
  const ids = String(query.ids ?? '')
  return { Products: await load(await idsOf(mode, /^\d{1,9}$/.test(String(query.category ?? '')) ? Number(query.category) : 0, /^[0-9,]{0,600}$/.test(ids) ? ids : '')) }
})
