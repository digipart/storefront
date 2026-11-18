// What the product page shows beyond the product: the loyalty points a purchase earns (by the rules of the shop's loyalty program, for the price shown) and the approved reviews of the product
// (api/storefront/product-extra.php of Digipart: authors shortened, no e-mail).
export default defineEventHandler(async (event) => {
  const { lang } = langOf(event)
  const query = getQuery(event), id = Number(query.id), amount = Math.max(0, Number(query.amount) || 0)
  if (!Number.isInteger(id) || id <= 0) { return { Brand: null, Categories: [], Colors: [], Reservation: { Stores: [] }, Points: { Active: false, Earn: 0 }, Reviews: { Total: 0, Average: 0, Distribution: {}, Items: [] } } }
  const answer = await digipart<any>(event, 'product-extra.php', { IdProduct: id, Amount: amount || '', LanguageIsoCode: lang }).catch(() => null)
  const text = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max)
  const reviews = answer?.Reviews || {}
  const brand = answer?.Brand
  return {
    Brand: brand?.Slug ? { Name: text(brand.Title || brand.Name, 120), Slug: text(brand.Slug, 120) } : null,
    Categories: (Array.isArray(answer?.Categories) ? answer.Categories : []).map((c: any) => Number(c)).filter((c: number) => Number.isInteger(c) && c > 0).slice(0, 40),
    // the colours of the product that belong to a colour group of Digipart, with their code (#RRGGBB): drawn as swatches by the block « Tailles et couleurs »
    Colors: (Array.isArray(answer?.Colors) ? answer.Colors : []).slice(0, 60).map((c: any) => ({ Name: text(c?.Name, 100), Code: /^#[0-9a-f]{6}$/i.test(String(c?.Code)) ? String(c.Code).toLowerCase() : '' })).filter((c: any) => c.Name),
    Reservation: { Stores: (Array.isArray(answer?.Reservation?.Stores) ? answer.Reservation.Stores : []).slice(0, 100).map((s: any) => ({ Id: Number(s.Id) || 0, Name: text(s.Name, 120), City: text(s.City, 100), InStock: typeof s.InStock === 'boolean' ? s.InStock : null, Images: (Array.isArray(s.Images) ? s.Images : []).filter((u: any) => /^https:\/\/[^\s"'<>]+$/.test(String(u))).slice(0, 4) })).filter((s: any) => s.Id > 0 && s.Name) },
    Points: { Active: answer?.Points?.Active === true, Earn: Math.max(0, Math.floor(Number(answer?.Points?.Earn) || 0)) },
    Reviews: {
      Total: Number(reviews.Total) || 0, Average: Number(reviews.Average) || 0, Distribution: reviews.Distribution || {},
      Items: (Array.isArray(reviews.Items) ? reviews.Items : []).slice(0, 10).map((r: any) => ({ Rating: Number(r.Rating) || 0, Comment: text(r.Comment, 1500), Date: text(r.Date, 10), Author: text(r.Author, 60), Featured: r.Featured === true })),
    },
  }
})
