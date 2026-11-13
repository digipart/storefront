// The words of the engine itself (buttons, labels, messages: what no shop writes in the site builder), in the languages a site may be shown in. The key is the French sentence; a language or a sentence
// that is not here is shown in French. `{a}`, `{b}` are replaced by the values given. The texts the shop writes (titles, buttons of its sections) are translated in the site builder, not here.
//
// One file per language (app/words/<language>.ts): a page only carries the words of its own language, and a French page carries none (the French sentence is the key). To add a sentence: write it
// in French in the component, `w('Ma phrase')`, and add its translation to each file of app/words/. On the server every language is known; in the browser the one of the page is loaded before
// the page comes alive (app/plugins/words.ts).
const DICTIONARIES: Record<string, Record<string, string>> = {}

/** The languages the engine has words for, French apart. */
export const WORD_LANGUAGES = ['en', 'de', 'es', 'it']

export function setWords(lang: string, dictionary: Record<string, string>) { DICTIONARIES[lang] = dictionary }

export function words(lang: string, text: string, values: Record<string, string | number> = {}): string {
  let out = DICTIONARIES[String(lang || 'fr').toLowerCase()]?.[text] || text
  for (const [name, value] of Object.entries(values)) { out = out.replace('{' + name + '}', String(value)) }
  return out
}
