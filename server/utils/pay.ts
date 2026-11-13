import type { H3Event } from 'h3'

// Paying an order. Digipart alone talks to the payment provider with its secret key (api/payment/stripe/intent, the API every front of Digipart uses, untouched). This server asks it for the visitor
// and, unlike a front that runs in the browser, it is this SERVER that says how much is to pay and what the order holds: both are read from the cart Digipart keeps, never from what the browser
// sends. The order itself is made by Digipart when the provider confirms the payment (its notification), a few seconds after the customer paid.
const COOKIE = 'sf_pay'   // the payment being prepared for this cart, so that a second try changes it instead of making another one

export interface PayConfig { Stripe: { PublicKey: string, TestMode: boolean } | null, Paypal: { ClientId: string, TestMode: boolean } | null }

/** What the page needs to show the payment forms: the public key of Stripe when the shop takes cards with it. */
export async function payConfig(event: H3Event): Promise<PayConfig> {
  const answer = await digipart(event, 'payment.php', {}).catch(() => null)
  const stripe = answer?.Stripe
  const paypal = answer?.Paypal
  return {
    Stripe: stripe?.Active && /^pk_(test|live)_[A-Za-z0-9]+$/.test(String(stripe.PublicKey || '')) ? { PublicKey: String(stripe.PublicKey), TestMode: !!stripe.TestMode } : null,
    // PayPal is offered only when Digipart holds the secret of the shop: every PayPal payment is then created and taken by Digipart, for the amount of the cart
    Paypal: paypal?.Active && /^[A-Za-z0-9_-]{20,200}$/.test(String(paypal.ClientId || '')) ? { ClientId: String(paypal.ClientId), TestMode: !!paypal.TestMode } : null,
  }
}

const cents = (amount: number) => Math.round(amount * 100)

// Gift cards as a means of payment (api/cart/giftcard of Digipart). A card is put on the cart with its number and its PIN; when the customer validates the payment each card is DEBITED of its
// part and the rest is paid by bank card; Digipart gives the debit back by itself when the payment does not come through.
export interface GiftCardState { Cards: { Id: number, Code: string, Balance: number, Used: number, Held: boolean }[], Covered: number, ToPay: number }
const GIFT_WORDS: Record<string, string> = {
  'invalid-card': 'Le numéro de carte ou le code PIN est incorrect.', 'locked': 'Cette carte est bloquée quelques minutes après plusieurs codes PIN incorrects.', 'not-usable': 'Cette carte cadeau ne peut pas être utilisée.',
  'currency': 'Cette carte cadeau est dans une autre devise.', 'channel': 'Cette carte cadeau ne peut pas être utilisée sur ce site.', 'already': 'Cette carte cadeau est déjà appliquée.',
  'too-many': 'Vous ne pouvez pas ajouter d\'autre carte cadeau.', 'cart-ordered': 'Cette commande est déjà enregistrée.',
}
function shapeGift(answer: any): GiftCardState | null {
  if (!answer || !Array.isArray(answer.GiftCards)) { return null }
  return {
    Cards: answer.GiftCards.map((c: any) => ({ Id: Number(c.IdCartGiftCard), Code: String(c.Code || ''), Balance: number(c.Balance), Used: number(c.Used), Held: !!c.Held })),
    Covered: number(answer.Covered?.TaxIncl), ToPay: number(answer.ToPay?.TaxIncl),
  }
}
// what the cart shows to pay (the cart API of Digipart): the gift cards pay that amount to the cent. Kept for the calls of the same request.
function amountShown(event: H3Event, shown?: number): Record<string, number> {
  if (typeof shown === 'number') { event.context.sfShown = shown }
  return typeof event.context.sfShown === 'number' ? { Amount: event.context.sfShown } : {}
}
/** The gift cards of the cart of this visit, or null (no cart, not identified yet, or a Digipart without gift card payment). */
export async function readGiftCards(event: H3Event, shown?: number): Promise<GiftCardState | null> {
  const id = cartId(event)
  if (!id || !sessionToken(event)) { return null }
  return shapeGift(await cartCall(event, 'GET', 'cart/giftcard', { IdCart: id, ...amountShown(event, shown) }))
}
/** Puts a gift card on the cart ({Action: 'gift-add', CardNumber, Pin}) or takes one off ({Action: 'gift-remove', Id}). Returns '' or the reason it was refused. */
export async function changeGiftCards(event: H3Event, body: any): Promise<string> {
  const id = cartId(event)
  if (!id) { return 'Votre panier est vide.' }
  if (!sessionToken(event)) { return 'Validez vos coordonnées avant d\'ajouter une carte cadeau.' }
  const answer = String(body?.Action) === 'gift-remove'
    ? await cartCall(event, 'DELETE', 'cart/giftcard', { IdCart: id, ...amountShown(event), IdCartGiftCard: Math.floor(Number(body?.Id) || 0) })
    : await cartCall(event, 'POST', 'cart/giftcard', { IdCart: id, ...amountShown(event), CardNumber: String(body?.CardNumber ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 40), Pin: String(body?.Pin ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12), CurrencyIsoCode: 'EUR' })
  if (answer && Array.isArray(answer.GiftCards)) { return '' }
  return GIFT_WORDS[String(answer?.Reason || '')] || 'Cette carte cadeau n\'a pas pu être prise en compte, merci de réessayer.'
}
/** The customer validates the payment: the gift cards are debited of their part. Answers what is left to pay another way, in cents (`null` = no gift card on this cart). */
async function holdGiftCards(event: H3Event, id: number, shown: number): Promise<{ left: number, covered: number } | null> {
  const answer = await cartCall(event, 'POST', 'cart/giftcard/hold', { IdCart: id, ...amountShown(event, shown) })
  if (!answer || !Array.isArray(answer.GiftCards) || !answer.GiftCards.length) { return null }
  return { left: cents(number(answer.ToPay?.TaxIncl)), covered: cents(number(answer.Held?.TaxIncl)) }
}
/** The payment did not come through: what the gift cards held is given back at once (Digipart would do it by itself an hour later). */
export async function releaseGiftCards(event: H3Event): Promise<void> {
  const id = cartId(event)
  if (id && sessionToken(event)) { await cartCall(event, 'POST', 'cart/giftcard/hold', { IdCart: id, Release: 1 }) }
}
const number = (value: unknown) => Number(value) || 0

/** Prepares the card payment of the cart with Stripe. Answers the secret the payment form of the browser confirms with, or the reason it was refused. */
export async function startStripe(event: H3Event, body: any, lang: string): Promise<{ error: string, clientSecret?: string, amount?: number, currency?: string, order?: string }> {
  const id = cartId(event)
  if (!id) { return { error: 'Votre panier est vide.' } }
  if (!sessionToken(event)) { return { error: 'Validez vos coordonnées avant de payer.' } }
  const config = await payConfig(event)
  if (!config.Stripe) { return { error: 'Le paiement par carte n\'est pas disponible pour le moment.' } }
  const [who, list] = await Promise.all([cartCall(event, 'GET', 'customer', {}), addresses(event)])
  const customer = who?.AuthData?.Customer
  const address = (list.find((a: any) => a.IsDelivery) || list[0]) as CheckoutAddress | undefined
  if (!customer?.Id || !address) { return { error: 'Validez vos coordonnées avant de payer.' } }
  const upper = lang.toUpperCase()
  const [raw, methods] = await Promise.all([
    cartCall(event, 'GET', 'cart', { IdCart: id, CurrencyIsoCode: 'EUR', CountryIsoCode: address.CountryIsoCode, LanguageIsoCode: upper }),
    cartCall(event, 'GET', 'payment/methods', { IdAddress: address.IdAddress, LanguageIsoCode: upper }),
  ])
  if (!raw || !raw.IdCart || raw.status === 'error' || Number(raw.IdCart) !== id) { return { error: 'Votre panier n\'a pas pu être lu, merci de réessayer.' } }
  const products: any[] = (Array.isArray(raw.Products) ? raw.Products : []).filter((line: any) => Number(line.IdProduct) > 0 && Number(line.Quantity) > 0)
  if (!products.length) { return { error: 'Votre panier est vide.' } }
  const carrier = raw.Shipping?.Carrier
  if (!Number(carrier?.IdCarrier)) { return { error: 'Choisissez un mode de livraison.' } }
  const toPay = number(raw.Total?.ToPay?.TaxIncl)
  // the method must be one of the country, run by Stripe, and allowed for this amount
  const idPayment = Math.floor(number(body?.IdPayment))
  const method = (Array.isArray(methods?.PaymentMethods) ? methods.PaymentMethods : []).find((p: any) => Number(p.IdPayment) === idPayment)
  if (!method || String(method.PaymentProvider || '') !== 'Stripe') { return { error: 'Ce moyen de paiement n\'est pas disponible.' } }
  if ((number(method.AmountMin) > 0 && toPay < number(method.AmountMin)) || (number(method.AmountMax) > 0 && toPay > number(method.AmountMax))) { return { error: 'Ce moyen de paiement n\'est pas disponible pour ce montant.' } }
  const lines = products.map((line: any) => {
    const regular = line.Price?.RegularPrice || {}, promo = line.Price?.PromotionalPrice || {}
    const price = number(promo.PriceTaxIncl) > 0 ? promo : regular
    return { Reference: String(line.Reference || ''), IdProduct: Number(line.IdProduct), Quantity: Number(line.Quantity), PriceTaxExcl: number(price.PriceTaxExcl), PriceTaxIncl: number(price.PriceTaxIncl), IdProductAttribute: Number(line.IdProductAttribute || 0) }
  })
  // a cart Digipart could not price is never sent to payment
  if (toPay <= 0 || lines.some(line => line.PriceTaxIncl <= 0)) { return { error: 'Le montant de votre commande n\'a pas pu être calculé, merci de réessayer.' } }
  const currency = String(raw.Currency?.IsoCode || 'EUR')
  // gift cards first: they are debited of their part now, the bank card pays what is left
  const gift = await holdGiftCards(event, id, toPay)
  const bank = gift ? gift.left : cents(toPay)
  if (gift && bank <= 0) { const done = await startFree(event, lang, gift); return { error: done.error, order: done.order } }
  const kept = getCookie(event, COOKIE) || ''
  const [keptCart, keptSecret] = kept.split(':')
  const intent = await cartCall(event, 'POST', 'payment/stripe/intent', {
    Amount: bank, CurrencyIsoCode: currency, PaymentMethodTypes: 'card', Email: String(customer.Email || ''), Firstname: address.Firstname, Lastname: address.Lastname, IdCart: id,
    IdCarrier: Number(carrier.IdCarrier), IdRelayPoint: String(carrier.IdRelayPoint || ''),
    ClientSecret: Number(keptCart) === id && /^pi_[A-Za-z0-9]+_secret_[A-Za-z0-9]+$/.test(keptSecret || '') ? keptSecret : '',
  })
  const clientSecret = String(intent?.ClientSecret || '')
  if (!/^pi_[A-Za-z0-9]+_secret_[A-Za-z0-9]+$/.test(clientSecret)) { if (gift) { await releaseGiftCards(event) } return { error: 'Le paiement n\'a pas pu être préparé, merci de réessayer.' } }
  const codes: any[] = Array.isArray(raw.Discounts?.PromoCodes) ? raw.Discounts.PromoCodes : []
  const kinds = [codes.length ? 'PromoCode' : '', raw.Discounts?.CartRules && (!Array.isArray(raw.Discounts.CartRules) || raw.Discounts.CartRules.length) ? 'CartRule' : ''].filter(Boolean).join(',')
  // what the order will hold, as the notification of the payment reads it: everything comes from the cart of Digipart
  const data = {
    IdCarrier: Number(carrier.IdCarrier), IdAddress: address.IdAddress, IdAddressInvoice: address.IdAddress,
    ConversionRate: number(raw.Currency?.ConversionRate) || 1, IdCurrency: Number(raw.Currency?.IdCurrency || 0) || undefined, CurrencyIsoCode: currency,
    ProductTaxRate: raw.Country?.TaxRate, ShippingTaxRate: raw.Country?.TaxRate,
    TotalPaidTaxExcl: number(raw.Total?.ToPay?.TaxExcl), TotalPaidTaxIncl: toPay,
    ShippingCostTaxExcl: number(carrier.Price?.TaxExcl), ShippingCostTaxIncl: number(carrier.Price?.TaxIncl),
    TotalDiscountTaxExcl: number(raw.Total?.Discount?.TaxExcl), TotalDiscountTaxIncl: number(raw.Total?.Discount?.TaxIncl),
    DiscountName: kinds, DiscountTypes: kinds, PromoCodes: codes.map((code: any) => String(code.Code || '')).filter(Boolean).join(','), UsesPromoCode: kinds !== '',
    TotalProductTaxExcl: number(raw.Total?.Product?.TaxExcl), TotalProductTaxIncl: number(raw.Total?.Product?.TaxIncl),
    IdCustomer: Number(customer.Id), IdCart: id, Cart: lines, IdPayment: idPayment, IdMarketPlace: Number(useRuntimeConfig(event).idMarketPlace),
    Email: String(customer.Email || ''), Firstname: address.Firstname, Lastname: address.Lastname,
  }
  const saved = await cartCall(event, 'POST', 'payment/stripe/data', { ClientSecret: clientSecret, Metadata: JSON.stringify(data) })
  if (!saved || saved.status !== 'success') { if (gift) { await releaseGiftCards(event) } return { error: 'Le paiement n\'a pas pu être préparé, merci de réessayer.' } }
  setCookie(event, COOKIE, id + ':' + clientSecret, { path: '/', httpOnly: true, sameSite: 'lax', secure: getRequestProtocol(event, { xForwardedProto: true }) === 'https', maxAge: 60 * 60 * 6 })
  return { error: '', clientSecret, amount: bank, currency: currency.toLowerCase() }
}

/** The payment of this visit is over (its order exists): the next cart gets a payment of its own. */
export function forgetPayment(event: H3Event) { if (getCookie(event, COOKIE)) { deleteCookie(event, COOKIE, { path: '/' }) } }

/**
 * Development on the machine where Digipart is installed, and only there: Stripe cannot reach that Digipart to say a payment succeeded, so the engine asks the local Digipart to check the payment
 * with Stripe and take the notification itself (dev/stripe-notify.php: test mode only). On a real site this does nothing: Stripe notifies Digipart directly.
 */
export async function localNotify(event: H3Event): Promise<void> {
  const config = useRuntimeConfig(event)
  const secret = (getCookie(event, COOKIE) || '').split(':')[1] || ''
  if (!config.localApp || config.digipartUrl || !/^pi_[A-Za-z0-9]+_secret_[A-Za-z0-9]+$/.test(secret)) { return }
  const answer = await digipart(event, 'stripe-notify.php', { ClientSecret: secret }).catch(() => null)
  if (answer?.Status === 'failed') { console.error('[pay] the local notification did not make the order (HTTP ' + answer.Http + '): ' + String(answer.Answer || '').slice(0, 300)) }
}

/**
 * An order with nothing left to pay (a promo code that covers everything): no payment provider, Digipart makes the order at once (api/payment/digipart/create, the API every front uses). This
 * server checks on the cart Digipart keeps that there really is nothing to pay: the browser cannot ask for a free order of a cart that has an amount.
 */
export async function startFree(event: H3Event, lang: string, held?: { left: number, covered: number }): Promise<{ error: string, order?: string }> {
  const id = cartId(event)
  if (!id) { return { error: 'Votre panier est vide.' } }
  if (!sessionToken(event)) { return { error: 'Validez vos coordonnées avant de payer.' } }
  const list = await addresses(event)
  const address = (list.find((a: any) => a.IsDelivery) || list[0]) as CheckoutAddress | undefined
  if (!address) { return { error: 'Validez vos coordonnées avant de payer.' } }
  const upper = lang.toUpperCase()
  const raw = await cartCall(event, 'GET', 'cart', { IdCart: id, CurrencyIsoCode: 'EUR', CountryIsoCode: address.CountryIsoCode, LanguageIsoCode: upper })
  if (!raw || !raw.IdCart || raw.status === 'error' || Number(raw.IdCart) !== id) { return { error: 'Votre panier n\'a pas pu être lu, merci de réessayer.' } }
  const products: any[] = (Array.isArray(raw.Products) ? raw.Products : []).filter((line: any) => Number(line.IdProduct) > 0 && Number(line.Quantity) > 0)
  if (!products.length) { return { error: 'Votre panier est vide.' } }
  const carrier = raw.Shipping?.Carrier
  if (!Number(carrier?.IdCarrier)) { return { error: 'Choisissez un mode de livraison.' } }
  // nothing left to pay only when a discount really covers everything, or when the gift cards of the cart do (they are debited now)
  if (!(number(raw.Total?.Product?.TaxIncl) > 0) || !raw.Total?.ToPay) { return { error: 'Le montant de votre commande n\'a pas pu être calculé, merci de réessayer.' } }
  const due = cents(number(raw.Total.ToPay.TaxIncl))
  const gift = due > 0 ? (held || await holdGiftCards(event, id, due / 100)) : null   // `held`: the cards were debited a moment ago by the bank payment that found nothing left to pay
  if (due > 0 && (!gift || gift.left > 0)) { if (gift) { await releaseGiftCards(event) } return { error: 'Cette commande n\'est pas gratuite : choisissez un moyen de paiement.' } }
  if (due <= 0 && !(number(raw.Total?.Discount?.TaxIncl) > 0)) { return { error: 'Cette commande n\'est pas gratuite : choisissez un moyen de paiement.' } }
  const made = await cartCall(event, 'POST', 'payment/digipart/create', {
    IdCart: id, CurrencyIsoCode: String(raw.Currency?.IsoCode || 'EUR'), TotalToPayTaxIncl: 0, LanguageIsoCode: upper, IdAddress: address.IdAddress, IdAddressInvoice: address.IdAddress,
    IdCarrier: Number(carrier.IdCarrier), IdRelayPoint: String(carrier.IdRelayPoint || ''),
  })
  if (!made?.IdOrder) { if (gift) { await releaseGiftCards(event) } return { error: 'Votre commande n\'a pas pu être enregistrée, merci de réessayer.' } }
  forgetPayment(event)
  return { error: '', order: String(made.IdOrder) }
}

// PayPal. The button of PayPal runs in the browser, but the PayPal order is made and its money taken by Digipart, from the cart (api/payment/paypal/order and capture): the browser only
// carries the id of the PayPal order between the two. The order of the shop is made by PayPal's notification to Digipart, as for a card.
const PAYPAL_WORDS: Record<string, string> = {
  'paypal-off': 'Le paiement PayPal n\'est pas disponible pour le moment.', 'nothing-to-pay': 'Il ne reste rien à payer avec PayPal.', 'cart-ordered': 'Cette commande est déjà enregistrée.',
  'paypal-amount': 'Le montant de votre commande a changé : vérifiez-le, puis payez à nouveau.', 'paypal-not-paid': 'PayPal n\'a pas accepté ce paiement.',
}
async function paypalReady(event: H3Event, body: any, lang: string): Promise<{ error: string, id: number, toPay: number }> {
  const none = { id: 0, toPay: 0 }
  const id = cartId(event)
  if (!id) { return { error: 'Votre panier est vide.', ...none } }
  if (!sessionToken(event)) { return { error: 'Validez vos coordonnées avant de payer.', ...none } }
  if (!(await payConfig(event)).Paypal) { return { error: PAYPAL_WORDS['paypal-off']!, ...none } }
  const list = await addresses(event)
  const address = (list.find((a: any) => a.IsDelivery) || list[0]) as CheckoutAddress | undefined
  if (!address) { return { error: 'Validez vos coordonnées avant de payer.', ...none } }
  const upper = lang.toUpperCase()
  const [raw, methods] = await Promise.all([
    cartCall(event, 'GET', 'cart', { IdCart: id, CurrencyIsoCode: 'EUR', CountryIsoCode: address.CountryIsoCode, LanguageIsoCode: upper }),
    cartCall(event, 'GET', 'payment/methods', { IdAddress: address.IdAddress, LanguageIsoCode: upper }),
  ])
  if (!raw || !raw.IdCart || raw.status === 'error' || Number(raw.IdCart) !== id) { return { error: 'Votre panier n\'a pas pu être lu, merci de réessayer.', ...none } }
  if (!Number(raw.Shipping?.Carrier?.IdCarrier)) { return { error: 'Choisissez un mode de livraison.', ...none } }
  const toPay = number(raw.Total?.ToPay?.TaxIncl)
  const method = (Array.isArray(methods?.PaymentMethods) ? methods.PaymentMethods : []).find((p: any) => Number(p.IdPayment) === Math.floor(number(body?.IdPayment)))
  if (!method || String(method.PaymentProvider || '') !== 'Paypal') { return { error: 'Ce moyen de paiement n\'est pas disponible.', ...none } }
  if ((number(method.AmountMin) > 0 && toPay < number(method.AmountMin)) || (number(method.AmountMax) > 0 && toPay > number(method.AmountMax))) { return { error: 'Ce moyen de paiement n\'est pas disponible pour ce montant.', ...none } }
  if (toPay <= 0) { return { error: 'Le montant de votre commande n\'a pas pu être calculé, merci de réessayer.', ...none } }
  return { error: '', id, toPay }
}
/** The customer clicked the PayPal button: Digipart makes the PayPal order of the cart (its gift cards are debited of their part now). Answers the id PayPal's window needs. */
export async function startPaypal(event: H3Event, body: any, lang: string): Promise<{ error: string, paypalOrder?: string, amount?: number }> {
  const ready = await paypalReady(event, body, lang)
  if (ready.error) { return { error: ready.error } }
  const answer = await cartCall(event, 'POST', 'payment/paypal/order', { IdCart: ready.id, Amount: ready.toPay, CurrencyIsoCode: 'EUR' })
  const paypalOrder = String(answer?.IdPaypalOrder || '')
  if (!/^[A-Za-z0-9-]{8,40}$/.test(paypalOrder)) { return { error: PAYPAL_WORDS[String(answer?.Reason || '')] || 'Le paiement n\'a pas pu être préparé, merci de réessayer.' } }
  return { error: '', paypalOrder, amount: cents(number(answer.ToPay?.TaxIncl)) }
}
/** The customer approved the payment at PayPal: Digipart checks it is the one of this cart, for its amount, and takes the money. */
export async function capturePaypal(event: H3Event, body: any, lang: string): Promise<{ error: string }> {
  const ready = await paypalReady(event, body, lang)
  if (ready.error) { return { error: ready.error } }
  const paypalOrder = String(body?.PaypalOrder || '')
  if (!/^[A-Za-z0-9-]{8,40}$/.test(paypalOrder)) { return { error: 'Le paiement n\'a pas pu être préparé, merci de réessayer.' } }
  const answer = await cartCall(event, 'POST', 'payment/paypal/capture', { IdCart: ready.id, IdPaypalOrder: paypalOrder, Amount: ready.toPay, CurrencyIsoCode: 'EUR' })
  if (answer?.Status !== 'paid') { await releaseGiftCards(event); return { error: PAYPAL_WORDS[String(answer?.Reason || '')] || 'Votre paiement PayPal n\'a pas abouti, merci de réessayer.' } }
  // development on the machine where Digipart is installed: PayPal cannot reach it, the local Digipart is handed the notification (dev/paypal-notify.php; it checks the payment with PayPal itself)
  const config = useRuntimeConfig(event)
  if (config.localApp && !config.digipartUrl && /^[A-Za-z0-9-]{8,40}$/.test(String(answer.IdCapture || ''))) {
    const told = await digipart(event, 'paypal-notify.php', { IdCapture: String(answer.IdCapture), IdCart: ready.id }).catch(() => null)
    if (told?.Status !== 'done') { console.error('[pay] the local PayPal notification did not make the order (HTTP ' + told?.Http + '): ' + String(told?.Answer || '').slice(0, 300)) }
  }
  return { error: '' }
}
