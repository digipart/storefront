// The lookbook a section of the home page puts forward: the one the shop chose (`id`), else the newest visible one. `Lookbook` is null when the shop has none.
export default defineEventHandler(async (event) => {
  const { lang, prefix } = langOf(event)
  const id = Math.floor(Number(getQuery(event).id) || 0)
  const list: any[] = (await digipart(event, 'lookbook.php', { ...previewQuery(event), LanguageIsoCode: lang }).catch(() => null))?.Lookbooks || []
  const found = (id ? list.find(book => Number(book.IdLookbook) === id) : null) || list[0] || null
  return { Lookbook: found ? { Title: String(found.Title || ''), Cover: String(found.Cover || ''), Url: prefix + '/lookbook/' + String(found.Slug) } : null }
})
