<script setup lang="ts">
// The page « Choix du pays » of the site builder (section main_region): no header, no footer. Before it is published: the defaults, with the photo set in the footer.
const props = defineProps<{ design?: any }>()
const site = inject<Ref<any>>('sfSite')!
const route = useRoute()
const w = useWords()
const { query } = useAccount()
const section = computed(() => (props.design?.Sections || []).find((x: any) => x.Type === 'main_region') || null)
const s = computed(() => section.value?.Settings || { Image: (site.value?.Footer?.Sections || []).find((x: any) => x.Type === 'main_footer')?.Settings?.RegionImage || '' })
const t = computed(() => section.value?.Texts || {})

const brand = computed(() => s.value.Brand || 'logo')
const logo = computed(() => (brand.value === 'logo' ? String(s.value.Logo || shopLogo(site.value)) : ''))
const name = computed(() => (brand.value === 'none' || logo.value ? '' : String((brand.value === 'name' && t.value.Name) || site.value?.Name || '')))
const logoTone = computed(() => { const tone = s.value.LogoColor || 'auto'; return tone === 'auto' ? (s.value.Image ? 'white' : 'original') : tone })
const look = computed(() => ({ ...focusVars(focusOf(s.value, 'ImageY', 'ImageX')), '--rg-veil': String((Number(s.value.Overlay) || 0) / 100), '--rg-size': (Number(s.value.BrandSize) || 40) + 'px' }))

const here = computed(() => String(site.value?.Route?.LanguageIsoCode || 'fr').toLowerCase())
const languages = computed(() => ((site.value?.Languages || []) as any[]).map(l => String(l.LanguageIsoCode).toLowerCase()))
const nameOf = (iso: string) => { try { const found = new Intl.DisplayNames([iso], { type: 'language' }).of(iso) || iso; return found.charAt(0).toUpperCase() + found.slice(1) } catch { return iso.toUpperCase() } }
const countries = ref<Array<{ IsoCode: string, Name: string, Language: string, Currencies: Array<{ IsoCode: string, Name: string, Sign: string }> }>>([])
const form = reactive({ Country: '', Language: here.value, Currency: '', Remember: s.value.RememberOn !== false })
const country = computed(() => countries.value.find(c => c.IsoCode === form.Country) || null)
const currencies = computed(() => country.value?.Currencies || [])
const withCurrency = computed(() => s.value.ShowCurrency !== 'never' && (s.value.ShowCurrency !== 'choice' || currencies.value.length > 1))
const busy = ref(false), failed = ref(false)
watch(() => s.value.RememberOn, (on) => { form.Remember = on !== false })

// another country: its language and its default currency are proposed
function setCountry(iso: string) {
  form.Country = iso
  const own = country.value?.Language
  if (own && languages.value.includes(own)) { form.Language = own }
  form.Currency = currencies.value[0]?.IsoCode || ''
}
onMounted(async () => {
  const answer = await $fetch<any>('/api/storefront/regions', { query: query() }).catch(() => null)
  countries.value = answer?.Countries || []
  form.Country = answer?.Current || ''
  form.Currency = currencies.value.some(m => m.IsoCode === answer?.Currency) ? answer.Currency : (currencies.value[0]?.IsoCode || '')
})

const homeOf = (iso: string) => { const found = (site.value?.Languages || []).find((l: any) => String(l.LanguageIsoCode).toLowerCase() === iso); return found?.Default && site.value?.UrlPrefix !== 'always' ? '/' : '/' + iso }
const back = computed(() => { const asked = String(route.query.retour || ''); return /^\/(?!\/)[\p{L}\p{N}/_.-]{0,200}$/u.test(asked) ? asked : homeOf(here.value) })
async function enter() {
  if (busy.value || !country.value) { return }
  busy.value = true; failed.value = false
  const chosen = country.value
  const answer = await $fetch<any>('/api/storefront/region', { method: 'POST', query: query(), body: { Country: chosen.IsoCode, Currency: form.Currency, Remember: form.Remember } }).catch(() => null)
  if (!answer?.Done) { busy.value = false; failed.value = true; return }
  try {
    window.localStorage.removeItem('sf_place'); window.sessionStorage.removeItem('sf_place')
    ;(form.Remember ? window.localStorage : window.sessionStorage).setItem('sf_place', JSON.stringify({ name: chosen.Name, lang: form.Language, currency: answer.Currency }))
  } catch { /* private window */ }
  window.location.href = form.Language === here.value ? back.value : homeOf(form.Language)
}
</script>

<template>
  <main class="sf-region" :class="[section ? 'sf-i-' + section.Id : '', 'is-' + (s.FormPlace || 'center'), 'is-brand-' + (s.BrandPlace || 'top_left'), { 'has-image': !!s.Image }]" :style="look" :data-section="section ? 'main_region' : undefined">
    <picture v-if="s.Image" class="sf-region-pic">
      <source v-if="s.ImageMobile" media="(max-width: 767px)" :srcset="s.ImageMobile">
      <img :src="s.Image" alt="" fetchpriority="high" decoding="async">
    </picture>
    <a v-if="s.ShowClose !== false" :href="back" rel="nofollow" class="sf-region-close" :aria-label="w('Fermer')">✕</a>
    <div v-if="logo || name" class="sf-region-brand">
      <img v-if="logo" :src="logo" :alt="site?.Name" :class="'is-' + logoTone">
      <span v-else>{{ name }}</span>
    </div>
    <form class="sf-region-form" :aria-label="w('Choisir votre pays et votre langue')" @submit.prevent="enter">
      <h1 v-if="t.Title">{{ t.Title }}</h1>
      <p v-if="t.Text" class="sf-region-text">{{ t.Text }}</p>
      <div class="sf-region-fields" :class="{ 'is-column': s.FormLayout === 'column' }">
        <SfPick :model-value="form.Country" :options="countries.map(c => ({ Value: c.IsoCode, Text: c.Name }))" :label="t.CountryLabel || w('Pays')" :search="s.ShowSearch !== false ? w('Rechercher un pays') : ''" :empty="w('Aucun pays trouvé')" @update:model-value="setCountry" />
        <SfPick v-if="languages.length > 1" v-model="form.Language" :options="languages.map(iso => ({ Value: iso, Text: nameOf(iso) }))" :label="t.LanguageLabel || w('Langue')" />
        <SfPick v-if="withCurrency" v-model="form.Currency" :options="currencies.map(m => ({ Value: m.IsoCode, Text: (m.Name || m.IsoCode) + (m.Sign ? ' ' + m.Sign : '') }))" :label="t.CurrencyLabel || w('Devise')" />
        <label class="sf-region-check"><span>{{ t.RememberLabel || w('Se souvenir de mon choix') }}</span><input v-model="form.Remember" type="checkbox"></label>
        <button type="submit" class="sf-region-enter" :disabled="busy || !form.Country">{{ t.ButtonText || w('Entrer') }}</button>
      </div>
      <p v-if="failed" class="sf-region-text" role="alert">{{ w('Votre choix n\'a pas pu être enregistré, merci de réessayer.') }}</p>
    </form>
  </main>
</template>
