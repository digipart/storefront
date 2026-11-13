<script setup lang="ts">
// A lookbook of the shop: banners, and pictures with the products worn pinned on them. A pin opens the product (name, price, the way to its page).
const props = defineProps<{ lookbook: any }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
const open = ref('')
const LAYOUTS: Record<string, string> = { 2: '1fr 1fr', 3: '1fr 1fr 1fr', 4: '1fr 1fr 1fr 1fr', '1:2': '1fr 2fr', '2:1': '2fr 1fr', '1:3': '1fr 3fr', '3:1': '3fr 1fr' }
const product = (id: number) => props.lookbook.Products[id] || null
const vimeo = (value: string) => (String(value || '').match(/(\d{6,})/) || [])[1] || ''
const pictures = (block: any) => (block.Type === 'full' ? [block] : (block.Items || []))
</script>

<template>
  <article class="sf-look">
    <h1 class="sf-sr">{{ lookbook.Title }}</h1>
    <template v-for="block in lookbook.Blocks" :key="block.Id">
      <component :is="block.Link ? 'a' : 'div'" v-if="block.Type === 'banner'" :href="block.Link || undefined" class="sf-hero sf-look-banner" :class="{ 'is-plain': !block.Image && !block.Video }" :style="{ '--h': block.Image || block.Video ? '520px' : 'auto', color: block.Image || block.Video ? '#fff' : undefined, textAlign: 'center' }">
        <picture v-if="block.Image"><source v-if="block.ImageMobile" media="(max-width: 767px)" :srcset="block.ImageMobile"><img :src="block.Image" alt="" loading="lazy" decoding="async"></picture>
        <span class="sf-hero-copy"><span v-if="block.Texts.Title" class="sf-h" :style="{ '--size': '34px' }">{{ block.Texts.Title }}</span><span v-if="block.Texts.Subtitle" class="sf-text">{{ block.Texts.Subtitle }}</span><span v-if="block.Link && block.Texts.LinkText" class="sf-btn is-light">{{ block.Texts.LinkText }}</span></span>
      </component>
      <div v-else class="sf-look-row" :style="{ '--cols': block.Type === 'columns' ? (LAYOUTS[block.Layout] || '1fr 1fr') : '1fr' }">
        <div v-for="(item, i) in pictures(block)" :key="i" class="sf-look-pic">
          <iframe v-if="vimeo(item.Video)" :src="'https://player.vimeo.com/video/' + vimeo(item.Video) + '?background=1'" allow="autoplay; fullscreen" title="" loading="lazy" />
          <picture v-else-if="item.Image"><source v-if="item.ImageMobile" media="(max-width: 767px)" :srcset="item.ImageMobile"><img :src="item.Image" alt="" loading="lazy" decoding="async"></picture>
          <template v-for="(pin, p) in item.Pins || []" :key="p">
            <div v-if="product(pin.IdProduct)" class="sf-pin" :class="{ 'is-open': open === block.Id + i + p, 'is-left': pin.X > 60, 'is-up': pin.Y > 60 }" :style="{ '--x': pin.X + '%', '--y': pin.Y + '%', '--mx': (pin.Mx ?? pin.X) + '%', '--my': (pin.My ?? pin.Y) + '%' }">
              <button type="button" :aria-expanded="open === block.Id + i + p" :aria-label="w('Voir le produit {a}', { a: product(pin.IdProduct).Name })" @click="open = open === block.Id + i + p ? '' : block.Id + i + p"><span /></button>
              <a v-if="open === block.Id + i + p" :href="product(pin.IdProduct).Url" class="sf-pin-card">
                <img v-if="product(pin.IdProduct).Images[0]" :src="product(pin.IdProduct).Images[0]" alt="">
                <span><strong>{{ product(pin.IdProduct).Name }}</strong><span><SfPrice :product="product(pin.IdProduct)" :compare="false" /></span><u>{{ w('Voir le produit') }}</u></span>
              </a>
            </div>
          </template>
        </div>
      </div>
    </template>
  </article>
</template>
