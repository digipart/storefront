// « Réserver en boutique »: {IdStore, IdProduct, IdProductAttribute, Quantity, Firstname, Lastname, Email, MobilePhone, Website}. Digipart makes the reservation « À confirmer » for the shop
// (api/store/reservation/request, which checks the shop, the product, the size and takes the price itself). `Website` is a field no person fills: a robot that fills it is answered « done » and nothing is sent.
const clean = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max)

export default defineEventHandler(async (event) => {
  sameSiteOnly(event)
  const body = await readBody(event)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  if (String(body?.Website ?? '') !== '') { return { Done: true, Error: '' } }
  const id = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : 0 }
  const answer = await cartCall(event, 'POST', 'store/reservation/request', {
    IdStore: id(body?.IdStore), IdProduct: id(body?.IdProduct), IdProductAttribute: id(body?.IdProductAttribute), Quantity: id(body?.Quantity) || 1,
    Firstname: clean(body?.Firstname, 80), Lastname: clean(body?.Lastname, 80), Email: clean(body?.Email, 100), MobilePhone: clean(body?.MobilePhone, 20),
  })
  if (answer?.Success === true) { return { Done: true, Error: '' } }
  return { Done: false, Error: clean(answer?.message, 200) || 'La réservation n\'a pas pu être enregistrée, merci de réessayer.' }
})
