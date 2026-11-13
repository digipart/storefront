// The express payment (Apple Pay, Google Pay) of the order page: {Action: 'rates', CountryIsoCode, IdCarrier?} = the home delivery methods of the country and what the cart costs with the chosen
// one; {Action: 'confirm', Email, Name, Phone, Address, IdCarrier} = saves the customer and the address the wallet gave and prepares the card payment. See server/utils/express.ts.
export default defineEventHandler(async (event) => {
  sameSiteOnly(event)
  const { lang, prefix } = langOf(event)
  const body = await readBody(event)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  if (String(body?.Action) === 'confirm') {
    const done = await expressConfirm(event, body, lang, prefix)
    return { Error: done.error, Code: done.code || '', ClientSecret: done.clientSecret || '', Amount: done.amount || 0 }
  }
  const rates = await expressRates(event, lang, prefix, String(body?.CountryIsoCode ?? '').toUpperCase().slice(0, 2), Math.floor(Number(body?.IdCarrier) || 0), body?.Passive === true)
  return { Error: rates.error, Rates: rates.rates, Amount: rates.amount, Currency: rates.currency }
})
