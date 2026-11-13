<script setup lang="ts">
// The order page: who orders and where to deliver, the delivery method, the payment method, and the summary beside. Shown on one page or one step after the other, as the shop chose in Digipart
// (Boutique en ligne > Préférences > Page de commande). The delivery and payment methods are those of the delivery country, in the order set on the country in Digipart.
// what the shop set on the « Commande » page of the site builder: the promo code field, the newsletter box, the words under the button, the reassurance lines
const props = defineProps<{ design?: any }>()
const section = computed(() => (props.design?.Sections || []).find((s: any) => s.Type === 'main_checkout') || null)
const options = computed(() => section.value?.Settings || {})
const reassurances = computed(() => (section.value?.Blocks || []).filter((b: any) => b.Type === 'reassurance' && b.Texts?.Title))
const told = ref<any>(null)   // the reassurance line whose text is shown in the panel
const marks: Record<string, string> = { check: '✓', shield: '🛡', truck: '🚚', return: '↺', support: '☎' }
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
function pay() { try { sessionStorage.setItem('sf-order-before', String(state.value?.LastOrder || 0)) } catch { /* the confirmation page then shows no order number */ } }
const changeCountry = () => { if (!identified.value) { load(form.CountryIsoCode) } }
const show = (n: number) => !steps.value || step.value === n
const locked = (n: number) => !steps.value && n > 1 && !identified.value
onMounted(() => load())
</script>

<template>
  <div class="sf-co">
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

        <!-- 1. who orders, and where to deliver -->
        <section v-show="show(1)" class="sf-co-block" aria-labelledby="sf-co-1">
          <div class="sf-co-head"><h2 id="sf-co-1">{{ w('Vos coordonnées') }}</h2>
            <button v-if="!state.Customer && !wantLogin" type="button" class="sf-link" @click="wantLogin = true">{{ w('Se connecter') }}</button>
            <button v-else-if="state.Customer" type="button" class="sf-link" :disabled="busy" @click="logout">{{ w('Ce n\'est pas vous ?') }}</button>
          </div>
          <form v-if="wantLogin && !state.Customer" class="sf-co-form" @submit.prevent="doLogin">
            <label class="is-wide">{{ w('Adresse e-mail') }}<input v-model="login.Email" type="email" autocomplete="username" required></label>
            <label class="is-wide">{{ w('Mot de passe') }}<input v-model="login.Password" type="password" autocomplete="current-password" required></label>
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
          <p v-if="!state.Payments.length" class="sf-muted">{{ w('Aucun moyen de paiement pour ce pays pour le moment.') }}</p>
          <div v-else class="sf-co-types">
            <button v-for="method in state.Payments" :key="method.IdPayment" type="button" class="sf-co-pay" :class="{ 'is-on': payment === method.IdPayment }" :aria-pressed="payment === method.IdPayment" :disabled="!method.Available || locked(3)" @click="payment = method.IdPayment">
              <span class="sf-radio" :class="{ 'is-on': payment === method.IdPayment }" /><span class="sf-co-option-main"><strong>{{ method.Title }}</strong><small>{{ method.Available ? method.Description : w('Indisponible pour ce montant') }}</small></span>
            </button>
          </div>
          <!-- paying is the next step of the engine: the button says so, and does not pretend to pay -->
          <button type="button" class="sf-btn sf-summary-go" disabled :title="w('Le paiement arrive bientôt sur ce site')">{{ w('Commander') }}</button>
          <p class="sf-total-note">{{ w('Le paiement en ligne n\'est pas encore branché sur ce site.') }}</p>
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
        <ul v-if="reassurances.length" class="sf-reassure">
          <li v-for="item in reassurances" :key="item.Id">
            <button v-if="item.Texts.Text" type="button" aria-haspopup="dialog" @click="told = item"><span aria-hidden="true">{{ marks[item.Settings?.Icon] || '✓' }}</span><span>{{ item.Texts.Title }}</span><span aria-hidden="true">›</span></button>
            <div v-else><span aria-hidden="true">{{ marks[item.Settings?.Icon] || '✓' }}</span><span>{{ item.Texts.Title }}</span></div>
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
