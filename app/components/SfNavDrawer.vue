<script setup lang="ts">
// The menu of the site in a panel that slides in from the left: on a phone always, on a computer when the shop chose « Dans un volet ». The tabs of the Digipart menu open their links; under
// them the way back to the home page (the header may show no logo: on a product page of a theme that lays it over the photo), the account, the favourites and the languages. Two looks (site builder, En-tête > « Présentation du volet »): a list whose tabs unfold (`list`), or the tabs side by side at the top of the
// panel and, under them, the links of the chosen tab (`tabs`): each column of the Digipart menu is a block of links, a group that has a name is a line that opens its own links.
// Two more for the kinds of menu of the header (« Type de menu »): the whole screen (`full`: the tabs in large type, the links of the tab under the pointer beside them, its picture), and
// tiles (`visual`: one picture per tab, the first element « Image » of its menu; a tile opens the links of its tab).
const props = defineProps<{ id?: number, mode?: string }>()
const emit = defineEmits<{ close: [] }>()
const site = inject<Ref<any>>('sfSite')!
const langHref = useLanguageHref()
const menus = inject<Ref<Record<number, any>>>('sfMenus')!
const w = useWords()
const { customer, favorites, url: accountUrl, favoritesUrl } = useAccount()
const tabs = computed(() => menus.value?.[props.id || 0]?.Tabs || [])
const href = (url: string) => (!url ? undefined : /^(https?:)?\/\//.test(url) ? url : (site.value?.Route?.Prefix || '') + '/' + url.replace(/^\/+/, ''))
const open = ref('')
const tabbed = computed(() => props.mode === 'tabs' && tabs.value.length > 0)
const full = computed(() => props.mode === 'full' && tabs.value.length > 0)
const visual = computed(() => props.mode === 'visual' && tabs.value.length > 0)
// the first picture of the menu of a tab, and its links without the pictures (the full screen and the tiles)
const filmOf = (item: any): string => { for (const column of item?.Columns || []) { for (const group of column.Groups) { const found = group.Links.find((l: any) => l.Video); if (found) { return found.Video } } } return '' }
const pictureOf = (item: any): string => { for (const column of item?.Columns || []) { for (const group of column.Groups) { const found = group.Links.find((l: any) => l.Image); if (found) { return found.Image } } } return '' }
const linksOf = (item: any) => (item?.Columns || []).flatMap((column: any) => column.Groups.flatMap((group: any) => group.Links.filter((l: any) => !l.Image && !l.Video && l.Name)))
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
  <div class="sf-drawer is-left" :class="{ 'is-full': full }" @keydown.esc="emit('close')">
    <div class="sf-drawer-veil" @click="emit('close')" />
    <!-- the whole screen: the tabs in large type on the left, the links of the tab under the pointer (or chosen) beside them, its picture -->
    <aside v-if="full" ref="panel" class="sf-drawer-panel sf-navfull" role="dialog" aria-modal="true" :aria-label="w('Menu principal')" tabindex="-1">
      <button type="button" class="sf-navfull-close" :aria-label="w('Fermer')" @click="emit('close')"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg><span>{{ w('Fermer') }}</span></button>
      <nav class="sf-navfull-tabs" :aria-label="w('Menu principal')">
        <template v-for="(item, i) in tabs" :key="item.Name">
          <a v-if="item.Url && !item.Columns.length" :href="href(item.Url)" class="sf-navfull-tab" @mouseenter="current = i">{{ item.Name }}</a>
          <button v-else type="button" class="sf-navfull-tab" :class="{ 'is-on': i === current }" :aria-expanded="i === current" @mouseenter="current = i" @focus="current = i" @click="current = i">{{ item.Name }}</button>
        </template>
      </nav>
      <div v-if="tab" class="sf-navfull-links">
        <a v-if="tab.Url" :href="href(tab.Url)" class="is-all">{{ w('Tout voir') }}</a>
        <template v-for="(column, c) in tab.Columns" :key="c + column.Name"><template v-for="(group, g) in column.Groups" :key="g + group.Name">
          <span v-if="group.Name" class="sf-navfull-title">{{ group.Name }}</span>
          <component :is="item.Url ? 'a' : 'span'" v-for="(item, k) in group.Links.filter((l: any) => !l.Image && !l.Video && l.Name)" :key="k + item.Name" :href="href(item.Url)">{{ item.Name }}</component>
        </template></template>
      </div>
      <div v-if="tab && filmOf(tab)" class="sf-navfull-pic sf-mega-film"><iframe :src="filmOf(tab)" title="" loading="lazy" allow="autoplay; fullscreen" tabindex="-1" /></div>
      <div v-else-if="tab && pictureOf(tab)" class="sf-navfull-pic"><img :src="pictureOf(tab)" alt="" loading="lazy" decoding="async"></div>
      <div class="sf-navfull-more">
        <a :href="accountUrl">{{ customer && !customer.Guest ? customer.Firstname : w('Mon compte') }}</a>
        <a :href="favoritesUrl">{{ w('Mes favoris') }}<template v-if="favorites.length"> ({{ favorites.length }})</template></a>
        <span v-if="(site?.Languages || []).length > 1" class="sf-langs"><a v-for="language in site.Languages" :key="language.LanguageIsoCode" :href="langHref(language)" :aria-current="language.LanguageIsoCode === site.Route.LanguageIsoCode ? 'true' : undefined">{{ language.LanguageIsoCode.toUpperCase() }}</a></span>
      </div>
    </aside>
    <!-- tiles: one picture per tab; a tile opens the links of its tab -->
    <aside v-else-if="visual" ref="panel" class="sf-drawer-panel sf-navdrawer sf-navvisual" role="dialog" aria-modal="true" :aria-label="w('Menu principal')" tabindex="-1">
      <header class="sf-drawer-head"><h2>{{ drill ? drill.Name : w('Menu') }}</h2><button type="button" :aria-label="w('Fermer')" @click="emit('close')">✕</button></header>
      <nav class="sf-drawer-body" :aria-label="w('Menu principal')">
        <template v-if="drill">
          <button type="button" class="sf-navtabs-row is-back" @click="drill = null"><span aria-hidden="true">‹</span>{{ w('Menu') }}</button>
          <div class="sf-navtabs-block"><component :is="item.Url ? 'a' : 'span'" v-for="(item, i) in drill.Links" :key="i + item.Name" :href="href(item.Url)">{{ item.Name }}</component></div>
        </template>
        <div v-else class="sf-navvisual-grid">
          <template v-for="item in tabs" :key="item.Name">
            <a v-if="item.Url && !item.Columns.length" :href="href(item.Url)" class="sf-navvisual-tile" :class="{ 'has-pic': !!pictureOf(item) }" :style="pictureOf(item) ? { backgroundImage: 'url(' + JSON.stringify(pictureOf(item)) + ')' } : undefined"><span>{{ item.Name }}</span></a>
            <button v-else type="button" class="sf-navvisual-tile" :class="{ 'has-pic': !!pictureOf(item) }" :style="pictureOf(item) ? { backgroundImage: 'url(' + JSON.stringify(pictureOf(item)) + ')' } : undefined" @click="drill = { Name: item.Name, Links: [...(item.Url ? [{ Name: w('Tout voir'), Url: item.Url }] : []), ...linksOf(item)] }"><span>{{ item.Name }}</span></button>
          </template>
        </div>
        <div class="sf-navdrawer-more">
          <a :href="site?.Route?.Prefix || '/'">{{ w('Accueil') }}</a>
          <a :href="accountUrl">{{ customer && !customer.Guest ? customer.Firstname : w('Mon compte') }}</a>
          <a :href="favoritesUrl">{{ w('Mes favoris') }}<template v-if="favorites.length"> ({{ favorites.length }})</template></a>
        </div>
      </nav>
    </aside>
    <aside v-else-if="tabbed" ref="panel" class="sf-drawer-panel sf-navdrawer is-tabs" role="dialog" aria-modal="true" :aria-label="w('Menu principal')" tabindex="-1">
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
            <span v-if="(site?.Languages || []).length > 1" class="sf-langs"><a v-for="language in site.Languages" :key="language.LanguageIsoCode" :href="langHref(language)" :aria-current="language.LanguageIsoCode === site.Route.LanguageIsoCode ? 'true' : undefined">{{ language.Name }}</a></span>
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
          <span v-if="(site?.Languages || []).length > 1" class="sf-langs"><a v-for="language in site.Languages" :key="language.LanguageIsoCode" :href="langHref(language)" :aria-current="language.LanguageIsoCode === site.Route.LanguageIsoCode ? 'true' : undefined">{{ language.Name }}</a></span>
        </div>
      </nav>
    </aside>
  </div>
</template>
