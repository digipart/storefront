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
const grid = computed(() => ({ '--cols': own.value ? Number(props.settings.Columns) || 4 : 4, '--cols-m': own.value ? Number(props.settings.ColumnsMobile) || 2 : 2, '--gx': (own.value ? props.settings.GapX ?? 16 : 16) + 'px', '--gy': (own.value ? props.settings.GapY ?? 32 : 32) + 'px' }))
</script>

<template>
  <div :class="own ? 'sf-search-own' : 'sf-acc-page'">
    <component :is="tag" v-if="!own || texts?.Title !== ''" :class="own ? 'sf-h' : undefined" :style="titleStyle">{{ own && texts?.Title ? texts.Title : w('Recherche') }}</component>
    <form v-if="!own || settings.ShowSearchBox !== false" class="sf-searchform" role="search" :action="action" method="get">
      <input v-model="term" type="search" name="q" maxlength="80" :placeholder="w('Que cherchez-vous ?')" :aria-label="w('Que cherchez-vous ?')" autocomplete="off" required>
      <button type="submit" class="sf-btn">{{ w('Chercher') }}</button>
    </form>
    <template v-if="search.Term">
      <p class="sf-muted" aria-live="polite">{{ w(search.Total > 1 ? '{a} résultats pour « {b} »' : '{a} résultat pour « {b} »', { a: search.Total, b: search.Term }) }}</p>
      <div v-if="search.Products.length" class="sf-grid" :style="grid">
        <SfProductCard v-for="(item, index) in search.Products" :key="item.Id" :product="item" :images="own ? settings.CardImages : undefined" :dots="own ? settings.CardDots !== false : undefined" :quick="!own || settings.QuickAdd !== false" :eager="index < 4" />
      </div>
      <p v-else class="sf-muted">{{ (own && texts?.EmptyText) || w('Aucun produit ne correspond à votre recherche.') }}</p>
      <nav v-if="search.Pages > 1" class="sf-pages" :aria-label="w('Pages')">
        <a v-if="search.Page > 1" :href="action + '?q=' + encodeURIComponent(search.Term) + '&page=' + (search.Page - 1)" rel="prev">{{ w('Page précédente') }}</a>
        <span>{{ w('Page {a} sur {b}', { a: search.Page, b: search.Pages }) }}</span>
        <a v-if="search.Page < search.Pages" :href="action + '?q=' + encodeURIComponent(search.Term) + '&page=' + (search.Page + 1)" rel="next">{{ w('Page suivante') }}</a>
      </nav>
    </template>
  </div>
</template>
