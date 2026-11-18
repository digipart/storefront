<script setup lang="ts">
// The page shown for an address that is nothing of the site (the section « Page introuvable » of the site builder): a title, a text, a button back (the home page unless the shop chose another address) and the
// search. The answer of the server stays a 404 for the search engines.
const props = defineProps<{ settings?: any, texts?: any }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const prefix = computed(() => site.value?.Route?.Prefix || '')
const french = computed(() => (site.value?.Route?.LanguageIsoCode || 'fr') === 'fr')
const search = computed(() => prefix.value + (french.value ? '/recherche' : '/search'))
const back = computed(() => { const own = String(props.settings?.ButtonUrl || ''); return own ? (/^https?:\/\//i.test(own) ? own : prefix.value + own) : (prefix.value || '/') })
const tag = computed(() => (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div'].includes(String(props.settings?.TitleTag)) ? String(props.settings.TitleTag) : 'h1'))
const titleStyle = computed(() => ({ '--size': ({ xl: 42, lg: 34, md: 26, sm: 19 } as Record<string, number>)[props.settings?.TitleSize || 'lg'] + 'px', fontWeight: props.settings?.TitleWeight || 600, textTransform: props.settings?.TitleCase === 'uppercase' ? 'uppercase' : undefined, marginBottom: (props.settings?.TitleGap ?? 16) + 'px' }))
const term = ref('')
</script>

<template>
  <div class="sf-notfound">
    <component :is="tag" class="sf-h" :style="titleStyle">{{ texts?.Title || w('Page introuvable') }}</component>
    <p class="sf-notfound-text">{{ texts?.Text || w('La page que vous cherchez n\'existe pas ou a été déplacée.') }}</p>
    <a :href="back" class="sf-btn">{{ texts?.ButtonText || w('Retour à l\'accueil') }}</a>
    <form v-if="settings?.ShowSearch !== false" class="sf-searchform sf-notfound-search" role="search" :action="search" method="get">
      <input v-model="term" type="search" name="q" maxlength="80" :placeholder="w('Que cherchez-vous ?')" :aria-label="w('Que cherchez-vous ?')" autocomplete="off" required>
      <button type="submit" class="sf-btn">{{ w('Chercher') }}</button>
    </form>
  </div>
</template>
