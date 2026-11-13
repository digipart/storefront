// The cart of the visitor, shared by every part of the page (the header, the buy button, the cart panel, the cart page). It is read in the browser only: the HTML of a page is the same for every visitor
// and can be cached.
export interface SfCart { Count: number, Currency: string, Lines: any[], Codes: any[], Products: number, Discount: number, Shipping: number, ToPay: number, Error?: string }

export function useCart() {
  const site = inject<Ref<any>>('sfSite', ref(null))
  const cart = useState<SfCart>('sf-cart', () => ({ Count: 0, Currency: 'EUR', Lines: [], Codes: [], Products: 0, Discount: 0, Shipping: 0, ToPay: 0 }))
  const open = useState<boolean>('sf-cart-open', () => false)
  const busy = useState<boolean>('sf-cart-busy', () => false)
  const loaded = useState<boolean>('sf-cart-loaded', () => false)
  const error = useState<string>('sf-cart-error', () => '')
  const query = () => ({ lang: site.value?.Route?.LanguageIsoCode || '', prefix: site.value?.Route?.Prefix || '' })
  const url = computed(() => (site.value?.Route?.Prefix || '') + ((site.value?.Route?.LanguageIsoCode || 'fr') === 'fr' ? '/panier' : '/cart'))

  async function load() {
    try { cart.value = await $fetch<SfCart>('/api/storefront/cart', { query: query() }) } catch { /* the page still works without the cart */ }
    loaded.value = true
  }
  async function send(body: Record<string, unknown>): Promise<boolean> {
    if (busy.value) { return false }
    busy.value = true
    error.value = ''
    try {
      const answer = await $fetch<SfCart>('/api/storefront/cart', { method: 'POST', query: query(), body })
      error.value = answer.Error || ''
      cart.value = answer
      return !answer.Error
    } catch { error.value = 'Le panier ne répond pas, merci de réessayer.'; return false } finally { busy.value = false }
  }
  const add = async (idProduct: number, idVariant: number, quantity = 1) => { const done = await send({ Action: 'add', IdProduct: idProduct, IdProductAttribute: idVariant, Quantity: quantity }); if (done) { show('cart') } return done }
  const addMany = async (idProduct: number, items: { IdProductAttribute: number, Quantity: number }[]) => { const done = await send({ Action: 'add-many', IdProduct: idProduct, Items: items }); if (done) { show('cart') } return done }
  const setQuantity = (line: any, quantity: number) => (quantity < 1 ? remove(line) : send({ Action: 'update', IdProduct: line.IdProduct, IdProductAttribute: line.IdProductAttribute, Quantity: quantity }))
  const setVariant = (line: any, idVariant: number) => send({ Action: 'update', IdProduct: line.IdProduct, IdProductAttribute: line.IdProductAttribute, Quantity: line.Quantity, NewIdProductAttribute: idVariant })
  const tab = useState<'favorites' | 'cart' | 'account'>('sf-panel-tab', () => 'cart')
  const show = (which: 'favorites' | 'cart' | 'account') => { tab.value = which; open.value = true }
  const remove = (line: any) => send({ Action: 'remove', IdProduct: line.IdProduct, IdProductAttribute: line.IdProductAttribute, Quantity: line.Quantity })
  const addCode = (code: string) => send({ Action: 'code', Code: code })
  const removeCode = (id: number) => send({ Action: 'uncode', IdPromoCode: id })
  return { cart, open, tab, show, busy, loaded, error, url, load, add, addMany, setQuantity, setVariant, remove, addCode, removeCode }
}
