<script setup lang="ts">
const searchOpen = useState<boolean>('sf-search-open', () => false)
const adminLinks = useState<{ Label: string, Path: string }[]>('sf-admin-links', () => [])   // set by the page shown (SfView.vue)
// The frame of every page of the site: the theme (its settings as CSS variables on <html>), the header and the footer written in Digipart, and between them the page of the address.
const route = useRoute()
const preview = computed(() => (typeof route.query.preview === 'string' ? route.query.preview : ''))
const here = computed(() => route.path)
// the site builder of Digipart shows the site in a frame and asks it to read the drafts again after each save (app/plugins/builder.client.ts): `fresh` changes, the site and the page are read anew
const fresh = useState<number>('sf-fresh', () => 0)
const { data: site, error } = await useFetch<any>('/api/storefront/site', { query: { path: computed(() => route.path), preview, fresh: computed(() => fresh.value || undefined), closed: computed(() => route.query.closed || undefined) }, key: 'sf-site' })
provide('sfSite', site)
setCurrencySigns(site.value?.CurrencySigns)
watch(() => site.value?.CurrencySigns, setCurrencySigns)
const langHref = useLanguageHref(site)
// the menus of Digipart the header and the footer name (0 = the main menu), read once here for the whole page: the header and the footer columns only draw them
const menuIds = computed(() => {
  const ids = new Set<number>()
  for (const part of [site.value?.Header, site.value?.Footer]) {
    for (const section of part?.Sections || []) {
      if (section.Type === 'main_header') { ids.add(Number(section.Settings?.IdMenu) || 0) }
      for (const block of section.Blocks || []) { if (block.Type === 'f_menu') { ids.add(Number(block.Settings?.IdMenu) || 0) } }
    }
  }
  return [...ids]
})
const menuLang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const { data: menus } = await useAsyncData('sf-menus', async () => {
  const list = await Promise.all(menuIds.value.map(id => $fetch<any>('/api/storefront/menu', { query: { id, lang: menuLang.value } }).catch(() => ({ Tabs: [] }))))
  return Object.fromEntries(menuIds.value.map((id, index) => [id, list[index]]))
}, { watch: [menuLang] })
provide('sfMenus', menus)

// A closed site shows the page « Maintenance » or « Bientôt disponible » set in Digipart (Configuration > Paramètres > Site): `Status`, the object of api/settings. It is still shown to whoever holds
// a preview link, and to the visitors whose address the shop allowed (`Bypass`). Without `Status` (settings not read), the state of the site alone decides.
const status = computed(() => site.value?.Status || null)
const stickyHeader = computed(() => (site.value?.Header?.Sections || []).some((section: any) => section.Type === 'main_header' && section.Settings?.Sticky !== false))
// how tall the header is while it stays at the top of the window: what follows the scroll under it (the buying column of a product) starts below it
const headerBox = ref<HTMLElement | null>(null)
onMounted(() => {
  const set = () => document.documentElement.style.setProperty('--sf-head', (stickyHeader.value && headerBox.value ? headerBox.value.offsetHeight : 0) + 'px')
  set()
  if (typeof ResizeObserver !== 'undefined' && headerBox.value) { new ResizeObserver(set).observe(headerBox.value) }
})
// the header over the banner of the home page: transparent, in white, until the visitor scrolls (then it is the usual header)
const overHero = computed(() => !!site.value?.Route?.OverHero)
// the header over the photo of a product page, without its logo, until the visitor scrolls or points at it
const overProduct = computed(() => !!site.value?.Route?.OverProduct)
const scrolled = ref(false)
onMounted(() => {
  const look = () => { scrolled.value = window.scrollY > 24 }
  look()
  window.addEventListener('scroll', look, { passive: true })   // the frame of the site lives as long as the page
})
const ordering = computed(() => ['commande', 'checkout', 'commande/merci', 'checkout/thanks'].includes(site.value?.Route?.Rest || ''))
// the order page has its own small header: the logo of the shop (the SVG, else the image), as in the header of the site; the name only when the shop has no logo
const orderLogo = computed(() => shopLogo(site.value))
// the page « Choix du pays » stands alone
const choosing = computed(() => ['pays-et-langue', 'country-and-language'].includes(site.value?.Route?.Rest || ''))
const closed = computed(() => !!site.value && !site.value.Preview && (status.value ? !status.value.IsLive && status.value.Bypass !== true : site.value.State !== 'online'))
const closedPage = computed(() => (closed.value ? status.value?.Page || null : null))
// the page of a closed site drawn in the site builder of Digipart (`ClosedDesign`: sections, as any page), in place of the page of the settings. A preview opened by the builder on that page
// (`ClosedForced`) shows it whatever the state of the site.
const closedDesign = computed(() => ((closed.value || site.value?.ClosedForced) && site.value?.ClosedDesign?.Sections?.length ? site.value.ClosedDesign : null))
const cover = computed(() => closedPage.value?.Cover || null)
const logo = computed(() => { const images = closedPage.value?.Logo?.Images || {}; const first = (Object.values(images)[0] as any[]) || []; return first[0] ? { src: first[0].Src, width: closedPage.value.Logo.Width } : null })
const reopen = computed(() => (closedPage.value?.ShowReopenAt && closedPage.value.ReopenAt ? new Intl.DateTimeFormat(site.value.Route.LanguageIsoCode, { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(closedPage.value.ReopenAt)) : ''))
const style = computed(() => Object.entries(site.value?.Theme?.Variables || {}).map(([name, value]) => name + ':' + value).join(';'))
// the colour schemes of the theme: each one redefines the colour variables inside the sections that take it (SfSection: `sf-scheme-<id>`). Only ids, variable names and colours of the expected shape are written.
const schemesCss = computed(() => (Array.isArray(site.value?.Theme?.Schemes) ? site.value.Theme.Schemes : []).filter((scheme: any) => /^sch_[a-z0-9]{4,12}$/.test(String(scheme?.Id || ''))).map((scheme: any) => '.sf-scheme-' + scheme.Id + '{'
  + Object.entries(scheme.Variables || {}).filter(([name, value]) => /^--t-[a-z-]+$/.test(name) && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value))).map(([name, value]) => name + ':' + value).join(';') + '}').join(''))
useHead(() => ({
  htmlAttrs: { lang: site.value?.Route?.LanguageIsoCode || 'fr', style: style.value },
  // the fonts of the theme, served by this site: their rules are written in the page (nothing to fetch before it is drawn) and their files are asked for at once (server/utils/fonts.ts)
  // the CSS the shop wrote for the whole site (Réglages du thème > CSS personnalisé; cleaned by Digipart)
  style: [...(site.value?.FontCss ? [{ key: 'sf-fonts', innerHTML: site.value.FontCss }] : []), ...(schemesCss.value ? [{ key: 'sf-schemes', innerHTML: schemesCss.value }] : []), ...(site.value?.Theme?.CustomCss ? [{ key: 'sf-custom-css', innerHTML: String(site.value.Theme.CustomCss), tagPosition: 'bodyClose' as const }] : [])],   // at the end of the page: after the style sheet of the site, whatever the order they load in, so what the shop wrote wins
  link: [
    ...(site.value?.FontFiles || []).map((href: string) => ({ rel: 'preload', as: 'font', type: 'font/woff2', href, crossorigin: 'anonymous' })),
    // the icon of the browser tab (Configuration > Thème de la boutique > Favicon): the SVG when there is one, the picture for the browsers that do not read it
    ...(site.value?.LogoFiles?.FaviconImage?.Src ? [{ key: 'sf-icon', rel: 'icon', href: site.value.LogoFiles.FaviconImage.Src, sizes: 'any' }, { key: 'sf-touch', rel: 'apple-touch-icon', href: site.value.LogoFiles.FaviconImage.Src }] : []),
    ...(site.value?.LogoFiles?.Favicon?.Src && site.value.LogoFiles.Favicon.Format === 'svg' ? [{ key: 'sf-icon-svg', rel: 'icon', type: 'image/svg+xml', href: site.value.LogoFiles.Favicon.Src }] : site.value?.LogoFiles?.Favicon?.Src ? [{ key: 'sf-icon-png', rel: 'icon', href: site.value.LogoFiles.Favicon.Src }] : []),
  ],
  // the next page is prepared while the visitor points at its link (browsers that know « speculation rules »: Chrome, Edge): the click then shows it at once. Never for what belongs to
  // one visitor or does something (cart, order, account, short links), nor in a theme preview.
  script: site.value?.Preview ? [] : [{ key: 'sf-speculation', type: 'speculationrules', innerHTML: JSON.stringify({ prerender: [{ where: { and: [{ href_matches: '/*' }, { not: { href_matches: ['/*panier*', '/*cart*', '/*commande*', '/*checkout*', '/*compte*', '/*account*', '/*favoris*', '/*wishlist*', '/s/*', '/*parrainage*', '/*referral*', '/*reset*', '/*\\?*'] } }, { not: { selector_matches: '[target], [download], [rel~=nofollow]' } }] }, eagerness: 'moderate' }] }) }],
  titleTemplate: (title?: string) => (title ? title + ' · ' : '') + (site.value?.Name || ''),
  meta: (closed.value && closedPage.value?.NoIndex !== false) || site.value?.Preview ? [{ name: 'robots', content: 'noindex, nofollow' }] : [],
}))
if (import.meta.server && closed.value) {
  const event = useRequestEvent()!
  setResponseStatus(event, closedPage.value?.HttpStatus || (site.value.State === 'maintenance' ? 503 : 200))
  if (closedPage.value?.RetryAfterSeconds) { setResponseHeader(event, 'Retry-After', String(closedPage.value.RetryAfterSeconds)) }
}
</script>

<template>
  <main v-if="error || !site" class="sf-note">
    <h1>{{ error?.statusMessage === 'setup' ? 'Ce site n\'est pas encore relié à Digipart' : 'Le site est momentanément indisponible' }}</h1>
    <p>{{ error?.statusMessage === 'setup' ? 'Renseignez l\'adresse de Digipart, le canal de vente et la clé du site dans son environnement, puis redémarrez-le.' : 'Merci de revenir dans quelques instants.' }}</p>
  </main>
  <!-- the page of a closed site drawn in the site builder: its sections, alone (no header, no footer) -->
  <main v-else-if="closedDesign" class="sf-closed-design"><SfSection v-for="(section, index) in closedDesign.Sections" :key="section.Id" :section="section" :first="index === 0" /></main>
  <!-- the page of a closed site, as the shop set it in Digipart: cover, logo, title, message, date, button, newsletter box, social links -->
  <main v-else-if="closedPage" class="sf-closed" :style="{ background: cover?.BackgroundColor, color: closedPage.Style.TextColor }">
    <img v-if="cover?.Type === 'image'" class="sf-closed-cover" :src="cover.ImageURL" alt="" fetchpriority="high">
    <iframe v-else-if="cover?.Type === 'video'" class="sf-closed-cover" :src="cover.VideoBackgroundURL" title="" allow="autoplay; fullscreen" tabindex="-1" aria-hidden="true" />
    <span v-if="cover && cover.Type !== 'color'" class="sf-closed-veil" :style="{ background: cover.OverlayColor, opacity: cover.OverlayOpacity / 100 }" />
    <div class="sf-closed-copy">
      <img v-if="logo" :src="logo.src" :alt="site.Name" :style="{ width: logo.width + 'px' }" class="sf-closed-logo">
      <h1 :style="{ fontSize: 'clamp(22px, 6vw, ' + closedPage.Style.TitleSize + 'px)', textTransform: closedPage.Style.TitleUppercase ? 'uppercase' : undefined }">{{ closedPage.Title || site.Name }}</h1>
      <p v-if="closedPage.Message" :style="{ fontSize: closedPage.Style.MessageSize + 'px', textTransform: closedPage.Style.MessageUppercase ? 'uppercase' : undefined }">{{ closedPage.Message }}</p>
      <p v-if="reopen" class="sf-closed-date">{{ reopen }}</p>
      <a v-if="closedPage.Button" :href="closedPage.Button.URL" class="sf-btn" :style="{ background: closedPage.Button.BackgroundColor, color: closedPage.Button.TextColor, fontSize: closedPage.Button.Size + 'px', textTransform: closedPage.Button.Uppercase ? 'uppercase' : undefined }">{{ closedPage.Button.Label }}</a>
      <SfNewsletter v-if="closedPage.NewsletterSignup" :lang="site.Route.LanguageIsoCode" />
      <nav v-if="closedPage.SocialLinks?.length" class="sf-closed-social" aria-label="Réseaux sociaux"><a v-for="link in closedPage.SocialLinks" :key="link.Name" :href="link.URL" rel="noopener" target="_blank">{{ link.Name }}</a></nav>
    </div>
  </main>
  <main v-else-if="closed" class="sf-note">
    <h1>{{ site.Name }}</h1>
    <p>{{ site.State === 'maintenance' ? 'Le site est en maintenance : nous revenons très vite.' : 'Le site ouvre bientôt.' }}</p>
  </main>
  <template v-else>
    <!-- the order page keeps the visitor on the order: a slim bar instead of the menu, no footer -->
    <header v-if="ordering" class="sf-cohead"><a :href="site.Route.Prefix || '/'">‹ {{ words(site.Route.LanguageIsoCode, 'Continuer mes achats') }}</a><a :href="site.Route.Prefix || '/'" class="sf-logo"><img v-if="orderLogo" :src="orderLogo" :alt="site.Name"><template v-else>{{ site.Name }}</template></a><span /></header>
    <header v-else-if="site.Header && !choosing" ref="headerBox" :class="{ 'sf-sticky': stickyHeader, 'sf-over': overHero || overProduct, 'is-bare': overProduct, 'is-solid': (overHero || overProduct) && scrolled }"><SfSection v-for="section in site.Header.Sections" :key="section.Id" :section="section" /></header>
    <NuxtPage />
    <ClientOnly><LazySfCart /></ClientOnly>
    <!-- the search panel (opened by the search of the header) -->
    <ClientOnly><LazySfSearchPanel v-if="searchOpen" /></ClientOnly>
    <footer v-if="site.Footer && !ordering && !choosing"><SfSection v-for="section in site.Footer.Sections" :key="section.Id" :section="section" /></footer>
    <!-- the bar of a preview: which theme is shown, in which language, and the way out. Only whoever holds a preview link sees it. -->
    <SfPreviewBar v-if="site.Preview && route.query.builder === undefined" :site="site" :here="here" :lang-href="langHref" />
  </template>
</template>
