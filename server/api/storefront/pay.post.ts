// Alma: {Action: 'alma-plans'} then {Action: 'alma-create', IdPayment} (answers the address of Alma's payment page). Gift cards: {Action: 'gift-add', CardNumber, Pin} | {Action: 'gift-remove', Id} | {Action: 'release'}. PayPal: {Action: 'paypal-create', IdPayment} then {Action: 'paypal-capture', IdPayment, PaypalOrder}. The visitor pays: {IdPayment}, or {Free: true} for an order a discount covers entirely (the server checks there is nothing to pay). Prepares the card payment of the cart (the amount and the content of the order are read from the cart Digipart keeps, never from the browser) and answers the
// secret the payment form confirms with, or `Error`.
export default defineEventHandler(async (event) => {
  sameSiteOnly(event)
  const { lang, prefix } = langOf(event)
  const body = await readBody(event)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const action = String(body?.Action || '')
  // the gift cards pay the amount the cart shows: it is read first, for the country the page shows
  const shown = async () => (await readCart(event, lang, prefix, /^[A-Z]{2}$/.test(String(body?.CountryIsoCode || '')) ? String(body.CountryIsoCode) : '')).ToPay
  if (action === 'gift-add' || action === 'gift-remove') { await readGiftCards(event, await shown()); const error = await changeGiftCards(event, body); return { Error: error, GiftCards: await readGiftCards(event) } }
  if (action === 'release') { await releaseGiftCards(event); return { Error: '', GiftCards: await readGiftCards(event, await shown()) } }   // the bank payment was refused: the gift cards get their part back
  if (action === 'paypal-create') { const made = await startPaypal(event, body, lang); return { Error: made.error, PaypalOrder: made.paypalOrder || '', Amount: made.amount || 0 } }
  if (action === 'alma-plans') { return { Error: '', Plans: await almaPlans(event, await shown()) } }
  if (action === 'alma-create') { const made = await startAlma(event, body, lang, prefix); return { Error: made.error, Url: made.url || '' } }
  if (action === 'paypal-capture') { const done = await capturePaypal(event, body, lang); return { Error: done.error } }
  if (body?.Free === true) { const free = await startFree(event, lang); return { Error: free.error, Order: free.order || '', ClientSecret: '', Amount: 0, Currency: 'eur' } }
  const result = await startStripe(event, body, lang)
  return { Error: result.error, Order: result.order || '', ClientSecret: result.clientSecret || '', Amount: result.amount || 0, Currency: result.currency || 'eur' }
})
