<script setup lang="ts">
// The frame of every page of the site: the theme (its settings as CSS variables on <html>), the header and the footer written in Digipart, and between them the page of the address.
const route = useRoute()
const preview = computed(() => (typeof route.query.preview === 'string' ? route.query.preview : ''))
const barHidden = ref(false)
const here = computed(() => route.path)
const { data: site, error } = await useFetch<any>('/api/storefront/site', { query: { path: computed(() => route.path), preview }, key: 'sf-site' })
provide('sfSite', site)
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
const ordering = computed(() => ['commande', 'checkout', 'commande/merci', 'checkout/thanks'].includes(site.value?.Route?.Rest || ''))
const closed = computed(() => !!site.value && !site.value.Preview && (status.value ? !status.value.IsLive && status.value.Bypass !== true : site.value.State !== 'online'))
const closedPage = computed(() => (closed.value ? status.value?.Page || null : null))
const cover = computed(() => closedPage.value?.Cover || null)
const logo = computed(() => { const images = closedPage.value?.Logo?.Images || {}; const first = (Object.values(images)[0] as any[]) || []; return first[0] ? { src: first[0].Src, width: closedPage.value.Logo.Width } : null })
const reopen = computed(() => (closedPage.value?.ShowReopenAt && closedPage.value.ReopenAt ? new Intl.DateTimeFormat(site.value.Route.LanguageIsoCode, { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(closedPage.value.ReopenAt)) : ''))
const style = computed(() => Object.entries(site.value?.Theme?.Variables || {}).map(([name, value]) => name + ':' + value).join(';'))
useHead(() => ({
  htmlAttrs: { lang: site.value?.Route?.LanguageIsoCode || 'fr', style: style.value },
  // the fonts of the theme, served by this site (server/routes/fonts.css.get.ts)
  link: (site.value?.Theme?.Fonts || []).length ? [{ rel: 'stylesheet', href: '/fonts.css?' + site.value.Theme.Fonts.map((font: any) => 'f=' + encodeURIComponent(font.Name)).join('&') }] : [],
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
    <header v-if="ordering" class="sf-cohead"><a :href="site.Route.Prefix || '/'">‹ {{ words(site.Route.LanguageIsoCode, 'Continuer mes achats') }}</a><a :href="site.Route.Prefix || '/'" class="sf-logo">{{ site.Name }}</a><span /></header>
    <header v-else-if="site.Header" ref="headerBox" :class="{ 'sf-sticky': stickyHeader }"><SfSection v-for="section in site.Header.Sections" :key="section.Id" :section="section" /></header>
    <NuxtPage />
    <ClientOnly><SfCart /></ClientOnly>
    <footer v-if="site.Footer && !ordering"><SfSection v-for="section in site.Footer.Sections" :key="section.Id" :section="section" /></footer>
    <!-- the bar of a preview: which theme is shown, in which language, and the way out. Only whoever holds a preview link sees it. -->
    <aside v-if="site.Preview && !barHidden" class="sf-pbar" aria-label="Aperçu du thème">
      <div class="sf-pbar-name"><strong>{{ site.Theme.Name }}</strong><span class="sf-pbar-badge" :class="{ 'is-live': site.Theme.Live }">{{ site.Theme.Live ? 'En ligne · modifications non publiées' : 'Brouillon' }}</span><small>Aperçu : les visiteurs ne voient pas cette version</small></div>
      <nav v-if="site.Languages.length > 1" class="sf-pbar-langs" aria-label="Langue de l'aperçu">
        <a v-for="language in site.Languages" :key="language.LanguageIsoCode" :href="language.Default && site.UrlPrefix !== 'always' ? '/' : '/' + language.LanguageIsoCode" :aria-current="language.LanguageIsoCode === site.Route.LanguageIsoCode ? 'true' : undefined">{{ language.Name }}</a>
      </nav>
      <div class="sf-pbar-actions">
        <button type="button" @click="barHidden = true">Masquer la barre</button>
        <a :href="here + '?preview=off'">Quitter l'aperçu</a>
        <a v-if="site.PreviewEditUrl" :href="site.PreviewEditUrl" class="is-main">Modifier le thème</a>
      </div>
    </aside>
  </template>
</template>
