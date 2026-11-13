<script setup lang="ts">
// The shops of the brand (a « Nos boutiques » section): the active shops of Digipart, with their address, phone, opening hours and the way there. The visitor filters by town or postcode,
// or sorts them by distance from where he is (only if he allows it; his position stays in his browser). The map of a shop is only loaded when he asks for it.
const props = defineProps<{ settings: any }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const { data } = await useFetch<any>('/api/storefront/stores', { key: 'sf-stores-' + lang.value, query: { lang } })
const s = computed(() => props.settings || {})
const search = ref('')
const here = ref<{ lat: number, lon: number } | null>(null)
const nearError = ref('')
const locating = ref(false)
const mapOf = ref(0)
const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
function distance(store: any): number | null {
  if (!here.value || store.Latitude === null || store.Longitude === null) { return null }
  const rad = Math.PI / 180, dLat = (store.Latitude - here.value.lat) * rad, dLon = (store.Longitude - here.value.lon) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(here.value.lat * rad) * Math.cos(store.Latitude * rad) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
const stores = computed(() => {
  const asked = fold(search.value.trim())
  const list = (data.value?.Stores || []).filter((store: any) => !asked || fold([store.Name, store.City, store.Postcode, store.Address].join(' ')).includes(asked)).map((store: any) => ({ ...store, Km: distance(store) }))
  return here.value ? list.sort((a: any, b: any) => (a.Km ?? 1e9) - (b.Km ?? 1e9)) : list
})
function near() {
  nearError.value = ''
  if (!navigator.geolocation) { nearError.value = 'Votre navigateur ne donne pas votre position.'; return }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (position) => { here.value = { lat: position.coords.latitude, lon: position.coords.longitude }; locating.value = false },
    () => { nearError.value = 'Votre position n\'a pas pu être lue : cherchez une ville.'; locating.value = false },
    { maximumAge: 600000, timeout: 8000 },
  )
}
const route = (store: any) => store.MapUrl || (store.Latitude !== null ? 'https://www.openstreetmap.org/?mlat=' + store.Latitude + '&mlon=' + store.Longitude + '#map=17/' + store.Latitude + '/' + store.Longitude : 'https://www.openstreetmap.org/search?query=' + encodeURIComponent([store.Address, store.Postcode, store.City, store.Country].filter(Boolean).join(' ')))
const embed = (store: any) => 'https://www.openstreetmap.org/export/embed.html?bbox=' + [store.Longitude - 0.006, store.Latitude - 0.004, store.Longitude + 0.006, store.Latitude + 0.004].join('%2C') + '&layer=mapnik&marker=' + store.Latitude + '%2C' + store.Longitude
</script>

<template>
  <div class="sf-stores">
    <div v-if="s.ShowSearch !== false || s.ShowNear !== false" class="sf-stores-tools">
      <input v-if="s.ShowSearch !== false" v-model="search" type="search" :placeholder="w('Ville ou code postal')" :aria-label="w('Chercher une boutique')" autocomplete="off">
      <button v-if="s.ShowNear !== false" type="button" class="sf-btn is-outline" :disabled="locating" @click="near">{{ w(locating ? 'Recherche…' : 'Près de moi') }}</button>
    </div>
    <p v-if="nearError" class="sf-cart-error" role="alert">{{ w(nearError) }}</p>
    <p v-if="!stores.length" class="sf-muted">{{ w((data?.Stores || []).length ? 'Aucune boutique ne correspond à votre recherche.' : 'Nos boutiques arrivent bientôt.') }}</p>
    <ul v-else class="sf-stores-list" :style="{ '--cols': Math.max(1, Math.min(4, Number(s.Columns) || 3)) }">
      <li v-for="store in stores" :key="store.Id">
        <div class="sf-stores-top"><h3>{{ store.Name }}</h3><span v-if="store.Km !== null">{{ store.Km >= 10 ? Math.round(store.Km) : store.Km.toFixed(1) }} km</span></div>
        <address>{{ store.Address }}<br>{{ store.Postcode }} {{ store.City }}<template v-if="store.Country"><br>{{ store.Country }}</template></address>
        <p v-if="s.ShowContact !== false && (store.Phone || store.Email)" class="sf-stores-contact">
          <a v-if="store.Phone" :href="'tel:' + store.Phone.replace(/[^+0-9]/g, '')">{{ store.Phone }}</a>
          <a v-if="store.Email" :href="'mailto:' + store.Email">{{ store.Email }}</a>
        </p>
        <dl v-if="s.ShowHours !== false && store.Hours.length" class="sf-stores-hours"><template v-for="day in store.Hours" :key="day.Day"><dt>{{ w(day.Day) }}</dt><dd>{{ day.Text }}</dd></template></dl>
        <p class="sf-stores-links">
          <a :href="route(store)" target="_blank" rel="noopener" class="sf-link">{{ w('Itinéraire') }}</a>
          <button v-if="s.ShowMap !== false && store.Latitude !== null" type="button" class="sf-link" :aria-expanded="mapOf === store.Id" @click="mapOf = mapOf === store.Id ? 0 : store.Id">{{ w(mapOf === store.Id ? 'Masquer la carte' : 'Voir la carte') }}</button>
        </p>
        <iframe v-if="mapOf === store.Id" :src="embed(store)" :title="w('Carte de {a}', { a: store.Name })" loading="lazy" referrerpolicy="no-referrer" class="sf-stores-map" />
      </li>
    </ul>
  </div>
</template>
