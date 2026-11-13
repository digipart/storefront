<script setup lang="ts">
// The lookbook a page puts forward: its cover picture, its title and the way to it.
const props = defineProps<{ id?: number, button?: string, height?: number }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const { data } = await useFetch<any>('/api/storefront/lookbook', { query: { id: props.id || '', lang: computed(() => site.value?.Route?.LanguageIsoCode || ''), prefix: computed(() => site.value?.Route?.Prefix || '') }, key: 'sf-lookbook-' + (props.id || 0) })
const book = computed(() => data.value?.Lookbook || null)
</script>

<template>
  <a v-if="book" :href="book.Url" class="sf-hero sf-lookfeature" :class="{ 'is-empty': !book.Cover }" :style="{ '--h': (height || 460) + 'px', '--hm': Math.round((height || 460) * 0.8) + 'px', '--jc': 'flex-end', color: book.Cover ? '#fff' : undefined }">
    <picture v-if="book.Cover"><img :src="book.Cover" alt="" loading="lazy" decoding="async"></picture>
    <span class="sf-hero-copy"><span class="sf-h" :style="{ '--size': '30px' }">{{ book.Title }}</span><span class="sf-btn is-light">{{ button || w('Voir le lookbook') }}</span></span>
  </a>
</template>
