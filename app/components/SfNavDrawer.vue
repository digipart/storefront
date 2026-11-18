<script setup lang="ts">
// The menu of the site in a panel that slides in from the left: on a phone always, on a computer when the shop chose « Dans un volet ». The tabs of the Digipart menu open their links; under
// them the account, the favourites and the languages.
const props = defineProps<{ id?: number }>()
const emit = defineEmits<{ close: [] }>()
const site = inject<Ref<any>>('sfSite')!
const menus = inject<Ref<Record<number, any>>>('sfMenus')!
const w = useWords()
const { customer, favorites, url: accountUrl, favoritesUrl } = useAccount()
const tabs = computed(() => menus.value?.[props.id || 0]?.Tabs || [])
const href = (url: string) => (!url ? undefined : /^(https?:)?\/\//.test(url) ? url : (site.value?.Route?.Prefix || '') + '/' + url.replace(/^\/+/, ''))
const open = ref('')
const panel = ref<HTMLElement | null>(null)
onMounted(() => { document.documentElement.style.overflow = 'hidden'; nextTick(() => panel.value?.focus()) })
onBeforeUnmount(() => { document.documentElement.style.overflow = '' })
</script>

<template>
  <div class="sf-drawer is-left" @keydown.esc="emit('close')">
    <div class="sf-drawer-veil" @click="emit('close')" />
    <aside ref="panel" class="sf-drawer-panel sf-navdrawer" role="dialog" aria-modal="true" :aria-label="w('Menu principal')" tabindex="-1">
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
          <a :href="accountUrl">{{ customer && !customer.Guest ? customer.Firstname : w('Mon compte') }}</a>
          <a :href="favoritesUrl">{{ w('Mes favoris') }}<template v-if="favorites.length"> ({{ favorites.length }})</template></a>
          <span v-if="(site?.Languages || []).length > 1" class="sf-langs"><a v-for="language in site.Languages" :key="language.LanguageIsoCode" :href="language.Default && site.UrlPrefix !== 'always' ? '/' : '/' + language.LanguageIsoCode" :aria-current="language.LanguageIsoCode === site.Route.LanguageIsoCode ? 'true' : undefined">{{ language.Name }}</a></span>
        </div>
      </nav>
    </aside>
  </div>
</template>
