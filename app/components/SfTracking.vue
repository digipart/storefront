<script setup lang="ts">
// Where a parcel is: a panel with the carrier, the tracking number, a button to the carrier's own page and the steps the carrier gives, the newest first.
const props = defineProps<{ order: string }>()
const emit = defineEmits<{ close: [] }>()
const w = useWords()
const { query } = useAccount()
const data = ref<any>(null)
const waiting = ref(true)
const panel = ref<HTMLElement | null>(null)
onMounted(async () => {
  document.documentElement.style.overflow = 'hidden'
  nextTick(() => panel.value?.focus())
  try { data.value = (await $fetch<any>('/api/storefront/account', { query: { ...query(), part: 'tracking', id: props.order } })).Tracking } catch { data.value = null } finally { waiting.value = false }
})
onBeforeUnmount(() => { document.documentElement.style.overflow = '' })
</script>

<template>
  <div class="sf-drawer" @keydown.esc="emit('close')">
    <div class="sf-drawer-veil" @click="emit('close')" />
    <aside ref="panel" class="sf-drawer-panel" role="dialog" aria-modal="true" :aria-label="w('Suivre ma livraison')" tabindex="-1">
      <header class="sf-drawer-head"><h2>{{ w('Suivre ma livraison') }}</h2><button type="button" :aria-label="w('Fermer')" @click="emit('close')">✕</button></header>
      <div class="sf-drawer-body sf-track">
        <p v-if="waiting" class="sf-muted">{{ w('Chargement…') }}</p>
        <p v-else-if="!data" class="sf-muted">{{ w('Le suivi de cette commande n\'est pas disponible pour le moment.') }}</p>
        <template v-else>
          <p v-if="data.Carrier" class="sf-track-carrier"><strong>{{ data.Carrier }}</strong><span v-if="data.Number">{{ w('N° de suivi : {a}', { a: data.Number }) }}</span></p>
          <a v-if="data.Url" :href="data.Url" target="_blank" rel="noopener" class="sf-btn">{{ w('Suivre sur le site de {a}', { a: data.Carrier || w('du transporteur') }) }}</a>
          <ol v-if="data.Events.length" class="sf-track-steps">
            <li v-for="(step, index) in data.Events" :key="index" :class="{ 'is-first': index === 0 }"><strong>{{ step.Label }}</strong><span>{{ step.Date }}<template v-if="step.Place"> · {{ step.Place }}</template></span></li>
          </ol>
          <p v-else class="sf-muted">{{ w(data.Number ? 'Le transporteur n\'a pas encore donné d\'étape pour ce colis.' : 'Votre colis n\'a pas encore de numéro de suivi : il est en préparation.') }}</p>
        </template>
      </div>
    </aside>
  </div>
</template>
