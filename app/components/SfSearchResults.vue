<script setup lang="ts">
// What a search found, as its panel (opened by the search of the header) and its page /recherche show it: the categories named like the words, the main categories as tabs with how many
// products each has, the filters (a column on a computer, the « Filtrer » panel on a phone), the sort, two densities of the grid, then the products. Each choice is told to the parent
// (`change`), which reads the search again: the panel in place, the page by its address. What the shop shows is set on the page « Recherche » of the site builder.
const props = defineProps<{ result: any, settings?: any, texts?: any, panel?: boolean, busy?: boolean }>()
const emit = defineEmits<{ change: [ask: Record<string, string | number>], more: [] }>()
const w = useWords()
const s = computed(() => props.settings || {})
const r = computed(() => props.result || {})
const ask = (change: Record<string, string | number>) => ({ q: r.value.Term, attr: (r.value.Filters?.Attributes || []).join(','), min: r.value.Filters?.Min || 0, max: r.value.Filters?.Max || 0, tab: r.value.Tab || 0, sort: r.value.Sort || '', page: 1, ...change })
const hasFilters = computed(() => s.value.ShowFilters !== false && ((r.value.Filters?.Groups || []).length > 0 || r.value.Filters?.PriceMax > r.value.Filters?.PriceMin))
const filterCount = computed(() => (r.value.Filters?.Attributes || []).length + (r.value.Filters?.Max ? 1 : 0))
// the filters column can be hidden on a computer (« Masquer les filtres »); on a phone they open in their panel
const sideShown = ref(true)
const phoneOpen = ref(false)
const apply = (chosen: { attributes: number[], min: number, max: number }) => { phoneOpen.value = false; emit('change', ask({ attr: chosen.attributes.join(','), min: chosen.min, max: chosen.max })) }
const cols = computed(() => Math.max(2, Math.min(6, Number(s.value.Columns) || 4)))
const dense = ref(false)
const perRow = computed(() => (dense.value ? Math.min(6, cols.value + 1) : cols.value))
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
        <div class="sf-srch-density is-desk" role="group" :aria-label="w('Affichage')">
          <button type="button" :aria-pressed="!dense" :title="w('{a} produits par ligne', { a: cols })" @click="dense = false"><i v-for="i in 3" :key="i" /></button>
          <button type="button" :aria-pressed="dense" :title="w('{a} produits par ligne', { a: Math.min(6, cols + 1) })" @click="dense = true"><i v-for="i in 4" :key="i" /></button>
        </div>
      </div>
    </div>
    <div class="sf-srch-body" :class="{ 'has-side': hasFilters && sideShown }">
      <aside v-if="hasFilters && sideShown" class="sf-srch-side" :aria-label="w('Filtres')"><SfFilters :key="JSON.stringify(r.Filters)" :filters="r.Filters" :currency="currency" :settings="s" inline @apply="apply" /></aside>
      <div class="sf-srch-main">
        <div v-if="r.Products?.length" class="sf-grid" :style="{ '--cols': perRow, '--cols-m': s.ColumnsMobile || 2, '--gx': (s.GapX ?? 16) + 'px', '--gy': (s.GapY ?? 32) + 'px' }">
          <SfProductCard v-for="(item, index) in r.Products" :key="item.Id" :product="item" :images="s.CardImages" :dots="s.CardDots !== false" :quick="s.QuickAdd !== false" :eager="index < 4" />
        </div>
        <p v-else-if="!busy" class="sf-muted">{{ texts?.EmptyText || w('Aucun produit ne correspond à votre recherche.') }}</p>
        <slot name="after" />
      </div>
    </div>
    <LazySfFilters v-if="phoneOpen" :filters="r.Filters" :currency="currency" :settings="s" @close="phoneOpen = false" @apply="apply" />
  </div>
</template>
