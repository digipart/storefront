import type { H3Event } from 'h3'

// The cart of the visitor. It lives in Digipart (api/cart: the cart APIs every front of Digipart uses, untouched); this server only keeps WHICH cart is the visitor's, in a cookie the scripts of the page
// cannot read (`sf_cart`). The browser never talks to Digipart: it asks this server (server/api/storefront/cart.*), which asks Digipart for the sales channel of the site.
const COOKIE = 'sf_cart'

export interface CartLine { Variants: { Id: number, Label: string, Available: boolean }[], IdProduct: number, IdProductAttribute: number, Name: string, Variant: string, Reference: string, Image: string, Url: string, Quantity: number, Max: number, Price: number, Total: number }
export interface CartCode { Id: number, Code: string, Title: string, Amount: number, FreeDelivery: boolean }
export interface ShopCart { TaxExcl: boolean, FreeFrom: number | null, Relay: { Name: string, Address: string } | null, IdCarrier: number, IdRelayPoint: string, CarrierTitle: string, ProductsTaxExcl: number, ToPayTaxExcl: number, Count: number, Currency: string, Lines: CartLine[], Codes: CartCode[], Products: number, Discount: number, Shipping: number, ToPay: number }

export const emptyCart = (): ShopCart => ({ TaxExcl: false, FreeFrom: null, Relay: null, IdCarrier: 0, IdRelayPoint: '', CarrierTitle: '', ProductsTaxExcl: 0, ToPayTaxExcl: 0, Count: 0, Currency: 'EUR', Lines: [], Codes: [], Products: 0, Discount: 0, Shipping: 0, ToPay: 0 })

function base(event: H3Event): string {
  const config = useRuntimeConfig(event)
  return String(config.digipartUrl || config.localUrl || '').replace(/\/+$/, '')
}

/** The cart of this visit (0 = none yet). */
/** The visitor has no cart any more (it was merged into the cart of the customer who just logged in, or ordered). */
export function setCartId(event: H3Event, id: number) { if (id > 0) { keep(event, id) } }

export function cartId(event: H3Event): number {
  if (event.context.sfCart) { return Number(event.context.sfCart) }   // the cart made or replaced during this very request
  const value = getCookie(event, COOKIE) || ''
  return /^\d{1,12}$/.test(value) ? Number(value) : 0
}

function keep(event: H3Event, id: number) {
  if (id > 0 && id !== cartId(event)) {
    event.context.sfCart = id
    setCookie(event, COOKIE, String(id), { path: '/', httpOnly: true, sameSite: 'lax', secure: getRequestProtocol(event, { xForwardedProto: true }) === 'https', maxAge: 60 * 60 * 24 * 30 })
  }
}

/** One call to a cart API of Digipart (form fields, as these APIs read them). The answer is its JSON, `null` when Digipart did not answer. */
export async function cartCall(event: H3Event, method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, fields: Record<string, string | number>, extraHeaders: Record<string, string> = {}): Promise<any> {
  const root = base(event)
  if (!root) { return null }
  const full: Record<string, string> = { IdMarketPlace: String(useRuntimeConfig(event).idMarketPlace) }
  for (const [name, value] of Object.entries(fields)) { if (value !== '' && value !== undefined && value !== null) { full[name] = String(value) } }
  // the customer of this visit (server/utils/session.ts): Digipart then knows whose cart, addresses and prices these are
  const token = sessionToken(event)
  const headers: Record<string, string> = { ...extraHeaders, ...(token ? { Authorization: 'Bearer ' + token } : {}) }
  if (method !== 'GET') { headers['Content-Type'] = 'application/x-www-form-urlencoded'; forget(event) }   // this visitor changes something: what was kept for them is dropped (server/utils/visitor.ts)
  try {
    const raw = await $fetch<string>(root + '/api/' + path, {
      method, responseType: 'text', retry: 0, timeout: 15000, ignoreResponseError: true, headers,
      ...(method === 'GET' ? { query: full } : { body: new URLSearchParams(full).toString() }),
    })
    const start = raw.lastIndexOf('\n{') >= 0 && raw.trimStart()[0] !== '{' ? raw.lastIndexOf('\n{') + 1 : raw.search(/[[{]/)   // a development server may print a notice before its JSON
    return start >= 0 ? JSON.parse(raw.slice(start)) : null
  } catch { return null }
}

/** The cart as the theme draws it. `create` = make one when the visitor has none (only when something is added: a visitor who only looks never gets a cart). */
export async function readCart(event: H3Event, lang: string, prefix: string, country = 'FR'): Promise<ShopCart> {
  const id = cartId(event)
  if (!id) { return emptyCart() }
  // the cart, how prices are shown to this visitor and the free delivery step of the country are asked at the same time
  const [raw, policy, freeAsked] = await Promise.all([
    cartCall(event, 'GET', 'cart', { IdCart: id, CurrencyIsoCode: 'EUR', CountryIsoCode: country, LanguageIsoCode: lang.toUpperCase() }),
    pricing(event),   // a professional site shows its prices without tax
    digipart(event, 'shipping.php', { CountryIsoCode: country }).catch(() => null),
  ])
  if (!raw || !raw.IdCart || raw.status === 'error') { return emptyCart() }
  keep(event, Number(raw.IdCart))   // an ordered cart is replaced by a new one by Digipart
  const tax = policy.wholesale ? 'PriceTaxExcl' : 'PriceTaxIncl'
  let lines: CartLine[] = (Array.isArray(raw.Products) ? raw.Products : []).map((line: any) => {
    const variants = Array.isArray(line.Variant) ? line.Variant : []
    const chosen = variants.find((v: any) => v?.Selected) || null
    const label = (chosen?.Combination?.Attributes || []).map((a: any) => String(a.AttributeName || '')).filter(Boolean).join(' / ')
    const regular = Number(line.Price?.RegularPrice?.[tax] || 0), promo = Number(line.Price?.PromotionalPrice?.[tax] || 0)
    const price = promo > 0 && promo < regular ? promo : regular
    const image = String(line.Media?.Images?.product_xsmall?.[0]?.Src || '')
    const seo = Array.isArray(line.SEO) ? line.SEO[0] : line.SEO
    const slug = String(seo?.URL || '').replace(/^\/+|\/+$/g, '') || 'produit'
    const quantity = Number(line.Quantity || 0)
    const options = variants.map((v: any) => ({ Id: Number(v?.Combination?.IdProductAttribute || 0), Label: (v?.Combination?.Attributes || []).map((a: any) => String(a.AttributeName || '')).filter(Boolean).join(' / '), Available: !!v?.Available || !!v?.Selected })).filter((v: any) => v.Id > 0 && v.Label)
    return {
      Variants: options, IdProduct: Number(line.IdProduct), IdProductAttribute: Number(line.IdProductAttribute || 0), Name: String(line.Description?.Title || line.Reference || ''), Variant: label, Reference: String(line.Reference || ''),
      Image: /^https?:\/\//.test(image) ? image : '', Url: prefix + '/p/' + slug + '-' + Number(line.IdProduct), Quantity: quantity, Max: Math.max(quantity, Math.min(20, Number(chosen?.Quantity ?? 20) || 20)),
      Price: price, Total: Math.round(price * quantity * 100) / 100,
    }
  }).filter((line: CartLine) => line.IdProduct > 0 && line.Quantity > 0)
  // a line Digipart could not price (a development server): the price of its product is read on its own
  lines = await Promise.all(lines.map(async (line) => {
    if (line.Price > 0) { return line }
    const product = await loadProduct(event, line.IdProduct, lang, prefix).catch(() => null)
    return product && product.Price > 0 ? { ...line, Price: product.Price, Total: Math.round(product.Price * line.Quantity * 100) / 100, Image: line.Image || product.Images[0] || '' } : line
  }))
  const codes: CartCode[] = (raw.Discounts?.PromoCodes || []).map((code: any) => ({ Id: Number(code.IdPromoCode), Code: String(code.Code || ''), Title: String(code.Title || ''), Amount: Number(code.Reduction?.Value?.TaxIncl || 0), FreeDelivery: !!code.FreeDelivery }))
  const carrier = raw.Shipping?.Carrier || null
  const point = carrier?.IdRelayPoint ? { ...(carrier.RelayPoint || {}), Name: carrier.RelayPoint?.Name || 'Point relais ' + carrier.IdRelayPoint } : null   // a carrier that cannot describe its point still has one chosen
  // from which amount the delivery to the country of the cart is free (api/storefront/shipping.php), for the « livraison offerte dans X € » bar
  const cartCountry = String(raw.Country?.CountryIsoCode || country).toUpperCase()
  const free = cartCountry === country.toUpperCase() ? freeAsked : await digipart(event, 'shipping.php', { CountryIsoCode: cartCountry }).catch(() => null)
  return {
    TaxExcl: policy.wholesale, FreeFrom: typeof free?.FreeShippingFrom === 'number' ? free.FreeShippingFrom : null, Relay: point ? { Name: String(point.Name), Address: [point.Address1, [point.Postcode, point.City].filter(Boolean).join(' ')].filter(Boolean).join(', ') } : null,
    IdCarrier: Number(carrier?.IdCarrier || 0), IdRelayPoint: String(carrier?.IdRelayPoint || ''), CarrierTitle: String(carrier?.Title || carrier?.Name || ''),
    ProductsTaxExcl: Number(raw.Total?.Product?.TaxExcl || 0), ToPayTaxExcl: Number(raw.Total?.ToPay?.TaxExcl || 0),
    Count: lines.reduce((sum, line) => sum + line.Quantity, 0), Currency: String(raw.Currency?.IsoCode || 'EUR'), Lines: lines, Codes: codes,
    Products: Number(raw.Total?.Product?.TaxIncl || 0), Discount: Number(raw.Total?.Discount?.TaxIncl || 0), Shipping: Number(raw.Total?.Shipping?.TaxIncl || 0), ToPay: Number(raw.Total?.ToPay?.TaxIncl || 0),
  }
}

/** What the visitor does to the cart. Returns '' or the reason it was refused (said to the visitor). */
export async function changeCart(event: H3Event, body: any): Promise<string> {
  const action = String(body?.Action || '')
  const idProduct = Math.floor(Number(body?.IdProduct) || 0), idVariant = Math.floor(Number(body?.IdProductAttribute) || 0)
  const quantity = Math.max(1, Math.min(20, Math.floor(Number(body?.Quantity) || 1)))
  const id = cartId(event)
  if (action === 'add' || action === 'add-many') {
    // on a professional site only an activated professional customer buys
    const policy = await pricing(event)
    if (policy.wholesale && policy.state !== 'ok') { return policy.state === 'pending' ? 'Votre compte professionnel est en cours de validation.' : 'Connectez-vous avec un compte professionnel pour commander.' }
  }
  if (action === 'add-many') {   // several sizes of one product at once (buying by lot)
    const items = (Array.isArray(body?.Items) ? body.Items : []).map((item: any) => ({ variant: Math.floor(Number(item?.IdProductAttribute) || 0), quantity: Math.max(0, Math.min(500, Math.floor(Number(item?.Quantity) || 0))) })).filter((item: any) => item.variant > 0 && item.quantity > 0).slice(0, 40)
    if (idProduct <= 0 || !items.length) { return 'Choisissez au moins une quantité.' }
    let failed = 0
    for (const item of items) {
      const answer = await cartCall(event, 'POST', 'cart/product/add', { IdCart: cartId(event) || '', IdProduct: idProduct, IdProductAttribute: item.variant, Quantity: item.quantity })
      if (answer && answer.IdCart) { keep(event, Number(answer.IdCart)) } else { failed++ }
    }
    return failed === items.length ? 'Ces articles n\'ont pas pu être ajoutés au panier.' : failed ? 'Certaines tailles n\'ont pas pu être ajoutées au panier.' : ''
  }
  if (action === 'add') {
    if (idProduct <= 0) { return 'Ce produit ne peut pas être ajouté.' }
    // an e-gift card: who receives it, the message and the day it is sent (Digipart makes the card with the line: api/cart/product/add, ProductType e-giftcard)
    const gift = body?.Gift && typeof body.Gift === 'object' ? body.Gift : null
    let giftFields: Record<string, string> = {}
    if (gift) {
      const clean = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max)
      const email = clean(gift.Email, 150), date = /^\d{4}-\d{2}-\d{2}$/.test(String(gift.DateSend)) ? String(gift.DateSend) : new Date().toISOString().slice(0, 10)
      if (gift.Personal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { return 'Indiquez l\'adresse e-mail du destinataire.' }
      giftFields = { ProductType: 'e-giftcard', Email: gift.Personal ? email : '', MobilePhone: gift.Personal ? clean(gift.MobilePhone, 25) : '', Firstname: gift.Personal ? clean(gift.Firstname, 80) : '', Lastname: gift.Personal ? clean(gift.Lastname, 80) : '',
        Message: gift.Personal ? String(gift.Message ?? '').replace(/\r\n/g, '\n').trim().slice(0, 300) : '', DateSend: date, LanguageIsoCode: langOf(event).lang, IP: getRequestIP(event, { xForwardedFor: true }) || '' }
    }
    const answer = await cartCall(event, 'POST', 'cart/product/add', { IdCart: id || '', IdProduct: idProduct, IdProductAttribute: idVariant, Quantity: gift ? 1 : quantity, ...giftFields })
    if (!answer || !answer.IdCart) { return answer?.status === 'error' ? 'Ce produit ne peut pas être ajouté au panier.' : 'Le panier ne répond pas, merci de réessayer.' }
    keep(event, Number(answer.IdCart))
    return ''
  }
  if (!id) { return 'Votre panier est vide.' }
  if (action === 'update' || action === 'remove') {
    if (idProduct <= 0) { return 'Article inconnu.' }
    const answer = action === 'update'
      ? await cartCall(event, 'PUT', 'cart/product/update', { IdCart: id, IdProduct: idProduct, IdProductAttribute: idVariant, Quantity: quantity, NewIdProductAttribute: Math.floor(Number(body?.NewIdProductAttribute) || 0) || '' })
      : await cartCall(event, 'DELETE', 'cart/product/delete', { IdCart: id, IdProduct: idProduct, IdProductAttribute: idVariant, Quantity: Math.max(1, Math.floor(Number(body?.Quantity) || 1)) })
    return answer && answer.IdCart ? '' : 'Le panier n\'a pas pu être modifié.'
  }
  if (action === 'code') {
    const code = String(body?.Code || '').trim()
    if (!/^[\p{L}\p{N}_ .-]{2,60}$/u.test(code)) { return 'Ce code n\'est pas valable.' }
    const answer = await cartCall(event, 'POST', 'cart/promocode/add', { IdCart: id, PromoCode: code })
    if (answer && answer.status !== 'error' && !answer.error) { return '' }
    const said = String(answer?.message || '')
    return /^(Le panier|Ajoutez)/.test(said) ? said : 'Ce code n\'est pas valable pour ce panier.'   // the sentences Digipart writes for the customer are kept, the technical ones are not shown
  }
  if (action === 'uncode') {
    const idCode = Math.floor(Number(body?.IdPromoCode) || 0)
    if (idCode <= 0) { return 'Code inconnu.' }
    await cartCall(event, 'DELETE', 'cart/promocode/delete', { IdCart: id, IdPromoCode: idCode })
    return ''
  }
  return 'Action inconnue.'
}
