<script setup lang="ts">
// A product in a grid: its photo (the second on hover, or all of them swiped through, as the section says), its name, its price and its discount. On the photo: the heart of the favourites, and the
// sizes that put the product in the cart in one click (shown under the pointer; on a touch screen a « + » opens them). A product that cannot be bought here (prices hidden, sold by lot) has no sizes.
const props = withDefaults(defineProps<{ product: any, images?: string, dots?: boolean, eager?: boolean, quick?: boolean, heart?: boolean, video?: string, count?: number, perRow?: { desk: number, mob: number } }>(), { quick: true, heart: true })   // a boolean that is not given would be false
const site = inject<Ref<any>>('sfSite')!
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
// the photos of the card: what the section chose, or (nothing chosen, « Comme le thème ») the setting of the theme, Produits et images
const theme = computed(() => site.value?.Theme?.Settings || {})
const wanted = computed(() => (!props.images || props.images === 'theme' ? String(theme.value.CardImages || 'hover') : props.images))
const withDots = computed(() => (!props.images || props.images === 'theme' ? theme.value.CardDots !== false : props.dots))   // a boolean prop not given is false: the theme decides when the section chose nothing
const most = computed(() => Math.max(2, Math.min(16, Number(theme.value.CardImagesMax) || 8)))
const mode = computed(() => (wanted.value === 'wide' ? 'wide' : wanted.value === 'row' ? 'row' : wanted.value === 'carousel' && props.product.Images.length > 1 ? 'carousel' : wanted.value === 'hover' && props.product.Images.length > 1 ? 'hover' : 'single'))
// the Vimeo video the shop chose for this card (the staging of the category): played silent, in a loop, over the photo
const film = computed(() => { const found = String(props.video || '').match(/vimeo\.com\/(?:video\/)?(\d{6,12})(?:\/([0-9a-f]{6,20}))?/i); return found ? 'https://player.vimeo.com/video/' + found[1] + '?background=1&autoplay=1&loop=1&muted=1&dnt=1' + (found[2] ? '&h=' + found[2] : '') : '' })
const w = useWords()
const { add, busy } = useCart()
const { isFavorite, toggleFavorite } = useAccount()
const sizes = computed(() => (props.product.Variants || []).filter((v: any) => v.Label))
// one colour only: the choices say the size (« 2(42/44) »), not « COLOUR / 2(42/44) »; several colours keep the full name, which tells them apart
const oneColor = computed(() => sizes.value.length > 0 && new Set(sizes.value.map((v: any) => v.Color || '')).size === 1 && sizes.value.every((v: any) => v.Size && String(v.Label).split(' / ').length <= 2))
const labelOf = (v: any) => (oneColor.value ? v.Size : v.Label)
const buyable = computed(() => props.quick !== false && (props.product.PriceState || 'ok') === 'ok' && !props.product.TaxExcl && props.product.Available !== false)
const open = ref(false), adding = ref(0)
async function quickAdd(variant: number) { if (busy.value) { return } adding.value = variant || -1; try { await add(props.product.Id, variant, 1) } finally { adding.value = 0; open.value = false } }
// the carousel of the photos: a strip that scrolls (swiped on a phone, the trackpad on a computer) with arrows and dots, as the theme sets them (Thème > Produits et images); a photo that cannot
// be read is taken out of the strip
const broken = ref<string[]>([])
const track = ref<HTMLElement | null>(null)
const at = ref(0)
const arrows = computed(() => (['hover', 'always', 'none'].includes(String(theme.value.CardArrows)) ? String(theme.value.CardArrows) : 'hover'))
const arrowLook = computed(() => { const size = Math.max(20, Math.min(48, Number(theme.value.CardArrowSize) || 30)); return { width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.6) + 'px' } })
const dotsStyle = computed(() => (['dots', 'bars', 'counter'].includes(String(theme.value.CardDotsStyle)) ? String(theme.value.CardDotsStyle) : 'dots'))
const onTrack = () => { const el = track.value; if (el && el.clientWidth) { at.value = Math.round(el.scrollLeft / el.clientWidth) } }
const slide = (step: number) => { const el = track.value; if (!el) { return } const n = shown.value.length, to = (at.value + step + n) % n; el.scrollTo({ left: to * el.clientWidth, behavior: 'smooth' }) }
const shown = computed(() => (mode.value === 'row' ? props.product.Images.slice(0, Math.max(2, Math.min(4, props.count || 3))) : mode.value === 'carousel' ? props.product.Images.filter((src: string) => !broken.value.includes(src)).slice(0, most.value) : props.product.Images.slice(0, mode.value === 'hover' ? 2 : 1)))
</script>

<template>
  <article class="sf-card">
    <div class="sf-card-top" :class="{ 'is-open': open }">
    <a :href="product.LookUrl || product.Url" class="sf-card-media" :class="'is-' + mode" :aria-label="product.Name">
      <span v-if="mode === 'carousel' && shown.length" ref="track" class="sf-card-track" @scroll.passive="onTrack">
        <img v-for="(src, index) in shown" :key="src" :src="src" :srcset="product.ImageSets?.[props.product.Images.indexOf(src)] || undefined" :sizes="perRow ? `(max-width: 767px) ${Math.round(100 / perRow.mob)}vw, ${Math.round(100 / perRow.desk)}vw` : '(max-width: 767px) 50vw, (max-width: 1200px) 33vw, 25vw'" :alt="index === 0 ? product.Name : ''" :loading="eager && index === 0 ? 'eager' : 'lazy'" decoding="async" @error="broken = [...broken, src]">
      </span>
      <template v-else-if="shown.length">
        <img v-for="(src, index) in shown" :key="src" :src="src" :srcset="product.ImageSets?.[index] || undefined" :sizes="perRow ? `(max-width: 767px) ${Math.round(100 / perRow.mob)}vw, ${Math.round(100 / perRow.desk)}vw` : '(max-width: 767px) 50vw, (max-width: 1200px) 33vw, 25vw'" :alt="index === 0 ? product.Name : ''" :loading="eager && index === 0 ? 'eager' : 'lazy'" decoding="async">
      </template>
      <span v-else class="sf-card-empty" aria-hidden="true" />
      <span v-if="film" class="sf-hero-video"><iframe :src="film" title="" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" tabindex="-1" aria-hidden="true" /></span>
      <span v-if="product.LookUrl" class="sf-card-look" aria-hidden="true">LOOK</span>
      <span v-if="product.Discount" class="sf-card-badge">-{{ product.Discount }} %</span>
      <span v-if="mode === 'carousel' && withDots && shown.length > 1" class="sf-card-dots" :class="'is-' + dotsStyle" aria-hidden="true"><template v-if="dotsStyle === 'counter'">{{ at + 1 }} / {{ shown.length }}</template><i v-for="(src, index) in shown" v-else :key="index" :class="{ 'is-on': index === at }" /></span>
    </a>
      <template v-if="mode === 'carousel' && shown.length > 1 && arrows !== 'none'">
        <button type="button" class="sf-card-arrow is-prev" :class="['is-' + arrows, 'is-' + (theme.CardArrowShape || 'circle')]" :style="arrowLook" :aria-label="w('Photo précédente')" @click="slide(-1)">‹</button>
        <button type="button" class="sf-card-arrow is-next" :class="['is-' + arrows, 'is-' + (theme.CardArrowShape || 'circle')]" :style="arrowLook" :aria-label="w('Photo suivante')" @click="slide(1)">›</button>
      </template>
      <button v-if="heart !== false" type="button" class="sf-card-heart" :class="{ 'is-on': isFavorite(product.Id) }" :aria-pressed="isFavorite(product.Id)" :aria-label="w(isFavorite(product.Id) ? 'Retirer de mes favoris' : 'Ajouter à mes favoris')" @click="toggleFavorite(product.Id)">{{ isFavorite(product.Id) ? '♥' : '♡' }}</button>
      <template v-if="buyable">
        <button type="button" class="sf-card-plus" :aria-expanded="open" :aria-label="w('Ajouter au panier')" @click="open = !open">+</button>
        <div class="sf-card-quick" role="group" :aria-label="w(sizes.length ? 'Choisir une taille' : 'Ajouter au panier')">
          <template v-if="sizes.length"><button v-for="v in sizes" :key="v.Id" type="button" :disabled="!v.Available || !!adding" :class="{ 'is-busy': adding === v.Id }" :title="v.Available ? w('Ajouter au panier') : w('Épuisé')" @click="quickAdd(v.Id)">{{ labelOf(v) }}</button></template>
          <button v-else type="button" class="is-wide" :disabled="!!adding" @click="quickAdd(0)">{{ w(adding ? 'Ajout…' : 'Ajouter au panier') }}</button>
        </div>
      </template>
    </div>
    <a :href="product.Url" class="sf-card-name">{{ product.Name }}</a>
    <div class="sf-card-price"><SfPrice :product="product" /></div>
  </article>
</template>
