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
// the choices of the block « Tailles et couleurs » (setting « Ce que montre chaque bouton »): « size » (the default) = the buttons say the size alone, with a row above to choose the colour when the product has
// several (a product with one colour shows its sizes alone); « both » = one row « Colour / Size ». « size » needs every choice to have a size and nothing more than a colour and a size in its name; otherwise the full name is used.
// the colours that belong to a colour group of Digipart (with their code), then the colour of a choice: the value of its colour attribute, found by the group of colours first, else by a group named Couleur / Color
const swatches = computed<Record<string, string>>(() => Object.fromEntries((extra.value?.Colors || []).map((c: any) => [c.Name, c.Code])))
const colorOf = (v: any): string => (v.Attributes || []).find((a: any) => a.Name in swatches.value)?.Name || v.Color || ''
const colors = computed(() => [...new Set(sizes.value.map((v: any) => colorOf(v)).filter(Boolean))] as string[])
const split = computed(() => s.value.Choice !== 'both' && sizes.value.length > 0 && sizes.value.every((v: any) => v.Size && (colors.value.length < 2 || colorOf(v)) && String(v.Label).split(' / ').length <= 2))
const pickedColor = useState<string>('sf-color-' + (product.value?.Id || 0), () => '')
// the colour shown: the one chosen, else the one of the size already picked, else the first colour that still has a size to sell
const color = computed(() => {
  if (colors.value.length < 2) { return colors.value[0] || '' }
  if (pickedColor.value && colors.value.includes(pickedColor.value)) { return pickedColor.value }
  const current = sizes.value.find((v: any) => v.Id === picked.value)
  return (current && colorOf(current)) || colorOf(sizes.value.find((v: any) => v.Available && colorOf(v)) || {}) || colors.value[0] || ''
})
const sizeChoices = computed(() => (colors.value.length < 2 ? sizes.value : sizes.value.filter((v: any) => colorOf(v) === color.value)))
// a swatch (a round of the colour) when the shop asks for it and the colour has a code; the name otherwise
const swatchOf = (name: string) => (s.value.ColorStyle !== 'names' && swatches.value[name]) || ''
// another colour: the same size is kept when that colour has it, else the visitor picks again
function chooseColor(name: string) {
  const size = sizes.value.find((v: any) => v.Id === picked.value)?.Size
  pickedColor.value = name
  picked.value = sizes.value.find((v: any) => colorOf(v) === name && v.Size === size && v.Available)?.Id || 0
}
const buyLook = computed(() => buttonLook(s.value))   // the look the shop gave to the buy button (shared with every button: app/utils/buttonLook.ts)
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
// an e-gift card: whom it is for, what it says and when it is sent (sent with the line of the cart; Digipart makes the card)
const isGift = computed(() => product.value?.Type === 'e-giftcard')
const gift = reactive({ Personal: props.block.Settings?.GiftPersonal !== false, Email: '', MobilePhone: '', Firstname: '', Lastname: '', Message: '', DateSend: '' })
const today = new Date().toISOString().slice(0, 10)
const giftError = ref('')
async function buy() {
  if (product.value.TaxExcl && sizes.value.length > 0) { lotOpen.value = true; return }
  if (needsChoice.value) { ask.value = true; return }
  if (isGift.value) {
    giftError.value = gift.Personal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gift.Email.trim()) ? w('Indiquez l\'adresse e-mail du destinataire.') : ''
    if (giftError.value) { return }
    await add(product.value.Id, chosen.value ? chosen.value.Id : (sizes.value[0]?.Id || 0), 1, { ...gift, DateSend: gift.DateSend || today })
    return
  }
  await add(product.value.Id, chosen.value ? chosen.value.Id : 0, 1)
}
// the loyalty programme: its card opens a panel that presents it
const loyaltyOpen = ref(false)
const steps = computed(() => String(t.value.Steps || '').split('\n').map(x => x.trim()).filter(Boolean))
// the reassurance lines: up to four, each an icon, a title, a text and maybe a link
const reassurance = computed(() => [1, 2, 3, 4].map(n => ({ n, icon: s.value['Icon' + n], title: t.value['Title' + n], text: t.value['Text' + n], url: s.value['Url' + n] })).filter(x => x.title))
const guideOpen = ref(false), storesOpen = ref(false), reviewOpen = ref(false), alertOpen = ref(false), pageOpen = ref(false), descOpen = ref(false)
// « Retour »: the page the visitor came from (the list they were looking at), else the home page
const goBack = () => { if (window.history.length > 1) { window.history.back() } else { window.location.href = site.value?.Route?.Prefix || '/' } }
// « M'avertir du retour en stock » when nothing is left (the sold-out sizes it can be asked for)
const alertSizes = computed(() => (product.value?.Variants || []).filter((v: any) => v.Label && !v.Available))
// stock alert on: a sold-out size can be picked and opens the alert panel
const alertOn = computed(() => site.value?.Theme?.Settings?.StockAlert !== false && !locked.value)
const alertFor = ref<number | null>(null)
const soldOutChosen = computed(() => !!chosen.value && !chosen.value.Available && alertOn.value)
function pickSize(variant: any) {
  if (!variant) { return }
  picked.value = variant.Id
  if (!variant.Available && alertOn.value) { alertFor.value = variant.Id }
}
const pickSizeId = (id: number) => pickSize(sizes.value.find((v: any) => v.Id === id))
const w = useWords()
// the points a purchase earns and the reviews of the product: asked once for the page, only when one of these blocks is drawn
const extra = ref<any>(null)
if (['p_points', 'p_reviews', 'p_stock', 'p_variants'].includes(props.block.Type) || (props.block.Type === 'p_title' && props.block.Settings?.ShowBrand !== false) || (props.block.Type === 'p_sizeguide' && (props.block.Settings?.Guides || []).length > 0) && product.value?.Id) {
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
      <button v-if="s.Back" type="button" class="sf-back" @click="goBack">{{ t.BackText || '‹' }}</button>
      <nav v-if="s.Breadcrumb" class="sf-crumb" :aria-label="w('Fil d\'Ariane')"><a :href="site?.Route?.Prefix || '/'">{{ w('Accueil') }}</a></nav>
      <a v-if="s.ShowBrand !== false && extra?.Brand" class="sf-brand-link" :href="(site?.Route?.Prefix || '') + '/marque/' + extra.Brand.Slug">{{ extra.Brand.Name }}</a>
      <h1 class="sf-h" :style="{ '--size': (s.Size || 26) + 'px', fontWeight: s.Weight || 600, textTransform: s.Case === 'uppercase' ? 'uppercase' : undefined }">{{ product.Name }}</h1>
    </template>
    <div v-else-if="block.Type === 'p_price'" class="sf-pprice" :style="{ fontSize: (s.Size || 18) + 'px' }">
      <SfPrice :product="product" :compare="!!s.ShowCompare" badge />
      <p v-if="s.ShowReference && product.Reference" class="sf-ref">{{ w('Réf.') }} {{ product.Reference }}</p>
    </div>
    <!-- an e-gift card: its amounts are the cards tied to it, each its own page -->
    <div v-else-if="block.Type === 'p_variants' && product.GiftAmounts?.length" class="sf-gift-amounts" role="group" :aria-label="w('Montant')">
      <a v-for="a in product.GiftAmounts" :key="a.Id" :href="a.Url" :class="{ 'is-on': a.Current }" :aria-current="a.Current ? 'page' : undefined">{{ a.Label }}</a>
    </div>
    <fieldset v-else-if="block.Type === 'p_variants' && sizes.length" class="sf-variants" :class="{ 'is-split': split }">
      <template v-if="split">
        <div v-if="colors.length > 1" class="sf-vgroup" role="group" :aria-label="w('Couleur')">
          <div class="sf-vlegend" :class="{ 'sf-sr': !s.Labels }">{{ w('Couleur') }}<span v-if="color"> : {{ color }}</span></div>
          <select v-if="s.Style === 'dropdown'" :value="color" class="sf-select" :aria-label="w('Couleur')" @change="chooseColor(($event.target as HTMLSelectElement).value)"><option v-for="name in colors" :key="name" :value="name">{{ name }}</option></select>
          <div v-else class="sf-sizes"><button v-for="name in colors" :key="name" type="button" :class="{ 'is-on': color === name, 'sf-swatch': !!swatchOf(name) }" :style="swatchOf(name) ? { '--sw': swatchOf(name) } : undefined" :title="name" :aria-label="name" :aria-pressed="color === name" @click="chooseColor(name)"><template v-if="!swatchOf(name)">{{ name }}</template></button></div>
        </div>
        <div class="sf-vgroup" role="group" :aria-label="w('Taille')">
          <div class="sf-vlegend" :class="{ 'sf-sr': !s.Labels }">{{ w('Taille') }}</div>
          <select v-if="s.Style === 'dropdown'" :value="picked" class="sf-select" :aria-label="w('Taille')" @change="pickSizeId(Number(($event.target as HTMLSelectElement).value))">
            <option :value="0" disabled>{{ w('Choisir une taille') }}</option>
            <option v-for="variant in sizeChoices" :key="variant.Id" :value="variant.Id" :disabled="!variant.Available && !alertOn">{{ variant.Size }}{{ variant.Available ? '' : ' (' + w('épuisé') + ')' }}</option>
          </select>
          <div v-else class="sf-sizes">
            <button v-for="variant in sizeChoices" :key="variant.Id" type="button" :class="{ 'is-on': picked === variant.Id, 'is-out': !variant.Available }" :disabled="!variant.Available && !alertOn" :aria-pressed="picked === variant.Id" :title="variant.Available ? '' : w(alertOn ? 'M\'avertir du retour en stock' : 'Épuisé')" @click="pickSize(variant)">{{ variant.Size }}<span v-if="!variant.Available" class="sf-sr"> ({{ w('Épuisé') }})</span></button>
          </div>
        </div>
      </template>
      <template v-else>
        <legend :class="{ 'sf-sr': !s.Labels }">{{ w('Taille') }}</legend>
        <select v-if="s.Style === 'dropdown'" :value="picked" class="sf-select" :aria-label="w('Taille')" @change="pickSizeId(Number(($event.target as HTMLSelectElement).value))">
          <option :value="0" disabled>{{ w('Choisir une taille') }}</option>
          <option v-for="variant in sizes" :key="variant.Id" :value="variant.Id" :disabled="!variant.Available && !alertOn">{{ variant.Label }}{{ variant.Available ? '' : ' (' + w('épuisé') + ')' }}</option>
        </select>
        <div v-else class="sf-sizes">
          <button v-for="variant in sizes" :key="variant.Id" type="button" :class="{ 'is-on': picked === variant.Id, 'is-out': !variant.Available }" :disabled="!variant.Available && !alertOn" :aria-pressed="picked === variant.Id" :title="variant.Available ? '' : w(alertOn ? 'M\'avertir du retour en stock' : 'Épuisé')" @click="pickSize(variant)">{{ variant.Label }}<span v-if="!variant.Available" class="sf-sr"> ({{ w('Épuisé') }})</span></button>
        </div>
      </template>
    </fieldset>
    <LazySfStockAlert v-if="alertFor !== null" :product="product" :variant="alertFor" @close="alertFor = null" />
    <template v-else-if="block.Type === 'p_sizeguide' && t.Text">
      <button v-if="guidePage > 0" type="button" class="sf-link sf-guide" aria-haspopup="dialog" @click="guideOpen = true">{{ t.Text }}</button>
      <LazySfPagePanel v-if="guideOpen" :id="guidePage" :title="t.Text" @close="guideOpen = false" />
    </template>
    <div v-else-if="block.Type === 'p_buy'" class="sf-buy" :class="{ 'is-full': s.Full, 'is-gift': isGift }">
      <div v-if="isGift && !locked" class="sf-gift">
        <label class="sf-gift-check"><input v-model="gift.Personal" type="checkbox">{{ w('Je souhaite personnaliser ma carte cadeau avant de l\'envoyer') }}</label>
        <template v-if="gift.Personal">
          <label><span>{{ w('E-mail du destinataire') }} *</span><input v-model="gift.Email" type="email" autocomplete="off" maxlength="150" required></label>
          <label v-if="s.GiftPhone !== false"><span>{{ w('Téléphone mobile') }}</span><input v-model="gift.MobilePhone" type="tel" autocomplete="off" maxlength="25"></label>
          <div class="sf-gift-row">
            <label><span>{{ w('Prénom') }}</span><input v-model="gift.Firstname" type="text" autocomplete="off" maxlength="80"></label>
            <label><span>{{ w('Nom') }}</span><input v-model="gift.Lastname" type="text" autocomplete="off" maxlength="80"></label>
          </div>
          <label><span>{{ w('Message') }}</span><textarea v-model="gift.Message" rows="3" maxlength="300" /><small class="sf-gift-count">{{ gift.Message.length }}/300</small></label>
          <label v-if="s.GiftDate !== false"><span>{{ w('Envoyer le') }}</span><input v-model="gift.DateSend" type="date" :min="today"></label>
        </template>
        <p v-if="giftError" class="sf-form-error" role="alert">{{ giftError }}</p>
      </div>
      <a v-if="s.LookButton && product.LookUrl" :href="product.LookUrl" class="sf-btn is-outline sf-look-btn" :style="{ fontSize: buyLook.style?.fontSize, letterSpacing: buyLook.style?.letterSpacing, textTransform: buyLook.style?.textTransform }">{{ w('Look') }}</a>
      <button v-if="locked" type="button" class="sf-btn" :class="buyLook.class" :style="buyLook.style" :disabled="product.PriceState === 'pending'" @click="showPanel('account')">{{ w(product.PriceState === 'pending' ? 'Compte en cours de validation' : product.PriceState === 'business' ? 'Prix réservés aux professionnels' : 'Se connecter pour commander') }}</button>
      <button v-else-if="soldOutChosen || (!product.Available && alertSizes.length && site?.Theme?.Settings?.StockAlert !== false)" type="button" class="sf-btn" :class="buyLook.class" :style="buyLook.style" @click="alertOpen = true">{{ w('M\'avertir du retour en stock') }}</button>
      <button v-else type="button" class="sf-btn" :class="buyLook.class" :style="buyLook.style" :disabled="!product.Available || cartBusy" @click="buy">{{ w(product.Available ? (cartBusy ? 'Ajout…' : (t.Text || 'Ajouter au panier')) : 'Épuisé') }}</button>
      <LazySfStockAlert v-if="alertOpen" :product="product" :variant="soldOutChosen ? picked : undefined" @close="alertOpen = false" />
      <button type="button" class="sf-heart" :class="{ 'is-on': isFavorite(product.Id) }" :aria-pressed="isFavorite(product.Id)" :aria-label="w(isFavorite(product.Id) ? 'Retirer de mes favoris' : 'Ajouter à mes favoris')" @click="toggleFavorite(product.Id)"><svg viewBox="0 0 24 24" width="20" height="20" :fill="isFavorite(product.Id) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.3 4.6 13a4.7 4.7 0 0 1 0-6.7 4.8 4.8 0 0 1 6.8 0l.6.6.6-.6a4.8 4.8 0 0 1 6.8 0 4.7 4.7 0 0 1 0 6.7z"/></svg></button>
      <button v-if="product.TaxExcl && locked" type="button" class="sf-prohelp" aria-haspopup="dialog" @click="proOpen = true"><strong>{{ w('Nouveau client professionnel ?') }}</strong><span>{{ w('Découvrez les étapes pour commander') }}</span></button>
      <LazySfLot v-if="lotOpen" :product="product" @close="lotOpen = false" />
      <LazySfProSteps v-if="proOpen" @close="proOpen = false" />
      <a v-if="product.LookUrl && !s.LookButton" :href="product.LookUrl" class="sf-link sf-look-link">{{ w('Shop the look : voir la tenue complète') }}</a>
      <p v-if="ask" class="sf-buy-ask" role="alert">{{ w('Choisissez une taille.') }}</p>
      <p v-else-if="cartError" class="sf-buy-ask" role="alert">{{ w(cartError) }}</p>
    </div>
    <!-- the description as plain text (no heading), or as a link that opens it in a side panel -->
    <!-- eslint-disable-next-line vue/no-v-html : the description of a product is written by the shop in Digipart and comes from its product API -->
    <div v-else-if="block.Type === 'p_description' && product.Description && s.Display === 'plain'" class="sf-rte sf-pdesc" v-html="product.Description" />
    <template v-else-if="block.Type === 'p_description' && product.Description && s.Display === 'panel'">
      <button type="button" class="sf-plink" aria-haspopup="dialog" @click="descOpen = true">{{ w('Description') }}</button>
      <Teleport to="body">
        <div v-if="descOpen" class="sf-drawer" @keydown.esc="descOpen = false">
          <div class="sf-drawer-veil" @click="descOpen = false" />
          <aside class="sf-drawer-panel sf-pagepanel" role="dialog" aria-modal="true" :aria-label="w('Description')">
            <header class="sf-drawer-head"><h2>{{ w('Description') }}</h2><button type="button" :aria-label="w('Fermer')" @click="descOpen = false">✕</button></header>
            <!-- eslint-disable-next-line vue/no-v-html : the description of a product is written by the shop in Digipart and comes from its product API -->
            <div class="sf-drawer-body"><div class="sf-rte" v-html="product.Description" /></div>
          </aside>
        </div>
      </Teleport>
    </template>
    <!-- a link to a page of the shop (delivery, returns, care…), opened in a side panel without leaving the product -->
    <template v-else-if="block.Type === 'p_page' && t.Text && Number(s.IdPage) > 0">
      <button type="button" class="sf-plink" aria-haspopup="dialog" @click="pageOpen = true">{{ t.Text }}</button>
      <LazySfPagePanel v-if="pageOpen" :id="Number(s.IdPage)" :title="t.Text" @close="pageOpen = false" />
    </template>
    <details v-else-if="block.Type === 'p_description' && product.Description" class="sf-acc" :open="s.Display === 'open'">
      <summary>{{ w('Description') }}</summary>
      <!-- eslint-disable-next-line vue/no-v-html : the description of a product is written by the shop in Digipart and comes from its product API -->
      <div class="sf-rte" v-html="product.Description" />
    </details>
    <!-- the shops: where the size is in stock, and (when the shop allows it) a reservation, in a side panel step by step (SfStoreStock.vue) -->
    <div v-else-if="block.Type === 'p_stock'" class="sf-stock-wrap">
      <p v-if="s.ShowOnline !== false" class="sf-stock"><i :class="product.Available ? 'is-in' : 'is-out'" aria-hidden="true" />{{ w(product.Available ? 'En stock en ligne' : 'Épuisé en ligne') }}</p>
      <button v-if="extra?.Reservation?.Stores?.length" type="button" :class="s.Look === 'link' ? 'sf-plink' : 'sf-btn is-outline sf-stock-btn'" aria-haspopup="dialog" @click="storesOpen = true">{{ t.Text || w(s.Reserve !== false ? 'Disponibilité et réservation en boutique' : 'Vérifier la disponibilité en boutique') }}</button>
      <LazySfStoreStock v-if="storesOpen" :product="product" :variant="picked" :reserve="s.Reserve !== false" @close="storesOpen = false" />
    </div>
    <LazySfStories v-else-if="block.Type === 'p_stories'" place="product" :product="product.Id" :size="s.Size || 64" :gap="14" />
    <template v-else-if="block.Type === 'p_points' && earn > 0">
      <p v-if="s.Look === 'line'" class="sf-points">{{ w('Gagnez') }} <strong>{{ earn }}</strong> {{ w(earn > 1 ? 'points de fidélité avec cet achat' : 'point de fidélité avec cet achat') }}</p>
      <button v-else type="button" class="sf-loyalty-card" aria-haspopup="dialog" @click="loyaltyOpen = true">
        <img v-if="s.Logo" :src="s.Logo" alt="" class="sf-loyalty-logo">
        <span class="sf-loyalty-text"><b>{{ t.Title || w('Le programme de fidélité') }}</b><span>{{ w('Gagnez') }} <em>{{ earn }} pts</em> {{ w('de fidélité avec cet achat') }}</span></span>
        <span class="sf-loyalty-go" aria-hidden="true">›</span>
      </button>
      <Teleport to="body">
        <div v-if="loyaltyOpen" class="sf-drawer" @keydown.esc="loyaltyOpen = false">
          <div class="sf-drawer-veil" @click="loyaltyOpen = false" />
          <aside class="sf-drawer-panel sf-loyalty" role="dialog" aria-modal="true" :aria-label="t.Title || w('Le programme de fidélité')">
            <header class="sf-drawer-head"><h2>{{ t.Title || w('Le programme de fidélité') }}</h2><button type="button" :aria-label="w('Fermer')" @click="loyaltyOpen = false">✕</button></header>
            <div class="sf-drawer-body">
              <p v-if="t.Intro" class="sf-loyalty-intro">{{ t.Intro }}</p>
              <p class="sf-loyalty-earn"><em>{{ earn }} pts</em> {{ w('de fidélité gagnés avec cet achat') }}</p>
              <template v-if="steps.length"><h3>{{ w('Comment ça marche ?') }}</h3><ol class="sf-loyalty-steps"><li v-for="(step, i) in steps" :key="i">{{ step }}</li></ol></template>
            </div>
            <footer class="sf-drawer-foot"><a v-if="s.MoreUrl" :href="s.MoreUrl" class="sf-btn">{{ t.MoreText || w('En savoir plus') }}</a><button type="button" class="sf-btn is-outline" @click="loyaltyOpen = false">{{ w('Fermer') }}</button></footer>
          </aside>
        </div>
      </Teleport>
    </template>
    <!-- reassurance: delivery, returns, payment… as the shop wrote them -->
    <div v-else-if="block.Type === 'p_reassurance' && reassurance.length" class="sf-reassure" :class="{ 'is-framed': s.Framed !== false }" :style="{ '--n': reassurance.length }">
      <component :is="r.url ? 'a' : 'div'" v-for="r in reassurance" :key="r.n" :href="r.url || undefined" class="sf-reassure-item">
        <SfIcon v-if="r.icon" :name="r.icon" :size="s.IconSize || 22" />
        <b>{{ r.title }}</b><span v-if="r.text">{{ r.text }}</span>
      </component>
    </div>
    <details v-else-if="block.Type === 'p_reviews'" class="sf-acc sf-reviews">
      <summary>{{ w('Avis clients') }}<template v-if="extra?.Reviews?.Total > 0"> <span class="sf-stars" :aria-label="extra.Reviews.Average + ' / 5'">{{ stars(extra.Reviews.Average) }}</span> <small>{{ extra.Reviews.Average }} ({{ extra.Reviews.Total }})</small></template></summary>
      <p v-if="!(extra?.Reviews?.Total > 0)" class="sf-muted">{{ w('Aucun avis pour le moment.') }}</p>
      <div class="sf-review-give">
        <LazySfReviewForm v-if="reviewOpen" :product="product" @close="reviewOpen = false" />
        <button v-else type="button" class="sf-btn is-outline sf-review-btn" @click="customer && !customer.Guest ? (reviewOpen = true) : showPanel('account')"><span aria-hidden="true">★</span> {{ w('Donner mon avis') }}</button>
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
