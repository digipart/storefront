// The virtual try-on, read side: `?IdProduct=` → whether the product offers it, the framing the photo needs and the Turnstile widget to draw; `?Id=` → where a try-on of this visit stands
// ({Status: running | done | failed, Reason, Image}). Never kept in memory: each visitor gets their own answer (server/utils/tryon.ts).
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const query = getQuery(event)
  const id = String(query.Id || '')
  if (id) {
    if (!/^[a-f0-9]{32}$/.test(id)) { return { Status: 'failed', Reason: 'error' } }
    return tryOnAnswer(await tryOnCall(event, { IdTryOn: id, Visitor: tryOnVisit(event) }))
  }
  const idProduct = Math.floor(Number(query.IdProduct) || 0)
  if (idProduct < 1) { return { Enabled: false } }
  const answer = await tryOnCall(event, { IdProduct: String(idProduct) })
  if (!answer || answer.status === 'error') { return { Enabled: false } }
  return { Enabled: !!answer.Enabled, Kind: String(answer.Kind || 'garment'), Framing: String(answer.Framing || 'any'), SiteKey: String(answer.TurnstileSiteKey || '') }
})
