<script setup lang="ts">
// A carousel: slides the visitor swipes through (scroll snap, so it reads without any script), with what the shop chose in the site builder: arrows (shape, place, size, colours, border, distance
// from the edges), dots (round, square or dashes; on the picture or under the carousel), and the slides moving on by themselves (paused under the pointer, when the page is hidden, and for
// visitors who asked for less motion).
const props = defineProps<{ slides: any[], settings: any, first?: boolean }>()
const w = useWords()
const s = computed(() => props.settings || {})
const track = ref<HTMLElement | null>(null)
const at = ref(0)
const many = computed(() => props.slides.length > 1)
const vimeo = (value: unknown) => { const found = String(value || '').match(/vimeo\.com\/(?:video\/)?(\d{6,12})(?:\/([0-9a-f]{6,20}))?/i); return found ? 'https://player.vimeo.com/video/' + found[1] + '?background=1&autoplay=1&loop=1&muted=1&dnt=1' + (found[2] ? '&h=' + found[2] : '') : '' }
const rgba = (hex: string, alpha: number) => { let h = String(hex || '#ffffff').replace('#', ''); if (h.length === 3) { h = h.split('').map(c => c + c).join('') } const n = parseInt(h, 16) || 0; return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})` }
const go = (index: number) => { const el = track.value; if (!el) { return } const n = props.slides.length, to = ((index % n) + n) % n; el.scrollTo({ left: to * el.clientWidth, behavior: 'smooth' }) }
const onScroll = () => { const el = track.value; if (el && el.clientWidth) { at.value = Math.round(el.scrollLeft / el.clientWidth) } }
const arrow = (next: boolean) => {
  const v = s.value, size = Number(v.ArrowSize || 40), inset = Number(v.ArrowInset ?? 16), bottom = v.ArrowPlace === 'bottom'
  return {
    width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.55) + 'px', color: v.ArrowColor || '#1e2129', borderRadius: ({ circle: '50%', rounded: '8px' } as Record<string, string>)[v.ArrowShape || 'circle'] || '0',
    background: v.ArrowShape === 'none' ? 'transparent' : rgba(v.ArrowBg, Number(v.ArrowBgOpacity ?? 90) / 100), border: Number(v.ArrowBorder) > 0 ? v.ArrowBorder + 'px solid ' + (v.ArrowBorderColor || '#1e2129') : '0',
    ...(bottom ? { bottom: inset + 'px', right: (next ? inset : inset + size + 8) + 'px' } : { top: 'calc(50% - ' + size / 2 + 'px)', [next ? 'right' : 'left']: inset + 'px' }),
  }
}
const dotsBox = computed(() => { const v = s.value, inset = Number(v.DotInset ?? 16), below = v.DotPlace === 'below'; return { gap: Number(v.DotGap || 7) + 'px', justifyContent: ({ left: 'flex-start', right: 'flex-end' } as Record<string, string>)[v.DotAlign] || 'center', ...(below ? { padding: inset + 'px ' + inset + 'px 0' } : { bottom: inset + 'px', left: inset + 'px', right: inset + 'px' }) } })
const dot = (index: number) => { const v = s.value, size = Number(v.DotSize || 9), bar = v.DotShape === 'bar'; return { width: (bar ? Math.round(size * 2.6) : size) + 'px', height: (bar ? Math.max(3, Math.round(size / 3)) : size) + 'px', borderRadius: v.DotShape === 'square' ? '0' : '99px', background: v.DotColor || '#ffffff', opacity: index === at.value ? 1 : 0.45 } }
let timer: ReturnType<typeof setInterval> | null = null
const paused = ref(false)
onMounted(() => {
  if (!s.value.Autoplay || !many.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return }
  timer = setInterval(() => { if (!paused.value && !document.hidden) { go(at.value + 1) } }, Math.max(2, Number(s.value.Interval) || 5) * 1000)
})
onBeforeUnmount(() => { if (timer) { clearInterval(timer) } })
</script>

<template>
  <div class="sf-carousel" @mouseenter="paused = true" @mouseleave="paused = false" @focusin="paused = true" @focusout="paused = false">
    <div class="sf-carousel-view">
      <div ref="track" class="sf-slides" @scroll.passive="onScroll">
        <div v-for="slide in slides" :key="slide.Id" class="sf-hero sf-slide" :class="{ 'is-empty': !slide.Settings.Image && !vimeo(slide.Settings.Video) }">
          <picture v-if="slide.Settings.Image">
            <source v-if="slide.Settings.ImageMobile" media="(max-width: 767px)" :srcset="slide.Settings.ImageMobile">
            <img :src="slide.Settings.Image" alt="" :loading="first && slide === slides[0] ? 'eager' : 'lazy'" decoding="async">
          </picture>
          <span v-if="vimeo(slide.Settings.Video)" class="sf-hero-video"><iframe :src="vimeo(slide.Settings.Video)" title="" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" tabindex="-1" aria-hidden="true" /></span>
          <component :is="slide.Settings.Url && !slide.Texts.ButtonText ? 'a' : 'div'" :href="slide.Settings.Url && !slide.Texts.ButtonText ? slide.Settings.Url : undefined" class="sf-hero-copy">
            <h2 v-if="slide.Texts.Title" class="sf-h" :style="{ '--size': (s.TitleSize || 44) + 'px' }">{{ slide.Texts.Title }}</h2>
            <p v-if="slide.Texts.Text" class="sf-text">{{ slide.Texts.Text }}</p>
            <a v-if="slide.Texts.ButtonText" :href="slide.Settings.Url || undefined" class="sf-btn" :class="['is-' + (s.ButtonStyle || 'solid'), { 'is-light': s.ButtonStyle === 'solid' }]">{{ slide.Texts.ButtonText }}</a>
          </component>
        </div>
      </div>
      <template v-if="many && s.Arrows !== false">
        <button type="button" class="sf-carousel-arrow" :class="{ 'is-desk': !s.ArrowsMobile }" :style="arrow(false)" :aria-label="w('Diapositive précédente')" @click="go(at - 1)">‹</button>
        <button type="button" class="sf-carousel-arrow" :class="{ 'is-desk': !s.ArrowsMobile }" :style="arrow(true)" :aria-label="w('Diapositive suivante')" @click="go(at + 1)">›</button>
      </template>
      <div v-if="many && s.Dots !== false && s.DotPlace !== 'below'" class="sf-carousel-dots is-inside" :style="dotsBox"><button v-for="(slide, i) in slides" :key="slide.Id" type="button" :style="dot(i)" :aria-label="w('Diapositive') + ' ' + (i + 1)" :aria-current="i === at ? 'true' : undefined" @click="go(i)" /></div>
    </div>
    <div v-if="many && s.Dots !== false && s.DotPlace === 'below'" class="sf-carousel-dots" :style="dotsBox"><button v-for="(slide, i) in slides" :key="slide.Id" type="button" :style="dot(i)" :aria-label="w('Diapositive') + ' ' + (i + 1)" :aria-current="i === at ? 'true' : undefined" @click="go(i)" /></div>
  </div>
</template>
