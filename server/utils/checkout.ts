import type { H3Event } from 'h3'

// The order page. Everything comes from the APIs every front of Digipart uses (untouched): the customer and its addresses, the countries the shop sells to, the delivery methods of the zone of the
// country and the payment methods of the country, each in the order set on the country in Digipart (Configuration > Pays). This server asks them for the visitor; the browser never does.
export interface CheckoutAddress { IdAddress: number, Firstname: string, Lastname: string, Company: string, Address1: string, Address2: string, Postcode: string, City: string, CountryIsoCode: string, Country: string, MobilePhone: string }
export interface CheckoutCarrier { IdCarrier: number, Type: string, Title: string, Description: string, Price: number, PriceTaxExcl: number, Delay: number, Date: string }
export interface CheckoutPayment { IdPayment: number, Code: string, Provider: string, Title: string, Description: string, Available: boolean }

const text = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max)

async function customer(event: H3Event): Promise<any | null> {
  if (!sessionToken(event)) { return null }
  const answer = await cartCall(event, 'GET', 'customer', {})
  const found = answer?.AuthData?.Customer
  if (!found || !found.Id) { if (answer) { setSession(event, '') } return null }   // the token is no longer accepted; a Digipart that did not answer drops nothing
  return { Email: String(found.Email || ''), Firstname: String(found.Firstname || ''), Lastname: String(found.Lastname || ''), Guest: (found.Guest === true || found.Guest === 1 || found.Guest === '1') && !loggedIn(event) }
}

export async function addresses(event: H3Event): Promise<CheckoutAddress[]> {
  const list = await cartCall(event, 'GET', 'customer/address', {})
  return (Array.isArray(list) ? list : []).map((a: any) => ({
    IdAddress: Number(a.IdAddress), Firstname: String(a.Firstname || ''), Lastname: String(a.Lastname || ''), Company: String(a.Company || ''), Address1: String(a.Address1 || ''), Address2: String(a.Address2 || ''),
    Postcode: String(a.Postcode || ''), City: String(a.City || ''), CountryIsoCode: String(a.CountryIsoCode || '').toUpperCase(), Country: String(a.Country || ''), MobilePhone: String(a.MobilePhone || a.Phone || ''),
    IsDelivery: a.IsDelivery === true || a.IsDelivery === 1 || a.IsDelivery === '1',
  } as any)).filter((a: CheckoutAddress) => a.IdAddress > 0)
}

export async function readCheckout(event: H3Event, lang: string, prefix: string, askedCountry: string) {
  const upper = lang.toUpperCase()
  const [who, countryAnswer, site, last, pay] = await Promise.all([customer(event), cartCall(event, 'GET', 'country', { LanguageIsoCode: lang }), digipart(event, '', {}).catch(() => null), newestOrder(event, lang), payConfig(event)])
  const countries = (Array.isArray(countryAnswer?.ActiveCountries) ? countryAnswer.ActiveCountries : []).map((c: any) => ({ IsoCode: String(c.CountryIsoCode || '').toUpperCase(), Name: String(c.CountryName || '') })).filter((c: any) => c.IsoCode)
  const list = who ? await addresses(event) : []
  const address = (list.find((a: any) => a.IsDelivery) || list[0] || null) as CheckoutAddress | null
  // the country the delivery and payment methods are shown for: the one of the address, else the one the visitor picked, else the first country of the shop
  const iso = address?.CountryIsoCode || (countries.some((c: any) => c.IsoCode === askedCountry) ? askedCountry : (countries.find((c: any) => c.IsoCode === 'FR') || countries[0])?.IsoCode || 'FR')
  const countryName = countries.find((c: any) => c.IsoCode === iso)?.Name || address?.Country || iso
  await settleCountry(event, iso)
  // an address Digipart knows, else the place alone (the payment API finds the country by its NAME)
  const place: Record<string, string | number> = address ? { IdAddress: address.IdAddress } : { Address1: '-', Postcode: '-', City: '-', Country: countryName }
  // carriers first: that call writes the country and the zone on the cart, whose tax and delivery are read next
  const carrierAnswer = cartId(event) ? await cartCall(event, 'GET', 'carrier', { ...place, LanguageIsoCode: upper, CurrencyIsoCode: visitorCurrency(event), IdCart: cartId(event), CountryIsoCode: iso }) : null
  const [cart, paymentAnswer] = await Promise.all([readCart(event, lang, prefix, iso), cartId(event) ? cartCall(event, 'GET', 'payment/methods', { ...place, LanguageIsoCode: upper }) : null])
  const carriers: CheckoutCarrier[] = []
  for (const type of ['Home', 'RelayPoint', 'Store']) {
    for (const c of ((cart.Count && carrierAnswer?.Carrier?.[type]) || [])) {
      carriers.push({ IdCarrier: Number(c.IdCarrier), Type: type, Title: String(c.Title || c.Name || ''), Description: String(c.Description || ''), Price: Number(c.Price?.TaxIncl || 0), PriceTaxExcl: Number(c.Price?.TaxExcl || 0), Delay: Number(c.Delivery?.Delay || 0), Date: String(c.Delivery?.ApproximateDate || '') })
    }
  }
  const total = cart.ToPay, limited = inShopCurrency(event, total)   // AmountMin and AmountMax are in the currency of the shop
  const giftCards = who && cart.Count ? await readGiftCards(event, total) : null
  const euros = visitorCurrency(event) === SHOP_CURRENCY
  const payments: CheckoutPayment[] = (Array.isArray(paymentAnswer?.PaymentMethods) ? paymentAnswer.PaymentMethods : []).map((p: any) => ({
    IdPayment: Number(p.IdPayment), Code: String(p.PaymentCode || ''), Provider: String(p.PaymentProvider || p.PaymentName || ''), Title: String(p.PaymentTitle || p.PaymentName || ''), Description: String(p.PaymentDescription || ''),
    Available: !(Number(p.AmountMin) > 0 && limited < Number(p.AmountMin)) && !(Number(p.AmountMax) > 0 && limited > Number(p.AmountMax)),
  })).filter((p: CheckoutPayment) => p.IdPayment > 0 && cart.Count > 0)
  return {
    Mode: site?.Preferences?.CheckoutMode === 'steps' ? 'steps' : 'onepage', TaxExcl: (await pricing(event)).wholesale,
    LastOrder: last?.Id || '', Pay: euros ? pay : { ...pay, Alma: null, Paypal: null }, GiftCards: giftCards, Customer: who, Address: address, Countries: countries, CountryIsoCode: iso, Cart: cart, Carriers: carriers, Payments: euros ? payments : payments.filter(p => !['Alma', 'Paypal'].includes(p.Provider)),
  }
}

export interface RelayPoint { Id: string, Name: string, Address: string, Postcode: string, City: string, Distance: number, Latitude: number, Longitude: number, Hours: { Day: string, Text: string }[] }

/** The opening hours of a relay point, whatever shape the carrier gave them: a list of {day, hours}. */
function hours(raw: any): { Day: string, Text: string }[] {
  const out: { Day: string, Text: string }[] = []
  const say = (value: any): string => Array.isArray(value) ? value.map(say).filter(Boolean).join(' / ') : (value && typeof value === 'object' ? Object.values(value).map(say).filter(Boolean).join(' – ') : String(value ?? '').trim())
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === 'object') { const [day, ...rest] = Object.values(item); const text = rest.map(say).filter(Boolean).join(' / '); if (day && text) { out.push({ Day: String(day), Text: text }) } }
    }
  } else if (raw && typeof raw === 'object') {
    for (const [day, value] of Object.entries(raw)) { const text = say(value); if (text) { out.push({ Day: day, Text: text }) } }
  }
  return out.slice(0, 7).map(line => ({ Day: line.Day.slice(0, 30), Text: line.Text.slice(0, 120) }))
}

/** The relay points of a carrier near the delivery address of the customer, or near the postcode and city the visitor typed. */
export async function readRelays(event: H3Event, lang: string, idCarrier: number, near: { postcode: string, city: string }): Promise<{ Points: RelayPoint[], Near: string }> {
  if (idCarrier <= 0) { return { Points: [], Near: '' } }
  const list = sessionToken(event) ? await addresses(event) : []
  const address = (list.find((a: any) => a.IsDelivery) || list[0]) as CheckoutAddress | undefined
  const postcode = text(near.postcode, 20) || address?.Postcode || '', city = text(near.city, 100) || address?.City || ''
  if (!postcode || !address) { return { Points: [], Near: '' } }
  const answer = await cartCall(event, 'GET', 'carrier/relayPoint', { LanguageIsoCode: lang.toUpperCase(), Address1: near.postcode ? '-' : address.Address1, Postcode: postcode, City: city || '-', Country: address.Country, CountryIsoCode: address.CountryIsoCode, IdCarrier: idCarrier, CarrierType: 'RelayPoint' })
  let raw: any[] = Array.isArray(answer?.RelayPoints) ? answer.RelayPoints : []
  // development on the machine where Digipart is installed: a test carrier has no provider, so sample points stand in (never on a real site)
  if (!raw.length && useRuntimeConfig(event).localApp && !answer?.Carrier?.Provider?.Name) {
    raw = [1, 2, 3].map(n => ({ Id: 'TEST' + n, Name: 'Point relais ' + n + ' (test)', Address1: (10 * n) + ' rue de test', Postcode: postcode, City: city, Location: { Latitude: 48.86 + n / 500, Longitude: 2.34 + n / 500, DistanceFromAddress: 350 * n }, OpeningHours: { Lundi: '09:00 – 19:00', Samedi: '09:00 – 13:00' } }))
  }
  const points: RelayPoint[] = raw.map((p: any) => ({
    Id: text(p.Id, 60), Name: text(p.Name, 120), Address: [p.Address1, p.Address2, p.Address3].map(v => text(v, 120)).filter(Boolean).join(', '), Postcode: text(p.Postcode, 20), City: text(p.City, 100),
    Distance: Math.round(Number(p.Location?.DistanceFromAddress) || 0), Latitude: Number(p.Location?.Latitude) || 0, Longitude: Number(p.Location?.Longitude) || 0, Hours: hours(p.OpeningHours),
  })).filter((p: RelayPoint) => p.Id && p.Name).slice(0, 30)
  return { Points: points, Near: [postcode, city].filter(Boolean).join(' ') }
}

/** The newest order of the customer (what the confirmation page shows once the payment made it), or null. */
export async function newestOrder(event: H3Event, lang: string): Promise<{ Id: string, Date: string, State: string, Total: number, Currency: string } | null> {
  if (!sessionToken(event)) { return null }
  const answer = await cartCall(event, 'GET', 'order/list', { Limit: 1, Offset: 0, CurrencyIsoCode: visitorCurrency(event), LanguageIsoCode: lang.toUpperCase() })
  const order = Array.isArray(answer?.Orders) ? answer.Orders[0] : null
  if (!order || !order.IdOrder) { return null }
  const total = order.Total || {}
  const toPay = Number(total.ToPay?.TaxIncl ?? (Number(total.Product?.TaxIncl || 0) + Number(total.Shipping?.TaxIncl || 0) - Number(total.Discount?.TaxIncl || 0)))
  return { Id: String(order.IdOrder), Date: String(order.DateAdd || ''), State: String(order.State?.Label || ''), Total: Math.round(toPay * 100) / 100, Currency: String(answer.Currency?.IsoCode || 'EUR') }
}

const NAME = /^[\p{L}\p{M}' .-]{1,60}$/u

/** What the visitor does on the order page. Returns '' or the reason it was refused; `code` 'login' = this e-mail has an account, the customer must log in. */
export async function changeCheckout(event: H3Event, body: any, lang: string): Promise<{ error: string, code?: string, relays?: any[] }> {
  const action = String(body?.Action || '')
  const id = cartId(event)
  if (action === 'logout') { signOut(event); return { error: '' } }
  if (action === 'login') { return { error: await signIn(event, body) } }
  if (!id) { return { error: 'Votre panier est vide.' } }
  if (action === 'contact') {
    const f = {
      Email: text(body?.Email, 150).toLowerCase(), Firstname: text(body?.Firstname, 60), Lastname: text(body?.Lastname, 60), Company: text(body?.Company, 100), Address1: text(body?.Address1, 150), Address2: text(body?.Address2, 150),
      Postcode: text(body?.Postcode, 20), City: text(body?.City, 100), CountryIsoCode: text(body?.CountryIsoCode, 2).toUpperCase(), MobilePhone: text(body?.MobilePhone, 30),
    }
    if (!NAME.test(f.Firstname) || !NAME.test(f.Lastname)) { return { error: 'Indiquez votre prénom et votre nom.' } }
    if (f.Address1.length < 3 || f.Postcode.length < 2 || f.City.length < 1 || !/^[A-Z]{2}$/.test(f.CountryIsoCode)) { return { error: 'Votre adresse est incomplète.' } }
    if (!/^\+?[0-9 ().-]{6,30}$/.test(f.MobilePhone)) { return { error: 'Indiquez un numéro de téléphone pour la livraison.' } }
    const countries = await cartCall(event, 'GET', 'country', { LanguageIsoCode: lang })
    if (!(countries?.ActiveCountries || []).some((c: any) => String(c.CountryIsoCode).toUpperCase() === f.CountryIsoCode)) { return { error: 'Nous ne livrons pas encore ce pays.' } }
    if (!sessionToken(event)) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.Email)) { return { error: 'Indiquez une adresse e-mail valable.' } }
      // an e-mail that already has an account must log in: Digipart would otherwise hand this visitor the account of someone else
      const free = await cartCall(event, 'POST', 'customer/email/available', { Email: f.Email })
      if (!free || free.status !== 'success') { return { error: 'Un compte existe déjà avec cette adresse e-mail : connectez-vous pour continuer.', code: 'login' } }
      const made = await cartCall(event, 'POST', 'customer', { Guest: 'true', ...f, LanguageIsoCode: lang.toUpperCase(), CurrencyIsoCode: visitorCurrency(event), IsInvoice: 'true', IsDelivery: 'true', IdCart: id })
      const token = String(made?.AuthData?.Token || '')
      if (!token) { return { error: 'Vos coordonnées n\'ont pas pu être enregistrées.' } }
      setSession(event, token)
      return { error: '' }
    }
    const { Email: _email, ...fields } = f
    const idAddress = Math.floor(Number(body?.IdAddress) || 0)
    const known = idAddress > 0 && (await addresses(event)).some(a => a.IdAddress === idAddress)
    const saved = known
      ? await cartCall(event, 'PUT', 'customer/address/update', { ...fields, IdAddress: idAddress, IsInvoice: 'true', IsDelivery: 'true' })
      : await cartCall(event, 'POST', 'customer/address/add', { ...fields, IsInvoice: 'true', IsDelivery: 'true' })
    if (!saved || saved.status === 'error') { return { error: 'Votre adresse n\'a pas pu être enregistrée.' } }
    if (known) { await cartCall(event, 'PUT', 'customer/address/type', { IdAddress: idAddress, IsDelivery: 'true', IsInvoice: 'true' }) }
    return { error: '' }
  }
  if (action === 'carrier') {
    const idCarrier = Math.floor(Number(body?.IdCarrier) || 0)
    const iso = text(body?.CountryIsoCode, 2).toUpperCase()
    if (idCarrier <= 0) { return { error: 'Choisissez un mode de livraison.' } }
    const relay = text(body?.IdRelayPoint, 60)
    if (relay && !/^[A-Za-z0-9_.:-]{1,60}$/.test(relay)) { return { error: 'Ce point relais n\'a pas pu être choisi.' } }
    const list = sessionToken(event) ? await addresses(event) : []
    const address = (list.find((a: any) => a.IsDelivery) || list[0]) as CheckoutAddress | undefined
    const answer = await cartCall(event, 'PUT', 'cart/carrier', { IdCart: id, IdCarrier: idCarrier, IdRelayPoint: relay, CarrierType: relay ? 'RelayPoint' : '', CountryIsoCode: address?.CountryIsoCode || (/^[A-Z]{2}$/.test(iso) ? iso : ''), IdAddress: address?.IdAddress || '', IdAddressInvoice: address?.IdAddress || '' })
    return { error: answer && answer.IdCart ? '' : 'Ce mode de livraison n\'a pas pu être choisi.' }
  }
  return { error: 'Action inconnue.' }
}
