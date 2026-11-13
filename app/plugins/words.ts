// The words of the engine (app/utils/words.ts). On the server every language is loaded once. In the browser only the language of the page is, before the page comes alive, so that what the
// server drew and what the browser draws are the same sentences; a French page loads nothing.
const loaders: Record<string, () => Promise<{ default: Record<string, string> }>> = {
  en: () => import('~/words/en'), de: () => import('~/words/de'), es: () => import('~/words/es'), it: () => import('~/words/it'),
}
let all: Promise<unknown> | null = null

export default defineNuxtPlugin(async () => {
  if (import.meta.server) {
    all = all || Promise.all(Object.entries(loaders).map(async ([lang, load]) => setWords(lang, (await load()).default)))
    await all
    return
  }
  const lang = String(document.documentElement.lang || 'fr').toLowerCase().slice(0, 2)
  const load = loaders[lang]
  if (load) { try { setWords(lang, (await load()).default) } catch { /* the page is then shown in French rather than not at all */ } }
})
