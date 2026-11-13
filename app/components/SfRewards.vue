<script setup lang="ts">
// The rewards of the loyalty programme: the ones the customer already has (each with its code to type on an order, copied in one click), then the catalogue, where a reward the points reach
// is obtained in two steps (asked, then confirmed), and the others say how many points are missing.
const props = defineProps<{ rewards: any, currency?: string }>()
const emit = defineEmits<{ changed: [] }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const { send, busy } = useAccount()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const filter = ref<'available' | 'used' | 'expired'>('available')
const asking = ref(0)
const got = ref('')
const error = ref('')
const copied = ref('')
const mine = computed(() => (props.rewards?.Mine || []).filter((r: any) => r.State === filter.value))
async function obtain(id: number) {
  error.value = ''
  const answer = await send({ Action: 'reward-obtain', Id: id })
  asking.value = 0
  if (answer.Error) { error.value = answer.Error; return }
  got.value = answer.Code || ''
  emit('changed')
}
async function copy(code: string) { try { await navigator.clipboard.writeText(code); copied.value = code; setTimeout(() => { if (copied.value === code) { copied.value = '' } }, 2500) } catch { /* the code stays written: it can be selected by hand */ } }
</script>

<template>
  <div class="sf-rewards">
    <p v-if="error" class="sf-cart-error" role="alert">{{ w(error) }}</p>
    <div v-if="got" class="sf-rewards-got" role="status"><strong>{{ w('Votre récompense est prête') }}</strong><span>{{ w('Saisissez ce code sur votre prochaine commande :') }}</span><code>{{ got }}</code><button type="button" class="sf-btn is-outline" @click="copy(got)">{{ w(copied === got ? 'Copié' : 'Copier le code') }}</button></div>

    <h2 class="sf-acc-sub">{{ w('Mes récompenses') }}</h2>
    <div class="sf-rewards-tabs" role="tablist"><button v-for="state in ['available', 'used', 'expired']" :key="state" type="button" role="tab" :aria-selected="filter === state" @click="filter = state as any">{{ w({ available: 'Disponibles', used: 'Utilisées', expired: 'Expirées' }[state]!) }}</button></div>
    <p v-if="!mine.length" class="sf-muted">{{ w(filter === 'available' ? 'Vous n\'avez pas de récompense disponible pour le moment.' : 'Aucune récompense ici.') }}</p>
    <ul v-else class="sf-rewards-list">
      <li v-for="reward in mine" :key="reward.Code"><span><strong>{{ reward.Title }}</strong><small v-if="reward.Expires">{{ w('Valable jusqu\'au {a}', { a: reward.Expires }) }}</small></span>
        <span class="sf-rewards-code"><code>{{ reward.Code }}</code><button v-if="reward.State === 'available'" type="button" class="sf-link" @click="copy(reward.Code)">{{ w(copied === reward.Code ? 'Copié' : 'Copier') }}</button></span></li>
    </ul>

    <h2 class="sf-acc-sub">{{ w('Obtenir une récompense') }}</h2>
    <p v-if="!(rewards?.Catalogue || []).length" class="sf-muted">{{ w('Les récompenses arrivent bientôt.') }}</p>
    <ul v-else class="sf-rewards-cat">
      <li v-for="reward in rewards.Catalogue" :key="reward.Id" :class="{ 'is-far': reward.Missing > 0 }">
        <strong>{{ reward.Title }}</strong><span class="sf-rewards-points">{{ w('{a} points', { a: reward.Points }) }}</span>
        <small v-if="reward.Description">{{ reward.Description }}</small>
        <template v-if="reward.Missing > 0"><span class="sf-total-note">{{ w('Plus que {a} points pour cette récompense', { a: reward.Missing }) }}</span></template>
        <template v-else-if="asking === reward.Id">
          <span class="sf-total-note">{{ w('{a} points seront retirés de votre solde.', { a: reward.Points }) }}</span>
          <span class="sf-co-actions"><button type="button" class="sf-btn" :disabled="busy" @click="obtain(reward.Id)">{{ w('Confirmer') }}</button><button type="button" class="sf-link" @click="asking = 0">{{ w('Annuler') }}</button></span>
        </template>
        <button v-else type="button" class="sf-btn is-outline" @click="asking = reward.Id; got = ''">{{ w('Obtenir cette récompense') }}</button>
      </li>
    </ul>
  </div>
</template>
