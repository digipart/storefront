import type { H3Event } from 'h3'

// The rest of the customer account: following a parcel, the rewards of the loyalty programme, the customer service and the referral. Everything goes through the APIs every front of Digipart
// uses (untouched). Several of them check little themselves (which order, which reward, which product): this server checks before asking, with what it can read as the customer.
const clean = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]+/g, ' ').trim().slice(0, max)
const plain = (value: unknown, max: number) => clean(String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' '), max)   // texts typed in the back-office may hold HTML: only their words are kept
const number = (value: unknown) => Number(value) || 0
const picture = (media: any): string => { const images = media?.Images || {}; const src = String((images.product_medium || images.product_large || images.product_xsmall || [])[0]?.Src || ''); return /^https?:\/\//.test(src) ? src : '' }
const upper = (lang: string) => lang.toUpperCase()

/** Where a parcel is: the carrier, the tracking number, its page at the carrier and the steps the carrier gives. Only for an order of THIS customer (the tracking API does not check it itself). */
export async function readTracking(event: H3Event, lang: string, prefix: string, idOrder: string) {
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(idOrder)) { return null }
  // the order must be this customer's: read as the customer (null when it is not theirs), else found among the customer's own orders
  const order = await readOrder(event, lang, prefix, idOrder).catch(() => null)
  if (!order && !(await readOrders(event, lang, 1, '', 50).catch(() => null))?.Orders.some((o: any) => o.Id === idOrder)) { return null }
  const answer = await cartCall(event, 'GET', 'order/tracking', { IdOrder: idOrder, LanguageIsoCode: lang })
  const url = clean(answer?.Tracking?.URL, 500)
  return {
    Carrier: clean(answer?.Carrier?.Name || order?.Carrier, 80), Number: clean(answer?.Tracking?.Number || order?.TrackingNumber, 80), Url: /^https:\/\//.test(url) ? url : (order?.TrackingUrl || ''),
    Events: (Array.isArray(answer?.Events) ? answer.Events : []).slice(0, 60).map((e: any) => ({ Date: clean(e?.Date, 40), Label: plain(e?.Label, 200), Place: [e?.Site?.Name, e?.Site?.Postcode].map(v => clean(v, 80)).filter(Boolean).join(' ') })).filter((e: any) => e.Label),
  }
}

/** The loyalty programme of the customer (its id is needed by the reward APIs), or null when the customer is not a member. */
async function program(event: H3Event, lang: string): Promise<{ id: number, points: number } | null> {
  const me = await cartCall(event, 'GET', 'loyalty/customer', { LanguageIsoCode: upper(lang) })
  const id = Math.floor(number(me?.LoyaltyProgram?.IdLoyaltyProgram))
  return id > 0 ? { id, points: Math.floor(number(me.TotalPoints)) } : null
}

/** The rewards the points buy (the catalogue of the shop) and the ones the customer already has, each with its code to use on an order. */
export async function readRewards(event: H3Event, lang: string) {
  const mine = await program(event, lang)
  if (!mine) { return { Member: false, Points: 0, Catalogue: [], Mine: [] } }
  const [catalogue, owned] = await Promise.all([
    cartCall(event, 'GET', 'loyalty/reward', { IdLoyaltyProgram: mine.id, CurrencyIsoCode: 'EUR', LanguageIsoCode: upper(lang) }),
    cartCall(event, 'GET', 'loyalty/reward/0/customerReward', { IdLoyaltyProgram: mine.id, CurrencyIsoCode: 'EUR', LanguageIsoCode: upper(lang) }),
  ])
  const states = ['available', 'used', 'expired']
  return {
    Member: true, Points: mine.points,
    Catalogue: (Array.isArray(catalogue?.LoyaltyRewards) ? catalogue.LoyaltyRewards : []).map((r: any) => ({
      Id: Math.floor(number(r.IdLoyaltyReward)), Points: Math.floor(number(r.Points)), Title: plain(r.Title, 120), Description: plain(r.Description, 400), Value: number(r.Value?.TaxIncl),
      Missing: Math.max(0, Math.floor(number(r.Points)) - mine.points),
    })).filter((r: any) => r.Id > 0 && r.Points > 0).sort((a: any, b: any) => a.Points - b.Points),
    Mine: (Array.isArray(owned?.LoyaltyRewards) ? owned.LoyaltyRewards : []).map((r: any) => ({
      Title: plain(r.Title, 120), Code: clean(r.Type?.Code, 60), Expires: clean(r.Type?.ExpiryDate, 20), State: states.includes(String(r.State?.Label)) ? String(r.State.Label) : 'expired', Value: number(r.Value?.TaxIncl),
    })).filter((r: any) => r.Code),
  }
}

/** The customer spends points on a reward: Digipart makes its promo code. The reward must be one of the catalogue, and the customer must have the points (the API checks neither). */
export async function obtainReward(event: H3Event, lang: string, idReward: number): Promise<{ error: string, code?: string }> {
  const rewards = await readRewards(event, lang)
  if (!rewards.Member) { return { error: 'Rejoignez d\'abord le programme de fidélité.' } }
  const reward = rewards.Catalogue.find((r: any) => r.Id === idReward)
  if (!reward) { return { error: 'Cette récompense n\'est plus proposée.' } }
  if (reward.Missing > 0) { return { error: 'Il vous manque des points pour cette récompense.' } }
  const mine = await program(event, lang)
  const answer = await cartCall(event, 'POST', 'loyalty/reward/0/obtain', { IdLoyaltyProgram: mine!.id, IdLoyaltyReward: idReward, LanguageIsoCode: upper(lang) })
  const code = clean(answer?.Type?.Code, 60)
  return code ? { error: '', code } : { error: 'Cette récompense n\'a pas pu être obtenue, merci de réessayer.' }
}

/** Joining the loyalty programme (the birthday is asked by the programme) or leaving it. */
export async function changeLoyalty(event: H3Event, lang: string, body: any): Promise<string> {
  if (body?.Action === 'loyalty-leave') {
    const left = await cartCall(event, 'POST', 'loyalty/unsubscribe', { LanguageIsoCode: lang })
    return left && String(left.Status) === 'success' ? '' : 'Votre demande n\'a pas pu être enregistrée, merci de réessayer.'
  }
  const birthday = clean(body?.Birthday, 10)
  const born = /^\d{4}-\d{2}-\d{2}$/.test(birthday) ? new Date(birthday + 'T00:00:00Z') : null
  if (!born || Number.isNaN(born.getTime()) || born.getTime() > Date.now() - 13 * 365.25 * 86400000 || born.getUTCFullYear() < 1900) { return 'Indiquez votre date de naissance.' }
  const joined = await cartCall(event, 'POST', 'loyalty/subscribe', { LanguageIsoCode: upper(lang), CustomerBirthday: birthday })
  return joined && String(joined.Status) === 'success' ? '' : 'Votre adhésion n\'a pas pu être enregistrée, merci de réessayer.'
}

/** The link that adds the loyalty card to Google Wallet, or '' (no card set up in Digipart, or not a member). */
export async function readWallet(event: H3Event): Promise<string> {
  const answer = await cartCall(event, 'GET', 'loyalty/wallet/google', {})
  const link = clean(answer?.Link, 2000)
  return /^https:\/\/pay\.google\.com\//.test(link) ? link : ''
}

const TICKET_STATES: Record<string, string> = { Opened: 'open', InProcess: 'progress', Closed: 'closed' }
const bought = async (event: H3Event, lang: string, limit: number) => {
  const answer = await cartCall(event, 'GET', 'order/lastBoughtProducts', { Offset: 0, Limit: limit, LanguageIsoCode: upper(lang) })
  return (Array.isArray(answer) ? answer : []).map((p: any) => ({
    IdOrder: clean(p.IdOrder, 40), IdProductAttribute: Math.floor(number(p.IdProductAttribute)), Name: plain(p.Description?.Title || p.Reference, 150), Reference: clean(p.Reference, 60), Date: clean(p.DateAdd, 10), Image: picture(p.Media),
  })).filter((p: any) => p.IdOrder && p.IdProductAttribute > 0)
}

/** The customer service: the last products bought (a request is about one of them) and the requests already made. */
export async function readService(event: H3Event, lang: string) {
  const [products, tickets] = await Promise.all([bought(event, lang, 8).catch(() => []), cartCall(event, 'GET', 'tickets', { LanguageIsoCode: upper(lang) })])
  return {
    Products: products,
    Tickets: (Array.isArray(tickets) ? tickets : []).slice(0, 50).map((t: any) => ({
      Id: Math.floor(number(t.IdTicket)), Title: plain(t.Title, 150), Date: clean(t.DateAdd, 10), State: TICKET_STATES[String(t.Status)] || 'open', Product: plain(t.Product?.Description?.Title || t.Product?.Reference, 150), Image: picture(t.Product?.Media),
      Last: plain(t.LastMessage?.Message, 200), LastByShop: t.LastMessage?.SentByMember === true,
    })).filter((t: any) => t.Id > 0),
  }
}

/** One request and its messages (Digipart checks it is the customer's). */
export async function readTicket(event: H3Event, lang: string, idTicket: number) {
  if (idTicket <= 0) { return null }
  const t = await cartCall(event, 'GET', 'ticket', { IdTicket: idTicket, LanguageIsoCode: upper(lang) })
  if (!t || t.status === 'error' || (!t.IdOrder && !Array.isArray(t.Messages))) { return null }
  return {
    Id: idTicket, IdOrder: clean(t.IdOrder, 40), State: TICKET_STATES[String(t.Status)] || 'open', Product: plain(t.Product?.Description?.Title || t.Product?.Reference, 150), Image: picture(t.Product?.Media), Shop: clean(t.MemberFirstname, 60),
    Messages: (Array.isArray(t.Messages) ? t.Messages : []).slice(-200).map((m: any) => ({ Text: plain(m.Message, 4000), Mine: m.SentByCustomer === true, Date: clean(m.SentDate, 16) })).filter((m: any) => m.Text),
  }
}

/** A new request about a product the customer bought, or an answer in a request. Returns '' or the reason it was refused. */
export async function changeService(event: H3Event, lang: string, body: any): Promise<{ error: string, id?: number }> {
  const message = clean(body?.Message, 2000)
  if (message.length < 10) { return { error: 'Votre message est trop court.' } }
  if (body?.Action === 'ticket-reply') {
    const id = Math.floor(number(body?.Id))
    if (id <= 0) { return { error: 'Cette demande n\'existe pas.' } }
    const sent = await cartCall(event, 'POST', 'ticket/message', { IdTicket: id, Message: message })
    return sent?.status === 'success' ? { error: '', id } : { error: 'Votre message n\'a pas pu être envoyé, merci de réessayer.' }
  }
  // the product must be one the customer really bought (the API would take any order and any product)
  const product = (await bought(event, lang, 50).catch(() => [])).find((p: any) => p.IdOrder === clean(body?.IdOrder, 40) && p.IdProductAttribute === Math.floor(number(body?.IdProductAttribute)))
  if (!product) { return { error: 'Choisissez l\'article concerné par votre demande.' } }
  const made = await cartCall(event, 'POST', 'ticket', { IdOrder: product.IdOrder, IdProductAttribute: product.IdProductAttribute, Title: (product.Name || 'Demande').slice(0, 100), Description: message.slice(0, 500), Priority: 2, LanguageIsoCode: upper(lang) })
  const id = Math.floor(number(made?.IdTicket))
  return id > 0 ? { error: '', id } : { error: 'Votre demande n\'a pas pu être enregistrée, merci de réessayer.' }
}

/** The referral of the customer: the code to share, its link on this site, and the friends invited with the reward each brought. */
export async function readReferral(event: H3Event, lang: string, origin: string, prefix: string) {
  const mine = await cartCall(event, 'GET', 'referral/sponsor/code', { LanguageIsoCode: upper(lang) })
  const code = clean(mine?.Code, 20).toUpperCase()
  if (!/^[A-Z0-9]{4,20}$/.test(code)) { return null }
  const invited = await cartCall(event, 'GET', 'referral/sponsor/invited', { LanguageIsoCode: upper(lang) })
  return {
    Code: code, Link: origin.replace(/\/+$/, '') + prefix + (lang === 'fr' ? '/parrainage/' : '/referral/') + encodeURIComponent(code),
    Pending: Math.floor(number(invited?.Total?.pending)), Complete: Math.floor(number(invited?.Total?.complete)),
    Friends: (Array.isArray(invited?.Sponsored) ? invited.Sponsored : []).slice(0, 100).map((f: any) => ({
      Email: clean(f.Email, 150), Done: String(f.State?.Label) === 'complete', Code: clean(f.Promocode?.Code, 60), Value: number(f.Promocode?.Reduction?.Value?.TaxIncl), Percent: String(f.Promocode?.Type) === 'percentage',
      Used: f.Promocode?.State?.Used === true, Until: clean(f.Promocode?.EndDate, 10),
    })).filter((f: any) => f.Email),
  }
}

/** A friend follows a referral link and gives an e-mail: Digipart makes the welcome promo code. No account is needed. */
export async function claimReferral(event: H3Event, lang: string, body: any): Promise<{ error: string, code?: string, until?: string, value?: number }> {
  const email = clean(body?.Email, 150).toLowerCase(), code = clean(body?.Code, 20).toUpperCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { return { error: 'Indiquez une adresse e-mail valable.' } }
  if (!/^[A-Z0-9]{4,20}$/.test(code)) { return { error: 'Ce lien de parrainage n\'est pas valable.' } }
  const answer = await cartCall(event, 'POST', 'referral/sponsored/promocode', { Email: email, ReferralCode: code, LanguageIsoCode: upper(lang), Newsletter: body?.Newsletter ? 1 : 0 })
  const promo = clean(answer?.Promocode?.Code, 60)
  if (promo) { return { error: '', code: promo, until: clean(answer.Promocode.EndDate, 10), value: number(answer.Promocode.Reduction?.Value?.TaxIncl) } }
  const said = String(answer?.message || '')
  return { error: /already exists/.test(said) ? 'Cette offre est réservée aux nouveaux clients : un compte existe déjà avec cette adresse.' : /already been sponsored/.test(said) ? 'Cette adresse a déjà reçu son code de bienvenue.' : /not valid/.test(said) ? 'Ce lien de parrainage n\'est pas valable.' : 'Votre code n\'a pas pu être créé, merci de réessayer.' }
}
