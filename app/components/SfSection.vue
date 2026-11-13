<script setup lang="ts">
// One section of a page, drawn from what the shop set in the site builder of Digipart. This file is the default theme: each `Type` of section has its markup here. A section this engine does not
// know yet is skipped, never an error: the builder may be ahead of the site.
const props = defineProps<{ section: any, first?: boolean }>()
const site = inject<Ref<any>>('sfSite')!
const page = inject<Ref<any> | null>('sfPage', null)
const product = inject<Ref<any> | null>('sfProduct', null)
const catalog = inject<Ref<any> | null>('sfCatalog', null)
const route = useRoute()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
// the address of another page of the same category (a page of products, a sort), keeping what the visitor already chose
const listUrl = (changes: Record<string, string | number>) => { const query: Record<string, string> = {}; for (const [k, v] of Object.entries({ ...route.query, ...changes })) { if (typeof v !== 'object' && v !== '' && v !== 1 && v !== '1' && k !== 'preview') { query[k] = String(v) } } const text = new URLSearchParams(query).toString(); return route.path + (text ? '?' + text : '') }
const titleStyle = computed(() => ({ '--size': ({ xl: 42, lg: 34, md: 26, sm: 19 } as Record<string, number>)[s.value.TitleSize || 'md'] + 'px', fontWeight: s.value.TitleWeight || 600, textTransform: s.value.TitleCase === 'uppercase' ? 'uppercase' : undefined, textAlign: s.value.TitleAlign, marginBottom: (s.value.TitleGap ?? 20) + 'px' }))
const pdp = computed(() => { const w = s.value.GalleryWidth || 60; return { '--cols': s.value.GalleryPosition === 'right' ? (100 - w) + 'fr ' + w + 'fr' : w + 'fr ' + (100 - w) + 'fr', '--gap': (s.value.Gap ?? 48) + 'px' } })
const info = computed(() => ({ textAlign: s.value.Align || 'left', maxWidth: (s.value.InfoWidth || 900) + 'px', marginTop: (s.value.InfoTop || 0) + 'px', marginLeft: s.value.InfoX === 'left' ? 0 : 'auto', marginRight: s.value.InfoX === 'right' ? 0 : 'auto', '--ih': infoHeight.value + 'px' }))
const infoBox = ref<HTMLElement | null>(null)
const infoHeight = ref(0)   // measured in the browser: a block centred in the window needs its own height
onMounted(() => { if (!infoBox.value || typeof ResizeObserver === 'undefined') { return } const watcher = new ResizeObserver(() => { infoHeight.value = infoBox.value?.offsetHeight || 0 }); watcher.observe(infoBox.value); onBeforeUnmount(() => watcher.disconnect()) })
const s = computed(() => props.section.Settings || {})
const t = computed(() => props.section.Texts || {})
const blocks = computed(() => props.section.Blocks || [])
const type = computed(() => props.section.Type as string)

// the frame every section shares: its width, the space around it (less on a phone) and its background
const frame = computed(() => ({
  '--pt': (s.value.PaddingTop || 0) + 'px', '--pb': (s.value.PaddingBottom || 0) + 'px', '--pl': (s.value.PaddingLeft || 0) + 'px', '--pr': (s.value.PaddingRight || 0) + 'px', '--pm': (s.value.PaddingMobile || 60) / 100,
  background: s.value.Background === 'custom' ? s.value.BackgroundColor : undefined, color: s.value.Background === 'custom' ? s.value.TextColor : undefined,
}))
const wrap = computed(() => ['sf-wrap', 'is-' + (s.value.Width || 'page'), { 'is-full-mobile': s.value.FullMobile }])
const band = computed(() => ['sf-band', 'is-' + (s.value.Background || 'none'), 'sf-s-' + type.value.replace(/_/g, '-')])   // `sf-s-`: never the class of what is inside (`sf-hero`)
const align = computed(() => ({ textAlign: s.value.Align || 'left' }))
const justify = computed(() => ({ center: 'center', right: 'flex-end' } as Record<string, string>)[s.value.Align] || 'flex-start')

// a large picture with its content on it (a banner, the slides of a carousel)
const picture = computed(() => ({
  '--h': (s.value.Height || 560) + 'px', '--hm': (s.value.HeightMobile || 480) + 'px', '--pad': (s.value.ContentPadding || 0) + 'px', '--shade': (s.value.Overlay || 0) / 100,
  '--pos': (s.value.ImageX || 'center') + ' ' + (s.value.ImageY || 'center'), color: s.value.ContentColor, textAlign: s.value.Align || 'center',
  '--jc': ({ top: 'flex-start', bottom: 'flex-end' } as Record<string, string>)[s.value.Position] || 'center',
}))
const slides = computed(() => blocks.value.filter((b: any) => b.Type === 'slide'))
const banners = computed(() => blocks.value.filter((b: any) => b.Type === 'banner'))
const beforeBanners = computed(() => { const at = blocks.value.findIndex((b: any) => b.Type === 'banner'); return blocks.value.filter((b: any, i: number) => b.Type !== 'banner' && (at < 0 || i < at)) })
const afterBanners = computed(() => { const at = blocks.value.findIndex((b: any) => b.Type === 'banner'); return blocks.value.filter((b: any, i: number) => b.Type !== 'banner' && at >= 0 && i > at) })
const split = computed(() => { const w = s.value.ImageWidth || 50; return { '--cols': s.value.Side === 'right' ? (100 - w) + 'fr ' + w + 'fr' : w + 'fr ' + (100 - w) + 'fr', '--gap': (s.value.Gap ?? 48) + 'px', alignItems: ({ top: 'start', bottom: 'end' } as Record<string, string>)[s.value.Valign] || 'center' } })
const menuStyle = computed(() => ({ fontSize: (s.value.MenuSize || 14) + 'px', fontWeight: s.value.MenuWeight || 500, textTransform: s.value.MenuCase === 'uppercase' ? 'uppercase' : undefined, gap: (s.value.MenuGap || 28) + 'px', justifyContent: ({ left: 'flex-start', right: 'flex-end' } as Record<string, string>)[s.value.MenuAlign] || 'center' }))
const home = computed(() => site.value?.Route?.Prefix || '/')
const known = ['hero', 'slideshow', 'banners', 'products', 'image_text', 'richtext', 'lookbook', 'stories', 'newsletter', 'social', 'announcement', 'main_header', 'main_footer', 'main_page', 'contact_form', 'store_locator', 'whatsapp_signup', 'main_catalog', 'main_product', 'main_cart']
const { cart, show: showPanel } = useCart()
const { customer, favorites, url: accountUrl, favoritesUrl } = useAccount()
// the filters of a category (sizes, colours, price): chosen in a panel, kept in the address so a filtered list can be shared
const filtersOpen = ref(false)
const filterData = computed(() => catalog?.value?.Listing?.Filters || null)
const hasFilters = computed(() => s.value.Filters !== 'none' && !!filterData.value && (filterData.value.Groups.length > 0 || filterData.value.PriceMax > filterData.value.PriceMin))
const filterCount = computed(() => (filterData.value ? filterData.value.Attributes.length + (filterData.value.Max ? 1 : 0) : 0))
function applyFilters(chosen: { attributes: number[], min: number, max: number }) { filtersOpen.value = false; navigateTo(listUrl({ attr: chosen.attributes.join(','), min: chosen.max ? chosen.min || '' : '', max: chosen.max || '', page: 1 })) }
const navOpen = ref(false)
watch(() => route.fullPath, () => { navOpen.value = false })
// the logo of the shop: the copy closest to twice the height it is drawn at (sharp on a dense screen), else its name is written
const logo = computed(() => { const copies = [...(site.value?.Logo || [])].filter((c: any) => c.Src).sort((a: any, b: any) => (a.Height || 0) - (b.Height || 0)); const wanted = (s.value.LogoHeight || 28) * 2; return copies.find((c: any) => (c.Height || 0) >= wanted) || copies[copies.length - 1] || null })
const searchUrl = computed(() => (site.value?.Route?.Prefix || '') + (lang.value === 'fr' ? '/recherche' : '/search'))
const zoomAt = ref(-1)   // the photo of the product shown full screen (-1 = none)
const w = useWords()
</script>

<template>
  <section v-if="known.includes(type)" :class="band" :style="frame" :data-section="type">
    <div :class="wrap">
      <!-- a banner: a large picture or a video, with the blocks of the shop on it -->
      <div v-if="type === 'hero'" class="sf-hero" :class="{ 'is-screen': s.ScreenHeight, 'is-empty': !s.Image }" :style="picture">
        <picture v-if="s.Image">
          <source v-if="s.ImageMobile" media="(max-width: 767px)" :srcset="s.ImageMobile">
          <img :src="s.Image" alt="" :loading="first ? 'eager' : 'lazy'" :fetchpriority="first ? 'high' : undefined" decoding="async">
        </picture>
        <div class="sf-hero-copy"><SfBlocks :blocks="blocks" :light="!!s.Image" /></div>
      </div>

      <!-- a carousel: slides the visitor swipes through (scroll snap: no script is needed to read it) -->
      <div v-else-if="type === 'slideshow'" class="sf-slides" :style="picture">
        <div v-for="slide in slides" :key="slide.Id" class="sf-hero sf-slide" :class="{ 'is-empty': !slide.Settings.Image }">
          <picture v-if="slide.Settings.Image">
            <source v-if="slide.Settings.ImageMobile" media="(max-width: 767px)" :srcset="slide.Settings.ImageMobile">
            <img :src="slide.Settings.Image" alt="" :loading="first && slide === slides[0] ? 'eager' : 'lazy'" decoding="async">
          </picture>
          <component :is="slide.Settings.Url && !slide.Texts.ButtonText ? 'a' : 'div'" :href="slide.Settings.Url && !slide.Texts.ButtonText ? slide.Settings.Url : undefined" class="sf-hero-copy">
            <h2 v-if="slide.Texts.Title" class="sf-h" :style="{ '--size': (s.TitleSize || 44) + 'px' }">{{ slide.Texts.Title }}</h2>
            <p v-if="slide.Texts.Text" class="sf-text">{{ slide.Texts.Text }}</p>
            <a v-if="slide.Texts.ButtonText" :href="slide.Settings.Url || undefined" class="sf-btn" :class="['is-' + (s.ButtonStyle || 'solid'), { 'is-light': s.ButtonStyle === 'solid' }]">{{ slide.Texts.ButtonText }}</a>
          </component>
        </div>
      </div>

      <!-- two to four pictures side by side, each a link -->
      <div v-else-if="type === 'banners'" :style="align">
        <SfBlocks :blocks="beforeBanners" />
        <div class="sf-grid" :style="{ '--cols': banners.length, '--cols-m': s.ColumnsMobile || 2, '--gx': (s.GapX ?? 16) + 'px', '--gy': (s.GapX ?? 16) + 'px' }">
          <component :is="banner.Settings.Url ? 'a' : 'div'" v-for="banner in banners" :key="banner.Id" :href="banner.Settings.Url || undefined" class="sf-tile" :class="'is-' + (s.Ratio || 'portrait')">
            <img v-if="banner.Settings.Image" :src="banner.Settings.Image" alt="" loading="lazy" decoding="async">
            <span v-if="banner.Texts.Title" class="sf-tile-title">{{ banner.Texts.Title }}</span>
          </component>
        </div>
        <SfBlocks :blocks="afterBanners" />
      </div>

      <!-- joining the WhatsApp list: a picture beside the words and the form, or the form alone -->
      <div v-else-if="type === 'whatsapp_signup'" :class="s.Image ? ['sf-split', { 'is-reverse': s.Side === 'right' }] : 'sf-wa-alone'" :style="s.Image ? split : align">
        <div v-if="s.Image" class="sf-split-img is-portrait"><img :src="s.Image" alt="" loading="lazy" decoding="async"></div>
        <div :style="align"><SfBlocks :blocks="blocks"><LazySfWhatsapp :button="t.ButtonText" :success="t.Success" /></SfBlocks></div>
      </div>
      <div v-else-if="type === 'image_text'" class="sf-split" :class="{ 'is-reverse': s.Side === 'right' }" :style="split">
        <div class="sf-split-img" :class="'is-' + (s.Ratio || 'portrait')"><img v-if="s.Image" :src="s.Image" alt="" loading="lazy" decoding="async"></div>
        <div :style="align"><SfBlocks :blocks="blocks" /></div>
      </div>

      <!-- sections whose own content is one block among the others -->
      <div v-else-if="['richtext', 'products', 'lookbook', 'stories', 'newsletter', 'social', 'contact_form', 'store_locator'].includes(type)" :style="align">
        <SfBlocks :blocks="blocks">
          <div v-if="type === 'newsletter'" class="sf-news-wrap" :style="{ marginLeft: s.Align === 'left' ? 0 : 'auto', marginRight: s.Align === 'right' ? 0 : 'auto' }"><SfNewsletter :button="t.ButtonText" /></div>
          <LazySfContact v-else-if="type === 'contact_form'" :settings="s" :texts="t" />
          <LazySfStores v-else-if="type === 'store_locator'" :settings="s" />
          <SfProducts v-else-if="type === 'products'" :section="section" />
          <LazySfLookbookFeature v-else-if="type === 'lookbook'" :id="Number(s.IdLookbook) || 0" :button="t.ButtonText" :height="s.Height" />
          <LazySfStories v-else-if="type === 'stories'" :place="catalog ? 'catalog' : product ? 'product' : 'home'" :product="product?.Id" :size="s.Size" :gap="s.Gap" />
          <SfSocial v-else-if="type === 'social'" :display="s.Display" :shape="s.Shape" :size="s.Size" :gap="s.Gap" :style="{ justifyContent: justify }" />
        </SfBlocks>
      </div>

      <!-- the header of the site -->
      <div v-else-if="type === 'announcement'" class="sf-announce" :style="{ textAlign: s.Align || 'center', fontSize: (s.TextSize || 12) + 'px', textTransform: s.TextCase === 'uppercase' ? 'uppercase' : undefined }">
        <component :is="blocks[0]?.Settings?.Url ? 'a' : 'span'" v-if="blocks[0]" :href="blocks[0].Settings.Url || undefined">{{ blocks[0].Texts.Text }}</component>
      </div>
      <div v-else-if="type === 'main_header'" class="sf-header" :class="{ 'has-border': s.Border, 'is-centered': s.LogoPosition === 'center', 'is-below': s.MenuPosition === 'below', 'is-drawer': s.MenuPosition === 'drawer' }" :style="{ '--h': (s.Height || 72) + 'px' }">
        <button type="button" class="sf-burger" :aria-label="w('Menu principal')" aria-haspopup="dialog" @click="navOpen = true"><span /><span /><span /></button>
        <a :href="home" class="sf-logo" :style="{ fontSize: Math.round((s.LogoHeight || 28) * 0.62) + 'px' }"><img v-if="logo" :src="logo.Src" :alt="site?.Name" :style="{ height: (s.LogoHeight || 28) + 'px' }" :width="logo.Width || undefined" :height="logo.Height || undefined"><template v-else>{{ site?.Name }}</template></a>
        <nav class="sf-nav" :style="menuStyle" :aria-label="w('Menu principal')"><SfMenu :id="s.IdMenu" mode="nav" /></nav>
        <div class="sf-hicons">
          <a v-if="s.ShowSearch" :href="searchUrl">{{ w('Recherche') }}</a><a v-if="s.ShowAccount" :href="accountUrl" class="sf-desk" @click.prevent="showPanel('account')">{{ customer && !customer.Guest ? customer.Firstname : w('Compte') }}</a><a v-if="s.ShowWishlist" :href="favoritesUrl" class="sf-desk" @click.prevent="showPanel('favorites')">{{ w('Favoris') }}<template v-if="favorites.length"> ({{ favorites.length }})</template></a><button v-if="s.ShowCart" type="button" class="sf-cartlink" :aria-label="w('Ouvrir le panier, {a} article(s)', { a: cart.Count })" @click="showPanel('cart')">{{ w('Panier') }} ({{ cart.Count }})</button>
          <span v-if="s.ShowLanguage && (site?.Languages || []).length > 1" class="sf-langs"><a v-for="language in site.Languages" :key="language.LanguageIsoCode" :href="language.Default && site.UrlPrefix !== 'always' ? '/' : '/' + language.LanguageIsoCode" :aria-current="language.LanguageIsoCode === site.Route.LanguageIsoCode ? 'true' : undefined">{{ language.LanguageIsoCode.toUpperCase() }}</a></span>
        </div>
      </div>

      <LazySfFilters v-if="type === 'main_catalog' && catalog && filtersOpen" :filters="catalog.Listing.Filters" :currency="catalog.Listing.Products[0]?.Currency || 'EUR'" @close="filtersOpen = false" @apply="applyFilters" />
      <ClientOnly v-if="type === 'main_header'"><LazySfNavDrawer v-if="navOpen" :id="s.IdMenu" @close="navOpen = false" /></ClientOnly>

      <!-- the footer of the site: columns, then the bottom line -->
      <div v-else-if="type === 'main_footer'" class="sf-footer" :style="{ textAlign: s.Align || 'left', fontSize: (s.TextSize || 13) + 'px' }">
        <div class="sf-grid" :style="{ '--cols': s.Columns || 4, '--cols-m': s.ColumnsMobile || 1, '--gx': (s.Gap ?? 40) + 'px', '--gy': '32px' }">
          <div v-for="column in blocks" :key="column.Id">
            <div v-if="column.Texts.Title" class="sf-ftitle" :style="{ fontSize: (s.TitleSize || 14) + 'px', textTransform: s.TitleCase === 'uppercase' ? 'uppercase' : undefined }">{{ column.Texts.Title }}</div>
            <p v-if="column.Texts.Text" class="sf-text">{{ column.Texts.Text }}</p>
            <SfMenu v-if="column.Type === 'f_menu'" :id="column.Settings.IdMenu" mode="list" />
            <SfSocial v-if="column.Type === 'f_social'" display="icons" shape="plain" :size="34" :gap="6" />
            <SfNewsletter v-if="column.Type === 'f_newsletter'" small :button="column.Texts.ButtonText" />
          </div>
        </div>
        <div class="sf-fbottom"><span>{{ t.Copyright }}</span></div>
      </div>

      <!-- a category of the catalogue: its name, its description, the sort, its products, the pages -->
      <LazySfCartPage v-else-if="type === 'main_cart'" :settings="s" :texts="t" />
      <div v-else-if="type === 'main_catalog' && catalog">
        <nav class="sf-crumb" :aria-label="w('Fil d\'Ariane')"><a :href="home">{{ w('Accueil') }}</a> / {{ catalog.Category.Name }}</nav>
        <h1 class="sf-h" :style="titleStyle">{{ catalog.Category.Name }}</h1>
        <!-- eslint-disable-next-line vue/no-v-html : the description of a category is written by the shop in Digipart and comes from its category API -->
        <div v-if="s.ShowDescription && catalog.Category.Description" class="sf-rte sf-muted" v-html="catalog.Category.Description" />
        <div class="sf-bar">
          <span>{{ w(catalog.Listing.Total > 1 ? '{a} produits' : '{a} produit', { a: catalog.Listing.Total }) }}</span>
          <button v-if="hasFilters" type="button" class="sf-filterbtn" aria-haspopup="dialog" @click="filtersOpen = true">{{ w('Filtrer') }}<template v-if="filterCount"> ({{ filterCount }})</template></button>
          <nav v-if="s.ShowSort" class="sf-sort" :aria-label="w('Trier les produits')">
            <a :href="listUrl({ sort: '', page: 1 })" :aria-current="!catalog.Listing.Sort ? 'true' : undefined">{{ w('Sélection') }}</a>
            <a :href="listUrl({ sort: 'newest', page: 1 })" :aria-current="catalog.Listing.Sort === 'newest' ? 'true' : undefined">{{ w('Nouveautés') }}</a>
            <a :href="listUrl({ sort: 'price_asc', page: 1 })" :aria-current="catalog.Listing.Sort === 'price_asc' ? 'true' : undefined">{{ w('Prix croissant') }}</a>
            <a :href="listUrl({ sort: 'price_desc', page: 1 })" :aria-current="catalog.Listing.Sort === 'price_desc' ? 'true' : undefined">{{ w('Prix décroissant') }}</a>
          </nav>
        </div>
        <div v-if="catalog.Listing.Products.length" class="sf-grid" :style="{ '--cols': s.Columns || 4, '--cols-m': s.ColumnsMobile || 2, '--gx': (s.GapX ?? 16) + 'px', '--gy': (s.GapY ?? 32) + 'px' }">
          <SfProductCard v-for="(item, index) in catalog.Listing.Products" :key="item.Id" :product="item" :images="s.CardImages" :dots="s.CardDots" :eager="index < 4" />
        </div>
        <p v-else class="sf-muted">{{ w('Aucun produit dans cette catégorie pour le moment.') }}</p>
        <nav v-if="catalog.Listing.Pages > 1" class="sf-pages" :aria-label="w('Pages de produits')">
          <a v-if="catalog.Listing.Page > 1" :href="listUrl({ page: catalog.Listing.Page - 1 })" rel="prev">{{ w('Page précédente') }}</a>
          <span>{{ w('Page {a} sur {b}', { a: catalog.Listing.Page, b: catalog.Listing.Pages }) }}</span>
          <a v-if="catalog.Listing.Page < catalog.Listing.Pages" :href="listUrl({ page: catalog.Listing.Page + 1 })" rel="next">{{ w('Page suivante') }}</a>
        </nav>
      </div>

      <!-- a product: its photos beside its blocks (name, price, sizes, buy button, description...) in the order the shop gave them -->
      <div v-else-if="type === 'main_product' && product" class="sf-pdp" :class="{ 'is-reverse': s.GalleryPosition === 'right' }" :style="pdp">
        <SfGallery :images="product.Images" :sets="product.ImageSets" :name="product.Name" :layout="s.GalleryLayout" :per-view="Number(s.GalleryPerView) || 2" @zoom="zoomAt = $event" />
        <!-- the column is as tall as the photos; inside it the blocks follow the scroll (when the shop asked) and stop where the section ends, before the next one -->
        <div class="sf-info-col" :class="{ 'is-sticky': s.InfoSticky !== false, 'is-center': s.InfoY === 'center' }"><div ref="infoBox" class="sf-info" :style="info"><SfBlocks :blocks="blocks" /></div></div>
        <LazySfZoom v-if="zoomAt >= 0" :images="product.Images" :start="zoomAt" :name="product.Name" @close="zoomAt = -1" />
      </div>

      <!-- a content page of the shop: its title and its text, written in the Pages tab of Digipart -->
      <article v-else-if="type === 'main_page' && page" :style="align">
        <h1 v-if="s.ShowTitle" class="sf-h" :style="{ '--size': ({ xl: 42, lg: 34, md: 26, sm: 19 } as Record<string, number>)[s.TitleSize || 'md'] + 'px', fontWeight: s.TitleWeight || 600, textTransform: s.TitleCase === 'uppercase' ? 'uppercase' : undefined, textAlign: s.TitleAlign, marginBottom: (s.TitleGap ?? 20) + 'px' }">{{ page.Title }}</h1>
        <!-- eslint-disable-next-line vue/no-v-html : the HTML of a page is cleaned by Digipart (an allow-list of tags) when it is saved and again when the API gives it -->
        <div class="sf-rte" :style="{ fontSize: (s.TextSize || 15) + 'px', lineHeight: s.TextLine || 1.7 }" v-html="page.Content" />
      </article>
    </div>
  </section>
</template>
