<script setup lang="ts">
// The referral of the account: the code and the link to share (copied, or sent by e-mail, text message or WhatsApp), how many friends came, and the list of friends with the reward each brought.
const w = useWords()
const { query } = useAccount()
const site = inject<Ref<any>>('sfSite')!
const data = ref<any>(null)
const waiting = ref(true)
const copied = ref('')
const show = ref<'all' | 'pending' | 'done'>('all')
onMounted(async () => { try { data.value = (await $fetch<any>('/api/storefront/account', { query: { ...query(), part: 'referral' } })).Referral } catch { data.value = null } finally { waiting.value = false } })
async function copy(text: string) { try { await navigator.clipboard.writeText(text); copied.value = text; setTimeout(() => { copied.value = '' }, 2500) } catch { /* the link stays written */ } }
const text = computed(() => w('Je te fais découvrir {a} : voici un code de bienvenue pour ta première commande.', { a: site.value?.Name || '' }) + ' ' + (data.value?.Link || ''))
const friends = computed(() => (data.value?.Friends || []).filter((f: any) => show.value === 'all' || (show.value === 'done') === f.Done))
</script>

<template>
  <div class="sf-referral">
    <h1>{{ w('Parrainage') }}</h1>
    <p v-if="waiting" class="sf-muted">{{ w('Chargement…') }}</p>
    <p v-else-if="!data" class="sf-muted">{{ w('Le parrainage n\'est pas disponible pour le moment.') }}</p>
    <template v-else>
      <p>{{ w('Partagez votre lien : votre ami reçoit un code de bienvenue, et vous recevez une récompense dès sa première commande.') }}</p>
      <div class="sf-referral-link"><code>{{ data.Link }}</code><button type="button" class="sf-btn" @click="copy(data.Link)">{{ w(copied === data.Link ? 'Copié' : 'Copier le lien') }}</button></div>
      <p class="sf-referral-share">
        <a class="sf-btn is-outline" :href="'https://wa.me/?text=' + encodeURIComponent(text)" target="_blank" rel="noopener">WhatsApp</a>
        <a class="sf-btn is-outline" :href="'mailto:?subject=' + encodeURIComponent(site?.Name || '') + '&body=' + encodeURIComponent(text)">{{ w('E-mail') }}</a>
        <a class="sf-btn is-outline" :href="'sms:?&body=' + encodeURIComponent(text)">SMS</a>
      </p>
      <p class="sf-total-note">{{ w('Votre code : {a}', { a: data.Code }) }}</p>
      <div class="sf-referral-stats"><div><strong>{{ data.Pending }}</strong><span>{{ w('invitations en attente') }}</span></div><div><strong>{{ data.Complete }}</strong><span>{{ w('amis ont commandé') }}</span></div></div>
      <h2 class="sf-acc-sub">{{ w('Mes filleuls') }}</h2>
      <div v-if="data.Friends.length" class="sf-rewards-tabs" role="tablist"><button v-for="tab in ['all', 'pending', 'done']" :key="tab" type="button" role="tab" :aria-selected="show === tab" @click="show = tab as any">{{ w({ all: 'Tous', pending: 'En attente', done: 'Ont commandé' }[tab]!) }}</button></div>
      <p v-if="!friends.length" class="sf-muted">{{ w(data.Friends.length ? 'Personne ici pour le moment.' : 'Vous n\'avez pas encore invité d\'ami.') }}</p>
      <ul v-else class="sf-rewards-list">
        <li v-for="friend in friends" :key="friend.Email"><span><strong>{{ friend.Email }}</strong><small>{{ w(friend.Done ? 'A commandé' : 'Invitation envoyée') }}</small></span>
          <span v-if="friend.Code" class="sf-rewards-code"><code>{{ friend.Code }}</code><small>{{ friend.Used ? w('Utilisé') : (friend.Until ? w('Valable jusqu\'au {a}', { a: friend.Until }) : '') }}</small><button v-if="!friend.Used" type="button" class="sf-link" @click="copy(friend.Code)">{{ w(copied === friend.Code ? 'Copié' : 'Copier') }}</button></span></li>
      </ul>
    </template>
  </div>
</template>
