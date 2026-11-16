// The confirmation page asks for the order the payment just made: the newest order of the customer, once it is no longer `after` (the newest one the customer had before paying). `Order` is null
// while the payment has not reached Digipart yet (the order is made when the payment provider confirms, a few seconds later).
export default defineEventHandler(async (event) => {
  const { lang } = langOf(event)
  const after = String(getQuery(event).after ?? '')
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  await localNotify(event)   // development only: does nothing on a real site
  await confirmAlma(event, String(getQuery(event).pid ?? ''))   // back from Alma's payment page: Digipart checks the payment with Alma and makes the order
  const order = await newestOrder(event, lang)
  const made = order && order.Id !== after ? order : null
  if (made) { forgetPayment(event); forget(event) }   // the paid cart is gone: what was kept for this visitor is dropped
  return { Order: made }
})
