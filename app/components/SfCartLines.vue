<script setup lang="ts">
// The articles of the cart (in the panel and on the cart page): picture, name, size, quantity, price, and the way to remove one.
defineProps<{ compact?: boolean }>()
const site = inject<Ref<any>>('sfSite')!
const { cart, busy, setQuantity, setVariant, remove } = useCart()
const w = useWords()
const lang = computed(() => site.value?.Route?.LanguageIsoCode || 'fr')
</script>

<template>
  <ul class="sf-lines" :class="{ 'is-compact': compact }">
    <li v-for="line in cart.Lines" :key="line.IdProduct + '-' + line.IdProductAttribute" class="sf-line">
      <a :href="line.Url" class="sf-line-pic" tabindex="-1" aria-hidden="true"><img v-if="line.Image" :src="line.Image" alt="" loading="lazy"></a>
      <div class="sf-line-main">
        <a :href="line.Url" class="sf-line-name">{{ line.Name }}</a>
        <label v-if="line.Variants.length > 1" class="sf-line-size"><span class="sf-sr">{{ w('Taille') }}</span>
          <select :value="line.IdProductAttribute" :disabled="busy" @change="setVariant(line, Number(($event.target as HTMLSelectElement).value))"><option v-for="option in line.Variants" :key="option.Id" :value="option.Id" :disabled="!option.Available">{{ option.Label }}</option></select>
        </label>
        <span v-else-if="line.Variant" class="sf-line-variant">{{ line.Variant }}</span>
        <div class="sf-line-row">
          <div class="sf-qty" role="group" :aria-label="w('Quantité de {a}', { a: line.Name })">
            <button type="button" :disabled="busy" :aria-label="w(line.Quantity > 1 ? 'Retirer un exemplaire' : 'Retirer l\'article')" @click="setQuantity(line, line.Quantity - 1)">−</button>
            <span aria-live="polite">{{ line.Quantity }}</span>
            <button type="button" :disabled="busy || line.Quantity >= line.Max" :aria-label="w('Ajouter un exemplaire')" @click="setQuantity(line, line.Quantity + 1)">+</button>
          </div>
          <button type="button" class="sf-line-remove" :disabled="busy" @click="remove(line)">{{ w('Retirer') }}</button>
        </div>
      </div>
      <div class="sf-line-price">{{ money(line.Total, cart.Currency, lang) }}<small v-if="line.Quantity > 1">{{ money(line.Price, cart.Currency, lang) }} {{ w('l\'unité') }}</small></div>
    </li>
  </ul>
</template>
