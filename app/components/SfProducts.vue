<script setup lang="ts">
// The products of a "Sélection de produits" section: the newest of the channel, those of a category, the ones the shop chose, the most viewed / put in a cart / sold, or « Pour vous »; in a grid or a row the visitor swipes.
const props = defineProps<{ section: any }>()
const site = inject<Ref<any>>('sfSite')!
const product = inject<Ref<any> | null>('sfProduct', null)
const s = computed(() => props.section.Settings || {})
const recommended = computed(() => s.value.Source === 'recommendation')
const sourceMode = computed(() => (['recommendation', 'manual', 'category', 'top_viewed', 'top_cart', 'top_sales', 'personal'].includes(String(s.value.Source)) ? String(s.value.Source) : 'latest'))
const personal = computed(() => sourceMode.value === 'personal')
const { data } = await useFetch<any>('/api/storefront/products', {
  key: 'sf-products-' + props.section.Id + '-' + (site.value?.Route?.LanguageIsoCode || 'fr') + '-' + (recommended.value ? product?.value?.Id || 0 : 0),
  // « Pour vous » belongs to one visitor: read by his browser, never put in the page a cache could share
  server: !personal.value, lazy: personal.value,
  query: { mode: sourceMode.value, days: s.value.Days || 30, fallback: s.value.Fallback || 'top_sales', product: recommended.value ? product?.value?.Id || '' : '', reco: s.value.Recommendation || 'crosssell', category: s.value.IdCategory || 0, ids: (s.value.ProductIds || []).join(','), limit: s.value.Limit || 4,
    lang: site.value?.Route?.LanguageIsoCode || 'fr', prefix: site.value?.Route?.Prefix || '' },
})
const products = computed(() => data.value?.Products || [])
</script>

<template>
  <div v-if="products.length" class="sf-grid sf-products" :class="{ 'is-carousel': s.Layout === 'carousel', 'is-carousel-mobile': s.CarouselMobile }"
    :style="{ '--cols': s.Columns || 4, '--cols-m': s.ColumnsMobile || 2, '--gx': (s.GapX ?? 16) + 'px', '--gy': (s.GapY ?? 24) + 'px', textAlign: 'left' }">
    <SfProductCard v-for="product in products" :key="product.Id" :product="product" :images="s.CardImages" :dots="s.CardDots" />
  </div>
</template>
