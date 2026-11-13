<script setup lang="ts">
// A product in a grid: its photo (the second on hover, or all of them swiped through, as the section says), its name, its price and its discount. The whole card is the link to the product.
const props = defineProps<{ product: any, images?: string, dots?: boolean, eager?: boolean }>()
const site = inject<Ref<any>>('sfSite')!
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const mode = computed(() => (props.images === 'carousel' && props.product.Images.length > 1 ? 'carousel' : props.images === 'hover' && props.product.Images.length > 1 ? 'hover' : 'single'))
const shown = computed(() => (mode.value === 'carousel' ? props.product.Images.slice(0, 8) : props.product.Images.slice(0, mode.value === 'hover' ? 2 : 1)))
</script>

<template>
  <article class="sf-card">
    <a :href="product.Url" class="sf-card-media" :class="'is-' + mode" :aria-label="product.Name">
      <template v-if="shown.length">
        <img v-for="(src, index) in shown" :key="src" :src="src" :srcset="product.ImageSets?.[index] || undefined" sizes="(max-width: 767px) 50vw, (max-width: 1200px) 33vw, 25vw" :alt="index === 0 ? product.Name : ''" :loading="eager && index === 0 ? 'eager' : 'lazy'" decoding="async">
      </template>
      <span v-else class="sf-card-empty" aria-hidden="true" />
      <span v-if="product.Discount" class="sf-card-badge">-{{ product.Discount }} %</span>
      <span v-if="mode === 'carousel' && dots !== false" class="sf-card-dots" aria-hidden="true"><i v-for="(src, index) in shown" :key="index" /></span>
    </a>
    <a :href="product.Url" class="sf-card-name">{{ product.Name }}</a>
    <div class="sf-card-price"><SfPrice :product="product" /></div>
  </article>
</template>
