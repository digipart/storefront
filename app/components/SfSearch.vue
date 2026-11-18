<script setup lang="ts">
// The results of a search: the products of the shop whose name or reference holds the words typed. Drawn by the section « Résultats de recherche » of the site builder (`settings` and `texts`: its title, its
// message when nothing matches, its columns...), or alone with the usual look when that page was never published.
const props = defineProps<{ search: any, settings?: any, texts?: any }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const home = computed(() => site.value?.Route?.Prefix || '')
const action = computed(() => home.value + ((site.value?.Route?.LanguageIsoCode || 'fr') === 'fr' ? '/recherche' : '/search'))
const term = ref(props.search.Term)
const own = computed(() => !!props.settings)
const tag = computed(() => (own.value && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div'].includes(String(props.settings.TitleTag)) ? String(props.settings.TitleTag) : 'h1'))
const titleStyle = computed(() => (own.value ? { '--size': ({ xl: 42, lg: 34, md: 26, sm: 19 } as Record<string, number>)[props.settings.TitleSize || 'md'] + 'px', fontWeight: props.settings.TitleWeight || 600, textTransform: props.settings.TitleCase === 'uppercase' ? 'uppercase' : undefined, textAlign: props.settings.TitleAlign || undefined, marginBottom: (props.settings.TitleGap ?? 20) + 'px' } : undefined))
// the address of the results with what the visitor chose (filters, main category, sort, page)
const query = (ask: Record<string, string | number>) => Object.entries(ask).filter(([k, v]) => v !== '' && v !== 0 && !(k === 'page' && v === 1)).map(([k, v]) => k + '=' + encodeURIComponent(String(v))).join('&')
const current = computed(() => ({ q: props.search.Term, attr: (props.search.Filters?.Attributes || []).join(','), min: props.search.Filters?.Min || 0, max: props.search.Filters?.Max || 0, tab: props.search.Tab || 0, sort: props.search.Sort || '', promo: props.search.Filters?.Promo ? 'yes' : '' }))
const pageUrl = (page: number) => action.value + '?' + query({ ...current.value, page })
const go = (ask: Record<string, string | number>) => navigateTo(action.value + '?' + query(ask))
</script>

<template>
  <div :class="own ? 'sf-search-own' : 'sf-acc-page'">
    <component :is="tag" v-if="!own || texts?.Title !== ''" :class="own ? 'sf-h' : undefined" :style="titleStyle">{{ own && texts?.Title ? texts.Title : w('Recherche') }}</component>
    <form v-if="!own || settings.ShowSearchBox !== false" class="sf-searchform is-wide" role="search" :action="action" method="get">
      <input v-model="term" type="search" name="q" maxlength="80" :placeholder="w('Que cherchez-vous ?')" :aria-label="w('Que cherchez-vous ?')" autocomplete="off" required>
      <button type="submit" class="sf-btn">{{ w('Chercher') }}</button>
    </form>
    <!-- the results with their suggestions, main categories, filters and sort (as in the search panel); a choice reads the page again by its address -->
    <SfSearchResults v-if="search.Term" :result="search" :settings="own ? settings : undefined" :texts="own ? texts : undefined" @change="go">
      <template #after>
        <nav v-if="search.Pages > 1" class="sf-pages" :aria-label="w('Pages')">
          <a v-if="search.Page > 1" :href="pageUrl(search.Page - 1)" rel="prev">{{ w('Page précédente') }}</a>
          <span>{{ w('Page {a} sur {b}', { a: search.Page, b: search.Pages }) }}</span>
          <a v-if="search.Page < search.Pages" :href="pageUrl(search.Page + 1)" rel="next">{{ w('Page suivante') }}</a>
        </nav>
      </template>
    </SfSearchResults>
  </div>
</template>
