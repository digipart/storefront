<script setup lang="ts">
// The products of a "Sélection de produits" section: the newest of the channel, those of a category, or the ones the shop chose; in a grid or a row the visitor swipes.
const props = defineProps<{ section: any }>()
const site = inject<Ref<any>>('sfSite')!
const product = inject<Ref<any> | null>('sfProduct', null)
const s = computed(() => props.section.Settings || {})
const recommended = computed(() => s.value.Source === 'recommendation')
const { data } = await useFetch<any>('/api/storefront/products', {
  key: 'sf-products-' + props.section.Id + '-' + (site.value?.Route?.LanguageIsoCode || 'fr') + '-' + (recommended.value ? product?.value?.Id || 0 : 0),
  query: { mode: recommended.value ? 'recommendation' : s.value.Source === 'manual' ? 'manual' : s.value.Source === 'category' ? 'category' : 'latest', product: recommended.value ? product?.value?.Id || '' : '', reco: s.value.Recommendation || 'crosssell', category: s.value.IdCategory || 0, ids: (s.value.ProductIds || []).join(','), limit: s.value.Limit || 4,
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
