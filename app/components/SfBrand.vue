<script setup lang="ts">
// A brand of the shop: its cover and logo, its text, then its newest products (Digipart: Catalogue > Marques; api/storefront/brand.php).
defineProps<{ brand: any }>()
const w = useWords()
</script>

<template>
  <article class="sf-brand">
    <div v-if="brand.Cover" class="sf-brand-cover"><img :src="brand.Cover" alt="" decoding="async" fetchpriority="high"></div>
    <header class="sf-brand-head">
      <img v-if="brand.Logo" class="sf-brand-logo" :src="brand.Logo" :alt="brand.Name" decoding="async">
      <h1 class="sf-h">{{ brand.Title || brand.Name }}</h1>
      <p v-if="brand.Short" class="sf-muted">{{ brand.Short }}</p>
    </header>
    <!-- eslint-disable-next-line vue/no-v-html : the text of a brand is written by the shop in Digipart (Catalogue > Marques) -->
    <div v-if="brand.Description" class="sf-rte sf-brand-text" v-html="brand.Description" />
    <section v-if="brand.Products.length" class="sf-brand-products">
      <h2 class="sf-h" :style="{ '--size': '22px' }">{{ w('Les produits') }}</h2>
      <div class="sf-grid sf-products" :style="{ '--cols': 4, '--cols-m': 2, '--gx': '16px', '--gy': '24px' }">
        <SfProductCard v-for="product in brand.Products" :key="product.Id" :product="product" images="hover" />
      </div>
    </section>
  </article>
</template>
