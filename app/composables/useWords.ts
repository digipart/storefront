// `w('Votre panier')`: the words of the engine in the language of the page (app/utils/words.ts).
export function useWords() {
  const site = inject<Ref<any>>('sfSite', ref(null))
  return (text: string, values: Record<string, string | number> = {}) => words(site.value?.Route?.LanguageIsoCode || 'fr', text, values)
}
