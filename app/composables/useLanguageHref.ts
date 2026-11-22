// The address of the page being read in another language of the site: the same page there (told by SfView), else the home of that language.
// The same page is known once the page is shown in the browser: the header is drawn before the page on the server.
export function useLanguageHref(siteRef?: Ref<any>) {
  const site = siteRef || inject<Ref<any>>('sfSite', ref(null))
  const known = useState<{ paths: Record<string, string> | null, query: string }>('sf-lang-paths', () => ({ paths: null, query: '' }))
  const ready = ref(false)
  onMounted(() => { ready.value = true })
  return (language: any) => {
    const iso = String(language?.LanguageIsoCode || '')
    const prefix = language?.Default && site.value?.UrlPrefix !== 'always' ? '' : '/' + iso
    const path = ready.value ? known.value.paths?.[iso] : undefined
    return path ? prefix + '/' + path + known.value.query : (prefix || '/')
  }
}
