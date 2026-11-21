<script setup lang="ts">
// The cart page: the articles on the left, the summary on the right; what it shows (promo code, recommended products) is set on the section « Panier » of the site builder.
const props = defineProps<{ settings: any, texts: any }>()
const site = inject<Ref<any>>('sfSite')!
const { cart, loaded, busy, error, addCode, removeCode } = useCart()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const home = computed(() => site.value?.Route?.Prefix || '/')
const orderUrl = computed(() => (site.value?.Route?.Prefix || '') + (lang.value === 'fr' ? '/commande' : '/checkout'))
// the HTML tag the shop chose for the title (h1 as before when it chose nothing)
const titleTag = computed(() => (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div'].includes(String(props.settings?.TitleTag)) ? String(props.settings.TitleTag) : 'h1'))
const code = ref('')
const apply = async () => { if (code.value.trim() && await addCode(code.value.trim())) { code.value = '' } }
const w = useWords()
// « Grille de photos » (the section « Panier », `CartLayout` = grid): the articles as large tiles, two tabs (the cart, the favourites), and the total in a bar that stays at the bottom
const grid = computed(() => props.settings?.CartLayout === 'grid')
const { setQuantity, setVariant, remove } = useCart()
const account = useAccount()
const tab = ref<'cart' | 'favorites'>('cart')
const favs = computed(() => account.favoriteProducts.value.filter((p: any) => account.favorites.value.includes(p.Id)))
onMounted(() => { if (grid.value) { account.load().then(() => { if (account.favorites.value.length) { account.loadFavorites() } }) } })
</script>

<template>
  <div v-if="grid" class="sf-cartpage is-grid">
    <div class="sf-carttabs" role="tablist">
      <button type="button" role="tab" :aria-selected="tab === 'cart'" @click="tab = 'cart'">{{ w('Panier') }} ({{ cart.Count }})</button>
      <button type="button" role="tab" :aria-selected="tab === 'favorites'" @click="tab = 'favorites'">{{ w('Favoris') }} ({{ account.favorites.value.length }})</button>
    </div>
    <p v-if="error" class="sf-cart-error" role="alert">{{ w(error) }}</p>
    <template v-if="tab === 'cart'">
      <p v-if="!loaded" class="sf-cart-wait">{{ w('Chargement de votre panier…') }}</p>
      <div v-else-if="!cart.Lines.length" class="sf-cart-none"><p>{{ w('Votre panier est vide.') }}</p><a :href="home" class="sf-btn">{{ w('Continuer mes achats') }}</a></div>
      <template v-else>
        <SfFreeBar v-if="settings.FreeShippingBar !== false" />
        <ul class="sf-carttiles">
          <li v-for="line in cart.Lines" :key="line.IdProduct + '-' + line.IdProductAttribute" class="sf-carttile">
            <a :href="line.Url" class="sf-carttile-pic" tabindex="-1" aria-hidden="true"><img v-if="line.Image" :src="line.Image" alt="" loading="lazy"></a>
            <button type="button" class="sf-carttile-remove" :disabled="busy" :aria-label="w('Retirer l\'article')" @click="remove(line)">✕</button>
            <div class="sf-carttile-text">
              <a :href="line.Url" class="sf-line-name">{{ line.Name }}</a>
              <span class="sf-carttile-price">{{ money(line.Total, cart.Currency, lang) }}</span>
            </div>
            <div class="sf-carttile-row">
              <label v-if="line.Variants.length > 1" class="sf-line-size"><span class="sf-sr">{{ w('Taille') }}</span>
                <select :value="line.IdProductAttribute" :disabled="busy" @change="setVariant(line, Number(($event.target as HTMLSelectElement).value))"><option v-for="option in line.Variants" :key="option.Id" :value="option.Id" :disabled="!option.Available">{{ option.Label }}</option></select>
              </label>
              <span v-else-if="line.Variant" class="sf-line-variant">{{ line.Variant }}</span>
              <div class="sf-qty" role="group" :aria-label="w('Quantité de {a}', { a: line.Name })">
                <button type="button" :disabled="busy" :aria-label="w(line.Quantity > 1 ? 'Retirer un exemplaire' : 'Retirer l\'article')" @click="setQuantity(line, line.Quantity - 1)">−</button>
                <span aria-live="polite">{{ line.Quantity }}</span>
                <button type="button" :disabled="busy || line.Quantity >= line.Max" :aria-label="w('Ajouter un exemplaire')" @click="setQuantity(line, line.Quantity + 1)">+</button>
              </div>
            </div>
          </li>
        </ul>
        <form v-if="settings.ShowPromoCode !== false" class="sf-code sf-cartcode" @submit.prevent="apply">
          <input v-model="code" type="text" name="code" maxlength="60" :placeholder="w('Code promo')" :aria-label="w('Code promo')" autocomplete="off">
          <button type="submit" class="sf-btn is-outline" :disabled="busy || !code.trim()">{{ w('Appliquer') }}</button>
        </form>
        <p v-for="applied in cart.Codes" :key="applied.Id" class="sf-cartcode-on">{{ applied.Code }} : {{ applied.FreeDelivery && !applied.Amount ? w('Livraison offerte') : '−' + money(applied.Amount, cart.Currency, lang) }} <button type="button" class="sf-link" :disabled="busy" :aria-label="w('Retirer le code {a}', { a: applied.Code })" @click="removeCode(applied.Id)">✕</button></p>
        <div class="sf-cartbar">
          <div class="sf-cartbar-total">
            <span>{{ w(cart.TaxExcl ? 'Total T.T.C.' : 'Total TTC') }} <small>{{ cart.Shipping ? '' : w('Livraison calculée à l\'étape suivante.') }}</small></span>
            <strong>{{ money(cart.ToPay, cart.Currency, lang) }}</strong>
          </div>
          <a :href="orderUrl" class="sf-btn">{{ w('Commander') }}</a>
        </div>
      </template>
    </template>
    <template v-else>
      <div v-if="!favs.length" class="sf-cart-none"><p>{{ w('Vous n\'avez pas encore de favori.') }}</p><a :href="home" class="sf-btn">{{ w('Continuer mes achats') }}</a></div>
      <ul v-else class="sf-carttiles">
        <li v-for="product in favs" :key="product.Id" class="sf-carttile">
          <a :href="product.Url" class="sf-carttile-pic" tabindex="-1" aria-hidden="true"><img v-if="product.Image" :src="product.Image" alt="" loading="lazy"></a>
          <button type="button" class="sf-carttile-remove" :aria-label="w('Retirer de mes favoris')" @click="account.toggleFavorite(product.Id)">✕</button>
          <div class="sf-carttile-text"><a :href="product.Url" class="sf-line-name">{{ product.Name }}</a><span class="sf-carttile-price"><SfPrice :product="product" /></span></div>
          <div class="sf-carttile-row"><a :href="product.Url" class="sf-btn is-outline">{{ w('Choisir') }}</a></div>
        </li>
      </ul>
    </template>
  </div>
  <div v-else class="sf-cartpage">
    <component :is="titleTag" class="sf-h" :style="{ '--size': '30px' }">{{ w(texts.Title || 'Votre panier') }}</component>
    <p v-if="error" class="sf-cart-error" role="alert">{{ w(error) }}</p>
    <p v-if="!loaded" class="sf-cart-wait">{{ w('Chargement de votre panier…') }}</p>
    <div v-else-if="!cart.Lines.length" class="sf-cart-none"><p>{{ w('Votre panier est vide.') }}</p><a :href="home" class="sf-btn">{{ w('Continuer mes achats') }}</a></div>
    <SfFreeBar v-if="loaded && cart.Lines.length && settings.FreeShippingBar !== false" />
    <div v-if="loaded && cart.Lines.length" class="sf-cart-grid">
      <SfCartLines />
      <aside class="sf-summary" :aria-label="w('Récapitulatif')">
        <h2>{{ w('Récapitulatif') }}</h2>
        <div class="sf-total-row"><span>{{ w('Articles ({a})', { a: cart.Count }) }}</span><span>{{ money(cart.TaxExcl ? cart.ProductsTaxExcl : cart.Products, cart.Currency, lang) }}</span></div>
        <div v-for="applied in cart.Codes" :key="applied.Id" class="sf-total-row is-code">
          <span>{{ applied.Code }} <button type="button" :disabled="busy" :aria-label="w('Retirer le code {a}', { a: applied.Code })" @click="removeCode(applied.Id)">✕</button></span>
          <span>{{ applied.FreeDelivery && !applied.Amount ? w('Livraison offerte') : '−' + money(applied.Amount, cart.Currency, lang) }}</span>
        </div>
        <div v-if="cart.Discount && !cart.Codes.length" class="sf-total-row"><span>{{ w('Réduction') }}</span><span>−{{ money(cart.Discount, cart.Currency, lang) }}</span></div>
        <div class="sf-total-row"><span>{{ w('Livraison') }}</span><span>{{ cart.Shipping ? money(cart.Shipping, cart.Currency, lang) : w('Calculée à l\'étape suivante') }}</span></div>
        <template v-if="cart.TaxExcl">
          <div class="sf-total-row"><span>{{ w('Total H.T.') }}</span><span>{{ money(cart.ToPayTaxExcl, cart.Currency, lang) }}</span></div>
          <div class="sf-total-row"><span>{{ w('TVA') }}</span><span>{{ money(cart.ToPay - cart.ToPayTaxExcl, cart.Currency, lang) }}</span></div>
        </template>
        <div class="sf-total-row is-main"><span>{{ w(cart.TaxExcl ? 'Total T.T.C.' : 'Total TTC') }}</span><span>{{ money(cart.ToPay, cart.Currency, lang) }}</span></div>
        <form v-if="settings.ShowPromoCode !== false" class="sf-code" @submit.prevent="apply">
          <input v-model="code" type="text" name="code" maxlength="60" :placeholder="w('Code promo')" :aria-label="w('Code promo')" autocomplete="off">
          <button type="submit" class="sf-btn is-outline" :disabled="busy || !code.trim()">{{ w('Appliquer') }}</button>
        </form>
        <a :href="orderUrl" class="sf-btn sf-summary-go">{{ w('Commander') }}</a>
        <a :href="home" class="sf-link">{{ w('Continuer mes achats') }}</a>
      </aside>
    </div>
  </div>
</template>
