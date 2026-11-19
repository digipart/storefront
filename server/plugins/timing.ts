// The cost of each request (server/utils/timing.ts): its `Server-Timing` header, ONLY in a preview (the shop looking at its site from the back-office: the cookie `sf_preview` or `?preview=`),
// so that a visitor never sees how the site works inside; and a line in the log when SF_TIMING=1 (any request).
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('request', (event) => { timingOf(event) })
  nitro.hooks.hook('beforeResponse', (event) => {
    if (event.context.sfTiming === undefined) { return }
    const preview = !!getCookie(event, 'sf_preview') || getQuery(event).preview !== undefined
    if (preview && getQuery(event).preview !== 'off') {
      try { if (!event.node.res.headersSent) { setResponseHeader(event, 'Server-Timing', timingHeader(event)) } } catch { /* already sent */ }
    }
    if (process.env.SF_TIMING === '1' && !/^\/(_nuxt|font)\//.test(event.path)) { console.log(timingLine(event)) }
  })
})
