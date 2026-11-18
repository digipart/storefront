<script setup lang="ts">
// A content page of the shop shown in a side panel, without leaving the page (the size guide of a product).
const props = defineProps<{ id: number, title?: string }>()
const emit = defineEmits<{ close: [] }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const page = ref<any>(null)
const failed = ref(false)
const panel = ref<HTMLElement | null>(null)
onMounted(async () => {
  document.documentElement.style.overflow = 'hidden'
  nextTick(() => panel.value?.focus())
  try { page.value = await $fetch<any>('/api/storefront/page', { query: { id: props.id, lang: site.value?.Route?.LanguageIsoCode || '' } }) } catch { failed.value = true }
})
onBeforeUnmount(() => { document.documentElement.style.overflow = '' })
</script>

<template>
  <!-- drawn at the level of the page (not inside the column that opened it): always above the sticky header -->
  <Teleport to="body">
    <div class="sf-drawer" @keydown.esc="emit('close')">
      <div class="sf-drawer-veil" @click="emit('close')" />
      <aside ref="panel" class="sf-drawer-panel sf-pagepanel" role="dialog" aria-modal="true" :aria-label="page?.Title || title || ''" tabindex="-1">
        <header class="sf-drawer-head"><h2>{{ page?.Title || title }}</h2><button type="button" :aria-label="w('Fermer')" @click="emit('close')">✕</button></header>
        <div class="sf-drawer-body">
          <p v-if="failed" class="sf-muted">{{ w('Cette page n\'est pas encore publiée.') }}</p>
          <p v-else-if="!page" class="sf-muted">{{ w('Chargement…') }}</p>
          <!-- eslint-disable-next-line vue/no-v-html : the HTML of a page is cleaned by Digipart (an allow-list of tags) when it is saved and again when the API gives it -->
          <div v-else class="sf-rte" v-html="page.Content" />
        </div>
      </aside>
    </div>
  </Teleport>
</template>
