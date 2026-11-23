<script setup lang="ts">
// The photos of a product, as the shop chose in the site builder: a grid of two columns, one under the other, a horizontal carousel (1, 2 or 3 photos seen at once, arrows), or one photo with
// small ones under it (or, on a computer, in a column on its left: `thumbs` = left; the photo may then fill the height of the screen: `fit` = screen). On a phone they are always swiped one by
// one. A photo opens the full-screen viewer. With `scroll` = down (one photo, on a computer) the photos are one under the other inside the frame of one photo: the wheel over the photo shows
// the next one, and after the last one the page goes on scrolling (the browser hands the scroll over: nothing is held back).
const props = defineProps<{ images: string[], sets?: string[], name: string, layout?: string, perView?: number, arrows?: any, thumbs?: string, fit?: string, scroll?: string, video?: { Type: string, Src: string, MimeType: string, Cover: boolean } | null }>()
// the photos and the video of the product, in the order they are shown: the video first when the shop put it on the cover, else after the photos
type Slide = { kind: 'img' | 'file' | 'vimeo', src: string, i: number }
const slides = computed<Slide[]>(() => {
  const list: Slide[] = props.images.map((src, i) => ({ kind: 'img', src, i }))
  const v = props.video
  if (!v?.Src || (v.Type !== 'file' && v.Type !== 'vimeo')) { return list }
  const film: Slide = { kind: v.Type, src: v.Type === 'vimeo' ? v.Src + '?background=1&autoplay=1&loop=1&muted=1&dnt=1' : v.Src, i: -1 }
  return v.Cover ? [film, ...list] : [...list, film]
})
// how wide a photo is drawn, for the browser to take the right size of it
const sizes = computed(() => '(max-width: 767px) 100vw, ' + (layout.value === 'grid' || (layout.value === 'carousel' && per.value > 1) ? Math.round(64 / (layout.value === 'carousel' ? per.value : 2)) : 64) + 'vw')
const emit = defineEmits<{ zoom: [index: number] }>()
const w = useWords()
const layout = computed(() => (['grid', 'stack', 'carousel', 'slider'].includes(String(props.layout)) ? String(props.layout) : 'grid'))
const per = computed(() => Math.max(1, Math.min(3, Number(props.perView) || 2)))
const track = ref<HTMLElement | null>(null)
const at = ref(0), atEnd = ref(false)
const scrolls = computed(() => layout.value === 'carousel' || layout.value === 'slider')
// how the shop set the photo and its small ones (site builder, section Produit; `arrows` carries every setting of the section): where the small photos are and how they are centred, how a
// photo fills its frame (what is kept when it is cropped, or the whole photo), how tall the photo is on a phone and on a computer
const look = computed(() => props.arrows || {})
const thumbsAt = computed(() => (['left', 'right', 'inside', 'inside_right', 'none'].includes(String(props.thumbs)) ? String(props.thumbs) : 'below'))
// on a phone the small photos are under the photo, or none (« Comme sur ordinateur » follows the computer's choice)
const thumbsPhone = computed(() => (look.value.GalleryThumbsMobile === 'below' || look.value.GalleryThumbsMobile === 'none' ? String(look.value.GalleryThumbsMobile) : (thumbsAt.value === 'none' ? 'none' : 'below')))
// how the photo fills its frame on a phone: its own choice, else the computer's (« Photo entière »: the photo keeps its own shape, the phone height is then a most)
const phoneFit = computed(() => (['cover', 'contain'].includes(String(look.value.GalleryCropMobile)) ? String(look.value.GalleryCropMobile) : (look.value.GalleryCrop === 'contain' ? 'contain' : 'cover')))
const thumbsAlign = computed(() => (['center', 'end'].includes(String(look.value.GalleryThumbsAlign)) ? String(look.value.GalleryThumbsAlign) : 'start'))
// « Cadre à la forme de la photo »: the frame is as wide as a photo of the theme's format at that height, and stands left, centre or right in its column; the thumbnails stay beside it
const hugging = computed(() => props.layout === 'slider' && props.fit === 'screen' && look.value.GalleryFrame === 'photo')
const hug = computed(() => {
  if (!hugging.value) { return {} }
  const at = ['center', 'right'].includes(String(look.value.GalleryAlign)) ? String(look.value.GalleryAlign) : 'left'
  // beside thumbnails on the left the row is reversed: its start is the right side
  const reversed = thumbsAt.value === 'left'
  return { '--gjust': at === 'center' ? 'center' : (at === 'left') !== reversed ? 'flex-start' : 'flex-end', '--gml': at === 'left' ? '0' : 'auto', '--gmr': at === 'right' ? '0' : 'auto' }
})
const thumbLook = computed(() => {
  const size = Math.max(0, Math.min(160, Number(look.value.GalleryThumbSize) || 0)), gap = Number(look.value.GalleryThumbGap)
  // under the photo the untouched defaults (44, 16) keep what the site drew before these settings: 64 and 8
  const beside = ['left', 'right', 'inside', 'inside_right'].includes(thumbsAt.value)
  return { ...(size >= 24 && (beside || size !== 44) ? { '--gts': size + 'px' } : {}), ...(Number.isFinite(gap) && look.value.GalleryThumbGap !== undefined && look.value.GalleryThumbGap !== '' && (beside || gap !== 16) ? { '--gtg': Math.max(0, Math.min(120, gap)) + 'px' } : {}) }
})
const frame = computed(() => {
  const mobile = Math.max(0, Math.min(100, Number(look.value.GalleryHeightMobile) || 0)), part = Math.max(50, Math.min(100, Number(look.value.GalleryScreenPart) || 100))
  return { '--per': per.value, '--gy': ({ center: '50%', bottom: '100%' } as Record<string, string>)[String(look.value.GalleryFocus)] || '0%', '--gfit': look.value.GalleryCrop === 'contain' ? 'contain' : 'cover', '--gpart': String(part / 100), ...hug.value, ...thumbLook.value, ...(look.value.GalleryBg === 'none' ? { '--gbg': 'transparent' } : look.value.GalleryBg === 'custom' && /^#[0-9a-f]{3,8}$/i.test(String(look.value.GalleryBgColor || '')) ? { '--gbg': String(look.value.GalleryBgColor) } : {}), ...(mobile > 0 ? { '--ghm': mobile + 'svh' } : {}) }
})
const down = (box: HTMLElement) => box.scrollHeight > box.clientHeight + 4 && box.scrollWidth <= box.clientWidth + 4   // the photos are stacked in the frame (scroll = down, on a computer)
function watch() { const box = track.value; if (!box) { return } if (down(box)) { at.value = Math.round(box.scrollTop / Math.max(1, box.clientHeight)); atEnd.value = box.scrollTop + box.clientHeight >= box.scrollHeight - 4; return } const step = box.firstElementChild ? (box.firstElementChild as HTMLElement).offsetWidth : box.clientWidth; at.value = Math.round(box.scrollLeft / Math.max(1, step)); atEnd.value = box.scrollLeft + box.clientWidth >= box.scrollWidth - 4 }
function go(to: number) { const box = track.value; const item = box?.children[Math.max(0, Math.min(slides.value.length - 1, to))] as HTMLElement | undefined; if (box && item) { box.scrollTo(down(box) ? { top: item.offsetTop - box.offsetTop, behavior: 'smooth' } : { left: item.offsetLeft - box.offsetLeft, behavior: 'smooth' }) } }
// a video file plays only while it is seen (no data spent on a film under the fold)
let seen: IntersectionObserver | null = null
onMounted(() => {
  watch()
  const films = track.value?.querySelectorAll('video') || []
  if (!films.length || typeof IntersectionObserver === 'undefined') { return }
  seen = new IntersectionObserver(entries => entries.forEach((e) => { const film = e.target as HTMLVideoElement; if (e.isIntersecting) { film.play().catch(() => {}) } else { film.pause() } }), { threshold: 0.3 })
  films.forEach(f => seen!.observe(f))
})
onBeforeUnmount(() => seen?.disconnect())
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
  <div class="sf-gallery-wrap" :class="['is-' + layout, 'is-ta-' + thumbsAlign, 'is-mfit-' + phoneFit, { 'has-hover-arrows': arrows?.ArrowHover, 'is-thumbs-left': layout === 'slider' && thumbsAt === 'left', 'is-thumbs-right': layout === 'slider' && thumbsAt === 'right', 'is-thumbs-inside': layout === 'slider' && (thumbsAt === 'inside' || thumbsAt === 'inside_right'), 'is-thumbs-end': thumbsAt === 'inside_right', 'is-fit-screen': layout === 'slider' && fit === 'screen', 'is-hug': hugging, 'is-scroll-down': layout === 'slider' && scroll === 'down', 'has-mh': Number(look.GalleryHeightMobile) > 0 }]" :style="frame">
    <div ref="track" class="sf-gallery" :class="'is-' + layout" @scroll.passive="watch">
      <template v-if="slides.length"><template v-for="(item, n) in slides" :key="item.kind + item.src">
        <video v-if="item.kind === 'file'" class="sf-gallery-film" muted loop playsinline :autoplay="n === 0" :preload="n === 0 ? 'auto' : 'metadata'" :aria-label="w('Vidéo du produit')"><source :src="item.src" :type="video?.MimeType || 'video/mp4'"></video>
        <span v-else-if="item.kind === 'vimeo'" class="sf-gallery-film is-vimeo"><iframe :src="item.src" :title="w('Vidéo du produit')" :loading="n === 0 ? 'eager' : 'lazy'" allow="autoplay; fullscreen; picture-in-picture" /></span>
        <img v-else :src="item.src" :srcset="sets?.[item.i] || undefined" :sizes="sizes" :alt="item.i === 0 ? name : ''" :loading="n === 0 ? 'eager' : 'lazy'" :fetchpriority="n === 0 ? 'high' : undefined" decoding="async" role="button" tabindex="0" :aria-label="w('Agrandir la photo {a}', { a: item.i + 1 })" @click="emit('zoom', item.i)" @keydown.enter="emit('zoom', item.i)">
      </template></template>
      <span v-else class="sf-card-empty" aria-hidden="true" />
    </div>
    <template v-if="layout === 'carousel' && slides.length > per">
      <button v-if="at > 0" type="button" class="sf-gallery-nav is-prev" :style="arrow(false)" :aria-label="w('Photo précédente')" @click="go(at - 1)">‹</button>
      <button v-if="!atEnd" type="button" class="sf-gallery-nav is-next" :style="arrow(true)" :aria-label="w('Photo suivante')" @click="go(at + 1)">›</button>
    </template>
    <div v-if="layout === 'slider' && slides.length > 1 && (thumbsAt !== 'none' || thumbsPhone !== 'none')" class="sf-gallery-thumbs" :class="{ 'is-no-desk': thumbsAt === 'none', 'is-no-phone': thumbsPhone === 'none' }">
      <button v-for="(item, index) in slides" :key="item.kind + item.src" type="button" :class="{ 'is-on': index === at, 'is-film': item.kind !== 'img' }" :aria-label="item.kind === 'img' ? w('Photo {a} sur {b}', { a: item.i + 1, b: images.length }) : w('Vidéo du produit')" :aria-current="index === at ? 'true' : undefined" @click="go(index)"><img v-if="item.kind === 'img' || images.length" :src="item.kind === 'img' ? item.src : images[0]" alt="" loading="lazy"><span v-if="item.kind !== 'img'" class="sf-gallery-play" aria-hidden="true">▶</span></button>
    </div>
    <!-- what the page puts over the photos (the « Essayez-le » button of the virtual try-on) -->
    <slot />
  </div>
</template>
