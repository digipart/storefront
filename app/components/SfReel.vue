<script setup lang="ts">
// Several photos in ONE frame, gone through in the frame itself: sideways or downwards by a swipe or the wheel (each photo stops in the frame; downwards, after the last photo the browser hands
// the scroll to the page), or with two arrows. Used by « Shop the look » for the photos of the product of the look and for the photos of each piece (site builder: « Autres photos… »).
// The frame takes the size its parent gives it; the photos fill it. With `href` the photos are one link (the page of the product).
const props = defineProps<{ images: string[], sets?: string[], sizes?: string, mode?: string, href?: string, alt?: string, eager?: boolean }>()
const w = useWords()
const mode = computed(() => (['side', 'down', 'arrows'].includes(String(props.mode)) ? String(props.mode) : 'side'))
const track = ref<HTMLElement | null>(null)
const at = ref(0)
const down = computed(() => mode.value === 'down')
function watch() { const box = track.value; if (box) { at.value = down.value ? Math.round(box.scrollTop / Math.max(1, box.clientHeight)) : Math.round(box.scrollLeft / Math.max(1, box.clientWidth)) } }
function go(to: number) { const box = track.value; if (!box) { return } const n = Math.max(0, Math.min(props.images.length - 1, to)); box.scrollTo(down.value ? { top: n * box.clientHeight, behavior: 'smooth' } : { left: n * box.clientWidth, behavior: 'smooth' }) }
</script>

<template>
  <div class="sf-reel" :class="'is-' + mode">
    <component :is="href ? 'a' : 'div'" ref="track" :href="href || undefined" class="sf-reel-track" @scroll.passive="watch">
      <img v-for="(src, i) in images" :key="src" :src="src" :srcset="sets?.[i] || undefined" :sizes="sizes || undefined" :alt="i === 0 ? (alt || '') : ''" :loading="i === 0 && eager ? 'eager' : 'lazy'" decoding="async">
    </component>
    <template v-if="images.length > 1">
      <template v-if="mode === 'arrows'">
        <button v-if="at > 0" type="button" class="sf-reel-nav is-prev" :aria-label="w('Photo précédente')" @click="go(at - 1)">‹</button>
        <button v-if="at < images.length - 1" type="button" class="sf-reel-nav is-next" :aria-label="w('Photo suivante')" @click="go(at + 1)">›</button>
      </template>
      <span class="sf-reel-count" aria-hidden="true">{{ at + 1 }} / {{ images.length }}</span>
    </template>
  </div>
</template>
