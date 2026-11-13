<script setup lang="ts">
// The blocks of a section, in the order the shop gave them in the site builder: titles, texts, buttons, pictures, spaces. The block `content` is the place of what the section itself draws (its
// products, its form...): the default slot.
const props = defineProps<{ blocks?: any[], light?: boolean }>()
const style = (block: any) => {
  const s = block.Settings || {}
  return { textAlign: s.Align && s.Align !== 'inherit' ? s.Align : undefined, marginTop: (s.GapTop || 0) + 'px', marginBottom: (s.Gap ?? 16) + 'px' }
}
const own = (s: any) => (s.ColorMode === 'custom' ? s.Color : undefined)
const heading = (s: any) => ({ '--size': (s.Size || 26) + 'px', fontWeight: s.Weight || 600, textTransform: s.Case === 'uppercase' ? 'uppercase' : undefined, letterSpacing: Number(s.Spacing) ? s.Spacing + 'px' : undefined, color: own(s) })
const button = (s: any) => {
  const link = s.Style === 'link'
  const custom = s.ColorMode === 'custom'
  return {
    fontSize: (s.Size || 14) + 'px', fontWeight: s.Weight || 600, textTransform: s.Case === 'uppercase' ? 'uppercase' : undefined, letterSpacing: (s.Spacing ?? 0.5) + 'px',
    borderRadius: !link && Number(s.Radius) > 0 ? s.Radius + 'px' : undefined, padding: link ? undefined : (s.PadY ?? 11) + 'px ' + (s.PadX ?? 26) + 'px', display: s.Full && !link ? 'block' : undefined, textAlign: s.Full ? 'center' : undefined,
    background: custom && s.Style === 'solid' ? s.Background : undefined, color: custom ? (s.Style === 'outline' ? s.Background : s.Color) : undefined,
  }
}
const ratio = (value: string) => ({ portrait: '4 / 5', square: '1', landscape: '4 / 3', wide: '16 / 9' } as Record<string, string>)[value]
</script>

<template>
  <template v-for="block in props.blocks || []" :key="block.Id">
    <div v-if="block.Type === 'content'" class="sf-blk"><slot /></div>
    <div v-else-if="block.Type.startsWith('p_')" class="sf-blk" :style="style(block)"><SfProductBlock :block="block" /></div>
    <div v-else-if="block.Type === 'spacer'" class="sf-spacer" :style="{ '--h': (block.Settings.Height || 32) + 'px' }" />
    <div v-else class="sf-blk" :style="style(block)">
      <h2 v-if="block.Type === 'heading' && block.Texts.Text" class="sf-h" :style="heading(block.Settings)">{{ block.Texts.Text }}</h2>
      <p v-else-if="block.Type === 'text' && block.Texts.Text" class="sf-text" :style="{ fontSize: (block.Settings.Size || 15) + 'px', fontWeight: block.Settings.Weight || 400, lineHeight: block.Settings.Line || 1.55, maxWidth: (block.Settings.MaxWidth || 1200) + 'px', color: own(block.Settings) }">{{ block.Texts.Text }}</p>
      <component :is="block.Settings.Url ? 'a' : 'span'" v-else-if="block.Type === 'button' && block.Texts.Text" :href="block.Settings.Url || undefined" class="sf-btn" :class="['is-' + (block.Settings.Style || 'solid'), { 'is-light': props.light && block.Settings.ColorMode !== 'custom' && block.Settings.Style === 'solid' }]" :style="button(block.Settings)">{{ block.Texts.Text }}</component>
      <component :is="block.Settings.Url ? 'a' : 'span'" v-else-if="block.Type === 'image' && block.Settings.Image" :href="block.Settings.Url || undefined" class="sf-img" :style="{ width: (block.Settings.Width || 100) + '%' }">
        <picture>
          <source v-if="block.Settings.ImageMobile" media="(max-width: 767px)" :srcset="block.Settings.ImageMobile">
          <img :src="block.Settings.Image" alt="" loading="lazy" decoding="async" :style="{ aspectRatio: ratio(block.Settings.Ratio), objectFit: ratio(block.Settings.Ratio) ? 'cover' : undefined }">
        </picture>
      </component>
      <hr v-else-if="block.Type === 'separator'" class="sf-sep" :style="{ borderTopWidth: (block.Settings.Thickness || 1) + 'px' }">
    </div>
  </template>
</template>
