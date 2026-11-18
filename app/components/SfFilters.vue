<script setup lang="ts">
// The filters of a category: the sizes, colours... its products have, and a price range. Two places (site builder, section « Grille des produits », group Filtres): a side panel (« Voir les
// produits » applies what was chosen) or a column beside the products (`inline`: each choice applies at once). The colours of a colour group are swatches (the picture of the swatch, else the colour
// code, Catalogue > Attributs); the other values are buttons or check boxes; the price is a slider with two handles, two fields, or both. Each heading folds and unfolds its values.
const props = defineProps<{ filters: any, currency: string, settings?: any, inline?: boolean }>()
const emit = defineEmits<{ close: [], apply: [chosen: { attributes: number[], min: number, max: number }] }>()
const w = useWords()
const site = inject<Ref<any> | null>('sfSite', null)
const s = computed(() => props.settings || {})
const chosen = ref<number[]>([...props.filters.Attributes])
const floor = computed(() => Math.floor(Number(props.filters.PriceMin) || 0))
const ceil = computed(() => Math.max(floor.value + 1, Math.ceil(Number(props.filters.PriceMax) || 0)))
const lo = ref<number>(props.filters.Max ? Math.max(floor.value, Number(props.filters.Min) || 0) : floor.value)
const hi = ref<number>(props.filters.Max ? Math.min(ceil.value, Number(props.filters.Max)) : ceil.value)
const hasPrice = computed(() => props.filters.PriceMax > props.filters.PriceMin)
const priceMode = computed(() => (['slider', 'inputs', 'both'].includes(String(s.value.FilterPrice)) ? String(s.value.FilterPrice) : 'slider'))
const colorMode = computed(() => (['swatches', 'dots', 'text'].includes(String(s.value.FilterColors)) ? String(s.value.FilterColors) : 'swatches'))
const valueMode = computed(() => (s.value.FilterSizes === 'checkboxes' ? 'checkboxes' : 'buttons'))
const panel = ref<HTMLElement | null>(null)
const money = (value: number) => { try { return new Intl.NumberFormat(site?.value?.Route?.LanguageIsoCode || 'fr', { style: 'currency', currency: props.currency || 'EUR', maximumFractionDigits: 0 }).format(value) } catch { return value + ' ' + props.currency } }
const pct = (value: number) => ((value - floor.value) * 100) / Math.max(1, ceil.value - floor.value)

// a heading folds its values: open at first as the shop chose (all, the first, none), and always open when something is chosen in it
const keys = computed(() => [...props.filters.Groups.map((g: any) => 'g:' + g.Name), ...(hasPrice.value ? ['price'] : [])])
const active = (key: string) => (key === 'price' ? !!props.filters.Max : props.filters.Groups.some((g: any) => 'g:' + g.Name === key && g.Values.some((v: any) => props.filters.Attributes.includes(v.Id))))
const opened = ref<Set<string>>(new Set(keys.value.filter((key, i) => active(key) || (s.value.FilterOpen || 'all') === 'all' || ((s.value.FilterOpen || 'all') === 'first' && i === 0))))
const toggle = (key: string) => { const next = new Set(opened.value); if (next.has(key)) { next.delete(key) } else { next.add(key) } opened.value = next }

// a colour shows a swatch when it has a picture or a code; a colour group with none keeps its words
const swatch = (value: any) => (value.Image ? { backgroundImage: `url("${String(value.Image).replace(/"/g, '%22')}")` } : value.Code ? { background: value.Code } : null)
const swatched = (group: any) => group.IsColor && colorMode.value !== 'text' && group.Values.some((v: any) => v.Image || v.Code)

const apply = () => {
  const full = lo.value <= floor.value && hi.value >= ceil.value
  emit('apply', { attributes: chosen.value, min: full ? 0 : lo.value, max: full ? 0 : hi.value })
}
const clear = () => emit('apply', { attributes: [], min: 0, max: 0 })
// in the column a choice applies at once (the slider when it is let go)
const changed = () => { if (props.inline) { apply() } }
const slideLo = () => { if (lo.value > hi.value) { lo.value = hi.value } }
const slideHi = () => { if (hi.value < lo.value) { hi.value = lo.value } }
const typed = () => { lo.value = Math.max(floor.value, Math.min(Number(lo.value) || floor.value, ceil.value)); hi.value = Math.min(ceil.value, Math.max(Number(hi.value) || ceil.value, lo.value)); changed() }
const anyChosen = computed(() => props.filters.Attributes.length > 0 || !!props.filters.Max)

onMounted(() => { if (props.inline) { return } document.documentElement.style.overflow = 'hidden'; nextTick(() => panel.value?.focus()) })
onBeforeUnmount(() => { if (!props.inline) { document.documentElement.style.overflow = '' } })
</script>

<template>
  <div :class="inline ? 'sf-filters-col' : 'sf-drawer'" @keydown.esc="!inline && emit('close')">
    <div v-if="!inline" class="sf-drawer-veil" @click="emit('close')" />
    <component :is="inline ? 'div' : 'aside'" ref="panel" class="sf-filters" :class="inline ? 'is-inline' : 'sf-drawer-panel'" v-bind="inline ? {} : { role: 'dialog', 'aria-modal': 'true', 'aria-label': w('Filtres'), tabindex: '-1' }">
      <header v-if="!inline" class="sf-drawer-head"><h2>{{ w('Filtres') }}</h2><button type="button" :aria-label="w('Fermer')" @click="emit('close')">✕</button></header>
      <form :class="{ 'sf-drawer-body': !inline }" @submit.prevent="apply">
        <section v-for="group in filters.Groups" :key="group.Name" class="sf-fgroup">
          <button type="button" class="sf-fhead" :aria-expanded="opened.has('g:' + group.Name) ? 'true' : 'false'" @click="toggle('g:' + group.Name)">{{ group.Name }}<span class="sf-fchev" aria-hidden="true" /></button>
          <div v-show="opened.has('g:' + group.Name)" class="sf-fvalues" :class="swatched(group) ? 'is-colors is-' + colorMode + (s.FilterSwatch === 'square' ? ' is-square' : '') : 'is-' + valueMode">
            <label v-for="value in group.Values" :key="value.Id" :class="{ 'is-on': chosen.includes(value.Id) }" :title="swatched(group) && colorMode === 'dots' ? value.Name : undefined">
              <input v-model="chosen" type="checkbox" :value="value.Id" @change="changed">
              <span v-if="swatched(group)" class="sf-swatch" :class="{ 'is-none': !swatch(value) }" :style="swatch(value) || undefined" aria-hidden="true" />
              <span :class="{ 'sf-sr': swatched(group) && colorMode === 'dots' }">{{ value.Name }}</span>
            </label>
          </div>
        </section>
        <section v-if="hasPrice" class="sf-fgroup">
          <button type="button" class="sf-fhead" :aria-expanded="opened.has('price') ? 'true' : 'false'" @click="toggle('price')">{{ w('Prix') }}<span class="sf-fchev" aria-hidden="true" /></button>
          <div v-show="opened.has('price')" class="sf-fprice">
            <template v-if="priceMode !== 'inputs'">
              <div class="sf-range-values"><span>{{ money(lo) }}</span><span>{{ money(hi) }}</span></div>
              <div class="sf-range" :style="{ '--a': pct(lo) + '%', '--b': pct(hi) + '%' }">
                <input v-model.number="lo" type="range" :min="floor" :max="ceil" step="1" :aria-label="w('Prix minimum')" :aria-valuetext="money(lo)" @input="slideLo" @change="changed">
                <input v-model.number="hi" type="range" :min="floor" :max="ceil" step="1" :aria-label="w('Prix maximum')" :aria-valuetext="money(hi)" @input="slideHi" @change="changed">
              </div>
            </template>
            <div v-if="priceMode !== 'slider'" class="sf-filters-price">
              <input v-model.number="lo" type="number" inputmode="numeric" :min="floor" :max="ceil" :aria-label="w('Prix minimum')" @change="typed">
              <span aria-hidden="true">–</span>
              <input v-model.number="hi" type="number" inputmode="numeric" :min="floor" :max="ceil" :aria-label="w('Prix maximum')" @change="typed">
              <span class="sf-muted">{{ currency }}</span>
            </div>
          </div>
        </section>
        <button v-if="inline && anyChosen" type="button" class="sf-filters-clear" @click="clear">{{ w('Tout effacer') }}</button>
      </form>
      <footer v-if="!inline" class="sf-drawer-foot"><button type="button" class="sf-btn" @click="apply">{{ w('Voir les produits') }}</button><button type="button" class="sf-btn is-outline" @click="clear">{{ w('Tout effacer') }}</button></footer>
    </component>
  </div>
</template>
