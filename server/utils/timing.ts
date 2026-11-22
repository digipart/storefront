import type { H3Event } from 'h3'

// What a request cost: how many questions it asked Digipart (api/storefront: `digipart`) and the shop APIs (api/product, api/category: `shop`), how many of them were answered by the memory of
// this server, and how long the others took. Sent back in the `Server-Timing` header in a preview only (server/plugins/timing.ts: the Network tab of the browser shows it) and, with
// SF_TIMING=1 in the environment, written in the log.
interface Tally { n: number, kept: number, ms: number, slow: Array<{ path: string, ms: number }> }
export interface Timing { start: number, digipart: Tally, shop: Tally }

const tally = (): Tally => ({ n: 0, kept: 0, ms: 0, slow: [] })

// a page drawn on the server asks the engine's own API (view, site…): those requests carry the page's mark and add their questions to the page's count
const renders = new Map<string, Timing>()
export function timingStart(event: H3Event) {
  const mark = String(event.node.req.headers['x-sf-render'] || '')
  const page = mark ? renders.get(mark) : undefined
  if (page) { event.context.sfTiming = page; event.context.sfTimingChild = true; return }
  const t = timingOf(event)
  if (event.path.startsWith('/api/') || /^\/(_nuxt|font)\//.test(event.path)) { return }
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2)
  renders.set(id, t)
  if (renders.size > 300) { renders.delete(renders.keys().next().value as string) }
  event.context.sfRender = id
  event.node.req.headers['x-sf-render'] = id
}
export function timingEnd(event: H3Event) { if (event.context.sfRender) { renders.delete(event.context.sfRender) } }

export function timingOf(event: H3Event): Timing {
  event.context.sfTiming = event.context.sfTiming || { start: Date.now(), digipart: tally(), shop: tally() }
  return event.context.sfTiming as Timing
}

/** One question: `ms` < 0 when the memory of this server answered it. */
export function noteCall(event: H3Event | undefined, kind: 'digipart' | 'shop', path: string, ms: number) {
  if (!event) { return }
  const t = timingOf(event)[kind]
  t.n++
  if (ms < 0) { t.kept++; return }
  t.ms += ms
  t.slow.push({ path: path.split('?')[0]!.slice(0, 60), ms })
  if (t.slow.length > 40) { t.slow.sort((a, b) => b.ms - a.ms).length = 20 }
}

/** The `Server-Timing` header of a request: the count of each kind, how many were kept, the time spent asking (added up: the questions asked at the same time overlap), and the whole request. */
export function timingHeader(event: H3Event): string {
  const t = timingOf(event)
  const part = (name: string, x: Tally) => `${name};desc="${x.n} appels, ${x.kept} en cache";dur=${x.ms}`
  const slow = [...t.digipart.slow, ...t.shop.slow].sort((a, b) => b.ms - a.ms).slice(0, 3).map((x, i) => `slow${i + 1};desc="${x.path.replace(/["\\]/g, '')}";dur=${x.ms}`)
  return [part('digipart', t.digipart), part('shop', t.shop), ...slow, `total;dur=${Date.now() - t.start}`].join(', ')
}

export function timingLine(event: H3Event): string {
  const t = timingOf(event)
  const slow = [...t.digipart.slow.map(x => ({ ...x, k: 'd' })), ...t.shop.slow.map(x => ({ ...x, k: 's' }))].sort((a, b) => b.ms - a.ms).slice(0, 5).map(x => x.k + ':' + x.path + ' ' + x.ms + 'ms').join(', ')
  return `[timing] ${event.method} ${event.path.slice(0, 120)} · ${Date.now() - t.start}ms · digipart ${t.digipart.n} (${t.digipart.kept} cache, ${t.digipart.ms}ms) · shop ${t.shop.n} (${t.shop.kept} cache, ${t.shop.ms}ms)${slow ? ' · plus lents: ' + slow : ''}`
}
