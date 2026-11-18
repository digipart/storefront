<script setup lang="ts">
// The search panel, opened by the search of the header (site builder: En-tête > « Ouvrir la recherche dans un panneau »): a large field at the top of the screen and, under it, before anything is
// typed, the searches the shop puts forward and a row of products (the most sold, viewed, put in a cart, or « Pour vous » for a signed-in customer); as soon as two letters are typed, the
// results come with their suggestions, main categories, filters and sort, without leaving the page. Échap, the cross or a click on the shade closes it; the address /recherche?q=… shows the
// same results on a page of their own. What it shows is set on the page « Recherche » of the site builder (section « Résultats de recherche », group « Panneau de recherche »).
const open = useState<boolean>('sf-search-open', () => false)
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const prefix = computed(() => site.value?.Route?.Prefix || '')
const pageUrl = computed(() => prefix.value + (lang.value === 'fr' ? '/recherche' : '/search'))
const term = ref('')
const ask = ref<Record<string, string | number>>({})
const result = ref<any>(null)
const busy = ref(false)
const design = useState<{ Settings: any, Texts: any } | null>('sf-search-design', () => null)   // read once, kept while the visitor stays on the site
const field = ref<HTMLInputElement | null>(null)
const s = computed(() => design.value?.Settings || {})
const t = computed(() => design.value?.Texts || {})
const popular = computed(() => String(t.value.Popular || '').split(/\r?\n|,/).map(x => x.trim()).filter(Boolean).slice(0, 12))
const recoSource = computed(() => (['personal', 'top_sales', 'top_viewed', 'top_cart', 'latest', 'none'].includes(String(s.value.RecoSource)) ? String(s.value.RecoSource) : 'personal'))
// the row of products shown before anything is typed: a « Sélection de produits » of its own, in a row the visitor swipes
const reco = computed(() => ({ Id: 'search-reco', Settings: { Source: recoSource.value, Fallback: s.value.RecoFallback || 'top_sales', Days: 30, Limit: Math.max(4, Math.min(12, Number(s.value.RecoLimit) || 8)), Layout: 'carousel', CarouselMobile: true, Columns: Math.max(3, Math.min(6, Number(s.value.Columns) || 4)), ColumnsMobile: 2, CardImages: s.value.CardImages || 'hover' } }))

let asked = 0
let timer: ReturnType<typeof setTimeout> | undefined
async function read(more: Record<string, string | number> = {}) {
  const q = term.value.trim()
  if (q.length < 2) { result.value = null; busy.value = false; return }
  const number = ++asked
  busy.value = true
  ask.value = { ...ask.value, ...more, q }
  try {
    const answer = await $fetch<any>('/api/storefront/search', { query: { ...ask.value, lang: lang.value, prefix: prefix.value, size: 24, ...(design.value ? {} : { design: 1 }) } })
    if (number !== asked) { return }   // an older answer, after a newer question
    if (!design.value && answer) { design.value = { Settings: answer.Settings || {}, Texts: answer.Texts || {} } }
    result.value = answer
  } catch { if (number === asked) { result.value = { Term: q, Total: 0, Products: [] } } } finally { if (number === asked) { busy.value = false } }
}
// a pause in the typing reads the results again, with no filter: a new word is a new search
watch(term, () => { clearTimeout(timer); ask.value = {}; timer = setTimeout(() => read(), 280) })
const change = (next: Record<string, string | number>) => { ask.value = {}; read({ ...next, q: term.value.trim() }) }
const choose = (word: string) => { term.value = word; field.value?.focus() }
const close = () => { open.value = false }
const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { close() } }
let opener: Element | null = null
watch(open, async (now) => {
  if (!import.meta.client) { return }
  document.documentElement.classList.toggle('sf-noscroll', now)
  if (now) {
    opener = document.activeElement
    window.addEventListener('keydown', onKey)
    if (!design.value) { $fetch<any>('/api/storefront/search', { query: { design: 1, lang: lang.value, prefix: prefix.value } }).then((a) => { design.value = { Settings: a?.Settings || {}, Texts: a?.Texts || {} } }).catch(() => { design.value = { Settings: {}, Texts: {} } }) }
  } else {
    window.removeEventListener('keydown', onKey)
    ;(opener as HTMLElement | null)?.focus?.()
  }
}, { immediate: true })
// the field takes the keyboard once the panel is drawn (the click on the header link keeps it otherwise)
onMounted(() => { requestAnimationFrame(() => field.value?.focus()) })
onBeforeUnmount(() => { if (import.meta.client) { window.removeEventListener('keydown', onKey); document.documentElement.classList.remove('sf-noscroll') } })
// another page closes it
const route = useRoute()
watch(() => route.fullPath, close)
const submit = () => { if (term.value.trim().length >= 2) { close(); navigateTo(pageUrl.value + '?q=' + encodeURIComponent(term.value.trim())) } }
</script>

<template>
  <div v-if="open" class="sf-spanel" role="dialog" aria-modal="true" :aria-label="w('Recherche')">
    <div class="sf-spanel-shade" @click="close" />
    <div class="sf-spanel-box">
      <form class="sf-spanel-bar" role="search" @submit.prevent="submit">
        <label class="sf-spanel-field">
          <SfIcon name="search" :size="20" />
          <input ref="field" v-model="term" type="search" name="q" maxlength="80" :placeholder="t.Placeholder || w('Que cherchez-vous ?')" :aria-label="w('Que cherchez-vous ?')" autocomplete="off" enterkeyhint="search">
          <button v-if="term" type="button" class="sf-spanel-clear" @click="term = ''; field?.focus()">{{ w('Effacer') }}</button>
        </label>
        <button type="button" class="sf-spanel-close" :aria-label="w('Fermer la recherche')" @click="close"><SfIcon name="x" :size="24" /></button>
      </form>
      <div class="sf-spanel-body">
        <template v-if="term.trim().length < 2">
          <div v-if="popular.length" class="sf-srch-suggest">
            <p class="sf-srch-label">{{ w('Recherches populaires') }}</p>
            <div class="sf-srch-chips"><button v-for="word in popular" :key="word" type="button" class="sf-srch-chip" @click="choose(word)">{{ word }}</button></div>
          </div>
          <section v-if="design && recoSource !== 'none'" class="sf-spanel-reco">
            <h2 v-if="t.RecoTitle !== ''" class="sf-spanel-title">{{ t.RecoTitle || w('Cela pourrait vous intéresser') }}</h2>
            <SfProducts :section="reco" />
          </section>
        </template>
        <template v-else>
          <p v-if="busy && !result" class="sf-muted">{{ w('Recherche en cours…') }}</p>
          <SfSearchResults v-if="result" :result="result" :settings="s" :texts="t" panel :busy="busy" @change="change">
            <template #after>
              <p v-if="result.Total > (result.Products?.length || 0)" class="sf-spanel-all"><a :href="pageUrl + '?q=' + encodeURIComponent(result.Term)" class="sf-btn is-outline" @click="close">{{ w('Voir les {a} résultats', { a: result.Total }) }}</a></p>
            </template>
          </SfSearchResults>
        </template>
      </div>
    </div>
  </div>
</template>
