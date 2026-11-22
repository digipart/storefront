<script setup lang="ts">
// One section of a page, drawn from what the shop set in the site builder of Digipart. This file is the default theme: each `Type` of section has its markup here. A section this engine does not
// know yet is skipped, never an error: the builder may be ahead of the site.
const props = defineProps<{ section: any, first?: boolean }>()
const site = inject<Ref<any>>('sfSite')!
const langHref = useLanguageHref()
const page = inject<Ref<any> | null>('sfPage', null)
const product = inject<Ref<any> | null>('sfProduct', null)
const catalog = inject<Ref<any> | null>('sfCatalog', null)
const lookPage = inject<Ref<any> | null>('sfLook', null)
const lookData = computed(() => lookPage?.value || null)
const route = useRoute()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
// the address of another page of the same category (a page of products, a sort), keeping what the visitor already chose
const listUrl = (changes: Record<string, string | number>) => { const query: Record<string, string> = {}; for (const [k, v] of Object.entries({ ...route.query, ...changes })) { if (typeof v !== 'object' && v !== '' && v !== 1 && v !== '1' && k !== 'preview') { query[k] = String(v) } } const text = new URLSearchParams(query).toString(); return route.path + (text ? '?' + text : '') }
// the HTML tag the shop chose for the title of a page section (h1 as before when it chose nothing)
// the header icons: the words, the icons alone or both, on a computer and (apart) on a phone; both are written in the page and the style sheet shows the one of the screen (nothing changes after the page is drawn)
const iconModeOf = (value: any) => (['text', 'icon', 'both'].includes(String(value)) ? String(value) : 'text')
const iconDesk = computed(() => iconModeOf(s.value.IconMode))
const iconMob = computed(() => (s.value.IconModeMobile && s.value.IconModeMobile !== 'same' ? iconModeOf(s.value.IconModeMobile) : iconDesk.value))
// the order of the header icons (site builder: « Ordre »): a CSS order on each
const iconAt = (key: string) => { const list = String(s.value.IconOrder || 'language,search,account,wishlist,cart').split(','); const at = list.indexOf(key); return at < 0 ? 9 : at }
const hasIcons = computed(() => iconDesk.value !== 'text' || iconMob.value !== 'text')
// the HTML the shop wrote, with its variables ({{ shop.name }}, {{ year }}...) replaced (app/utils/htmlVars.ts)
const customHtml = computed(() => withHtmlVars(String(s.value.Html || ''), site.value))
const searchData = inject<Ref<any> | null>('sfSearch', null)
// the search the visitor made (the page « Recherche » draws it inside its section)
const searchResults = computed(() => searchData?.value || null)
const titleTag = computed(() => (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div'].includes(String(s.value.TitleTag)) ? String(s.value.TitleTag) : 'h1'))
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
const bgPicture = (image: any, imageMobile: any, veil: any, tone: any, y = 'BgPosY', x = 'BgPosX') => {
  if (!image) { return {} }
  const a = Math.max(0, Math.min(90, Number(veil) || 0)) / 100, rgb = tone === 'light' ? '255,255,255' : '0,0,0'
  return { '--bg': cssUrl(image), '--bg-m': cssUrl(imageMobile || image), '--bgv': `linear-gradient(rgba(${rgb},${a}),rgba(${rgb},${a}))`, ...focusVars(focusOf(s.value, y, x), 'bg'), color: tone === 'light' ? '#1e2129' : '#fff' }
}
const frame = computed(() => ({
  ...bgPicture(s.value.BgImage, s.value.BgImageMobile, s.value.BgVeil ?? 30, s.value.BgTone),
  borderTop: Number(s.value.BorderTop) > 0 ? s.value.BorderTop + 'px solid ' + (s.value.BorderColor || '#e6e6ee') : undefined, borderBottom: Number(s.value.BorderBottom) > 0 ? s.value.BorderBottom + 'px solid ' + (s.value.BorderColor || '#e6e6ee') : undefined,
  '--pt': (s.value.PaddingTop || 0) + 'px', '--pb': (s.value.PaddingBottom || 0) + 'px', '--pl': (s.value.PaddingLeft || 0) + 'px', '--pr': (s.value.PaddingRight || 0) + 'px', '--pm': (s.value.PaddingMobile || 60) / 100,
  background: s.value.Background === 'custom' ? s.value.BackgroundColor : undefined, color: s.value.Background === 'custom' ? s.value.TextColor : undefined,
}))
// what stands in this section is on something dark (a dark band, a picture with a dark veil): a logo block then takes the version for dark backgrounds
provide('sfSectionSettings', s)   // the product blocks read the mobile choices of their section
provide('sfOnDark', computed(() => s.value.Background === 'dark' || (!!s.value.BgImage && s.value.BgTone !== 'light')))
const wrap = computed(() => ['sf-wrap', 'is-' + (s.value.Width || 'page'), { 'is-full-mobile': s.value.FullMobile }])
// the CSS the shop wrote for this section (cleaned by Digipart): written inside the rule of the section (CSS nesting), so it only reaches this section
// every section carries its own class (`sf-i-<id>`), every block `sf-b-<id>` and every column `sf-col-<n>`: the site builder shows them next to the CSS field, to be aimed at from the custom CSS
const instance = computed(() => (props.section.Id ? 'sf-i-' + String(props.section.Id).replace(/[^A-Za-z0-9_-]/g, '') : ''))
useHead(() => ({ style: instance.value && s.value.CustomCss ? [{ key: instance.value, innerHTML: '.' + instance.value + '{' + String(s.value.CustomCss) + '}', tagPosition: 'bodyClose' as const }] : [] }))   // at the end of the page, after the style sheet of the site: it wins whatever the loading order
// a colour scheme of the theme (site.Theme.Schemes, drawn by app.vue as `.sf-scheme-<id>`): the nine colours of the section change at once
const scheme = computed(() => /^sch_[a-z0-9]{4,12}$/.test(String(s.value.Scheme || '')) ? 'sf-scheme-' + s.value.Scheme : '')
const band = computed(() => ['sf-band', { 'has-bg': !!s.value.BgImage, 'is-fixed-bg': !!s.value.BgFixed }, 'is-' + (s.value.Background || 'none'), 'sf-s-' + type.value.replace(/_/g, '-'), instance.value, scheme.value, s.value.CssClass])   // `sf-s-`: never the class of what is inside (`sf-hero`)
const align = computed(() => ({ textAlign: s.value.Align || 'left' }))
const justify = computed(() => ({ center: 'center', right: 'flex-end' } as Record<string, string>)[s.value.Align] || 'flex-start')

// a large picture with its content on it (a banner, the slides of a carousel)
const picture = computed(() => ({
  '--h': (s.value.Height || 560) + 'px', '--hm': (s.value.HeightMobile || 480) + 'px', '--pad': (s.value.ContentPadding || 0) + 'px', '--shade': (s.value.Overlay || 0) / 100,
  ...focusVars(focusOf(s.value, 'ImageY', 'ImageX')), color: s.value.ContentColor, textAlign: s.value.Align || 'center',
  '--jc': ({ top: 'flex-start', bottom: 'flex-end' } as Record<string, string>)[s.value.Position] || 'center',
}))
const slides = computed(() => blocks.value.filter((b: any) => b.Type === 'slide'))
const banners = computed(() => blocks.value.filter((b: any) => b.Type === 'banner'))
const beforeBanners = computed(() => { const at = blocks.value.findIndex((b: any) => b.Type === 'banner'); return blocks.value.filter((b: any, i: number) => b.Type !== 'banner' && (at < 0 || i < at)) })
const afterBanners = computed(() => { const at = blocks.value.findIndex((b: any) => b.Type === 'banner'); return blocks.value.filter((b: any, i: number) => b.Type !== 'banner' && at >= 0 && i > at) })
const split = computed(() => { const w = s.value.ImageWidth || 50; return { '--cols': s.value.Side === 'right' ? (100 - w) + 'fr ' + w + 'fr' : w + 'fr ' + (100 - w) + 'fr', '--gap': (s.value.Gap ?? 48) + 'px', alignItems: ({ top: 'start', bottom: 'end' } as Record<string, string>)[s.value.Valign] || 'center' } })
// the large menu under a tab (site builder, group « Sous-menu »): its spaces, its titles and its links, given to the panel as variables
const megaCase = (value: unknown) => (value === 'uppercase' ? 'uppercase' : 'none')
// where the columns start (« Position du contenu »): under the first tab (measured here, again when the header changes size), at the edge of the pages, centred, on the left, on the right
const megaPlace = computed(() => (['tabs', 'site', 'center', 'left', 'right'].includes(String(s.value.MegaAlign)) ? String(s.value.MegaAlign) : 'tabs'))
const navBox = ref<HTMLElement | null>(null)
const megaStart = ref(0)
function measureMega() {
  const nav = navBox.value, first = nav?.querySelector('.sf-nav-item') as HTMLElement | null, header = nav?.closest('.sf-header') as HTMLElement | null
  megaStart.value = first && header ? Math.max(0, Math.round(first.getBoundingClientRect().left - header.getBoundingClientRect().left)) : 0
}
onMounted(() => {
  if (!navBox.value || typeof ResizeObserver === 'undefined') { return }
  const watcher = new ResizeObserver(measureMega)
  watcher.observe(navBox.value); const header = navBox.value.closest('.sf-header'); if (header) { watcher.observe(header) }
  document.fonts?.ready.then(measureMega).catch(() => {})
  onBeforeUnmount(() => watcher.disconnect())
})
const megaVars = computed(() => ({
  '--mg-gap': (Number(s.value.MegaGap) || 48) + 'px', '--mg-line': (Number(s.value.MegaLineGap) || 8) + 'px', '--mg-pad': (Number(s.value.MegaPadding) || 28) + 'px',
  '--mg-tsize': (Number(s.value.MegaTitleSize) || 14) + 'px', '--mg-tweight': String(s.value.MegaTitleWeight || 600), '--mg-tcase': megaCase(s.value.MegaTitleCase),
  '--mg-xsize': (Number(s.value.MegaTextSize) || 14) + 'px', '--mg-xcase': megaCase(s.value.MegaTextCase),
  '--mg-align': ({ center: 'center', right: 'flex-end' } as Record<string, string>)[megaPlace.value] || 'flex-start',
  ...(megaPlace.value === 'tabs' && megaStart.value > 0 ? { '--mg-start': megaStart.value + 'px' } : {}),
  '--mg-img': Math.max(120, Math.min(480, Number(s.value.MegaImageWidth) || 220)) + 'px',
  '--mg-ratio': ({ portrait: '3 / 4', square: '1 / 1', landscape: '4 / 3' } as Record<string, string>)[s.value.MegaImageRatio] || 'auto',
}))
const megaClass = computed(() => ({ 'has-mega-rules': !!s.value.MegaRules, 'is-mega-tab': s.value.MegaWidth === 'tab', ['is-mega-at-' + megaPlace.value]: s.value.MegaWidth !== 'tab', 'has-mega-pics-right': s.value.MegaImagesRight !== false }))
const menuStyle = computed(() => ({ ...megaVars.value, fontSize: (s.value.MenuSize || 14) + 'px', fontWeight: s.value.MenuWeight || 500, textTransform: s.value.MenuCase === 'uppercase' ? 'uppercase' : undefined, gap: (s.value.MenuGap || 28) + 'px', justifyContent: ({ left: 'flex-start', right: 'flex-end' } as Record<string, string>)[s.value.MenuAlign] || 'center' }))
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
  return { ...bgPicture(v['C' + n + 'Image'], v['C' + n + 'ImageMobile'], v['C' + n + 'Veil'] ?? 30, v['C' + n + 'Tone'], 'C' + n + 'PosY', 'C' + n + 'PosX'), '--col-h': height ? height + 'px' : undefined, padding: pad ? pad + 'px' : undefined,
    ...(align === 'center' || align === 'bottom' ? { display: 'flex', flexDirection: 'column', justifyContent: align === 'center' ? 'center' : 'flex-end' } : {}) }
}
const columnsReverse = computed(() => !!s.value.ReverseMobile && ratios(s.value.LayoutMobile, '1').length === 1)
const known = ['hero', 'slideshow', 'banners', 'products', 'image_text', 'richtext', 'columns', 'lookbook', 'stories', 'reviews', 'newsletter', 'social', 'announcement', 'custom_html', 'code', 'main_header', 'main_footer', 'main_page', 'contact_form', 'store_locator', 'whatsapp_signup', 'main_catalog', 'main_product', 'main_cart', 'main_search', 'main_404', 'main_look']
const { cart, show: showPanel } = useCart()
const { customer, favorites, url: accountUrl, favoritesUrl } = useAccount()
// the filters of a category (sizes, colours, price): chosen in a panel, kept in the address so a filtered list can be shared
const filtersOpen = ref(false)
// the filters in a column beside the products (the shop chose « Dans une colonne à gauche »)
const sideFilters = computed(() => s.value.Filters === 'left' && hasFilters.value)
const filterData = computed(() => catalog?.value?.Listing?.Filters || null)
const hasFilters = computed(() => s.value.Filters !== 'none' && !!filterData.value && (filterData.value.Groups.length > 0 || filterData.value.PriceMax > filterData.value.PriceMin || (s.value.FilterPromo !== false && (filterData.value.PromoCount > 0 || filterData.value.Promo))))
const filterCount = computed(() => (filterData.value ? filterData.value.Attributes.length + (filterData.value.Max ? 1 : 0) + (filterData.value.Promo ? 1 : 0) : 0))
function applyFilters(chosen: { attributes: number[], min: number, max: number, promo?: boolean }) { filtersOpen.value = false; navigateTo(listUrl({ attr: chosen.attributes.join(','), min: chosen.max ? chosen.min || '' : '', max: chosen.max || '', promo: chosen.promo ? 'yes' : '', page: 1 })) }
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
// the search of the header opens the search panel (SfSearchPanel), unless the shop chose the page /recherche (En-tête > « Ouvrir la recherche dans un panneau »); a click with ⌘ or Ctrl opens the page
const searchOpen = useState<boolean>('sf-search-open', () => false)
const openSearch = (event: MouseEvent) => { if (s.value.SearchPanel === false || event.metaKey || event.ctrlKey || event.shiftKey) { return } event.preventDefault(); searchOpen.value = true }
const searchUrl = computed(() => (site.value?.Route?.Prefix || '') + (lang.value === 'fr' ? '/recherche' : '/search'))
const zoomAt = ref(-1)   // the photo of the product shown full screen (-1 = none)
// footer « pays et langue »: the country comes from the visitor's choice (kept in the browser), asked once otherwise
const regionName = ref(''), regionCurrency = ref('')
const regionUrl = computed(() => { const here = site.value?.Route; return (here?.Prefix || '') + '/' + (here?.LanguageIsoCode === 'fr' ? 'pays-et-langue' : 'country-and-language') + '?retour=' + encodeURIComponent((here?.Prefix || '') + '/' + (here?.Rest || '')) })
const languageName = computed(() => { const iso = String(site.value?.Route?.LanguageIsoCode || 'fr'); try { return new Intl.DisplayNames([iso], { type: 'language' }).of(iso) || iso } catch { return iso } })
if (props.section.Type === 'main_footer') {
  const readRegion = async () => {
    if (s.value.ShowLanguage === false || s.value.LanguageStyle !== 'region') { return }
    const lang = String(site.value?.Route?.LanguageIsoCode || 'fr')
    try { const kept = JSON.parse(window.sessionStorage.getItem('sf_place') || window.localStorage.getItem('sf_place') || 'null'); if (kept?.name && kept.lang === lang) { regionName.value = String(kept.name); regionCurrency.value = String(kept.currency || ''); return } } catch { /* nothing kept */ }
    const answer = await $fetch<any>('/api/storefront/regions', { query: { lang } }).catch(() => null)
    const now = (answer?.Countries || []).find((c: any) => c.IsoCode === answer?.Current)
    if (now) { regionName.value = now.Name; regionCurrency.value = String(answer.Currency || ''); try { window.sessionStorage.setItem('sf_place', JSON.stringify({ name: now.Name, lang, currency: answer.Currency })) } catch { /* private window */ } }
  }
  onMounted(() => { readRegion(); watch(() => s.value.LanguageStyle, readRegion) })
}
const w = useWords()
// the name of a link that covers a whole banner, a picture or a column (« Lien de la bannière », « Lien de la colonne »): the first title among its blocks, else « Voir »
const titleOf = (list: any[]) => String((list || []).find((b: any) => /heading$/.test(String(b.Type)) && b.Texts?.Text)?.Texts?.Text || '').trim()
const areaLabel = computed(() => titleOf(blocks.value) || w('Voir'))
const columnLabel = (column: any[]) => titleOf(column) || w('Voir')
// the catalogue grows as the visitor scrolls: the next page of the category is read and its cards go under the others. Every page keeps its own address (?page=n, a real link the search engines
// follow, written in the address bar as the pages come) and the page drawn by the server holds only its own cards. Two pages come by themselves, then a button asks: the footer stays reachable.
// the links to other categories under the title: the sub-categories; without any, the categories next to it (when the shop chose « auto »), led by « Tout voir » (the parent) when asked
const subOwn = computed(() => !!catalog?.value?.Category?.Links?.Children?.length)
const subLinks = computed(() => {
  const links = catalog?.value?.Category?.Links, mode = s.value.SubNav || 'auto'
  if (!links || mode === 'none') { return [] }
  if (links.Children?.length) { return links.Children }
  if (mode !== 'auto' || (links.Siblings?.length || 0) < 2) { return [] }
  return [...(s.value.SubNavAll && links.Parent ? [{ ...links.Parent, Id: -1, Name: w('Tout voir'), Image: links.Parent.Image || '' }] : []), ...links.Siblings]
})
// « Affichage 1 2 3 »: the visitor chooses how many products a line holds (the lists the shop chose, one for a computer and one for a phone, level by level). Kept in the browser for every
// category; without a choice, the grid has the columns of the section (or those of the staging of the category)
const levels = (value: unknown, fallback: string) => { const list = String(value || fallback).split(',').map(Number).filter(n => n >= 1 && n <= 8); return list.length ? list : fallback.split(',').map(Number) }
const viewDesk = computed(() => levels(s.value.ViewDesktop, '2,4,6'))
const viewMob = computed(() => levels(s.value.ViewMobile, '1,2,3'))
const viewCount = computed(() => Math.max(viewDesk.value.length, viewMob.value.length))
const viewLevel = ref<number | null>(null)
const baseCols = computed(() => ({ desk: Number(catalog?.value?.Listing?.Display?.Columns || s.value.Columns || 4), mob: Number(catalog?.value?.Listing?.Display?.ColumnsMobile || s.value.ColumnsMobile || 2) }))
const perRow = computed(() => {
  if (!s.value.ViewSwitch || viewLevel.value === null) { return baseCols.value }
  const at = viewLevel.value
  return { desk: viewDesk.value[Math.min(at, viewDesk.value.length - 1)]!, mob: viewMob.value[Math.min(at, viewMob.value.length - 1)]! }
})
// the level shown as chosen: the visitor's, else the one closest to the columns of the grid
const viewShown = computed(() => {
  if (viewLevel.value !== null) { return viewLevel.value }
  let best = 0
  viewDesk.value.forEach((n, i) => { if (Math.abs(n - baseCols.value.desk) < Math.abs(viewDesk.value[best]! - baseCols.value.desk)) { best = i } })
  return best
})
const chooseView = (at: number) => { viewLevel.value = at; try { localStorage.setItem('sf-view', String(at)) } catch { /* refused: the choice lasts for this page */ } }
onMounted(() => { if (type.value !== 'main_catalog' || !s.value.ViewSwitch) { return } try { const kept = Number(localStorage.getItem('sf-view')); if (localStorage.getItem('sf-view') !== null && kept >= 0 && kept < viewCount.value) { viewLevel.value = kept } } catch { /* no storage */ } })
// the size of the pictures of the sub-categories shown as a band of large images
const tileStyle = computed(() => ({ '--th': (s.value.SubTileHeight || 380) + 'px', '--thm': (s.value.SubTileHeightMobile || 220) + 'px', '--tw': (s.value.SubTileWidth || 200) + 'px', '--tg': (s.value.SubTileGap || 0) + 'px', '--tv': (s.value.SubTileVeil ?? 10) / 100 }))
const subStyle = computed(() => String(s.value.SubNavStyle || 'links'))
const listing = computed(() => (type.value === 'main_catalog' ? catalog?.value?.Listing || null : null))
const more = ref<any[]>([])   // the cards added under the page drawn by the server (staged items, or products)
const morePage = ref(0)   // the last page added (0: none)
const moreBusy = ref(false)
const moreFailed = ref(false)
let moreAuto = 0
const restored = ref<{ page: number, cards: any[] } | null>(null)   // the first cards the visitor saw, when the list he had scrolled is put back (return from a product)
watch(listing, () => { more.value = []; morePage.value = 0; moreAuto = 0; restored.value = null })   // another category, sort or filter
const baseCards = computed(() => restored.value?.cards || (listing.value ? (listing.value.Items || listing.value.Products) : []))
const basePage = computed(() => restored.value?.page || listing.value?.Page || 1)
const lastPage = computed(() => morePage.value || listing.value?.Page || 1)
const hasMore = computed(() => !!listing.value && lastPage.value < (listing.value.Pages || 1))
const shownItems = computed(() => (listing.value?.Items ? [...baseCards.value, ...more.value] : null))
const shownProducts = computed(() => (listing.value && !listing.value.Items ? [...baseCards.value, ...more.value] : []))
const shownCount = computed(() => {
  const L = listing.value
  if (!L) { return 0 }
  const here = shownItems.value ? shownItems.value.filter((i: any) => i.Kind === 'product').length : shownProducts.value.length
  return Math.min(L.Total || here, (basePage.value - 1) * (L.PerPage || 24) + here)
})
const cardKey = (entry: any) => (entry.Kind ? entry.Kind + (entry.Id || entry.Product?.Id) : 'product' + entry.Id)
const loadMore = async (auto = false) => {
  const L = listing.value
  if (moreBusy.value || !hasMore.value || !L) { return }
  moreBusy.value = true
  moreFailed.value = false
  const next = lastPage.value + 1
  try {
    const query: Record<string, string> = {}
    for (const [k, v] of Object.entries(route.query)) { if (typeof v === 'string') { query[k] = v } }
    const answer = await $fetch<any>('/api/storefront/view', { query: { ...query, rest: site.value?.Route?.Rest || '', lang: site.value?.Route?.LanguageIsoCode || '', prefix: site.value?.Route?.Prefix || '', page: String(next) } })
    const got = answer?.Listing
    if (!got) { throw new Error('no listing') }
    // the same kind of cards as the page drawn (a staged category gives items, the others products)
    const cards: any[] = L.Items ? (got.Items || (got.Products || []).map((p: any) => ({ Kind: 'product', Size: '1x1', Product: p }))) : (got.Products || (got.Items || []).filter((i: any) => i.Kind === 'product').map((i: any) => i.Product))
    const seen = new Set([...baseCards.value, ...more.value].map(cardKey))
    more.value = [...more.value, ...cards.filter(card => !seen.has(cardKey(card)))]
    morePage.value = next
    if (auto) { moreAuto++ }
    const address = listUrl({ page: next })
    history.replaceState({ ...(history.state || {}), current: address }, '', address)
  } catch {
    moreFailed.value = true
  } finally {
    moreBusy.value = false
  }
}
// how the next products come (site builder: « La suite des produits »): by themselves as the visitor scrolls (always, or for a few lots then a button), with a button, or as numbered pages
const loadMode = computed(() => (['auto', 'button', 'pages', 'auto_button'].includes(String(s.value.LoadMode)) ? String(s.value.LoadMode) : 'auto_button'))
const autoLimit = computed(() => (loadMode.value === 'auto' ? Infinity : loadMode.value === 'auto_button' ? Math.max(1, Math.min(10, Number(s.value.AutoPages) || 2)) : 0))
// numbered pages: the first, the last, and two around the open one (« … » between)
const pageList = computed(() => {
  const L = listing.value, total = L?.Pages || 1, at = L?.Page || 1, out: Array<number | null> = []
  for (let n = 1; n <= total; n++) { if (n === 1 || n === total || Math.abs(n - at) <= 2) { out.push(n) } else if (out[out.length - 1] !== null) { out.push(null) } }
  return out
})
const moreMark = ref<HTMLElement | null>(null)
let moreWatcher: IntersectionObserver | null = null
watch(moreMark, (el) => {
  moreWatcher?.disconnect()
  if (!el || typeof IntersectionObserver === 'undefined') { return }
  moreWatcher = new IntersectionObserver((entries) => { if (entries.some(e => e.isIntersecting) && moreAuto < autoLimit.value && !moreFailed.value) { loadMore(true) } }, { rootMargin: '600px 0px' })
  moreWatcher.observe(el)
})
onBeforeUnmount(() => moreWatcher?.disconnect())
// back from a product: the list comes back as the visitor left it (the pages he had loaded, where he was in it). What he loaded is kept for this tab only (sessionStorage), under the address of the
// page, for 30 minutes; it is put back only when the visitor comes BACK to that address (not when he opens it again), then the browser is told not to move the page itself
const keepKey = () => 'sf-list:' + location.pathname + location.search
const keepList = () => {
  if (!listing.value || !morePage.value) { return }
  try { sessionStorage.setItem(keepKey(), JSON.stringify({ at: Date.now(), page: basePage.value, cards: baseCards.value, more: more.value, morePage: morePage.value, auto: moreAuto, y: window.scrollY })) } catch { /* full or refused: the page simply comes back as the server draws it */ }
}
onMounted(() => {
  if (!listing.value) { return }
  window.addEventListener('pagehide', keepList)
  const navigation = performance.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined
  let kept: any = null
  try { kept = JSON.parse(sessionStorage.getItem(keepKey()) || 'null') } catch { kept = null }
  if (!kept || navigation?.type !== 'back_forward' || Date.now() - Number(kept.at || 0) > 30 * 60 * 1000 || !Array.isArray(kept.cards) || !Array.isArray(kept.more)) { return }
  if ('scrollRestoration' in history) { history.scrollRestoration = 'manual' }
  restored.value = { page: Number(kept.page) || 1, cards: kept.cards }
  more.value = kept.more
  morePage.value = Number(kept.morePage) || 0
  moreAuto = Number(kept.auto) || 0
  nextTick(() => requestAnimationFrame(() => window.scrollTo(0, Number(kept.y) || 0)))
})
onBeforeUnmount(() => { if (typeof window !== 'undefined') { keepList(); window.removeEventListener('pagehide', keepList) } })
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
        <!-- « Lien de la bannière »: a link under the blocks covers the whole banner; a button or a link of the blocks stays above it, with its own address -->
        <a v-if="s.Url" :href="s.Url" class="sf-area-link" :aria-label="areaLabel" />
        <div class="sf-hero-copy"><SfBlocks :blocks="blocks" :light="!!s.Image || !!vimeo(s.Video)" /></div>
      </div>

      <!-- a carousel: slides the visitor swipes through (scroll snap: no script is needed to read it) -->
      <div v-else-if="type === 'slideshow'" :style="picture"><SfSlides :slides="slides" :blocks="blocks" :settings="s" :first="first" /></div>

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
        <component :is="s.ImageUrl ? 'a' : 'div'" :href="s.ImageUrl || undefined" class="sf-split-img" :class="'is-' + (s.Ratio || 'portrait')" :aria-label="s.ImageUrl ? areaLabel : undefined"><img v-if="s.Image" :src="s.Image" alt="" loading="lazy" decoding="async"></component>
        <div :style="align"><SfBlocks :blocks="blocks" /></div>
      </div>

      <!-- columns: blocks side by side on a computer, laid out as the shop chose on a phone -->
      <div v-else-if="type === 'columns'" class="sf-cols" :class="{ 'is-reverse': columnsReverse, 'has-div': Number(s.ColDivider) > 0, 'is-stack': ratios(s.LayoutMobile, '1').length === 1 }" :style="columnsStyle">
        <div v-for="(column, i) in columnList" :key="i" class="sf-col" :class="['sf-col-' + (i + 1), { 'has-bg': !!s['C' + (i + 1) + 'Image'], 'has-link': !!s['C' + (i + 1) + 'Url'] }]" :style="columnPicture(i)">
          <!-- « Lien de la colonne »: the whole column is a link, under its blocks -->
          <a v-if="s['C' + (i + 1) + 'Url']" :href="s['C' + (i + 1) + 'Url']" class="sf-area-link" :aria-label="columnLabel(column)" />
          <SfBlocks :blocks="column" />
        </div>
      </div>

      <!-- sections whose own content is one block among the others -->
      <!-- the HTML the shop wrote (cleaned by Digipart: no script, frame, form or event) -->
      <div v-else-if="type === 'custom_html'" class="sf-custom" :style="align" v-html="customHtml" />
      <!-- a section the shop wrote in code (Liquid): drawn and cleaned by the server (server/utils/liquid.ts); in a preview, what went wrong is said in its place -->
      <div v-else-if="type === 'code'" class="sf-liquid">
        <div v-if="section.Html" v-html="section.Html" />
        <p v-else-if="section.Error" class="sf-liquid-error">{{ section.Error }}</p>
      </div>
      <div v-else-if="['richtext', 'products', 'lookbook', 'stories', 'reviews', 'newsletter', 'social', 'contact_form', 'store_locator'].includes(type)" :style="align">
        <SfBlocks :blocks="blocks">
          <div v-if="type === 'newsletter'" class="sf-news-wrap" :style="{ marginLeft: s.Align === 'left' ? 0 : 'auto', marginRight: s.Align === 'right' ? 0 : 'auto' }"><SfNewsletter :button="t.ButtonText" :look="buttonLook(s, 'Button')" /></div>
          <LazySfContact v-else-if="type === 'contact_form'" :settings="s" :texts="t" />
          <LazySfStores v-else-if="type === 'store_locator'" :settings="s" />
          <SfProducts v-else-if="type === 'products'" :section="section" />
          <LazySfLookbookFeature v-else-if="type === 'lookbook'" :id="Number(s.IdLookbook) || 0" :button="t.ButtonText" :height="s.Height" />
          <LazySfStories v-else-if="type === 'stories'" :place="catalog ? 'catalog' : product ? 'product' : 'home'" :product="product?.Id" :size="s.Size" :gap="s.Gap" :look="s.Look" :card-width="s.CardWidth" :previews="s.Previews !== false" :card-product="s.CardProduct !== false" />
          <LazySfReviews v-else-if="type === 'reviews'" :settings="s" />
          <SfSocial v-else-if="type === 'social'" :display="s.Display" :shape="s.Shape" :size="s.Size" :gap="s.Gap" :style="{ justifyContent: justify }" />
        </SfBlocks>
      </div>

      <!-- the header of the site -->
      <SfAnnounce v-else-if="type === 'announcement'" :blocks="blocks" :settings="s" />
      <div v-else-if="type === 'main_header'" class="sf-header" :class="{ 'has-border': s.Border, 'is-centered': s.LogoPosition === 'center', 'is-below': s.MenuPosition === 'below', 'is-drawer': s.MenuPosition === 'drawer' }" :style="{ '--h': (s.Height || 72) + 'px' }">
        <button type="button" class="sf-burger" :aria-label="w('Menu principal')" aria-haspopup="dialog" @click="navOpen = true"><span /><span /><span /></button>
        <a :href="home" class="sf-logo" :style="{ fontSize: Math.round((s.LogoHeight || 28) * 0.62) + 'px' }"><img v-if="logoFile" :src="logoFile.Src" :alt="site?.Name" :style="{ height: (s.LogoHeight || 28) + 'px', width: 'auto' }" :width="logoFile.Width ? Math.round(logoFile.Width * (s.LogoHeight || 28) / (logoFile.Height || 1)) : undefined" :height="s.LogoHeight || 28"><img v-else-if="logo" :src="logo.Src" :alt="site?.Name" :style="{ height: (s.LogoHeight || 28) + 'px' }" :width="logo.Width || undefined" :height="logo.Height || undefined"><template v-else>{{ site?.Name }}</template></a>
        <nav ref="navBox" class="sf-nav" :class="megaClass" :style="menuStyle" :aria-label="w('Menu principal')"><SfMenu :id="s.IdMenu" mode="nav" :split="s.MegaSplit === undefined ? 8 : Number(s.MegaSplit) || 0" /></nav>
        <div class="sf-hicons" :class="['is-d-' + iconDesk, 'is-m-' + iconMob, { 'has-icons': hasIcons }]" :style="{ fontSize: s.IconTextSize ? s.IconTextSize + 'px' : undefined, textTransform: s.IconCase === 'uppercase' ? 'uppercase' : undefined, letterSpacing: s.IconCase === 'uppercase' ? '.04em' : undefined }">
          <a :style="{ order: iconAt('search') }" v-if="s.ShowSearch" :href="searchUrl" :aria-label="hasIcons ? w('Recherche') : undefined" :aria-haspopup="s.SearchPanel !== false ? 'dialog' : undefined" @click="openSearch"><template v-if="hasIcons"><SfIcon class="sf-hi" :name="s.IconSearch || 'search'" :size="s.IconSize || 22" :stroke="s.IconStroke || 1.5" /><span class="sf-ht">{{ w('Recherche') }}</span></template><template v-else>{{ w('Recherche') }}</template></a><a :style="{ order: iconAt('account') }" v-if="s.ShowAccount" :href="accountUrl" class="sf-desk" :aria-label="hasIcons ? w('Compte') : undefined" @click.prevent="showPanel('account')"><template v-if="hasIcons"><SfIcon class="sf-hi" :name="s.IconAccount || 'user'" :size="s.IconSize || 22" :stroke="s.IconStroke || 1.5" /><span class="sf-ht">{{ customer && !customer.Guest ? customer.Firstname : w('Compte') }}</span></template><template v-else>{{ customer && !customer.Guest ? customer.Firstname : w('Compte') }}</template></a><a :style="{ order: iconAt('wishlist') }" v-if="s.ShowWishlist" :href="favoritesUrl" class="sf-desk" :aria-label="hasIcons ? w('Favoris') : undefined" @click.prevent="showPanel('favorites')"><SfIcon v-if="hasIcons" class="sf-hi" :name="s.IconWishlist || 'heart'" :size="s.IconSize || 22" :stroke="s.IconStroke || 1.5" /><span :class="hasIcons ? 'sf-ht' : undefined">{{ w('Favoris') }}<template v-if="favorites.length"> ({{ favorites.length }})</template></span><b v-if="hasIcons && favorites.length" class="sf-hbadge">{{ favorites.length }}</b></a><button :style="{ order: iconAt('cart') }" v-if="s.ShowCart" type="button" class="sf-cartlink" :aria-label="w('Ouvrir le panier, {a} article(s)', { a: cart.Count })" @click="showPanel('cart')"><SfIcon v-if="hasIcons" class="sf-hi" :name="s.IconCart || 'shopping-bag'" :size="s.IconSize || 22" :stroke="s.IconStroke || 1.5" /><span :class="hasIcons ? 'sf-ht' : undefined">{{ w('Panier') }} ({{ cart.Count }})</span><b v-if="hasIcons && cart.Count" class="sf-hbadge">{{ cart.Count }}</b></button>
          <span :style="{ order: iconAt('language') }" v-if="s.ShowLanguage && (site?.Languages || []).length > 1" class="sf-langs"><a v-for="language in site.Languages" :key="language.LanguageIsoCode" :href="langHref(language)" :aria-current="language.LanguageIsoCode === site.Route.LanguageIsoCode ? 'true' : undefined">{{ language.LanguageIsoCode.toUpperCase() }}</a></span>
        </div>
      </div>

      <LazySfFilters v-if="type === 'main_catalog' && catalog && filtersOpen" :filters="catalog.Listing.Filters" :currency="catalog.Listing.Products[0]?.Currency || 'EUR'" :settings="s" :texts="t" @close="filtersOpen = false" @apply="applyFilters" />
      <ClientOnly v-if="type === 'main_header'"><LazySfNavDrawer v-if="navOpen" :id="s.IdMenu" :mode="s.DrawerStyle" @close="navOpen = false" /></ClientOnly>

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
        <div class="sf-fbottom"><span>{{ t.Copyright }}</span>
          <a v-if="s.ShowLanguage !== false && s.LanguageStyle === 'region'" :href="regionUrl" rel="nofollow" class="sf-region-link">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" /></svg>
            <span v-if="regionName">{{ regionName }}</span><span v-if="regionName" aria-hidden="true">|</span><span>{{ languageName }}</span><template v-if="regionCurrency"><span aria-hidden="true">|</span><span>{{ regionCurrency }}</span></template>
          </a>
        </div>
      </div>

      <!-- a category of the catalogue: its name, its description, the sort, its products, the pages -->
      <LazySfCartPage v-else-if="type === 'main_cart'" :settings="s" :texts="t" />
      <LazySfSearch v-else-if="type === 'main_search' && searchResults" :key="route.fullPath" :search="searchResults" :settings="s" :texts="t" />
      <LazySfNotFound v-else-if="type === 'main_404'" :settings="s" :texts="t" />
      <LazySfLook v-else-if="type === 'main_look' && lookData" :look="lookData" :settings="s" :texts="t" />
      <div v-else-if="type === 'main_catalog' && catalog">
        <div v-if="hasCover" class="sf-hero sf-catcover" :class="{ 'is-full': s.CoverFull }" :style="{ '--h': (s.CoverHeight || 280) + 'px', '--hm': (s.CoverHeightMobile || 180) + 'px', '--shade': (s.CoverVeil ?? 20) / 100, '--pad': '24px', '--jc': ({ top: 'flex-start', bottom: 'flex-end' } as Record<string, string>)[s.CoverPosition] || 'center', color: '#fff', textAlign: s.CoverAlign || 'center' }">
          <picture v-if="catalogCover"><img :src="catalogCover.Src" :srcset="catalog.Category.Cover.Sizes.map((c: any) => c.Src + ' ' + c.Width + 'w').join(', ')" sizes="100vw" alt="" fetchpriority="high" decoding="async"></picture>
          <span v-if="vimeo(catalog.Category.Cover?.Video)" class="sf-hero-video"><iframe :src="vimeo(catalog.Category.Cover.Video)" title="" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" tabindex="-1" aria-hidden="true" /></span>
          <div v-if="s.CoverTitle === 'over' || coverText" class="sf-hero-copy">
            <component :is="titleTag" v-if="s.CoverTitle === 'over'" class="sf-h" :style="titleStyle">{{ catalog.Category.Name }}</component>
            <!-- eslint-disable-next-line vue/no-v-html : the description of a category is written by the shop in Digipart and comes from its category API -->
            <div v-if="coverText" class="sf-rte" v-html="catalog.Category.Description" />
          </div>
        </div>
        <nav class="sf-crumb" :aria-label="w('Fil d\'Ariane')"><a :href="home">{{ w('Accueil') }}</a> / <template v-if="catalog.Category.Links?.Parent"><a :href="catalog.Category.Links.Parent.Url">{{ catalog.Category.Links.Parent.Name }}</a> / </template>{{ catalog.Category.Name }}</nav>
        <component :is="titleTag" v-if="!(s.CoverTitle === 'over' && hasCover)" class="sf-h" :style="titleStyle">{{ catalog.Category.Name }}</component>
        <!-- eslint-disable-next-line vue/no-v-html : the description of a category is written by the shop in Digipart and comes from its category API -->
        <div v-if="s.ShowDescription && catalog.Category.Description && !coverText" class="sf-rte sf-muted" v-html="catalog.Category.Description" />
        <!-- the sub-categories of the category, or (when it has none and the shop chose so) the categories next to it, the open one put forward: real links, read by the search engines -->
        <nav v-if="subLinks.length" class="sf-subnav" :class="['is-' + subStyle, { 'is-full': subStyle === 'tiles' && s.SubTileFull !== false, 'is-upper': s.SubNavCase === 'uppercase', 'is-below': s.SubTileLabel === 'below' }]" :style="subStyle === 'tiles' ? tileStyle : undefined" :aria-label="w(subOwn ? 'Sous-catégories' : 'Catégories')">
          <a v-for="link in subLinks" :key="link.Id" :href="link.Url" :aria-current="link.Id === catalog.Category.Id ? 'page' : undefined">
            <img v-if="subStyle === 'images'" :src="link.Image || undefined" alt="" loading="lazy" decoding="async" :class="{ 'is-empty': !link.Image }">
            <span v-if="subStyle === 'tiles'" class="sf-subtile-pic" :class="{ 'is-empty': !link.Image }"><img v-if="link.Image" :src="link.Image" :srcset="link.Srcset || undefined" :sizes="`(max-width: 767px) 45vw, ${Math.max(10, Math.round(100 / Math.max(1, subLinks.length)))}vw`" alt="" loading="lazy" decoding="async"></span>
            <span class="sf-subnav-name">{{ link.Name }}<small v-if="s.SubNavCount && link.Count"> {{ link.Count }}</small></span>
          </a>
        </nav>
        <div class="sf-bar">
          <span>{{ w(catalog.Listing.Total > 1 ? '{a} produits' : '{a} produit', { a: catalog.Listing.Total }) }}</span>
          <button v-if="hasFilters" type="button" class="sf-filterbtn" :class="{ 'is-phone': sideFilters }" aria-haspopup="dialog" @click="filtersOpen = true">{{ w('Filtrer') }}<template v-if="filterCount"> ({{ filterCount }})</template></button>
          <nav v-if="s.ShowSort" class="sf-sort" :aria-label="w('Trier les produits')">
            <a :href="listUrl({ sort: '', page: 1 })" :aria-current="!catalog.Listing.Sort ? 'true' : undefined">{{ w('Sélection') }}</a>
            <a :href="listUrl({ sort: 'newest', page: 1 })" :aria-current="catalog.Listing.Sort === 'newest' ? 'true' : undefined">{{ w('Nouveautés') }}</a>
            <a :href="listUrl({ sort: 'price_asc', page: 1 })" :aria-current="catalog.Listing.Sort === 'price_asc' ? 'true' : undefined">{{ w('Prix croissant') }}</a>
            <a :href="listUrl({ sort: 'price_desc', page: 1 })" :aria-current="catalog.Listing.Sort === 'price_desc' ? 'true' : undefined">{{ w('Prix décroissant') }}</a>
          </nav>
          <div v-if="s.ViewSwitch" class="sf-view" role="group" :aria-label="w('Produits par ligne')">
            <span>{{ w('Affichage') }}</span>
            <button v-for="i in viewCount" :key="i" type="button" :aria-pressed="viewShown === i - 1 ? 'true' : 'false'" :title="w('{a} produits par ligne', { a: viewDesk[Math.min(i - 1, viewDesk.length - 1)] })" @click="chooseView(i - 1)">{{ i }}</button>
          </div>
        </div>
        <!-- the filters in a column beside the products (computer; on a phone it is the « Filtrer » button and its panel) -->
        <div class="sf-catalog-body" :class="{ 'has-side': sideFilters }" :style="sideFilters ? { '--fw': (s.FilterWidth || 260) + 'px' } : undefined">
          <aside v-if="sideFilters" class="sf-catalog-side" :aria-label="w('Filtres')"><SfFilters :filters="catalog.Listing.Filters" :currency="catalog.Listing.Products[0]?.Currency || 'EUR'" :settings="s" :texts="t" inline @apply="applyFilters" /></aside>
          <div class="sf-catalog-main">
        <a v-if="basePage > 1 && loadMode !== 'pages'" :href="listUrl({ page: basePage - 1 })" rel="prev" class="sf-loadmore-prev">{{ w('Voir les produits précédents') }}</a>
        <div v-if="shownItems ? shownItems.length : shownProducts.length" class="sf-grid" :style="{ '--cols': perRow.desk, '--cols-m': perRow.mob, '--gx': (s.GapX ?? 16) + 'px', '--gy': (s.GapY ?? 32) + 'px' }">
          <template v-if="shownItems">
            <template v-for="(item, index) in shownItems" :key="cardKey(item)">
              <component :is="item.Url ? 'a' : 'div'" v-if="item.Kind === 'edito'" :href="item.Url || undefined" class="sf-edito" :class="['is-' + item.Size, { 'has-height': item.Height > 0 || item.HeightMobile > 0 }]" :style="item.Height > 0 || item.HeightMobile > 0 ? { '--eh': (item.Height || item.HeightMobile) + 'px', '--ehm': (item.HeightMobile || item.Height) + 'px' } : undefined">
                <img v-if="item.Image" :src="item.Image" alt="" :loading="index < 4 ? 'eager' : 'lazy'" decoding="async">
                <span v-if="vimeo(item.Video)" class="sf-hero-video"><iframe :src="vimeo(item.Video)" title="" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" tabindex="-1" aria-hidden="true" /></span>
                <span v-if="item.Title" class="sf-edito-title">{{ item.Title }}</span>
              </component>
              <SfProductCard v-else :product="item.Product" :count="item.Count" :images="item.Size === 'full' ? (item.Layout === 'cover' ? 'wide' : 'row') : item.Size === '2x2' ? 'carousel' : s.CardImages" :dots="item.Size === '2x2' ? true : s.CardDots" :eager="index < 4" :quick="s.QuickAdd !== false" :video="item.Video" :per-row="perRow" :span="item.Size === 'full' ? 'full' : String(item.Size || '1x1').split('x')[0]" :class="'is-' + item.Size" />
            </template>
          </template>
          <SfProductCard v-for="(item, index) in shownProducts" v-else :key="item.Id" :product="item" :images="s.CardImages" :dots="s.CardDots" :eager="index < 4" :quick="s.QuickAdd !== false" :per-row="perRow" />
        </div>
        <p v-else class="sf-muted">{{ w('Aucun produit dans cette catégorie pour le moment.') }}</p>
        <!-- more products: a real link to the next page (followed by the search engines, and by a visitor without script), read in place by the page -->
        <nav v-if="catalog.Listing.Pages > 1 && loadMode === 'pages'" class="sf-pages is-numbers" :aria-label="w('Pages de produits')">
          <a v-if="catalog.Listing.Page > 1" :href="listUrl({ page: catalog.Listing.Page - 1 })" rel="prev" :aria-label="w('Page précédente')">‹</a>
          <template v-for="(n, i) in pageList" :key="n === null ? 'gap' + i : n">
            <span v-if="n === null" class="sf-pages-gap">…</span>
            <a v-else :href="listUrl({ page: n })" :aria-current="n === catalog.Listing.Page ? 'page' : undefined">{{ n }}</a>
          </template>
          <a v-if="catalog.Listing.Page < catalog.Listing.Pages" :href="listUrl({ page: catalog.Listing.Page + 1 })" rel="next" :aria-label="w('Page suivante')">›</a>
        </nav>
        <div v-else-if="catalog.Listing.Pages > 1" class="sf-loadmore">
          <p v-if="s.LoadCount !== false" class="sf-loadmore-count" aria-live="polite">{{ w('Vous avez vu {a} produits sur {b}', { a: shownCount, b: catalog.Listing.Total }) }}</p>
          <span v-if="s.LoadCount !== false" class="sf-loadmore-bar" aria-hidden="true"><i :style="{ width: Math.min(100, Math.round(shownCount * 100 / Math.max(1, catalog.Listing.Total))) + '%' }" /></span>
          <span v-if="hasMore && autoLimit > 0" ref="moreMark" class="sf-loadmore-mark" />
          <a v-if="hasMore" :href="listUrl({ page: lastPage + 1 })" rel="next" class="sf-btn is-outline sf-loadmore-btn" :aria-busy="moreBusy ? 'true' : undefined" @click.prevent="loadMore()">{{ moreBusy ? w('Chargement…') : moreFailed ? w('Réessayer') : w('Voir plus de produits') }}</a>
        </div>
          </div>
        </div>
      </div>

      <!-- a product: its photos beside its blocks (name, price, sizes, buy button, description...) in the order the shop gave them -->
      <div v-else-if="type === 'main_product' && product" class="sf-pdp" :class="{ 'is-reverse': s.GalleryPosition === 'right', 'is-msheet': s.MobileSizes === 'sheet' }" :style="pdp">
        <SfGallery :images="product.Images" :sets="product.ImageSets" :name="product.Name" :layout="s.GalleryLayout" :per-view="Number(s.GalleryPerView) || 2" :arrows="s" :thumbs="s.GalleryThumbs" :fit="s.GalleryFit" :scroll="s.GalleryScroll" @zoom="zoomAt = $event" />
        <!-- the column is as tall as the photos; inside it the blocks follow the scroll (when the shop asked) and stop where the section ends, before the next one -->
        <div class="sf-info-col" :class="{ 'is-sticky': s.InfoSticky !== false, 'is-center': s.InfoY === 'center' }"><div ref="infoBox" class="sf-info" :style="info"><SfBlocks :blocks="blocks" /></div></div>
        <LazySfZoom v-if="zoomAt >= 0" :images="product.Images" :start="zoomAt" :name="product.Name" @close="zoomAt = -1" />
      </div>

      <!-- a content page of the shop: its title and its text, written in the Pages tab of Digipart -->
      <article v-else-if="type === 'main_page' && page" :style="align">
        <component :is="titleTag" v-if="s.ShowTitle" class="sf-h" :style="{ '--size': ({ xl: 42, lg: 34, md: 26, sm: 19 } as Record<string, number>)[s.TitleSize || 'md'] + 'px', fontWeight: s.TitleWeight || 600, textTransform: s.TitleCase === 'uppercase' ? 'uppercase' : undefined, textAlign: s.TitleAlign, marginBottom: (s.TitleGap ?? 20) + 'px' }">{{ page.Title }}</component>
        <!-- eslint-disable-next-line vue/no-v-html : the HTML of a page is cleaned by Digipart (an allow-list of tags) when it is saved and again when the API gives it -->
        <div class="sf-rte" :style="{ fontSize: (s.TextSize || 15) + 'px', lineHeight: s.TextLine || 1.7 }" v-html="page.Content" />
      </article>
    </div>
  </section>
</template>
