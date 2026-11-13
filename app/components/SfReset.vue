<script setup lang="ts">
// The page of the « forgotten password » e-mail: the customer chooses a new password, and is logged in.
const route = useRoute()
const w = useWords()
const { send, busy, url } = useAccount()
const password = ref(''), error = ref(''), done = ref(false)
async function submit() {
  error.value = ''
  const answer = await send({ Action: 'reset', Email: String(route.query.email || ''), Token: String(route.query.token || ''), Password: password.value })
  error.value = answer.Error; done.value = !answer.Error
}
</script>

<template>
  <div class="sf-acc-page"><div class="sf-acc-login">
    <form v-if="!done" class="sf-login" @submit.prevent="submit">
      <h2>{{ w('Nouveau mot de passe') }}</h2>
      <p v-if="error" class="sf-cart-error" role="alert">{{ w(error) }}</p>
      <label>{{ w('Mot de passe') }}<input v-model="password" type="password" autocomplete="new-password" minlength="8" maxlength="200" required><small>{{ w('8 caractères au moins.') }}</small></label>
      <button type="submit" class="sf-btn" :disabled="busy">{{ w('Enregistrer') }}</button>
    </form>
    <div v-else class="sf-login"><h2>{{ w('Votre mot de passe est changé.') }}</h2><a :href="url" class="sf-btn">{{ w('Mon compte') }}</a></div>
  </div></div>
</template>
