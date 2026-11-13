// A visitor joins the WhatsApp list of the shop (a « Inscription WhatsApp » section, or the page /whatsapp): {Email, Phone, Website}. First the e-mail alone; Digipart says when the phone number
// is needed, then both are sent (api/whatsapp/subscribe, the API every front uses, untouched). `Website` is a field no person fills. Nothing Digipart knows about the e-mail (a name, a
// customer number) is given back to the page. An address may ask a few times only in ten minutes.
const asked = new Map<string, number[]>()
const clean = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max)

export default defineEventHandler(async (event) => {
  sameSiteOnly(event)
  const body = await readBody(event)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const email = clean(body?.Email, 150).toLowerCase(), phone = clean(body?.Phone, 30).replace(/[^+0-9 ().-]/g, '')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { return { Done: false, Step: 'email', Error: 'Indiquez une adresse e-mail valable.' } }
  if (clean(body?.Phone, 30) !== '' && !/^\+?[0-9 ().-]{6,30}$/.test(phone)) { return { Done: false, Step: 'phone', Error: 'Indiquez votre numéro WhatsApp, avec l\'indicatif du pays si vous êtes à l\'étranger.' } }
  if (String(body?.Website ?? '') !== '') { return { Done: true, Step: 'done', Error: '' } }
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown', now = Date.now()
  const recent = (asked.get(ip) || []).filter(at => now - at < 10 * 60 * 1000)
  if (recent.length >= 6) { return { Done: false, Step: phone ? 'phone' : 'email', Error: 'Trop de demandes : merci de patienter quelques minutes.' } }
  asked.set(ip, [...recent, now])
  if (asked.size > 5000) { asked.delete(asked.keys().next().value as string) }
  // the first step never subscribes by itself: the number is always typed by the visitor (Digipart would otherwise use the number it knows for this e-mail, whoever types the e-mail)
  if (!phone) { return { Done: false, Step: 'phone', Error: '' } }
  const answer = await cartCall(event, 'POST', 'whatsapp/subscribe', { Email: email, MobilePhone: phone })
  if (answer?.NeedsPhone) { return { Done: false, Step: 'phone', Error: 'Indiquez votre numéro WhatsApp, avec l\'indicatif du pays si vous êtes à l\'étranger.' } }
  const done = String(answer?.Status) === 'success'
  return { Done: done, Step: done ? 'done' : 'phone', Error: done ? '' : 'Votre inscription n\'a pas pu être enregistrée, merci de réessayer.' }
})
