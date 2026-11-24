// A code section (Liquid) drawn for the plan view of the site builder of Digipart: the builder sends the section as it is being written (`Section`: Id, Settings {File, Values, Items, Translations})
// and the preview link of its theme (`preview`), and gets {Html, Error} as the site would draw it, with the data of the shop (Site, and the drafts of the theme). Only with a preview link, and only for
// the back-office of this site (the address Digipart is at: DIGIPART_URL, or the local one in development).
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  let admin = ''
  try { admin = new URL(String(config.digipartUrl || config.localUrl || '')).origin } catch { admin = '' }
  const origin = getRequestHeader(event, 'origin') || ''
  if (admin && origin === admin) { setResponseHeaders(event, { 'Access-Control-Allow-Origin': admin, Vary: 'Origin' }) }
  setResponseHeader(event, 'Cache-Control', 'no-store')
  if (!Object.keys(previewQuery(event)).length) { return { Html: '', Error: 'A preview link is needed.' } }
  // sent as text (no preflight): the JSON of the section
  let body: any = null
  try { const raw = await readRawBody(event, 'utf8'); body = raw ? JSON.parse(raw.slice(0, 200000)) : null } catch { body = null }
  const given = body?.Section
  if (!given || typeof given !== 'object' || typeof given.Settings !== 'object') { return { Html: '', Error: 'No section.' } }
  const section = { Id: String(given.Id || '').slice(0, 40), Type: 'code', Settings: given.Settings }
  const drawn: any = await withCode(event, { Sections: [section] })
  const out = drawn?.Sections?.[0] || {}
  return { Html: String(out.Html || ''), Error: String(out.Error || '') }
})
