<script setup lang="ts">
// The stories of a place of the site: round pictures in a row, or (`look` « cards ») vertical videos side by side that play silently with their product on them — shoppable videos. A tap plays
// the story full screen (slides that pass on their own, tap or arrows to move, pause, sound), with the product a slide sells: a tap on it opens its sheet over the video (photos, sizes, « Ajouter au
// panier ») and the video waits; the visitor buys without leaving it.
const props = defineProps<{ place: 'home' | 'catalog' | 'product', product?: number, size?: number, gap?: number, look?: string, cardWidth?: number, previews?: boolean, cardProduct?: boolean }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const { add, busy } = useCart()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const { data } = await useFetch<any>('/api/storefront/stories', { query: { place: props.place, product: props.product || '', lang, prefix: computed(() => site.value?.Route?.Prefix || ''), preview: computed(() => (typeof useRoute().query.preview === 'string' ? useRoute().query.preview : '')) }, key: 'sf-stories-' + props.place + '-' + (props.product || 0) })
const stories = computed(() => data.value?.Stories || [])
const playing = ref(-1), index = ref(0), paused = ref(false), progress = ref(0), muted = ref(true)
const story = computed(() => stories.value[playing.value] || null)
const slide = computed(() => story.value?.Slides[index.value] || null)
const root = ref<HTMLElement | null>(null)
let frame = 0, last = 0, elapsed = 0

function show(to: number) {
  if (!story.value) { return }
  if (to < 0) { if (playing.value > 0) { playing.value--; index.value = 0 } else { to = 0 } }
  if (to >= story.value.Slides.length) { if (playing.value < stories.value.length - 1) { playing.value++; index.value = 0 } else { close(); return } } else if (to >= 0) { index.value = to }
  elapsed = 0; last = 0; progress.value = 0
}
function tick(now: number) {
  if (playing.value < 0) { return }
  if (slide.value && !slide.value.Vimeo && !paused.value) {
    if (last) { elapsed += now - last }
    progress.value = Math.min(1, elapsed / (slide.value.Duration * 1000))
    if (progress.value >= 1) { show(index.value + 1) }
  }
  last = paused.value ? 0 : now
  frame = requestAnimationFrame(tick)
}
// a video tells where it is and when it ends (the Vimeo player speaks with postMessage)
function onMessage(event: MessageEvent) {
  if (event.origin !== 'https://player.vimeo.com' || !slide.value?.Vimeo) { return }
  let message: any = event.data
  try { message = typeof message === 'string' ? JSON.parse(message) : message } catch { return }
  const player = root.value?.querySelector('iframe')
  if (!message || !player || event.source !== player.contentWindow) { return }
  if (message.event === 'ready') { for (const name of ['playProgress', 'finish']) { player.contentWindow?.postMessage(JSON.stringify({ method: 'addEventListener', value: name }), 'https://player.vimeo.com') } }
  if (message.event === 'playProgress') { progress.value = Number(message.data?.percent) || 0 }
  if (message.event === 'finish') { show(index.value + 1) }
}
function open(which: number) {
  playing.value = which; index.value = 0; paused.value = false; elapsed = 0; last = 0; progress.value = 0
  document.documentElement.style.overflow = 'hidden'
  window.addEventListener('message', onMessage)
  frame = requestAnimationFrame(tick)
  nextTick(() => root.value?.focus())
}
function close() { sheet.value = false; muted.value = true; playing.value = -1; cancelAnimationFrame(frame); window.removeEventListener('message', onMessage); document.documentElement.style.overflow = '' }
function toggle() { paused.value = !paused.value; root.value?.querySelector('iframe')?.contentWindow?.postMessage(JSON.stringify({ method: paused.value ? 'pause' : 'play' }), 'https://player.vimeo.com') }
function key(event: KeyboardEvent) { if (event.key === 'Escape') { if (sheet.value) { closeSheet(); return } close() } if (event.key === 'ArrowRight') { show(index.value + 1) } if (event.key === 'ArrowLeft') { show(index.value - 1) } }
// the sheet of the product of the slide: opened over the video, which waits
const sheet = ref(false), pickedSize = ref(0), sheetError = ref(''), added = ref(false)
const sizes = computed(() => (slide.value?.Product?.Variants || []).filter((v: any) => v.Label))
const oneColor = computed(() => new Set(sizes.value.map((v: any) => v.Color || '')).size <= 1)
const sizeName = (v: any) => (oneColor.value && v.Size ? v.Size : v.Label)
function video(method: string, value?: unknown) { root.value?.querySelector('iframe')?.contentWindow?.postMessage(JSON.stringify(value === undefined ? { method } : { method, value }), 'https://player.vimeo.com') }
function openSheet() { sheet.value = true; pickedSize.value = sizes.value.length === 1 ? sizes.value[0].Id : 0; sheetError.value = ''; added.value = false; paused.value = true; video('pause') }
function closeSheet() { sheet.value = false; paused.value = false; video('play') }
function sound() { muted.value = !muted.value; video('setVolume', muted.value ? 0 : 1) }
async function buy() {
  const product = slide.value?.Product
  if (!product) { return }
  if (sizes.value.length && !pickedSize.value) { sheetError.value = w('Choisissez une taille.'); return }
  sheetError.value = ''
  if (await add(product.Id, pickedSize.value || 0, 1)) { added.value = true } else { sheetError.value = w('Le produit n\'a pas pu être ajouté, merci de réessayer.') }
}
watch(slide, () => { sheet.value = false })
onBeforeUnmount(close)
</script>

<template>
  <div v-if="stories.length" class="sf-stories" :class="{ 'is-cards': look === 'cards' }" :style="{ '--size': (size || 76) + 'px', '--gap': (gap || 20) + 'px', '--cw': (cardWidth || 240) + 'px' }">
    <template v-if="look === 'cards'">
      <!-- shoppable videos: each story as a vertical card, its first slide playing silently (or its picture), its product on it -->
      <button v-for="(item, i) in stories" :key="item.Id" type="button" class="sf-vcard" :aria-label="w('Voir la story {a}', { a: item.Title })" @click="open(i)">
        <span class="sf-vcard-media" :style="item.Slides[0]?.Image || item.Cover ? { backgroundImage: 'url(\'' + String(item.Slides[0]?.Image || item.Cover).replace(/'/g, '%27') + '\')' } : undefined">
          <iframe v-if="previews !== false && item.Slides[0]?.Vimeo" :src="'https://player.vimeo.com/video/' + item.Slides[0].Vimeo + '?background=1&autoplay=1&loop=1&muted=1&dnt=1'" title="" loading="lazy" allow="autoplay" tabindex="-1" aria-hidden="true" />
        </span>
        <span v-if="item.Title" class="sf-vcard-title">{{ item.Title }}</span>
        <span v-if="cardProduct !== false && item.Slides[0]?.Product" class="sf-vcard-product">
          <img v-if="item.Slides[0].Product.Image" :src="item.Slides[0].Product.Image" alt="" loading="lazy">
          <span><b>{{ item.Slides[0].Product.Name }}</b><SfPrice :product="item.Slides[0].Product" :compare="false" /></span>
        </span>
      </button>
    </template>
    <template v-else>
      <button v-for="(item, i) in stories" :key="item.Id" type="button" class="sf-story" :aria-label="w('Voir la story {a}', { a: item.Title })" @click="open(i)">
        <span class="sf-story-ring"><img v-if="item.Cover" :src="item.Cover" alt="" loading="lazy"></span><span class="sf-story-name">{{ item.Title }}</span>
      </button>
    </template>
    <div v-if="story && slide" ref="root" class="sf-splayer" role="dialog" aria-modal="true" :aria-label="story.Title" tabindex="-1" @keydown="key" @click.self="close">
      <button v-if="index > 0 || playing > 0" type="button" class="sf-splayer-nav" :aria-label="w('Slide précédente')" @click="show(index - 1)">‹</button><span v-else class="sf-splayer-nav is-off" />
      <div class="sf-splayer-screen">
        <div class="sf-splayer-media" :style="slide.Image ? { backgroundImage: 'url(\'' + slide.Image.replace(/'/g, '%27') + '\')' } : undefined">
          <iframe v-if="slide.Vimeo" :key="slide.Id" :src="'https://player.vimeo.com/video/' + slide.Vimeo + '?autoplay=1&muted=1&controls=0&playsinline=1&title=0&byline=0&portrait=0&api=1'" allow="autoplay; fullscreen" :title="slide.Title || story.Title" />
        </div>
        <button type="button" class="sf-splayer-tap is-prev" tabindex="-1" aria-hidden="true" @click="show(index - 1)" /><button type="button" class="sf-splayer-tap is-next" tabindex="-1" aria-hidden="true" @click="show(index + 1)" />
        <div class="sf-splayer-bars"><span v-for="(s, i) in story.Slides" :key="s.Id"><i :style="{ width: (i < index ? 100 : i > index ? 0 : progress * 100) + '%' }" /></span></div>
        <button type="button" class="sf-splayer-round is-close" :aria-label="w('Fermer')" @click="close">✕</button>
        <button type="button" class="sf-splayer-round is-pause" :aria-label="w(paused ? 'Lecture' : 'Pause')" @click="toggle">{{ paused ? '▶' : '❙❙' }}</button>
        <div v-if="slide.Title || slide.Text" class="sf-splayer-copy"><strong>{{ slide.Title }}</strong><span>{{ slide.Text }}</span></div>
        <button v-if="slide.Vimeo" type="button" class="sf-splayer-round is-sound" :aria-label="w(muted ? 'Activer le son' : 'Couper le son')" @click="sound">{{ muted ? '🔇' : '🔊' }}</button>
        <!-- the product of the slide: a tap opens its sheet over the video -->
        <button v-if="slide.Product && !sheet" type="button" class="sf-splayer-product" @click="openSheet">
          <img v-if="slide.Product.Image" :src="slide.Product.Image" alt="">
          <span class="sf-splayer-pinfo"><b class="sf-splayer-pname">{{ slide.Product.Name }}</b><small v-if="slide.Product.Brand">{{ slide.Product.Brand }}</small><SfPrice :product="slide.Product" /></span>
          <span class="sf-splayer-pgo" aria-hidden="true">›</span>
        </button>
        <div v-if="slide.Product && sheet" class="sf-splayer-sheet" role="dialog" :aria-label="slide.Product.Name">
          <button type="button" class="sf-splayer-grab" :aria-label="w('Fermer')" @click="closeSheet"><i /></button>
          <div class="sf-splayer-photos"><img v-for="(src, k) in slide.Product.Images" :key="src" :src="src" :srcset="slide.Product.ImageSets?.[k] || undefined" sizes="360px" alt="" :loading="k ? 'lazy' : 'eager'"></div>
          <div class="sf-splayer-sbody">
            <div class="sf-splayer-shead"><div><b>{{ slide.Product.Name }}</b><small v-if="slide.Product.Brand">{{ slide.Product.Brand }}</small></div><SfPrice :product="slide.Product" /></div>
            <template v-if="slide.Product.PriceState === 'ok' && !slide.Product.TaxExcl">
              <div v-if="sizes.length" class="sf-splayer-sizes" role="group" :aria-label="w('Taille')">
                <button v-for="v in sizes" :key="v.Id" type="button" :class="{ 'is-on': pickedSize === v.Id }" :disabled="!v.Available" :aria-pressed="pickedSize === v.Id" @click="pickedSize = v.Id; sheetError = ''">{{ sizeName(v) }}</button>
              </div>
              <p v-if="sheetError" class="sf-form-error" role="alert">{{ sheetError }}</p>
              <p v-if="added" class="sf-form-done" role="status">{{ w('Ajouté au panier') }}</p>
              <button v-if="slide.Product.Available" type="button" class="sf-btn" :disabled="busy" @click="buy">{{ w(busy ? 'Ajout…' : (slide.Button || 'Ajouter au panier')) }}</button>
              <p v-else class="sf-muted">{{ w('Épuisé') }}</p>
            </template>
            <a :href="slide.Product.Url" class="sf-btn is-outline">{{ w('Voir la fiche produit') }}</a>
          </div>
        </div>
        <a v-else-if="slide.Link && slide.Button" :href="slide.Link" class="sf-btn sf-splayer-cta">{{ slide.Button }}</a>
      </div>
      <button type="button" class="sf-splayer-nav" :aria-label="w('Slide suivante')" @click="show(index + 1)">›</button>
    </div>
  </div>
</template>
