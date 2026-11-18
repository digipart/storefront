import type { H3Event } from 'h3'

// The search of the site, as its panel (opened by the search of the header) and its page /recherche show it: the products found, the filters with what each value would give, the main categories
// as tabs, the categories named like the words, a sort and a page of results. Digipart counts everything (api/storefront/search.php with `Facets=1`); a Digipart that does not know it yet
// answers the plain search, drawn without filters.
export const SEARCH_SORTS = ['newest', 'price_asc', 'price_desc', 'best']

export interface SearchAsk { term: string, attr: string, min: number, max: number, tab: number, sort: string, page: number, size: number }

export function searchAsk(query: Record<string, any>, size = 24): SearchAsk {
  const min = Math.max(0, Math.floor(Number(query.min) || 0)), max = Math.max(0, Math.floor(Number(query.max) || 0))
  return {
    term: String(query.q ?? '').trim().slice(0, 80),
    attr: /^\d{1,9}(,\d{1,9}){0,39}$/.test(String(query.attr ?? '')) ? String(query.attr) : '',
    min: max > min ? min : 0, max: max > min ? max : 0,
    tab: /^\d{1,9}$/.test(String(query.tab ?? '')) ? Number(query.tab) : 0,
    sort: SEARCH_SORTS.includes(String(query.sort)) ? String(query.sort) : '',
    page: Math.max(1, Math.min(200, Number(query.page) || 1)),
    size: Math.max(4, Math.min(48, size)),
  }
}

export async function readSearch(event: H3Event, ask: SearchAsk, lang: string, prefix: string, priceBase: string) {
  const empty = { Term: ask.term, Total: 0, Products: [] as any[], Page: 1, Pages: 1, Sort: ask.sort, Tab: ask.tab, Tabs: [] as any[], Suggestions: [] as any[], Filters: { Groups: [] as any[], PriceMin: 0, PriceMax: 0, Attributes: [] as number[], Min: 0, Max: 0 } }
  if (!ask.term) { return empty }
  const found = await digipart(event, 'search.php', {
    LanguageIsoCode: lang, Term: ask.term, Facets: 1, Attributes: ask.attr, PriceMin: ask.min, PriceMax: ask.max, Tab: ask.tab, Sort: ask.sort || 'newest', Limit: ask.size, Offset: (ask.page - 1) * ask.size,
  }).catch(() => null)
  if (!found) { return empty }
  const products = (await Promise.all(((found.ProductIds as number[]) || []).map(id => loadProduct(event, Number(id), lang, prefix, 'EUR', priceBase)))).filter(Boolean)
  const chosen = ask.attr ? ask.attr.split(',').map(Number) : []
  // a value no product would have with the other choices is not offered (unless it is chosen)
  const groups = (Array.isArray(found.Facets?.Groups) ? found.Facets.Groups : []).map((g: any) => ({
    Name: String(g.Name || '').slice(0, 60),
    Values: (Array.isArray(g.Values) ? g.Values : []).map((v: any) => ({ Id: Number(v.Id) || 0, Name: String(v.Name || '').slice(0, 60), Count: Number(v.Count) || 0 })).filter((v: any) => v.Id > 0 && v.Name && (v.Count > 0 || chosen.includes(v.Id))),
  })).filter((g: any) => g.Name && g.Values.length)
  // the colours show their swatch (Catalogue > Attributs), as on a category page
  const ids = groups.flatMap((g: any) => g.Values.map((v: any) => v.Id)).slice(0, 300)
  const looks = ids.length ? ((await digipart(event, 'attribute-looks.php', { Ids: ids.join(',') }).catch(() => null))?.Attributes || {}) : {}
  for (const group of groups) {
    for (const value of group.Values) { const look = looks[String(value.Id)]; value.Code = /^#[0-9a-f]{6}$/i.test(String(look?.Code)) ? String(look.Code) : ''; value.Image = /^https:\/\//.test(String(look?.Image)) ? String(look.Image) : '' }
    group.IsColor = group.Values.some((v: any) => looks[String(v.Id)]?.IsColor)
  }
  const total = Number(found.Total) || 0
  const slug = (value: unknown) => String(value || '').replace(/^\/+|\/+$/g, '')
  return {
    Term: String(found.Term || ask.term), Total: total, Products: products, Page: ask.page, Pages: Math.max(1, Math.ceil(total / ask.size)), Sort: ask.sort, Tab: ask.tab,
    Tabs: (Array.isArray(found.Tabs) ? found.Tabs : []).map((t: any) => ({ Id: Number(t.Id) || 0, Name: String(t.Name || '').slice(0, 60), Count: Number(t.Count) || 0 })).filter((t: any) => t.Id > 0 && t.Name),
    Suggestions: (Array.isArray(found.Suggestions) ? found.Suggestions : []).filter((c: any) => /^[\p{L}\p{N}_.\/-]{1,200}$/u.test(slug(c.Slug))).map((c: any) => ({ Id: Number(c.Id) || 0, Name: String(c.Name || '').slice(0, 80), Url: prefix + '/' + slug(c.Slug) })),
    Filters: { Groups: groups, PriceMin: Math.floor(Number(found.Facets?.PriceMin) || 0), PriceMax: Math.ceil(Number(found.Facets?.PriceMax) || 0), Attributes: chosen, Min: ask.min, Max: ask.max },
  }
}
