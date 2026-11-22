import type { RouteLocationNormalizedLoaded } from 'vue-router'

// The key of the data of the page shown: its path and the parameters of a listing only (a campaign's utm_… do not change the page: server/utils/pages.ts keeps one copy).
const LISTING = ['page', 'q', 'sort', 'attr', 'min', 'max', 'tab', 'promo']
export function viewKey(route: RouteLocationNormalizedLoaded): string {
  const kept = LISTING.filter(name => typeof route.query[name] === 'string' && route.query[name] !== '').map(name => name + '=' + String(route.query[name]))
  return 'sf-view-' + route.path + (kept.length ? '?' + kept.join('&') : '')
}
