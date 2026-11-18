<script setup lang="ts">
// What a search found, as its panel (opened by the search of the header) and its page /recherche show it: the categories named like the words, the main categories as tabs with how many
// products each has, the filters (a column on a computer, the « Filtrer » panel on a phone), the sort, two densities of the grid, then the products. Each choice is told to the parent
// (`change`), which reads the search again: the panel in place, the page by its address. What the shop shows is set on the page « Recherche » of the site builder.
const props = defineProps<{ result: any, settings?: any, texts?: any, panel?: boolean, busy?: boolean, view?: any }>()
const emit = defineEmits<{ change: [ask: Record<string, string | number>], more: [] }>()
const w = useWords()
const s = computed(() => props.settings || {})
const r = computed(() => props.result || {})
const ask = (change: Record<string, string | number>) => ({ q: r.value.Term, attr: (r.value.Filters?.Attributes || []).join(','), min: r.value.Filters?.Min || 0, max: r.value.Filters?.Max || 0, tab: r.value.Tab || 0, sort: r.value.Sort || '', promo: r.value.Filters?.Promo ? 'yes' : '', page: 1, ...change })
const hasFilters = computed(() => s.value.ShowFilters !== false && ((r.value.Filters?.Groups || []).length > 0 || r.value.Filters?.PriceMax > r.value.Filters?.PriceMin || (s.value.FilterPromo !== false && (r.value.Filters?.PromoCount > 0 || r.value.Filters?.Promo))))
const filterCount = computed(() => (r.value.Filters?.Attributes || []).length + (r.value.Filters?.Max ? 1 : 0) + (r.value.Filters?.Promo ? 1 : 0))
// the filters column can be hidden on a computer (« Masquer les filtres »); on a phone they open in their panel
const sideShown = ref(true)
const phoneOpen = ref(false)
const apply = (chosen: { attributes: number[], min: number, max: number, promo?: boolean }) => { phoneOpen.value = false; emit('change', ask({ attr: chosen.attributes.join(','), min: chosen.min, max: chosen.max, promo: chosen.promo ? 'yes' : '' })) }
const cols = computed(() => Math.max(2, Math.min(6, Number(s.value.Columns) || 4)))
// « Affichage 1 2 3 »: the buttons of the category pages (their lists of products per line, a computer and a phone), the choice kept in the browser for the categories and the search alike
const viewSet = computed(() => props.view || r.value.View || null)
const levels = (value: unknown, fallback: string) => { const list = String(value || fallback).split(',').map(Number).filter(n => n >= 1 && n <= 8); return list.length ? list : fallback.split(',').map(Number) }
const viewDesk = computed(() => levels(viewSet.value?.Desktop, '2,4,6'))
const viewMob = computed(() => levels(viewSet.value?.Mobile, '1,2,3'))
const viewCount = computed(() => (viewSet.value?.Switch === false ? 0 : Math.max(viewDesk.value.length, viewMob.value.length)))
const viewLevel = ref<number | null>(null)
onMounted(() => { try { const kept = localStorage.getItem('sf-view'); if (kept !== null && Number(kept) >= 0 && Number(kept) < viewCount.value) { viewLevel.value = Number(kept) } } catch { /* no storage */ } })
const viewShown = computed(() => {
  if (viewLevel.value !== null) { return viewLevel.value }
  let best = 0
  viewDesk.value.forEach((n, i) => { if (Math.abs(n - cols.value) < Math.abs(viewDesk.value[best]! - cols.value)) { best = i } })
  return best
})
const chooseView = (at: number) => { viewLevel.value = at; try { localStorage.setItem('sf-view', String(at)) } catch { /* refused: the choice lasts for this page */ } }
const perRow = computed(() => (viewLevel.value === null ? cols.value : viewDesk.value[Math.min(viewLevel.value, viewDesk.value.length - 1)]!))
const perRowMobile = computed(() => (viewLevel.value === null ? Number(s.value.ColumnsMobile) || 2 : viewMob.value[Math.min(viewLevel.value, viewMob.value.length - 1)]!))
const sorts = [{ key: '', label: 'Nouveautés' }, { key: 'best', label: 'Meilleures ventes' }, { key: 'price_asc', label: 'Prix croissant' }, { key: 'price_desc', label: 'Prix décroissant' }]
const currency = computed(() => r.value.Products?.[0]?.Currency || 'EUR')
// the words found in a suggestion are written in bold, as typed
const bold = (name: string) => {
  const words = String(r.value.Term || '').toLowerCase().split(/\s+/).filter(x => x.length >= 2)
  const lower = name.toLowerCase()
  const at = words.map(x => lower.indexOf(x.replace(/(s|x)$/, ''))).find(i => i >= 0)
  if (at === undefined || at < 0) { return [{ t: name, b: false }] }
  const len = (words.find(x => lower.indexOf(x.replace(/(s|x)$/, '')) === at) || '').replace(/(s|x)$/, '').length
  return [{ t: name.slice(0, at), b: false }, { t: name.slice(at, at + len), b: true }, { t: name.slice(at + len), b: false }].filter(x => x.t)
}
</script>

<template>
  <div class="sf-srch" :class="{ 'is-panel': panel, 'is-busy': busy }">
    <!-- the categories named like the words -->
    <div v-if="s.ShowSuggestions !== false && r.Suggestions?.length" class="sf-srch-suggest">
      <p class="sf-srch-label">{{ w('Suggestions') }}</p>
      <div class="sf-srch-chips"><a v-for="c in r.Suggestions" :key="c.Id" :href="c.Url" class="sf-srch-chip"><template v-for="(part, i) in bold(c.Name)" :key="i"><b v-if="part.b">{{ part.t }}</b><template v-else>{{ part.t }}</template></template></a></div>
    </div>
    <!-- the main categories of what was found, with how many products each has -->
    <div class="sf-srch-head">
      <nav v-if="s.ShowTabs !== false && r.Tabs?.length" class="sf-srch-tabs" :aria-label="w('Catégories')">
        <button type="button" :aria-pressed="!r.Tab" @click="emit('change', ask({ tab: 0 }))">{{ w('Tout') }}</button>
        <button v-for="tab in r.Tabs" :key="tab.Id" type="button" :aria-pressed="r.Tab === tab.Id" @click="emit('change', ask({ tab: tab.Id }))">{{ tab.Name }} <small>({{ tab.Count }})</small></button>
      </nav>
      <p v-else class="sf-srch-count" aria-live="polite">{{ w(r.Total > 1 ? '{a} résultats pour « {b} »' : '{a} résultat pour « {b} »', { a: r.Total, b: r.Term }) }}</p>
      <div class="sf-srch-tools">
        <button v-if="hasFilters" type="button" class="sf-srch-tool is-desk" :aria-expanded="sideShown" @click="sideShown = !sideShown"><SfIcon name="sliders-horizontal" :size="16" />{{ w(sideShown ? 'Masquer les filtres' : 'Afficher les filtres') }}<template v-if="filterCount"> ({{ filterCount }})</template></button>
        <button v-if="hasFilters" type="button" class="sf-srch-tool is-phone" aria-haspopup="dialog" @click="phoneOpen = true"><SfIcon name="sliders-horizontal" :size="16" />{{ w('Filtrer') }}<template v-if="filterCount"> ({{ filterCount }})</template></button>
        <label v-if="s.ShowSort !== false" class="sf-srch-tool sf-srch-sort"><SfIcon name="chevron-down" :size="16" class="sf-srch-caret" /><span class="sf-sr">{{ w('Trier par') }}</span>
          <select :value="r.Sort || ''" :aria-label="w('Trier par')" @change="emit('change', ask({ sort: ($event.target as HTMLSelectElement).value }))"><option v-for="o in sorts" :key="o.key" :value="o.key">{{ w(o.label) }}</option></select>
        </label>
        <div v-if="viewCount" class="sf-view" role="group" :aria-label="w('Produits par ligne')">
          <span>{{ w('Affichage') }}</span>
          <button v-for="i in viewCount" :key="i" type="button" :aria-pressed="viewShown === i - 1 ? 'true' : 'false'" :title="w('{a} produits par ligne', { a: viewDesk[Math.min(i - 1, viewDesk.length - 1)] })" @click="chooseView(i - 1)">{{ i }}</button>
        </div>
      </div>
    </div>
    <div class="sf-srch-body" :class="{ 'has-side': hasFilters && sideShown }">
      <aside v-if="hasFilters && sideShown" class="sf-srch-side" :aria-label="w('Filtres')"><SfFilters :key="JSON.stringify(r.Filters)" :filters="r.Filters" :currency="currency" :settings="s" :texts="texts" inline @apply="apply" /></aside>
      <div class="sf-srch-main">
        <div v-if="r.Products?.length" class="sf-grid" :style="{ '--cols': perRow, '--cols-m': perRowMobile, '--gx': (s.GapX ?? 16) + 'px', '--gy': (s.GapY ?? 32) + 'px' }">
          <SfProductCard v-for="(item, index) in r.Products" :key="item.Id" :product="item" :images="s.CardImages" :dots="s.CardDots !== false" :quick="s.QuickAdd !== false" :eager="index < 4" />
        </div>
        <p v-else-if="!busy" class="sf-muted">{{ texts?.EmptyText || w('Aucun produit ne correspond à votre recherche.') }}</p>
        <slot name="after" />
      </div>
    </div>
    <LazySfFilters v-if="phoneOpen" :filters="r.Filters" :currency="currency" :settings="s" :texts="texts" @close="phoneOpen = false" @apply="apply" />
  </div>
</template>
