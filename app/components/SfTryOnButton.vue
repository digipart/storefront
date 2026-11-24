<script setup lang="ts">
// « Essayez-le » on the photos of a product: shown only when the shop offers the virtual try-on for this product (module Essayage virtuel of Digipart: on, the kind of product switched on, a
// retouched photo). Asked once the page is in the browser: the page itself is the same for every visitor and stays in the cache.
const props = defineProps<{ product: any }>()
const w = useWords()
const info = ref<{ Enabled: boolean, Kind?: string, Framing?: string, SiteKey?: string } | null>(null)
const open = ref(false)
onMounted(async () => {
  try { info.value = await $fetch('/api/storefront/try-on', { query: { IdProduct: props.product?.Id } }) } catch { info.value = null }
})
</script>

<template>
  <div v-if="info?.Enabled" class="sf-tryon-launch">
    <button type="button" class="sf-tryon-btn" :aria-label="w('Essayez-le')" @click="open = true">
      <span class="sf-tryon-btn-label" aria-hidden="true">{{ w('Essayez-le') }}</span>
      <span class="sf-tryon-btn-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7.5a1.8 1.8 0 1 0-1.8-1.8" /><path d="M12 7.5v1.2L3.6 14.6A1.2 1.2 0 0 0 4.3 16.8h15.4a1.2 1.2 0 0 0 .7-2.2L12 8.7" /></svg></span>
    </button>
    <LazySfTryOn v-if="open" :product="product" :framing="info.Framing || 'any'" :site-key="info.SiteKey || ''" @close="open = false" />
  </div>
</template>
