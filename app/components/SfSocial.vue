<script setup lang="ts">
// The networks of the shop (the module Social Links of Digipart): icons, names or both, as the section says. Nothing is drawn when the shop gave no address.
const props = defineProps<{ display?: string, shape?: string, size?: number, gap?: number, list?: { Name: string, URL: string }[] }>()
const site = inject<Ref<any>>('sfSite')!
// `list`: the networks a closed page of « État du site » shows (Name, URL), else the ones of the shop
const links = computed(() => (props.list ? props.list.map(link => ({ Name: link.Name, Url: link.URL })) : site.value?.SocialLinks || []).filter((link: any) => link.Url))
const show = computed(() => (['icons', 'names', 'both'].includes(String(props.display)) ? String(props.display) : 'icons'))
// one path per network, drawn in the colour of the text (24 × 24)
const ICONS: Record<string, string> = {
  Instagram: 'M12 7.3A4.7 4.7 0 1 0 12 16.7 4.7 4.7 0 0 0 12 7.3Zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm4.9-8a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2ZM16.5 2.5h-9A5 5 0 0 0 2.5 7.5v9a5 5 0 0 0 5 5h9a5 5 0 0 0 5-5v-9a5 5 0 0 0-5-5Zm3.3 14a3.3 3.3 0 0 1-3.3 3.3h-9a3.3 3.3 0 0 1-3.3-3.3v-9a3.3 3.3 0 0 1 3.3-3.3h9a3.3 3.3 0 0 1 3.3 3.3v9Z',
  Facebook: 'M13.6 21.5v-8.2h2.8l.4-3.2h-3.2V8c0-.9.3-1.6 1.6-1.6h1.7V3.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.4H7.5v3.2h2.8v8.2h3.3Z',
  TikTok: 'M16.2 2.5h-3.1v12.3a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.1a5.7 5.7 0 1 0 4.9 5.7V8.6a7.2 7.2 0 0 0 4.2 1.3V6.8a4.3 4.3 0 0 1-4.2-4.3Z',
  YouTube: 'M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12c0 1.6.1 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.3-1.6.4-3.2.4-4.8s-.1-3.2-.4-4.8ZM10 15V9l5.2 3L10 15Z',
  Pinterest: 'M12 2.5a9.5 9.5 0 0 0-3.5 18.3c-.1-.8-.1-2 0-2.8l1.1-4.7s-.3-.6-.3-1.400c0-1.300.8-2.300 1.700-2.300.800 0 1.200.6 1.200 1.300 0 .8-.5 2-.8 3.100-.2.9.5 1.700 1.400 1.700 1.700 0 3-1.800 3-4.400 0-2.300-1.600-3.900-4-3.900a4.100 4.100 0 0 0-4.300 4.100c0 .8.3 1.700.7 2.200.1.100.1.200.1.300l-.3 1.100c0 .2-.1.200-.3.100-1.200-.6-1.900-2.300-1.900-3.700 0-3 2.200-5.800 6.300-5.800 3.300 0 5.900 2.400 5.900 5.500 0 3.300-2.100 6-5 6-1 0-1.900-.5-2.200-1.100l-.6 2.300c-.2.800-.8 1.900-1.200 2.500A9.500 9.500 0 1 0 12 2.500Z',
}
</script>

<template>
  <nav v-if="links.length" class="sf-social" :class="['is-' + show, 'is-' + (shape || 'plain')]" :style="{ '--size': (size || 44) + 'px', '--gap': (gap ?? 14) + 'px' }" aria-label="Réseaux sociaux">
    <a v-for="link in links" :key="link.Name" :href="link.Url" target="_blank" rel="noopener" :aria-label="show === 'icons' ? link.Name : undefined">
      <svg v-if="show !== 'names' && ICONS[link.Name]" viewBox="0 0 24 24" aria-hidden="true"><path :d="ICONS[link.Name]" fill="currentColor" /></svg>
      <span v-if="show !== 'icons' || !ICONS[link.Name]">{{ link.Name }}</span>
    </a>
  </nav>
</template>
