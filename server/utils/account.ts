import type { H3Event } from 'h3'

// The customer account and the favourites, on the APIs every front of Digipart uses (untouched). This server holds what identifies the visitor — the customer token, the cart, the list of favourites —
// in cookies the scripts of the page cannot read, and never lets the browser choose them: Digipart does not check who owns a list of favourites or a cart, so the number must not come from the page.
// Links that carry a login token (the invoice links, the loyalty auto-login link) are never passed to the browser.
const FAV = 'sf_fav'
const clean = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NAME = /^[\p{L}\p{M}' .-]{1,60}$/u
const yes = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true'

export function favId(event: H3Event): number {
  if (event.context.sfFav !== undefined) { return Number(event.context.sfFav) }
  const value = getCookie(event, FAV) || ''
  return /^\d{1,12}$/.test(value) ? Number(value) : 0
}
function keepFav(event: H3Event, id: number) {
  event.context.sfFav = id
  if (id > 0) { setCookie(event, FAV, String(id), { path: '/', httpOnly: true, sameSite: 'lax', secure: getRequestProtocol(event, { xForwardedProto: true }) === 'https', maxAge: 60 * 60 * 24 * 90 }) } else { deleteCookie(event, FAV, { path: '/' }) }
}

/** What Digipart answered to a login or a sign-up: the token is kept, and the cart and favourites of the customer become those of the visit. */
function enter(event: H3Event, auth: any): boolean {
  const token = String(auth?.Token || '')
  if (!token) { return false }
  event.context.sfProfile = undefined   // who the visitor is changes: asked again
  setSession(event, token)
  if (Number(auth.Customer?.IdCart) > 0) { setCartId(event, Number(auth.Customer.IdCart)) }
  if (Number(auth.Customer?.IdFavorite) > 0) { keepFav(event, Number(auth.Customer.IdFavorite)) }
  return true
}

/** Google / Facebook login (Digipart: api/storefront/social-login.php, module « Connexion sociale »): the provider's secret stays in Digipart. */
async function socialCall(event: H3Event, fields: Record<string, string>): Promise<any> {
  const config = useRuntimeConfig(event), root = String(config.digipartUrl || config.localUrl || '').replace(/\/+$/, '')
  if (!root || !config.clientId || !config.clientSecret) { return null }
  try {
    return await $fetch<any>(root + '/api/storefront/social-login.php', { method: 'POST', retry: 0, timeout: 20000, ignoreResponseError: true, responseType: 'json',
      headers: { 'X-Client-Id': String(config.clientId), 'X-Client-Secret': String(config.clientSecret), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ IdMarketPlace: String(config.idMarketPlace), ...fields }).toString() })
  } catch { return null }
}
export const socialRedirect = (event: H3Event, provider: string) => siteOrigin(event) + '/account/social/' + provider + '/callback'
/** Where the visitor logs in at the provider ('' when it is not set up). */
export async function socialStart(event: H3Event, provider: string, state: string): Promise<string> {
  const answer = await socialCall(event, { Action: 'start', Provider: provider, RedirectUri: socialRedirect(event, provider), State: state })
  return typeof answer?.Url === 'string' && /^https:\/\//.test(answer.Url) ? answer.Url : ''
}
export async function socialFinish(event: H3Event, provider: string, code: string, lang: string): Promise<boolean> {
  const answer = await socialCall(event, { Action: 'finish', Provider: provider, Code: code, RedirectUri: socialRedirect(event, provider), IdCart: String(cartId(event) || ''), IdFavorite: String(favId(event) || ''), LanguageIsoCode: lang })
  if (!enter(event, answer?.AuthData)) { return false }
  setLoggedIn(event, true)
  return true
}

export async function signIn(event: H3Event, body: any): Promise<string> {
  const email = clean(body?.Email, 150), password = String(body?.Password ?? '')
  if (!EMAIL.test(email) || password === '' || password.length > 200) { return 'E-mail ou mot de passe incorrect.' }
  const answer = await cartCall(event, 'POST', 'authentification/email', { Email: email, Password: password, IdCart: cartId(event) || '', IdFavorite: favId(event) || '' })
  if (!enter(event, answer?.AuthData)) { return 'E-mail ou mot de passe incorrect.' }
  setLoggedIn(event, true)   // the password was given: logged in, even on a row Digipart still marks as guest
  return ''
}

/**
 * The link « Se connecter à sa place » of a customer page of Digipart (`/account/autologin?token=…&email=…`): a member of the shop sees the site as that customer does. Digipart made the token
 * for this one link and checks it (api/customer/autologin). Whoever was logged in on this browser is logged out first: nothing of that visit (its cart, its favourites) goes to the customer.
 */
export async function autoLogin(event: H3Event, email: string, token: string): Promise<boolean> {
  email = clean(email, 150)
  if (!EMAIL.test(email) || token.length < 10 || token.length > 200 || /[\u0000-\u001f]/.test(token)) { return false }
  signOut(event)
  const answer = await cartCall(event, 'POST', 'customer/autologin', { Email: email, Token: token })
  const entered = enter(event, answer?.AuthData)
  if (entered) { setLoggedIn(event, true) }
  return entered
}

export function signOut(event: H3Event) { setLoggedIn(event, false); event.context.sfProfile = undefined; setSession(event, ''); keepFav(event, 0); setCartId(event, 0); deleteCookie(event, 'sf_cart', { path: '/' }); event.context.sfCart = 0 }

/** The profile of the logged-in customer, or null. */
export function profile(event: H3Event): Promise<any | null> {
  // asked once per request, however many parts of the answer need it
  event.context.sfProfile = event.context.sfProfile || readProfile(event)
  return event.context.sfProfile
}
async function readProfile(event: H3Event): Promise<any | null> {
  if (!sessionToken(event)) { return null }
  const answer = await cartCall(event, 'GET', 'customer', {})
  const found = answer?.AuthData?.Customer
  if (!found || !found.Id) { if (answer) { setSession(event, '') } return null }   // a Digipart that did not answer drops nothing
  if (Number(found.IdFavorite) > 0 && !favId(event)) { keepFav(event, Number(found.IdFavorite)) }
  return {
    Id: Number(found.Id) || 0, Email: String(found.Email || ''), Firstname: String(found.Firstname || ''), Lastname: String(found.Lastname || ''), Birthday: String(found.Birthday || ''), Phone: String(found.Phone || ''),
    LanguageIsoCode: String(found.LanguageIsoCode || ''), CurrencyIsoCode: String(found.CurrencyIsoCode || 'EUR'), Guest: yes(found.Guest) && !loggedIn(event), Newsletter: yes(found.NewsletterSubscribe), Loyalty: yes(found.LoyaltySubscribe), Business: found.Type === 'business', Active: yes(found.Active), Company: String(found.Company?.CompanyName || found.Company?.Name || (typeof found.Company === 'string' ? found.Company : '') || ''),
  }
}

export async function changeAccount(event: H3Event, body: any, lang: string, origin: string): Promise<{ error: string, note?: string }> {
  const action = String(body?.Action || '')
  if (action === 'login') { return { error: await signIn(event, body) } }
  if (action === 'logout') { signOut(event); return { error: '' } }
  if (action === 'register') {
    const f = { Email: clean(body?.Email, 150).toLowerCase(), Firstname: clean(body?.Firstname, 60), Lastname: clean(body?.Lastname, 60) }
    const password = String(body?.Password ?? '')
    if (!EMAIL.test(f.Email)) { return { error: 'Indiquez une adresse e-mail valable.' } }
    if (!NAME.test(f.Firstname) || !NAME.test(f.Lastname)) { return { error: 'Indiquez votre prénom et votre nom.' } }
    if (password.length < 8 || password.length > 200) { return { error: 'Choisissez un mot de passe d\'au moins 8 caractères.' } }
    // asked first: Digipart would attach this visitor's cart and favourites to the existing account before refusing
    const free = await cartCall(event, 'POST', 'customer/email/available', { Email: f.Email })
    if (!free || free.status !== 'success') { return { error: 'Un compte existe déjà avec cette adresse e-mail. Connectez-vous, ou utilisez « Mot de passe oublié ».' } }
    // a professional account (asked by the page of a professional site): the company, then the shop activates it. `Active` is never sent: Digipart leaves a professional account off until the shop checks it.
    let business: Record<string, string> = {}
    if (body?.Business) {
      const company = clean(body?.CompanyName, 100), number = clean(body?.CompanyNumber, 40).replace(/\s+/g, ''), tax = clean(body?.TaxNumber, 40).replace(/\s+/g, ''), phone = clean(body?.Phone, 30)
      if (company.length < 2) { return { error: 'Indiquez le nom de votre société.' } }
      if (!/^[A-Za-z0-9]{5,20}$/.test(number)) { return { error: 'Indiquez le numéro d\'immatriculation de votre société (SIRET).' } }
      if (tax && !/^[A-Za-z0-9]{4,20}$/.test(tax)) { return { error: 'Ce numéro de TVA n\'est pas valable.' } }
      if (!/^\+?[0-9 ().-]{6,30}$/.test(phone)) { return { error: 'Indiquez un numéro de téléphone.' } }
      business = { Type: 'business', CompanyName: company, CompanyNumber: number, ...(tax ? { TaxNumber: tax } : {}), MobilePhone: phone, IsMainContact: 'true' }
    }
    const made = await cartCall(event, 'POST', 'customer', { ...f, ...business, Password: password, LanguageIsoCode: lang.toUpperCase(), CurrencyIsoCode: 'EUR', IdCart: cartId(event) || '', IdFavorite: favId(event) || '', ...(body?.Newsletter ? { NewsletterSubscribe: '1' } : {}), ...(body?.Loyalty && !body?.Business ? { LoyaltySubscribe: 'true' } : {}) })
    if (!enter(event, made?.AuthData)) { return { error: 'Votre compte n\'a pas pu être créé.' } }
    setLoggedIn(event, true)
    return { error: '', note: body?.Business ? 'Votre demande de compte professionnel est enregistrée. Notre équipe l\'active dans les plus brefs délais ; vous verrez alors les prix.' : '' }
  }
  if (action === 'forgot') {
    const email = clean(body?.Email, 150)
    // the language in LOWER case for this script: Digipart uses it as it comes for the folder of the e-mail (templates/mail/fr/), for its subject and in the link of the e-mail
    // (<site>/fr/reset). In upper case the folder does not exist on the server (it does on a Mac, whose disk ignores the case): no e-mail left, and nothing said so.
    if (EMAIL.test(email)) { await cartCall(event, 'POST', 'customer/password/forget', { Email: email, LanguageIsoCode: lang.toLowerCase(), RootOrigin: origin.replace(/\/+$/, '') + '/' }) }
    return { error: '', note: 'Si un compte existe avec cette adresse, un e-mail vient de vous être envoyé pour choisir un nouveau mot de passe.' }   // the same words whether the account exists or not
  }
  if (action === 'reset') {
    const email = clean(body?.Email, 150), token = String(body?.Token ?? '').trim(), password = String(body?.Password ?? '')
    // the token of Digipart is 30 printable characters, punctuation included (« ! », « $ »...)
    if (!EMAIL.test(email) || !/^[\x21-\x7e]{10,200}$/.test(token)) { return { error: 'Ce lien n\'est plus valable : demandez-en un nouveau.' } }
    if (password.length < 8 || password.length > 200) { return { error: 'Choisissez un mot de passe d\'au moins 8 caractères.' } }
    const answer = await cartCall(event, 'POST', 'customer/password/reset', { Email: email, Token: token, Password: password })
    if (answer?.Status !== 'success') { return { error: 'Ce lien n\'est plus valable : demandez-en un nouveau.' } }
    return { error: await signIn(event, { Email: email, Password: password }), note: 'Votre mot de passe est changé.' }
  }
  if (action === 'fav') {   // add or remove a favourite: works for a visitor who is not logged in too
    const idProduct = Math.floor(Number(body?.IdProduct) || 0)
    if (idProduct <= 0) { return { error: 'Produit inconnu.' } }
    let id = favId(event)
    if (!id && sessionToken(event)) { await profile(event); id = favId(event) }
    if (body?.On === false) {
      if (id) { await cartCall(event, 'DELETE', 'favorite/delete', { IdFavorite: id, IdProduct: idProduct }) }
      return { error: '' }
    }
    const answer = await cartCall(event, 'POST', 'favorite/add', { IdFavorite: id || '', IdProduct: idProduct })
    if (!answer || !answer.IdFavorite) { return { error: 'Ce produit n\'a pas pu être ajouté à vos favoris.' } }
    if (!id) { keepFav(event, Number(answer.IdFavorite)) }
    return { error: '' }
  }
  const who = await profile(event)
  if (!who) { return { error: 'Connectez-vous pour continuer.' } }
  if (action === 'profile') {
    const f = { Firstname: clean(body?.Firstname, 60), Lastname: clean(body?.Lastname, 60), MobilePhone: clean(body?.Phone, 30), Birthday: clean(body?.Birthday, 10) }
    if (!NAME.test(f.Firstname) || !NAME.test(f.Lastname)) { return { error: 'Indiquez votre prénom et votre nom.' } }
    if (f.MobilePhone && !/^\+?[0-9 ().-]{6,30}$/.test(f.MobilePhone)) { return { error: 'Ce numéro de téléphone n\'est pas valable.' } }
    if (f.Birthday && !/^\d{4}-\d{2}-\d{2}$/.test(f.Birthday)) { return { error: 'Cette date de naissance n\'est pas valable.' } }
    // the language and the currency are sent back as they are: Digipart resets them when they are left out
    const saved = await cartCall(event, 'PUT', 'customer', { ...f, LanguageIsoCode: who.LanguageIsoCode || lang.toUpperCase(), CurrencyIsoCode: who.CurrencyIsoCode || 'EUR' })
    return { error: saved && saved.IdCustomer ? '' : 'Votre profil n\'a pas pu être enregistré.', note: 'Votre profil est enregistré.' }
  }
  if (action === 'address' || action === 'address-delete' || action === 'address-default') {
    const mine = await readAddresses(event)
    const idAddress = Math.floor(Number(body?.IdAddress) || 0)
    const known = idAddress > 0 && mine.some(address => address.IdAddress === idAddress)   // Digipart is only ever asked about an address of this customer
    if (action !== 'address' && !known) { return { error: 'Cette adresse est introuvable.' } }
    // deleting is not offered: Digipart keeps a deleted address in the list it answers (finding A236), so the customer would still see it
    if (action === 'address-delete') { return { error: 'Cette adresse ne peut pas être supprimée pour le moment.' } }
    if (action === 'address-default') {
      await cartCall(event, 'PUT', 'customer/address/type', { IdAddress: idAddress, IsDelivery: 'true', IsInvoice: 'true' })
      return { error: '', note: 'C\'est maintenant votre adresse par défaut.' }
    }
    const f = { Alias: clean(body?.Alias, 40), Firstname: clean(body?.Firstname, 60), Lastname: clean(body?.Lastname, 60), Company: clean(body?.Company, 100), Address1: clean(body?.Address1, 150), Address2: clean(body?.Address2, 150), Postcode: clean(body?.Postcode, 20), City: clean(body?.City, 100), CountryIsoCode: clean(body?.CountryIsoCode, 2).toUpperCase(), MobilePhone: clean(body?.MobilePhone, 30) }
    if (!NAME.test(f.Firstname) || !NAME.test(f.Lastname)) { return { error: 'Indiquez votre prénom et votre nom.' } }
    if (f.Address1.length < 3 || f.Postcode.length < 2 || f.City.length < 1 || !/^[A-Z]{2}$/.test(f.CountryIsoCode)) { return { error: 'Votre adresse est incomplète.' } }
    if (!/^\+?[0-9 ().-]{6,30}$/.test(f.MobilePhone)) { return { error: 'Indiquez un numéro de téléphone pour la livraison.' } }
    const countries = await cartCall(event, 'GET', 'country', { LanguageIsoCode: lang })
    if (!(countries?.ActiveCountries || []).some((c: any) => String(c.CountryIsoCode).toUpperCase() === f.CountryIsoCode)) { return { error: 'Nous ne livrons pas encore ce pays.' } }
    const first = mine.length === 0
    const saved = idAddress > 0
      ? (known ? await cartCall(event, 'PUT', 'customer/address/update', { ...f, IdAddress: idAddress, IsDelivery: String(mine.find(x => x.IdAddress === idAddress)!.IsDelivery), IsInvoice: String(mine.find(x => x.IdAddress === idAddress)!.IsInvoice) }) : null)
      : await cartCall(event, 'POST', 'customer/address/add', { ...f, IsDelivery: 'true', IsInvoice: 'true' })
    if (!saved || saved.status === 'error') { return { error: 'Votre adresse n\'a pas pu être enregistrée.' } }
    // adding an address makes it the default one in Digipart: the one the customer had stays the default unless this is the first
    const before = mine.find(address => address.IsDelivery)
    if (!idAddress && !first && before && !body?.Default) { await cartCall(event, 'PUT', 'customer/address/type', { IdAddress: before.IdAddress, IsDelivery: 'true', IsInvoice: 'true' }) }
    return { error: '', note: 'Votre adresse est enregistrée.' }
  }
  if (action === 'newsletter') {
    const answer = body?.On === false
      ? await cartCall(event, 'POST', 'newsletter/unsubscribe', { Email: who.Email })
      : await cartCall(event, 'POST', 'newsletter/subscribe', { Email: who.Email, LanguageIsoCode: lang.toUpperCase(), CurrencyIsoCode: 'EUR' })
    return { error: answer?.Status ? '' : 'Votre choix n\'a pas pu être enregistré.' }
  }
  return { error: 'Action inconnue.' }
}

export async function readAddresses(event: H3Event): Promise<any[]> {
  const list = await cartCall(event, 'GET', 'customer/address', {})
  return (Array.isArray(list) ? list : []).map((x: any) => ({
    IdAddress: Number(x.IdAddress), Alias: String(x.Alias || ''), Firstname: String(x.Firstname || ''), Lastname: String(x.Lastname || ''), Company: String(x.Company || ''), Address1: String(x.Address1 || ''), Address2: String(x.Address2 || ''),
    Postcode: String(x.Postcode || ''), City: String(x.City || ''), Country: String(x.Country || ''), CountryIsoCode: String(x.CountryIsoCode || '').toUpperCase(), MobilePhone: String(x.MobilePhone || x.Phone || ''), IsDelivery: yes(x.IsDelivery), IsInvoice: yes(x.IsInvoice),
  })).filter((x: any) => x.IdAddress > 0)
}

const picture = (media: any): string => { const images = media?.Images || {}; const src = String((images.product_small || images.product_medium || images.product_xsmall || [])[0]?.Src || ''); return /^https?:\/\//.test(src) ? src : '' }
const slugOf = (seo: any): string => String((Array.isArray(seo) ? seo[0] : seo)?.URL || '').replace(/^\/+|\/+$/g, '') || 'produit'
const amount = (value: any): number => Math.round(Number(value || 0) * 100) / 100

/** The favourites of the visitor (logged in or not). */
/** Only the ids of the favourite products (the hearts of the product cards and the counter of the header): one light call, asked beside the profile when the list is already known. */
export async function favoriteIds(event: H3Event, lang: string): Promise<number[]> {
  let id = favId(event)
  if (!id && sessionToken(event)) { await profile(event); id = favId(event) }
  if (!id) { return [] }
  const answer = await cartCall(event, 'GET', 'favorite', { IdFavorite: id, CurrencyIsoCode: 'EUR', LanguageIsoCode: lang.toUpperCase(), ResponseLevel: 'summary' })
  return (Array.isArray(answer?.Products) ? answer.Products : []).map((p: any) => Number(p.IdProduct)).filter((n: number) => n > 0)
}

export async function readFavorites(event: H3Event, lang: string, prefix: string): Promise<{ Ids: number[], Products: any[] }> {
  let id = favId(event)
  if (!id && sessionToken(event)) { await profile(event); id = favId(event) }
  if (!id) { return { Ids: [], Products: [] } }
  const answer = await cartCall(event, 'GET', 'favorite', { IdFavorite: id, CurrencyIsoCode: 'EUR', LanguageIsoCode: lang.toUpperCase(), ResponseLevel: 'complete' })
  const products = (Array.isArray(answer?.Products) ? answer.Products : []).map((p: any) => {
    const regular = Number(p.Price?.RegularPrice?.PriceTaxIncl || 0), promo = Number(p.Price?.PromotionalPrice?.PriceTaxIncl || 0), sale = promo > 0 && promo < regular
    return { Id: Number(p.IdProduct), Name: String(p.Description?.Title || p.Reference || ''), Reference: String(p.Reference || ''), Image: picture(p.Media), Url: prefix + '/p/' + slugOf(p.SEO) + '-' + Number(p.IdProduct), Price: sale ? promo : regular, PriceOld: sale ? regular : 0, Currency: String(p.Price?.Currency?.CurrencyIsoCode || 'EUR'), TaxExcl: false, PriceState: 'ok' }
  }).filter((p: any) => p.Id > 0)
  // a development server cannot describe the products of the list (name, price, picture): each one is then read on its own
  const policy = await pricing(event)
  const full = await Promise.all(products.map(async (p: any) => {
    if (!policy.wholesale && p.Price > 0 && p.Name !== p.Reference) { return p }   // on a professional site every product is read again: its price depends on who looks
    const read = await loadProduct(event, p.Id, lang, prefix).catch(() => null)
    return read ? { Id: read.Id, Name: read.Name, Reference: read.Reference, Image: read.Images[0] || '', Url: read.Url, Price: read.Price, PriceOld: read.PriceOld, Currency: read.Currency, TaxExcl: read.TaxExcl, PriceState: read.PriceState } : (policy.wholesale ? { ...p, Price: 0, PriceOld: 0, TaxExcl: true, PriceState: policy.state === 'ok' ? 'login' : policy.state } : p)
  }))
  return { Ids: full.map((p: any) => p.Id), Products: full }
}

/**
 * Whether an order can be returned, as Digipart says (the return settings of the shop and the state of the order: `OrderReturn` of the order API), and the way to the return portal of the shop:
 * its address with the e-mail of the customer and the number of the order, which is how the portal opens on that order without asking them again. Made here, for the logged-in customer only.
 */
function returnOf(event: H3Event, order: any, email: string) {
  const state = order?.OrderReturn || {}
  const available = state.Available === true || state.Available === 1
  const portal = String(useRuntimeConfig(event).returnPortalUrl || '').trim()
  const url = available && /^https:\/\//.test(portal) && email && order?.IdOrder ? portal + (portal.includes('?') ? '&' : '?') + 'email=' + encodeURIComponent(email) + '&id_order=' + encodeURIComponent(String(order.IdOrder)) : ''
  return { Available: available, Until: available ? String(state.MaxDate || '') : '', Url: url }
}

export async function readOrders(event: H3Event, lang: string, page: number, email = '', size = 10) {
  const answer = await cartCall(event, 'GET', 'order/list', { Limit: size, Offset: (Math.max(1, page) - 1) * size, CurrencyIsoCode: 'EUR', LanguageIsoCode: lang.toUpperCase() })
  const orders = (Array.isArray(answer?.Orders) ? answer.Orders : []).map((o: any) => ({
    Id: String(o.IdOrder), Date: String(o.DateAdd || ''), State: String(o.State?.Label || ''), Total: amount(o.Total?.Paid?.TaxIncl ?? (Number(o.Total?.Product?.TaxIncl || 0) + Number(o.Total?.Shipping?.TaxIncl || 0) - Number(o.Total?.Discount?.TaxIncl || 0))),
    Return: returnOf(event, o, email), Images: (Array.isArray(o.Products) ? o.Products : []).map((p: any) => picture(p.Media)).filter(Boolean).slice(0, 4), Count: Array.isArray(o.Products) ? o.Products.length : 0,
  })).filter((o: any) => o.Id !== '' && o.Id !== 'undefined' && o.Id !== 'null')   // a number, or the code of the shop and a number (« SHOP-12 »)
  const total = Number(answer?.TotalOrders || orders.length)
  return { Orders: orders, Total: total, Page: Math.max(1, page), Pages: Math.max(1, Math.ceil(total / size)), Currency: String(answer?.Currency?.IsoCode || 'EUR') }
}

export async function readOrder(event: H3Event, lang: string, prefix: string, idOrder: string, email = '') {
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(idOrder)) { return null }   // a number, or the code of the shop and a number
  const o = await cartCall(event, 'GET', 'order/detail', { IdOrder: idOrder, CurrencyIsoCode: 'EUR', LanguageIsoCode: lang.toUpperCase() })
  if (!o || !o.IdOrder || o.status === 'error') { return null }   // not this customer's order, or no such order
  const where = (a: any) => (a && (a.Address1 || a.City) ? { Name: [a.Firstname, a.Lastname].filter(Boolean).join(' '), Company: String(a.Company || ''), Line: [a.Address1, a.Address2].filter(Boolean).join(', '), City: [a.Postcode, a.City].filter(Boolean).join(' '), Country: String(a.Country || '') } : null)
  const tracking = String(o.Shipping?.Tracking?.URL || '')
  return {
    Id: String(o.IdOrder), Date: String(o.DateAdd || ''), State: String(o.State?.Label || ''), Currency: String(o.Currency?.IsoCode || 'EUR'),
    Lines: (Array.isArray(o.Products) ? o.Products : []).map((p: any) => {
      const attributes = p.Variant?.Combination?.Attributes || p.Variant?.Attributes || []
      return { Name: String(p.Title || p.Reference || ''), Reference: String(p.Reference || ''), Variant: (Array.isArray(attributes) ? attributes : []).map((a: any) => String(a.AttributeName || '')).filter(Boolean).join(' / '), Quantity: Number(p.Quantity || 0), Total: amount(Number(p.Price?.Paid?.TaxIncl || 0)), Image: picture(p.Media), Url: prefix + '/p/' + slugOf(p.SEO) + '-' + Number(p.IdProduct) }
    }),
    Products: amount(o.Total?.Product?.TaxIncl), Shipping: amount(o.Total?.Shipping?.TaxIncl), Discount: amount(o.Total?.Discount?.TaxIncl), Paid: amount(o.Total?.Paid?.TaxIncl),
    Payment: String(o.Payment?.Name || ''), Carrier: String(o.Carrier?.Title || o.Carrier?.Name || ''), TrackingNumber: String(o.Shipping?.Tracking?.Number || ''), TrackingUrl: /^https:\/\//.test(tracking) ? tracking : '',
    Return: returnOf(event, o, email), DeliveryAddress: where(o.Shipping?.Address), InvoiceAddress: where(o.Invoice?.Address),
  }
}

export async function readLoyalty(event: H3Event, lang: string) {
  const upper = lang.toUpperCase()
  const [me, tiers, history] = await Promise.all([cartCall(event, 'GET', 'loyalty/customer', { LanguageIsoCode: upper }), cartCall(event, 'GET', 'loyalty/tier/list', { LanguageIsoCode: upper }), cartCall(event, 'GET', 'loyalty/history', { LanguageIsoCode: upper })])
  if (!me || !me.LoyaltyProgram || me.status === 'error') { return null }
  const points = Number(me.TotalPoints || 0), earned = Number(me.TotalCumulatePoints ?? points)
  const list = (Array.isArray(tiers) ? tiers : (tiers?.LoyaltyProgramTiers || tiers?.Tiers || [])) as any[]
  const steps = list.map((t: any) => ({ Name: String(t.LoyaltyProgramTierName || t.Name || ''), From: Number(t.LoyaltyProgramTierFromTotalPoint ?? t.FromTotalPoint ?? 0) })).filter(t => t.Name).sort((a, b) => a.From - b.From)
  const next = steps.find(t => t.From > earned) || null
  const barcode = String(me.LoyaltyProgram.Card?.Media?.Image?.Src || '')
  return {
    Program: String(me.LoyaltyProgram.Name || ''), Points: points, Tier: String(me.LoyaltyProgram.Tier?.Name || ''), Next: next ? { Name: next.Name, At: next.From, Missing: Math.max(0, next.From - earned), Done: Math.min(100, Math.round((earned * 100) / next.From)) } : null,
    RewardMissing: Number(me.TotalMissingPoint || 0), CardNumber: String(me.LoyaltyProgram.Card?.Number || ''), Barcode: /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(barcode) ? barcode : '',
    History: (Array.isArray(history?.LoyaltyEvents) ? history.LoyaltyEvents : []).slice(0, 30).map((e: any) => ({ Label: String(e.Message || e.Name || ''), Points: Number(e.Points || 0), Date: String(e.Date || ''), Sign: String(e.TransactionType?.Code || '') })),
  }
}
