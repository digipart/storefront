// Address suggestions while the customer types the delivery address (Google Places, asked from this server: the key never reaches the browser). Off, and silent, when the site has no key
// (GOOGLE_PLACES_KEY in its environment). `?q=` + `country=` + `session=` answers suggestions; `?place=` answers the address of the one the customer picked.
export default defineEventHandler(async (event) => {
  sameSiteOnly(event)
  const key = String(useRuntimeConfig(event).googlePlacesKey || '')
  const query = getQuery(event)
  const { lang } = langOf(event)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  if (!key) { return { Enabled: false, Suggestions: [], Address: null } }
  const session = /^[A-Za-z0-9-]{8,64}$/.test(String(query.session ?? '')) ? String(query.session) : ''
  const place = String(query.place ?? '')
  try {
    if (place) {
      if (!/^[A-Za-z0-9_-]{10,300}$/.test(place)) { return { Enabled: true, Suggestions: [], Address: null } }
      const found = await $fetch<any>('https://places.googleapis.com/v1/places/' + place, { query: { languageCode: lang, ...(session ? { sessionToken: session } : {}) }, headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'addressComponents' }, timeout: 6000, retry: 0 })
      const part = (type: string, short = false) => { const c = (found.addressComponents || []).find((x: any) => (x.types || []).includes(type)); return c ? String(short ? c.shortText : c.longText) : '' }
      const street = [part('street_number'), part('route')].filter(Boolean).join(' ')
      return { Enabled: true, Suggestions: [], Address: { Address1: street || part('premise'), Postcode: part('postal_code'), City: part('locality') || part('postal_town') || part('administrative_area_level_3'), CountryIsoCode: part('country', true).toUpperCase() } }
    }
    const input = String(query.q ?? '').trim().slice(0, 150)
    const country = String(query.country ?? '').toLowerCase()
    if (input.length < 4) { return { Enabled: true, Suggestions: [], Address: null } }
    const found = await $fetch<any>('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST', headers: { 'X-Goog-Api-Key': key }, timeout: 6000, retry: 0,
      body: { input, languageCode: lang, includedPrimaryTypes: ['street_address', 'premise', 'subpremise', 'route'], ...(/^[a-z]{2}$/.test(country) ? { includedRegionCodes: [country] } : {}), ...(session ? { sessionToken: session } : {}) },
    })
    const suggestions = (found.suggestions || []).map((s: any) => s.placePrediction).filter(Boolean).slice(0, 5).map((p: any) => ({ Id: String(p.placeId), Main: String(p.structuredFormat?.mainText?.text || p.text?.text || ''), More: String(p.structuredFormat?.secondaryText?.text || '') }))
    return { Enabled: true, Suggestions: suggestions, Address: null }
  } catch { return { Enabled: true, Suggestions: [], Address: null } }   // the customer simply types the address
})
