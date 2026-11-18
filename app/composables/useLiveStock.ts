// The live stock of a product (server/api/storefront/stock.get.ts) written into the product the page already holds: its sizes and whether it can be bought. Asked once per product and
// per page (the product page when it opens, a card when its sizes are first shown). A product with no sizes keeps what the page says.
const asked = new Set<number>()
export async function refreshStock(products: any[]) {
  const wanted = products.filter(p => p && p.Id && (p.Variants || []).length && !asked.has(p.Id))
  if (!wanted.length) { return }
  wanted.forEach(p => asked.add(p.Id))
  try {
    const answer = await $fetch<any>('/api/storefront/stock', { query: { ids: wanted.map(p => p.Id).join(',') } })
    for (const p of wanted) {
      const live = answer?.Stock?.[p.Id]
      if (!live) { continue }
      for (const v of p.Variants) { const now = live.Variants[v.Id]; if (now) { v.Available = now.Available; v.Quantity = now.Quantity } }
      p.Available = p.Variants.some((v: any) => v.Available)
    }
  } catch { wanted.forEach(p => asked.delete(p.Id)) }
}
