<script setup lang="ts">
// The customer service of the account. A request starts from an article the customer bought (the last purchases are shown); the requests already made are listed with their state, and each
// opens as a conversation where the customer can answer while the request is open.
const props = defineProps<{ id: string, base: string }>()
const w = useWords()
const { send, busy, query } = useAccount()
const data = ref<any>(null)
const waiting = ref(true)
const error = ref('')
const about = ref<any>(null)
const message = ref('')
const show = ref<'open' | 'all'>('open')
const ticket = computed(() => Math.floor(Number(props.id) || 0))
const states: Record<string, string> = { open: 'Ouverte', progress: 'En cours', closed: 'Clôturée' }
async function read() {
  waiting.value = true
  try { data.value = await $fetch<any>('/api/storefront/account', { query: { ...query(), part: ticket.value ? 'ticket' : 'service', ...(ticket.value ? { id: ticket.value } : {}) } }) } catch { data.value = null } finally { waiting.value = false }
}
const tickets = computed(() => (data.value?.Tickets || []).filter((t: any) => show.value === 'all' || t.State !== 'closed'))
async function create() {
  error.value = ''
  const answer = await send({ Action: 'ticket-new', IdOrder: about.value.IdOrder, IdProductAttribute: about.value.IdProductAttribute, Message: message.value })
  if (answer.Error) { error.value = answer.Error; return }
  message.value = ''; about.value = null
  if (answer.Id) { location.href = props.base + '/' + answer.Id } else { await read() }
}
async function reply() {
  error.value = ''
  const answer = await send({ Action: 'ticket-reply', Id: ticket.value, Message: message.value })
  if (answer.Error) { error.value = answer.Error; return }
  message.value = ''
  await read()
}
onMounted(read)
watch(() => props.id, read)
</script>

<template>
  <div class="sf-service">
    <p v-if="error" class="sf-cart-error" role="alert">{{ w(error) }}</p>
    <p v-if="waiting && !data" class="sf-muted">{{ w('Chargement…') }}</p>

    <!-- one request: the conversation -->
    <template v-else-if="ticket">
      <a :href="base" class="sf-link">‹ {{ w('Mes demandes') }}</a>
      <p v-if="!data?.Ticket" class="sf-muted">{{ w('Cette demande n\'existe pas.') }}</p>
      <template v-else>
        <h1>{{ data.Ticket.Product || w('Ma demande') }}</h1>
        <p class="sf-total-note"><span class="sf-acc-state">{{ w(states[data.Ticket.State] || 'Ouverte') }}</span><template v-if="data.Ticket.IdOrder"> · {{ w('Commande n° {a}', { a: data.Ticket.IdOrder }) }}</template></p>
        <ol class="sf-chat">
          <li v-for="(line, index) in data.Ticket.Messages" :key="index" :class="{ 'is-mine': line.Mine }"><p>{{ line.Text }}</p><small>{{ line.Mine ? w('Vous') : (data.Ticket.Shop || w('Le service client')) }} · {{ line.Date }}</small></li>
        </ol>
        <p v-if="!data.Ticket.Messages.length" class="sf-muted">{{ w('Votre demande est enregistrée : nous vous répondons au plus vite.') }}</p>
        <form v-if="data.Ticket.State !== 'closed'" class="sf-form" @submit.prevent="reply">
          <label>{{ w('Votre réponse') }}<textarea v-model="message" rows="4" maxlength="2000" required /></label>
          <div><button type="submit" class="sf-btn" :disabled="busy">{{ w('Envoyer') }}</button></div>
        </form>
        <p v-else class="sf-muted">{{ w('Cette demande est clôturée.') }}</p>
      </template>
    </template>

    <!-- the customer service: a new request, the requests made -->
    <template v-else>
      <h1>{{ w('Service client') }}</h1>
      <template v-if="about">
        <h2 class="sf-acc-sub">{{ w('Votre demande') }}</h2>
        <div class="sf-service-about"><img v-if="about.Image" :src="about.Image" alt="" loading="lazy"><span><strong>{{ about.Name }}</strong><small>{{ w('Commande n° {a}', { a: about.IdOrder }) }} · {{ about.Date }}</small></span></div>
        <form class="sf-form" @submit.prevent="create">
          <label>{{ w('Message') }}<textarea v-model="message" rows="5" maxlength="500" required :placeholder="w('Décrivez votre question ou votre problème.')" /></label>
          <div class="sf-co-actions"><button type="submit" class="sf-btn" :disabled="busy">{{ w('Envoyer ma demande') }}</button><button type="button" class="sf-link" @click="about = null">{{ w('Annuler') }}</button></div>
        </form>
      </template>
      <template v-else>
        <h2 class="sf-acc-sub">{{ w('Besoin d\'aide sur un article ?') }}</h2>
        <p v-if="!(data?.Products || []).length" class="sf-muted">{{ w('Vos derniers achats apparaîtront ici.') }}</p>
        <ul v-else class="sf-service-products">
          <li v-for="product in data.Products" :key="product.IdOrder + '-' + product.IdProductAttribute"><button type="button" @click="about = product; error = ''"><img v-if="product.Image" :src="product.Image" alt="" loading="lazy"><span><strong>{{ product.Name }}</strong><small>{{ product.Date }}</small></span></button></li>
        </ul>
        <h2 class="sf-acc-sub">{{ w('Mes demandes') }}</h2>
        <div v-if="(data?.Tickets || []).length" class="sf-rewards-tabs" role="tablist"><button type="button" role="tab" :aria-selected="show === 'open'" @click="show = 'open'">{{ w('En cours') }}</button><button type="button" role="tab" :aria-selected="show === 'all'" @click="show = 'all'">{{ w('Toutes') }}</button></div>
        <p v-if="!tickets.length" class="sf-muted">{{ w((data?.Tickets || []).length ? 'Aucune demande en cours.' : 'Vous n\'avez pas encore fait de demande.') }}</p>
        <ul v-else class="sf-service-tickets">
          <li v-for="item in tickets" :key="item.Id"><a :href="base + '/' + item.Id"><img v-if="item.Image" :src="item.Image" alt="" loading="lazy"><span><strong>{{ item.Product || item.Title }}</strong><small>{{ item.Last ? (item.LastByShop ? w('Le service client') : w('Vous')) + ' : ' + item.Last : item.Date }}</small></span><span class="sf-acc-state">{{ w(states[item.State] || 'Ouverte') }}</span></a></li>
        </ul>
      </template>
    </template>
  </div>
</template>
