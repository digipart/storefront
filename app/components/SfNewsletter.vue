<script setup lang="ts">
// The newsletter box (a section, a column of the footer, the page of a closed site): the e-mail of the visitor is sent to the shop's subscription list.
const props = defineProps<{ button?: string, small?: boolean, lang?: string }>()
const site = inject<Ref<any>>('sfSite', ref(null))
const say = (text: string) => words(props.lang || site.value?.Route?.LanguageIsoCode || 'fr', text)
const email = ref(''), trap = ref(''), busy = ref(false), done = ref(false), error = ref('')
async function submit() {
  if (busy.value) { return }
  busy.value = true; error.value = ''
  try {
    const answer = await $fetch<any>('/api/storefront/newsletter', { method: 'POST', query: { lang: props.lang || site.value?.Route?.LanguageIsoCode || '' }, body: { Email: email.value, Website: trap.value } })
    done.value = answer.Done; error.value = answer.Error || ''
  } catch { error.value = 'Votre inscription n\'a pas pu être enregistrée, merci de réessayer.' } finally { busy.value = false }
}
</script>

<template>
  <p v-if="done" class="sf-news-done" role="status">{{ say('Merci, votre inscription est enregistrée.') }}</p>
  <form v-else class="sf-news" :class="{ 'is-small': small }" @submit.prevent="submit">
    <input v-model="email" type="email" name="email" autocomplete="email" maxlength="150" :placeholder="say('votre@email.fr')" :aria-label="say('Adresse e-mail')" required>
    <input v-model="trap" type="text" name="website" class="sf-sr" tabindex="-1" autocomplete="off" aria-hidden="true">
    <button type="submit" class="sf-btn" :disabled="busy">{{ button || 'OK' }}</button>
    <p v-if="error" class="sf-news-error" role="alert">{{ say(error) }}</p>
  </form>
</template>
