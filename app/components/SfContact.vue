<script setup lang="ts">
// The contact form of a « Formulaire de contact » section: the message becomes a request in Digipart (Service client). The shop chooses in the site builder whether the phone, the order
// number and the subject are asked, the words of the button and the message shown once it is sent.
const props = defineProps<{ settings: any, texts: any }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const { customer } = useAccount()
const form = reactive({ Name: '', Email: '', Phone: '', Order: '', Subject: '', Message: '', Website: '' })
const busy = ref(false)
const error = ref('')
const done = ref(false)
// a logged-in customer does not type what the shop already knows
watch(customer, (now: any) => { if (now && !now.Guest) { form.Name = form.Name || [now.Firstname, now.Lastname].filter(Boolean).join(' '); form.Email = form.Email || now.Email || '' } }, { immediate: true })
async function send() {
  if (busy.value) { return }
  busy.value = true
  error.value = ''
  try {
    const answer = await $fetch<any>('/api/storefront/contact', { method: 'POST', query: { lang: site.value?.Route?.LanguageIsoCode || 'fr' }, body: form })
    if (answer.Done) { done.value = true } else { error.value = answer.Error || 'Votre message n\'a pas pu être envoyé, merci de réessayer.' }
  } catch { error.value = 'Votre message n\'a pas pu être envoyé, merci de réessayer.' } finally { busy.value = false }
}
</script>

<template>
  <p v-if="done" class="sf-form-done" role="status">{{ texts?.Success || w('Merci, votre message est bien envoyé. Nous vous répondons au plus vite.') }}</p>
  <form v-else class="sf-form" @submit.prevent="send">
    <label>{{ w('Nom') }}<input v-model="form.Name" type="text" name="name" autocomplete="name" maxlength="120" required></label>
    <label>{{ w('E-mail') }}<input v-model="form.Email" type="email" name="email" autocomplete="email" maxlength="150" required></label>
    <label v-if="settings?.AskPhone">{{ w('Téléphone') }}<input v-model="form.Phone" type="tel" name="phone" autocomplete="tel" maxlength="30"></label>
    <label v-if="settings?.AskOrder">{{ w('Numéro de commande') }}<input v-model="form.Order" type="text" name="order" maxlength="40"></label>
    <label v-if="settings?.AskSubject">{{ w('Objet') }}<input v-model="form.Subject" type="text" name="subject" maxlength="150"></label>
    <label>{{ w('Message') }}<textarea v-model="form.Message" name="message" rows="6" maxlength="4000" required /></label>
    <!-- a field no person sees: a robot fills it -->
    <div class="sf-hp" aria-hidden="true"><label>Website<input v-model="form.Website" type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
    <p v-if="error" class="sf-cart-error" role="alert">{{ w(error) }}</p>
    <div><button type="submit" class="sf-btn" :disabled="busy">{{ busy ? w('Envoi…') : (texts?.ButtonText || w('Envoyer')) }}</button></div>
  </form>
</template>
