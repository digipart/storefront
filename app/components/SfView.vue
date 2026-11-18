<script setup lang="ts">
// What an address of the site shows (the two pages of the engine use it): the home page, or a content page of the shop drawn with the design of its page template.
const route = useRoute()
const site = inject<Ref<any>>('sfSite')!
const { data: loaded, error } = await useFetch<any>('/api/storefront/view', {
  query: { rest: computed(() => site.value?.Route?.Rest || ''), lang: computed(() => site.value?.Route?.LanguageIsoCode || ''), prefix: computed(() => site.value?.Route?.Prefix || ''), preview: computed(() => (typeof route.query.preview === 'string' ? route.query.preview : '')),
    page: computed(() => (typeof route.query.page === 'string' ? route.query.page : '')), q: computed(() => (typeof route.query.q === 'string' ? route.query.q : '')), attr: computed(() => (typeof route.query.attr === 'string' ? route.query.attr : '')), min: computed(() => (typeof route.query.min === 'string' ? route.query.min : '')), max: computed(() => (typeof route.query.max === 'string' ? route.query.max : '')), sort: computed(() => (typeof route.query.sort === 'string' ? route.query.sort : '')) },
  key: computed(() => 'sf-view-' + route.fullPath),
})
// an address that is nothing of the site: the page « Page introuvable » of the site builder is drawn (the answer stays a 404 for the search engines); only when even that cannot be read is the error page shown
const missing = ref<any>(null)
if (error.value?.statusCode === 404) {
  const { data: notFound } = await useFetch<any>('/api/storefront/view', { query: { notfound: '1', lang: computed(() => site.value?.Route?.LanguageIsoCode || ''), prefix: computed(() => site.value?.Route?.Prefix || ''), preview: computed(() => (typeof route.query.preview === 'string' ? route.query.preview : '')) }, key: 'sf-404-' + route.fullPath })
  if (notFound.value) { missing.value = notFound.value; if (import.meta.server) { setResponseStatus(useRequestEvent()!, 404) } }
}
const view = computed(() => loaded.value || missing.value)
if (error.value && !missing.value) { throw createError({ statusCode: error.value.statusCode || 500, statusMessage: error.value.statusCode === 404 ? 'Page introuvable' : 'Le site est momentanément indisponible', fatal: true }) }
provide('sfPage', computed(() => view.value?.Page || null))
provide('sfProduct', computed(() => view.value?.Product || null))
provide('sfSearch', computed(() => (view.value?.Kind === 'search' ? view.value.Search : null)))
provide('sfCatalog', computed(() => (view.value?.Kind === 'catalog' ? { Category: view.value.Category, Listing: view.value.Listing } : null)))
const w = useWords()
// ---- for the search engines and the social networks: the one address of the page, the same page in the other languages, how it looks when shared, and what it is (a product, a path) ----
const origin = computed(() => site.value?.Origin || useRequestURL().origin)   // the address the visitor wrote (behind a proxy the request itself names another)
const prefixOf = (iso: string) => (iso !== site.value?.DefaultLanguageIsoCode || site.value?.UrlPrefix === 'always' ? '/' + iso : '')
const rest = computed(() => site.value?.Route?.Rest || '')
// the path of this page in each language of the site (without the language part); null = not a page to index
const paths = computed<Record<string, string> | null>(() => {
  const isos: string[] = (site.value?.Languages || []).map((l: any) => l.LanguageIsoCode), kind = view.value?.Kind, here = site.value?.Route?.LanguageIsoCode || 'fr'
  const all = (path: string) => Object.fromEntries(isos.map(iso => [iso, path]))
  const known = (alternates: Record<string, string> | undefined, own: string) => { const out: Record<string, string> = { [here]: own }; for (const iso of isos) { if (alternates?.[iso]) { out[iso] = alternates[iso] } } return out }
  if (kind === 'home') { return all('') }
  if (kind === 'product') { return known(view.value.Product.Alternates, view.value.Product.Canonical || rest.value) }
  if (kind === 'catalog') { return known(view.value.Category.Alternates, rest.value) }
  if (kind === 'page') { return known(view.value.Page?.Slugs, rest.value) }
  if (kind === 'lookbook') { return known(view.value.Lookbook.Alternates, rest.value) }
  if (kind === 'brand') { return known(view.value.Brand.Alternates, rest.value) }
  if (kind === 'brands') { return known(undefined, rest.value) }
  if (kind === 'look') { return known(undefined, rest.value) }
  return null
})
const address = (iso: string, path: string) => origin.value + prefixOf(iso) + (path ? '/' + path : (prefixOf(iso) ? '' : '/'))
const canonical = computed(() => { const here = site.value?.Route?.LanguageIsoCode || 'fr'; const page = Number(route.query.page) > 1 && view.value?.Kind === 'catalog' ? '?page=' + Number(route.query.page) : ''; return paths.value ? address(here, paths.value[here] ?? rest.value) + page : '' })
const shareImage = computed(() => view.value?.Product?.Images?.[0] || site.value?.Preferences?.SocialImage || '')
const structured = computed(() => {
  const list: any[] = []
  const product = view.value?.Kind === 'product' ? view.value.Product : null
  if (product && product.PriceState === 'ok' && product.Price > 0) {
    list.push({ '@context': 'https://schema.org', '@type': 'Product', name: product.Name, sku: product.Reference || undefined, image: product.Images.slice(0, 6), description: String(product.SeoDescription || product.DescriptionShort || '').replace(/<[^>]+>/g, ' ').trim().slice(0, 500) || undefined, brand: product.Brand ? { '@type': 'Brand', name: product.Brand } : undefined,
      offers: { '@type': 'Offer', url: canonical.value, priceCurrency: product.Currency, price: product.Price.toFixed(2), availability: 'https://schema.org/' + (product.Available ? 'InStock' : 'OutOfStock') } })
  }
  if (view.value?.Kind === 'home') { list.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: site.value?.Name, url: canonical.value }) }
  if (view.value?.Kind === 'catalog') { list.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: w('Accueil'), item: address(site.value?.Route?.LanguageIsoCode || 'fr', '') }, { '@type': 'ListItem', position: 2, name: view.value.Category.Name, item: canonical.value.split('?')[0] }] }) }
  return list
})
useHead(() => {
  if (!paths.value || site.value?.Preview) { return {} }
  const title = view.value?.Product?.SeoTitle || view.value?.Category?.SeoTitle || view.value?.Category?.Name || view.value?.Page?.SeoTitle || view.value?.Lookbook?.SeoTitle || view.value?.Brand?.SeoTitle || site.value?.Preferences?.HomeTitle || site.value?.Name || ''
  const description = view.value?.Product?.SeoDescription || view.value?.Category?.SeoDescription || view.value?.Page?.SeoDescription || view.value?.Lookbook?.SeoDescription || view.value?.Brand?.SeoDescription || site.value?.Preferences?.HomeDescription || ''
  const languages = Object.keys(paths.value)
  return {
    link: [{ rel: 'canonical', href: canonical.value },
      ...(site.value?.Preferences?.Hreflang !== false && languages.length > 1 ? [...languages.map(iso => ({ rel: 'alternate', hreflang: iso, href: address(iso, paths.value![iso]) })), { rel: 'alternate', hreflang: 'x-default', href: address(site.value.DefaultLanguageIsoCode in paths.value ? site.value.DefaultLanguageIsoCode : languages[0], paths.value[site.value.DefaultLanguageIsoCode] ?? paths.value[languages[0]]) }] : [])],
    meta: [{ property: 'og:type', content: view.value?.Kind === 'product' ? 'product' : 'website' }, { property: 'og:site_name', content: site.value?.Name || '' }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:url', content: canonical.value },
      ...(shareImage.value ? [{ property: 'og:image', content: shareImage.value }, { name: 'twitter:card', content: 'summary_large_image' }] : [])],
    script: structured.value.map(item => ({ type: 'application/ld+json', innerHTML: JSON.stringify(item).replace(/</g, '\\u003c') })),
  }
})
// the pictures come from the media host of the shop: its connection is opened while the page is read, before the first picture is asked for
const mediaOrigin = computed(() => {
  const first = view.value?.Product?.Images?.[0] || view.value?.Category?.Listing?.Products?.[0]?.Images?.[0] || site.value?.Logo?.Src || ''
  try { const origin = new URL(first).origin; return origin !== site.value?.Origin ? origin : '' } catch { return '' }
})
useHead(() => ({ link: mediaOrigin.value ? [{ rel: 'preconnect', href: mediaOrigin.value, crossorigin: 'anonymous' }, { rel: 'dns-prefetch', href: mediaOrigin.value }] : [] }))
const prefs = computed(() => site.value?.Preferences || {})
useHead(() => view.value?.Kind === 'product'
  ? { title: view.value.Product.SeoTitle, meta: [{ name: 'description', content: view.value.Product.SeoDescription || view.value.Product.DescriptionShort }] }
  : view.value?.Kind === 'catalog'
  ? { title: view.value.Category.SeoTitle || view.value.Category.Name, meta: [{ name: 'description', content: view.value.Category.SeoDescription }] }
  : view.value?.Kind === 'lookbook'
  ? { title: view.value.Lookbook.SeoTitle, meta: [{ name: 'description', content: view.value.Lookbook.SeoDescription }] }
  : view.value?.Kind === 'brand'
  ? { title: view.value.Brand.SeoTitle, meta: [{ name: 'description', content: view.value.Brand.SeoDescription }] }
  : view.value?.Kind === 'look'
  ? { title: 'Shop the look · ' + view.value.Look.Product.Name, meta: [{ name: 'description', content: view.value.Look.Product.SeoDescription || view.value.Look.Product.DescriptionShort }] }
  : view.value?.Kind === 'brands'
  ? { title: w('Nos marques') }
  : view.value?.Kind === 'notfound'
  ? { title: w('Page introuvable'), meta: [{ name: 'robots', content: 'noindex' }] }
  : view.value?.Kind === 'search'
  ? { title: w('Recherche'), meta: [{ name: 'robots', content: 'noindex' }] }
  : view.value?.Kind === 'whatsapp'
  ? { title: 'WhatsApp', meta: [{ name: 'description', content: w('Nouveautés, ventes privées et conseils, directement sur WhatsApp.') }] }
  : view.value?.Kind === 'referral'
  ? { title: w('Parrainage'), meta: [{ name: 'robots', content: 'noindex' }] }
  : ['account', 'favorites', 'reset'].includes(view.value?.Kind)
  ? { title: w(view.value.Kind === 'favorites' ? 'Mes favoris' : 'Mon compte'), meta: [{ name: 'robots', content: 'noindex' }] }
  : view.value?.Kind === 'thanks'
  ? { title: w('Merci pour votre commande'), meta: [{ name: 'robots', content: 'noindex' }] }
  : view.value?.Kind === 'checkout'
  ? { title: w('Commande'), meta: [{ name: 'robots', content: 'noindex' }] }
  : view.value?.Kind === 'cart'
  ? { title: w('Panier'), meta: [{ name: 'robots', content: 'noindex' }] }
  : view.value?.Kind === 'page'
  ? { title: view.value.Page.SeoTitle, meta: [{ name: 'description', content: view.value.Page.SeoDescription }] }
  : { title: prefs.value.HomeTitle || '', meta: [{ name: 'description', content: prefs.value.HomeDescription || '' }] })
</script>

<template>
  <main>
    <LazySfCheckout v-if="view?.Kind === 'checkout'" :design="view.Design" />
    <LazySfAccount v-else-if="view?.Kind === 'account'" :section="view.Section" :id="view.Id" />
    <LazySfFavorites v-else-if="view?.Kind === 'favorites'" />
    <LazySfReset v-else-if="view?.Kind === 'reset'" />
    <LazySfLookbook v-else-if="view?.Kind === 'lookbook'" :lookbook="view.Lookbook" />
    <LazySfLook v-else-if="view?.Kind === 'look'" :look="view.Look" />
    <LazySfBrand v-else-if="view?.Kind === 'brand'" :brand="view.Brand" />
    <LazySfBrands v-else-if="view?.Kind === 'brands'" :brands="view.Brands" />
    <LazySfSearch v-else-if="view?.Kind === 'search' && !view.Design" :key="route.fullPath" :search="view.Search" />
    <LazySfThanks v-else-if="view?.Kind === 'thanks'" />
    <LazySfReferralLanding v-else-if="view?.Kind === 'referral'" :code="view.Code" />
    <div v-else-if="view?.Kind === 'whatsapp'" class="sf-thanks sf-wa-page"><h1>{{ w('Rejoignez-nous sur WhatsApp') }}</h1><p>{{ w('Nouveautés, ventes privées et conseils, directement sur WhatsApp.') }}</p><LazySfWhatsapp /></div>
    <template v-else-if="view?.Design">
      <SfSection v-for="(section, index) in view.Design.Sections" :key="section.Id" :section="section" :first="index === 0" />
    </template>
    <!-- an unknown address, the design of its page never published in the site builder: the usual message -->
    <SfSection v-else-if="view?.Kind === 'notfound'" :section="{ Id: 'nf', Type: 'main_404', Settings: { PaddingTop: 64, PaddingBottom: 64, PaddingMobile: 60 }, Texts: {}, Blocks: [] }" :first="true" />
    <!-- a page whose template was never published in the site builder still shows its text -->
    <SfSection v-else-if="view?.Page" :section="{ Id: 'page', Type: 'main_page', Settings: { ShowTitle: true, Width: 'narrow', PaddingTop: 48, PaddingBottom: 48, PaddingMobile: 60, TextSize: 15, TextLine: 1.7 }, Texts: {}, Blocks: [] }" />
    <div v-else class="sf-note"><h1>{{ site?.Name }}</h1><p>{{ w('Cette page n\'est pas encore publiée.') }}</p></div>
  </main>
</template>
