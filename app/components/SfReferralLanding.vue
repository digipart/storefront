<script setup lang="ts">
// The page a friend reaches from a referral link (`/parrainage/<code>`): an e-mail, and the welcome promo code is shown, ready to copy.
const props = defineProps<{ code: string }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const form = reactive({ Email: '', Newsletter: false, Website: '' })
const busy = ref(false)
const error = ref('')
const got = ref<any>(null)
const copied = ref(false)
async function send() {
  if (busy.value) { return }
  busy.value = true; error.value = ''
  try {
    const answer = await $fetch<any>('/api/storefront/referral', { method: 'POST', query: { lang: site.value?.Route?.LanguageIsoCode || 'fr' }, body: { ...form, Code: props.code } })
    if (answer.Error || !answer.Code) { error.value = answer.Error || 'Votre code n\'a pas pu être créé, merci de réessayer.' } else { got.value = answer }
  } catch { error.value = 'Votre code n\'a pas pu être créé, merci de réessayer.' } finally { busy.value = false }
}
async function copy() { try { await navigator.clipboard.writeText(got.value.Code); copied.value = true } catch { /* the code stays written */ } }
</script>

<template>
  <div class="sf-thanks sf-referral-land">
    <h1>{{ w('Bienvenue chez {a}', { a: site?.Name || '' }) }}</h1>
    <template v-if="got">
      <p>{{ w('Voici votre code de bienvenue. Saisissez-le sur votre première commande.') }}</p>
      <div class="sf-rewards-got"><code>{{ got.Code }}</code><span v-if="got.Until">{{ w('Valable jusqu\'au {a}', { a: got.Until }) }}</span><button type="button" class="sf-btn is-outline" @click="copy">{{ w(copied ? 'Copié' : 'Copier le code') }}</button></div>
      <a :href="site?.Route?.Prefix || '/'" class="sf-btn">{{ w('Découvrir la boutique') }}</a>
    </template>
    <form v-else class="sf-form" @submit.prevent="send">
      <p>{{ w('Un ami vous invite : indiquez votre adresse e-mail pour recevoir votre code de bienvenue.') }}</p>
      <p v-if="error" class="sf-cart-error" role="alert">{{ w(error) }}</p>
      <label>{{ w('Adresse e-mail') }}<input v-model="form.Email" type="email" autocomplete="email" maxlength="150" required></label>
      <label class="sf-check"><input v-model="form.Newsletter" type="checkbox"><span>{{ w('Recevoir les nouveautés et les offres par e-mail') }}</span></label>
      <div class="sf-hp" aria-hidden="true"><label>Website<input v-model="form.Website" type="text" tabindex="-1" autocomplete="off"></label></div>
      <div><button type="submit" class="sf-btn" :disabled="busy">{{ w('Recevoir mon code') }}</button></div>
    </form>
  </div>
</template>
