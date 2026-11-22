<script setup lang="ts">
// The menu of the site in a panel that slides in from the left: on a phone always, on a computer when the shop chose « Dans un volet ». The tabs of the Digipart menu open their links; under
// them the way back to the home page (the header may show no logo: on a product page of a theme that lays it over the photo), the account, the favourites and the languages. Two looks (site builder, En-tête > « Présentation du volet »): a list whose tabs unfold (`list`), or the tabs side by side at the top of the
// panel and, under them, the links of the chosen tab (`tabs`): each column of the Digipart menu is a block of links, a group that has a name is a line that opens its own links.
const props = defineProps<{ id?: number, mode?: string }>()
const emit = defineEmits<{ close: [] }>()
const site = inject<Ref<any>>('sfSite')!
const menus = inject<Ref<Record<number, any>>>('sfMenus')!
const w = useWords()
const { customer, favorites, url: accountUrl, favoritesUrl } = useAccount()
const tabs = computed(() => menus.value?.[props.id || 0]?.Tabs || [])
const href = (url: string) => (!url ? undefined : /^(https?:)?\/\//.test(url) ? url : (site.value?.Route?.Prefix || '') + '/' + url.replace(/^\/+/, ''))
const open = ref('')
const tabbed = computed(() => props.mode === 'tabs' && tabs.value.length > 0)
const current = ref(0)
const tab = computed(() => tabs.value[Math.min(current.value, tabs.value.length - 1)] || null)
const drill = ref<{ Name: string, Links: any[] } | null>(null)
watch(current, () => { drill.value = null })
const panel = ref<HTMLElement | null>(null)
onMounted(() => { document.documentElement.style.overflow = 'hidden'; nextTick(() => panel.value?.focus()) })
// the row of tabs may be wider than the panel: arrows at its ends, and the wheel moves it sideways
const tabRow = ref<HTMLElement | null>(null), more = reactive({ left: false, right: false })
const measure = () => { const el = tabRow.value; if (el) { more.left = el.scrollLeft > 2; more.right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2 } }
const slide = (way: number) => tabRow.value?.scrollBy({ left: way * tabRow.value.clientWidth * 0.7, behavior: 'smooth' })
const onWheel = (event: WheelEvent) => { const el = tabRow.value; if (el && el.scrollWidth > el.clientWidth && Math.abs(event.deltaY) > Math.abs(event.deltaX)) { el.scrollLeft += event.deltaY; event.preventDefault() } }
onMounted(() => { nextTick(measure); window.addEventListener('resize', measure) })
onBeforeUnmount(() => window.removeEventListener('resize', measure))
watch(current, () => nextTick(() => { tabRow.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' }) }))
onBeforeUnmount(() => { document.documentElement.style.overflow = '' })
</script>

<template>
  <div class="sf-drawer is-left" @keydown.esc="emit('close')">
    <div class="sf-drawer-veil" @click="emit('close')" />
    <aside v-if="tabbed" ref="panel" class="sf-drawer-panel sf-navdrawer is-tabs" role="dialog" aria-modal="true" :aria-label="w('Menu principal')" tabindex="-1">
      <header class="sf-navtabs">
        <button type="button" class="sf-navtabs-close" :aria-label="w('Fermer')" @click="emit('close')"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg></button>
        <button v-if="more.left" type="button" class="sf-navtabs-more" :aria-label="w('Précédent')" @click="slide(-1)">‹</button>
        <div ref="tabRow" class="sf-navtabs-list" role="tablist" :aria-label="w('Menu principal')" @scroll.passive="measure" @wheel="onWheel">
          <template v-for="(item, i) in tabs" :key="item.Name">
            <a v-if="!item.Columns.length && item.Url" :href="href(item.Url)" class="sf-navtabs-tab">{{ item.Name }}</a>
            <button v-else type="button" role="tab" class="sf-navtabs-tab" :aria-selected="i === current" @click="current = i">{{ item.Name }}</button>
          </template>
        </div>
        <button v-if="more.right" type="button" class="sf-navtabs-more" :aria-label="w('Suivant')" @click="slide(1)">›</button>
      </header>
      <nav class="sf-drawer-body" :aria-label="tab?.Name">
        <template v-if="drill">
          <button type="button" class="sf-navtabs-row is-back" @click="drill = null"><span aria-hidden="true">‹</span>{{ drill.Name }}</button>
          <div class="sf-navtabs-block"><component :is="item.Url ? 'a' : 'span'" v-for="(item, i) in drill.Links" :key="i + item.Name" :href="href(item.Url)">{{ item.Name }}</component></div>
        </template>
        <template v-else-if="tab">
          <div v-if="tab.Url" class="sf-navtabs-block"><a :href="href(tab.Url)">{{ w('Tout voir') }}</a></div>
          <div v-for="(column, c) in tab.Columns" :key="c + column.Name" class="sf-navtabs-block">
            <template v-for="(group, g) in column.Groups" :key="g + group.Name">
              <button v-if="group.Name && group.Links.length" type="button" class="sf-navtabs-row" aria-haspopup="true" @click="drill = group">{{ group.Name }}<span aria-hidden="true">›</span></button>
              <template v-else><component :is="item.Url ? 'a' : 'span'" v-for="(item, i) in group.Links.filter((l: any) => l.Name)" :key="i + item.Name" :href="href(item.Url)">{{ item.Name }}</component></template>
            </template>
          </div>
          <div class="sf-navdrawer-more">
            <a :href="site?.Route?.Prefix || '/'">{{ w('Accueil') }}</a>
          <a :href="accountUrl">{{ customer && !customer.Guest ? customer.Firstname : w('Mon compte') }}</a>
            <a :href="favoritesUrl">{{ w('Mes favoris') }}<template v-if="favorites.length"> ({{ favorites.length }})</template></a>
            <span v-if="(site?.Languages || []).length > 1" class="sf-langs"><a v-for="language in site.Languages" :key="language.LanguageIsoCode" :href="language.Default && site.UrlPrefix !== 'always' ? '/' : '/' + language.LanguageIsoCode" :aria-current="language.LanguageIsoCode === site.Route.LanguageIsoCode ? 'true' : undefined">{{ language.Name }}</a></span>
          </div>
        </template>
      </nav>
    </aside>
    <aside v-else ref="panel" class="sf-drawer-panel sf-navdrawer" role="dialog" aria-modal="true" :aria-label="w('Menu principal')" tabindex="-1">
      <header class="sf-drawer-head"><h2>{{ w('Menu') }}</h2><button type="button" :aria-label="w('Fermer')" @click="emit('close')">✕</button></header>
      <nav class="sf-drawer-body" :aria-label="w('Menu principal')">
        <div v-for="tab in tabs" :key="tab.Name" class="sf-navdrawer-item">
          <div class="sf-navdrawer-row">
            <component :is="tab.Url ? 'a' : 'span'" :href="href(tab.Url)">{{ tab.Name }}</component>
            <button v-if="tab.Columns.length" type="button" :aria-expanded="open === tab.Name" :aria-label="tab.Name" @click="open = open === tab.Name ? '' : tab.Name">{{ open === tab.Name ? '−' : '+' }}</button>
          </div>
          <div v-if="open === tab.Name" class="sf-navdrawer-sub">
            <template v-for="column in tab.Columns" :key="column.Name"><template v-for="group in column.Groups" :key="group.Name">
              <div v-if="group.Name" class="sf-mega-title">{{ group.Name }}</div>
              <template v-for="(item, i) in group.Links" :key="i + item.Name">
                <component :is="item.Url ? 'a' : 'span'" v-if="item.Image" :href="href(item.Url)" class="sf-mega-img"><span class="sf-mega-pic"><img :src="item.Image" :alt="item.Name || ''" loading="lazy" decoding="async"></span><span v-if="item.Name" class="sf-mega-caption">{{ item.Name }}</span></component>
                <component :is="item.Url ? 'a' : 'span'" v-else :href="href(item.Url)">{{ item.Name }}</component>
              </template>
            </template></template>
          </div>
        </div>
        <div class="sf-navdrawer-more">
          <a :href="site?.Route?.Prefix || '/'">{{ w('Accueil') }}</a>
          <a :href="accountUrl">{{ customer && !customer.Guest ? customer.Firstname : w('Mon compte') }}</a>
          <a :href="favoritesUrl">{{ w('Mes favoris') }}<template v-if="favorites.length"> ({{ favorites.length }})</template></a>
          <span v-if="(site?.Languages || []).length > 1" class="sf-langs"><a v-for="language in site.Languages" :key="language.LanguageIsoCode" :href="language.Default && site.UrlPrefix !== 'always' ? '/' : '/' + language.LanguageIsoCode" :aria-current="language.LanguageIsoCode === site.Route.LanguageIsoCode ? 'true' : undefined">{{ language.Name }}</a></span>
        </div>
      </nav>
    </aside>
  </div>
</template>
