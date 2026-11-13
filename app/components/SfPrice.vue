<script setup lang="ts">
// The price of a product. On a professional site: without tax (« H.T. »), and for a visitor who may not see prices, the reason and the way in (log in, wait for the activation).
const props = defineProps<{ product: any, compare?: boolean, badge?: boolean }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const { show } = useCart()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const state = computed(() => props.product.PriceState || 'ok')
</script>

<template>
  <template v-if="state === 'ok'">
    <span>{{ money(product.Price, product.Currency, lang) }}<small v-if="product.TaxExcl" class="sf-ht"> {{ w('H.T.') }}</small></span>
    <template v-if="compare !== false && product.PriceOld"><del>{{ money(product.PriceOld, product.Currency, lang) }}</del><span v-if="badge" class="sf-card-badge is-inline">-{{ product.Discount }} %</span></template>
  </template>
  <button v-else-if="state === 'login' || state === 'business'" type="button" class="sf-pricelock" @click.prevent="show('account')">{{ w(state === 'login' ? 'Connectez-vous pour voir les prix' : 'Prix réservés aux professionnels') }}</button>
  <span v-else class="sf-pricelock is-wait">{{ w('Compte en cours de validation') }}</span>
</template>
