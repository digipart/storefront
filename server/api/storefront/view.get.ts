// What a page address shows, in this order: the home page; a product (`<category>/<name>-<id>`); a content page of the shop (its text and the design of its page template); a category of the catalogue
// (its products, a page of them, sorted). Each comes with the design that draws it, written in the site builder of Digipart. 404 when the address is nothing of the site.
const SORTS: Record<string, Record<string, string>> = { newest: { SortByNewest: 'DESC' }, price_asc: { SortByPrice: 'ASC' }, price_desc: { SortByPrice: 'DESC' } }

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const rest = String(query.rest ?? '').replace(/^\/+|\/+$/g, '')
  const { lang, prefix } = langOf(event)
  const language = { LanguageIsoCode: lang }
  const preview = previewQuery(event)
  // the address of the product in every language of the site (for the search engines): asked once per product page
  const withPaths = async (product: any) => { const found = await digipart(event, 'products.php', { Mode: 'paths', IdProduct: product.Id }).catch(() => null); const paths = found?.Paths && typeof found.Paths === 'object' ? found.Paths : {}; return { ...product, Alternates: { ...product.Alternates, ...paths }, Canonical: paths[lang] || product.Canonical } }
  const design = (key: string) => digipart(event, 'design.php', { ...preview, ...language, Key: key })
  // the page an address that is nothing of the site shows (the page asks for it after a 404, with `notfound=1`): the design « Page introuvable » of the site builder, or none
  if (String(query.notfound) === '1') { return { Kind: 'notfound', Design: await design('not_found').catch(() => null), Page: null } }
  if (rest === '') { return { Kind: 'home', Design: await design('home'), Page: null } }
  const segments = rest.split('/')
  if (segments.length > 3 || segments.some(segment => !/^[\p{L}\p{N}_.-]{1,200}$/u.test(segment))) { throw createError({ statusCode: 404, statusMessage: 'not-found' }) }
  const site = await digipart(event, '', preview)
  const priceBase = site?.PriceBaseType || 'retail'

  // the customer account, the favourites and the page of the « forgotten password » e-mail (its link is <site>/<language>/reset)
  const account = rest.match(/^(?:compte|account)(?:\/([a-z-]{2,20}))?(?:\/([A-Za-z0-9_-]{1,40}))?$/)
  const referral = rest.match(/^(?:parrainage|referral)\/([A-Za-z0-9]{4,20})$/)
  if (referral) { return { Kind: 'referral', Design: null, Page: null, Code: referral[1]!.toUpperCase() } }
  if (account) { return { Kind: 'account', Design: null, Page: null, Section: account[1] || '', Id: String(account[2] || '') } }
  if (rest === 'favoris' || rest === 'wishlist') { return { Kind: 'favorites', Design: null, Page: null } }
  if (/^(?:[a-z]{2,3}\/)?reset$/.test(rest)) { return { Kind: 'reset', Design: null, Page: null } }

  // a lookbook of the shop, with the products pinned on its pictures
  const look = rest.match(/^lookbook\/([\p{L}\p{N}_.-]{1,200})$/u)
  if (look) {
    const book = await digipart(event, 'lookbook.php', { ...preview, ...language, Slug: look[1] })
    if (!book) { throw createError({ statusCode: 404, statusMessage: 'not-found' }) }
    const pinned: Record<number, any> = {}
    await Promise.all(((book.ProductIds as number[]) || []).slice(0, 60).map(async (id) => { const product = await loadProduct(event, id, lang, prefix, 'EUR', priceBase); if (product) { pinned[id] = product } }))
    return { Kind: 'lookbook', Design: null, Page: null, Lookbook: { Alternates: Object.fromEntries(Object.entries(book.Slugs || {}).map(([iso, slug]) => [iso, 'lookbook/' + slug])), Title: String(book.Title || ''), SeoTitle: String(book.SeoTitle || book.Title || ''), SeoDescription: String(book.SeoDescription || ''), Blocks: book.Blocks || [], Products: pinned } }
  }

  // « Shop the look »: a product and the pieces that go with it (the products associated with it in Digipart), to buy together
  const lookAt = rest.match(/^shop-the-look\/[\p{L}\p{N}_.-]{1,200}-(\d{1,10})$/u)
  if (lookAt) {
    const main = await loadProduct(event, Number(lookAt[1]), lang, prefix, 'EUR', priceBase)
    const ids: number[] = main ? (((await digipart(event, 'looks.php', { IdProduct: main.Id }).catch(() => null))?.ProductIds as number[]) || []) : []
    const pieces = (await Promise.all(ids.slice(0, 12).map(id => loadProduct(event, id, lang, prefix, 'EUR', priceBase)))).filter(Boolean)
    if (!main || !pieces.length) { throw createError({ statusCode: 404, statusMessage: 'not-found' }) }
    return { Kind: 'look', Design: null, Page: null, Look: { Product: main, Pieces: pieces } }
  }

  // the brands of the shop: the list, and one brand with its newest products
  const text = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max)
  const shapeBrand = (b: any) => ({ Id: Number(b.IdBrand) || 0, Name: text(b.Name, 120), Title: text(b.Title, 160), Slug: text(b.Slug, 120), Short: text(b.DescriptionShort, 400), Logo: /^https?:\/\//.test(String(b.Logo)) ? String(b.Logo) : '', Cover: /^https?:\/\//.test(String(b.Cover)) ? String(b.Cover) : '', Count: Number(b.ProductCount) || 0 })
  if (/^(?:marques|brands)$/.test(rest)) {
    const answer = await digipart(event, 'brand.php', { ...preview, ...language })
    return { Kind: 'brands', Design: null, Page: null, Brands: (Array.isArray(answer?.Brands) ? answer.Brands : []).map(shapeBrand).filter((b: any) => b.Id > 0 && b.Slug) }
  }
  const brandAt = rest.match(/^(?:marque|brand)\/([\p{L}\p{N}_.-]{1,200})$/u)
  if (brandAt) {
    const answer = await digipart(event, 'brand.php', { ...preview, ...language, Slug: brandAt[1] })
    const brand = answer?.Brand
    if (!brand) { throw createError({ statusCode: 404, statusMessage: 'not-found' }) }
    const products = (await Promise.all(((brand.ProductIds as number[]) || []).slice(0, 48).map(id => loadProduct(event, id, lang, prefix, 'EUR', priceBase)))).filter(Boolean)
    return { Kind: 'brand', Design: null, Page: null, Brand: { ...shapeBrand(brand), Description: String(brand.Description || '').slice(0, 20000), SeoTitle: text(brand.SeoTitle || brand.Title || brand.Name, 160), SeoDescription: text(brand.SeoDescription || brand.DescriptionShort, 300),
      Alternates: Object.fromEntries(Object.entries(brand.Slugs || {}).map(([iso, slug]) => [iso, 'marque/' + slug])), Products: products } }
  }

  // the search: the products whose name or reference holds the words typed (api/storefront/search.php)
  if (rest === 'recherche' || rest === 'search') {
    const term = String(query.q ?? '').trim().slice(0, 80)
    const size = 24, pageNumber = Math.max(1, Math.min(200, Number(query.page) || 1))
    const found = term ? await digipart(event, 'search.php', { ...language, Term: term, Limit: size, Offset: (pageNumber - 1) * size }).catch(() => null) : null
    const products = (await Promise.all(((found?.ProductIds as number[]) || []).map(id => loadProduct(event, id, lang, prefix, 'EUR', priceBase)))).filter(Boolean)
    return { Kind: 'search', Design: await design('search').catch(() => null), Page: null, Search: { Term: term, Total: Number(found?.Total || 0), Products: products, Page: pageNumber, Pages: Math.max(1, Math.ceil(Number(found?.Total || 0) / size)) } }
  }

  // the page after a payment
  if (rest === 'commande/merci' || rest === 'checkout/thanks') { return { Kind: 'thanks', Design: null, Page: null } }

  // a product: its address ends with its id
  const idProduct = Number((segments[segments.length - 1].match(/-(\d{1,10})$/) || [])[1] || 0)
  if (segments.length >= 2 && idProduct > 0) {
    const product = await loadProduct(event, idProduct, lang, prefix, 'EUR', priceBase)
    if (!product) { throw createError({ statusCode: 404, statusMessage: 'not-found' }) }
    return { Kind: 'product', Design: await design('product'), Page: null, Product: await withPaths(product) }
  }
  // the addresses Digipart itself writes to a product, without its id: <category>/<name> and products/<name>
  if (segments.length === 2) {
    const found = await digipart(event, 'products.php', { Mode: 'slug', Slug: segments[1] }).catch(() => null)
    const product = found?.ProductIds?.[0] ? await loadProduct(event, Number(found.ProductIds[0]), lang, prefix, 'EUR', priceBase) : null
    if (product) { return { Kind: 'product', Design: await design('product'), Page: null, Product: await withPaths(product) } }
  }
  if (segments.length !== 1) { throw createError({ statusCode: 404, statusMessage: 'not-found' }) }

  // the cart of the visitor (its articles are read by the browser: the page is the same for everyone)
  if (rest === 'panier' || rest === 'cart') { return { Kind: 'cart', Design: (await design('cart')) || { Sections: [{ Id: 'cart', Type: 'main_cart', Settings: { Width: 'page', PaddingTop: 32, PaddingBottom: 48, PaddingMobile: 60, ShowPromoCode: true }, Texts: {}, Blocks: [] }] }, Page: null } }

  // the order page (what it shows is read by the browser, for this visitor only)
  if (rest === 'commande' || rest === 'checkout') { return { Kind: 'checkout', Design: await design('checkout'), Page: null } }

  // a content page of the shop
  const page = await digipart(event, 'page.php', { ...preview, ...language, Slug: rest })
  if (page) { return { Kind: 'page', Design: await design(page.DesignKey), Page: page } }

  // /whatsapp: joining the WhatsApp list of the shop. A content page of that name (with its own « Inscription WhatsApp » section) comes first; without one, the plain form is shown.
  if (rest === 'whatsapp') { return { Kind: 'whatsapp', Design: null, Page: null } }

  // a category of the catalogue
  const category = await shopApi(event, 'category/', { CategoryDescriptionFriendlyURL: rest, LanguageIsoCode: lang.toUpperCase() })
  if (!category || !category.IdCategory || category.Active === 0) { throw createError({ statusCode: 404, statusMessage: 'not-found' }) }
  const catalog = await design('catalog')
  const settings = (catalog?.Sections || []).find((section: any) => section.Type === 'main_catalog')?.Settings || {}
  const perPage = Math.max(4, Math.min(60, Number(settings.PerPage) || 24))
  const pageNumber = Math.max(1, Math.min(500, Number(query.page) || 1))
  const sort = Object.prototype.hasOwnProperty.call(SORTS, String(query.sort)) ? String(query.sort) : ''
  // what the visitor filtered on: sizes and colours (ids of the filter API), a price range
  const attributes = /^\d{1,9}(,\d{1,9}){0,19}$/.test(String(query.attr ?? '')) ? String(query.attr) : ''
  const priceMin = Math.max(0, Math.floor(Number(query.min) || 0)), priceMax = Math.max(0, Math.floor(Number(query.max) || 0))
  const filtered = { ...(attributes ? { FilterAttribute: attributes } : {}), ...(priceMax > priceMin ? { FilterPrice: priceMin + ',' + priceMax } : {}) }
  const same = { CategoryDescriptionFriendlyURL: rest, LanguageIsoCode: lang.toUpperCase(), CurrencyIsoCode: 'EUR' }
  const [listing, filterAttributes, filterPrice, media, links] = await Promise.all([
    shopApi(event, 'category/product', { ...same, Offset: (pageNumber - 1) * perPage, Limit: perPage, ...(SORTS[sort] || {}), ...filtered }),
    shopApi(event, 'category/filterAttribute', same), shopApi(event, 'category/filterPrice', same),
    digipart(event, 'category-cover.php', { IdCategory: Number(category.IdCategory) }).catch(() => null),
    // the sub-categories and the categories next to it (api/storefront/category-links.php), when the section links to them
    settings.SubNav === 'none' ? null : digipart(event, 'category-links.php', { ...language, IdCategory: Number(category.IdCategory) }).catch(() => null),
  ])
  // the cover of the category (Catalogue > Catégories > Couverture): its sizes from the smallest to the largest, or its Vimeo video. The addresses follow where the shop keeps its pictures (disk or bucket)
  const coverSizes = (Array.isArray(media?.Sizes) ? media.Sizes : []).filter((i: any) => /^https?:\/\//.test(String(i?.Src || ''))).map((i: any) => ({ Src: String(i.Src), Width: Number(i.Width) || 0, Height: Number(i.Height) || 0 })).sort((a: any, b: any) => a.Width - b.Width)
  const coverVideo = String(media?.Video || '')
  const groups = (Array.isArray(filterAttributes?.AttributeGroup) ? filterAttributes.AttributeGroup : []).map((group: any) => ({ Name: String(group.AttributeGroupName || ''), Values: (Array.isArray(group.Attribute) ? group.Attribute : []).map((a: any) => ({ Id: Number(a.IdAttribute), Name: String(a.AttributeName || '') })).filter((a: any) => a.Id > 0 && a.Name) })).filter((group: any) => group.Name && group.Values.length)
  const filters = { Groups: groups, PriceMin: Math.floor(Number(filterPrice?.RegularPrice?.MinPriceTaxIncl || 0)), PriceMax: Math.ceil(Number(filterPrice?.RegularPrice?.MaxPriceTaxIncl || 0)), Attributes: attributes ? attributes.split(',').map(Number) : [], Min: priceMax > priceMin ? priceMin : 0, Max: priceMax > priceMin ? priceMax : 0 }
  const seo = (Array.isArray(category.SEO) ? category.SEO : []).find((s: any) => String(s.LanguageIsoCode || '').toLowerCase() === lang) || category.SEO?.[0] || {}
  const total = Number(listing?.TotalProduct || 0)
  let products = await shapeListed(event, (listing?.Products || []).filter(Boolean), lang, prefix, 'EUR', priceBase)
  if (!products.length && total > 0 && !attributes && !filters.Max) {   // the listing named products it could not describe (a development server, another language): each is read on its own
    const ids: number[] = ((await digipart(event, 'products.php', { Mode: 'category', IdCategory: Number(category.IdCategory), Limit: perPage }).catch(() => null))?.ProductIds as number[]) || []
    products = (await Promise.all(ids.map(id => loadProduct(event, id, lang, prefix, 'EUR', priceBase)))).filter(Boolean) as any[]
  }
  // the staging of the category (Catalogue > Catégories > Mise en scène): its order, the products put forward, the photo of each card and the editorial blocks. It is the default sort of the page:
  // a visitor who sorts or filters sees the products alone, in the order asked for
  let items: any[] | null = null
  // the staging of the category: read for every view of the page, because it also holds the cards per line chosen for this category (it applies when the visitor sorts or filters too)
  const stage = await digipart(event, 'category-stage.php', { IdCategory: Number(category.IdCategory) }).catch(() => null)
  const display = { Columns: Math.max(0, Math.min(6, Number(stage?.Display?.Columns) || 0)), ColumnsMobile: Math.max(0, Math.min(2, Number(stage?.Display?.ColumnsMobile) || 0)) }
  let pages = Math.max(1, Math.ceil(total / perPage))
  if (!sort && !attributes && !filters.Max) {
    const staged: any[] = Array.isArray(stage?.Items) ? stage.Items : []
    if (staged.length) {
      const stagedIds = new Set(staged.filter(i => i.Type === 'product').map(i => Number(i.IdProduct)))
      const byId = new Map(products.map((p: any) => [p.Id, p]))
      // a staged item drawn as the staging says: an editorial block, or a product put forward
      const stagedItem = async (i: any) => {
          if (i.Type === 'edito') { return { Kind: 'edito', Id: String(i.Id), Size: String(i.Size), Image: /^https?:\/\//.test(String(i.Image)) ? String(i.Image) : '', Video: String(i.Video || ''), Title: String(i.Title || '').slice(0, 120), Height: Math.max(0, Math.min(1200, Number(i.Height) || 0)), HeightMobile: Math.max(0, Math.min(1200, Number(i.HeightMobile) || 0)), Url: /^(https?:\/\/|\/(?!\/))/.test(String(i.Url)) ? String(i.Url) : '' } }
          // a product put forward is read like its own page does (its price, its promotion and its old price are those of the product page), the listing only when that fails
          const product: any = (await loadProduct(event, Number(i.IdProduct), lang, prefix, 'EUR', priceBase).catch(() => null)) || byId.get(Number(i.IdProduct))
          if (!product) { return null }
          const own = (Array.isArray(i.Images) ? i.Images : []).filter((x: any) => /^https?:\/\//.test(String(x?.Src)))
          const shown = own.length ? { ...product, Images: [own[own.length - 1].Src, ...product.Images.filter((src: string) => !own.some((x: any) => x.Src === src))], ImageSets: [own.map((x: any) => x.Src + ' ' + x.Width + 'w').join(', '), ...(product.ImageSets || [])] } : product
          return { Kind: 'product', Size: String(i.Size), Video: String(i.Video || ''), Layout: i.Layout === 'cover' ? 'cover' : 'photos', Count: Math.max(2, Math.min(4, Number(i.Count) || 3)), Product: shown }
      }
      // the whole order of the category: the staged items first, then every other product of the category in its own order (ids only, api/storefront/products.php `category_all`); the page
      // shows its slice of it, so a category staged with hundreds of products still sends `perPage` cards a page
      const all = await digipart(event, 'products.php', { Mode: 'category_all', IdCategory: Number(category.IdCategory) }).catch(() => null)
      const others: number[] | null = Array.isArray(all?.ProductIds) ? (all.ProductIds as number[]).map(Number).filter(id => id > 0 && !stagedIds.has(id)) : null
      if (others) {
        const order: Array<{ staged?: any, id?: number }> = [...staged.map(i => ({ staged: i })), ...others.map(id => ({ id }))]
        const start = (pageNumber - 1) * perPage
        items = (await Promise.all(order.slice(start, start + perPage).map(async (entry) => {
          if (entry.staged) { return stagedItem(entry.staged) }
          const product = (await loadProduct(event, entry.id!, lang, prefix, 'EUR', priceBase).catch(() => null)) || byId.get(entry.id)   // as the product page reads it (its promotion), like the staged ones
          return product ? { Kind: 'product', Size: '1x1', Product: product } : null
        }))).filter(Boolean)
        pages = Math.max(1, Math.ceil(order.length / perPage))
      } else {   // a Digipart that does not know `category_all` yet: the staged items are cut in pages too, the products of the listing follow them
        const start = (pageNumber - 1) * perPage
        const rest = products.filter((p: any) => !stagedIds.has(p.Id)).map((p: any) => ({ Kind: 'product', Size: '1x1', Product: p }))
        items = [...(await Promise.all(staged.slice(start, start + perPage).map(stagedItem))).filter(Boolean), ...(start + perPage >= staged.length ? rest : [])]
      }
    }
  }
  // a link to a category of the site: its address in the language of the page (with the language part of the address), its name, how many products it has, its small picture
  const linkOf = (c: any) => ({ Id: Number(c?.Id) || 0, Name: text(c?.Name, 100), Url: prefix + '/' + String(c?.Slug || '').replace(/^\/+|\/+$/g, ''), Count: Number(c?.Count) || 0, Image: /^https?:\/\//.test(String(c?.Image)) ? String(c.Image) : '',
    Srcset: (Array.isArray(c?.Sizes) ? c.Sizes : []).filter((x: any) => /^https?:\/\/[^\s,]+$/.test(String(x?.Src)) && Number(x?.Width) > 0).map((x: any) => x.Src + ' ' + Number(x.Width) + 'w').join(', ') })
  const linkList = (list: unknown) => (Array.isArray(list) ? list : []).filter((c: any) => c && c.Slug && /^[\p{L}\p{N}_.\/-]{1,200}$/u.test(String(c.Slug))).map(linkOf)
  const categoryLinks = links ? { Parent: links.Parent?.Slug ? linkOf(links.Parent) : null, Children: linkList(links.Children), Siblings: linkList(links.Siblings) } : null
  return {
    Kind: 'catalog', Design: catalog, Page: null,
    Category: { Alternates: Object.fromEntries((Array.isArray(category.SEO) ? category.SEO : []).map((s: any) => [String(s.LanguageIsoCode || '').toLowerCase(), String(s.URL || '').replace(/^\/+|\/+$/g, '')]).filter(([iso, url]: string[]) => /^[a-z]{2,3}$/.test(iso) && url)), Id: Number(category.IdCategory), Slug: rest, Links: categoryLinks, Cover: { Sizes: coverSizes, Video: /vimeo\.com/i.test(coverVideo) ? coverVideo : '' }, Name: String(category.Description?.Title || seo.MetaTitle || rest), Description: String(category.Description?.Description || ''), SeoTitle: String(seo.MetaTitle || ''), SeoDescription: String(seo.MetaDescription || '') },
    Listing: { Items: items, Display: display, Products: products, Total: total, Page: pageNumber, Pages: pages, PerPage: perPage, Sort: sort, Filters: filters },
  }
})
