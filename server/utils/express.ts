import type { H3Event } from 'h3'

// The express payment at the top of the order page (Apple Pay, Google Pay: the Express Checkout Element of Stripe). The wallet of the visitor gives the e-mail, the name, the phone and the
// delivery address in one gesture; this server turns them into what the usual order page does step by step: the delivery methods of the country (home delivery only: a relay point cannot be
// chosen in a wallet), the customer and the address, then the card payment prepared from the cart. Nothing is trusted from the browser but the choices of the visitor.
export interface ExpressRate { id: string, displayName: string, amount: number }

const clean = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max)

/** The home delivery methods of a country as the wallet lists them (the one of the cart first), after making the first one the method of the cart; and what the cart then costs, in cents. */
export async function expressRates(event: H3Event, lang: string, prefix: string, country: string, wanted = 0, passive = false): Promise<{ error: string, rates: ExpressRate[], amount: number, currency: string, payment: number }> {
  const none = { rates: [], amount: 0, currency: 'eur', payment: 0 }
  if (!/^[A-Z]{2}$/.test(country)) { return { error: 'Nous ne livrons pas encore ce pays.', ...none } }
  let page = await readCheckout(event, lang, prefix, country)
  if (!page.Cart.Count) { return { error: 'Votre panier est vide.', ...none } }
  if (!page.Countries.some((c: any) => c.IsoCode === country) || page.CountryIsoCode !== country) { return { error: 'Nous ne livrons pas encore ce pays.', ...none } }
  const home = page.Carriers.filter(c => c.Type === 'Home')
  if (!home.length) { return { error: 'Aucun mode de livraison pour ce pays pour le moment.', ...none } }
  // `passive` (the page is only being drawn, the visitor touched nothing in the wallet): a relay point or a shop the visitor chose on the page is never replaced; no express payment then
  if (passive && page.Cart.IdCarrier && !home.some(c => c.IdCarrier === page.Cart.IdCarrier)) { return { error: '', ...none } }
  const chosen = home.find(c => c.IdCarrier === wanted) || home.find(c => c.IdCarrier === page.Cart.IdCarrier) || home[0]!
  if (page.Cart.IdCarrier !== chosen.IdCarrier || page.Cart.IdRelayPoint) {
    const set = await changeCheckout(event, { Action: 'carrier', IdCarrier: chosen.IdCarrier, CountryIsoCode: country }, lang)
    if (set.error) { return { error: set.error, ...none } }
    page = await readCheckout(event, lang, prefix, country)
  }
  const stripe = page.Payments.find(p => p.Provider === 'Stripe' && p.Available)
  if (!stripe || !page.Pay?.Stripe) { return { error: 'Le paiement par carte n\'est pas disponible pour le moment.', ...none } }
  const rates = [chosen, ...home.filter(c => c.IdCarrier !== chosen.IdCarrier)].map(c => ({ id: String(c.IdCarrier), displayName: clean(c.Title, 60) || 'Livraison', amount: Math.round(c.Price * 100) }))
  return { error: '', rates, amount: Math.round(page.Cart.ToPay * 100), currency: String(page.Cart.Currency || 'EUR').toLowerCase(), payment: stripe.IdPayment }
}

/** The visitor confirmed in the wallet: the customer and the address are saved as the order page would, the delivery method is set, and the card payment is prepared. */
export async function expressConfirm(event: H3Event, body: any, lang: string, prefix: string): Promise<{ error: string, code?: string, clientSecret?: string, amount?: number }> {
  const address = body?.Address || {}
  const country = clean(address.country, 2).toUpperCase()
  const name = clean(body?.Name, 120).replace(/[^\p{L}\p{M}' .-]+/gu, ' ').replace(/\s+/g, ' ').trim()
  const [first, ...rest] = name.split(' ')
  const phone = clean(body?.Phone, 30).replace(/[^+0-9 ().-]/g, '')
  const contact = await changeCheckout(event, {
    Action: 'contact', Email: clean(body?.Email, 150), Firstname: (first || '').slice(0, 60), Lastname: (rest.join(' ') || first || '').slice(0, 60), Address1: clean(address.line1, 150), Address2: clean(address.line2, 150),
    Postcode: clean(address.postal_code, 20), City: clean(address.city, 100), CountryIsoCode: country, MobilePhone: phone,
  }, lang)
  if (contact.error) { return { error: contact.error, code: contact.code } }
  // the delivery method again, now that Digipart knows the address (its price is the one of the country: it does not change)
  const rates = await expressRates(event, lang, prefix, country, Math.floor(Number(body?.IdCarrier) || 0))
  if (rates.error) { return { error: rates.error } }
  const paid = await startStripe(event, { IdPayment: rates.payment }, lang)
  if (paid.error || !paid.clientSecret) { return { error: paid.error || 'Le paiement n\'a pas pu être préparé, merci de réessayer.' } }
  return { error: '', clientSecret: paid.clientSecret, amount: paid.amount }
}
