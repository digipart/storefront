<script setup lang="ts">
// « Donner mon avis »: the global note, the criteria the shop asks for (stars, or a scale between labels) and a comment. The review is kept by Digipart until the shop approves it.
const props = defineProps<{ product: any }>()
const emit = defineEmits<{ close: [] }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const { data } = await useFetch<any>('/api/storefront/review', { query: { lang: site.value?.Route?.LanguageIsoCode || '' }, key: 'sf-review-subjects' })
const subjects = computed(() => data.value?.Subjects || [])
const rating = ref(0), comment = ref(''), website = ref('')
const details = reactive<Record<number, number>>({})
const busy = ref(false), error = ref(''), done = ref(false)
async function send() {
  if (busy.value) { return }
  if (!rating.value) { error.value = w('Choisissez une note de 1 à 5.'); return }
  const missing = subjects.value.find((s: any) => s.Mandatory && !details[s.Id])
  if (missing) { error.value = w('Merci de noter tous les critères demandés.'); return }
  busy.value = true
  error.value = ''
  try {
    const answer = await $fetch<any>('/api/storefront/review', { method: 'POST', query: { lang: site.value?.Route?.LanguageIsoCode || '' }, body: { IdProduct: props.product.Id, Rating: rating.value, Comment: comment.value, Website: website.value, Details: Object.entries(details).map(([Id, Rating]) => ({ Id, Rating })) } })
    if (answer.Done) { done.value = true } else { error.value = w(answer.Error || 'Votre avis n\'a pas pu être envoyé, merci de réessayer.') }
  } catch { error.value = w('Votre avis n\'a pas pu être envoyé, merci de réessayer.') } finally { busy.value = false }
}
</script>

<template>
  <div class="sf-review-form">
    <p v-if="done" class="sf-form-done" role="status">{{ w('Merci ! Votre avis sera publié après validation par la boutique.') }}</p>
    <form v-else class="sf-form" @submit.prevent="send">
      <fieldset class="sf-rate">
        <legend>{{ w('Votre note') }}</legend>
        <span class="sf-rate-stars"><button v-for="n in 5" :key="n" type="button" :class="{ 'is-on': n <= rating }" :aria-label="n + ' / 5'" :aria-pressed="n === rating" @click="rating = n">★</button></span>
      </fieldset>
      <fieldset v-for="s in subjects" :key="s.Id" class="sf-rate">
        <legend>{{ s.Name }}<small v-if="!s.Mandatory"> ({{ w('facultatif') }})</small></legend>
        <span v-if="!s.Scale" class="sf-rate-stars"><button v-for="n in 5" :key="n" type="button" :class="{ 'is-on': n <= (details[s.Id] || 0) }" :aria-label="n + ' / 5'" @click="details[s.Id] = n">★</button></span>
        <span v-else class="sf-rate-scale">
          <span class="sf-rate-dots"><button v-for="n in 5" :key="n" type="button" :class="{ 'is-on': n === details[s.Id] }" :aria-label="n + ' / 5'" :aria-pressed="n === details[s.Id]" @click="details[s.Id] = n" /></span>
          <small class="sf-rate-labels"><span>{{ s.Min }}</span><span>{{ s.Mid }}</span><span>{{ s.Max }}</span></small>
        </span>
      </fieldset>
      <label>{{ w('Votre commentaire') }}<textarea v-model="comment" rows="4" maxlength="2000" /></label>
      <input v-model="website" type="text" name="website" class="sf-sr" tabindex="-1" autocomplete="off" aria-hidden="true">
      <p v-if="error" class="sf-form-error" role="alert">{{ error }}</p>
      <div class="sf-review-actions"><button type="submit" class="sf-btn is-solid" :disabled="busy">{{ w(busy ? 'Envoi…' : 'Envoyer mon avis') }}</button><button type="button" class="sf-link" @click="emit('close')">{{ w('Annuler') }}</button></div>
    </form>
  </div>
</template>
