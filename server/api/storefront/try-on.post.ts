// The virtual try-on, start: multipart {IdProduct, Photo, TurnstileToken, Website}. The photo is checked (an image, 12 MB at most) and relayed to Digipart with the visit and the visitor's address;
// it is not written anywhere here (only in a temporary file in local development, deleted once read). Answers {Id, Status, Reason, Image, Kind, Framing}: the page then asks where it stands.
const MAX = 12 * 1024 * 1024

export default defineEventHandler(async (event) => {
  sameSiteOnly(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const parts = await readMultipartFormData(event).catch(() => null) || []
  const field = (name: string) => { const part = parts.find(p => p.name === name && !p.filename); return part ? part.data.toString('utf8').slice(0, 4096) : '' }
  if (field('Website') !== '') { return { Status: 'failed', Reason: 'error' } }   // a field no person fills
  const idProduct = Math.floor(Number(field('IdProduct')) || 0)
  const photo = parts.find(p => p.name === 'Photo' && p.filename !== undefined)
  if (idProduct < 1) { return { Status: 'failed', Reason: 'product' } }
  if (!photo || photo.data.length === 0 || photo.data.length > MAX || !['image/jpeg', 'image/png', 'image/webp'].includes(String(photo.type))) { return { Status: 'failed', Reason: 'photo' } }
  const answer = await tryOnCall(event, { IdProduct: String(idProduct) }, { data: photo.data, type: String(photo.type) }, {
    Visitor: tryOnVisit(event), IP: getRequestIP(event, { xForwardedFor: true }) || '', TurnstileToken: field('TurnstileToken'), Website: '',
  })
  return tryOnAnswer(answer)
})
