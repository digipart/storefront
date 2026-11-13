// The confirmation page asks for the order the payment just made: the newest order of the customer, once it is no longer `after` (the newest one the customer had before paying). `Order` is null
// while the payment has not reached Digipart yet (the order is made when the payment provider confirms, a few seconds later).
export default defineEventHandler(async (event) => {
  const { lang } = langOf(event)
  const after = Math.floor(Number(getQuery(event).after) || 0)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const order = await newestOrder(event, lang)
  return { Order: order && order.Id !== after ? order : null }
})
