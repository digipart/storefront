<script setup lang="ts">
// A list to pick one value, drawn by the site (the system's own list cannot be styled); a search on top of a long one.
const props = defineProps<{ modelValue: string, options: Array<{ Value: string, Text: string }>, label: string, search?: string, empty?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const id = useId()
const open = ref(false), up = ref(false), room = ref(360), term = ref('')
const root = ref<HTMLElement | null>(null), head = ref<HTMLButtonElement | null>(null), list = ref<HTMLElement | null>(null), field = ref<HTMLInputElement | null>(null)
const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const searching = computed(() => !!props.search && props.options.length > 10)
const shown = computed(() => (term.value ? props.options.filter(o => plain(o.Text).includes(plain(term.value))) : props.options))
const current = computed(() => props.options.find(o => o.Value === props.modelValue)?.Text || '')
const fixed = computed(() => props.options.length < 2)

async function show() {
  if (fixed.value) { return }
  const box = head.value!.getBoundingClientRect(), below = window.innerHeight - box.bottom - 24, above = box.top - 24
  up.value = below < 220 && above > below
  room.value = Math.max(160, Math.min(440, up.value ? above : below))
  term.value = ''; open.value = true
  await nextTick()
  const on = list.value?.querySelector<HTMLElement>('[aria-selected="true"]')
  if (on && list.value) { list.value.scrollTop = Math.max(0, on.offsetTop - list.value.clientHeight / 2) }
  // on a touch screen the search does not take the focus: the keyboard would cover the list
  if (searching.value && window.matchMedia('(pointer: fine)').matches) { field.value?.focus({ preventScroll: true }) } else { on?.focus({ preventScroll: true }) }
}
function close(back = true) {
  if (!open.value) { return }
  open.value = false
  if (back) { head.value?.focus({ preventScroll: true }) }
}
function pick(value: string) { emit('update:modelValue', value); close() }
function move(step: number) {
  const items = Array.from(list.value?.querySelectorAll<HTMLElement>('button') || [])
  if (items.length) { items[Math.max(0, Math.min(items.length - 1, items.indexOf(document.activeElement as HTMLElement) + step))]?.focus() }
}
function first() { if (shown.value[0]) { pick(shown.value[0].Value) } }
const outside = (event: Event) => { if (!root.value?.contains(event.target as Node)) { close(false) } }
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>

<template>
  <div ref="root" class="sf-pick" :class="{ 'is-open': open, 'is-fixed': fixed, 'is-up': up }" @keydown.esc.stop="close()">
    <button :id="id" ref="head" type="button" class="sf-pick-head" :aria-disabled="fixed || undefined" aria-haspopup="listbox" :aria-expanded="open" @click="open ? close() : show()" @keydown.down.prevent="open ? move(1) : show()">
      <span><span>{{ label }} : </span>{{ current }}</span>
      <svg v-if="!fixed" viewBox="0 0 12 8" width="12" height="8" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M1 1.5l5 5 5-5" /></svg>
    </button>
    <div v-if="open" class="sf-pick-panel" :style="{ maxHeight: room + 'px' }" @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)" @keydown.tab="close()">
      <input v-if="searching" ref="field" v-model="term" type="search" class="sf-pick-search" :placeholder="search" :aria-label="search" autocomplete="off" @keydown.enter.prevent="first">
      <div ref="list" class="sf-pick-list" role="listbox" :aria-labelledby="id">
        <button v-for="o in shown" :key="o.Value" type="button" role="option" :aria-selected="o.Value === modelValue" @click="pick(o.Value)">{{ o.Text }}</button>
        <p v-if="!shown.length">{{ empty }}</p>
      </div>
    </div>
  </div>
</template>
