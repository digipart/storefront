// The stories of a place of the site (`place`: home | catalog | product, with `product` = the id of the product looked at), with the product each slide sells: its name, its price, its picture.
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { lang, prefix } = langOf(event)
  const place = ['home', 'catalog', 'product'].includes(String(query.place)) ? String(query.place) : 'home'
  const idProduct = Math.floor(Number(query.product) || 0)
  const answer = await digipart(event, 'story.php', { ...previewQuery(event), LanguageIsoCode: lang, Placement: place, IdProduct: idProduct || '' }).catch(() => null)
  const stories: any[] = Array.isArray(answer?.Stories) ? answer.Stories : []
  const ids = [...new Set(stories.flatMap(story => (story.Slides || []).map((slide: any) => Number(slide.IdProduct) || 0)).filter(id => id > 0))].slice(0, 40)
  const products = new Map<number, any>()
  await Promise.all(ids.map(async (id) => { const product = await loadProduct(event, id, lang, prefix).catch(() => null); if (product) { products.set(id, product) } }))
  const vimeo = (value: string) => (String(value || '').match(/(\d{6,})/) || [])[1] || ''
  return {
    Stories: stories.map(story => ({
      Id: Number(story.IdStory), Title: String(story.Title || ''), Cover: String(story.Cover || story.Slides?.[0]?.Image || ''),
      Slides: (story.Slides || []).map((slide: any) => {
        const product = products.get(Number(slide.IdProduct) || 0)
        const link = String(slide.Link || '')
        return {
          Id: String(slide.Id), Image: String(slide.Image || ''), Vimeo: vimeo(slide.Video), Duration: Math.max(3, Math.min(30, Number(slide.Duration) || 6)), Title: String(slide.Texts?.Title || ''), Text: String(slide.Texts?.Text || ''), Button: String(slide.Texts?.Button || ''),
          Link: /^https:\/\//.test(link) ? link : (/^\/[^/]/.test(link) || link === '/' ? prefix + link : ''),
          Product: product ? { Id: product.Id, Name: product.Name, Price: product.Price, Currency: product.Currency, Image: product.Images[0] || '', Url: product.Url, Sized: product.Variants.length > 0, Available: product.Available, TaxExcl: product.TaxExcl, PriceState: product.PriceState, PriceOld: 0 } : null,
        }
      }).filter((slide: any) => slide.Image || slide.Vimeo),
    })).filter(story => story.Slides.length),
  }
})
