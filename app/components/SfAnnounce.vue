<script setup lang="ts">
// The announcement bar: its announcements one after the other (fade, slide sideways, or up), each staying the time the shop chose, paused under the pointer and for visitors who asked for less
// motion; arrows when the shop wants them; a cross when the visitor may close it (remembered for the visit).
const props = defineProps<{ blocks: any[], settings: any }>()
const w = useWords()
const s = computed(() => props.settings || {})
const list = computed(() => (props.blocks || []).filter((b: any) => b.Texts?.Text))
const at = ref(0)
const effect = computed(() => (['fade', 'slide', 'up'].includes(String(s.value.Effect)) ? String(s.value.Effect) : 'fade'))
const speed = computed(() => Math.max(200, Math.min(1500, Number(s.value.Speed) || 600)))
const closed = ref(false)
const hover = ref(false)
let timer: ReturnType<typeof setInterval> | null = null
const go = (step: number) => { const n = list.value.length; if (n) { at.value = (at.value + step + n) % n } }
onMounted(() => {
  try { closed.value = sessionStorage.getItem('sf-announce-closed') === '1' && !!s.value.Closable } catch { /* no storage */ }
  if (list.value.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return }
  timer = setInterval(() => { if (!(hover.value && s.value.PauseHover !== false) && !document.hidden) { go(1) } }, Math.max(2, Number(s.value.Interval) || 4) * 1000)
})
onBeforeUnmount(() => { if (timer) { clearInterval(timer) } })
function close() { closed.value = true; try { sessionStorage.setItem('sf-announce-closed', '1') } catch { /* no storage */ } }
</script>

<template>
  <div v-if="list.length && !closed" class="sf-announce" :class="'is-' + effect" :style="{ textAlign: s.Align || 'center', fontSize: (s.TextSize || 12) + 'px', textTransform: s.TextCase === 'uppercase' ? 'uppercase' : undefined, '--speed': speed + 'ms' }" @mouseenter="hover = true" @mouseleave="hover = false">
    <button v-if="s.Arrows && list.length > 1" type="button" class="sf-announce-arrow is-prev" :aria-label="w('Annonce précédente')" @click="go(-1)">‹</button>
    <div class="sf-announce-track" aria-live="polite">
      <component :is="b.Settings?.Url ? 'a' : 'span'" v-for="(b, i) in list" :key="b.Id" :href="b.Settings?.Url || undefined" class="sf-announce-item" :class="{ 'is-on': i === at, 'is-before': i < at }" :aria-hidden="i !== at ? 'true' : undefined" :tabindex="i !== at && b.Settings?.Url ? -1 : undefined">{{ b.Texts.Text }}</component>
    </div>
    <button v-if="s.Arrows && list.length > 1" type="button" class="sf-announce-arrow is-next" :aria-label="w('Annonce suivante')" @click="go(1)">›</button>
    <button v-if="s.Closable" type="button" class="sf-announce-close" :aria-label="w('Fermer')" @click="close">✕</button>
  </div>
</template>
