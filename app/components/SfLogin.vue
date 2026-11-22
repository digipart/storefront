<script setup lang="ts">
// Logging in, creating an account, asking for a new password: the three forms of a visitor who is not logged in.
const w = useWords()
const props = defineProps<{ title?: string, text?: string, hide?: string[] }>()   // the shop's own words on the login page
const { send, busy } = useAccount()
const mode = ref<'login' | 'register' | 'forgot'>('login')
const site = inject<Ref<any>>('sfSite', ref(null))
const pro = computed(() => !!site.value?.Pro)   // a professional site: the account is a company's
const loyalty = computed(() => !pro.value && !!site.value?.Features?.Loyalty)   // the shop has a loyalty programme: joining is offered at sign-up
const form = reactive({ Email: '', Password: '', Firstname: '', Lastname: '', Newsletter: false, Loyalty: true, CompanyName: '', CompanyNumber: '', TaxNumber: '', Phone: '' })
const error = ref(''), note = ref(''), show = ref(false)
// Google / Facebook: the providers Digipart has keys for, minus those the login page of the builder hides
const route = useRoute()
const social = computed(() => (pro.value ? [] : (site.value?.SocialLogin || []) as string[]).filter(name => !(props.hide || []).includes(name)))
const socialUrl = (name: string) => '/account/social/' + name + '?back=' + encodeURIComponent(route.path) + '&lang=' + (site.value?.Route?.LanguageIsoCode || 'fr')
onMounted(() => { if (route.query.social === 'error') { error.value = 'La connexion n\'a pas abouti. Réessayez, ou connectez-vous avec votre adresse e-mail.' } })
async function submit() {
  error.value = ''; note.value = ''
  const answer = await send({ Action: mode.value, ...form, Loyalty: loyalty.value && form.Loyalty, Business: pro.value && mode.value === 'register' })
  error.value = answer.Error; note.value = answer.Note
  if (!answer.Error) { form.Password = '' }
}
const to = (next: 'login' | 'register' | 'forgot') => { mode.value = next; error.value = ''; note.value = '' }
</script>

<template>
  <form class="sf-login" @submit.prevent="submit">
    <h2>{{ mode === 'login' && props.title ? props.title : w(mode === 'login' ? 'Bonjour' : mode === 'register' ? (pro ? 'Créer mon compte professionnel' : 'Créer mon compte') : 'Mot de passe oublié') }}</h2>
    <p v-if="mode === 'login' && props.text" class="sf-muted sf-login-text">{{ props.text }}</p>
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
    <label v-if="mode === 'register' && loyalty" class="sf-check"><input v-model="form.Loyalty" type="checkbox"><span>{{ w('Rejoindre le programme de fidélité et cumuler des points') }}</span></label>
    <label v-if="mode === 'register'" class="sf-check"><input v-model="form.Newsletter" type="checkbox"><span>{{ w('Recevoir les nouveautés et les offres par e-mail') }}</span></label>
    <button type="submit" class="sf-btn" :disabled="busy">{{ w(mode === 'login' ? 'Se connecter' : mode === 'register' ? 'Créer mon compte' : 'Envoyer le lien') }}</button>
    <div v-if="social.length && mode !== 'forgot'" class="sf-login-social">
      <span class="sf-login-or">{{ w('ou') }}</span>
      <a v-for="name in social" :key="name" :href="socialUrl(name)" class="sf-btn is-outline" :class="'is-' + name" rel="nofollow">
        <svg v-if="name === 'google'" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.5z" /><path fill="#34A853" d="M12 23.5c3.1 0 5.7-1 7.600-2.800l-3.700-2.900c-1 .7-2.300 1.100-3.900 1.100-3 0-5.500-2-6.400-4.700H1.800v3A11.500 11.500 0 0 0 12 23.500z" /><path fill="#FBBC05" d="M5.600 14.200a6.900 6.900 0 0 1 0-4.400v-3H1.800a11.500 11.500 0 0 0 0 10.400z" /><path fill="#EA4335" d="M12 5.100c1.700 0 3.200.6 4.400 1.700l3.300-3.300A11.500 11.500 0 0 0 1.800 6.800l3.800 3c.9-2.700 3.400-4.700 6.400-4.700z" /></svg>
        <svg v-else viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.900 11.900v-8.400H7.100V12h3V9.400c0-3 1.800-4.700 4.500-4.700 1.300 0 2.700.2 2.700.2v3h-1.500c-1.500 0-2 .9-2 1.900V12h3.400l-.5 3.500h-2.900v8.400A12 12 0 0 0 24 12z" /></svg>
        <span>{{ w(name === 'google' ? 'Continuer avec Google' : 'Continuer avec Facebook') }}</span>
      </a>
    </div>
    <button v-if="mode === 'login'" type="button" class="sf-btn is-outline" @click="to('register')">{{ w(pro ? 'Créer mon compte professionnel' : 'S\'inscrire') }}</button>
    <button v-if="mode === 'login'" type="button" class="sf-link" @click="to('forgot')">{{ w('Mot de passe oublié ?') }}</button>
    <button v-else type="button" class="sf-link" @click="to('login')">{{ w('J\'ai déjà un compte') }}</button>
  </form>
</template>
