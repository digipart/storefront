<script setup lang="ts">
// The customer account: the menu on the left, the chosen part on the right (overview, profile, orders and one order, loyalty). A visitor who is not logged in sees the login forms.
const props = defineProps<{ section: string, id: string }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const { customer, loaded, busy, url, favoritesUrl, favorites, load, send, query } = useAccount()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const french = computed(() => lang.value === 'fr')
const names = computed(() => (french.value ? { profile: 'profil', orders: 'commandes', loyalty: 'fidelite', addresses: 'adresses', service: 'service-client', referral: 'parrainage' } : { profile: 'profile', orders: 'orders', loyalty: 'loyalty', addresses: 'addresses', service: 'customer-service', referral: 'referral' }))
const part = computed(() => { const found = Object.entries(names.value).find(([, slug]) => slug === props.section); return found ? found[0] : 'home' })
const menu = computed(() => [
  { key: 'home', label: 'Mon compte', href: url.value }, { key: 'profile', label: 'Mon profil', href: url.value + '/' + names.value.profile }, { key: 'orders', label: 'Mes commandes', href: url.value + '/' + names.value.orders }, { key: 'addresses', label: 'Mes adresses', href: url.value + '/' + names.value.addresses },
  { key: 'favorites', label: 'Mes favoris', href: favoritesUrl.value }, { key: 'loyalty', label: 'Fidélité', href: url.value + '/' + names.value.loyalty },
  { key: 'service', label: 'Service client', href: url.value + '/' + names.value.service },
  ...(site.value?.Features?.Referral ? [{ key: 'referral', label: 'Parrainage', href: url.value + '/' + names.value.referral }] : []),
])
const tracking = ref(false)
const birthday = ref('')
async function loyaltyAct(action: string) { error.value = ''; const answer = await send({ Action: action, Birthday: birthday.value }); error.value = answer.Error; if (!answer.Error) { await read('loyalty') } }
const data = ref<any>(null)
const waiting = ref(false)
const error = ref(''), note = ref('')
const form = reactive({ Firstname: '', Lastname: '', Phone: '', Birthday: '' })
const card = ref(false)

async function read(what: string, more: Record<string, string | number> = {}) {
  waiting.value = true; data.value = null
  try { data.value = await $fetch<any>('/api/storefront/account', { query: { ...query(), part: what, ...more } }) } catch { data.value = null } finally { waiting.value = false }
}
async function open() {
  if (!customer.value) { return }
  Object.assign(form, { Firstname: customer.value.Firstname, Lastname: customer.value.Lastname, Phone: customer.value.Phone, Birthday: '' })
  if (part.value === 'orders') { await read(props.id ? 'order' : 'orders', props.id ? { id: props.id } : {}) }
  if (part.value === 'loyalty') { await read('loyalty') }
  if (part.value === 'home') { await read('home') }
  if (part.value === 'addresses') { editing.value = null; await read('addresses') }
}
async function save() { error.value = ''; note.value = ''; const answer = await send({ Action: 'profile', ...form }); error.value = answer.Error; note.value = answer.Note }
async function newsletter(on: boolean) { error.value = ''; const answer = await send({ Action: 'newsletter', On: on }); error.value = answer.Error }
// the addresses book: one form, for a new address or the one being changed
const editing = ref<any>(null)
const blank = () => ({ IdAddress: 0, Alias: '', Firstname: customer.value?.Firstname || '', Lastname: customer.value?.Lastname || '', Company: '', Address1: '', Address2: '', Postcode: '', City: '', CountryIsoCode: data.value?.Countries?.[0]?.IsoCode || 'FR', MobilePhone: customer.value?.Phone || '' })
async function act(body: Record<string, unknown>) { error.value = ''; note.value = ''; const answer = await send(body); error.value = answer.Error; note.value = answer.Note; if (!answer.Error) { await read('addresses'); editing.value = null } }
const logout = async () => { await send({ Action: 'logout' }); data.value = null }
onMounted(async () => { if (!loaded.value) { await load() } await open() })
watch(() => [customer.value?.Email, props.section, props.id], open)
</script>

<template>
  <div class="sf-acc-page">
    <p v-if="!loaded" class="sf-cart-wait">{{ w('Chargement de votre compte…') }}</p>
    <div v-else-if="!customer || customer.Guest" class="sf-acc-login"><SfLogin /></div>
    <div v-else-if="site?.Pro && customer.Business && !customer.Active" class="sf-acc-login sf-login"><h2>{{ w('Compte en cours de validation') }}</h2><p>{{ w('Votre demande de compte professionnel est enregistrée. Notre équipe l\'active dans les plus brefs délais ; vous verrez alors les prix.') }}</p><button type="button" class="sf-link" :disabled="busy" @click="logout">{{ w('Se déconnecter') }}</button></div>
    <div v-else class="sf-acc-grid">
      <nav class="sf-acc-menu" :aria-label="w('Mon compte')">
        <p class="sf-acc-hello">{{ w('Bonjour') }} <strong>{{ customer.Firstname }}</strong></p>
        <a v-for="item in menu" :key="item.key" :href="item.href" :aria-current="part === item.key ? 'page' : undefined">{{ w(item.label) }}<span v-if="item.key === 'favorites' && favorites.length"> ({{ favorites.length }})</span></a>
        <button type="button" class="sf-link" :disabled="busy" @click="logout">{{ w('Se déconnecter') }}</button>
      </nav>
      <div class="sf-acc-main">
        <p v-if="error" class="sf-cart-error" role="alert">{{ w(error) }}</p>
        <p v-if="note" class="sf-note-ok" role="status">{{ w(note) }}</p>

        <!-- the overview: the profile in short, the loyalty points, the shortcuts -->
        <template v-if="part === 'home'">
          <h1>{{ w('Mon compte') }}</h1>
          <div class="sf-acc-cards">
            <a :href="menu[1].href" class="sf-acc-card"><h2>{{ w('Mon profil') }}</h2><span>{{ customer.Firstname }} {{ customer.Lastname }}</span><span>{{ customer.Email }}</span></a>
            <a v-if="data?.LastOrder" :href="menu[2].href + '/' + data.LastOrder.Id" class="sf-acc-card is-order">
              <h2>{{ w('Ma dernière commande') }}</h2>
              <span class="sf-acc-card-order"><img v-if="data.LastOrder.Images[0]" :src="data.LastOrder.Images[0]" alt="" loading="lazy"><span><strong>{{ w('Commande n° {a}', { a: data.LastOrder.Id }) }}</strong><span>{{ data.LastOrder.Date }}</span><span class="sf-acc-state">{{ data.LastOrder.State }}</span></span></span>
              <span>{{ money(data.LastOrder.Total, data.Currency, lang) }}</span>
            </a>
            <a :href="menu[2].href" class="sf-acc-card"><h2>{{ w('Mes commandes') }}</h2><span>{{ w(data?.Orders ? (data.Orders > 1 ? '{a} commandes' : '{a} commande') : 'Suivre une commande, revoir un achat', { a: data?.Orders || 0 }) }}</span></a>
            <a v-if="data?.Loyalty" :href="menu[5].href" class="sf-acc-card"><h2>{{ w('Fidélité') }}</h2><span class="sf-acc-points">{{ data.Loyalty.Points }} {{ w('points') }}</span><span v-if="data.Loyalty.Tier">{{ data.Loyalty.Tier }}</span></a>
            <a :href="menu[4].href" class="sf-acc-card"><h2>{{ w('Mes favoris') }}</h2><span>{{ w(favorites.length > 1 ? '{a} articles' : '{a} article', { a: favorites.length }) }}</span></a>
          </div>
        </template>

        <template v-else-if="part === 'profile'">
          <h1>{{ w('Mon profil') }}</h1>
          <form class="sf-co-form" @submit.prevent="save">
            <label>{{ w('Prénom') }}<input v-model="form.Firstname" type="text" autocomplete="given-name" maxlength="60" required></label>
            <label>{{ w('Nom') }}<input v-model="form.Lastname" type="text" autocomplete="family-name" maxlength="60" required></label>
            <label class="is-wide">{{ w('Adresse e-mail') }}<input :value="customer.Email" type="email" disabled></label>
            <label>{{ w('Téléphone') }}<input v-model="form.Phone" type="tel" autocomplete="tel" maxlength="30"></label>
            <label>{{ w('Date de naissance') }}<input v-model="form.Birthday" type="date" autocomplete="bday"><small v-if="customer.Birthday">{{ w('Enregistrée : {a}', { a: customer.Birthday }) }}</small></label>
            <div class="sf-co-actions is-wide"><button type="submit" class="sf-btn" :disabled="busy">{{ w('Enregistrer') }}</button></div>
          </form>
          <h2 class="sf-acc-sub">{{ w('Newsletter') }}</h2>
          <label class="sf-check"><input type="checkbox" :checked="customer.Newsletter" :disabled="busy" @change="newsletter(($event.target as HTMLInputElement).checked)"><span>{{ w('Recevoir les nouveautés et les offres par e-mail') }}</span></label>
        </template>

        <template v-else-if="part === 'orders' && !id">
          <h1>{{ w('Mes commandes') }}</h1>
          <p v-if="waiting" class="sf-muted">{{ w('Chargement…') }}</p>
          <p v-else-if="!data?.Orders?.length" class="sf-muted">{{ w('Vous n\'avez pas encore passé de commande.') }}</p>
          <ul v-else class="sf-acc-orders">
            <li v-for="order in data.Orders" :key="order.Id">
              <div class="sf-acc-order-pics"><img v-for="src in order.Images" :key="src" :src="src" alt="" loading="lazy"></div>
              <div class="sf-acc-order-main"><strong>{{ w('Commande n° {a}', { a: order.Id }) }}</strong><span>{{ order.Date }}</span><span class="sf-acc-state">{{ order.State }}</span></div>
              <div class="sf-acc-order-side"><strong>{{ money(order.Total, data.Currency, lang) }}</strong><a :href="menu[2].href + '/' + order.Id" class="sf-link">{{ w('Voir la commande') }}</a><a v-if="order.Return.Url" :href="order.Return.Url" target="_blank" rel="noopener" class="sf-link">{{ w('Retourner un article') }}</a></div>
            </li>
          </ul>
          <nav v-if="data?.Pages > 1" class="sf-pages" :aria-label="w('Pages')">
            <span>{{ w('Page {a} sur {b}', { a: data.Page, b: data.Pages }) }}</span>
            <button v-if="data.Page > 1" type="button" class="sf-link" @click="read('orders', { page: data.Page - 1 })">{{ w('Page précédente') }}</button>
            <button v-if="data.Page < data.Pages" type="button" class="sf-link" @click="read('orders', { page: data.Page + 1 })">{{ w('Page suivante') }}</button>
          </nav>
        </template>

        <template v-else-if="part === 'orders'">
          <a :href="menu[2].href" class="sf-link">‹ {{ w('Mes commandes') }}</a>
          <p v-if="waiting" class="sf-muted">{{ w('Chargement…') }}</p>
          <p v-else-if="!data?.Order" class="sf-muted">{{ w('Cette commande est introuvable.') }}</p>
          <template v-else>
            <h1>{{ w('Commande n° {a}', { a: data.Order.Id }) }}</h1>
            <p class="sf-muted">{{ data.Order.Date }} · <span class="sf-acc-state">{{ data.Order.State }}</span></p>
            <ul class="sf-co-lines sf-acc-lines">
              <li v-for="line in data.Order.Lines" :key="line.Reference + line.Variant">
                <a :href="line.Url" class="sf-line-pic" tabindex="-1" aria-hidden="true"><img v-if="line.Image" :src="line.Image" alt="" loading="lazy"></a>
                <span class="sf-line-main"><a :href="line.Url" class="sf-line-name">{{ line.Name }}</a><span v-if="line.Variant" class="sf-line-variant">{{ line.Variant }}</span><span class="sf-line-variant">{{ w('Quantité') }} : {{ line.Quantity }}</span></span>
                <span class="sf-line-price">{{ money(line.Total, data.Order.Currency, lang) }}</span>
              </li>
            </ul>
            <div class="sf-acc-two">
              <div>
                <div class="sf-total-row"><span>{{ w('Articles') }}</span><span>{{ money(data.Order.Products, data.Order.Currency, lang) }}</span></div>
                <div v-if="data.Order.Discount" class="sf-total-row"><span>{{ w('Réduction') }}</span><span>−{{ money(data.Order.Discount, data.Order.Currency, lang) }}</span></div>
                <div class="sf-total-row"><span>{{ w('Livraison') }}</span><span>{{ data.Order.Shipping ? money(data.Order.Shipping, data.Order.Currency, lang) : w('Livraison gratuite') }}</span></div>
                <div class="sf-total-row is-main"><span>{{ w('Total') }}</span><span>{{ money(data.Order.Paid, data.Order.Currency, lang) }}</span></div>
                <p v-if="data.Order.Payment" class="sf-total-note">{{ w('Paiement : {a}', { a: data.Order.Payment }) }}</p>
              </div>
              <div class="sf-acc-where">
                <template v-if="data.Order.DeliveryAddress"><h2>{{ w('Livraison') }}</h2><p>{{ data.Order.DeliveryAddress.Name }}<br>{{ data.Order.DeliveryAddress.Line }}<br>{{ data.Order.DeliveryAddress.City }}<br>{{ data.Order.DeliveryAddress.Country }}</p></template>
                <p v-if="data.Order.Carrier">{{ data.Order.Carrier }}<template v-if="data.Order.TrackingNumber"> · {{ w('Suivi') }} {{ data.Order.TrackingNumber }}</template></p>
                <p><button type="button" class="sf-btn is-outline" aria-haspopup="dialog" @click="tracking = true">{{ w('Suivre ma livraison') }}</button></p>
                <LazySfTracking v-if="tracking" :order="data.Order.Id" @close="tracking = false" />
                <template v-if="data.Order.Return.Available">
                  <h2>{{ w('Retour') }}</h2>
                  <p>{{ data.Order.Return.Until ? w('Vous pouvez retourner cette commande jusqu\'au {a}.', { a: data.Order.Return.Until }) : w('Vous pouvez retourner cette commande.') }}</p>
                  <a v-if="data.Order.Return.Url" :href="data.Order.Return.Url" target="_blank" rel="noopener" class="sf-btn">{{ w('Retourner un article') }}</a>
                </template>
                <a v-if="data.Order.TrackingUrl" :href="data.Order.TrackingUrl" target="_blank" rel="noopener" class="sf-btn is-outline">{{ w('Suivre mon colis') }}</a>
              </div>
            </div>
          </template>
        </template>

        <template v-else-if="part === 'addresses'">
          <h1>{{ w('Mes adresses') }}</h1>
          <p v-if="waiting" class="sf-muted">{{ w('Chargement…') }}</p>
          <form v-else-if="editing" class="sf-co-form" @submit.prevent="act({ Action: 'address', ...editing })">
            <label>{{ w('Prénom') }}<input v-model="editing.Firstname" type="text" autocomplete="given-name" maxlength="60" required></label>
            <label>{{ w('Nom') }}<input v-model="editing.Lastname" type="text" autocomplete="family-name" maxlength="60" required></label>
            <label class="is-wide">{{ w('Société (facultatif)') }}<input v-model="editing.Company" type="text" autocomplete="organization" maxlength="100"></label>
            <label class="is-wide">{{ w('Adresse') }}<input v-model="editing.Address1" type="text" autocomplete="address-line1" maxlength="150" required></label>
            <label class="is-wide">{{ w('Complément d\'adresse (facultatif)') }}<input v-model="editing.Address2" type="text" autocomplete="address-line2" maxlength="150"></label>
            <label>{{ w('Code postal') }}<input v-model="editing.Postcode" type="text" autocomplete="postal-code" maxlength="20" required></label>
            <label>{{ w('Ville') }}<input v-model="editing.City" type="text" autocomplete="address-level2" maxlength="100" required></label>
            <label>{{ w('Pays') }}<select v-model="editing.CountryIsoCode" autocomplete="country"><option v-for="country in data?.Countries || []" :key="country.IsoCode" :value="country.IsoCode">{{ country.Name }}</option></select></label>
            <label>{{ w('Téléphone') }}<input v-model="editing.MobilePhone" type="tel" autocomplete="tel" maxlength="30" required></label>
            <div class="sf-co-actions is-wide"><button type="submit" class="sf-btn" :disabled="busy">{{ w('Enregistrer') }}</button><button type="button" class="sf-link" @click="editing = null">{{ w('Annuler') }}</button></div>
          </form>
          <template v-else>
            <p v-if="!data?.Addresses?.length" class="sf-muted">{{ w('Vous n\'avez pas encore d\'adresse.') }}</p>
            <ul v-else class="sf-acc-addresses">
              <li v-for="address in data.Addresses" :key="address.IdAddress">
                <span v-if="address.IsDelivery" class="sf-acc-state">{{ w('Adresse par défaut') }}</span>
                <strong>{{ address.Firstname }} {{ address.Lastname }}</strong>
                <span v-if="address.Company">{{ address.Company }}</span><span>{{ address.Address1 }}<template v-if="address.Address2">, {{ address.Address2 }}</template></span><span>{{ address.Postcode }} {{ address.City }}, {{ address.Country }}</span><span>{{ address.MobilePhone }}</span>
                <div class="sf-co-actions">
                  <button type="button" class="sf-link" @click="editing = { ...address }">{{ w('Modifier') }}</button>
                  <button v-if="!address.IsDelivery" type="button" class="sf-link" :disabled="busy" @click="act({ Action: 'address-default', IdAddress: address.IdAddress })">{{ w('Utiliser par défaut') }}</button>
                </div>
              </li>
            </ul>
            <div><button type="button" class="sf-btn is-outline" @click="editing = blank()">{{ w('Ajouter une adresse') }}</button></div>
          </template>
        </template>

        <template v-else-if="part === 'loyalty'">
          <h1>{{ w('Fidélité') }}</h1>
          <p v-if="waiting" class="sf-muted">{{ w('Chargement…') }}</p>
          <template v-else-if="!data?.Loyalty">
            <p>{{ w('Rejoignez le programme de fidélité : chaque commande vous rapporte des points, à échanger contre des récompenses.') }}</p>
            <form class="sf-form sf-acc-join" @submit.prevent="loyaltyAct('loyalty-join')">
              <label>{{ w('Date de naissance') }}<input v-model="birthday" type="date" autocomplete="bday" required></label>
              <div><button type="submit" class="sf-btn" :disabled="busy">{{ w('Rejoindre le programme') }}</button></div>
            </form>
          </template>
          <template v-else>
            <div class="sf-acc-loyal">
              <div class="sf-acc-ring"><strong>{{ data.Loyalty.Points }}</strong><span>{{ w('points') }}</span><em v-if="data.Loyalty.Tier">{{ data.Loyalty.Tier }}</em></div>
              <div class="sf-acc-loyal-main">
                <p v-if="data.Loyalty.Program" class="sf-acc-program">{{ data.Loyalty.Program }}</p>
                <template v-if="data.Loyalty.Next">
                  <div class="sf-acc-bar" role="progressbar" :aria-valuenow="data.Loyalty.Next.Done" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: data.Loyalty.Next.Done + '%' }" /></div>
                  <p class="sf-total-note">{{ w('Plus que {a} points pour obtenir le statut {b}', { a: data.Loyalty.Next.Missing, b: data.Loyalty.Next.Name }) }}</p>
                </template>
                <p v-if="data.Loyalty.RewardMissing" class="sf-total-note">{{ w('Plus que {a} points avant la prochaine récompense !', { a: data.Loyalty.RewardMissing }) }}</p>
                <button v-if="data.Loyalty.Barcode" type="button" class="sf-btn" :aria-expanded="card" @click="card = !card">{{ w(card ? 'Masquer ma carte fidélité' : 'Afficher ma carte fidélité') }}</button>
                <div v-if="card && data.Loyalty.Barcode" class="sf-acc-cardbox"><img :src="data.Loyalty.Barcode" :alt="w('Code-barres de la carte {a}', { a: data.Loyalty.CardNumber })"><span>N° {{ data.Loyalty.CardNumber }}</span></div>
                <a v-if="data.Wallet" :href="data.Wallet" target="_blank" rel="noopener" class="sf-btn is-outline">{{ w('Ajouter à Google Wallet') }}</a>
              </div>
            </div>
            <LazySfRewards v-if="data.Rewards?.Member" :rewards="data.Rewards" @changed="read('loyalty')" />
            <h2 class="sf-acc-sub">{{ w('Historique') }}</h2>
            <p v-if="!data.Loyalty.History.length" class="sf-muted">{{ w('Aucun mouvement de points pour le moment.') }}</p>
            <ul v-else class="sf-acc-history"><li v-for="(item, index) in data.Loyalty.History" :key="index"><span>{{ item.Label }}<small>{{ item.Date }}</small></span><strong>{{ item.Points > 0 ? '+' : '' }}{{ item.Points }}</strong></li></ul>
            <p class="sf-acc-leave"><button type="button" class="sf-link" :disabled="busy" @click="loyaltyAct('loyalty-leave')">{{ w('Quitter le programme de fidélité') }}</button></p>
          </template>
        </template>

        <LazySfService v-else-if="part === 'service'" :id="id" :base="menu[6].href" />
        <LazySfReferral v-else-if="part === 'referral'" />
      </div>
    </div>
  </div>
</template>
