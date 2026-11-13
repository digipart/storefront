<script setup lang="ts">
// Joining the WhatsApp list of the shop, in two short steps: the e-mail, then the WhatsApp number. A customer who is logged in finds the e-mail already written.
const props = defineProps<{ button?: string, success?: string }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const { customer } = useAccount()
const form = reactive({ Email: '', Phone: '', Website: '' })
const step = ref<'email' | 'phone' | 'done'>('email')
const busy = ref(false)
const error = ref('')
const phoneBox = ref<HTMLInputElement | null>(null)
watch(customer, (now: any) => { if (now?.Email && !form.Email) { form.Email = now.Email; if (now.Phone && !form.Phone) { form.Phone = now.Phone } } }, { immediate: true })
async function send() {
  if (busy.value) { return }
  busy.value = true; error.value = ''
  try {
    const answer = await $fetch<any>('/api/storefront/whatsapp', { method: 'POST', query: { lang: site.value?.Route?.LanguageIsoCode || 'fr' }, body: { Email: form.Email, Phone: step.value === 'phone' ? form.Phone : '', Website: form.Website } })
    error.value = answer.Error || ''
    step.value = answer.Done ? 'done' : (answer.Step === 'phone' ? 'phone' : 'email')
    if (step.value === 'phone') { nextTick(() => phoneBox.value?.focus()) }
  } catch { error.value = 'Votre inscription n\'a pas pu être enregistrée, merci de réessayer.' } finally { busy.value = false }
}
</script>

<template>
  <div class="sf-wa-form">
    <div v-if="step === 'done'" class="sf-form-done" role="status"><strong>{{ w('Merci !') }}</strong> {{ success || w('Vous êtes bien inscrit : à très vite sur WhatsApp.') }}</div>
    <form v-else class="sf-form" @submit.prevent="send">
      <p class="sf-wa-step">{{ w(step === 'email' ? 'Étape 1 sur 2 : votre adresse e-mail' : 'Étape 2 sur 2 : votre numéro WhatsApp') }}</p>
      <label v-if="step === 'email'">{{ w('Adresse e-mail') }}<input v-model="form.Email" type="email" autocomplete="email" maxlength="150" required></label>
      <label v-else>{{ w('Numéro WhatsApp') }}<input ref="phoneBox" v-model="form.Phone" type="tel" autocomplete="tel" inputmode="tel" maxlength="30" placeholder="06 12 34 56 78" required></label>
      <div class="sf-hp" aria-hidden="true"><label>Website<input v-model="form.Website" type="text" tabindex="-1" autocomplete="off"></label></div>
      <p v-if="error" class="sf-cart-error" role="alert">{{ w(error) }}</p>
      <div class="sf-co-actions"><button type="submit" class="sf-btn" :disabled="busy">{{ step === 'email' ? w('Continuer') : (button || w('Valider')) }}</button><button v-if="step === 'phone'" type="button" class="sf-link" @click="step = 'email'; error = ''">{{ w('Modifier mon e-mail') }}</button></div>
    </form>
  </div>
</template>
