// How fast the page being looked at is: what the browser measured (Core Web Vitals, what it loaded) and what the engine told (`Server-Timing` of a preview, server/utils/timing.ts).
// Read in the preview bar only (SfPreviewBar.vue).
export interface PerfGroup { label: string, bytes: number, count: number, unknown: number }
export interface PerfServer { total: number, digipart: { n: number, kept: number, ms: number }, shop: { n: number, kept: number, ms: number }, slow: Array<{ path: string, ms: number }> }
export interface PerfImage { name: string, bytes: number, natural: number, shown: number }
export interface PerfState {
  ready: boolean, ttfb: number, load: number, lcp: { ms: number, what: string } | null, cls: number, inp: number | null,
  server: PerfServer | null, groups: PerfGroup[], total: number, requests: number, unknown: number, images: PerfImage[], advice: string[]
}

const GROUPS: Array<[string, (r: PerformanceResourceTiming, ext: string) => boolean]> = [
  ['JavaScript', (r, ext) => r.initiatorType === 'script' || ext === 'js' || ext === 'mjs'],
  ['CSS', (r, ext) => ext === 'css'],
  ['Polices', (_r, ext) => ['woff2', 'woff', 'ttf', 'otf'].includes(ext)],
  ['Images', (r, ext) => r.initiatorType === 'img' || r.initiatorType === 'image' || ['webp', 'avif', 'jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext)],
  ['Vidéo et cadres', (r, ext) => r.initiatorType === 'iframe' || r.initiatorType === 'video' || ['mp4', 'webm', 'm3u8'].includes(ext)],
  ['Données', r => r.initiatorType === 'fetch' || r.initiatorType === 'xmlhttprequest' || r.initiatorType === 'beacon'],
]

export const perfLevel = (kind: 'lcp' | 'cls' | 'inp' | 'ttfb', value: number | null | undefined): '' | 'good' | 'mid' | 'bad' => {
  if (value === null || value === undefined || !Number.isFinite(value)) { return '' }
  const [good, mid] = ({ lcp: [2500, 4000], cls: [0.1, 0.25], inp: [200, 500], ttfb: [800, 1800] } as Record<string, [number, number]>)[kind]!
  return value <= good ? 'good' : value <= mid ? 'mid' : 'bad'
}
const nf = (digits: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits })
export const perfTime = (ms: number) => (ms >= 1000 ? nf(2).format(ms / 1000) + ' s' : Math.round(ms) + ' ms')
export const perfBytes = (bytes: number) => (bytes >= 1024 * 1024 ? nf(1).format(bytes / 1024 / 1024) + ' Mo' : Math.max(1, Math.round(bytes / 1024)) + ' Ko')
const fileName = (url: string) => { try { return decodeURIComponent(new URL(url, location.href).pathname.split('/').pop() || url) } catch { return url } }

export function usePagePerf() {
  const state = useState<PerfState>('sf-perf', () => ({ ready: false, ttfb: 0, load: 0, lcp: null, cls: 0, inp: null, server: null, groups: [], total: 0, requests: 0, unknown: 0, images: [], advice: [] }))
  let watching = false

  function watch() {
    if (watching || !import.meta.client || typeof PerformanceObserver === 'undefined') { return }
    watching = true
    const observe = (type: string, read: (entries: any[]) => void, more: Record<string, unknown> = {}) => { try { new PerformanceObserver(list => read(list.getEntries())).observe({ type, buffered: true, ...more } as any) } catch { /* not measured by this browser */ } }
    observe('largest-contentful-paint', (entries) => {
      const last = entries[entries.length - 1]
      if (!last) { return }
      const el = last.element as HTMLElement | null
      const what = last.url ? 'image « ' + fileName(last.url) + ' »' : el ? (el.tagName === 'IMG' ? 'image' : 'texte « ' + String(el.textContent || '').trim().slice(0, 40) + ' »') : ''
      state.value.lcp = { ms: last.startTime, what }
    })
    observe('layout-shift', (entries) => { for (const e of entries) { if (!e.hadRecentInput) { state.value.cls += e.value } } })
    observe('event', (entries) => { for (const e of entries) { if (e.interactionId) { state.value.inp = Math.max(state.value.inp || 0, e.duration) } } }, { durationThreshold: 40 })
  }

  const asked = new Map<string, number>()   // weights told by the engine for the files of other sites (server/api/storefront/sizes.post.ts)
  async function measure() {
    if (!import.meta.client) { return }
    read()
    const unknown = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter(r => !r.transferSize && !r.encodedBodySize && !r.decodedBodySize && !asked.has(r.name) && /^https?:/.test(r.name)).map(r => r.name).slice(0, 40)
    if (!unknown.length) { return }
    const preview = new URLSearchParams(location.search).get('preview') || '1'
    const answer = await $fetch<{ Sizes: Record<string, number> }>('/api/storefront/sizes', { method: 'POST', query: { preview }, body: { Urls: unknown } }).catch(() => null)
    for (const url of unknown) { asked.set(url, Number(answer?.Sizes?.[url]) || 0) }
    read()
  }

  function read() {
    const s = state.value
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    s.ttfb = nav ? nav.responseStart : 0
    s.load = nav && nav.loadEventEnd > 0 ? nav.loadEventEnd : performance.now()
    // what the engine told about its own work (a preview only)
    const timing = (nav as any)?.serverTiming as Array<{ name: string, description: string, duration: number }> | undefined
    if (timing?.length) {
      const part = (name: string) => { const t = timing.find(x => x.name === name); const m = String(t?.description || '').match(/(\d+)\D+(\d+)/); return { n: Number(m?.[1] || 0), kept: Number(m?.[2] || 0), ms: Math.round(t?.duration || 0) } }
      s.server = { total: Math.round(timing.find(x => x.name === 'total')?.duration || 0), digipart: part('digipart'), shop: part('shop'), slow: timing.filter(x => /^slow\d$/.test(x.name)).map(x => ({ path: x.description, ms: Math.round(x.duration) })) }
    }
    // what the page loaded, by kind (a file of another site that does not tell its size is counted apart)
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    const groups: PerfGroup[] = [...GROUPS.map(([label]) => ({ label, bytes: 0, count: 0, unknown: 0 })), { label: 'Autres', bytes: 0, count: 0, unknown: 0 }]
    const sizeOf = (r: PerformanceResourceTiming) => r.transferSize || r.encodedBodySize || asked.get(r.name) || 0
    const images: PerfImage[] = []
    for (const r of resources) {
      const ext = (fileName(r.name).split('.').pop() || '').toLowerCase()
      const at = GROUPS.findIndex(([, test]) => test(r, ext))
      const group = groups[at < 0 ? groups.length - 1 : at]!
      const bytes = sizeOf(r)
      group.count++
      if (bytes) { group.bytes += bytes } else if (!r.decodedBodySize) { group.unknown++ }
      if (group.label === 'Images' && bytes) {
        const img = [...document.images].find(i => i.currentSrc === r.name)
        images.push({ name: fileName(r.name), bytes, natural: img?.naturalWidth || 0, shown: img ? Math.round(img.getBoundingClientRect().width * (window.devicePixelRatio || 1)) : 0 })
      }
    }
    const html = nav ? (nav.transferSize || nav.encodedBodySize || 0) : 0
    groups.unshift({ label: 'Page HTML', bytes: html, count: 1, unknown: 0 })
    s.groups = groups.filter(g => g.count)
    s.total = groups.reduce((sum, g) => sum + g.bytes, 0)
    s.requests = resources.length + 1
    s.unknown = groups.reduce((sum, g) => sum + g.unknown, 0)
    s.images = images.sort((a, b) => b.bytes - a.bytes).slice(0, 3)
    s.advice = adviceOf(s)
    s.ready = true
  }

  function adviceOf(s: PerfState): string[] {
    const out: string[] = []
    const video = [...document.querySelectorAll('iframe')].find(f => /vimeo|youtube/.test(f.src) && !f.closest('.sf-hero-video') && f.getBoundingClientRect().top < window.innerHeight)
    if (video) { out.push('Une vidéo (' + (/vimeo/.test(video.src) ? 'Vimeo' : 'YouTube') + ') se charge en haut de la page avec elle : son lecteur est lourd et retarde l\'affichage.') }
    if (s.lcp && perfLevel('lcp', s.lcp.ms) !== 'good') { out.push('Le plus grand élément du premier écran (' + (s.lcp.what || 'élément') + ') s\'affiche en ' + perfTime(s.lcp.ms) + ' : Google le veut sous 2,5 s.') }
    for (const img of s.images) {
      if (img.bytes > 400 * 1024) { out.push('L\'image « ' + img.name + ' » pèse ' + perfBytes(img.bytes) + '.') }
      if (img.natural && img.shown && img.natural > img.shown * 1.8 && !/\.svg$/i.test(img.name)) { out.push('L\'image « ' + img.name + ' » fait ' + img.natural + ' px de large pour ' + img.shown + ' px affichés.') }
    }
    if (perfLevel('cls', s.cls) !== 'good') { out.push('La page bouge pendant le chargement (stabilité ' + nf(2).format(s.cls) + ') : une image ou un bloc sans hauteur réservée pousse le reste.') }
    const js = s.groups.find(g => g.label === 'JavaScript')
    if (js && js.bytes > 400 * 1024) { out.push('Le JavaScript pèse ' + perfBytes(js.bytes) + '.') }
    if (s.server && s.server.total > 1000) { out.push('Le serveur a mis ' + perfTime(s.server.total) + ' (' + s.server.digipart.n + ' appels à Digipart). En aperçu la page est toujours fabriquée ; un visiteur la reçoit en général déjà prête.') }
    return out
  }

  return { state, watch, measure }
}
