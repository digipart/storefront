// The shops of the brand (Digipart: Configuration > Boutiques, the active ones; api/stores, the API every front uses): name, address, phone, e-mail, where it is, its opening hours.
const DAYS: Record<string, string> = { Monday: 'Lundi', Tuesday: 'Mardi', Wednesday: 'Mercredi', Thursday: 'Jeudi', Friday: 'Vendredi', Saturday: 'Samedi', Sunday: 'Dimanche' }
const text = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max)
const hour = (value: unknown) => { const found = /^(\d{1,2}):(\d{2})/.exec(String(value ?? '')); return found ? found[1]!.padStart(2, '0') + ':' + found[2] : '' }

export default defineEventHandler(async (event) => {
  const { lang } = langOf(event)
  const answer = await shopApi<any>(event, 'stores', { LanguageIsoCode: lang.toUpperCase(), StoreActive: 1 })
  const stores = (Array.isArray(answer) ? answer : []).map((s: any) => {
    const latitude = Number(s.Latitude), longitude = Number(s.Longitude)
    const located = Number.isFinite(latitude) && Number.isFinite(longitude) && (latitude !== 0 || longitude !== 0) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    const map = text(s.GoogleMapsUrl, 500)
    return {
      Id: Number(s.IdStore) || 0, Name: text(s.Name, 120), Address: [s.Address1, s.Address2].map(v => text(v, 150)).filter(Boolean).join(', '), Postcode: text(s.PostalCode, 20), City: text(s.City, 100), Country: text(s.Country, 80),
      Phone: text(s.Phone || s.MobilePhone, 30), Email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(s.Email, 150)) ? text(s.Email, 150) : '',
      Latitude: located ? latitude : null, Longitude: located ? longitude : null, MapUrl: /^https:\/\//i.test(map) ? map : '',
      Hours: (Array.isArray(s.OpeningHours) ? s.OpeningHours : []).map((day: any) => ({
        Day: DAYS[String(day?.Day)] || text(day?.Day, 20),
        Text: (Array.isArray(day?.TimeSlots) ? day.TimeSlots : []).map((slot: any) => [hour(slot?.TimeSlotStart), hour(slot?.TimeSlotEnd)]).filter((slot: string[]) => slot[0] && slot[1]).map((slot: string[]) => slot.join(' – ')).join(' / '),
      })).filter((day: any) => day.Day && day.Text).slice(0, 7),
    }
  }).filter((s: any) => s.Id > 0 && s.Name)
  return { Stores: stores }
})
