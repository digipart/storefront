<script setup lang="ts">
// The favourites of the visitor (kept without an account, and joined to the account at login).
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const { favorites, toggleFavorite, query, loaded, load } = useAccount()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const products = ref<any[]>([])
const waiting = ref(true)
onMounted(async () => {
  if (!loaded.value) { await load() }
  try { products.value = (await $fetch<any>('/api/storefront/account', { query: { ...query(), part: 'favorites' } })).Products } catch { products.value = [] }
  waiting.value = false
})
const shown = computed(() => products.value.filter(product => favorites.value.includes(product.Id)))
</script>

<template>
  <div class="sf-acc-page">
    <h1>{{ w('Mes favoris') }}</h1>
    <p v-if="waiting" class="sf-muted">{{ w('Chargement…') }}</p>
    <div v-else-if="!shown.length" class="sf-cart-none"><p>{{ w('Vous n\'avez pas encore de favori.') }}</p><a :href="site?.Route?.Prefix || '/'" class="sf-btn">{{ w('Continuer mes achats') }}</a></div>
    <div v-else class="sf-grid" :style="{ '--cols': 4, '--cols-m': 2, '--gx': '16px', '--gy': '32px' }">
      <article v-for="product in shown" :key="product.Id" class="sf-card sf-fav-card">
        <a :href="product.Url" class="sf-card-pic"><img v-if="product.Image" :src="product.Image" :alt="product.Name" loading="lazy"><span v-else class="sf-card-empty" aria-hidden="true" /></a>
        <button type="button" class="sf-heart is-on" :aria-label="w('Retirer de mes favoris')" @click="toggleFavorite(product.Id)"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.3 4.6 13a4.7 4.7 0 0 1 0-6.7 4.8 4.8 0 0 1 6.8 0l.6.6.6-.6a4.8 4.8 0 0 1 6.8 0 4.7 4.7 0 0 1 0 6.7z"/></svg></button>
        <a :href="product.Url" class="sf-card-name">{{ product.Name }}</a>
        <span class="sf-card-price"><SfPrice :product="product" /></span>
      </article>
    </div>
  </div>
</template>
