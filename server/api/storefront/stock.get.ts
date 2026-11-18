// The live stock of products (`ids`: up to 24 product ids): whether each product and each of its sizes can be bought now. The pages are kept a few minutes (server/utils/pages.ts) and so is
// what Digipart says of a product: the product page and the quick sizes of a card ask this when they open, so a size sold out a minute ago is shown sold out. Read from Digipart's API
// api/product/variant.php (untouched), remembered 15 seconds.
export default defineEventHandler(async (event) => {
  const { lang } = langOf(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const ids = [...new Set(String(getQuery(event).ids ?? '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, 24)
  const out: Record<string, { Available: boolean, Variants: Record<string, { Available: boolean, Quantity: number }> }> = {}
  await Promise.all(ids.map(async (id) => {
    const raw = await shopApi<any>(event, 'product/variant.php', { IdProduct: id, LanguageIsoCode: lang.toUpperCase() }, 15)
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.Variant) ? raw.Variant : null
    if (!list) { return }
    const variants: Record<string, { Available: boolean, Quantity: number }> = {}
    for (const v of list) { const vid = Number(v?.Combination?.IdProductAttribute) || 0; if (vid > 0) { variants[vid] = { Available: !!v.Available, Quantity: Math.max(0, Number(v.Quantity) || 0) } } }
    out[id] = { Available: Object.values(variants).some(v => v.Available), Variants: variants }
  }))
  return { Stock: out }
})
