// What the visitor does to the cart: {Action: 'add' | 'update' | 'remove' | 'code' | 'uncode', IdProduct, IdProductAttribute, Quantity, Code, IdPromoCode}. Answers the cart after it, and `Error` when Digipart
// refused. Only the pages of this site may call it (a form of another site cannot fill the cart of a visitor).
export default defineEventHandler(async (event) => {
  sameSiteOnly(event)
  const { lang, prefix } = langOf(event)
  const error = await changeCart(event, await readBody(event))
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  return { ...(await readCart(event, lang, prefix)), Error: error }
})
