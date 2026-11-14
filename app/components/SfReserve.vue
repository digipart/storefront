<script setup lang="ts">
// « Réserver en boutique »: the visitor picks a shop (and a size), leaves a name, an e-mail and a phone, and the shop is asked to put the product aside. The request reaches Digipart as a
// reservation « À confirmer » (Boutiques > Réservations): the shop confirms or refuses by phone or e-mail. No payment here, and the price is the shop's, not this page's.
const props = defineProps<{ product: any, stores: { Id: number, Name: string, City: string, InStock: boolean | null }[], variant?: number }>()
const emit = defineEmits<{ close: [] }>()
const w = useWords()
const { customer } = useAccount()
const sizes = computed(() => (props.product?.Variants || []).filter((v: any) => v.Label))
const form = reactive({ IdStore: props.stores.length === 1 ? props.stores[0]!.Id : 0, IdProductAttribute: props.variant || 0, Quantity: 1, Firstname: '', Lastname: '', Email: '', MobilePhone: '', Website: '' })
watch(customer, (now: any) => { if (now && !now.Guest) { form.Firstname = form.Firstname || now.Firstname || ''; form.Lastname = form.Lastname || now.Lastname || ''; form.Email = form.Email || now.Email || '' } }, { immediate: true })
const busy = ref(false), error = ref(''), done = ref(false)
const panel = ref<HTMLElement | null>(null)
onMounted(() => { document.documentElement.style.overflow = 'hidden'; nextTick(() => panel.value?.focus()) })
onBeforeUnmount(() => { document.documentElement.style.overflow = '' })
async function send() {
  if (busy.value) { return }
  if (!form.IdStore) { error.value = w('Choisissez une boutique.'); return }
  if (sizes.value.length > 0 && !form.IdProductAttribute) { error.value = w('Choisissez une taille.'); return }
  busy.value = true
  error.value = ''
  try {
    const answer = await $fetch<any>('/api/storefront/reserve', { method: 'POST', body: { ...form, IdProduct: props.product.Id } })
    if (answer.Done) { done.value = true } else { error.value = answer.Error || w('La réservation n\'a pas pu être enregistrée, merci de réessayer.') }
  } catch { error.value = w('La réservation n\'a pas pu être enregistrée, merci de réessayer.') } finally { busy.value = false }
}
</script>

<template>
  <div class="sf-drawer" @keydown.esc="emit('close')">
    <div class="sf-drawer-veil" @click="emit('close')" />
    <aside ref="panel" class="sf-drawer-panel" role="dialog" aria-modal="true" :aria-label="w('Réserver en boutique')" tabindex="-1">
      <header class="sf-drawer-head"><h2>{{ w('Réserver en boutique') }}</h2><button type="button" :aria-label="w('Fermer')" @click="emit('close')">✕</button></header>
      <div class="sf-drawer-body">
        <p class="sf-muted">{{ product.Name }}</p>
        <p v-if="done" class="sf-form-done" role="status">{{ w('Merci, votre demande est envoyée. La boutique vous confirme la réservation par téléphone ou par e-mail.') }}</p>
        <form v-else class="sf-form" @submit.prevent="send">
          <label>{{ w('Boutique') }}
            <select v-model.number="form.IdStore" class="sf-select" required>
              <option :value="0" disabled>{{ w('Choisir une boutique') }}</option>
              <option v-for="s in stores" :key="s.Id" :value="s.Id" :disabled="s.InStock === false">{{ s.Name }}{{ s.City ? ' — ' + s.City : '' }}{{ s.InStock === false ? ' (' + w('épuisé') + ')' : '' }}</option>
            </select>
          </label>
          <label v-if="sizes.length">{{ w('Taille') }}
            <select v-model.number="form.IdProductAttribute" class="sf-select" required>
              <option :value="0" disabled>{{ w('Choisir une taille') }}</option>
              <option v-for="v in sizes" :key="v.Id" :value="v.Id" :disabled="!v.Available">{{ v.Label }}{{ v.Available ? '' : ' (' + w('épuisé') + ')' }}</option>
            </select>
          </label>
          <label>{{ w('Quantité') }}<input v-model.number="form.Quantity" type="number" min="1" max="5" required></label>
          <label>{{ w('Prénom') }}<input v-model="form.Firstname" type="text" autocomplete="given-name" maxlength="80" required></label>
          <label>{{ w('Nom') }}<input v-model="form.Lastname" type="text" autocomplete="family-name" maxlength="80" required></label>
          <label>{{ w('E-mail') }}<input v-model="form.Email" type="email" autocomplete="email" maxlength="100" required></label>
          <label>{{ w('Téléphone') }}<input v-model="form.MobilePhone" type="tel" autocomplete="tel" maxlength="20" required></label>
          <input v-model="form.Website" type="text" name="website" class="sf-sr" tabindex="-1" autocomplete="off" aria-hidden="true">
          <p v-if="error" class="sf-form-error" role="alert">{{ error }}</p>
          <button type="submit" class="sf-btn is-solid" :disabled="busy">{{ w(busy ? 'Envoi…' : 'Envoyer ma demande') }}</button>
        </form>
      </div>
    </aside>
  </div>
</template>
