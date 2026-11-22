<script setup lang="ts">
// « Pays et langue »: a full screen where the visitor picks the country they shop from and the language of the site; the country brings its own language when the site has it.
const props = defineProps<{ image?: string }>()
const emit = defineEmits<{ close: [] }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const { query } = useAccount()
const here = computed(() => String(site.value?.Route?.LanguageIsoCode || 'fr'))
const languages = computed(() => ((site.value?.Languages || []) as any[]).map(l => String(l.LanguageIsoCode).toLowerCase()))
const nameOf = (iso: string) => { try { const name = new Intl.DisplayNames([iso], { type: 'language' }).of(iso) || iso; return name.charAt(0).toUpperCase() + name.slice(1) } catch { return iso.toUpperCase() } }
const countries = ref<Array<{ IsoCode: string, Name: string, Language: string, Currencies: Array<{ IsoCode: string, Name: string, Sign: string }> }>>([])
const form = reactive({ Country: '', Language: here.value, Currency: '', Remember: true })
const currencies = computed(() => countries.value.find(c => c.IsoCode === form.Country)?.Currencies || [])
const busy = ref(false), panel = ref<HTMLElement | null>(null)
const urlOf = (iso: string) => { const found = (site.value?.Languages || []).find((l: any) => String(l.LanguageIsoCode).toLowerCase() === iso); return found?.Default && site.value?.UrlPrefix !== 'always' ? '/' : '/' + iso }
onMounted(async () => {
  document.documentElement.style.overflow = 'hidden'
  nextTick(() => panel.value?.focus())
  const answer = await $fetch<any>('/api/storefront/regions', { query: query() }).catch(() => null)
  countries.value = answer?.Countries || []
  form.Country = answer?.Current || ''
  form.Currency = currencies.value.some(m => m.IsoCode === answer?.Currency) ? answer.Currency : (currencies.value[0]?.IsoCode || '')
})
onBeforeUnmount(() => { document.documentElement.style.overflow = '' })
// another country: its language is proposed
function countryChanged() { const own = countries.value.find(c => c.IsoCode === form.Country)?.Language; if (own && languages.value.includes(own)) { form.Language = own } form.Currency = currencies.value[0]?.IsoCode || '' }
async function enter() {
  if (busy.value) { return }
  busy.value = true
  const chosen = countries.value.find(c => c.IsoCode === form.Country)
  if (chosen) {
    await $fetch('/api/storefront/region', { method: 'POST', query: query(), body: { Country: chosen.IsoCode, Currency: form.Currency, Remember: form.Remember } }).catch(() => null)
    try { window.localStorage.setItem('sf_region', JSON.stringify({ iso: chosen.IsoCode, name: chosen.Name, lang: form.Language, currency: form.Currency })) } catch { /* private window */ }
  }
  if (form.Language !== here.value) { window.location.href = urlOf(form.Language) } else { window.location.reload() }
}
</script>

<template>
  <Teleport to="body">
    <div ref="panel" class="sf-region" :style="image ? { backgroundImage: 'url(' + JSON.stringify(image) + ')' } : undefined" :class="{ 'has-image': !!image }" role="dialog" aria-modal="true" :aria-label="w('Choisir votre pays et votre langue')" tabindex="-1" @keydown.esc="emit('close')">
      <button type="button" class="sf-region-close" :aria-label="w('Fermer')" @click="emit('close')">✕</button>
      <form class="sf-region-box" @submit.prevent="enter">
        <p class="sf-region-name">{{ site?.Name }}</p>
        <label><span>{{ w('Pays') }}</span><select v-model="form.Country" @change="countryChanged"><option v-for="c in countries" :key="c.IsoCode" :value="c.IsoCode">{{ c.Name }}</option></select></label>
        <label v-if="languages.length > 1"><span>{{ w('Langue') }}</span><select v-model="form.Language"><option v-for="iso in languages" :key="iso" :value="iso">{{ nameOf(iso) }}</option></select></label>
        <label v-if="currencies.length"><span>{{ w('Devise') }}</span><select v-model="form.Currency" :disabled="currencies.length < 2"><option v-for="m in currencies" :key="m.IsoCode" :value="m.IsoCode">{{ m.Name || m.IsoCode }}{{ m.Sign ? ' ' + m.Sign : '' }}</option></select></label>
        <label class="sf-region-check"><input v-model="form.Remember" type="checkbox"><span>{{ w('Se souvenir de mon choix') }}</span></label>
        <button type="submit" class="sf-btn" :disabled="busy || !form.Country">{{ w('Entrer') }}</button>
      </form>
    </div>
  </Teleport>
</template>
