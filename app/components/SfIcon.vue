<script setup lang="ts">
// One icon of the site: from the library of Digipart (app/utils/icons.json, Lucide, ISC licence: the same file as the site builder reads, class/Storefront/icons/lucide.json there), or one the shop sent itself
// (`my:12`, given by the site as CustomIcons). It takes the colour of the text around it. The old names of the reassurance lines (check, shield, truck, return, support) still work.
import library from '~/utils/icons.json'

const props = defineProps<{ name?: string, size?: number, stroke?: number }>()
const site = inject<Ref<any> | null>('sfSite', null)
const OLD: Record<string, string> = { check: 'check', shield: 'shield-check', truck: 'truck', return: 'undo-2', support: 'headset' }
const icon = computed(() => {
  const raw = String(props.name || ''), name = OLD[raw] || raw
  if (name.startsWith('my:')) {
    const mine = (site?.value?.CustomIcons || []).find((i: any) => 'my:' + i.Id === name)
    return mine ? { body: String(mine.Body), view: String(mine.ViewBox || '0 0 24 24'), mode: mine.Mode === 'stroke' ? 'stroke' : 'fill' } : null
  }
  const found = (library as Record<string, { d: string }>)[name]
  return found ? { body: found.d, view: '0 0 24 24', mode: 'stroke' } : null
})
</script>

<template>
  <svg v-if="icon" class="sf-icon" :viewBox="icon.view" :width="size || 20" :height="size || 20" :fill="icon.mode === 'fill' ? 'currentColor' : 'none'" :stroke="icon.mode === 'stroke' ? 'currentColor' : 'none'" :stroke-width="icon.mode === 'stroke' ? (stroke || 1.5) : undefined" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" v-html="icon.body" />
</template>
