// The cost of each request (server/utils/timing.ts): its `Server-Timing` header, and a line in the log when SF_TIMING=1.
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('request', (event) => { timingOf(event) })
  nitro.hooks.hook('beforeResponse', (event) => {
    if (event.context.sfTiming === undefined) { return }
    try { if (!event.node.res.headersSent) { setResponseHeader(event, 'Server-Timing', timingHeader(event)) } } catch { /* already sent */ }
    if (process.env.SF_TIMING === '1' && !/^\/(_nuxt|font)\//.test(event.path)) { console.log(timingLine(event)) }
  })
})
