<script setup lang="ts">
// SfStoreStock: « Disponibilité en boutique » and « Réserver en boutique », in one side panel, step by step: the size → the shops (where the size is in stock, nearest first when the visitor shares their
// position, searchable by town, post code or name) → the visitor's details → done. The stock is the one of the location tied to each shop (server/api/storefront/store-stock.get.ts); a reservation
// is a request « À confirmer » the shop answers by phone or e-mail (server/api/storefront/reserve.post.ts). `reserve` false: the panel only tells where the product is.
const props = defineProps<{ product: any, variant?: number, reserve?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const w = useWords()
const { customer } = useAccount()
const sizes = computed(() => (props.product?.Variants || []).filter((v: any) => v.Label))
const size = ref<number>(props.variant || (sizes.value.length === 1 ? sizes.value[0].Id : 0))
const step = ref<'size' | 'store' | 'contact' | 'done'>(sizes.value.length && !size.value ? 'size' : 'store')
const chosenSize = computed(() => sizes.value.find((v: any) => v.Id === size.value))

// the shops, read when the panel opens (and again with the visitor's position)
const stores = ref<any[]>([]), loading = ref(true), failed = ref(false)
const where = ref<{ Lat: number, Lng: number } | null>(null), locating = ref(false), locateError = ref('')
async function load() {
  loading.value = true; failed.value = false
  try { stores.value = (await $fetch<any>('/api/storefront/store-stock', { query: { IdProduct: props.product.Id, ...(where.value || {}) } })).Stores || [] } catch { failed.value = true } finally { loading.value = false }
}
function locate() {
  if (!navigator.geolocation) { locateError.value = w('Votre navigateur ne donne pas votre position.'); return }
  locating.value = true; locateError.value = ''
  navigator.geolocation.getCurrentPosition((p) => { where.value = { Lat: Math.round(p.coords.latitude * 1000) / 1000, Lng: Math.round(p.coords.longitude * 1000) / 1000 }; locating.value = false; load() },
    () => { locating.value = false; locateError.value = w('Position refusée : cherchez une ville ou un code postal.') }, { timeout: 10000, maximumAge: 600000 })
}
// what a shop has of the chosen size: a quantity, or null when its stock is not followed by Digipart (the shop confirms)
const qty = (s: any) => (!s.Known ? null : size.value ? Number(s.Stock[size.value] || 0) : Object.values(s.Stock as Record<string, number>).reduce((a, b) => a + b, 0))
const state = (s: any) => { const n = qty(s); return n === null ? 'unknown' : n <= 0 ? 'out' : n <= 2 ? 'low' : 'in' }
const label = (s: any) => ({ in: w('Disponible'), low: w('Dernières pièces'), out: w('Indisponible'), unknown: w('Disponibilité à confirmer par la boutique') } as Record<string, string>)[state(s)]
const search = ref(''), onlyStock = ref(false)
const plain = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const shown = computed(() => stores.value.filter((s: any) => (!onlyStock.value || ['in', 'low'].includes(state(s))) && (!search.value.trim() || plain([s.Name, s.City, s.PostalCode, s.Address].join(' ')).includes(plain(search.value.trim())))))
const openHours = ref<number>(0)

// the reservation
const store = ref<any>(null)
const form = reactive({ Quantity: 1, Firstname: '', Lastname: '', Email: '', MobilePhone: '', Website: '' })
watch(customer, (now: any) => { if (now && !now.Guest) { form.Firstname = form.Firstname || now.Firstname || ''; form.Lastname = form.Lastname || now.Lastname || ''; form.Email = form.Email || now.Email || ''; form.MobilePhone = form.MobilePhone || now.Phone || '' } }, { immediate: true })
const most = computed(() => { const n = store.value ? qty(store.value) : null; return Math.max(1, Math.min(5, n === null ? 5 : n)) })
const busy = ref(false), error = ref('')
const reservable = (s: any) => props.reserve !== false && state(s) !== 'out' && (!sizes.value.length || !!size.value)
function pickStore(s: any) { store.value = s; form.Quantity = 1; error.value = ''; step.value = 'contact' }
async function send() {
  if (busy.value || !store.value) { return }
  busy.value = true; error.value = ''
  try {
    const answer = await $fetch<any>('/api/storefront/reserve', { method: 'POST', body: { ...form, IdStore: store.value.Id, IdProduct: props.product.Id, IdProductAttribute: size.value || 0 } })
    if (answer.Done) { step.value = 'done' } else { error.value = w(answer.Error || 'La réservation n\'a pas pu être enregistrée, merci de réessayer.') }
  } catch { error.value = w('La réservation n\'a pas pu être enregistrée, merci de réessayer.') } finally { busy.value = false }
}
const steps = computed(() => [...(sizes.value.length ? [['size', w('Taille')]] : []), ['store', w('Boutique')], ...(props.reserve !== false ? [['contact', w('Coordonnées')]] : [])] as [string, string][])
const reached = (key: string) => { const order = ['size', 'store', 'contact', 'done']; return order.indexOf(key) <= order.indexOf(step.value) }
const goTo = (key: string) => { if (reached(key) && step.value !== 'done') { step.value = key as any } }

const panel = ref<HTMLElement | null>(null)
onMounted(() => { document.documentElement.style.overflow = 'hidden'; nextTick(() => panel.value?.focus()); load() })
onBeforeUnmount(() => { document.documentElement.style.overflow = '' })
</script>

<template>
  <div class="sf-drawer" @keydown.esc="emit('close')">
    <div class="sf-drawer-veil" @click="emit('close')" />
    <aside ref="panel" class="sf-drawer-panel sf-stores" role="dialog" aria-modal="true" :aria-label="w(reserve !== false ? 'Réserver en boutique' : 'Disponibilité en boutique')" tabindex="-1">
      <header class="sf-drawer-head"><h2>{{ w(reserve !== false ? 'Réserver en boutique' : 'Disponibilité en boutique') }}</h2><button type="button" :aria-label="w('Fermer')" @click="emit('close')">✕</button></header>
      <ol v-if="steps.length > 1 && step !== 'done'" class="sf-steps">
        <li v-for="([key, name], i) in steps" :key="key" :class="{ 'is-on': step === key, 'is-done': reached(key) && step !== key }"><button type="button" :disabled="!reached(key)" @click="goTo(key)"><span>{{ i + 1 }}</span>{{ name }}</button></li>
      </ol>
      <div class="sf-drawer-body">
        <div class="sf-stores-product">
          <img v-if="product.Images?.[0]" :src="product.Images[0]" alt="" loading="lazy" decoding="async">
          <div>
            <p class="sf-stores-name">{{ product.Name }}</p>
            <p v-if="product.Reference" class="sf-muted">{{ product.Reference }}</p>
            <div class="sf-card-price"><SfPrice :product="product" /></div>
            <p v-if="chosenSize && step !== 'size'" class="sf-stores-size">{{ w('Taille') }} : <strong>{{ chosenSize.Size || chosenSize.Label }}</strong> <button v-if="step !== 'done'" type="button" @click="step = 'size'">{{ w('Modifier') }}</button></p>
          </div>
        </div>

        <!-- 1. the size -->
        <section v-if="step === 'size'">
          <h3 class="sf-stores-title">{{ w('Choisissez votre taille') }}</h3>
          <div class="sf-stores-sizes">
            <button v-for="v in sizes" :key="v.Id" type="button" :class="{ 'is-on': size === v.Id }" @click="size = v.Id; step = 'store'">{{ v.Size || v.Label }}</button>
          </div>
        </section>

        <!-- 2. the shops -->
        <section v-else-if="step === 'store'">
          <div class="sf-stores-search">
            <input v-model="search" type="search" :placeholder="w('Ville, code postal ou boutique')" :aria-label="w('Ville, code postal ou boutique')">
            <button type="button" class="sf-stores-near" :disabled="locating" @click="locate">{{ w(locating ? 'Localisation…' : 'Autour de moi') }}</button>
          </div>
          <p v-if="locateError" class="sf-form-error">{{ locateError }}</p>
          <label class="sf-switch"><input v-model="onlyStock" type="checkbox"><span />{{ w('En stock seulement') }}</label>
          <p v-if="loading" class="sf-muted">{{ w('Recherche des boutiques…') }}</p>
          <p v-else-if="failed" class="sf-form-error">{{ w('Les boutiques n\'ont pas pu être lues, merci de réessayer.') }} <button type="button" class="sf-link" @click="load">{{ w('Réessayer') }}</button></p>
          <p v-else-if="!shown.length" class="sf-muted">{{ w(stores.length ? 'Aucune boutique ne correspond.' : 'Aucune boutique ne montre son stock pour le moment.') }}</p>
          <ul v-else class="sf-stores-list">
            <li v-for="s in shown" :key="s.Id" class="sf-store">
              <div class="sf-store-head"><strong>{{ s.Name }}</strong><small v-if="s.Distance !== null">{{ s.Distance < 10 ? s.Distance.toLocaleString() : Math.round(s.Distance) }} km</small></div>
              <p class="sf-store-address">{{ s.Address }}<br>{{ [s.PostalCode, s.City].filter(Boolean).join(' ') }}</p>
              <p class="sf-store-state" :class="'is-' + state(s)"><i aria-hidden="true" />{{ label(s) }}</p>
              <div class="sf-store-links">
                <a :href="s.MapsUrl" target="_blank" rel="noopener">{{ w('Itinéraire') }}</a>
                <a v-if="s.Phone" :href="'tel:' + s.Phone.replace(/[^+0-9]/g, '')">{{ s.Phone }}</a>
                <button v-if="s.Hours.length" type="button" :aria-expanded="openHours === s.Id" @click="openHours = openHours === s.Id ? 0 : s.Id">{{ w('Horaires') }}</button>
              </div>
              <dl v-if="openHours === s.Id" class="sf-store-hours"><template v-for="d in s.Hours" :key="d.Day"><dt>{{ d.Day }}</dt><dd>{{ d.Slots || w('Fermé') }}</dd></template></dl>
              <button v-if="reservable(s)" type="button" class="sf-btn sf-store-pick" @click="pickStore(s)">{{ w('Réserver dans cette boutique') }}</button>
            </li>
          </ul>
        </section>

        <!-- 3. the visitor -->
        <section v-else-if="step === 'contact' && store">
          <div class="sf-store is-chosen">
            <div class="sf-store-head"><strong>{{ store.Name }}</strong><button type="button" class="sf-link" @click="step = 'store'">{{ w('Modifier') }}</button></div>
            <p class="sf-store-address">{{ store.Address }}, {{ [store.PostalCode, store.City].filter(Boolean).join(' ') }}</p>
            <p class="sf-store-state" :class="'is-' + state(store)"><i aria-hidden="true" />{{ label(store) }}</p>
          </div>
          <form class="sf-form" @submit.prevent="send">
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

        <!-- 4. done -->
        <section v-else-if="step === 'done'" class="sf-stores-done" role="status">
          <span class="sf-stores-check" aria-hidden="true">✓</span>
          <h3>{{ w('Demande envoyée') }}</h3>
          <p>{{ w('{a} vous confirme la réservation par téléphone ou par e-mail.', { a: store?.Name || w('La boutique') }) }}</p>
          <button type="button" class="sf-btn is-outline" @click="emit('close')">{{ w('Continuer mes achats') }}</button>
        </section>
      </div>
    </aside>
  </div>
</template>
