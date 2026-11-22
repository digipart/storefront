// How long a page may be kept by a cache in front of the site (a CDN, a proxy). The HTML of a page is the same for every visitor (the cart, the favourites and the account are read by the
// browser afterwards), so it can be shared for a minute and served while a fresh copy is fetched. Never for someone logged in (a professional sees his prices in the page), for a theme
// preview, nor for what belongs to one visitor.
export default defineEventHandler((event) => {
  const path = event.path.split('?')[0]
  if (event.method !== 'GET' || path.startsWith('/api/') || path.startsWith('/_nuxt/') || /\.(xml|txt|css|js|woff2?|png|jpe?g|webp|svg|ico)$/.test(path)) { return }
  const personal = visitorCurrency(event) !== SHOP_CURRENCY || !!getCookie(event, 'sf_session') || !!getCookie(event, 'sf_preview') || getQuery(event).preview !== undefined || /\/(panier|cart|commande|checkout|compte|account|favoris|wishlist|reset)(\/|$)/.test(path)
  setResponseHeader(event, 'Cache-Control', personal ? 'private, no-store' : 'public, max-age=0, s-maxage=60, stale-while-revalidate=600')
})
