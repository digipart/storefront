// The reviews of the section « Avis clients »: the ones the shop put forward (or the best rated), the total and the average of all its approved reviews (api/storefront/reviews.php of Digipart: authors
// shortened, no e-mail). Never an error for a page: a shop without reviews gets an empty list.
export default defineEventHandler(async (event) => {
  const { lang } = langOf(event)
  const query = getQuery(event)
  const source = String(query.source) === 'best' ? 'best' : 'featured'
  const limit = Math.max(1, Math.min(12, Number(query.limit) || 6))
  const answer = await digipart<any>(event, 'reviews.php', { Source: source, Limit: limit, LanguageIsoCode: lang }).catch(() => null)
  const text = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max)
  return {
    Total: Math.max(0, Number(answer?.Total) || 0),
    Average: Math.max(0, Math.min(5, Number(answer?.Average) || 0)),
    Items: (Array.isArray(answer?.Items) ? answer.Items : []).slice(0, limit).map((r: any) => ({
      Rating: Math.max(1, Math.min(5, Number(r.Rating) || 5)), Comment: text(r.Comment, 600), Date: text(r.Date, 10), Author: text(r.Author, 60),
      Product: r.Product?.Slug ? { Id: Number(r.Product.Id) || 0, Name: text(r.Product.Name, 160), Slug: text(r.Product.Slug, 160).replace(/^\/+|\/+$/g, '') } : null,
    })).filter((r: any) => r.Comment),
  }
})
