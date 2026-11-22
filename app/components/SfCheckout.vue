<script setup lang="ts">
// The order page: who orders and where to deliver, the delivery method, the payment method, and the summary beside. Shown on one page or one step after the other, as the shop chose in Digipart
// (Boutique en ligne > Préférences > Page de commande). The delivery and payment methods are those of the delivery country, in the order set on the country in Digipart.
// what the shop set on the « Commande » page of the site builder: the promo code field, the newsletter box, the words under the button, the reassurance lines
const props = defineProps<{ design?: any }>()
const section = computed(() => (props.design?.Sections || []).find((s: any) => s.Type === 'main_checkout') || null)
const options = computed(() => section.value?.Settings || {})
const reassurances = computed(() => (section.value?.Blocks || []).filter((b: any) => b.Type === 'reassurance' && b.Texts?.Title))
const told = ref<any>(null)   // the reassurance line whose text is shown in the panel
const wantNews = ref(false)
const promo = ref('')
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const { cart, url: cartUrl, addCode, removeCode, error: cartError, busy: cartBusy } = useCart()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const query = () => ({ lang: lang.value, prefix: site.value?.Route?.Prefix || '' })
const state = ref<any>(null)
const busy = ref(false)
const error = ref('')
const step = ref(1)
const editing = ref(true)
const wantLogin = ref(false)
const form = reactive({ Email: '', Firstname: '', Lastname: '', Company: '', Address1: '', Address2: '', Postcode: '', City: '', CountryIsoCode: 'FR', MobilePhone: '' })
const login = reactive({ Email: '', Password: '' })
const payment = ref(0)
const steps = computed(() => state.value?.Mode === 'steps')
const identified = computed(() => !!state.value?.Customer && !!state.value?.Address)
const types = computed(() => ['Home', 'RelayPoint', 'Store'].filter(type => (state.value?.Carriers || []).some((c: any) => c.Type === type)))
const typeLabel: Record<string, string> = { Home: 'À domicile', RelayPoint: 'En point relais', Store: 'En boutique' }
const chosenCarrier = computed(() => (state.value?.Carriers || []).find((c: any) => c.IdCarrier === state.value?.Cart?.IdCarrier) || null)
const openType = ref('')
const total = computed(() => state.value?.Cart || cart.value)
const taxExcl = computed(() => !!state.value?.TaxExcl)

function take(answer: any) {
  state.value = answer
  cart.value = answer.Cart
  const a = answer.Address
  if (a) { Object.assign(form, { Firstname: a.Firstname, Lastname: a.Lastname, Company: a.Company, Address1: a.Address1, Address2: a.Address2, Postcode: a.Postcode, City: a.City, CountryIsoCode: a.CountryIsoCode, MobilePhone: a.MobilePhone }) } else { form.CountryIsoCode = answer.CountryIsoCode }
  if (answer.Customer) { form.Email = answer.Customer.Email; if (!a) { form.Firstname = form.Firstname || answer.Customer.Firstname; form.Lastname = form.Lastname || answer.Customer.Lastname } }
  editing.value = !(answer.Customer && a)
  if (!openType.value || !types.value.includes(openType.value)) { openType.value = chosenCarrier.value?.Type || types.value[0] || '' }
  if (!answer.Payments.some((p: any) => p.IdPayment === payment.value && p.Available)) { payment.value = 0 }
}
async function load(country = '') {
  try { take(await $fetch<any>('/api/storefront/checkout', { query: { ...query(), country } })) } catch { error.value = 'La page de commande ne répond pas, merci de réessayer.' }
}
async function send(body: Record<string, unknown>): Promise<any> {
  if (busy.value) { return null }
  busy.value = true
  error.value = ''
  try {
    const answer = await $fetch<any>('/api/storefront/checkout', { method: 'POST', query: query(), body: { CountryIsoCode: form.CountryIsoCode, ...body } })
    take(answer)
    error.value = answer.Error || ''
    return answer
  } catch { error.value = 'La page de commande ne répond pas, merci de réessayer.'; return null } finally { busy.value = false }
}
async function saveContact() {
  const answer = await send({ Action: 'contact', ...form, IdAddress: state.value?.Address?.IdAddress || 0 })
  if (answer?.Code === 'login') { wantLogin.value = true; login.Email = form.Email }
  if (answer && !answer.Error && wantNews.value && form.Email) { $fetch('/api/storefront/newsletter', { method: 'POST', query: { lang: lang.value }, body: { Email: form.Email, Website: '' } }).catch(() => {}); wantNews.value = false }
  if (answer && !answer.Error && steps.value) { step.value = 2 }
}
// a promo code changes the cart: the order page is read again with it
async function applyPromo() { if (promo.value.trim() && await addCode(promo.value.trim())) { promo.value = ''; await load(form.CountryIsoCode) } }
async function dropPromo(id: number) { await removeCode(id); await load(form.CountryIsoCode) }
async function doLogin() { const answer = await send({ Action: 'login', ...login }); if (answer && !answer.Error) { wantLogin.value = false; login.Password = '' } }
const logout = () => send({ Action: 'logout' })
// « Mot de passe oublié ? » under the log-in form: the e-mail with the link to choose a new password is asked for the address typed above (the account answers, as on the log-in page); the
// visitor stays on the order page and can still order without an account
const { send: accountSend } = useAccount()
const forgotNote = ref('')
async function forgot() {
  forgotNote.value = ''
  if (!/^\S+@\S+\.\S+$/.test(login.Email.trim())) { error.value = 'Indiquez votre adresse e-mail : nous vous envoyons un lien pour choisir un nouveau mot de passe.'; return }
  const answer = await accountSend({ Action: 'forgot', Email: login.Email.trim() })
  error.value = answer.Error; forgotNote.value = answer.Error ? '' : (answer.Note || 'Si un compte existe avec cette adresse, un e-mail vient de vous être envoyé pour choisir un nouveau mot de passe.')
}
// a relay carrier needs its relay point: the panel lists the points near the address (or near a postcode the visitor types)
const relayFor = ref<any>(null)
const relays = ref<any[]>([])
const relayNear = reactive({ postcode: '', city: '' })
const relayBusy = ref(false)
const relayOpen = ref('')
const relayPanel = ref<HTMLElement | null>(null)
async function loadRelays() {
  relayBusy.value = true
  try { const answer = await $fetch<any>('/api/storefront/relays', { query: { ...query(), carrier: relayFor.value.IdCarrier, postcode: relayNear.postcode, city: relayNear.city } }); relays.value = answer.Points } catch { relays.value = [] } finally { relayBusy.value = false }
}
function pickCarrier(carrier: any) {
  if (carrier.Type !== 'RelayPoint') { return send({ Action: 'carrier', IdCarrier: carrier.IdCarrier }) }
  relayFor.value = carrier; relays.value = []; relayNear.postcode = ''; relayNear.city = ''; relayOpen.value = ''
  nextTick(() => relayPanel.value?.focus())
  return loadRelays()
}
async function pickRelay(point: any) { const answer = await send({ Action: 'carrier', IdCarrier: relayFor.value.IdCarrier, IdRelayPoint: point.Id }); if (answer && !answer.Error) { relayFor.value = null } }
const mapUrl = (point: any) => 'https://www.openstreetmap.org/?mlat=' + point.Latitude + '&mlon=' + point.Longitude + '#map=17/' + point.Latitude + '/' + point.Longitude
watch(relayFor, (now) => { document.documentElement.style.overflow = now ? 'hidden' : '' })
onBeforeUnmount(() => { document.documentElement.style.overflow = '' })
// address suggestions while typing (only when the site has a Google Places key: otherwise the field is a plain one)
const suggestions = ref<any[]>([])
let suggestTimer: ReturnType<typeof setTimeout> | undefined, suggestOff = false, suggestSession = ''
function suggest() {
  clearTimeout(suggestTimer)
  if (suggestOff || form.Address1.trim().length < 4) { suggestions.value = []; return }
  suggestTimer = setTimeout(async () => {
    suggestSession = suggestSession || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-session')
    try {
      const answer = await $fetch<any>('/api/storefront/address', { query: { lang: lang.value, q: form.Address1, country: form.CountryIsoCode, session: suggestSession } })
      if (!answer.Enabled) { suggestOff = true }
      suggestions.value = answer.Suggestions || []
    } catch { suggestions.value = [] }
  }, 250)
}
async function takeSuggestion(item: any) {
  suggestions.value = []
  try {
    const found = (await $fetch<any>('/api/storefront/address', { query: { lang: lang.value, place: item.Id, session: suggestSession } })).Address
    suggestSession = ''
    if (!found) { return }
    form.Address1 = found.Address1 || item.Main; form.Postcode = found.Postcode || form.Postcode; form.City = found.City || form.City
    if (found.CountryIsoCode && state.value.Countries.some((c: any) => c.IsoCode === found.CountryIsoCode) && found.CountryIsoCode !== form.CountryIsoCode) { form.CountryIsoCode = found.CountryIsoCode; changeCountry() }
  } catch { /* the customer finishes the address by hand */ }
}
const closeSuggestions = () => setTimeout(() => { suggestions.value = [] }, 150)
// Paying by card (Stripe). The card form is Stripe's own (the card number never goes through this site); the amount and the content of the order are set by the server from the cart.
// nothing left to pay (a promo code covers everything): no payment method, the order is made at once
// gift cards put on the cart: each pays its part, the bank card pays what is left
const gift = computed(() => state.value?.GiftCards || null)
const giftCards = computed(() => gift.value?.Cards || [])
const leftToPay = computed(() => giftCards.value.length ? Number(gift.value.ToPay) : Number(state.value?.Cart?.ToPay || 0))
const giftForm = reactive({ CardNumber: '', Pin: '' })
const giftOpen = ref(false)
const giftBusy = ref(false)
const giftError = ref('')
async function giftCall(body: Record<string, unknown>) {
  if (giftBusy.value) { return }
  giftBusy.value = true
  giftError.value = ''
  try {
    const answer = await $fetch<any>('/api/storefront/pay', { method: 'POST', query: query(), body: { CountryIsoCode: form.CountryIsoCode, ...body } })
    giftError.value = answer.Error || ''
    if (state.value) { state.value = { ...state.value, GiftCards: answer.GiftCards } }
    if (!answer.Error) { giftForm.CardNumber = ''; giftForm.Pin = ''; giftOpen.value = false }
  } catch { giftError.value = 'Cette carte cadeau n\'a pas pu être prise en compte, merci de réessayer.' } finally { giftBusy.value = false }
}
const addGift = () => giftCall({ Action: 'gift-add', ...giftForm })
const removeGift = (id: number) => giftCall({ Action: 'gift-remove', Id: id })
const free = computed(() => !!state.value?.Cart?.Count && !!state.value?.Cart?.IdCarrier && Math.round(leftToPay.value * 100) <= 0 && (Number(state.value.Cart.Discount) > 0 || giftCards.value.length > 0))
const method = computed(() => (state.value?.Payments || []).find((p: any) => p.IdPayment === payment.value) || null)
const byCard = computed(() => !free.value && method.value?.Provider === 'Stripe' && !!state.value?.Pay?.Stripe)
const ready = computed(() => identified.value && !editing.value && !!state.value?.Cart?.IdCarrier && !(chosenCarrier.value?.Type === 'RelayPoint' && !state.value?.Cart?.Relay))
const cardBox = ref<HTMLElement | null>(null)
const cardReady = ref(false)
const paying = ref(false)
const payError = ref('')
let stripe: any = null, elements: any = null, cardElement: any = null, stripeScript: Promise<void> | null = null
const amountNow = () => Math.round(leftToPay.value * 100)
function loadStripe(): Promise<void> {
  if ((window as any).Stripe) { return Promise.resolve() }
  stripeScript = stripeScript || new Promise<void>((resolve, reject) => {
    const tag = document.createElement('script')
    tag.src = 'https://js.stripe.com/v3/'; tag.async = true
    tag.onload = () => resolve(); tag.onerror = () => { stripeScript = null; reject(new Error('stripe')) }
    document.head.appendChild(tag)
  })
  return stripeScript
}
function unmountCard() { try { cardElement?.destroy() } catch { /* already gone */ } cardElement = null; elements = null; cardReady.value = false }
async function mountCard() {
  if (!byCard.value || !cardBox.value || amountNow() <= 0) { return }
  if (elements) { elements.update({ amount: amountNow(), currency: String(state.value.Cart.Currency || 'EUR').toLowerCase() }); return }
  payError.value = ''
  try {
    await loadStripe()
    stripe = stripe || (window as any).Stripe(state.value.Pay.Stripe.PublicKey, { locale: lang.value })
    const a = state.value?.Address
    elements = stripe.elements({ mode: 'payment', amount: amountNow(), currency: String(state.value.Cart.Currency || 'EUR').toLowerCase(), paymentMethodTypes: ['card'], appearance: { theme: 'stripe', variables: { borderRadius: '2px', fontSizeBase: '15px' } } })
    cardElement = elements.create('payment', { defaultValues: { billingDetails: { name: a ? a.Firstname + ' ' + a.Lastname : '', email: state.value?.Customer?.Email || '', address: { country: a?.CountryIsoCode || form.CountryIsoCode, postal_code: a?.Postcode || '' } } } })
    cardElement.on('ready', () => { cardReady.value = true })
    cardElement.mount(cardBox.value)
  } catch { unmountCard(); payError.value = 'Le formulaire de paiement n\'a pas pu s\'afficher, merci de réessayer.' }
}
watch([byCard, cardBox, leftToPay], () => { if (byCard.value && cardBox.value) { mountCard() } else if (!byCard.value) { unmountCard() } }, { flush: 'post' })
async function pay() {
  if (paying.value || !ready.value || !byCard.value || !elements) { return }
  paying.value = true
  payError.value = ''
  try {
    const checked = await elements.submit()
    if (checked.error) { payError.value = checked.error.message || 'Vérifiez les informations de votre carte.'; return }
    const answer = await $fetch<any>('/api/storefront/pay', { method: 'POST', query: query(), body: { IdPayment: payment.value } })
    if (!answer.Error && answer.Order) { try { sessionStorage.setItem('sf-order-before', String(state.value?.LastOrder || '')) } catch { /* no order number then */ } location.href = (site.value?.Route?.Prefix || '') + '/commande/merci'; return }   // the gift cards covered everything
    if (answer.Error || !answer.ClientSecret) { payError.value = answer.Error || 'Le paiement n\'a pas pu être préparé, merci de réessayer.'; return }
    if (answer.Amount !== amountNow() || answer.Currency !== String(state.value.Cart.Currency || 'EUR').toLowerCase()) { await giftCall({ Action: 'release' }); await load(form.CountryIsoCode); payError.value = 'Le montant de votre commande a changé : vérifiez-le, puis payez à nouveau.'; return }
    try { sessionStorage.setItem('sf-order-before', String(state.value?.LastOrder || '')) } catch { /* the confirmation page then shows no order number */ }
    const done = await stripe.confirmPayment({ elements, clientSecret: answer.ClientSecret, confirmParams: { return_url: location.origin + (site.value?.Route?.Prefix || '') + '/commande/merci' } })
    // the customer is sent to the confirmation page by Stripe; coming here means the payment was refused
    if (done?.error) { payError.value = done.error.message || 'Votre paiement a été refusé.'; if (giftCards.value.length) { await giftCall({ Action: 'release' }) } }
  } catch { payError.value = 'Le paiement ne répond pas, merci de réessayer.' } finally { paying.value = false }
}
async function orderFree() {
  if (paying.value || !ready.value) { return }
  paying.value = true
  payError.value = ''
  try {
    const before = String(state.value?.LastOrder || '')
    const answer = await $fetch<any>('/api/storefront/pay', { method: 'POST', query: query(), body: { Free: true } })
    if (answer.Error) { payError.value = answer.Error; await load(form.CountryIsoCode); return }
    try { sessionStorage.setItem('sf-order-before', before) } catch { /* the confirmation page then shows no order number */ }
    location.href = (site.value?.Route?.Prefix || '') + '/commande/merci'
  } catch { payError.value = 'Votre commande n\'a pas pu être enregistrée, merci de réessayer.' } finally { paying.value = false }
}
// Paying in several instalments with Alma. Each Alma method stands for a number of instalments; the page shows what Alma would take and when (asked by the server), then sends the customer to
// Alma's own payment page. The payment is made by Digipart for the amount of the cart: the browser only receives the address of that page.
const byAlma = computed(() => !free.value && method.value?.Provider === 'Alma' && !!state.value?.Pay?.Alma)
const almaPlans = ref<any[]>([])
const almaAsked = ref(false)
const almaPlan = computed(() => almaPlans.value.find((p: any) => p.IdPayment === payment.value) || null)
// the Alma methods (2, 3, 4 instalments) are ONE line of the list; the number of instalments is chosen inside it
const almaCount = (p: any) => Number(/^ALMA([1-4])X$/i.exec(String(p?.Code || ''))?.[1] || 0)
const almaMethods = computed(() => state.value?.Pay?.Alma ? (state.value?.Payments || []).filter((p: any) => p.Provider === 'Alma' && almaCount(p) > 0).sort((a: any, b: any) => almaCount(a) - almaCount(b)) : [])
const payRows = computed(() => {
  const rows: any[] = []
  let grouped = false
  for (const p of state.value?.Payments || []) {
    if (!almaMethods.value.includes(p)) { rows.push({ ...p, Ids: [p.IdPayment] }); continue }
    if (grouped) { continue }
    grouped = true
    const counts = almaMethods.value.map(almaCount)
    rows.push({ IdPayment: 'alma', Alma: true, Ids: almaMethods.value.map((m: any) => m.IdPayment), Available: almaMethods.value.some((m: any) => m.Available),
      Title: w('Paiement en plusieurs fois avec Alma'), Description: w('En {a} fois par carte bancaire', { a: counts.length > 1 ? counts.slice(0, -1).join(', ') + ' ' + w('ou') + ' ' + counts[counts.length - 1] : String(counts[0]) }) })
  }
  return rows
})
function choosePay(row: any) {
  if (!row.Alma) { payment.value = row.IdPayment; return }
  if (!row.Ids.includes(payment.value)) { payment.value = (almaMethods.value.find((m: any) => m.Available) || almaMethods.value[0]).IdPayment }
}
const almaOff = (m: any) => !m.Available || (almaAsked.value && almaPlans.value.find((p: any) => p.IdPayment === m.IdPayment)?.Eligible === false)
let almaFor = ''
async function loadAlma() {
  const key = String(state.value?.Cart?.IdCarrier || 0) + ':' + Math.round(leftToPay.value * 100)
  if (!byAlma.value || !identified.value || key === almaFor) { return }
  almaFor = key
  almaAsked.value = false
  try { almaPlans.value = (await $fetch<any>('/api/storefront/pay', { method: 'POST', query: query(), body: { Action: 'alma-plans', CountryIsoCode: form.CountryIsoCode } })).Plans || [] } catch { almaPlans.value = []; almaFor = '' }
  almaAsked.value = true
}
watch([byAlma, leftToPay, () => state.value?.Cart?.IdCarrier, identified], loadAlma, { immediate: true })
async function payAlma() {
  if (paying.value || !ready.value || !byAlma.value) { return }
  paying.value = true
  payError.value = ''
  let leaving = false
  try {
    const answer = await $fetch<any>('/api/storefront/pay', { method: 'POST', query: query(), body: { Action: 'alma-create', IdPayment: payment.value, CountryIsoCode: form.CountryIsoCode } })
    if (answer.Error || !answer.Url) { payError.value = answer.Error || 'Le paiement n\'a pas pu être préparé, merci de réessayer.'; if (giftCards.value.length) { await giftCall({ Action: 'release' }) } return }
    try { sessionStorage.setItem('sf-order-before', String(state.value?.LastOrder || '')) } catch { /* the confirmation page then shows no order number */ }
    leaving = true
    location.href = answer.Url
  } catch { payError.value = 'Le paiement ne répond pas, merci de réessayer.' } finally { if (!leaving) { paying.value = false } }
}
// back from Alma's page without paying: the gift cards get their part back, and the page says so
async function backFromAlma() {
  if (new URLSearchParams(location.search).get('paiement') !== 'annule') { return }
  history.replaceState(history.state, '', location.pathname)
  payError.value = 'Votre paiement n\'a pas été finalisé. Vous pouvez réessayer ou choisir un autre moyen de paiement.'
  if (giftCards.value.length) { await giftCall({ Action: 'release' }) }   // once the page is loaded, and only when a gift card may hold something
}
const shortDate = (iso: string) => { const d = new Date(iso + 'T12:00:00Z'); return isNaN(d.getTime()) ? '' : d.toLocaleDateString(lang.value, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) }
// Paying with PayPal. The button and the window are PayPal's; the PayPal order is made and its money taken by Digipart, for the amount of the cart (the browser only carries its id).
const byPaypal = computed(() => !free.value && method.value?.Provider === 'Paypal' && !!state.value?.Pay?.Paypal)
const paypalBox = ref<HTMLElement | null>(null)
const paypalReady = ref(false)
let paypalButtons: any = null, paypalScript: Promise<void> | null = null
function loadPaypal(): Promise<void> {
  if ((window as any).paypal?.Buttons) { return Promise.resolve() }
  paypalScript = paypalScript || new Promise<void>((resolve, reject) => {
    const tag = document.createElement('script')
    tag.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(state.value.Pay.Paypal.ClientId) + '&currency=' + encodeURIComponent(String(state.value.Cart.Currency || 'EUR')) + '&intent=capture&components=buttons'
    tag.async = true
    tag.onload = () => resolve(); tag.onerror = () => { paypalScript = null; reject(new Error('paypal')) }
    document.head.appendChild(tag)
  })
  return paypalScript
}
function unmountPaypal() { try { paypalButtons?.close() } catch { /* already gone */ } paypalButtons = null; paypalReady.value = false }
async function mountPaypal() {
  if (!byPaypal.value || !paypalBox.value || paypalButtons) { return }
  payError.value = ''
  try {
    await loadPaypal()
    const call = (body: Record<string, unknown>) => $fetch<any>('/api/storefront/pay', { method: 'POST', query: query(), body: { IdPayment: payment.value, CountryIsoCode: form.CountryIsoCode, ...body } })
    paypalButtons = (window as any).paypal.Buttons({
      style: { layout: 'horizontal', color: 'black', shape: 'rect', label: 'paypal', tagline: false, height: 48 },   // black, square corners: the buttons of the theme
      onClick: (_data: any, actions: any) => { payError.value = ''; return ready.value ? actions.resolve() : actions.reject() },
      createOrder: async () => {
        const answer = await call({ Action: 'paypal-create' })
        if (answer.Error || !answer.PaypalOrder) { payError.value = answer.Error || 'Le paiement n\'a pas pu être préparé, merci de réessayer.'; throw new Error('paypal-create') }
        try { sessionStorage.setItem('sf-order-before', String(state.value?.LastOrder || '')) } catch { /* the confirmation page then shows no order number */ }
        return answer.PaypalOrder
      },
      onApprove: async (data: any) => {
        paying.value = true
        try {
          const answer = await call({ Action: 'paypal-capture', PaypalOrder: String(data?.orderID || '') })
          if (answer.Error) { payError.value = answer.Error; await load(form.CountryIsoCode); return }
          location.href = (site.value?.Route?.Prefix || '') + '/commande/merci'
        } catch { payError.value = 'Le paiement ne répond pas, merci de réessayer.' } finally { paying.value = false }
      },
      // the customer closed PayPal's window, or PayPal failed: the gift cards get their part back
      onCancel: () => { if (giftCards.value.length) { giftCall({ Action: 'release' }) } },
      onError: () => { if (!payError.value) { payError.value = 'Votre paiement PayPal n\'a pas abouti, merci de réessayer.' } if (giftCards.value.length) { giftCall({ Action: 'release' }) } },
    })
    await paypalButtons.render(paypalBox.value)
    paypalReady.value = true
  } catch { unmountPaypal(); payError.value = 'Le bouton PayPal n\'a pas pu s\'afficher, merci de réessayer.' }
}
watch([byPaypal, paypalBox], () => { if (byPaypal.value && paypalBox.value) { mountPaypal() } else if (!byPaypal.value) { unmountPaypal() } }, { flush: 'post' })
onBeforeUnmount(unmountCard)
onBeforeUnmount(unmountPaypal)
const changeCountry = () => { if (!identified.value) { load(form.CountryIsoCode) } }
const show = (n: number) => !steps.value || step.value === n
const locked = (n: number) => !steps.value && n > 1 && !identified.value
onMounted(async () => { await load(); await backFromAlma() })
</script>

<template>
  <div class="sf-co" :class="{ 'is-tabs': options.Look === 'tabs' }">
    <p v-if="!state && !error" class="sf-cart-wait">{{ w('Chargement de votre commande…') }}</p>
    <div v-else-if="state && !state.Cart.Count" class="sf-cart-none"><p>{{ w('Votre panier est vide.') }}</p><a :href="site?.Route?.Prefix || '/'" class="sf-btn">{{ w('Continuer mes achats') }}</a></div>
    <div v-else-if="state" class="sf-co-grid">
      <div class="sf-co-main">
        <ol v-if="steps" class="sf-co-steps" :aria-label="w('Étapes de la commande')">
          <li v-for="(name, index) in ['Coordonnées', 'Livraison', 'Paiement']" :key="name" :class="{ 'is-on': step === index + 1, 'is-done': step > index + 1 }">
            <button type="button" :disabled="index + 1 > step || (index > 0 && !identified)" :aria-current="step === index + 1 ? 'step' : undefined" @click="step = index + 1"><span>{{ index + 1 }}</span>{{ w(name) }}</button>
          </li>
        </ol>
        <p v-if="error" class="sf-cart-error" role="alert">{{ w(error) }}</p>
        <!-- the express payment (Apple Pay, Google Pay): not with a gift card on the cart (a wallet pays one amount), nor for an order with nothing to pay -->
        <LazySfExpress v-if="options.ShowExpress !== false && state.Pay?.Stripe && !giftCards.length && !free && (!steps || step === 1)" :state="state" @changed="load(form.CountryIsoCode)" />

        <!-- 1. who orders, and where to deliver -->
        <section v-show="show(1)" class="sf-co-block" aria-labelledby="sf-co-1">
          <div class="sf-co-head"><h2 id="sf-co-1">{{ w('Vos coordonnées') }}</h2>
            <button v-if="!state.Customer && !wantLogin" type="button" class="sf-link" @click="wantLogin = true">{{ w('Se connecter') }}</button>
            <button v-else-if="state.Customer" type="button" class="sf-link" :disabled="busy" @click="logout">{{ w('Ce n\'est pas vous ?') }}</button>
          </div>
          <form v-if="wantLogin && !state.Customer" class="sf-co-form" @submit.prevent="doLogin">
            <label class="is-wide">{{ w('Adresse e-mail') }}<input v-model="login.Email" type="email" autocomplete="username" required></label>
            <label class="is-wide">{{ w('Mot de passe') }}<input v-model="login.Password" type="password" autocomplete="current-password" required></label>
            <button type="button" class="sf-link sf-co-forgot is-wide" :disabled="busy" @click="forgot">{{ w('Mot de passe oublié ?') }}</button>
            <p v-if="forgotNote" class="sf-note-ok is-wide" role="status">{{ w(forgotNote) }}</p>
            <div class="sf-co-actions is-wide"><button type="submit" class="sf-btn" :disabled="busy">{{ w('Se connecter') }}</button><button type="button" class="sf-link" @click="wantLogin = false">{{ w('Commander sans compte') }}</button></div>
          </form>
          <div v-else-if="!editing && state.Address" class="sf-co-card">
            <div><strong>{{ state.Address.Firstname }} {{ state.Address.Lastname }}</strong><span>{{ state.Customer.Email }}</span><span>{{ state.Address.Address1 }}<template v-if="state.Address.Address2">, {{ state.Address.Address2 }}</template></span><span>{{ state.Address.Postcode }} {{ state.Address.City }}, {{ state.Address.Country }}</span><span>{{ state.Address.MobilePhone }}</span></div>
            <button type="button" class="sf-link" @click="editing = true">{{ w('Modifier') }}</button>
          </div>
          <form v-else class="sf-co-form" @submit.prevent="saveContact">
            <label v-if="!state.Customer" class="is-wide">{{ w('Adresse e-mail') }}<input v-model="form.Email" type="email" autocomplete="email" required></label>
            <label>{{ w('Prénom') }}<input v-model="form.Firstname" type="text" autocomplete="given-name" maxlength="60" required></label>
            <label>{{ w('Nom') }}<input v-model="form.Lastname" type="text" autocomplete="family-name" maxlength="60" required></label>
            <label class="is-wide sf-co-suggest">{{ w('Adresse') }}<input v-model="form.Address1" type="text" autocomplete="address-line1" maxlength="150" required role="combobox" aria-autocomplete="list" :aria-expanded="suggestions.length > 0" aria-controls="sf-co-suggestions" @input="suggest" @keydown.esc="suggestions = []" @blur="closeSuggestions">
              <ul v-if="suggestions.length" id="sf-co-suggestions" role="listbox">
                <li v-for="item in suggestions" :key="item.Id" role="option" aria-selected="false"><button type="button" @mousedown.prevent @click="takeSuggestion(item)"><strong>{{ item.Main }}</strong> <small>{{ item.More }}</small></button></li>
                <li class="sf-co-suggest-by" aria-hidden="true">powered by Google</li>
              </ul>
            </label>
            <label class="is-wide">{{ w('Complément d\'adresse (facultatif)') }}<input v-model="form.Address2" type="text" autocomplete="address-line2" maxlength="150"></label>
            <label>{{ w('Code postal') }}<input v-model="form.Postcode" type="text" autocomplete="postal-code" maxlength="20" required></label>
            <label>{{ w('Ville') }}<input v-model="form.City" type="text" autocomplete="address-level2" maxlength="100" required></label>
            <label>{{ w('Pays') }}<select v-model="form.CountryIsoCode" autocomplete="country" @change="changeCountry"><option v-for="country in state.Countries" :key="country.IsoCode" :value="country.IsoCode">{{ country.Name }}</option></select></label>
            <label>{{ w('Téléphone') }}<input v-model="form.MobilePhone" type="tel" autocomplete="tel" maxlength="30" required></label>
            <label v-if="!state.Customer && options.ShowNewsletter !== false" class="sf-check is-wide"><input v-model="wantNews" type="checkbox"><span>{{ w('Recevoir les nouveautés et les offres par e-mail') }}</span></label>
            <div class="sf-co-actions is-wide"><button type="submit" class="sf-btn" :disabled="busy">{{ w(steps ? 'Continuer vers la livraison' : 'Valider mes coordonnées') }}</button><button v-if="identified" type="button" class="sf-link" @click="editing = false">{{ w('Annuler') }}</button></div>
          </form>
        </section>

        <!-- 2. the delivery methods of the country, by kind -->
        <section v-show="show(2)" class="sf-co-block" :class="{ 'is-locked': locked(2) }" aria-labelledby="sf-co-2">
          <div class="sf-co-head"><h2 id="sf-co-2">{{ w('Mode de livraison') }}</h2></div>
          <p v-if="!state.Carriers.length" class="sf-muted">{{ w('Aucun mode de livraison pour ce pays pour le moment.') }}</p>
          <div v-else class="sf-co-types">
            <div v-for="type in types" :key="type" class="sf-co-type" :class="{ 'is-open': openType === type }">
              <button type="button" class="sf-co-type-head" :aria-expanded="openType === type" @click="openType = type"><span class="sf-radio" :class="{ 'is-on': openType === type }" />{{ w(typeLabel[type]) }}</button>
              <div v-if="openType === type" class="sf-co-options">
                <button v-for="carrier in state.Carriers.filter((c: any) => c.Type === type)" :key="carrier.IdCarrier" type="button" class="sf-co-option" :class="{ 'is-on': state.Cart.IdCarrier === carrier.IdCarrier }" :aria-pressed="state.Cart.IdCarrier === carrier.IdCarrier" :disabled="busy || locked(2)" @click="pickCarrier(carrier)">
                  <span class="sf-co-option-main"><strong>{{ carrier.Title }}</strong><small>{{ carrier.Description }}</small>
                    <small v-if="state.Cart.IdCarrier === carrier.IdCarrier && state.Cart.Relay" class="sf-co-relay"><b>{{ state.Cart.Relay.Name }}</b> · {{ state.Cart.Relay.Address }} · <u>{{ w('Choisir un autre relais') }}</u></small>
                    <small v-else-if="carrier.Type === 'RelayPoint'"><u>{{ w('Choisir un point relais') }}</u></small></span>
                  <span class="sf-co-option-side"><strong>{{ carrier.Price ? money(taxExcl ? carrier.PriceTaxExcl : carrier.Price, state.Cart.Currency, lang) : w('Livraison gratuite') }}</strong><small v-if="carrier.Date">{{ w('Livraison estimée : {a}', { a: carrier.Date }) }}</small></span>
                </button>
              </div>
            </div>
          </div>
          <p v-if="locked(2)" class="sf-total-note">{{ w('Validez vos coordonnées pour choisir la livraison.') }}</p>
          <div v-if="steps" class="sf-co-actions"><button type="button" class="sf-btn" :disabled="!state.Cart.IdCarrier || (chosenCarrier?.Type === 'RelayPoint' && !state.Cart.Relay)" @click="step = 3">{{ w('Continuer vers le paiement') }}</button></div>
        </section>

        <!-- 3. the payment methods of the country -->
        <section v-show="show(3)" class="sf-co-block" :class="{ 'is-locked': locked(3) }" aria-labelledby="sf-co-3">
          <div class="sf-co-head"><h2 id="sf-co-3">{{ w('Mode de paiement') }}</h2></div>
          <!-- gift cards: a means of payment of their own; each pays its part, the rest is paid below -->
          <div v-if="gift" class="sf-co-gift">
            <ul v-if="giftCards.length" class="sf-co-gift-list">
              <li v-for="card in giftCards" :key="card.Id"><span><strong>{{ w('Carte cadeau') }} {{ card.Code }}</strong><small>{{ w('Solde : {a}', { a: money(card.Balance, total.Currency, lang) }) }}</small></span>
                <span class="sf-co-gift-side"><strong>−{{ money(card.Used, total.Currency, lang) }}</strong><button type="button" class="sf-link" :disabled="giftBusy || paying || locked(3)" @click="removeGift(card.Id)">{{ w('Retirer') }}</button></span></li>
            </ul>
            <button v-if="!giftOpen" type="button" class="sf-link" :disabled="locked(3)" :aria-expanded="false" @click="giftOpen = true">{{ w(giftCards.length ? 'Ajouter une autre carte cadeau' : 'Payer avec une carte cadeau') }}</button>
            <form v-else class="sf-co-gift-form" @submit.prevent="addGift">
              <label>{{ w('Numéro de la carte cadeau') }}<input v-model="giftForm.CardNumber" type="text" maxlength="48" autocomplete="off" autocapitalize="characters" spellcheck="false" required></label>
              <label>{{ w('Code PIN') }}<input v-model="giftForm.Pin" type="password" inputmode="numeric" maxlength="12" autocomplete="off" required></label>
              <div class="sf-co-actions"><button type="submit" class="sf-btn is-outline" :disabled="giftBusy">{{ w('Appliquer') }}</button><button type="button" class="sf-link" @click="giftOpen = false; giftError = ''">{{ w('Annuler') }}</button></div>
            </form>
            <p v-if="giftError" class="sf-cart-error" role="alert">{{ w(giftError) }}</p>
            <p v-if="giftCards.length && !free" class="sf-total-note">{{ w('Reste à payer : {a}', { a: money(leftToPay, total.Currency, lang) }) }}</p>
          </div>
          <template v-if="free">
            <p class="sf-muted">{{ w(giftCards.length ? 'Votre commande est entièrement payée par votre carte cadeau.' : 'Votre commande est entièrement couverte par votre réduction : il n\'y a rien à payer.') }}</p>
            <p v-if="payError" class="sf-cart-error" role="alert">{{ w(payError) }}</p>
            <button type="button" class="sf-btn sf-summary-go" :disabled="paying || !ready" @click="orderFree">{{ paying ? w('Enregistrement…') : w('Valider ma commande') }}</button>
            <p v-if="!ready" class="sf-total-note">{{ w('Validez vos coordonnées et choisissez la livraison pour payer.') }}</p>
          </template>
          <template v-else>
          <p v-if="!state.Payments.length" class="sf-muted">{{ w('Aucun moyen de paiement pour ce pays pour le moment.') }}</p>
          <div v-else class="sf-co-types sf-co-pays">
            <button v-for="method in payRows" :key="method.IdPayment" type="button" class="sf-co-pay" :class="{ 'is-on': method.Ids.includes(payment) }" :aria-pressed="method.Ids.includes(payment)" :disabled="!method.Available || locked(3)" @click="choosePay(method)">
              <span class="sf-radio" :class="{ 'is-on': method.Ids.includes(payment) }" /><span class="sf-co-option-main"><strong>{{ method.Title }}</strong><small>{{ method.Available ? method.Description : w('Indisponible pour ce montant') }}</small></span>
            </button>
          </div>
          <!-- the card form of Stripe (the card number never goes through this site) -->
          <div v-if="byCard" class="sf-co-card-form">
            <p v-if="state.Pay.Stripe.TestMode" class="sf-co-test">{{ w('Mode test : aucun paiement réel. Carte de test 4242 4242 4242 4242, date future, 3 chiffres au choix.') }}</p>
            <div ref="cardBox" class="sf-co-card-box" :aria-busy="!cardReady" />
            <p v-if="!cardReady && !payError" class="sf-muted">{{ w('Chargement du formulaire de paiement…') }}</p>
          </div>
          <p v-if="payError" class="sf-cart-error" role="alert">{{ w(payError) }}</p>
          <button v-if="byCard" type="button" class="sf-btn sf-summary-go" :disabled="paying || !ready || !cardReady" @click="pay">{{ paying ? w('Paiement en cours…') : w('Payer {a}', { a: money(leftToPay, total.Currency, lang) }) }}</button>
          <!-- PayPal's own button: the amount is the one Digipart computes, the browser only opens PayPal's window -->
          <div v-else-if="byPaypal" class="sf-co-paypal" :class="{ 'is-locked': !ready || paying }">
            <p v-if="state.Pay.Paypal.TestMode" class="sf-co-test">{{ w('Mode test : aucun paiement réel. Utilisez un compte acheteur de test PayPal (sandbox).') }}</p>
            <div ref="paypalBox" :aria-busy="!paypalReady" />
            <p v-if="!paypalReady && !payError" class="sf-muted">{{ w('Chargement du bouton PayPal…') }}</p>
          </div>
          <!-- Alma: what will be taken and when, then Alma's own payment page -->
          <div v-else-if="byAlma" class="sf-co-alma">
            <p v-if="state.Pay.Alma.TestMode" class="sf-co-test">{{ w('Mode test : aucun paiement réel. Utilisez une carte de test Alma.') }}</p>
            <div v-if="almaMethods.length > 1" class="sf-co-alma-tabs" role="group" :aria-label="w('Nombre de fois')">
              <button v-for="m in almaMethods" :key="m.IdPayment" type="button" :class="{ 'is-on': payment === m.IdPayment }" :aria-pressed="payment === m.IdPayment" :disabled="almaOff(m) || paying" @click="payment = m.IdPayment">{{ w('{a} fois', { a: almaCount(m) }) }}</button>
            </div>
            <template v-if="almaPlan?.Eligible">
              <ol class="sf-co-alma-plan">
                <li v-for="(step, index) in almaPlan.Schedule" :key="index"><span>{{ index === 0 ? w('Aujourd\'hui') : shortDate(step.Date) }}</span><strong>{{ money(step.Amount, total.Currency, lang) }}</strong></li>
              </ol>
              <p class="sf-total-note">{{ almaPlan.CustomerFee > 0 ? w('Dont frais : {a}. Total : {b}.', { a: money(almaPlan.CustomerFee, total.Currency, lang), b: money(almaPlan.Total, total.Currency, lang) }) : w('Sans frais. Total : {a}.', { a: money(almaPlan.Total, total.Currency, lang) }) }}</p>
              <button type="button" class="sf-btn sf-summary-go" :disabled="paying || !ready" @click="payAlma">{{ paying ? w('Redirection vers Alma…') : w('Payer avec Alma') }}</button>
              <p class="sf-total-note">{{ w('Vous serez redirigé vers la page de paiement sécurisée d\'Alma.') }}</p>
            </template>
            <p v-else-if="almaAsked" class="sf-muted">{{ w('Ce paiement en plusieurs fois n\'est pas disponible pour ce montant.') }}</p>
            <p v-else class="sf-muted" aria-live="polite">{{ w('Calcul de vos échéances…') }}</p>
          </div>
          <button v-else type="button" class="sf-btn sf-summary-go" disabled>{{ w('Commander') }}</button>
          <p v-if="(byCard || byPaypal || byAlma) && !ready" class="sf-total-note">{{ w('Validez vos coordonnées et choisissez la livraison pour payer.') }}</p>
          <p v-else-if="!payment" class="sf-total-note">{{ w('Choisissez un moyen de paiement.') }}</p>
          <p v-else-if="!byCard && !byPaypal && !byAlma" class="sf-total-note">{{ w('Ce moyen de paiement n\'est pas encore disponible sur ce site.') }}</p>
          </template>
          <p v-if="section?.Texts?.Legal" class="sf-co-legal">{{ section.Texts.Legal }}</p>
        </section>
      </div>

      <aside class="sf-summary sf-co-summary" :aria-label="w('Récapitulatif')">
        <div class="sf-co-head"><h2>{{ w('Votre commande') }}</h2><a :href="cartUrl" class="sf-link">{{ w('Modifier mon panier') }}</a></div>
        <ul class="sf-co-lines">
          <li v-for="line in total.Lines" :key="line.IdProduct + '-' + line.IdProductAttribute">
            <span class="sf-line-pic"><img v-if="line.Image" :src="line.Image" alt="" loading="lazy"></span>
            <span class="sf-line-main"><span class="sf-line-name">{{ line.Name }}</span><span v-if="line.Variant" class="sf-line-variant">{{ w('Taille') }} : {{ line.Variant }}</span><span class="sf-line-variant">{{ w('Quantité') }} : {{ line.Quantity }}</span></span>
            <span class="sf-line-price">{{ money(line.Total, total.Currency, lang) }}</span>
          </li>
        </ul>
        <template v-if="options.ShowPromoCode !== false">
          <p v-if="cartError" class="sf-cart-error" role="alert">{{ w(cartError) }}</p>
          <form class="sf-code" @submit.prevent="applyPromo"><input v-model="promo" type="text" name="code" maxlength="60" :placeholder="w('Code promo')" :aria-label="w('Code promo')" autocomplete="off"><button type="submit" class="sf-btn is-outline" :disabled="cartBusy || !promo.trim()">{{ w('Appliquer') }}</button></form>
          <div v-for="applied in total.Codes || []" :key="applied.Id" class="sf-total-row is-code"><span>{{ applied.Code }} <button type="button" :disabled="cartBusy" :aria-label="w('Retirer le code {a}', { a: applied.Code })" @click="dropPromo(applied.Id)">✕</button></span><span>{{ applied.FreeDelivery && !applied.Amount ? w('Livraison offerte') : '−' + money(applied.Amount, total.Currency, lang) }}</span></div>
        </template>
        <div class="sf-total-row"><span>{{ w('Articles ({a})', { a: total.Count }) }}</span><span>{{ money(taxExcl ? total.ProductsTaxExcl : total.Products, total.Currency, lang) }}</span></div>
        <div v-if="total.Discount" class="sf-total-row"><span>{{ w('Réduction') }}</span><span>−{{ money(total.Discount, total.Currency, lang) }}</span></div>
        <div class="sf-total-row"><span>{{ w('Livraison') }}<small v-if="total.CarrierTitle"> ({{ total.CarrierTitle }})</small></span><span>{{ total.IdCarrier ? (total.Shipping ? money(total.Shipping, total.Currency, lang) : w('Livraison gratuite')) : w('À choisir') }}</span></div>
        <template v-if="taxExcl">
          <div class="sf-total-row"><span>{{ w('Total H.T.') }}</span><span>{{ money(total.ToPayTaxExcl, total.Currency, lang) }}</span></div>
          <div class="sf-total-row"><span>{{ w('TVA') }}</span><span>{{ money(total.ToPay - total.ToPayTaxExcl, total.Currency, lang) }}</span></div>
        </template>
        <div class="sf-total-row is-main"><span>{{ w(taxExcl ? 'Total T.T.C.' : 'Total') }}</span><span>{{ money(total.ToPay, total.Currency, lang) }}</span></div>
        <template v-if="giftCards.length">
          <div v-for="card in giftCards" :key="card.Id" class="sf-total-row"><span>{{ w('Carte cadeau') }} {{ card.Code }}</span><span>−{{ money(card.Used, total.Currency, lang) }}</span></div>
          <div class="sf-total-row is-main"><span>{{ w('Reste à payer') }}</span><span>{{ money(leftToPay, total.Currency, lang) }}</span></div>
        </template>
        <ul v-if="reassurances.length" class="sf-reassure is-list">
          <li v-for="item in reassurances" :key="item.Id">
            <button v-if="item.Texts.Text" type="button" aria-haspopup="dialog" @click="told = item"><span aria-hidden="true"><SfIcon :name="item.Settings?.Icon || 'check'" :size="20" /></span><span>{{ item.Texts.Title }}</span><span aria-hidden="true">›</span></button>
            <div v-else><span aria-hidden="true"><SfIcon :name="item.Settings?.Icon || 'check'" :size="20" /></span><span>{{ item.Texts.Title }}</span></div>
          </li>
        </ul>
      </aside>
    </div>

    <!-- the text of a reassurance line -->
    <div v-if="told" class="sf-drawer" @keydown.esc="told = null">
      <div class="sf-drawer-veil" @click="told = null" />
      <aside class="sf-drawer-panel" role="dialog" aria-modal="true" :aria-label="told.Texts.Title" tabindex="-1">
        <header class="sf-drawer-head"><h2>{{ told.Texts.Title }}</h2><button type="button" :aria-label="w('Fermer')" @click="told = null">✕</button></header>
        <div class="sf-drawer-body sf-reassure-text">{{ told.Texts.Text }}</div>
      </aside>
    </div>

    <!-- the relay points of the chosen carrier -->
    <div v-if="relayFor" class="sf-drawer" @keydown.esc="relayFor = null">
      <div class="sf-drawer-veil" @click="relayFor = null" />
      <aside ref="relayPanel" class="sf-drawer-panel sf-relays" role="dialog" aria-modal="true" :aria-label="w('Choisir un point relais')" tabindex="-1">
        <header class="sf-drawer-head"><h2>{{ w('Choisir un point relais') }}</h2><button type="button" :aria-label="w('Fermer')" @click="relayFor = null">✕</button></header>
        <form class="sf-relays-near" @submit.prevent="loadRelays">
          <input v-model="relayNear.postcode" type="text" inputmode="numeric" maxlength="20" :placeholder="w('Code postal')" :aria-label="w('Code postal')" autocomplete="postal-code">
          <input v-model="relayNear.city" type="text" maxlength="100" :placeholder="w('Ville')" :aria-label="w('Ville')" autocomplete="address-level2">
          <button type="submit" class="sf-btn is-outline" :disabled="relayBusy">{{ w('Chercher') }}</button>
        </form>
        <p v-if="error" class="sf-cart-error" role="alert">{{ w(error) }}</p>
        <div class="sf-drawer-body">
          <p v-if="relayBusy" class="sf-muted">{{ w('Recherche des points relais…') }}</p>
          <p v-else-if="!relays.length" class="sf-muted">{{ w('Aucun point relais trouvé près de cette adresse.') }}</p>
          <ul v-else class="sf-relays-list">
            <li v-for="point in relays" :key="point.Id" :class="{ 'is-on': state.Cart.IdRelayPoint === point.Id }">
              <div class="sf-relays-top"><strong>{{ point.Name }}</strong><span v-if="point.Distance">{{ point.Distance >= 1000 ? (point.Distance / 1000).toFixed(1) + ' km' : point.Distance + ' m' }}</span></div>
              <div class="sf-relays-address">{{ point.Address }}<br>{{ point.Postcode }} {{ point.City }}</div>
              <div class="sf-relays-links">
                <button v-if="point.Hours.length" type="button" class="sf-link" :aria-expanded="relayOpen === point.Id" @click="relayOpen = relayOpen === point.Id ? '' : point.Id">{{ w('Horaires') }}</button>
                <a v-if="point.Latitude && point.Longitude" :href="mapUrl(point)" target="_blank" rel="noopener" class="sf-link">{{ w('Voir sur la carte') }}</a>
              </div>
              <dl v-if="relayOpen === point.Id" class="sf-relays-hours"><template v-for="line in point.Hours" :key="line.Day"><dt>{{ line.Day }}</dt><dd>{{ line.Text }}</dd></template></dl>
              <button type="button" class="sf-btn" :disabled="busy" @click="pickRelay(point)">{{ w('Choisir ce point relais') }}</button>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  </div>
</template>
