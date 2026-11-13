// A visitor writes to the shop from a « Formulaire de contact » section: {Name, Email, Phone, Order, Subject, Message, Website}. The message becomes a request in Digipart (Service client),
// through the contact API every front uses (api/ticket/contact, untouched). `Website` is a field no person fills: a robot that fills it is answered « sent » and nothing is sent. An address
// may send a few messages only in ten minutes.
const sent = new Map<string, number[]>()
const clean = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]+/g, ' ').trim().slice(0, max)

export default defineEventHandler(async (event) => {
  sameSiteOnly(event)
  const { lang } = langOf(event)
  const body = await readBody(event)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const name = clean(body?.Name, 120).replace(/\s+/g, ' '), email = clean(body?.Email, 150).toLowerCase(), message = clean(body?.Message, 4000)
  const phone = clean(body?.Phone, 30).replace(/[^+0-9 ().-]/g, ''), order = clean(body?.Order, 40).replace(/[^A-Za-z0-9_-]/g, ''), subject = clean(body?.Subject, 150).replace(/\s+/g, ' ')
  if (name.length < 2) { return { Done: false, Error: 'Indiquez votre nom.' } }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { return { Done: false, Error: 'Indiquez une adresse e-mail valable.' } }
  if (message.length < 10) { return { Done: false, Error: 'Votre message est trop court.' } }
  if (String(body?.Website ?? '') !== '') { return { Done: true, Error: '' } }
  // a few messages per address in ten minutes
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown', now = Date.now()
  const recent = (sent.get(ip) || []).filter(at => now - at < 10 * 60 * 1000)
  if (recent.length >= 4) { return { Done: false, Error: 'Vous avez déjà envoyé plusieurs messages : merci de patienter quelques minutes.' } }
  sent.set(ip, [...recent, now])
  if (sent.size > 5000) { sent.delete(sent.keys().next().value as string) }
  const [first, ...rest] = name.split(' ')
  const lines = [order ? 'Commande : ' + order : '', phone ? 'Téléphone : ' + phone : '', message].filter(Boolean).join('\n')
  const answer = await cartCall(event, 'POST', 'ticket/contact?LanguageIsoCode=' + encodeURIComponent(lang.toUpperCase()), {
    Email: email, Firstname: first || name, Lastname: rest.join(' '), Subject: subject || 'Message depuis le site', Message: lines, RecaptchaToken: 'storefront',
  })
  const done = answer?.status === 'success'
  return { Done: done, Error: done ? '' : 'Votre message n\'a pas pu être envoyé, merci de réessayer.' }
})
