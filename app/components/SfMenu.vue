<script setup lang="ts">
// A menu of Digipart: as the navigation of the header (`nav`: its tabs, and under each the columns of the large menu, shown on hover or with the keyboard) or as the links of a footer column (`list`).
const props = defineProps<{ id?: number, mode: 'nav' | 'list' }>()
const site = inject<Ref<any>>('sfSite')!
const menus = inject<Ref<Record<number, any>>>('sfMenus')!   // read once for the page by app.vue
// an address of the menu: a full address as it is, anything else under the language of the page
const href = (url: string) => (!url ? undefined : /^(https?:)?\/\//.test(url) ? url : (site.value?.Route?.Prefix || '') + '/' + url.replace(/^\/+/, ''))
const tabs = computed(() => menus.value?.[props.id || 0]?.Tabs || [])
</script>

<template>
  <template v-if="props.mode === 'nav'">
    <div v-for="tab in tabs" :key="tab.Name" class="sf-nav-item">
      <component :is="tab.Url ? 'a' : 'span'" :href="href(tab.Url)" class="sf-nav-link" :tabindex="tab.Url ? undefined : 0">{{ tab.Name }}</component>
      <div v-if="tab.Columns.length" class="sf-mega">
        <div v-for="column in tab.Columns" :key="column.Name" class="sf-mega-col">
          <template v-for="group in column.Groups" :key="group.Name">
            <div v-if="group.Name" class="sf-mega-title">{{ group.Name }}</div>
            <component :is="item.Url ? 'a' : 'span'" v-for="item in group.Links" :key="item.Name" :href="href(item.Url)">{{ item.Name }}</component>
          </template>
        </div>
      </div>
    </div>
  </template>
  <div v-else class="sf-flinks">
    <component :is="tab.Url ? 'a' : 'span'" v-for="tab in tabs" :key="tab.Name" :href="href(tab.Url)">{{ tab.Name }}</component>
  </div>
</template>
