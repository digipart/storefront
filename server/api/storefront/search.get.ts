// The search panel of the site (opened by the search of the header): what is found for `q`, with filters (`attr`, `min`, `max`), a main category (`tab`), a sort and a page; with `design=1`, also
// the settings and texts the shop gave the search in the site builder (page « Recherche », section « Résultats de recherche »), read once when the panel opens.
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { lang, prefix } = langOf(event)
  const site = await digipart(event, '').catch(() => null)
  const ask = searchAsk(query, Number(query.size) || 24)
  const [result, design, view] = await Promise.all([
    readSearch(event, ask, lang, prefix, site?.PriceBaseType || 'retail'),
    String(query.design) === '1' ? digipart(event, 'design.php', { LanguageIsoCode: lang, Key: 'search' }).catch(() => null) : null,
    String(query.design) === '1' ? catalogView(event, lang) : null,
  ])
  const section = (design?.Sections || []).find((x: any) => x.Type === 'main_search')
  return { ...result, ...(String(query.design) === '1' ? { Settings: section?.Settings || null, Texts: section?.Texts || null, View: view } : {}) }
})
