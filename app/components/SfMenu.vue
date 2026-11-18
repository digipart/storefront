<script setup lang="ts">
// A menu of Digipart: as the navigation of the header (`nav`: its tabs, and under each the columns of the large menu, shown on hover or with the keyboard) or as the links of a footer column (`list`).
const props = defineProps<{ id?: number, mode: 'nav' | 'list', split?: number }>()
const site = inject<Ref<any>>('sfSite')!
const menus = inject<Ref<Record<number, any>>>('sfMenus')!   // read once for the page by app.vue
// an address of the menu: a full address as it is, anything else under the language of the page
const href = (url: string) => (!url ? undefined : /^(https?:)?\/\//.test(url) ? url : (site.value?.Route?.Prefix || '') + '/' + url.replace(/^\/+/, ''))
const tabs = computed(() => menus.value?.[props.id || 0]?.Tabs || [])
// a column made only of pictures (elements « Image »): set at the end of the panel when the header asks for it
const onlyPictures = (column: any) => column.Groups.length > 0 && column.Groups.every((g: any) => g.Links.length > 0 && g.Links.every((l: any) => l.Image))
const firstPictures = (tab: any) => tab.Columns.findIndex(onlyPictures)
// a list longer than the header's limit (« Couper les listes au-delà de ») runs over several columns, filled top to bottom
const cut = (links: any[]) => { if (links.some((l: any) => l.Image)) { return 0 } const limit = Math.max(0, Math.floor(Number(props.split) || 0)); return limit > 0 && links.length > limit ? Math.ceil(links.length / Math.ceil(links.length / limit)) : 0 }
</script>

<template>
  <template v-if="props.mode === 'nav'">
    <div v-for="tab in tabs" :key="tab.Name" class="sf-nav-item">
      <component :is="tab.Url ? 'a' : 'span'" :href="href(tab.Url)" class="sf-nav-link" :tabindex="tab.Url ? undefined : 0">{{ tab.Name }}</component>
      <div v-if="tab.Columns.length" class="sf-mega">
        <div v-for="(column, c) in tab.Columns" :key="c + column.Name" class="sf-mega-col" :class="{ 'is-pics': onlyPictures(column), 'is-pics-start': c === firstPictures(tab) }">
          <template v-for="(group, g) in column.Groups" :key="g + group.Name">
            <div v-if="group.Name" class="sf-mega-title">{{ group.Name }}</div>
            <!-- a long list: over several columns -->
            <div v-if="cut(group.Links)" class="sf-mega-split" :style="{ '--mg-rows': cut(group.Links) }">
              <component :is="item.Url ? 'a' : 'span'" v-for="(item, i) in group.Links" :key="i + item.Name" :href="href(item.Url)">{{ item.Name }}</component>
            </div>
            <template v-for="(item, i) in group.Links" v-else :key="i + item.Name">
              <!-- an element « Image » of the menu: its picture, its caption under it -->
              <component :is="item.Url ? 'a' : 'span'" v-if="item.Image" :href="href(item.Url)" class="sf-mega-img"><span class="sf-mega-pic"><img :src="item.Image" :alt="item.Name || ''" loading="lazy" decoding="async"></span><span v-if="item.Name" class="sf-mega-caption">{{ item.Name }}</span></component>
              <component :is="item.Url ? 'a' : 'span'" v-else :href="href(item.Url)">{{ item.Name }}</component>
            </template>
          </template>
        </div>
      </div>
    </div>
  </template>
  <div v-else class="sf-flinks">
    <component :is="tab.Url ? 'a' : 'span'" v-for="tab in tabs" :key="tab.Name" :href="href(tab.Url)">{{ tab.Name }}</component>
  </div>
</template>
