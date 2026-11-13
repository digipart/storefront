<script setup lang="ts">
// The cart page: the articles on the left, the summary on the right; what it shows (promo code, recommended products) is set on the section « Panier » of the site builder.
const props = defineProps<{ settings: any, texts: any }>()
const site = inject<Ref<any>>('sfSite')!
const { cart, loaded, busy, error, addCode, removeCode } = useCart()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const home = computed(() => site.value?.Route?.Prefix || '/')
const orderUrl = computed(() => (site.value?.Route?.Prefix || '') + (lang.value === 'fr' ? '/commande' : '/checkout'))
const code = ref('')
const apply = async () => { if (code.value.trim() && await addCode(code.value.trim())) { code.value = '' } }
const w = useWords()
</script>

<template>
  <div class="sf-cartpage">
    <h1 class="sf-h" :style="{ '--size': '30px' }">{{ w(texts.Title || 'Votre panier') }}</h1>
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
