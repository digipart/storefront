// A content page of the shop by its id (the size guide a product page opens in a panel): its title and its text, cleaned by Digipart. 404 when the shop has no such published page.
export default defineEventHandler(async (event) => {
  const { lang } = langOf(event)
  const id = Math.floor(Number(getQuery(event).id) || 0)
  const preview = previewQuery(event)
  const list = id > 0 ? await digipart(event, 'page.php', { ...preview, LanguageIsoCode: lang }) : null
  const found = (list?.Pages || []).find((page: any) => Number(page.IdPage) === id)
  const page = found ? await digipart(event, 'page.php', { ...preview, LanguageIsoCode: lang, Slug: found.Slug }) : null
  if (!page) { throw createError({ statusCode: 404, statusMessage: 'not-found' }) }
  return { Title: String(page.Title || ''), Content: String(page.Content || '') }
})
