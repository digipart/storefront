<script setup lang="ts">
// A product video file (S3 or the server of the shop) over the photo of a card: silent, in a loop, played only while it is seen, shown once it plays (until then the photo shows).
defineProps<{ src: string, type?: string }>()
const film = ref<HTMLVideoElement | null>(null), shown = ref(false)
let seen: IntersectionObserver | null = null
onMounted(() => {
  const el = film.value
  if (!el) { return }
  if (typeof IntersectionObserver === 'undefined') { el.play().catch(() => {}); return }
  seen = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { el.preload = 'auto'; el.play().catch(() => {}) } else { el.pause() } }, { threshold: 0.25 })
  seen.observe(el)
})
onBeforeUnmount(() => seen?.disconnect())
</script>

<template>
  <span class="sf-card-film" :class="{ 'is-shown': shown }" aria-hidden="true"><video ref="film" muted loop playsinline preload="none" tabindex="-1" @playing="shown = true"><source :src="src" :type="type || 'video/mp4'"></video></span>
</template>
