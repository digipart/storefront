import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'

// The virtual try-on (« Essayez-le »): the engine relays the visitor's photo to Digipart (api/storefront/try-on.php, with the key of the front, from the server only) and asks where the try-on stands.
// The visit has its own id in a cookie (Digipart counts the tries per visit and only shows a result to the visit that asked). In local development Digipart's own code answers (dev/bridge.php).
const run = promisify(execFile)
const VISIT = 'sf_tryon'

/** The id of this visit for the try-on: kept one day in a cookie that scripts cannot read. */
export function tryOnVisit(event: H3Event): string {
  let id = getCookie(event, VISIT) || ''
  if (!/^[a-f0-9]{32}$/.test(id)) {
    id = randomBytes(16).toString('hex')
    setCookie(event, VISIT, id, { path: '/', httpOnly: true, sameSite: 'lax', secure: getRequestProtocol(event, { xForwardedProto: true }) === 'https', maxAge: 60 * 60 * 24 })
  }
  return id
}

/** One call to api/storefront/try-on.php: the answer's JSON, the errors included ({code, status, message, Reason}); `null` when Digipart did not answer. */
export async function tryOnCall(event: H3Event, query: Record<string, string>, photo?: { data: Buffer, type: string }, fields: Record<string, string> = {}): Promise<any> {
  const config = useRuntimeConfig(event)
  const id = String(config.idMarketPlace)
  if (config.localApp) {
    const php = String(config.localPhp || 'php'), bridge = join(process.cwd(), 'dev', 'bridge.php'), app = String(config.localApp)
    const ask = async (what: string, args: Record<string, string>) => JSON.parse((await run(php, [bridge, app, what, JSON.stringify({ IdMarketPlace: id, ...args })], { timeout: 20000, maxBuffer: 40 * 1024 * 1024 })).stdout)
    try {
      if (!photo) { return await ask('try-on.php', query) }
      const file = join(tmpdir(), 'sf-tryon-' + randomBytes(8).toString('hex'))
      await writeFile(file, photo.data, { mode: 0o600 })
      const answer = await ask('try-on.php', { ...query, ...fields, PhotoFile: file })
      if (answer?.Run) {   // the picture is made in the background, as the server of Digipart does after its answer
        spawn(php, [bridge, app, 'try-on-run', JSON.stringify({ IdMarketPlace: id, IdTryOn: answer.IdTryOn, PhotoFile: file })], { detached: true, stdio: 'ignore' }).unref()
        delete answer.Run
      }
      return answer
    } catch (error: any) {
      console.error('[tryon] the local bridge failed: ' + String(error?.message || error).slice(0, 300))
      return null
    }
  }
  if (!config.digipartUrl || !config.clientId || !config.clientSecret || !id) { return null }
  const base = String(config.digipartUrl).replace(/\/+$/, '') + '/api/storefront/try-on.php'
  const headers = { 'X-Client-Id': String(config.clientId), 'X-Client-Secret': String(config.clientSecret) }
  try {
    if (!photo) {
      return await $fetch<any>(base, { query: { IdMarketPlace: id, ...query }, headers, retry: 0, timeout: 10000, ignoreResponseError: true })
    }
    const form = new FormData()
    for (const [name, value] of Object.entries({ ...query, ...fields })) { form.append(name, value) }
    form.append('Photo', new Blob([new Uint8Array(photo.data)], { type: photo.type }), 'photo.' + (photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg'))
    // a server of Digipart that cannot answer before the picture is made answers when it is done: up to a few minutes
    return await $fetch<any>(base, { method: 'POST', query: { IdMarketPlace: id }, body: form, headers, retry: 0, timeout: 280000, ignoreResponseError: true })
  } catch (error: any) {
    console.error('[tryon] Digipart did not answer: ' + String(error?.message || error).slice(0, 200))   // never the photo
    return null
  }
}

/**
 * A product was put in the cart: when this visit tried it on, the try-on follows the cart (the statistics of the module: tries → cart → order). Only a visit that has the try-on cookie asks; never waited for.
 */
export function tryOnAdded(event: H3Event, idProduct: number, idCart: number) {
  const visit = getCookie(event, VISIT) || ''
  if (!/^[a-f0-9]{32}$/.test(visit) || idProduct <= 0 || idCart <= 0) { return }
  const config = useRuntimeConfig(event)
  const fields = { Event: 'cart', IdProduct: String(idProduct), Visitor: visit, IdCart: String(idCart) }
  if (config.localApp) {
    run(String(config.localPhp || 'php'), [join(process.cwd(), 'dev', 'bridge.php'), String(config.localApp), 'try-on.php', JSON.stringify({ IdMarketPlace: String(config.idMarketPlace), ...fields })], { timeout: 15000 }).catch(() => {})
    return
  }
  if (!config.digipartUrl || !config.clientId || !config.clientSecret) { return }
  $fetch(String(config.digipartUrl).replace(/\/+$/, '') + '/api/storefront/try-on.php', {
    method: 'POST', query: { IdMarketPlace: String(config.idMarketPlace) }, body: new URLSearchParams(fields).toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Client-Id': String(config.clientId), 'X-Client-Secret': String(config.clientSecret) }, retry: 0, timeout: 8000,
  }).catch(() => {})
}

/** What the browser gets: never more than it needs. */
export function tryOnAnswer(answer: any) {
  if (!answer || typeof answer !== 'object') { return { Status: 'failed', Reason: 'error' } }
  if (answer.status === 'error') { return { Status: 'failed', Reason: String(answer.Reason || 'error') } }
  return {
    Id: String(answer.IdTryOn || ''), Status: String(answer.Status || 'failed'), Reason: answer.Reason ? String(answer.Reason) : null, Image: typeof answer.Image === 'string' ? answer.Image : null,
    Kind: answer.Kind ? String(answer.Kind) : undefined, Framing: answer.Framing ? String(answer.Framing) : undefined,
  }
}
