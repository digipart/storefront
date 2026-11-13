<script setup lang="ts">
// The side panel of the site, with three tabs: the favourites, the cart, the account. It slides in when the visitor adds a product, or opens one of the three from the header. Fast to the
// order: the cart tab shows the articles (size and quantity can be changed in place), the favourites under them, and the way to the order page.
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const { cart, open, tab, error, url, load } = useCart()
const account = useAccount()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const french = computed(() => lang.value === 'fr')
const orderUrl = computed(() => (site.value?.Route?.Prefix || '') + (french.value ? '/commande' : '/checkout'))
const panel = ref<HTMLElement | null>(null)
const titles = { favorites: 'Mes favoris', cart: 'Produits dans mon panier', account: 'Mon compte' }
const sections = computed(() => (french.value ? { profile: 'profil', orders: 'commandes', loyalty: 'fidelite', addresses: 'adresses' } : { profile: 'profile', orders: 'orders', loyalty: 'loyalty', addresses: 'addresses' }))
const logged = computed(() => !!account.customer.value && !account.customer.value.Guest)
const favs = computed(() => account.favoriteProducts.value.filter((p: any) => account.favorites.value.includes(p.Id)))
onMounted(() => { load(); account.load() })
watch([open, tab], ([now]) => {
  document.documentElement.style.overflow = now ? 'hidden' : ''
  if (now) { nextTick(() => panel.value?.focus()); if (account.favorites.value.length) { account.loadFavorites() } }
})
watch(() => account.favorites.value.length, (now, before) => { if (open.value && now > before) { account.loadFavorites() } })
const route = useRoute()
watch(() => route.fullPath, () => { open.value = false })
const logout = () => account.send({ Action: 'logout' }).then(load)
watch(logged, (now, before) => { if (now !== before) { load() } })   // the cart of the customer replaces the cart of the visit
</script>

<template>
  <div v-if="open" class="sf-drawer" @keydown.esc="open = false">
    <div class="sf-drawer-veil" @click="open = false" />
    <aside ref="panel" class="sf-drawer-panel" role="dialog" aria-modal="true" :aria-label="w(titles[tab])" tabindex="-1">
      <header class="sf-drawer-head"><h2>{{ w(titles[tab]) }}</h2><button type="button" :aria-label="w('Fermer le panneau')" @click="open = false">✕</button></header>
      <div class="sf-panel-tabs" role="tablist">
        <button type="button" role="tab" :aria-selected="tab === 'favorites'" @click="tab = 'favorites'">{{ w('Favoris') }}<template v-if="account.favorites.value.length"> ({{ account.favorites.value.length }})</template></button>
        <button type="button" role="tab" :aria-selected="tab === 'cart'" @click="tab = 'cart'">{{ w('Panier') }}<template v-if="cart.Count"> ({{ cart.Count }})</template></button>
        <button type="button" role="tab" :aria-selected="tab === 'account'" @click="tab = 'account'">{{ w('Compte') }}</button>
      </div>

      <!-- the cart, then the favourites under it -->
      <template v-if="tab === 'cart'">
        <p v-if="error" class="sf-cart-error" role="alert">{{ w(error) }}</p>
        <SfFreeBar />
        <div class="sf-drawer-body">
          <SfCartLines v-if="cart.Lines.length" compact />
          <SfCartMore v-if="cart.Lines.length" />
          <div v-else class="sf-cart-none"><p>{{ w('Votre panier est vide.') }}</p></div>
          <template v-if="favs.length">
            <h3 class="sf-panel-sub">{{ w('Mes favoris') }}</h3>
            <ul class="sf-panel-favs">
              <li v-for="product in favs.slice(0, 4)" :key="product.Id">
                <a :href="product.Url" class="sf-line-pic" tabindex="-1" aria-hidden="true"><img v-if="product.Image" :src="product.Image" alt="" loading="lazy"></a>
                <span class="sf-line-main"><a :href="product.Url" class="sf-line-name">{{ product.Name }}</a><span class="sf-line-variant"><SfPrice :product="product" /></span></span>
                <button type="button" class="sf-heart is-on" :aria-label="w('Retirer de mes favoris')" @click="account.toggleFavorite(product.Id)">♥</button>
              </li>
            </ul>
          </template>
        </div>
        <footer class="sf-drawer-foot">
          <template v-if="cart.Lines.length">
            <div v-if="cart.Discount" class="sf-total-row"><span>{{ w('Réduction') }}</span><span>−{{ money(cart.Discount, cart.Currency, lang) }}</span></div>
            <div class="sf-total-row is-main"><span>{{ w(cart.TaxExcl ? 'Total H.T.' : 'Total') }}</span><span>{{ money(cart.TaxExcl ? cart.ProductsTaxExcl : cart.Products - cart.Discount, cart.Currency, lang) }}</span></div>
            <a :href="orderUrl" class="sf-btn">{{ w('Finaliser ma commande') }}</a>
          </template>
          <button type="button" class="sf-btn is-outline" @click="open = false">{{ w('Continuer mon shopping') }}</button>
          <p v-if="cart.Lines.length" class="sf-total-note"><a :href="url" class="sf-link">{{ w('Voir mon panier') }}</a> · {{ w('Livraison calculée à l\'étape suivante.') }}</p>
        </footer>
      </template>

      <template v-else-if="tab === 'favorites'">
        <div class="sf-drawer-body">
          <div v-if="!account.favorites.value.length" class="sf-cart-none"><p>{{ w('Vous n\'avez pas encore de favori.') }}</p></div>
          <ul v-else class="sf-panel-favs">
            <li v-for="product in favs" :key="product.Id">
              <a :href="product.Url" class="sf-line-pic" tabindex="-1" aria-hidden="true"><img v-if="product.Image" :src="product.Image" alt="" loading="lazy"></a>
              <span class="sf-line-main"><a :href="product.Url" class="sf-line-name">{{ product.Name }}</a><span class="sf-line-variant">{{ product.Reference }}</span><span><SfPrice :product="product" /></span></span>
              <button type="button" class="sf-heart is-on" :aria-label="w('Retirer de mes favoris')" @click="account.toggleFavorite(product.Id)">♥</button>
            </li>
          </ul>
        </div>
        <footer v-if="account.favorites.value.length" class="sf-drawer-foot"><a :href="account.favoritesUrl.value" class="sf-btn">{{ w('Voir tous mes favoris') }}</a></footer>
      </template>

      <template v-else>
        <div class="sf-drawer-body">
          <div v-if="!logged" class="sf-panel-account"><SfLogin /></div>
          <nav v-else class="sf-panel-account" :aria-label="w('Mon compte')">
            <p class="sf-acc-hello">{{ w('Bonjour') }} <strong>{{ account.customer.value.Firstname }}</strong></p>
            <a :href="account.url.value">{{ w('Mon compte') }}</a>
            <a :href="account.url.value + '/' + sections.profile">{{ w('Mon profil') }}</a>
            <a :href="account.url.value + '/' + sections.orders">{{ w('Mes commandes') }}</a>
            <a :href="account.url.value + '/' + sections.addresses">{{ w('Mes adresses') }}</a>
            <a :href="account.url.value + '/' + sections.loyalty">{{ w('Fidélité') }}</a>
            <button type="button" class="sf-link" :disabled="account.busy.value" @click="logout">{{ w('Se déconnecter') }}</button>
          </nav>
        </div>
      </template>
    </aside>
  </div>
</template>
