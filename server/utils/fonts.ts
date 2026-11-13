// The fonts of the theme, for the head of every page: a few lines of CSS written IN the page (no stylesheet to fetch before the page can be drawn) and the font files to load at once.
// The stylesheet of each family is read once from Google Fonts by this server (the visitor's browser never calls another company); only the Latin alphabets are kept (the languages of the
// sites: French, English, German, Spanish, Italian), and a variable font whose weights share one file becomes one rule. The files themselves are served by /font/... (server/routes/font).
const sheets = new Map<string, { css: string, files: string[] }>()

async function family(name: string): Promise<{ css: string, files: string[] }> {
  const kept = sheets.get(name)
  if (kept) { return kept }
  let made = { css: '', files: [] as string[] }
  try {
    const sheet = await $fetch<string>('https://fonts.googleapis.com/css2', { query: { family: name + ':wght@400;500;600;700', display: 'swap' }, responseType: 'text', retry: 0, timeout: 6000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' } })   // a recent browser: the answer is woff2, split by alphabet
    // subset -> file -> the weights that use it, and the range of characters of the subset
    const subsets = new Map<string, { range: string, byFile: Map<string, number[]> }>()
    for (const found of sheet.matchAll(/\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)) {
      const subset = found[1]!, body = found[2]!
      if (subset !== 'latin' && subset !== 'latin-ext') { continue }
      const file = /url\(https:\/\/fonts\.gstatic\.com\/(s\/[a-z0-9]+\/v\d+\/[A-Za-z0-9_-]+\.woff2)\)/.exec(body)?.[1], weight = Number(/font-weight:\s*(\d+)/.exec(body)?.[1] || 400), range = /unicode-range:\s*([^;]+);/.exec(body)?.[1] || ''
      if (!file || /font-style:\s*italic/.test(body)) { continue }
      const entry = subsets.get(subset) || { range, byFile: new Map<string, number[]>() }
      entry.byFile.set(file, [...(entry.byFile.get(file) || []), weight])
      subsets.set(subset, entry)
    }
    for (const [subset, entry] of subsets) {
      for (const [file, weights] of entry.byFile) {
        const low = Math.min(...weights), high = Math.max(...weights)
        made.css += '@font-face{font-family:\'' + name + '\';font-style:normal;font-weight:' + (low === high ? low : low + ' ' + high) + ';font-display:swap;src:url(/font/' + file + ') format(\'woff2\');' + (entry.range ? 'unicode-range:' + entry.range.replace(/\s+/g, '') + ';' : '') + '}'
        if (subset === 'latin' && made.files.length < 2) { made.files.push('/font/' + file) }   // the file nearly every page needs: asked for at once
      }
    }
    sheets.set(name, made)
  } catch { made = { css: '', files: [] } }   // not kept: asked again later; the theme falls back on the fonts of the device meanwhile
  return made
}

/** The CSS and the files of the fonts of a theme (`names`: the families of the theme settings of Digipart). */
export async function themeFonts(names: unknown[]): Promise<{ css: string, files: string[] }> {
  const families = names.filter((name): name is string => typeof name === 'string' && /^[A-Za-z0-9 ]{2,40}$/.test(name)).slice(0, 4)
  const all = await Promise.all(families.map(family))
  return { css: all.map(one => one.css).join(''), files: all.flatMap(one => one.files).slice(0, 3) }
}
