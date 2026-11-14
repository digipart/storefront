<script setup lang="ts">
// « Shop the look »: the photos of a product on one side, and on the other the product and the pieces the shop associated with it, each with its size. One button puts every piece whose size is
// chosen in the cart; each piece can also be added alone. Nothing is added without a size when the piece is sold by size.
const props = defineProps<{ look: { Product: any, Pieces: any[] } }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const { add, busy, show } = useCart()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const pieces = computed(() => [props.look.Product, ...props.look.Pieces])
const sizes = (p: any) => (p.Variants || []).filter((v: any) => v.Label)
const buyable = (p: any) => (p.PriceState || 'ok') === 'ok' && !p.TaxExcl && p.Available !== false
const picked = reactive<Record<number, number>>({})
const done = reactive<Record<number, boolean>>({})
const ready = (p: any) => buyable(p) && (!sizes(p).length || !!picked[p.Id])
const chosen = computed(() => pieces.value.filter(ready))
const total = computed(() => chosen.value.reduce((sum: number, p: any) => sum + Number(p.Price || 0), 0))
const working = ref(false), note = ref('')
async function addOne(p: any) { if (!ready(p) || working.value) { return } working.value = true; try { if (await add(p.Id, picked[p.Id] || 0, 1)) { done[p.Id] = true } } finally { working.value = false } }
async function addAll() {
  if (working.value) { return }
  if (!chosen.value.length) { note.value = w('Choisissez au moins une taille.'); return }
  working.value = true; note.value = ''
  try { for (const p of chosen.value) { if (await add(p.Id, picked[p.Id] || 0, 1)) { done[p.Id] = true } } show('cart') } finally { working.value = false }
}
</script>

<template>
  <article class="sf-shoplook">
    <div class="sf-shoplook-photos">
      <img v-for="(src, i) in look.Product.Images.slice(0, 4)" :key="src" :src="src" :srcset="look.Product.ImageSets?.[i] || undefined" sizes="(max-width: 900px) 100vw, 50vw" :alt="i === 0 ? look.Product.Name : ''" :loading="i === 0 ? 'eager' : 'lazy'" decoding="async">
      <span v-if="!look.Product.Images.length" class="sf-card-empty" aria-hidden="true" />
    </div>
    <div class="sf-shoplook-side">
      <p class="sf-shoplook-kicker">{{ w('Shop the look') }}</p>
      <h1 class="sf-h">{{ look.Product.Name }}</h1>
      <ul class="sf-shoplook-list">
        <li v-for="p in pieces" :key="p.Id" :class="{ 'is-done': done[p.Id] }">
          <a :href="p.Url" class="sf-shoplook-pic"><img v-if="p.Images[0]" :src="p.Images[0]" alt="" loading="lazy" decoding="async"><span v-else class="sf-card-empty" aria-hidden="true" /></a>
          <div class="sf-shoplook-info">
            <a :href="p.Url" class="sf-shoplook-name">{{ p.Name }}</a>
            <div class="sf-shoplook-price"><SfPrice :product="p" /></div>
            <template v-if="buyable(p)">
              <div v-if="sizes(p).length" class="sf-sizes" role="group" :aria-label="w('Taille')">
                <button v-for="v in sizes(p)" :key="v.Id" type="button" :class="{ 'is-on': picked[p.Id] === v.Id }" :disabled="!v.Available" :aria-pressed="picked[p.Id] === v.Id" @click="picked[p.Id] = picked[p.Id] === v.Id ? 0 : v.Id">{{ v.Label }}</button>
              </div>
              <button type="button" class="sf-link" :disabled="!ready(p) || working" @click="addOne(p)">{{ w(done[p.Id] ? 'Ajouté au panier' : 'Ajouter cette pièce') }}</button>
            </template>
            <p v-else class="sf-muted">{{ w('Épuisé') }}</p>
          </div>
        </li>
      </ul>
      <button type="button" class="sf-btn is-solid sf-shoplook-all" :disabled="working || busy" @click="addAll">{{ w(working ? 'Ajout…' : 'Ajouter le look au panier') }}<template v-if="chosen.length"> · {{ money(total, look.Product.Currency, lang) }}</template></button>
      <p v-if="note" class="sf-form-error" role="alert">{{ note }}</p>
      <p v-else class="sf-muted sf-shoplook-hint">{{ w('Seules les pièces dont la taille est choisie sont ajoutées.') }}</p>
    </div>
  </article>
</template>
