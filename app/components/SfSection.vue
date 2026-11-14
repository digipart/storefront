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
// a picture behind a section or a column: the veil (dark or light) over it, the picture for a phone, and the colour of text that reads on it (the CSS picks the picture by screen width)
const cssUrl = (src: string) => 'url("' + String(src).replace(/["\\)\s]/g, (c) => encodeURIComponent(c)) + '")'
const bgPicture = (image: any, imageMobile: any, veil: any, tone: any, posX = 'center', posY = 'center') => {
  if (!image) { return {} }
  const a = Math.max(0, Math.min(90, Number(veil) || 0)) / 100, rgb = tone === 'light' ? '255,255,255' : '0,0,0'
  return { '--bg': cssUrl(image), '--bg-m': cssUrl(imageMobile || image), '--bgv': `linear-gradient(rgba(${rgb},${a}),rgba(${rgb},${a}))`, '--bgpos': posX + ' ' + posY, color: tone === 'light' ? '#1e2129' : '#fff' }
}
const frame = computed(() => ({
  ...bgPicture(s.value.BgImage, s.value.BgImageMobile, s.value.BgVeil ?? 30, s.value.BgTone, s.value.BgPosX, s.value.BgPosY),
  borderTop: Number(s.value.BorderTop) > 0 ? s.value.BorderTop + 'px solid ' + (s.value.BorderColor || '#e6e6ee') : undefined, borderBottom: Number(s.value.BorderBottom) > 0 ? s.value.BorderBottom + 'px solid ' + (s.value.BorderColor || '#e6e6ee') : undefined,
  '--pt': (s.value.PaddingTop || 0) + 'px', '--pb': (s.value.PaddingBottom || 0) + 'px', '--pl': (s.value.PaddingLeft || 0) + 'px', '--pr': (s.value.PaddingRight || 0) + 'px', '--pm': (s.value.PaddingMobile || 60) / 100,
  background: s.value.Background === 'custom' ? s.value.BackgroundColor : undefined, color: s.value.Background === 'custom' ? s.value.TextColor : undefined,
}))
const wrap = computed(() => ['sf-wrap', 'is-' + (s.value.Width || 'page'), { 'is-full-mobile': s.value.FullMobile }])
const band = computed(() => ['sf-band', { 'has-bg': !!s.value.BgImage, 'is-fixed-bg': !!s.value.BgFixed }, 'is-' + (s.value.Background || 'none'), 'sf-s-' + type.value.replace(/_/g, '-')])   // `sf-s-`: never the class of what is inside (`sf-hero`)
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
// the cover of the category: its largest size is the fallback, the browser picks among all of them
const hasCover = computed(() => s.value.ShowCover !== false && (!!catalogCover.value || !!vimeo(catalog?.value?.Category?.Cover?.Video)))
const coverText = computed(() => hasCover.value && !!s.value.CoverDescription && s.value.ShowDescription !== false && !!catalog?.value?.Category?.Description)
const catalogCover = computed(() => { const sizes = catalog?.value?.Category?.Cover?.Sizes || []; return sizes.length ? sizes[sizes.length - 1] : null })
// a Vimeo video behind a banner or a slide: played silent and in a loop, without controls, over the picture (which shows while the video loads). `vimeo.com/123/abc` is an unlisted video with its key
const vimeo = (value: unknown) => { const found = String(value || '').match(/vimeo\.com\/(?:video\/)?(\d{6,12})(?:\/([0-9a-f]{6,20}))?/i); return found ? 'https://player.vimeo.com/video/' + found[1] + '?background=1&autoplay=1&loop=1&muted=1&dnt=1' + (found[2] ? '&h=' + found[2] : '') : '' }
// a section of columns: the ratios of the layout on a computer and on a phone ("2:1:1" = a wide column and two narrow), and the blocks of each column
const ratios = (value: any, fallback: string) => { const v = String(value || '').replace(/\s/g, ''); return (/^(?:[1-9]|1[0-2])(?::(?:[1-9]|1[0-2])){0,5}$/.test(v) ? v : fallback).split(':').map(Number) }
const columnsWide = computed(() => ratios(s.value.Layout, '1:1'))
const columnList = computed(() => columnsWide.value.map((_: number, i: number) => blocks.value.filter((b: any) => Math.max(1, Math.min(columnsWide.value.length, Number(b.Col) || 1)) === i + 1)))
const columnsStyle = computed(() => {
  const narrow = ratios(s.value.LayoutMobile, '1')
  return {
    '--cols': columnsWide.value.map((r: number) => r + 'fr').join(' '), '--cols-m': narrow.map((r: number) => r + 'fr').join(' '), '--gap': (s.value.Gap ?? 32) + 'px', '--gap-m': (s.value.GapMobile ?? 20) + 'px', '--div': (s.value.ColDivider || 0) + 'px', '--div-color': s.value.ColDividerColor || '#e6e6ee',
    alignItems: ({ center: 'center', bottom: 'end' } as Record<string, string>)[s.value.Valign] || 'start', textAlign: s.value.Align || 'left',
  }
})
const columnPicture = (i: number) => {
  const n = i + 1, v = s.value, height = Number(v['C' + n + 'Height']) || 0, pad = Number(v['C' + n + 'Pad']) || 0, align = v['C' + n + 'Valign']
  return { ...bgPicture(v['C' + n + 'Image'], v['C' + n + 'ImageMobile'], v['C' + n + 'Veil'] ?? 30, v['C' + n + 'Tone']), '--col-h': height ? height + 'px' : undefined, padding: pad ? pad + 'px' : undefined,
    ...(align === 'center' || align === 'bottom' ? { display: 'flex', flexDirection: 'column', justifyContent: align === 'center' ? 'center' : 'flex-end' } : {}) }
}
const columnsReverse = computed(() => !!s.value.ReverseMobile && ratios(s.value.LayoutMobile, '1').length === 1)
const known = ['hero', 'slideshow', 'banners', 'products', 'image_text', 'richtext', 'columns', 'lookbook', 'stories', 'newsletter', 'social', 'announcement', 'main_header', 'main_footer', 'main_page', 'contact_form', 'store_locator', 'whatsapp_signup', 'main_catalog', 'main_product', 'main_cart']
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
// the logo as the shop set it: an SVG when it has one (sharp at any size), and the version for dark backgrounds when the header is dark (Background « Foncé »)
const logoFile = computed(() => {
  const files = site.value?.LogoFiles || {}
  const dark = s.value.Background === 'dark' || (s.value.Background === 'custom' && /^#(?:[0-3][0-9a-f]){3}$/i.test(String(s.value.BackgroundColor || '')))
  return (dark && files.Dark?.Src ? files.Dark : files.Svg?.Src ? files.Svg : null) as { Src: string, Width: number, Height: number } | null
})
const searchUrl = computed(() => (site.value?.Route?.Prefix || '') + (lang.value === 'fr' ? '/recherche' : '/search'))
const zoomAt = ref(-1)   // the photo of the product shown full screen (-1 = none)
const w = useWords()
</script>

<template>
  <section v-if="known.includes(type)" :class="band" :style="frame" :data-section="type">
    <div :class="wrap">
      <!-- a banner: a large picture or a video, with the blocks of the shop on it -->
      <div v-if="type === 'hero'" class="sf-hero" :class="{ 'is-screen': s.ScreenHeight, 'is-empty': !s.Image && !vimeo(s.Video) }" :style="picture">
        <picture v-if="s.Image">
          <source v-if="s.ImageMobile" media="(max-width: 767px)" :srcset="s.ImageMobile">
          <img :src="s.Image" alt="" :loading="first ? 'eager' : 'lazy'" :fetchpriority="first ? 'high' : undefined" decoding="async">
        </picture>
        <span v-if="vimeo(s.Video)" class="sf-hero-video"><iframe :src="vimeo(s.Video)" title="" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" tabindex="-1" aria-hidden="true" /></span>
        <div class="sf-hero-copy"><SfBlocks :blocks="blocks" :light="!!s.Image || !!vimeo(s.Video)" /></div>
      </div>

      <!-- a carousel: slides the visitor swipes through (scroll snap: no script is needed to read it) -->
      <div v-else-if="type === 'slideshow'" :style="picture"><SfSlides :slides="slides" :settings="s" :first="first" /></div>

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

      <!-- columns: blocks side by side on a computer, laid out as the shop chose on a phone -->
      <div v-else-if="type === 'columns'" class="sf-cols" :class="{ 'is-reverse': columnsReverse, 'has-div': Number(s.ColDivider) > 0, 'is-stack': ratios(s.LayoutMobile, '1').length === 1 }" :style="columnsStyle">
        <div v-for="(column, i) in columnList" :key="i" class="sf-col" :class="{ 'has-bg': !!s['C' + (i + 1) + 'Image'] }" :style="columnPicture(i)"><SfBlocks :blocks="column" /></div>
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
        <a :href="home" class="sf-logo" :style="{ fontSize: Math.round((s.LogoHeight || 28) * 0.62) + 'px' }"><img v-if="logoFile" :src="logoFile.Src" :alt="site?.Name" :style="{ height: (s.LogoHeight || 28) + 'px', width: 'auto' }" :width="logoFile.Width ? Math.round(logoFile.Width * (s.LogoHeight || 28) / (logoFile.Height || 1)) : undefined" :height="s.LogoHeight || 28"><img v-else-if="logo" :src="logo.Src" :alt="site?.Name" :style="{ height: (s.LogoHeight || 28) + 'px' }" :width="logo.Width || undefined" :height="logo.Height || undefined"><template v-else>{{ site?.Name }}</template></a>
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
        <div v-if="hasCover" class="sf-hero sf-catcover" :class="{ 'is-full': s.CoverFull }" :style="{ '--h': (s.CoverHeight || 280) + 'px', '--hm': (s.CoverHeightMobile || 180) + 'px', '--shade': (s.CoverVeil ?? 20) / 100, '--pad': '24px', '--jc': ({ top: 'flex-start', bottom: 'flex-end' } as Record<string, string>)[s.CoverPosition] || 'center', color: '#fff', textAlign: s.CoverAlign || 'center' }">
          <picture v-if="catalogCover"><img :src="catalogCover.Src" :srcset="catalog.Category.Cover.Sizes.map((c: any) => c.Src + ' ' + c.Width + 'w').join(', ')" sizes="100vw" alt="" fetchpriority="high" decoding="async"></picture>
          <span v-if="vimeo(catalog.Category.Cover?.Video)" class="sf-hero-video"><iframe :src="vimeo(catalog.Category.Cover.Video)" title="" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" tabindex="-1" aria-hidden="true" /></span>
          <div v-if="s.CoverTitle === 'over' || coverText" class="sf-hero-copy">
            <h1 v-if="s.CoverTitle === 'over'" class="sf-h" :style="titleStyle">{{ catalog.Category.Name }}</h1>
            <!-- eslint-disable-next-line vue/no-v-html : the description of a category is written by the shop in Digipart and comes from its category API -->
            <div v-if="coverText" class="sf-rte" v-html="catalog.Category.Description" />
          </div>
        </div>
        <nav class="sf-crumb" :aria-label="w('Fil d\'Ariane')"><a :href="home">{{ w('Accueil') }}</a> / {{ catalog.Category.Name }}</nav>
        <h1 v-if="!(s.CoverTitle === 'over' && hasCover)" class="sf-h" :style="titleStyle">{{ catalog.Category.Name }}</h1>
        <!-- eslint-disable-next-line vue/no-v-html : the description of a category is written by the shop in Digipart and comes from its category API -->
        <div v-if="s.ShowDescription && catalog.Category.Description && !coverText" class="sf-rte sf-muted" v-html="catalog.Category.Description" />
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
          <template v-if="catalog.Listing.Items">
            <template v-for="(item, index) in catalog.Listing.Items" :key="item.Kind + (item.Id || item.Product.Id)">
              <component :is="item.Url ? 'a' : 'div'" v-if="item.Kind === 'edito'" :href="item.Url || undefined" class="sf-edito" :class="['is-' + item.Size, { 'has-height': item.Height > 0 || item.HeightMobile > 0 }]" :style="item.Height > 0 || item.HeightMobile > 0 ? { '--eh': (item.Height || item.HeightMobile) + 'px', '--ehm': (item.HeightMobile || item.Height) + 'px' } : undefined">
                <img v-if="item.Image" :src="item.Image" alt="" :loading="index < 4 ? 'eager' : 'lazy'" decoding="async">
                <span v-if="vimeo(item.Video)" class="sf-hero-video"><iframe :src="vimeo(item.Video)" title="" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" tabindex="-1" aria-hidden="true" /></span>
                <span v-if="item.Title" class="sf-edito-title">{{ item.Title }}</span>
              </component>
              <SfProductCard v-else :product="item.Product" :count="item.Count" :images="item.Size === 'full' ? (item.Layout === 'cover' ? 'wide' : 'row') : item.Size === '2x2' ? 'carousel' : s.CardImages" :dots="item.Size === '2x2' ? true : s.CardDots" :eager="index < 4" :quick="s.QuickAdd !== false" :video="item.Video" :class="'is-' + item.Size" />
            </template>
          </template>
          <SfProductCard v-for="(item, index) in catalog.Listing.Products" v-else :key="item.Id" :product="item" :images="s.CardImages" :dots="s.CardDots" :eager="index < 4" :quick="s.QuickAdd !== false" />
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
