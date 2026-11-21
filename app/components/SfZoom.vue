<script setup lang="ts">
// The photos of a product full screen: each photo fills the whole window (it is cut to its width, never shown small on an empty ground) and, on a computer, moves up and down with the pointer so
// that all of it can be seen; swipe from one to the next, pinch (or double tap, or the wheel) to zoom into one, drag to move inside it; the small pictures, laid over the photo, jump to a photo.
const props = defineProps<{ images: string[], start: number, name: string }>()
const emit = defineEmits<{ close: [] }>()
const w = useWords()
const index = ref(props.start)
const track = ref<HTMLElement | null>(null)
const root = ref<HTMLElement | null>(null)
const view = reactive({ scale: 1, x: 0, y: 0 })
const zoomed = computed(() => view.scale > 1.01)
const pointers = new Map<number, { x: number, y: number }>()
let pinch = 0, lastTap = 0, moved = false

const reset = () => { view.scale = 1; view.x = 0; view.y = 0 }
function clamp() {
  const box = track.value
  if (!box) { return }
  const maxX = (box.clientWidth * (view.scale - 1)) / 2, maxY = (box.clientHeight * (view.scale - 1)) / 2
  view.x = Math.max(-maxX, Math.min(maxX, view.x)); view.y = Math.max(-maxY, Math.min(maxY, view.y))
}
function zoomTo(scale: number) { view.scale = Math.max(1, Math.min(4, scale)); if (!zoomed.value) { reset() } else { clamp() } }
function go(to: number, smooth = true) {
  index.value = Math.max(0, Math.min(props.images.length - 1, to)); reset()
  const box = track.value
  if (box) { box.scrollTo({ left: index.value * box.clientWidth, behavior: smooth ? 'smooth' : 'auto' }) }
}
function onScroll() { const box = track.value; if (box && !zoomed.value) { const now = Math.round(box.scrollLeft / box.clientWidth); if (now !== index.value) { index.value = now } } }
function down(event: PointerEvent) {
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); moved = false
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y) / view.scale }
}
function move(event: PointerEvent) {
  const before = pointers.get(event.pointerId)
  if (!before) { return }
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (pointers.size === 2 && pinch > 0) { const [a, b] = [...pointers.values()]; zoomTo(Math.hypot(a.x - b.x, a.y - b.y) / pinch); moved = true; return }
  if (zoomed.value && pointers.size === 1) { view.x += event.clientX - before.x; view.y += event.clientY - before.y; clamp(); moved = true }
}
function up(event: PointerEvent) {
  pointers.delete(event.pointerId)
  if (pointers.size < 2) { pinch = 0 }
  if (pointers.size === 0 && !moved && event.pointerType !== 'mouse') {   // a double tap zooms in, then out
    const now = Date.now()
    if (now - lastTap < 300) { zoomTo(zoomed.value ? 1 : 2.5); lastTap = 0 } else { lastTap = now }
  }
}
// the pointer of a mouse shows the part of the photo it points at: at the top of the window the top of the photo, at the bottom its bottom
const follow = (event: MouseEvent) => { if (!zoomed.value && pointers.size === 0 && root.value) { root.value.style.setProperty('--zy', Math.round(Math.max(0, Math.min(1, event.clientY / Math.max(1, window.innerHeight))) * 100) + '%') } }
const wheel = (event: WheelEvent) => { if (event.ctrlKey || zoomed.value) { event.preventDefault(); zoomTo(view.scale - event.deltaY / 200) } }
function key(event: KeyboardEvent) {
  if (event.key === 'Escape') { emit('close') }
  if (event.key === 'ArrowRight') { go(index.value + 1) }
  if (event.key === 'ArrowLeft') { go(index.value - 1) }
}
onMounted(() => { document.documentElement.style.overflow = 'hidden'; nextTick(() => { go(props.start, false); root.value?.focus() }) })
onBeforeUnmount(() => { document.documentElement.style.overflow = '' })
</script>

<template>
  <!-- drawn at the level of the page (not inside the column that opened it): always above the sticky header -->
  <Teleport to="body">
    <div ref="root" class="sf-zoom" role="dialog" aria-modal="true" :aria-label="name" tabindex="-1" @keydown="key">
      <button type="button" class="sf-zoom-close" :aria-label="w('Fermer')" @click="emit('close')"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg></button>
      <div v-if="images.length > 1" class="sf-zoom-thumbs">
        <button v-for="(src, i) in images" :key="src" type="button" :class="{ 'is-on': i === index }" :aria-label="w('Photo {a} sur {b}', { a: i + 1, b: images.length })" :aria-current="i === index ? 'true' : undefined" @click="go(i)"><img :src="src" alt="" loading="lazy"></button>
      </div>
      <div ref="track" class="sf-zoom-track" :class="{ 'is-zoomed': zoomed }" @scroll.passive="onScroll" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @wheel="wheel" @mousemove="follow">
        <div v-for="(src, i) in images" :key="src" class="sf-zoom-slide">
          <img :src="src" :alt="i === 0 ? name : ''" draggable="false" :style="i === index ? { transform: 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.scale + ')' } : undefined" @dblclick="zoomTo(zoomed ? 1 : 2.5)">
        </div>
      </div>
      <template v-if="images.length > 1 && !zoomed">
        <button v-if="index > 0" type="button" class="sf-zoom-nav is-prev" :aria-label="w('Photo précédente')" @click="go(index - 1)">‹</button>
        <button v-if="index < images.length - 1" type="button" class="sf-zoom-nav is-next" :aria-label="w('Photo suivante')" @click="go(index + 1)">›</button>
      </template>
    </div>
  </Teleport>
</template>
