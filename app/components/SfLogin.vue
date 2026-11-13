<script setup lang="ts">
// Logging in, creating an account, asking for a new password: the three forms of a visitor who is not logged in.
const w = useWords()
const { send, busy } = useAccount()
const mode = ref<'login' | 'register' | 'forgot'>('login')
const site = inject<Ref<any>>('sfSite', ref(null))
const pro = computed(() => !!site.value?.Pro)   // a professional site: the account is a company's
const form = reactive({ Email: '', Password: '', Firstname: '', Lastname: '', Newsletter: false, CompanyName: '', CompanyNumber: '', TaxNumber: '', Phone: '' })
const error = ref(''), note = ref(''), show = ref(false)
async function submit() {
  error.value = ''; note.value = ''
  const answer = await send({ Action: mode.value, ...form, Business: pro.value && mode.value === 'register' })
  error.value = answer.Error; note.value = answer.Note
  if (!answer.Error) { form.Password = '' }
}
const to = (next: 'login' | 'register' | 'forgot') => { mode.value = next; error.value = ''; note.value = '' }
</script>

<template>
  <form class="sf-login" @submit.prevent="submit">
    <h2>{{ w(mode === 'login' ? 'Bonjour' : mode === 'register' ? (pro ? 'Créer mon compte professionnel' : 'Créer mon compte') : 'Mot de passe oublié') }}</h2>
    <p v-if="pro && mode === 'register'" class="sf-muted">{{ w('Notre équipe examine et active votre compte dans les plus brefs délais.') }}</p>
    <p v-if="mode === 'forgot'" class="sf-muted">{{ w('Indiquez votre adresse e-mail : nous vous envoyons un lien pour choisir un nouveau mot de passe.') }}</p>
    <p v-if="error" class="sf-cart-error" role="alert">{{ w(error) }}</p>
    <p v-if="note" class="sf-note-ok" role="status">{{ w(note) }}</p>
    <template v-if="mode === 'register' && pro">
      <label>{{ w('Société') }}<input v-model="form.CompanyName" type="text" autocomplete="organization" maxlength="100" required></label>
      <label>{{ w('Numéro d\'immatriculation (SIRET)') }}<input v-model="form.CompanyNumber" type="text" inputmode="numeric" maxlength="40" required></label>
      <label>{{ w('Numéro de TVA (facultatif)') }}<input v-model="form.TaxNumber" type="text" maxlength="40"></label>
      <label>{{ w('Téléphone') }}<input v-model="form.Phone" type="tel" autocomplete="tel" maxlength="30" required></label>
    </template>
    <template v-if="mode === 'register'">
      <label>{{ w('Prénom') }}<input v-model="form.Firstname" type="text" autocomplete="given-name" maxlength="60" required></label>
      <label>{{ w('Nom') }}<input v-model="form.Lastname" type="text" autocomplete="family-name" maxlength="60" required></label>
    </template>
    <label>{{ w('Adresse e-mail') }}<input v-model="form.Email" type="email" :autocomplete="mode === 'login' ? 'username' : 'email'" maxlength="150" required></label>
    <label v-if="mode !== 'forgot'">{{ w('Mot de passe') }}
      <span class="sf-login-pass"><input v-model="form.Password" :type="show ? 'text' : 'password'" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" :minlength="mode === 'register' ? 8 : undefined" maxlength="200" required><button type="button" :aria-pressed="show" @click="show = !show">{{ w(show ? 'Masquer' : 'Afficher') }}</button></span>
      <small v-if="mode === 'register'">{{ w('8 caractères au moins.') }}</small>
    </label>
    <label v-if="mode === 'register'" class="sf-check"><input v-model="form.Newsletter" type="checkbox"><span>{{ w('Recevoir les nouveautés et les offres par e-mail') }}</span></label>
    <button type="submit" class="sf-btn" :disabled="busy">{{ w(mode === 'login' ? 'Se connecter' : mode === 'register' ? 'Créer mon compte' : 'Envoyer le lien') }}</button>
    <button v-if="mode === 'login'" type="button" class="sf-btn is-outline" @click="to('register')">{{ w(pro ? 'Créer mon compte professionnel' : 'S\'inscrire') }}</button>
    <button v-if="mode === 'login'" type="button" class="sf-link" @click="to('forgot')">{{ w('Mot de passe oublié ?') }}</button>
    <button v-else type="button" class="sf-link" @click="to('login')">{{ w('J\'ai déjà un compte') }}</button>
  </form>
</template>
