<script setup lang="ts">
// The page after a payment. Digipart makes the order when the payment provider confirms the payment, a few seconds after the customer comes back: the page asks a few times, then says the
// confirmation comes by e-mail. It never shows an older order as the new one (it knows the newest order the customer had before paying).
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const { load } = useCart()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const order = ref<any>(null)
const waiting = ref(true)
onMounted(async () => {
  let before = -1
  try { const kept = sessionStorage.getItem('sf-order-before'); if (kept !== null) { before = Number(kept) || 0 } } catch { /* no order number then */ }
  for (let attempt = 0; before >= 0 && attempt < 8 && !order.value; attempt++) {
    try { order.value = (await $fetch<any>('/api/storefront/order', { query: { lang: lang.value, after: before } })).Order } catch { break }
    if (!order.value) { await new Promise(resolve => setTimeout(resolve, 2500)) }
  }
  if (order.value) { try { sessionStorage.removeItem('sf-order-before') } catch { /* nothing to clean */ } }
  waiting.value = false
  load()   // the paid cart is replaced by an empty one
})
</script>

<template>
  <div class="sf-thanks">
    <h1>{{ w('Merci pour votre commande') }}</h1>
    <p v-if="waiting" aria-live="polite">{{ w('Nous enregistrons votre paiement…') }}</p>
    <template v-else-if="order">
      <p>{{ w('Votre commande est enregistrée. Un e-mail de confirmation vous est envoyé.') }}</p>
      <div class="sf-thanks-box">
        <div><strong>{{ w('Commande n° {a}', { a: order.Id }) }}</strong><strong>{{ money(order.Total, order.Currency, lang) }}</strong></div>
        <div v-if="order.Date"><span>{{ w('Date') }}</span><span>{{ order.Date }}</span></div>
        <div v-if="order.State"><span>{{ w('État') }}</span><span>{{ order.State }}</span></div>
      </div>
    </template>
    <p v-else aria-live="polite">{{ w('Votre paiement est en cours de validation. Vous recevrez un e-mail de confirmation dès qu\'il sera accepté.') }}</p>
    <a :href="site?.Route?.Prefix || '/'" class="sf-btn">{{ w('Continuer mes achats') }}</a>
  </div>
</template>
