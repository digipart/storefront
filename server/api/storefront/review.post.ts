// A customer gives an opinion on a product: {IdProduct, Rating, Comment, Details: [{Id, Rating}], Website}. Only a logged-in customer; Digipart (api/review, the API every front uses) checks that they bought the
// product and have not already reviewed it, and keeps the review « pending » until the shop approves it. `Website` is a field no person fills. A few reviews per address in ten minutes.
const sent = new Map<string, number[]>()
const note = (v: unknown) => { const n = Math.round(Number(v) * 10) / 10; return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 0 }

export default defineEventHandler(async (event) => {
  sameSiteOnly(event)
  const { lang } = langOf(event)
  const body = await readBody(event)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  if (String(body?.Website ?? '') !== '') { return { Done: true, Error: '' } }
  if (!loggedIn(event)) { return { Done: false, Error: 'Connectez-vous pour donner votre avis.', Login: true } }
  const id = Number(body?.IdProduct), rating = note(body?.Rating)
  if (!Number.isInteger(id) || id <= 0) { return { Done: false, Error: 'Produit introuvable.' } }
  if (!rating) { return { Done: false, Error: 'Choisissez une note de 1 à 5.' } }
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown', now = Date.now()
  const recent = (sent.get(ip) || []).filter(at => now - at < 10 * 60 * 1000)
  if (recent.length >= 5) { return { Done: false, Error: 'Trop de demandes : merci de patienter quelques minutes.' } }
  sent.set(ip, [...recent, now])
  if (sent.size > 5000) { sent.delete(sent.keys().next().value as string) }
  const details = (Array.isArray(body?.Details) ? body.Details : []).slice(0, 12).map((d: any) => ({ IdReviewSubject: Number(d?.Id) || 0, Rating: note(d?.Rating) })).filter((d: any) => d.IdReviewSubject > 0 && d.Rating > 0)
  const comment = String(body?.Comment ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]+/g, ' ').trim().slice(0, 2000)
  const answer = await cartCall(event, 'POST', 'review', {
    ReviewType: 'product', IdTarget: id, RatingGlobal: rating.toFixed(1), Comment: comment, LanguageIsoCode: lang.toUpperCase(), Details: details.length ? JSON.stringify(details) : '',
  })
  if (answer?.status === 'success') { return { Done: true, Error: '' } }
  const said = String(answer?.message || '')
  // Digipart answers in English: what the customer can act on is said in French, nothing else is shown
  const error = /purchased/i.test(said) ? 'Seuls les clients qui ont acheté ce produit peuvent donner leur avis.'
    : /already submitted/i.test(said) ? 'Vous avez déjà donné votre avis sur ce produit.'
      : /mandatory rating subject/i.test(said) ? 'Merci de noter tous les critères demandés.'
        : /unauthorized|token/i.test(said) ? 'Votre connexion a expiré : reconnectez-vous pour donner votre avis.'
          : 'Votre avis n\'a pas pu être envoyé, merci de réessayer.'
  return { Done: false, Error: error, Login: /unauthorized|token/i.test(said) }
})
