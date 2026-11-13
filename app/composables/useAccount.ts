// Who is logged in and the favourites of the visitor, shared by the header, the product pages, the favourites page and the account. Read in the browser only (the HTML of a page is the same for everyone).
export function useAccount() {
  const site = inject<Ref<any>>('sfSite', ref(null))
  const customer = useState<any>('sf-customer', () => null)
  const favorites = useState<number[]>('sf-favorites', () => [])
  const loaded = useState<boolean>('sf-account-loaded', () => false)
  const busy = useState<boolean>('sf-account-busy', () => false)
  const query = () => ({ lang: site.value?.Route?.LanguageIsoCode || '', prefix: site.value?.Route?.Prefix || '' })
  const french = computed(() => (site.value?.Route?.LanguageIsoCode || 'fr') === 'fr')
  const prefix = computed(() => site.value?.Route?.Prefix || '')
  const url = computed(() => prefix.value + (french.value ? '/compte' : '/account'))
  const favoritesUrl = computed(() => prefix.value + (french.value ? '/favoris' : '/wishlist'))
  const take = (answer: any) => { customer.value = answer.Customer || null; favorites.value = answer.Favorites || [] }

  async function load() {
    try { take(await $fetch<any>('/api/storefront/account', { query: { ...query(), part: 'me' } })) } catch { /* the page works without the account */ }
    loaded.value = true
  }
  /** One action on the account; answers {Error, Note}. */
  async function send(body: Record<string, unknown>): Promise<{ Error: string, Note: string }> {
    if (busy.value) { return { Error: '', Note: '' } }
    busy.value = true
    try { const answer = await $fetch<any>('/api/storefront/account', { method: 'POST', query: query(), body }); take(answer); return { Error: answer.Error || '', Note: answer.Note || '' } } catch { return { Error: 'Votre compte ne répond pas, merci de réessayer.', Note: '' } } finally { busy.value = false }
  }
  // the favourites with their name, picture and price (asked when a panel or a page shows them)
  const favoriteProducts = useState<any[]>('sf-favorite-products', () => [])
  async function loadFavorites() {
    try { const answer = await $fetch<any>('/api/storefront/account', { query: { ...query(), part: 'favorites' } }); favoriteProducts.value = answer.Products || []; favorites.value = answer.Ids || [] } catch { /* the list stays as it was */ }
  }
  const isFavorite = (id: number) => favorites.value.includes(id)
  async function toggleFavorite(id: number) {
    const on = !isFavorite(id)
    favorites.value = on ? [...favorites.value, id] : favorites.value.filter(x => x !== id)   // shown at once, corrected by the answer
    await send({ Action: 'fav', IdProduct: id, On: on })
  }
  return { customer, favorites, favoriteProducts, loadFavorites, loaded, busy, url, favoritesUrl, load, send, isFavorite, toggleFavorite, query }
}
