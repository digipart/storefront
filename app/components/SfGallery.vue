<script setup lang="ts">
// The photos of a product, as the shop chose in the site builder: a grid of two columns, one under the other, a horizontal carousel (1, 2 or 3 photos seen at once, arrows), or one photo with
// small ones under it (or, on a computer, in a column on its left: `thumbs` = left; the photo may then fill the height of the screen: `fit` = screen). On a phone they are always swiped one by
// one. A photo opens the full-screen viewer.
const props = defineProps<{ images: string[], sets?: string[], name: string, layout?: string, perView?: number, arrows?: any, thumbs?: string, fit?: string }>()
// how wide a photo is drawn, for the browser to take the right size of it
const sizes = computed(() => '(max-width: 767px) 100vw, ' + (layout.value === 'grid' || (layout.value === 'carousel' && per.value > 1) ? Math.round(64 / (layout.value === 'carousel' ? per.value : 2)) : 64) + 'vw')
const emit = defineEmits<{ zoom: [index: number] }>()
const w = useWords()
const layout = computed(() => (['grid', 'stack', 'carousel', 'slider'].includes(String(props.layout)) ? String(props.layout) : 'grid'))
const per = computed(() => Math.max(1, Math.min(3, Number(props.perView) || 2)))
const track = ref<HTMLElement | null>(null)
const at = ref(0), atEnd = ref(false)
const scrolls = computed(() => layout.value === 'carousel' || layout.value === 'slider')
function watch() { const box = track.value; if (!box) { return } const step = box.firstElementChild ? (box.firstElementChild as HTMLElement).offsetWidth : box.clientWidth; at.value = Math.round(box.scrollLeft / Math.max(1, step)); atEnd.value = box.scrollLeft + box.clientWidth >= box.scrollWidth - 4 }
function go(to: number) { const box = track.value; const item = box?.children[Math.max(0, Math.min(props.images.length - 1, to))] as HTMLElement | undefined; if (box && item) { box.scrollTo({ left: item.offsetLeft - box.offsetLeft, behavior: 'smooth' }) } }
onMounted(watch)
// the arrows of the carousel as the shop drew them (site builder, section Produit, group « Flèches du carrousel »): shape, size, place, colours, border; by default a white circle with a dark line
const rgba = (hex: string, alpha: number) => { let h = String(hex || '#ffffff').replace('#', ''); if (h.length === 3) { h = h.split('').map(c => c + c).join('') } const n = parseInt(h, 16) || 0; return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})` }
const arrow = (next: boolean) => {
  const v = props.arrows || {}, size = Math.max(24, Math.min(72, Number(v.ArrowSize) || 44)), inset = Number(v.ArrowInset ?? 16), bottom = v.ArrowPlace === 'bottom', border = Number(v.ArrowBorder ?? 1)
  return {
    width: size + 'px', height: size + 'px', marginTop: 0, fontSize: Math.round(size * 0.55) + 'px', color: v.ArrowColor || '#1e2129', borderRadius: ({ circle: '50%', rounded: '8px' } as Record<string, string>)[v.ArrowShape || 'circle'] || '0',
    background: v.ArrowShape === 'none' ? 'transparent' : rgba(v.ArrowBg || '#ffffff', Number(v.ArrowBgOpacity ?? 85) / 100), border: border > 0 && v.ArrowShape !== 'none' ? border + 'px solid ' + (v.ArrowBorderColor || '#1e2129') : '0',
    ...(bottom ? { top: 'auto', bottom: inset + 'px', left: 'auto', right: (next ? inset : inset + size + 8) + 'px' } : { top: 'calc(50% - ' + size / 2 + 'px)', [next ? 'right' : 'left']: inset + 'px' }),
  }
}
</script>

<template>
  <div class="sf-gallery-wrap" :class="['is-' + layout, { 'has-hover-arrows': arrows?.ArrowHover, 'is-thumbs-left': layout === 'slider' && thumbs === 'left', 'is-fit-screen': layout === 'slider' && fit === 'screen' }]">
    <div ref="track" class="sf-gallery" :class="'is-' + layout" :style="{ '--per': per }" @scroll.passive="watch">
      <template v-if="images.length"><img v-for="(src, index) in images" :key="src" :src="src" :srcset="sets?.[index] || undefined" :sizes="sizes" :alt="index === 0 ? name : ''" :loading="index === 0 ? 'eager' : 'lazy'" :fetchpriority="index === 0 ? 'high' : undefined" decoding="async" role="button" tabindex="0" :aria-label="w('Agrandir la photo {a}', { a: index + 1 })" @click="emit('zoom', index)" @keydown.enter="emit('zoom', index)"></template>
      <span v-else class="sf-card-empty" aria-hidden="true" />
    </div>
    <template v-if="layout === 'carousel' && images.length > per">
      <button v-if="at > 0" type="button" class="sf-gallery-nav is-prev" :style="arrow(false)" :aria-label="w('Photo précédente')" @click="go(at - 1)">‹</button>
      <button v-if="!atEnd" type="button" class="sf-gallery-nav is-next" :style="arrow(true)" :aria-label="w('Photo suivante')" @click="go(at + 1)">›</button>
    </template>
    <div v-if="layout === 'slider' && images.length > 1" class="sf-gallery-thumbs">
      <button v-for="(src, index) in images" :key="src" type="button" :class="{ 'is-on': index === at }" :aria-label="w('Photo {a} sur {b}', { a: index + 1, b: images.length })" :aria-current="index === at ? 'true' : undefined" @click="go(index)"><img :src="src" alt="" loading="lazy"></button>
    </div>
  </div>
</template>
