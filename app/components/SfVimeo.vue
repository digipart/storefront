<script setup lang="ts">
// A Vimeo film behind a banner, a cover or a card: its player is heavy, so it starts once the page is shown (until then the picture or the colour behind shows), then fades in.
defineProps<{ src: string }>()
const on = ref(false), shown = ref(false)
const loaded = () => { setTimeout(() => { shown.value = true }, 700) }   // the player draws a black frame before the film plays
onMounted(() => {
  const start = () => { const idle = (window as any).requestIdleCallback; if (idle) { idle(() => { on.value = true }, { timeout: 2000 }) } else { setTimeout(() => { on.value = true }, 200) } }
  if (document.readyState === 'complete') { start() } else { window.addEventListener('load', start, { once: true }) }
})
</script>

<template>
  <span class="sf-hero-video" :class="{ 'is-shown': shown }"><iframe v-if="on" :src="src" title="" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" tabindex="-1" aria-hidden="true" @load="loaded" /></span>
</template>
