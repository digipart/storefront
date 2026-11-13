import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// A menu of Digipart (Catalogue > Menus) for the header or a column of the footer: its tabs, and under each its columns of links (the large menu). Read from the public menu API of Digipart
// (api/menu, the one the other fronts use: untouched), kept a while in memory. `id` = 0: the main menu. A menu that cannot be read is an empty one: the site is drawn without it.
const cache = new Map<string, { at: number, data: unknown }>()

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const query = getQuery(event)
  const id = /^\d{1,9}$/.test(String(query.id ?? '')) ? Number(query.id) : 0
  const lang = /^[a-z]{2,3}$/i.test(String(query.lang ?? '')) ? String(query.lang).toUpperCase() : 'FR'
  const key = id + '-' + lang
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < Number(config.cacheSeconds) * 1000) { return hit.data }
  let raw: any = null
  try {
    raw = config.fixtures
      ? JSON.parse(await readFile(join(config.fixtures, 'menu-' + id + '.json'), 'utf8'))
      : await $fetch(String(config.digipartUrl || config.localUrl).replace(/\/+$/, '') + '/api/menu/', { query: id ? { LanguageIsoCode: lang, IdMenu: id } : { LanguageIsoCode: lang }, retry: 0, timeout: 8000 })
  } catch { raw = null }
  const link = (url: unknown) => (typeof url === 'string' ? url.trim() : '')
  const data = {
    Tabs: (Array.isArray(raw?.TabBarDatas) ? raw.TabBarDatas : []).map((tab: any) => ({
      Name: String(tab.MenuTabBarName || tab.MenuTabBarDefaultName || ''), Url: link(tab.MenuTabBarURL),
      Columns: (tab.MenuColumns || []).map((column: any) => ({
        Name: String(column.MenuColumnName || ''),
        Groups: (column.MenuGroupElements || []).map((group: any) => ({ Name: String(group.MenuGroupElementName || ''), Links: (group.MenuElements || []).map((element: any) => ({ Name: String(element.MenuElementName || ''), Url: link(element.MenuElementURL) })).filter((l: any) => l.Name) })),
      })),
    })).filter((tab: any) => tab.Name),
  }
  cache.set(key, { at: Date.now(), data })
  return data
})
