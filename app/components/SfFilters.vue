<script setup lang="ts">
// The filters of a category in a side panel: the sizes and colours its products have, and a price range. « Voir les produits » applies them (they go in the address of the page).
const props = defineProps<{ filters: any, currency: string }>()
const emit = defineEmits<{ close: [], apply: [chosen: { attributes: number[], min: number, max: number }] }>()
const w = useWords()
const chosen = ref<number[]>([...props.filters.Attributes])
const min = ref<number | ''>(props.filters.Min || '')
const max = ref<number | ''>(props.filters.Max || '')
const panel = ref<HTMLElement | null>(null)
const apply = () => emit('apply', { attributes: chosen.value, min: Number(min.value) || 0, max: Number(max.value) || (Number(min.value) ? props.filters.PriceMax : 0) })
const clear = () => emit('apply', { attributes: [], min: 0, max: 0 })
onMounted(() => { document.documentElement.style.overflow = 'hidden'; nextTick(() => panel.value?.focus()) })
onBeforeUnmount(() => { document.documentElement.style.overflow = '' })
</script>

<template>
  <div class="sf-drawer" @keydown.esc="emit('close')">
    <div class="sf-drawer-veil" @click="emit('close')" />
    <aside ref="panel" class="sf-drawer-panel sf-filters" role="dialog" aria-modal="true" :aria-label="w('Filtres')" tabindex="-1">
      <header class="sf-drawer-head"><h2>{{ w('Filtres') }}</h2><button type="button" :aria-label="w('Fermer')" @click="emit('close')">✕</button></header>
      <form class="sf-drawer-body" @submit.prevent="apply">
        <fieldset v-for="group in filters.Groups" :key="group.Name">
          <legend>{{ group.Name }}</legend>
          <div class="sf-filters-values"><label v-for="value in group.Values" :key="value.Id"><input v-model="chosen" type="checkbox" :value="value.Id">{{ value.Name }}</label></div>
        </fieldset>
        <fieldset v-if="filters.PriceMax > filters.PriceMin">
          <legend>{{ w('Prix') }} ({{ currency }})</legend>
          <div class="sf-filters-price">
            <input v-model.number="min" type="number" inputmode="numeric" min="0" :max="filters.PriceMax" :placeholder="String(filters.PriceMin)" :aria-label="w('Prix minimum')">
            <span aria-hidden="true">–</span>
            <input v-model.number="max" type="number" inputmode="numeric" min="0" :placeholder="String(filters.PriceMax)" :aria-label="w('Prix maximum')">
          </div>
        </fieldset>
      </form>
      <footer class="sf-drawer-foot"><button type="button" class="sf-btn" @click="apply">{{ w('Voir les produits') }}</button><button type="button" class="sf-btn is-outline" @click="clear">{{ w('Tout effacer') }}</button></footer>
    </aside>
  </div>
</template>
