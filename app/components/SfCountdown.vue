<script setup lang="ts">
// Days, hours, minutes and seconds until a date (the reopening of a closed site): counted in the browser, so the page kept for everyone stays the same.
const props = defineProps<{ at: string, size?: number, lang?: string }>()
const now = ref(0)
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { now.value = Date.now(); timer = setInterval(() => { now.value = Date.now() }, 1000) })
onBeforeUnmount(() => clearInterval(timer))
const left = computed(() => Math.max(0, Math.floor((Date.parse(props.at) - now.value) / 1000)))
const words = computed(() => (props.lang === 'en' ? ['days', 'hours', 'minutes', 'seconds'] : props.lang === 'de' ? ['Tage', 'Stunden', 'Minuten', 'Sekunden'] : ['jours', 'heures', 'minutes', 'secondes']))
const cells = computed(() => {
  const s = left.value
  return [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].map((value, index) => ({ value: now.value ? String(value).padStart(2, '0') : '--', label: words.value[index] }))
})
</script>

<template>
  <div class="sf-countdown" role="timer" :style="{ '--cd': (size || 36) + 'px' }">
    <span v-for="cell in cells" :key="cell.label" class="sf-countdown-cell"><b>{{ cell.value }}</b><small>{{ cell.label }}</small></span>
  </div>
</template>
