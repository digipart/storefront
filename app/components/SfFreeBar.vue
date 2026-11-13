<script setup lang="ts">
// « Plus que X € pour profiter de la livraison offerte »: how far the cart is from the amount where the delivery to its country becomes free (the delivery grids of Digipart). Nothing is shown when
// no delivery to that country is ever free.
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const { cart } = useCart()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const amount = computed(() => cart.value.Products - cart.value.Discount)
const from = computed(() => (typeof cart.value.FreeFrom === 'number' && cart.value.FreeFrom > 0 ? cart.value.FreeFrom : 0))
const missing = computed(() => Math.max(0, Math.round((from.value - amount.value) * 100) / 100))
</script>

<template>
  <div v-if="from && cart.Lines.length" class="sf-freebar" aria-live="polite">
    <span>{{ missing ? w('Plus que {a} pour profiter de la livraison offerte', { a: money(missing, cart.Currency, lang) }) : w('Vous bénéficiez de la livraison gratuite !') }}</span>
    <div class="sf-freebar-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.min(100, Math.round((amount * 100) / from))"><i :style="{ width: Math.min(100, (amount * 100) / from) + '%' }" /></div>
  </div>
</template>
