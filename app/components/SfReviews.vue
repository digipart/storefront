<script setup lang="ts">
// The section « Avis clients »: reviews of the shop's customers (the ones put forward in Digipart, or the best rated), as cards in a grid or a row that scrolls, with the average of the shop above
// and, on each card, the product that was rated.
const props = defineProps<{ settings: any }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const prefix = computed(() => site.value?.Route?.Prefix || '')
const source = props.settings?.Source === 'best' ? 'best' : 'featured'
const limit = Math.max(1, Math.min(12, Number(props.settings?.Count) || 6))
const { data } = await useFetch<any>('/api/storefront/reviews', { query: { source, limit, lang }, key: 'sf-reviews-' + source + '-' + limit + '-' + lang.value, server: true })
const items = computed<any[]>(() => data.value?.Items || [])
const stars = (rating: number) => '★★★★★'.slice(0, Math.round(rating)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(rating))
const average = computed(() => String(data.value?.Average || '').replace('.', ','))
const columns = computed(() => Math.max(1, Math.min(4, Number(props.settings?.Columns) || 3)))
const productUrl = (product: any) => prefix.value + '/p/' + product.Slug + '-' + product.Id
</script>

<template>
  <div v-if="items.length" class="sf-reviews" :class="props.settings?.Layout === 'carousel' ? 'is-carousel' : 'is-grid'" :style="{ '--cols': columns }">
    <p v-if="props.settings?.ShowSummary !== false && data?.Total" class="sf-reviews-sum"><span class="sf-stars" aria-hidden="true">{{ stars(data.Average) }}</span> <strong>{{ average }} / 5</strong> · {{ data.Total }} {{ w('avis') }}</p>
    <ul class="sf-reviews-list">
      <li v-for="(item, index) in items" :key="index" class="sf-review">
        <div class="sf-stars" role="img" :aria-label="item.Rating + ' / 5'">{{ stars(item.Rating) }}</div>
        <p class="sf-review-text">{{ item.Comment }}</p>
        <div class="sf-review-by"><strong v-if="item.Author">{{ item.Author }}</strong></div>
        <a v-if="props.settings?.ShowProduct !== false && item.Product" :href="productUrl(item.Product)" class="sf-review-product">{{ item.Product.Name }}</a>
      </li>
    </ul>
  </div>
</template>
