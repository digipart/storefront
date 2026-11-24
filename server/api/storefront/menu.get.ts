import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// A menu of Digipart (Catalogue > Menus) for the header or a column of the footer: its tabs, and under each its columns of links (the large menu). Read from the public menu API of Digipart
// (api/menu, the one the other fronts use: untouched), kept a while in memory. `id` = 0: the main menu. A menu that cannot be read is an empty one: the site is drawn without it.
const cache = menuCache

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const query = getQuery(event)
  const id = /^\d{1,9}$/.test(String(query.id ?? '')) ? Number(query.id) : 0
  const lang = /^[a-z]{2,3}$/i.test(String(query.lang ?? '')) ? String(query.lang).toUpperCase() : 'FR'
  const key = id + '-' + lang
  const hit = cache.get(key)
  // 30 s at most: Digipart keeps the menu itself and drops it when the shop changes it, so asking often is cheap
  if (hit && Date.now() - hit.at < Math.min(Number(config.cacheSeconds) || 30, 30) * 1000) { return hit.data }
  let raw: any = null
  try {
    raw = config.fixtures
      ? JSON.parse(await readFile(join(config.fixtures, 'menu-' + id + '.json'), 'utf8'))
      : await $fetch(String(config.digipartUrl || config.localUrl).replace(/\/+$/, '') + '/api/menu/', { query: id ? { LanguageIsoCode: lang, IdMenu: id } : { LanguageIsoCode: lang }, retry: 0, timeout: 8000 })
  } catch { raw = null }
  const link = (url: unknown) => (typeof url === 'string' ? url.trim() : '')
  // an element « Image » of the menu (type 4): its picture among the sizes api/menu gives (Media.Images), the smallest one at least 400 px wide, else the largest
  const picture = (element: any) => {
    if (Number(element?.IdMenuElementType) !== 4) { return '' }
    const sizes = Object.values(element?.Media?.Images || {}).filter((i: any) => /^(https?:)?\/\/[^\s"'<>]+$/.test(String(i?.Src || ''))) as any[]
    const wide = sizes.filter(i => Number(i.Width) >= 400).sort((a, b) => Number(a.Width) - Number(b.Width))
    return String((wide[0] || sizes.sort((a, b) => Number(b.Width) - Number(a.Width))[0])?.Src || '')
  }
  // an element « Vidéo » of the menu (type 5): its Vimeo address (MenuElementValue), as the player that plays it silent and in a loop
  const film = (element: any) => {
    if (Number(element?.IdMenuElementType) !== 5) { return '' }
    const found = String(element?.MenuElementValue || '').match(/vimeo\.com\/(?:video\/)?(\d{6,12})(?:\/([0-9a-f]{6,20}))?/i)
    return found ? 'https://player.vimeo.com/video/' + found[1] + '?background=1&autoplay=1&loop=1&muted=1&dnt=1' + (found[2] ? '&h=' + found[2] : '') : ''
  }
  const data: { Tabs: any[] } = {
    Tabs: (Array.isArray(raw?.TabBarDatas) ? raw.TabBarDatas : []).map((tab: any) => ({
      Name: String(tab.MenuTabBarName || tab.MenuTabBarDefaultName || ''), Url: link(tab.MenuTabBarURL),
      Columns: (tab.MenuColumns || []).map((column: any) => ({
        Name: String(column.MenuColumnName || ''),
        Groups: (column.MenuGroupElements || []).map((group: any) => ({ Name: String(group.MenuGroupElementName || ''), Links: (group.MenuElements || []).filter((element: any) => Number(element?.IdMenuElementType) !== 4 || picture(element)).filter((element: any) => Number(element?.IdMenuElementType) !== 5 || film(element)).map((element: any) => ({ Name: Number(element.IdMenuElementType) === 5 && String(element.MenuElementName || '') === String(element.MenuElementValue || '') ? '' : String(element.MenuElementName || ''), Url: Number(element.IdMenuElementType) === 5 ? '' : link(element.MenuElementURL), Image: picture(element), Video: film(element), IdCategory: Number(element.IdMenuElementType) === 1 ? Number(element.IdCategory) || 0 : 0 })).filter((l: any) => l.Name || l.Image || l.Video) })),
      })),
    })).filter((tab: any) => tab.Name),
  }
  // the round bubbles of the menu (header « Bulles photo devant les catégories »): the cover of each category of the menu, read once for the whole menu (api/storefront/category-thumbs.php)
  const ids = [...new Set(data.Tabs.flatMap((tab: any) => tab.Columns.flatMap((column: any) => column.Groups.flatMap((group: any) => group.Links.map((l: any) => l.IdCategory).filter((n: number) => n > 0)))))].slice(0, 60)
  if (ids.length && !config.fixtures) {
    const answer = await digipart<any>(event, 'category-thumbs.php', { Ids: ids.join(',') }).catch(() => null)
    const thumbs = answer?.Thumbs || {}
    for (const tab of data.Tabs) { for (const column of tab.Columns) { for (const group of column.Groups) { for (const l of group.Links) { if (l.IdCategory && typeof thumbs[l.IdCategory] === 'string') { l.Thumb = thumbs[l.IdCategory] } } } } }
  }
  cache.set(key, { at: Date.now(), data })
  return data
})
