<script setup lang="ts">
// The express payment at the top of the order page: the buttons of the wallets the visitor's device has (Apple Pay, Google Pay), drawn by Stripe. One gesture gives the e-mail, the address, the
// delivery method and the payment. Nothing is shown on a device without a wallet, when the shop does not take cards with Stripe, or when the shop switched the block off in the site builder.
const props = defineProps<{ state: any }>()
const emit = defineEmits<{ changed: [] }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const query = () => ({ lang: lang.value, prefix: site.value?.Route?.Prefix || '' })
const box = ref<HTMLElement | null>(null)
const shown = ref(false)
const error = ref('')
let stripe: any = null, elements: any = null, element: any = null, rates: any[] = [], country = '', available = false
const call = (body: Record<string, unknown>) => $fetch<any>('/api/storefront/express', { method: 'POST', query: query(), body })
function loadStripe(): Promise<void> {
  if ((window as any).Stripe) { return Promise.resolve() }
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src^="https://js.stripe.com/v3"]')
    const tag = existing || document.createElement('script')
    tag.addEventListener('load', () => resolve()); tag.addEventListener('error', () => reject(new Error('stripe')))
    if (!existing) { tag.src = 'https://js.stripe.com/v3/'; tag.async = true; document.head.appendChild(tag) }
  })
}
// the delivery methods of a country, and the amount of the cart with the chosen one: the wallet shows exactly what Digipart will charge
// `passive`: the page changed by itself (not the visitor in the wallet): nothing the visitor chose on the page is replaced, and the page is not told to read itself again
async function refresh(iso: string, carrier = 0, passive = false): Promise<boolean> {
  const answer = await call({ Action: 'rates', CountryIsoCode: iso, IdCarrier: carrier, Passive: passive })
  if (answer.Error || !answer.Rates?.length || answer.Amount <= 0) { if (!passive) { error.value = answer.Error || '' } else { shown.value = false } return false }
  rates = answer.Rates; country = iso
  elements?.update({ amount: answer.Amount })
  if (passive) { shown.value = available } else { emit('changed') }
  return true
}
async function mount() {
  const pay = props.state?.Pay?.Stripe
  if (!pay || !box.value || element) { return }
  try {
    const first = await call({ Action: 'rates', CountryIsoCode: props.state.CountryIsoCode, Passive: true })
    if (first.Error || !first.Rates?.length || first.Amount <= 0) { return }
    rates = first.Rates; country = props.state.CountryIsoCode
    await loadStripe()
    stripe = (window as any).Stripe(pay.PublicKey, { locale: lang.value })
    elements = stripe.elements({ mode: 'payment', amount: first.Amount, currency: first.Currency, paymentMethodTypes: ['card'] })
    element = elements.create('expressCheckout', { buttonHeight: 48, paymentMethods: { applePay: 'auto', googlePay: 'auto', link: 'never', paypal: 'never', amazonPay: 'never', klarna: 'never' } })
    element.on('ready', (event: any) => { available = !!event?.availablePaymentMethods && Object.values(event.availablePaymentMethods).some(Boolean); shown.value = available })
    element.on('click', (event: any) => {
      error.value = ''
      event.resolve({ emailRequired: true, phoneNumberRequired: true, shippingAddressRequired: true, allowedShippingCountries: (props.state.Countries || []).map((c: any) => c.IsoCode), shippingRates: rates })
    })
    element.on('shippingaddresschange', async (event: any) => {
      const iso = String(event?.address?.country || '').toUpperCase()
      try { if (await refresh(iso)) { event.resolve({ shippingRates: rates }) } else { event.reject() } } catch { event.reject() }
    })
    element.on('shippingratechange', async (event: any) => {
      try { if (await refresh(country, Number(event?.shippingRate?.id) || 0)) { event.resolve({ shippingRates: rates }) } else { event.reject() } } catch { event.reject() }
    })
    element.on('confirm', async (event: any) => {
      const refuse = (message: string) => { error.value = message; event.paymentFailed({ reason: 'fail' }) }
      try {
        const details = event.billingDetails || {}, delivery = event.shippingAddress || {}
        const answer = await call({ Action: 'confirm', Email: details.email || '', Phone: details.phone || '', Name: delivery.name || details.name || '', Address: delivery.address || {}, IdCarrier: Number(event.shippingRate?.id) || 0 })
        if (answer.Error || !answer.ClientSecret) { emit('changed'); return refuse(answer.Error || 'Le paiement n\'a pas pu être préparé, merci de réessayer.') }
        try { sessionStorage.setItem('sf-order-before', String(props.state?.LastOrder || '')) } catch { /* the confirmation page then shows no order number */ }
        const done = await stripe.confirmPayment({ elements, clientSecret: answer.ClientSecret, confirmParams: { return_url: location.origin + (site.value?.Route?.Prefix || '') + '/commande/merci' } })
        if (done?.error) { error.value = done.error.message || 'Votre paiement a été refusé.'; emit('changed') }
      } catch { refuse('Le paiement ne répond pas, merci de réessayer.') }
    })
    element.mount(box.value)
  } catch { shown.value = false }
}
// the cart changed on the page (a promo code, another delivery method): the wallet is told the new amount
watch(() => [props.state?.Cart?.ToPay, props.state?.Cart?.IdCarrier, props.state?.CountryIsoCode], () => { if (element) { refresh(props.state.CountryIsoCode, 0, true).catch(() => {}) } else { mount() } })
onMounted(mount)
onBeforeUnmount(() => { try { element?.destroy() } catch { /* already gone */ } element = null; elements = null })
</script>

<template>
  <div v-show="shown" class="sf-express">
    <p class="sf-express-title">{{ w('Paiement express') }}</p>
    <div ref="box" />
    <p v-if="error" class="sf-cart-error" role="alert">{{ w(error) }}</p>
    <p class="sf-express-or"><span>{{ w('ou') }}</span></p>
  </div>
</template>
