// A code section (Liquid) that uses Customer, Cart, Orders or Loyalty, drawn again for this visitor only (the page itself is kept for everyone and drawn as a guest).
// Body (JSON): Section {Id, Settings} as the page gave it, and Context {Product, Category, Page} of the page. Answer {Html}, never kept.
export default defineEventHandler(async (event) => {
  sameSiteOnly(event)
  setResponseHeader(event, 'Cache-Control', 'no-store, private')
  let body: any = null
  try { const raw = await readRawBody(event, 'utf8'); body = raw && raw.length < 400000 ? JSON.parse(raw) : null } catch { body = null }
  const given = body?.Section
  if (!given || typeof given !== 'object' || typeof given.Settings !== 'object' || !given.Settings) { return { Html: '' } }
  const context = body?.Context && typeof body.Context === 'object' ? body.Context : {}
  const objects = Object.fromEntries(['Product', 'Category', 'Page'].filter(key => context[key] && typeof context[key] === 'object').map(key => [key, context[key]]))
  const section = { Id: String(given.Id || '').slice(0, 40), Type: 'code', Settings: given.Settings }
  const drawn: any = await withCode(event, { Sections: [section] }, objects, 'visitor')
  return { Html: String(drawn?.Sections?.[0]?.Html || '') }
})
