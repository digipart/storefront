// A visitor asks to be told when a size of a product is back in stock: {IdProduct, IdVariant, Email, Website}. Digipart's own API records the request and sends the e-mail that confirms it
// (api/campaign/backInStock, untouched: the one the other fronts of Digipart use). `Website` is a field no person fills: a robot that fills it is answered « done » and nothing is sent.
// Only a size of this product that is sold out can be asked for, and a visitor or an address asks a few times at most: the API sends an e-mail to the address it is given.
const hits = new Map<string, number[]>()
const allowed = (key: string, most: number, seconds: number) => {
  const now = Date.now(), list = (hits.get(key) || []).filter(at => now - at < seconds * 1000)
  if (list.length >= most) { hits.set(key, list); return false }
  list.push(now); hits.set(key, list)
  if (hits.size > 5000) { hits.delete(hits.keys().next().value as string) }
  return true
}

export default defineEventHandler(async (event) => {
  sameSiteOnly(event)
  const { lang, prefix } = langOf(event)
  const body = await readBody(event)
  const email = String(body?.Email ?? '').trim().slice(0, 150)
  const idProduct = Math.floor(Number(body?.IdProduct) || 0), idVariant = Math.floor(Number(body?.IdVariant) || 0)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { return { Done: false, Error: 'Indiquez une adresse e-mail valable.' } }
  if (idProduct < 1 || idVariant < 1) { return { Done: false, Error: 'Choisissez une taille.' } }
  if (String(body?.Website ?? '') !== '') { return { Done: true, Error: '' } }
  const ip = getRequestIP(event, { xForwardedFor: true }) || ''
  if (!allowed('ip:' + ip, 8, 600) || !allowed('mail:' + email.toLowerCase(), 6, 86400)) { return { Done: false, Error: 'Trop de demandes : merci de réessayer plus tard.' } }
  const product = await loadProduct(event, idProduct, lang, prefix)
  const variant = product?.Variants.find(v => v.Id === idVariant)
  if (!product || !variant) { return { Done: false, Error: 'Ce produit n\'est plus proposé.' } }
  if (variant.Available) { return { Done: false, Error: 'Cette taille est disponible : vous pouvez la commander.' } }
  const who = await profile(event)
  const origin = siteOrigin(event)
  const answer = await cartCall(event, 'POST', 'campaign/backInStock', { Email: email, IdProduct: idProduct, IdProductAttribute: idVariant, LanguageIsoCode: lang, ...(who?.Id ? { IdCustomer: who.Id } : {}) }, origin ? { Referer: origin + '/' } : {})
  const done = !!answer && answer.status === 'success'
  return { Done: done, Error: done ? '' : 'Votre demande n\'a pas pu être enregistrée, merci de réessayer.' }
})
