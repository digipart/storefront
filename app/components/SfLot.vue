<script setup lang="ts">
// Buying by lot on a professional site: a full pack (one piece of each size, as many packs as wanted) and, or, a quantity for each size, within what is in stock.
const props = defineProps<{ product: any }>()
const emit = defineEmits<{ close: [] }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const { addMany, busy, error } = useCart()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const sizes = computed(() => props.product.Variants.filter((v: any) => v.Label && v.Available))
const packs = ref(0)
const each = reactive<Record<number, number>>({})
const stock = (v: any) => Math.max(0, Number(v.Quantity) || 0)
const maxPacks = computed(() => (sizes.value.length ? Math.min(...sizes.value.map(stock)) : 0))
const total = (v: any) => Math.min(stock(v), packs.value + (each[v.Id] || 0))
const pieces = computed(() => sizes.value.reduce((sum: number, v: any) => sum + total(v), 0))
const set = (v: any, to: number) => { each[v.Id] = Math.max(0, Math.min(stock(v) - packs.value, to)) }
const setPacks = (to: number) => { packs.value = Math.max(0, Math.min(maxPacks.value, to)); for (const v of sizes.value) { set(v, each[v.Id] || 0) } }
const panel = ref<HTMLElement | null>(null)
async function submit() { if (await addMany(props.product.Id, sizes.value.map((v: any) => ({ IdProductAttribute: v.Id, Quantity: total(v) })).filter((item: any) => item.Quantity > 0))) { emit('close') } }
onMounted(() => { document.documentElement.style.overflow = 'hidden'; nextTick(() => panel.value?.focus()) })
onBeforeUnmount(() => { document.documentElement.style.overflow = '' })
</script>

<template>
  <div class="sf-modal" @keydown.esc="emit('close')" @click.self="emit('close')">
    <div ref="panel" class="sf-modal-box sf-lot" role="dialog" aria-modal="true" :aria-label="w('Sélectionner des quantités')" tabindex="-1">
      <header class="sf-drawer-head"><h2>{{ w('Sélectionner des quantités') }}</h2><button type="button" :aria-label="w('Fermer')" @click="emit('close')">✕</button></header>
      <div class="sf-lot-body">
        <p v-if="error" class="sf-cart-error" role="alert">{{ w(error) }}</p>
        <div v-if="sizes.length > 1 && maxPacks > 0" class="sf-lot-row is-pack">
          <div><strong>{{ w('Pack complet – {a} tailles', { a: sizes.length }) }}</strong><small>{{ w('1 pièce par taille ({a} pièces au total)', { a: sizes.length }) }}</small><small class="sf-lot-ok">{{ w('Tailles incluses : {a}', { a: sizes.map((v: any) => v.Label).join(', ') }) }}</small></div>
          <div class="sf-qty" role="group" :aria-label="w('Nombre de packs')"><button type="button" :disabled="packs < 1" :aria-label="w('Retirer un pack')" @click="setPacks(packs - 1)">−</button><span aria-live="polite">{{ packs }}</span><button type="button" :disabled="packs >= maxPacks" :aria-label="w('Ajouter un pack')" @click="setPacks(packs + 1)">+</button></div>
        </div>
        <p v-if="sizes.length > 1 && maxPacks > 0" class="sf-lot-or"><span>{{ w('ou') }}</span></p>
        <div class="sf-lot-title"><strong>{{ w('Par taille – personnalisé') }}</strong><small>{{ w('Choisissez la quantité pour chaque taille') }}</small></div>
        <div v-for="v in sizes" :key="v.Id" class="sf-lot-row">
          <div><strong>{{ v.Label }}</strong><small :class="{ 'sf-lot-low': stock(v) <= 20 }">{{ stock(v) <= 20 ? w('Stock limité : {a} dispo.', { a: stock(v) }) : w('En stock') }}</small></div>
          <div class="sf-qty" role="group" :aria-label="w('Quantité de {a}', { a: v.Label })"><button type="button" :disabled="(each[v.Id] || 0) < 1" :aria-label="w('Retirer un exemplaire')" @click="set(v, (each[v.Id] || 0) - 1)">−</button><span aria-live="polite">{{ each[v.Id] || 0 }}</span><button type="button" :disabled="total(v) >= stock(v)" :aria-label="w('Ajouter un exemplaire')" @click="set(v, (each[v.Id] || 0) + 1)">+</button></div>
        </div>
      </div>
      <footer class="sf-lot-foot">
        <div class="sf-total-row is-main"><span>{{ w(pieces > 1 ? '{a} pièces' : '{a} pièce', { a: pieces }) }}</span><span>{{ money(pieces * product.Price, product.Currency, lang) }}<small v-if="product.TaxExcl" class="sf-ht"> {{ w('H.T.') }}</small></span></div>
        <button type="button" class="sf-btn" :disabled="busy || pieces < 1" @click="submit">{{ w('Ajouter au panier') }}</button>
      </footer>
    </div>
  </div>
</template>
