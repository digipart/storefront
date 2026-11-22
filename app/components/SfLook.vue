<script setup lang="ts">
// « Shop the look »: the photos of a product on one side, and on the other the product and the pieces the shop associated with it, each with its size. One button puts every piece whose size is
// chosen in the cart; each piece can also be added alone. Nothing is added without a size when the piece is sold by size. Drawn as the shop set it in the site builder (page « Shop the look »,
// section of the same name: the photos, the pieces, a sold-out piece, the button); without that page published, with the usual settings.
const props = defineProps<{ look: { Product: any, Pieces: any[] }, settings?: any, texts?: any }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const { add, busy, show } = useCart()
const { isFavorite, toggleFavorite } = useAccount()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const s = computed(() => props.settings || {})
const t = computed(() => props.texts || {})
const soldOutMode = computed(() => (['alert', 'show', 'hide'].includes(String(s.value.SoldOut)) ? String(s.value.SoldOut) : 'alert'))
const buyable = (p: any) => (p.PriceState || 'ok') === 'ok' && !p.TaxExcl && p.Available !== false
const pieces = computed(() => [props.look.Product, ...props.look.Pieces].filter((p: any) => soldOutMode.value !== 'hide' || buyable(p) || p === props.look.Product))
const sizes = (p: any) => (p.Variants || []).filter((v: any) => v.Label)
// one colour only: the size alone (« 2(42/44) »), not « Beige / 2(42/44) »
const sizeName = (p: any, v: any) => (new Set(sizes(p).map((x: any) => x.Color || '')).size <= 1 && v.Size ? v.Size : v.Label)
const picked = reactive<Record<number, number>>({})
const done = reactive<Record<number, boolean>>({})
const ready = (p: any) => buyable(p) && (!sizes(p).length || !!picked[p.Id])
const chosen = computed(() => pieces.value.filter(ready))
const total = computed(() => chosen.value.reduce((sum: number, p: any) => sum + Number(p.Price || 0), 0))
const working = ref(false), note = ref('')
// a sold-out piece: « M'avertir du retour en stock » (when the theme has it)
const alertOn = computed(() => site.value?.Theme?.Settings?.StockAlert !== false && soldOutMode.value === 'alert')
const alertFor = ref<any>(null)
const editorial = computed(() => s.value.Arrangement === 'editorial')
// « Autres photos… » of the site builder: the photos of the product of the look (éditoriale) and of each piece are gone through in their frame (SfReel) instead of one photo alone
const reelOf = (value: any) => (['side', 'down', 'arrows'].includes(String(value)) ? String(value) : '')
const mainReel = computed(() => (editorial.value ? reelOf(s.value.PhotoScroll) : ''))
const pieceReel = computed(() => reelOf(s.value.PiecePhotos))
const photos = computed(() => (props.look.Product.Images || []).slice(0, editorial.value ? 2 : Math.max(1, Math.min(8, Number(s.value.PhotoCount) || 4))))
const titleCss = computed(() => ({ fontSize: Math.max(18, Math.min(72, Number(s.value.TitleSize) || 28)) + 'px', textTransform: s.value.TitleCase === 'uppercase' ? 'uppercase' as const : undefined }))
const layout = computed(() => ({
  '--pw': Math.max(35, Math.min(65, Number(s.value.PhotoWidth) || 50)) + '%', '--thumb': Math.max(64, Math.min(160, Number(s.value.ThumbSize) || 96)) + 'px',
}))
const buttonOf = computed(() => buttonLook(s.value, 'Button'))
async function addOne(p: any) { if (!ready(p) || working.value) { return } working.value = true; try { if (await add(p.Id, picked[p.Id] || 0, 1)) { done[p.Id] = true } } finally { working.value = false } }
async function addAll() {
  if (working.value) { return }
  if (!chosen.value.length) { note.value = w('Choisissez au moins une taille.'); return }
  working.value = true; note.value = ''
  try { for (const p of chosen.value) { if (await add(p.Id, picked[p.Id] || 0, 1)) { done[p.Id] = true } } show('cart') } finally { working.value = false }
}
</script>

<template>
  <article class="sf-shoplook" :class="{ 'is-editorial': editorial, 'is-cards': s.PieceStyle === 'cards' }" :style="layout">
    <!-- éditoriale: the title and the second photo, then the first photo large -->
    <div v-if="editorial" class="sf-shoplook-intro">
      <p v-if="t.Kicker !== ''" class="sf-shoplook-kicker">{{ t.Kicker || w('Shop the look') }}</p>
      <h1 class="sf-h sf-shoplook-title" :style="titleCss">{{ look.Product.Name }}</h1>
      <img v-if="photos[1]" :src="photos[1]" :srcset="look.Product.ImageSets?.[1] || undefined" sizes="(max-width: 900px) 100vw, 25vw" alt="" loading="lazy" decoding="async">
    </div>
    <div v-if="mainReel && (look.Product.Images || []).length > 1" class="sf-shoplook-photos is-reel">
      <SfReel :images="(look.Product.Images || []).slice(0, 8)" :sets="look.Product.ImageSets" sizes="(max-width: 900px) 100vw, 40vw" :mode="mainReel" :alt="look.Product.Name" eager />
    </div>
    <div v-else class="sf-shoplook-photos" :class="'is-' + (editorial ? 'single' : (s.PhotoLayout || 'stack'))">
      <img v-for="(src, i) in (editorial ? photos.slice(0, 1) : photos)" :key="src" :src="src" :srcset="look.Product.ImageSets?.[i] || undefined" :sizes="s.PhotoLayout === 'grid' && !editorial ? '(max-width: 900px) 50vw, 25vw' : '(max-width: 900px) 100vw, 50vw'" :alt="i === 0 ? look.Product.Name : ''" :loading="i === 0 ? 'eager' : 'lazy'" decoding="async">
      <span v-if="!photos.length" class="sf-card-empty" aria-hidden="true" />
    </div>
    <div class="sf-shoplook-side" :class="{ 'is-static': s.Sticky === false }">
      <template v-if="!editorial">
        <p v-if="t.Kicker !== ''" class="sf-shoplook-kicker">{{ t.Kicker || w('Shop the look') }}</p>
        <h1 class="sf-h sf-shoplook-title" :style="titleCss">{{ look.Product.Name }}</h1>
      </template>
      <ul class="sf-shoplook-list">
        <li v-for="p in pieces" :key="p.Id" :class="{ 'is-done': done[p.Id], 'is-out': !buyable(p) }">
          <div v-if="pieceReel && (p.Images || []).length > 1" class="sf-shoplook-pic"><SfReel :images="p.Images.slice(0, 6)" :mode="pieceReel" :href="p.Url" /></div>
          <a v-else :href="p.Url" class="sf-shoplook-pic"><img v-if="p.Images[0]" :src="p.Images[0]" alt="" loading="lazy" decoding="async"><span v-else class="sf-card-empty" aria-hidden="true" /></a>
          <div class="sf-shoplook-info">
            <div class="sf-shoplook-head">
              <a :href="p.Url" class="sf-shoplook-name">{{ p.Name }}</a>
              <button v-if="s.PieceHeart" type="button" class="sf-shoplook-heart" :aria-pressed="isFavorite(p.Id)" :aria-label="w(isFavorite(p.Id) ? 'Retirer de mes favoris' : 'Ajouter à mes favoris')" @click="toggleFavorite(p.Id)"><svg viewBox="0 0 24 24" width="18" height="18" :fill="isFavorite(p.Id) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.3 4.6 13a4.7 4.7 0 0 1 0-6.7 4.8 4.8 0 0 1 6.8 0l.6.6.6-.6a4.8 4.8 0 0 1 6.8 0 4.7 4.7 0 0 1 0 6.7z" /></svg></button>
            </div>
            <div class="sf-shoplook-price"><SfPrice :product="p" /></div>
            <a v-if="s.PieceLink" :href="p.Url" class="sf-shoplook-more">{{ w('Voir plus') }}</a>
            <template v-if="buyable(p)">
              <div v-if="sizes(p).length" class="sf-sizes" role="group" :aria-label="w('Taille')">
                <button v-for="v in sizes(p)" :key="v.Id" type="button" :class="{ 'is-on': picked[p.Id] === v.Id }" :disabled="!v.Available" :aria-pressed="picked[p.Id] === v.Id" @click="picked[p.Id] = picked[p.Id] === v.Id ? 0 : v.Id">{{ sizeName(p, v) }}</button>
              </div>
              <button v-if="s.PieceButton !== false" type="button" class="sf-btn is-outline sf-shoplook-one" :disabled="!ready(p) || working" @click="addOne(p)">{{ w(done[p.Id] ? 'Ajouté au panier' : 'Ajouter cette pièce') }}</button>
            </template>
            <template v-else>
              <div v-if="soldOutMode === 'alert' && sizes(p).length" class="sf-sizes is-out" :aria-label="w('Épuisé')"><span v-for="v in sizes(p)" :key="v.Id">{{ sizeName(p, v) }}</span></div>
              <p class="sf-muted sf-shoplook-out">{{ w('Épuisé') }}<button v-if="alertOn && sizes(p).length" type="button" class="sf-link" @click="alertFor = p">{{ w('M\'avertir du retour en stock') }}</button></p>
            </template>
          </div>
        </li>
      </ul>
      <button type="button" class="sf-btn sf-shoplook-all" :class="buttonOf.class" :style="buttonOf.style" :disabled="working || busy" @click="addAll">{{ working ? w('Ajout…') : (t.ButtonText || w('Ajouter le look au panier')) }}<template v-if="chosen.length && s.ShowTotal !== false"> · {{ money(total, look.Product.Currency, lang) }}</template></button>
      <p v-if="note" class="sf-form-error" role="alert">{{ note }}</p>
      <p v-else-if="t.Hint !== ''" class="sf-muted sf-shoplook-hint">{{ t.Hint || w('Seules les pièces dont la taille est choisie sont ajoutées.') }}</p>
    </div>
    <LazySfStockAlert v-if="alertFor" :product="alertFor" @close="alertFor = null" />
  </article>
</template>
