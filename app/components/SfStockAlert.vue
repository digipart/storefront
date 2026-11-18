<script setup lang="ts">
// « M'avertir du retour en stock »: the visitor leaves an e-mail for a sold-out size of a product, and Digipart writes to them when it is back (server/api/storefront/stock-alert.post.ts →
// api/campaign/backInStock, the API the other fronts of Digipart use). Opened from a product card (a sold-out size) or from the product page (everything sold out).
const props = defineProps<{ product: any, variant?: number }>()
const emit = defineEmits<{ close: [] }>()
const w = useWords()
const { customer, query } = useAccount()   // query: the language and the address prefix of the page
// only the sizes that are sold out can be asked for
const soldOut = computed(() => (props.product?.Variants || []).filter((v: any) => v.Label && !v.Available))
const form = reactive({ IdVariant: props.variant || (soldOut.value.length === 1 ? soldOut.value[0].Id : 0), Email: '', Website: '' })
watch(customer, (now: any) => { if (now?.Email) { form.Email = form.Email || now.Email } }, { immediate: true })
// one colour only: the size alone (« 2(42/44) »), not « Blanc / 2(42/44) »
const oneColor = computed(() => new Set((props.product?.Variants || []).map((v: any) => v.Color || '')).size <= 1)
const sizeName = (v: any) => (oneColor.value && v.Size ? v.Size : v.Label)
const chosen = computed(() => soldOut.value.find((v: any) => v.Id === form.IdVariant))
const busy = ref(false), error = ref(''), done = ref(false)
const panel = ref<HTMLElement | null>(null)
onMounted(() => { document.documentElement.style.overflow = 'hidden'; nextTick(() => panel.value?.focus()) })
onBeforeUnmount(() => { document.documentElement.style.overflow = '' })
async function send() {
  if (busy.value) { return }
  if (!form.IdVariant) { error.value = w('Choisissez une taille.'); return }
  busy.value = true
  error.value = ''
  try {
    const answer = await $fetch<any>('/api/storefront/stock-alert', { method: 'POST', query: query(), body: { ...form, IdProduct: props.product.Id } })
    if (answer.Done) { done.value = true } else { error.value = w(answer.Error || 'Votre demande n\'a pas pu être enregistrée, merci de réessayer.') }
  } catch { error.value = w('Votre demande n\'a pas pu être enregistrée, merci de réessayer.') } finally { busy.value = false }
}
</script>

<template>
  <!-- drawn at the level of the page (not inside the column that opened it): always above the sticky header -->
  <Teleport to="body">
    <div class="sf-drawer" @keydown.esc="emit('close')">
      <div class="sf-drawer-veil" @click="emit('close')" />
      <aside ref="panel" class="sf-drawer-panel sf-alert" role="dialog" aria-modal="true" :aria-label="w('M\'avertir du retour en stock')" tabindex="-1">
        <header class="sf-drawer-head"><h2>{{ w('M\'avertir du retour en stock') }}</h2><button type="button" :aria-label="w('Fermer')" @click="emit('close')">✕</button></header>
        <div class="sf-drawer-body">
          <div class="sf-alert-product">
            <img v-if="product.Images?.[0]" :src="product.Images[0]" alt="" loading="lazy" decoding="async">
            <div>
              <p class="sf-alert-name">{{ product.Name }}</p>
              <p class="sf-muted">{{ [product.Reference, chosen ? sizeName(chosen) : ''].filter(Boolean).join(' · ') }}</p>
              <div class="sf-card-price"><SfPrice :product="product" /></div>
            </div>
          </div>
          <p v-if="done" class="sf-form-done" role="status">{{ w('C\'est noté : nous vous écrirons à {a} dès que cette taille sera de nouveau disponible.', { a: form.Email }) }}</p>
          <form v-else class="sf-form" @submit.prevent="send">
            <fieldset v-if="soldOut.length > 1 || !form.IdVariant" class="sf-alert-sizes">
              <legend>{{ w('Taille') }}</legend>
              <label v-for="v in soldOut" :key="v.Id" :class="{ 'is-on': form.IdVariant === v.Id }"><input v-model.number="form.IdVariant" type="radio" name="sf-alert-size" :value="v.Id">{{ sizeName(v) }}</label>
            </fieldset>
            <label>{{ w('Adresse e-mail') }}<input v-model="form.Email" type="email" autocomplete="email" maxlength="150" required></label>
            <input v-model="form.Website" type="text" name="website" class="sf-sr" tabindex="-1" autocomplete="off" aria-hidden="true">
            <p class="sf-alert-note">{{ w('Nous utilisons votre adresse uniquement pour vous prévenir du retour de ce produit en stock.') }}</p>
            <p v-if="error" class="sf-form-error" role="alert">{{ error }}</p>
            <button type="submit" class="sf-btn" :disabled="busy">{{ w(busy ? 'Envoi…' : 'Envoyer') }}</button>
          </form>
        </div>
      </aside>
    </div>
  </Teleport>
</template>
