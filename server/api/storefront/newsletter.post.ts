// A visitor subscribes to the newsletter of the shop: {Email, Website}. `Website` is a field no person fills (hidden in the form): a robot that fills it is answered « done » and nothing is sent.
// Digipart's own subscription API does the rest (api/newsletter/subscribe, untouched), with its anti-robot checks when the shop switched them on.
export default defineEventHandler(async (event) => {
  sameSiteOnly(event)
  const { lang } = langOf(event)
  const body = await readBody(event)
  const email = String(body?.Email ?? '').trim().slice(0, 150)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { return { Done: false, Error: 'Indiquez une adresse e-mail valable.' } }
  if (String(body?.Website ?? '') !== '') { return { Done: true, Error: '' } }
  const answer = await cartCall(event, 'POST', 'newsletter/subscribe', { Email: email, LanguageIsoCode: lang.toUpperCase(), CurrencyIsoCode: 'EUR', IP: getRequestIP(event, { xForwardedFor: true }) || '' })
  const done = !!answer && (answer.Status === 'subscribed' || answer.status === 'success' || !!answer.Email)
  return { Done: done, Error: done ? '' : 'Votre inscription n\'a pas pu être enregistrée, merci de réessayer.' }
})
