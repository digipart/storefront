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
// placed on the top right corner of the photo shown (the photo may be narrower than its column), below the header when the header lies over it
const box = ref<HTMLElement | null>(null)
const spot = ref<Record<string, string>>({})
let stop = () => {}
const place = () => {
  const wrap = box.value?.closest('.sf-gallery-wrap') as HTMLElement | null
  if (!wrap) { return }
  const around = wrap.getBoundingClientRect()
  const shown = [...wrap.querySelectorAll<HTMLElement>('.sf-gallery > img, .sf-gallery > .sf-gallery-film')].map(el => el.getBoundingClientRect()).find(r => r.width > 0 && r.right > around.left + 1 && r.left < around.right - 1)
  if (!shown) { spot.value = {}; return }
  const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sf-header-h')) || 0
  const top = shown.top - around.top, pageTop = around.top + window.scrollY + top
  spot.value = { top: Math.round(top + 12 + Math.max(0, header - pageTop)) + 'px', right: Math.round(around.right - Math.min(shown.right, around.right) + 12) + 'px' }
}
watch(info, async (now) => {
  if (!now?.Enabled) { return }
  await nextTick()
  const wrap = box.value?.closest('.sf-gallery-wrap')
  const track = wrap?.querySelector('.sf-gallery')
  const watcher = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null
  if (wrap) { watcher?.observe(wrap) }
  track?.addEventListener('scroll', place, { passive: true })
  wrap?.addEventListener('load', place, true)
  window.addEventListener('resize', place)
  place()
  stop = () => { watcher?.disconnect(); track?.removeEventListener('scroll', place); wrap?.removeEventListener('load', place, true); window.removeEventListener('resize', place) }
})
onBeforeUnmount(() => stop())
</script>

<template>
  <div v-if="info?.Enabled" ref="box" class="sf-tryon-launch" :style="spot">
    <button type="button" class="sf-tryon-btn" :aria-label="w('Essayez-le')" @click="open = true">
      <span class="sf-tryon-btn-label" aria-hidden="true">{{ w('Essayez-le') }}</span>
      <span class="sf-tryon-btn-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7.5a1.8 1.8 0 1 0-1.8-1.8" /><path d="M12 7.5v1.2L3.6 14.6A1.2 1.2 0 0 0 4.3 16.8h15.4a1.2 1.2 0 0 0 .7-2.2L12 8.7" /></svg></span>
    </button>
    <LazySfTryOn v-if="open" :product="product" :framing="info.Framing || 'any'" :site-key="info.SiteKey || ''" @close="open = false" />
  </div>
</template>
