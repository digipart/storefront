<script setup lang="ts">
// « Complétez votre panier »: products that go with what is in the cart (the recommendations of Digipart for its first article, then its category, then the newest), added in one tap when they have
// no size to choose.
// `product`: the product to go with (the one just added), instead of the first article of the cart; `title`: another title
const props = defineProps<{ product?: number, title?: string }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const { cart, add, busy } = useCart()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const products = ref<any[]>([])
const first = computed(() => props.product || cart.value.Lines[0]?.IdProduct || 0)
async function load() {
  if (!first.value) { products.value = []; return }
  try { products.value = (await $fetch<any>('/api/storefront/products', { query: { mode: 'recommendation', product: first.value, limit: 8, lang: lang.value, prefix: site.value?.Route?.Prefix || '' } })).Products || [] } catch { products.value = [] }
}
onMounted(load)
watch(first, load)
const shown = computed(() => products.value.filter(product => product.Available && (product.PriceState || 'ok') === 'ok' && !cart.value.Lines.some((line: any) => line.IdProduct === product.Id)).slice(0, 6))
</script>

<template>
  <section v-if="shown.length" class="sf-more" :aria-label="title || w('Complétez votre panier')">
    <h3>{{ title || w('Complétez votre panier') }}</h3>
    <div class="sf-more-row">
      <article v-for="product in shown" :key="product.Id" class="sf-more-card">
        <a :href="product.Url" class="sf-line-pic" tabindex="-1" aria-hidden="true"><img v-if="product.Images[0]" :src="product.Images[0]" alt="" loading="lazy" @error="($event.target as HTMLImageElement).style.visibility = 'hidden'"></a>
        <a :href="product.Url" class="sf-more-name">{{ product.Name }}</a>
        <button v-if="!product.Variants.length && !product.TaxExcl" type="button" class="sf-btn" :disabled="busy" @click="add(product.Id, 0, 1)">{{ w('Ajouter') }} – {{ money(product.Price, product.Currency, lang) }}</button>
        <a v-else :href="product.Url" class="sf-btn is-outline">{{ w('Choisir') }} – {{ money(product.Price, product.Currency, lang) }}</a>
      </article>
    </div>
  </section>
</template>
