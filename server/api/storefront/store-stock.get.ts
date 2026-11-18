// The shops of the brand for a product: where each size is in stock (the stock of the location tied to the shop, read by Digipart's API api/store/stock/availability, untouched), its address,
// its phone, its opening hours and whether it takes reservations. Only the shops that show their stock to visitors (Boutiques > « Stock visible sur le site ») are given: the others would only
// say « unknown ». `Lat`/`Lng` (the visitor's position, asked by the browser) sort them by distance; the position is not sent to Digipart.
const text = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max)
const km = (a: [number, number], b: [number, number]) => {
  const r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)))
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { lang } = langOf(event)
  const idProduct = Math.floor(Number(query.IdProduct) || 0)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  if (idProduct < 1) { return { Stores: [] } }
  // the shops that show their stock (and take reservations): the list Digipart gives with the product
  const extra = await digipart(event, 'product-extra.php', { IdProduct: idProduct, LanguageIsoCode: lang }).catch(() => null)
  const shown = new Map<number, { Name: string, City: string, Images: string[] }>(((extra?.Reservation?.Stores || []) as any[]).map((s: any) => [Number(s.Id) || 0, { Name: text(s.Name, 120), City: text(s.City, 100), Images: (Array.isArray(s.Images) ? s.Images : []).filter((u: any) => /^https:\/\/[^\s"'<>]+$/.test(String(u))).slice(0, 4) }]))
  if (!shown.size) { return { Stores: [] } }
  const product = await loadProduct(event, idProduct, lang, '')
  const variants = product?.Variants || []
  const anyVariant = variants[0]?.Id || 0
  const answer = anyVariant ? await shopApi(event, 'store/stock/availability', { IdProduct: idProduct, IdProductAttribute: anyVariant, LanguageIsoCode: lang.toUpperCase() }) : null
  const here = Number.isFinite(Number(query.Lat)) && Number.isFinite(Number(query.Lng)) && query.Lat !== undefined && query.Lng !== undefined ? [Number(query.Lat), Number(query.Lng)] as [number, number] : null
  const stores = (Array.isArray(answer?.Stores) ? answer.Stores : []).filter((s: any) => shown.has(Number(s.IdStore))).map((s: any) => {
    const stock: Record<string, number> = {}
    for (const v of Array.isArray(s.Variants) ? s.Variants : []) {
      const id = Number(v?.Combination?.IdProductAttribute) || 0
      if (id > 0) { stock[id] = Math.max(stock[id] || 0, Math.max(0, Number(v.Quantity) || 0)) }
    }
    const lat = Number(s.Latitude), lng = Number(s.Longitude), placed = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)
    const address = [text(s.Address1, 160), text(s.Address2, 160)].filter(Boolean).join(', ')
    const known = shown.get(Number(s.IdStore))!   // the name and the town Digipart gives with the product, when the detail of the shop could not be read
    const name = text(s.Name, 120) || known.Name, city = text(s.City, 100) || known.City
    return {
      Id: Number(s.IdStore) || 0, Name: name, Address: address, PostalCode: text(s.PostalCode, 20), City: city, Phone: text(s.Phone || s.MobilePhone, 30),
      Known: !!s.HasStockInfo, Stock: stock, Images: known.Images,
      Hours: (Array.isArray(s.OpeningHours) ? s.OpeningHours : []).slice(0, 7).map((d: any) => ({ Day: text(d?.Day, 20), Slots: (Array.isArray(d?.TimeSlots) ? d.TimeSlots : []).map((t: any) => text(t?.TimeSlotStart, 5) + ' – ' + text(t?.TimeSlotEnd, 5)).join(', ') })),
      MapsUrl: /^https:\/\//.test(String(s.GoogleMapsUrl)) ? String(s.GoogleMapsUrl) : placed ? 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([name, address, text(s.PostalCode, 20), city].filter(Boolean).join(' ')),
      Distance: here && placed ? Math.round(km(here, [lat, lng]) * 10) / 10 : null,
    }
  }).filter((s: any) => s.Id > 0)
  if (here) { stores.sort((a: any, b: any) => (a.Distance ?? 1e9) - (b.Distance ?? 1e9)) }
  return { Stores: stores }
})
