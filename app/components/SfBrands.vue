<script setup lang="ts">
// All the brands of the shop: a logo (or the name) and a short text, each leading to its page.
defineProps<{ brands: any[] }>()
const site = inject<Ref<any>>('sfSite')!
const w = useWords()
const prefix = computed(() => site.value?.Route?.Prefix || '')
</script>

<template>
  <section class="sf-brands">
    <h1 class="sf-h">{{ w('Nos marques') }}</h1>
    <p v-if="!brands.length" class="sf-muted">{{ w('Aucune marque pour le moment.') }}</p>
    <ul v-else class="sf-brands-grid">
      <li v-for="b in brands" :key="b.Id">
        <a :href="prefix + '/marque/' + b.Slug" class="sf-brand-card">
          <span class="sf-brand-pic"><img v-if="b.Logo || b.Cover" :src="b.Logo || b.Cover" :alt="b.Name" loading="lazy" decoding="async"><strong v-else>{{ b.Name }}</strong></span>
          <span class="sf-brand-name">{{ b.Title || b.Name }}</span>
          <small v-if="b.Short" class="sf-muted">{{ b.Short }}</small>
        </a>
      </li>
    </ul>
  </section>
</template>
