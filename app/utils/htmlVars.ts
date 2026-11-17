// The variables a shop can write in its own HTML (section "HTML personnalisé"): `{{ shop.name }}`, `{{ year }}`... They are replaced when the page is drawn, by values that are always escaped. The same
// names are listed by Digipart (class/Storefront/CustomCode.php: VARIABLES, the editor suggests them; a test compares the two lists). An unknown name is left as written.
export const HTML_VARS = ['shop.name', 'shop.url', 'year', 'lang', 'search.url', 'account.url', 'favorites.url', 'cart.url', 'checkout.url'] as const

export function htmlVars(site: any): Record<string, string> {
  const prefix = site?.Route?.Prefix || '', lang = site?.Route?.LanguageIsoCode || 'fr', french = lang === 'fr'
  return {
    'shop.name': String(site?.Name || ''),
    'shop.url': prefix || '/',
    'year': String(new Date().getFullYear()),
    'lang': lang,
    'search.url': prefix + (french ? '/recherche' : '/search'),
    'account.url': prefix + (french ? '/compte' : '/account'),
    'favorites.url': prefix + (french ? '/favoris' : '/wishlist'),
    'cart.url': prefix + (french ? '/panier' : '/cart'),
    'checkout.url': prefix + (french ? '/commande' : '/checkout'),
  }
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

/** The HTML with its variables replaced (by escaped values). */
export function withHtmlVars(html: string, site: any): string {
  if (!html || !html.includes('{{')) { return html }
  const values = htmlVars(site)
  return html.replace(/\{\{\s*([a-z_]+(?:\.[a-z_]+)?)\s*\}\}/g, (whole, name: string) => (Object.prototype.hasOwnProperty.call(values, name) ? escapeHtml(values[name] as string) : whole))
}
