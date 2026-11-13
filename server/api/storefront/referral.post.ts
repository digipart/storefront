// A friend follows a referral link (`/parrainage/<code>`) and gives an e-mail: {Email, Code, Newsletter, Website}. Digipart makes the welcome promo code. `Website` is a field no person
// fills. An address may ask a few times only in ten minutes.
const asked = new Map<string, number[]>()

export default defineEventHandler(async (event) => {
  sameSiteOnly(event)
  const { lang } = langOf(event)
  const body = await readBody(event)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  if (String(body?.Website ?? '') !== '') { return { Error: '', Code: '', Until: '', Value: 0 } }
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown', now = Date.now()
  const recent = (asked.get(ip) || []).filter(at => now - at < 10 * 60 * 1000)
  if (recent.length >= 5) { return { Error: 'Trop de demandes : merci de patienter quelques minutes.', Code: '', Until: '', Value: 0 } }
  asked.set(ip, [...recent, now])
  if (asked.size > 5000) { asked.delete(asked.keys().next().value as string) }
  const result = await claimReferral(event, lang, body)
  return { Error: result.error, Code: result.code || '', Until: result.until || '', Value: result.value || 0 }
})
