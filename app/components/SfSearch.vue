<script setup lang="ts">
// The results of a search: the products of the shop whose name or reference holds the words typed.
const props = defineProps<{ search: any }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const home = computed(() => site.value?.Route?.Prefix || '')
const action = computed(() => home.value + ((site.value?.Route?.LanguageIsoCode || 'fr') === 'fr' ? '/recherche' : '/search'))
const term = ref(props.search.Term)
</script>

<template>
  <div class="sf-acc-page">
    <h1>{{ w('Recherche') }}</h1>
    <form class="sf-searchform" role="search" :action="action" method="get">
      <input v-model="term" type="search" name="q" maxlength="80" :placeholder="w('Que cherchez-vous ?')" :aria-label="w('Que cherchez-vous ?')" autocomplete="off" required>
      <button type="submit" class="sf-btn">{{ w('Chercher') }}</button>
    </form>
    <template v-if="search.Term">
      <p class="sf-muted" aria-live="polite">{{ w(search.Total > 1 ? '{a} résultats pour « {b} »' : '{a} résultat pour « {b} »', { a: search.Total, b: search.Term }) }}</p>
      <div v-if="search.Products.length" class="sf-grid" :style="{ '--cols': 4, '--cols-m': 2, '--gx': '16px', '--gy': '32px' }">
        <SfProductCard v-for="(item, index) in search.Products" :key="item.Id" :product="item" images="hover" :eager="index < 4" />
      </div>
      <nav v-if="search.Pages > 1" class="sf-pages" :aria-label="w('Pages')">
        <a v-if="search.Page > 1" :href="action + '?q=' + encodeURIComponent(search.Term) + '&page=' + (search.Page - 1)" rel="prev">{{ w('Page précédente') }}</a>
        <span>{{ w('Page {a} sur {b}', { a: search.Page, b: search.Pages }) }}</span>
        <a v-if="search.Page < search.Pages" :href="action + '?q=' + encodeURIComponent(search.Term) + '&page=' + (search.Page + 1)" rel="next">{{ w('Page suivante') }}</a>
      </nav>
    </template>
  </div>
</template>
