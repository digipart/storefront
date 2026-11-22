// Country, tax and currency of the request, checked before anything reads a price or a kept page (the file name puts it first).
export default defineEventHandler(async (event) => {
  if (event.path.startsWith('/_nuxt/') || event.path.startsWith('/font')) { return }
  await checkRegion(event)
})
