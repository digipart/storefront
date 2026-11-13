<script setup lang="ts">
// The stories of a place of the site: round pictures in a row; a tap plays the story full screen (slides that pass on their own, tap or arrows to move, pause), with the product a slide
// sells and its button.
const props = defineProps<{ place: 'home' | 'catalog' | 'product', product?: number, size?: number, gap?: number }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const { add, busy } = useCart()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const { data } = await useFetch<any>('/api/storefront/stories', { query: { place: props.place, product: props.product || '', lang, prefix: computed(() => site.value?.Route?.Prefix || ''), preview: computed(() => (typeof useRoute().query.preview === 'string' ? useRoute().query.preview : '')) }, key: 'sf-stories-' + props.place + '-' + (props.product || 0) })
const stories = computed(() => data.value?.Stories || [])
const playing = ref(-1), index = ref(0), paused = ref(false), progress = ref(0)
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
function close() { playing.value = -1; cancelAnimationFrame(frame); window.removeEventListener('message', onMessage); document.documentElement.style.overflow = '' }
function toggle() { paused.value = !paused.value; root.value?.querySelector('iframe')?.contentWindow?.postMessage(JSON.stringify({ method: paused.value ? 'pause' : 'play' }), 'https://player.vimeo.com') }
function key(event: KeyboardEvent) { if (event.key === 'Escape') { close() } if (event.key === 'ArrowRight') { show(index.value + 1) } if (event.key === 'ArrowLeft') { show(index.value - 1) } }
async function buy() { paused.value = true; if (await add(slide.value.Product.Id, 0, 1)) { close() } }
onBeforeUnmount(close)
</script>

<template>
  <div v-if="stories.length" class="sf-stories" :style="{ '--size': (size || 76) + 'px', '--gap': (gap || 20) + 'px' }">
    <button v-for="(item, i) in stories" :key="item.Id" type="button" class="sf-story" :aria-label="w('Voir la story {a}', { a: item.Title })" @click="open(i)">
      <span class="sf-story-ring"><img v-if="item.Cover" :src="item.Cover" alt="" loading="lazy"></span><span class="sf-story-name">{{ item.Title }}</span>
    </button>
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
        <div v-if="slide.Product" class="sf-splayer-product">
          <img v-if="slide.Product.Image" :src="slide.Product.Image" alt="">
          <div><a :href="slide.Product.Url" class="sf-splayer-pname">{{ slide.Product.Name }}</a><span><SfPrice :product="slide.Product" :compare="false" /></span>
            <a v-if="slide.Product.Sized || !slide.Product.Available || slide.Product.PriceState !== 'ok'" :href="slide.Product.Url" class="sf-btn">{{ slide.Button || w('Voir le produit') }}</a>
            <button v-else type="button" class="sf-btn" :disabled="busy" @click="buy">{{ slide.Button || w('Ajouter au panier') }}</button>
          </div>
        </div>
        <a v-else-if="slide.Link && slide.Button" :href="slide.Link" class="sf-btn sf-splayer-cta">{{ slide.Button }}</a>
      </div>
      <button type="button" class="sf-splayer-nav" :aria-label="w('Slide suivante')" @click="show(index + 1)">›</button>
    </div>
  </div>
</template>
