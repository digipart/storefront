<script setup lang="ts">
// SfStoreStock: « Disponibilité en boutique » and « Réserver en boutique », in one side panel. On top, the sizes the visitor looks for (several at once); under them, the shops, each with its photo,
// whether it is open now, the stock of each size there (in stock, last pieces, none), and « Afficher les options »: reserve, the way there, call the shop. The nearest come first when the visitor shares
// their position; a search finds a town, a post code or a shop. The stock is the one of the location tied to each shop (server/api/storefront/store-stock.get.ts); a reservation is a request
// « À confirmer » the shop answers by phone or e-mail (server/api/storefront/reserve.post.ts). `reserve` false: the panel only tells where the product is.
const props = defineProps<{ product: any, variant?: number, reserve?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const w = useWords()
const site = inject<Ref<any> | null>('sfSite', null)
const { customer } = useAccount()
const sizes = computed(() => (props.product?.Variants || []).filter((v: any) => v.Label))
const oneColor = computed(() => new Set(sizes.value.map((v: any) => v.Color || '')).size <= 1)
const sizeName = (v: any) => (oneColor.value && v.Size ? v.Size : v.Label)
// the sizes looked for (none: every size)
const wanted = ref<number[]>(props.variant ? [props.variant] : [])
const toggleWanted = (id: number) => { wanted.value = wanted.value.includes(id) ? wanted.value.filter(x => x !== id) : [...wanted.value, id] }
const looked = computed(() => (wanted.value.length ? sizes.value.filter((v: any) => wanted.value.includes(v.Id)) : sizes.value))
const step = ref<'store' | 'contact' | 'done'>('store')

// the shops, read when the panel opens (and again with the visitor's position)
const stores = ref<any[]>([]), loading = ref(true), failed = ref(false)
const where = ref<{ Lat: number, Lng: number } | null>(null), locating = ref(false), locateError = ref('')
async function load() {
  loading.value = true; failed.value = false
  try { stores.value = (await $fetch<any>('/api/storefront/store-stock', { query: { IdProduct: props.product.Id, lang: site?.value?.Route?.LanguageIsoCode || '', ...(where.value || {}) } })).Stores || [] } catch { failed.value = true } finally { loading.value = false }
}
function locate() {
  if (!navigator.geolocation) { locateError.value = w('Votre navigateur ne donne pas votre position.'); return }
  locating.value = true; locateError.value = ''
  navigator.geolocation.getCurrentPosition((p) => { where.value = { Lat: Math.round(p.coords.latitude * 1000) / 1000, Lng: Math.round(p.coords.longitude * 1000) / 1000 }; locating.value = false; load() },
    () => { locating.value = false; locateError.value = w('Position refusée : cherchez une ville ou un code postal.') }, { timeout: 10000, maximumAge: 600000 })
}
// the stock of a size in a shop: a quantity, or null when Digipart does not follow the stock of this shop (the shop confirms)
const qtyOf = (s: any, id: number) => (!s.Known ? null : Number(s.Stock[id] || 0))
const sizeState = (s: any, v: any) => { const n = qtyOf(s, v.Id); return n === null ? 'unknown' : n <= 0 ? 'out' : n <= 2 ? 'low' : 'in' }
// the shop as a whole, for the sizes looked for
const state = (s: any) => {
  if (!s.Known) { return 'unknown' }
  const list = looked.value.length ? looked.value.map((v: any) => qtyOf(s, v.Id) || 0) : [Object.values(s.Stock as Record<string, number>).reduce((a, b) => a + b, 0)]
  const best = Math.max(0, ...list)
  return best <= 0 ? 'out' : list.some(n => n > 2) ? 'in' : 'low'
}
const label = (s: any) => ({ in: w('Disponible'), low: w('Dernières pièces'), out: w('Indisponible'), unknown: w('Disponibilité à confirmer par la boutique') } as Record<string, string>)[state(s)]
const search = ref(''), onlyStock = ref(false)
const plain = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const shown = computed(() => stores.value.filter((s: any) => (!onlyStock.value || ['in', 'low'].includes(state(s))) && (!search.value.trim() || plain([s.Name, s.City, s.PostalCode, s.Address].join(' ')).includes(plain(search.value.trim())))))
const options = ref<number>(0)

// open now? From the opening hours of the shop (Lundi… or Monday…, slots « 10:30 – 19:30 »): « Ouvert jusqu'à 19:30 », « Ouvre à 14:00 », « Ouvre demain à 11:00 », « Ouvre lundi à 11:00 »
const DAYS: Record<string, number> = { dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6, domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 }
const minutes = (hhmm: string) => { const m = hhmm.match(/(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : -1 }
const now = ref(new Date())
const openState = (s: any) => {
  const byDay: Record<number, { from: number, to: number, label: string, at: string }[]> = {}
  for (const d of s.Hours || []) {
    const day = Number.isInteger(d.Weekday) ? d.Weekday : DAYS[plain(String(d.Day)).trim()]   // the weekday Digipart gives (0 = Sunday), else read from the name
    if (day === undefined) { continue }
    byDay[day] = String(d.Slots || '').split(',').map((slot: string) => { const [a, b] = slot.split(/[–-]/).map(x => x.trim()); return { from: minutes(a || ''), to: minutes(b || ''), label: String(d.Day), at: a || '' } }).filter(x => x.from >= 0 && x.to > x.from)
  }
  if (!Object.keys(byDay).length) { return null }
  const today = now.value.getDay(), at = now.value.getHours() * 60 + now.value.getMinutes()
  const open = (byDay[today] || []).find(x => at >= x.from && at < x.to)
  if (open) { return { open: true, text: w('Ouvert jusqu\'à {a}', { a: String(Math.floor(open.to / 60)).padStart(2, '0') + ':' + String(open.to % 60).padStart(2, '0') }) } }
  const later = (byDay[today] || []).find(x => x.from > at)
  if (later) { return { open: false, text: w('Ouvre à {a}', { a: later.at }) } }
  for (let k = 1; k <= 7; k++) {
    const next = (byDay[(today + k) % 7] || [])[0]
    if (next) { return { open: false, text: k === 1 ? w('Ouvre demain à {a}', { a: next.at }) : w('Ouvre {a} à {b}', { a: next.label.toLowerCase(), b: next.at }) } }
  }
  return null
}

// the reservation: the shop, then the size (the one looked for, or chosen among those of the shop) and the visitor's details
const store = ref<any>(null)
const size = ref(0)
const form = reactive({ Quantity: 1, Firstname: '', Lastname: '', Email: '', MobilePhone: '', Website: '' })
watch(customer, (now: any) => { if (now && !now.Guest) { form.Firstname = form.Firstname || now.Firstname || ''; form.Lastname = form.Lastname || now.Lastname || ''; form.Email = form.Email || now.Email || ''; form.MobilePhone = form.MobilePhone || now.Phone || '' } }, { immediate: true })
const storeSizes = computed(() => (store.value ? sizes.value.filter((v: any) => sizeState(store.value, v) !== 'out') : []))
const most = computed(() => { const n = store.value && size.value ? qtyOf(store.value, size.value) : null; return Math.max(1, Math.min(5, n === null ? 5 : n)) })
const busy = ref(false), error = ref('')
const reservable = (s: any) => props.reserve !== false && state(s) !== 'out'
function pickStore(s: any) {
  store.value = s; form.Quantity = 1; error.value = ''
  const candidates = sizes.value.filter((v: any) => sizeState(s, v) !== 'out' && (!wanted.value.length || wanted.value.includes(v.Id)))
  size.value = candidates.length === 1 ? candidates[0].Id : 0
  step.value = 'contact'
}
async function send() {
  if (busy.value || !store.value) { return }
  if (sizes.value.length && !size.value) { error.value = w('Choisissez une taille.'); return }
  busy.value = true; error.value = ''
  try {
    const answer = await $fetch<any>('/api/storefront/reserve', { method: 'POST', body: { ...form, IdStore: store.value.Id, IdProduct: props.product.Id, IdProductAttribute: size.value || 0 } })
    if (answer.Done) { step.value = 'done' } else { error.value = w(answer.Error || 'La réservation n\'a pas pu être enregistrée, merci de réessayer.') }
  } catch { error.value = w('La réservation n\'a pas pu être enregistrée, merci de réessayer.') } finally { busy.value = false }
}
const chosenSize = computed(() => sizes.value.find((v: any) => v.Id === size.value))

const panel = ref<HTMLElement | null>(null)
let clock: ReturnType<typeof setInterval> | null = null
onMounted(() => { document.documentElement.style.overflow = 'hidden'; nextTick(() => panel.value?.focus()); load(); clock = setInterval(() => { now.value = new Date() }, 60000) })
onBeforeUnmount(() => { document.documentElement.style.overflow = ''; if (clock) { clearInterval(clock) } })
</script>

<template>
  <Teleport to="body">
    <div class="sf-drawer" @keydown.esc="emit('close')">
      <div class="sf-drawer-veil" @click="emit('close')" />
      <aside ref="panel" class="sf-drawer-panel sf-ss" role="dialog" aria-modal="true" :aria-label="w(reserve !== false ? 'Disponibilité et réservation en boutique' : 'Disponibilité en boutique')" tabindex="-1">
        <header class="sf-drawer-head"><h2>{{ w(step === 'contact' ? 'Réserver en boutique' : 'Disponibilité en boutique') }}</h2><button type="button" :aria-label="w('Fermer')" @click="emit('close')">✕</button></header>
        <div class="sf-drawer-body">
          <!-- 1. the shops -->
          <section v-if="step === 'store'">
            <template v-if="sizes.length > 1">
              <p class="sf-ss-label">{{ w('Filtrer la ou les tailles de votre choix :') }}</p>
              <div class="sf-ss-filter" role="group" :aria-label="w('Taille')">
                <button v-for="v in sizes" :key="v.Id" type="button" :class="{ 'is-on': wanted.includes(v.Id) }" :aria-pressed="wanted.includes(v.Id)" @click="toggleWanted(v.Id)">{{ sizeName(v) }}</button>
              </div>
            </template>
            <div class="sf-stores-search">
              <input v-model="search" type="search" :placeholder="w('Ville, code postal ou boutique')" :aria-label="w('Ville, code postal ou boutique')">
              <button type="button" class="sf-stores-near" :disabled="locating" @click="locate">{{ w(locating ? 'Localisation…' : 'Autour de moi') }}</button>
            </div>
            <p v-if="locateError" class="sf-form-error">{{ locateError }}</p>
            <label class="sf-switch"><input v-model="onlyStock" type="checkbox"><span />{{ w('En stock seulement') }}</label>
            <p v-if="loading" class="sf-muted">{{ w('Recherche des boutiques…') }}</p>
            <p v-else-if="failed" class="sf-form-error">{{ w('Les boutiques n\'ont pas pu être lues, merci de réessayer.') }} <button type="button" class="sf-link" @click="load">{{ w('Réessayer') }}</button></p>
            <p v-else-if="!shown.length" class="sf-muted">{{ w(stores.length ? 'Aucune boutique ne correspond.' : 'Aucune boutique ne montre son stock pour le moment.') }}</p>
            <ul v-else class="sf-ss-list">
              <li v-for="s in shown" :key="s.Id" class="sf-ss-store" :class="{ 'has-photo': s.Images?.length }">
                <div class="sf-ss-store-main">
                  <img v-if="s.Images?.length" :src="s.Images[0]" alt="" class="sf-ss-store-photo" loading="lazy" decoding="async">
                  <div class="sf-ss-store-body">
                    <div class="sf-ss-store-head"><strong>{{ s.Name }}</strong><small v-if="s.Distance !== null">{{ s.Distance < 10 ? s.Distance.toLocaleString() : Math.round(s.Distance) }} km</small></div>
                    <p class="sf-ss-store-address">{{ [s.Address, [s.PostalCode, s.City].filter(Boolean).join(' ')].filter(Boolean).join(', ') }}</p>
                    <p v-if="openState(s)" class="sf-ss-open" :class="{ 'is-open': openState(s)!.open }"><i aria-hidden="true" />{{ openState(s)!.text }}</p>
                    <div v-if="s.Known && sizes.length" class="sf-ss-sizes" :aria-label="w('Tailles en boutique')">
                      <span v-for="v in looked" :key="v.Id" :class="'is-' + sizeState(s, v)" :title="w(sizeState(s, v) === 'out' ? 'Indisponible' : sizeState(s, v) === 'low' ? 'Dernières pièces' : 'Disponible')">{{ sizeName(v) }}<i v-if="sizeState(s, v) === 'low'" aria-hidden="true" /></span>
                    </div>
                    <p class="sf-ss-store-state" :class="'is-' + state(s)"><i aria-hidden="true" />{{ label(s) }}</p>
                    <button type="button" class="sf-link sf-ss-more" :aria-expanded="options === s.Id" @click="options = options === s.Id ? 0 : s.Id">{{ w(options === s.Id ? 'Masquer les options' : 'Afficher les options') }}</button>
                  </div>
                </div>
                <div v-if="options === s.Id" class="sf-ss-options">
                  <button v-if="reservable(s)" type="button" @click="pickStore(s)"><span>{{ w('Réserver en boutique') }}</span><b aria-hidden="true">›</b></button>
                  <a :href="s.MapsUrl" target="_blank" rel="noopener"><span>{{ w('Itinéraire') }}</span><b aria-hidden="true">›</b></a>
                  <a v-if="s.Phone" :href="'tel:' + s.Phone.replace(/[^+0-9]/g, '')"><span>{{ w('Contacter la boutique') }} : {{ s.Phone }}</span><b aria-hidden="true">›</b></a>
                  <dl v-if="s.Hours.length" class="sf-ss-store-hours"><template v-for="d in s.Hours" :key="d.Day"><dt>{{ d.Day }}</dt><dd>{{ d.Slots || w('Fermé') }}</dd></template></dl>
                </div>
              </li>
            </ul>
          </section>

          <!-- 2. the visitor -->
          <section v-else-if="step === 'contact' && store">
            <button type="button" class="sf-link sf-ss-back" @click="step = 'store'">‹ {{ w('Toutes les boutiques') }}</button>
            <div class="sf-stores-product">
              <img v-if="product.Images?.[0]" :src="product.Images[0]" alt="" loading="lazy" decoding="async">
              <div><p class="sf-stores-name">{{ product.Name }}</p><p v-if="product.Reference" class="sf-muted">{{ product.Reference }}</p><div class="sf-card-price"><SfPrice :product="product" /></div></div>
            </div>
            <div class="sf-ss-store is-chosen">
              <div class="sf-ss-store-head"><strong>{{ store.Name }}</strong><button type="button" class="sf-link" @click="step = 'store'">{{ w('Modifier') }}</button></div>
              <p class="sf-ss-store-address">{{ [store.Address, [store.PostalCode, store.City].filter(Boolean).join(' ')].filter(Boolean).join(', ') }}</p>
            </div>
            <form class="sf-form" @submit.prevent="send">
              <div v-if="sizes.length">
                <p class="sf-ss-label">{{ w('Taille') }}</p>
                <div class="sf-ss-filter" role="group" :aria-label="w('Taille')">
                  <button v-for="v in storeSizes" :key="v.Id" type="button" :class="{ 'is-on': size === v.Id }" :aria-pressed="size === v.Id" @click="size = v.Id">{{ sizeName(v) }}</button>
                </div>
              </div>
              <label>{{ w('Quantité') }}
                <span class="sf-qty"><button type="button" :disabled="form.Quantity <= 1" :aria-label="w('Moins')" @click="form.Quantity--">−</button><output>{{ form.Quantity }}</output><button type="button" :disabled="form.Quantity >= most" :aria-label="w('Plus')" @click="form.Quantity++">+</button></span>
              </label>
              <div class="sf-form-row">
                <label>{{ w('Prénom') }}<input v-model="form.Firstname" type="text" autocomplete="given-name" maxlength="80" required></label>
                <label>{{ w('Nom') }}<input v-model="form.Lastname" type="text" autocomplete="family-name" maxlength="80" required></label>
              </div>
              <label>{{ w('E-mail') }}<input v-model="form.Email" type="email" autocomplete="email" maxlength="100" required></label>
              <label>{{ w('Téléphone mobile') }}<input v-model="form.MobilePhone" type="tel" autocomplete="tel" maxlength="20" required></label>
              <input v-model="form.Website" type="text" name="website" class="sf-sr" tabindex="-1" autocomplete="off" aria-hidden="true">
              <p class="sf-alert-note">{{ w('La boutique met le produit de côté et vous confirme la réservation par téléphone ou par e-mail. Aucun paiement maintenant : vous réglez en boutique.') }}</p>
              <p v-if="error" class="sf-form-error" role="alert">{{ error }}</p>
              <button type="submit" class="sf-btn" :disabled="busy">{{ w(busy ? 'Envoi…' : 'Confirmer la réservation') }}</button>
            </form>
          </section>

          <!-- 3. done -->
          <section v-else-if="step === 'done'" class="sf-stores-done" role="status">
            <span class="sf-stores-check" aria-hidden="true">✓</span>
            <h3>{{ w('Demande envoyée') }}</h3>
            <p>{{ w('{a} vous confirme la réservation par téléphone ou par e-mail.', { a: store?.Name || w('La boutique') }) }}<template v-if="chosenSize"> ({{ sizeName(chosenSize) }})</template></p>
            <button type="button" class="sf-btn is-outline" @click="emit('close')">{{ w('Continuer mes achats') }}</button>
          </section>
        </div>
      </aside>
    </div>
  </Teleport>
</template>
