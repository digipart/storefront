<script setup lang="ts">
// « Nouveau client professionnel ? »: the four steps to order on a professional site, in a side panel, with the way to the sign-up.
const emit = defineEmits<{ close: [] }>()
const w = useWords()
const { show } = useCart()
const steps = [['Inscription', 'Créez votre compte professionnel en remplissant le formulaire.'], ['Activation de compte', 'Notre équipe examine et active votre compte dans les plus brefs délais.'], ['Accès aux prix', 'Une fois activé, vous pouvez voir tous les prix de gros.'], ['Commande', 'Ajoutez les produits à votre panier et procédez au paiement de votre commande.']]
const panel = ref<HTMLElement | null>(null)
onMounted(() => { document.documentElement.style.overflow = 'hidden'; nextTick(() => panel.value?.focus()) })
onBeforeUnmount(() => { document.documentElement.style.overflow = '' })
const join = () => { emit('close'); nextTick(() => show('account')) }
</script>

<template>
  <div class="sf-drawer" @keydown.esc="emit('close')">
    <div class="sf-drawer-veil" @click="emit('close')" />
    <aside ref="panel" class="sf-drawer-panel" role="dialog" aria-modal="true" :aria-label="w('Nouveau client professionnel ?')" tabindex="-1">
      <header class="sf-drawer-head"><h2>{{ w('Nouveau client professionnel ?') }}</h2><button type="button" :aria-label="w('Fermer')" @click="emit('close')">✕</button></header>
      <ol class="sf-drawer-body sf-prosteps"><li v-for="(step, index) in steps" :key="step[0]"><span aria-hidden="true">{{ index + 1 }}</span><div><strong>{{ w(step[0]) }}</strong><p>{{ w(step[1]) }}</p></div></li></ol>
      <footer class="sf-drawer-foot"><button type="button" class="sf-btn" @click="join">{{ w('Créer mon compte professionnel') }}</button></footer>
    </aside>
  </div>
</template>
