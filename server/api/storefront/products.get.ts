// The products of a "Sélection de produits" section, among those the channel sells: the newest, those of a category, a chosen list, or recommendations (`mode`). Digipart gives the ids
// (api/storefront/products.php), each product is then read from the product API.
// Recommendations: on a product page (`product` = its id) the products Digipart recommends with it (api/product/recommendation, `reco` = crosssell | upsell); when it has none, the other products of
// its category, then the newest. Elsewhere there is no visitor to recommend for yet: the newest products.
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { lang, prefix } = langOf(event)
  const limit = Math.max(1, Math.min(24, Number(query.limit) || 4))
  const site = await digipart(event, '').catch(() => null)
  const priceBase = site?.PriceBaseType || 'retail'
  const load = (ids: number[]) => Promise.all(ids.map(id => loadProduct(event, id, lang, prefix, 'EUR', priceBase))).then(list => list.filter(Boolean) as any[])
  const idsOf = async (mode: string, category = 0, ids = '', count = limit): Promise<number[]> => ((await digipart(event, 'products.php', { Mode: mode, IdCategory: category, ProductIds: ids, Limit: count }).catch(() => null))?.ProductIds as number[]) || []

  if (String(query.mode) === 'recommendation') {
    const current = /^\d{1,10}$/.test(String(query.product ?? '')) ? Number(query.product) : 0
    let products: any[] = []
    if (current) {
      const answer = await shopApi(event, 'product/recommendation', { IdProduct: current, Mode: String(query.reco) === 'upsell' ? 'upsell' : 'crosssell', LanguageIsoCode: lang.toUpperCase(), CurrencyIsoCode: 'EUR' })
      const list: any[] = Array.isArray(answer) ? answer : (Array.isArray(answer?.Products) ? answer.Products : [])
      const ids = [...new Set(list.map(item => Number(item?.IdProduct || item?.Id || 0)).filter(id => id > 0 && id !== current))].slice(0, limit)
      products = await load(ids)
      if (products.length < limit) {   // nothing (or not enough) recommended yet: the other products of its category, then the newest
        const self = await loadProduct(event, current, lang, prefix, 'EUR', priceBase)
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
