<script setup lang="ts">
// One block of the product page (its name, its price, its sizes, the buy button, its description...), drawn for the product the visitor looks at. The order and the look of the blocks are the shop's,
// set in the site builder.
const props = defineProps<{ block: any }>()
const site = inject<Ref<any>>('sfSite')!
const product = inject<Ref<any>>('sfProduct')!
const s = computed(() => props.block.Settings || {})
const t = computed(() => props.block.Texts || {})
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
// the size the visitor picked: shared by the blocks of the page (the sizes block sets it, the buy button reads it)
const picked = useState<number>('sf-variant-' + (product.value?.Id || 0), () => 0)
const sizes = computed(() => (product.value?.Variants || []).filter((v: any) => v.Label))
const chosen = computed(() => sizes.value.find((v: any) => v.Id === picked.value) || null)
const needsChoice = computed(() => sizes.value.length > 0 && !chosen.value)
// the buy button: a product sold by size needs its size first
const { add, busy: cartBusy, error: cartError, show: showPanel } = useCart()
// a professional site: no buying without an activated professional account, and sizes are bought by lot
const locked = computed(() => (product.value?.PriceState || 'ok') !== 'ok')
const lotOpen = ref(false), proOpen = ref(false)
const { isFavorite, toggleFavorite, customer } = useAccount()
const ask = ref(false)
watch(picked, () => { ask.value = false })
async function buy() {
  if (product.value.TaxExcl && sizes.value.length > 0) { lotOpen.value = true; return }
  if (needsChoice.value) { ask.value = true; return }
  await add(product.value.Id, chosen.value ? chosen.value.Id : 0, 1)
}
const guideOpen = ref(false), reserveOpen = ref(false), reviewOpen = ref(false)
const w = useWords()
// the points a purchase earns and the reviews of the product: asked once for the page, only when one of these blocks is drawn
const extra = ref<any>(null)
if (['p_points', 'p_reviews', 'p_stock'].includes(props.block.Type) || (props.block.Type === 'p_title' && props.block.Settings?.ShowBrand !== false) || (props.block.Type === 'p_sizeguide' && (props.block.Settings?.Guides || []).length > 0) && product.value?.Id) {
  const { data } = await useFetch<any>('/api/storefront/product-extra', { query: { id: product.value.Id, amount: product.value.PriceState === 'ok' ? product.value.Price : 0 }, key: 'sf-extra-' + product.value.Id, server: true })
  extra.value = data.value
}
// the size guide of the product: the one chosen for its most specific category (main category first, then its other categories and their parents), else the page of the block
const guidePage = computed(() => {
  const rules = (s.value.Guides || []) as { IdCategory: number, IdPage: number }[]
  for (const id of extra.value?.Categories || []) { const rule = rules.find(r => Number(r.IdCategory) === Number(id)); if (rule && Number(rule.IdPage) > 0) { return Number(rule.IdPage) } }
  return Number(s.value.IdPage) || 0
})
const earn = computed(() => (extra.value?.Points?.Active ? Number(extra.value.Points.Earn) || 0 : 0))
const stars = (n: number) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n))
</script>

<template>
  <template v-if="product">
    <template v-if="block.Type === 'p_title'">
      <nav v-if="s.Breadcrumb" class="sf-crumb" :aria-label="w('Fil d\'Ariane')"><a :href="site?.Route?.Prefix || '/'">{{ w('Accueil') }}</a></nav>
      <a v-if="s.ShowBrand !== false && extra?.Brand" class="sf-brand-link" :href="(site?.Route?.Prefix || '') + '/marque/' + extra.Brand.Slug">{{ extra.Brand.Name }}</a>
      <h1 class="sf-h" :style="{ '--size': (s.Size || 26) + 'px', fontWeight: s.Weight || 600, textTransform: s.Case === 'uppercase' ? 'uppercase' : undefined }">{{ product.Name }}</h1>
    </template>
    <div v-else-if="block.Type === 'p_price'" class="sf-pprice" :style="{ fontSize: (s.Size || 18) + 'px' }">
      <SfPrice :product="product" :compare="!!s.ShowCompare" badge />
    </div>
    <fieldset v-else-if="block.Type === 'p_variants' && sizes.length" class="sf-variants">
      <legend :class="{ 'sf-sr': !s.Labels }">{{ w('Taille') }}</legend>
      <select v-if="s.Style === 'dropdown'" v-model.number="picked" class="sf-select" :aria-label="w('Taille')">
        <option :value="0" disabled>{{ w('Choisir une taille') }}</option>
        <option v-for="variant in sizes" :key="variant.Id" :value="variant.Id" :disabled="!variant.Available">{{ variant.Label }}{{ variant.Available ? '' : ' (' + w('épuisé') + ')' }}</option>
      </select>
      <div v-else class="sf-sizes">
        <button v-for="variant in sizes" :key="variant.Id" type="button" :class="{ 'is-on': picked === variant.Id }" :disabled="!variant.Available" :aria-pressed="picked === variant.Id" :title="variant.Available ? '' : w('Épuisé')" @click="picked = variant.Id">{{ variant.Label }}</button>
      </div>
    </fieldset>
    <template v-else-if="block.Type === 'p_sizeguide' && t.Text">
      <button v-if="guidePage > 0" type="button" class="sf-link sf-guide" aria-haspopup="dialog" @click="guideOpen = true">{{ t.Text }}</button>
      <LazySfPagePanel v-if="guideOpen" :id="guidePage" :title="t.Text" @close="guideOpen = false" />
    </template>
    <div v-else-if="block.Type === 'p_buy'" class="sf-buy" :class="{ 'is-full': s.Full }">
      <button v-if="locked" type="button" class="sf-btn" :class="'is-' + (s.Style || 'solid')" :disabled="product.PriceState === 'pending'" @click="showPanel('account')">{{ w(product.PriceState === 'pending' ? 'Compte en cours de validation' : product.PriceState === 'business' ? 'Prix réservés aux professionnels' : 'Se connecter pour commander') }}</button>
      <button v-else type="button" class="sf-btn" :class="'is-' + (s.Style || 'solid')" :disabled="!product.Available || cartBusy" @click="buy">{{ w(product.Available ? (cartBusy ? 'Ajout…' : (t.Text || 'Ajouter au panier')) : 'Épuisé') }}</button>
      <button type="button" class="sf-heart" :class="{ 'is-on': isFavorite(product.Id) }" :aria-pressed="isFavorite(product.Id)" :aria-label="w(isFavorite(product.Id) ? 'Retirer de mes favoris' : 'Ajouter à mes favoris')" @click="toggleFavorite(product.Id)">{{ isFavorite(product.Id) ? '♥' : '♡' }}</button>
      <button v-if="product.TaxExcl && locked" type="button" class="sf-prohelp" aria-haspopup="dialog" @click="proOpen = true"><strong>{{ w('Nouveau client professionnel ?') }}</strong><span>{{ w('Découvrez les étapes pour commander') }}</span></button>
      <LazySfLot v-if="lotOpen" :product="product" @close="lotOpen = false" />
      <LazySfProSteps v-if="proOpen" @close="proOpen = false" />
      <a v-if="product.LookUrl" :href="product.LookUrl" class="sf-link sf-look-link">{{ w('Shop the look : voir la tenue complète') }}</a>
      <p v-if="ask" class="sf-buy-ask" role="alert">{{ w('Choisissez une taille.') }}</p>
      <p v-else-if="cartError" class="sf-buy-ask" role="alert">{{ w(cartError) }}</p>
    </div>
    <details v-else-if="block.Type === 'p_description' && product.Description" class="sf-acc" :open="s.Display === 'open'">
      <summary>{{ w('Description') }}</summary>
      <!-- eslint-disable-next-line vue/no-v-html : the description of a product is written by the shop in Digipart and comes from its product API -->
      <div class="sf-rte" v-html="product.Description" />
    </details>
    <div v-else-if="block.Type === 'p_stock'" class="sf-stock-wrap">
      <p class="sf-stock">{{ w(product.Available ? 'En stock' : 'Épuisé') }}</p>
      <template v-if="extra?.Reservation?.Stores?.length">
        <button type="button" class="sf-link sf-reserve-open" aria-haspopup="dialog" @click="reserveOpen = true">{{ w('Réserver en boutique') }}</button>
        <LazySfReserve v-if="reserveOpen" :product="product" :stores="extra.Reservation.Stores" :variant="picked" @close="reserveOpen = false" />
      </template>
    </div>
    <LazySfStories v-else-if="block.Type === 'p_stories'" place="product" :product="product.Id" :size="s.Size || 64" :gap="14" />
    <p v-else-if="block.Type === 'p_points' && earn > 0" class="sf-points">{{ w('Gagnez') }} <strong>{{ earn }}</strong> {{ w(earn > 1 ? 'points de fidélité avec cet achat' : 'point de fidélité avec cet achat') }}</p>
    <details v-else-if="block.Type === 'p_reviews'" class="sf-acc sf-reviews">
      <summary>{{ w('Avis clients') }}<template v-if="extra?.Reviews?.Total > 0"> <span class="sf-stars" :aria-label="extra.Reviews.Average + ' / 5'">{{ stars(extra.Reviews.Average) }}</span> <small>{{ extra.Reviews.Average }} ({{ extra.Reviews.Total }})</small></template></summary>
      <p v-if="!(extra?.Reviews?.Total > 0)" class="sf-muted">{{ w('Aucun avis pour le moment.') }}</p>
      <div class="sf-review-give">
        <LazySfReviewForm v-if="reviewOpen" :product="product" @close="reviewOpen = false" />
        <button v-else type="button" class="sf-link" @click="customer && !customer.Guest ? (reviewOpen = true) : showPanel('account')">{{ w('Donner mon avis') }}</button>
      </div>
      <ul v-if="extra?.Reviews?.Items?.length" class="sf-review-list">
        <li v-for="(r, i) in extra.Reviews.Items" :key="i">
          <div><span class="sf-stars" aria-hidden="true">{{ stars(r.Rating) }}</span> <strong>{{ r.Author }}</strong> <small>{{ r.Date }}</small></div>
          <p v-if="r.Comment">{{ r.Comment }}</p>
        </li>
      </ul>
    </details>
    <!-- p_express, p_details: served with the payment -->
  </template>
</template>
