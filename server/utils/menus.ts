// The menus read from Digipart (server/api/storefront/menu.get.ts), kept a short while; dropped when Digipart says a menu changed.
export const menuCache = new Map<string, { at: number, data: unknown }>()
