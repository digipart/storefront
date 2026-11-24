// The site inside the site builder of Digipart. The builder shows the real site in a frame (a preview link with `builder=1`) instead of a mock-up: here the site listens to it and answers.
//
// - only in a preview (`site.Preview`: a signed link of the back-office) opened with `builder` in its address, and only for messages that come from the back-office of this site
//   (`PreviewAdminUrl`, the address Digipart is at): anything else is ignored;
// - `refresh`: a draft was saved, the site and the page are read anew (no reload: the scroll stays where it is);
// - a click on a section or a block tells the builder which one (`select`: the design it belongs to, header, footer or page, and its ids) instead of following the link; with `follow` on
//   (the switch « Suivre les liens » of the builder) links work, and keep the preview and the builder in their address;
//   a click beside the links and the controls still selects its section;
// - `select` from the builder: the section (or the block) is brought into view and outlined;
// - `design` / `theme`: what is being written in the builder, not saved yet, is drawn at once (the sections of the page, of the header or of the footer; the colours and sizes of the theme). The
//   HTML and the CSS a shop writes are NOT taken from these messages: they stay what Digipart last cleaned and gave (they follow at the next `refresh`, after the save);
// - a double click on a title, a text or a button writes it in place: each change is told to the builder (`text`), which keeps it; while a text is being written the page is not drawn anew
//   under the cursor (a `refresh` waits for the end);
// - the bar of the selected section is drawn by the builder itself, over this frame: the site tells where the section is (`box`) and, while it is dragged there, where it would be dropped
//   (`drag`, `drop`, then `move` with `before` / `after`). No frame is drawn around a section; a selected block has a thin one.
// - a block, or a column of a section of columns, is moved on the page itself by the handle drawn over it (`moveBlock`, `moveColumn`).
export default defineNuxtPlugin((nuxt) => {
  const route = useRoute()
  if (route.query.builder === undefined || window.parent === window) { return }
  const fresh = useState<number>('sf-fresh', () => 0)
  const site = useNuxtData<any>('sf-site').data
  let follow = false
  let editing: { node: HTMLElement, part: string, section: string, block: string, first: boolean } | null = null   // the text being written in place
  let waiting = false                                                                                              // a refresh asked meanwhile
  let missing = false                     // what the builder selected is not drawn yet (a section it has just added)
  let place: () => void = () => {}
  let last = { section: '', block: '' }   // what the builder has selected: outlined again once a refresh has drawn the page anew
  const origin = (): string => { try { return site.value?.Preview ? new URL(String(site.value.PreviewAdminUrl || '')).origin : '' } catch { return '' } }
  const tell = (message: Record<string, unknown>) => { const to = origin(); if (to) { window.parent.postMessage({ source: 'sf-site', ...message }, to) } }
  const idOf = (element: Element | null, prefix: string): string => { for (const name of Array.from(element?.classList || [])) { if (name.startsWith(prefix)) { return name.slice(prefix.length) } } return '' }
  // The sections sent by the builder take the place of the ones drawn, except what must come cleaned from Digipart: the HTML of a « HTML personnalisé » section and the custom CSS of a section
  // keep the value they have here (nothing for a section that is new).
  const guarded = (incoming: any[], current: any[]): any[] => {
    const known = new Map<string, any>((current || []).map((section: any) => [String(section?.Id), section]))
    return (Array.isArray(incoming) ? incoming : []).filter((section: any) => section && typeof section === 'object' && typeof section.Type === 'string').map((section: any) => {
      const before = known.get(String(section.Id))
      const settings = { ...(section.Settings || {}), CustomCss: before?.Settings?.CustomCss || '' }
      if (section.Type === 'custom_html') { settings.Html = before?.Settings?.Html || '' }
      // a code section is drawn by the server: it keeps what was drawn until the next `refresh` (after the save)
      return section.Type === 'code' ? { ...section, Settings: settings, Html: before?.Html || '', Error: before?.Error || '' } : { ...section, Settings: settings }
    })
  }
  const draw = (part: string, sections: any[]) => {
    if (part === 'header' || part === 'footer') {
      const name = part === 'header' ? 'Header' : 'Footer'
      if (site.value?.[name]) { site.value = { ...site.value, [name]: { ...site.value[name], Sections: guarded(sections, site.value[name].Sections) } } }
      return
    }
    // the page of a closed site being written (a preview on `closed=…`): it is part of the site, not a page of it
    if (site.value?.ClosedForced && site.value?.ClosedDesign) { site.value = { ...site.value, ClosedDesign: { ...site.value.ClosedDesign, Sections: guarded(sections, site.value.ClosedDesign.Sections) } }; return }
    const page = useNuxtData<any>(viewKey(route)).data
    if (page.value?.Design) { page.value = { ...page.value, Design: { ...page.value.Design, Sections: guarded(sections, page.value.Design.Sections) } } }
  }
  const paint = (variables: Record<string, unknown>, settings: Record<string, unknown>, schemes?: unknown) => {
    for (const [name, value] of Object.entries(variables || {})) {
      if (/^--t-[a-z-]+$/.test(name) && !name.startsWith('--t-font') && typeof value === 'string' && /^[#a-zA-Z0-9 .,%/()-]{1,60}$/.test(value)) { document.documentElement.style.setProperty(name, value) }
    }
    if (site.value?.Theme && settings && typeof settings === 'object') {
      const { CustomCss: ignoredCss, ...rest } = settings as Record<string, unknown>
      // the colour schemes being written (app.vue checks each id, variable and colour before it writes them)
      const drawn = Array.isArray(schemes) ? schemes.slice(0, 8).filter((scheme: any) => scheme && typeof scheme === 'object' && typeof scheme.Id === 'string' && scheme.Variables && typeof scheme.Variables === 'object') : site.value.Theme.Schemes
      site.value = { ...site.value, Theme: { ...site.value.Theme, Settings: { ...site.value.Theme.Settings, ...rest }, Schemes: drawn } }
    }
  }
  let arrows: (can: boolean) => void = () => {}
  let shown = false                       // a section is selected in the builder: its place is told
  let dragTo: (y: number) => void = () => {}
  let dropAt: (done: boolean) => void = () => {}
  const mark = (section: string, block: string, scroll = true) => {
    document.querySelectorAll('.is-sfb-on').forEach(node => node.classList.remove('is-sfb-on'))
    const target = (block && document.querySelector('.sf-b-' + CSS.escape(block))) || (section && document.querySelector('.sf-i-' + CSS.escape(section)))
    if (!target) { return false }
    target.classList.add('is-sfb-on')
    const box = target.getBoundingClientRect()
    if (scroll && (box.top < 0 || box.bottom > window.innerHeight)) { target.scrollIntoView({ block: box.height > window.innerHeight ? 'start' : 'center', behavior: 'smooth' }) }
    return true
  }

  nuxt.hook('app:mounted', () => {
    document.documentElement.classList.add('sf-builder')
    window.addEventListener('message', (event) => {
      if (event.source !== window.parent || !origin() || event.origin !== origin() || event.data?.source !== 'sf-builder') { return }
      const message = event.data
      if (message.type === 'refresh' && editing) { waiting = true; return }
      if (message.type === 'design' && editing) { return }
      if (message.type === 'refresh') { fresh.value = Date.now(); for (const wait of [500, 1200, 2500]) { setTimeout(() => { if (last.section) { mark(last.section, last.block, false) } }, wait) } }
      // the blue of the back-office, for the frames and the bar drawn here
      if (message.type === 'follow' && typeof message.accent === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([0-9., %]+\))$/i.test(message.accent.trim())) { document.documentElement.style.setProperty('--sfb-accent', message.accent.trim()) }
      if (message.type === 'follow') { follow = !!message.on; document.documentElement.classList.toggle('sf-builder-follow', follow) }
      if (message.type === 'design') { draw(String(message.part || 'page'), message.sections); if (last.section) { setTimeout(() => { mark(last.section, last.block, missing); missing = false; place(); setTimeout(place, 400) }, 60) } }   // a section just added: selected before it was drawn, it is brought into view now
      if (message.type === 'drag') { dragTo(Number(message.y) || 0) }
      if (message.type === 'drop') { dropAt(message.cancel !== true) }
      if (message.type === 'theme') { paint(message.variables, message.settings, message.schemes) }
      if (message.type === 'select') { last = { section: String(message.section || ''), block: String(message.block || '') }; missing = !mark(last.section, last.block) && !!last.section; arrows(!!last.section) }
    })
    // a click: which section, which block, of which design
    document.addEventListener('click', (event) => {
      const at = event.target as Element | null
      const link = at?.closest?.('a[href]') as HTMLAnchorElement | null
      if (follow || event.metaKey || event.ctrlKey) {
        // links work, and the next page is still the preview inside the builder
        if (link && link.origin === window.location.origin && !link.target) {
          event.preventDefault()
          const next = new URL(link.href)
          next.searchParams.set('preview', String(route.query.preview || ''))
          next.searchParams.set('builder', '1')
          window.location.assign(next.toString())
        }
        // what is not a link nor a control of the site (a photo, a banner, an empty place) still selects its section: with « Suivre les liens » on, a click in the page is never lost
        if (link || at?.closest?.('button, input, select, textarea, label, summary, video, [role="button"], [tabindex]')) { return }
      }
      if (editing && editing.node.contains(at)) { if (link) { event.preventDefault() } return }   // the cursor is placed in the text being written
      // the menu of the header works in the preview: its button opens the panel (drawer, full screen, tiles) and the panel's own buttons work; a link of the menu is not followed
      if (at?.closest?.('.sf-burger, .sf-drawer')) { if (link) { event.preventDefault(); event.stopPropagation() } return }
      const band = at?.closest?.('[data-section]') as Element | null
      if (!band) { return }
      event.preventDefault()
      event.stopPropagation()
      const blockNode = at?.closest?.('[class*="sf-b-"]') as Element | null
      const part = band.closest('header') ? 'header' : band.closest('footer') ? 'footer' : 'page'
      const section = idOf(band, 'sf-i-'), block = blockNode && band.contains(blockNode) ? idOf(blockNode, 'sf-b-') : ''
      last = { section, block }
      mark(section, block, false)
      tell({ type: 'select', part, section, block })
    }, true)
    // a double click on a title, a text or a button: written in place
    const stop = () => {
      if (!editing) { return }
      editing.node.removeAttribute('contenteditable')
      editing.node.classList.remove('is-sfb-edit')
      editing = null
      if (waiting) { waiting = false; fresh.value = Date.now() }
    }
    document.addEventListener('dblclick', (event) => {
      if (follow) { return }
      const node = (event.target as Element | null)?.closest?.('.sf-bt-heading > .sf-h, .sf-bt-text > .sf-text, .sf-bt-button > .sf-btn') as HTMLElement | null
      const band = node?.closest('[data-section]') as Element | null
      const blockNode = node?.parentElement as Element | null
      if (!node || !band || !blockNode || editing?.node === node) { return }
      event.preventDefault()
      stop()
      editing = { node, part: band.closest('header') ? 'header' : band.closest('footer') ? 'footer' : 'page', section: idOf(band, 'sf-i-'), block: idOf(blockNode, 'sf-b-'), first: true }
      node.setAttribute('contenteditable', 'plaintext-only')
      if (node.contentEditable !== 'plaintext-only') { node.setAttribute('contenteditable', 'true') }
      node.classList.add('is-sfb-edit')
      node.focus()
    }, true)
    document.addEventListener('input', (event) => {
      if (!editing || event.target !== editing.node) { return }
      const multi = editing.node.classList.contains('sf-text')
      const value = multi ? editing.node.innerText.replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim() : (editing.node.textContent || '').replace(/\s+/g, ' ').trim()
      tell({ type: 'text', part: editing.part, section: editing.section, block: editing.block, value: value.slice(0, 5000), first: editing.first })
      editing.first = false
    }, true)
    document.addEventListener('keydown', (event) => {
      if (!editing) { return }
      if (event.key === 'Escape' || (event.key === 'Enter' && !editing.node.classList.contains('sf-text'))) { event.preventDefault(); editing.node.blur() }
    }, true)
    document.addEventListener('focusout', (event) => { if (editing && event.target === editing.node) { stop() } }, true)
    // The bar of the selected section (its name, move, duplicate, hide, delete…) is drawn BY THE BUILDER, over this frame, with the icons and the colours of the back-office: the site only says
    // where the section is (`box`, at each scroll or change of size), and, while the section is dragged by its name there, shows where it would be dropped (`drag`, `drop` => `move`).
    let asked = 0
    place = () => {
      if (asked) { return }
      asked = requestAnimationFrame(() => {
        asked = 0
        const band = shown && last.section ? document.querySelector('.sf-i-' + CSS.escape(last.section)) : null
        if (!band) { tell({ type: 'box', section: last.section, show: false }); return }
        const box = band.getBoundingClientRect()
        tell({ type: 'box', section: last.section, show: box.bottom > 40 && box.top < window.innerHeight - 40, top: Math.round(box.top), left: Math.round(box.left), width: Math.round(box.width) })
      })
    }
    window.addEventListener('scroll', place, { passive: true })
    window.addEventListener('resize', place)
    arrows = (can) => { shown = !!can; place(); setTimeout(place, 250); setTimeout(place, 700) }   // again once a smooth scroll has ended
    // dragging: a line shows where the section would go among the sections around it
    let line: HTMLElement | null = null
    let target = { before: '', after: '' }
    const around = (): HTMLElement[] => { const band = document.querySelector('.sf-i-' + CSS.escape(last.section)); return band?.parentElement ? Array.from(band.parentElement.children).filter(node => node.matches('[data-section]')) as HTMLElement[] : [] }
    dragTo = (y: number) => {
      const list = around()
      if (list.length < 2) { return }
      if (!line) { line = document.createElement('div'); line.className = 'sfb-drop'; document.body.appendChild(line); document.documentElement.classList.add('sf-builder-drag') }
      if (y < 70) { window.scrollBy(0, -18) } else if (y > window.innerHeight - 70) { window.scrollBy(0, 18) }
      let at = 0
      for (const band of list) { const box = band.getBoundingClientRect(); if (box.top + box.height / 2 < y) { at++ } }
      const next = list[at], previous = list[at - 1]
      target = { before: next ? idOf(next, 'sf-i-') : '', after: !next && previous ? idOf(previous, 'sf-i-') : '' }
      const edge = next ? next.getBoundingClientRect().top : previous!.getBoundingClientRect().bottom, wide = (next || previous)!.getBoundingClientRect()
      line.style.top = Math.max(0, Math.min(window.innerHeight - 3, edge - 1)) + 'px'
      line.style.left = wide.left + 'px'; line.style.width = wide.width + 'px'
    }
    dropAt = (done: boolean) => {
      if (!line) { return }
      line.remove(); line = null
      document.documentElement.classList.remove('sf-builder-drag')
      if (done && target.before !== last.section && target.after !== last.section && (target.before || target.after)) { tell({ type: 'move', section: last.section, before: target.before, after: target.after }) }
      target = { before: '', after: '' }
    }
    // A block or a column moved on the site itself: over a block (or a column of a section of columns) a handle shows; dragged from it, a line shows where it would land, and the builder is told
    // (`moveBlock`: the block, the block it goes before or none, its column; `moveColumn`: from one place to another). The builder makes the change and sends the page back (`design`).
    const handle = document.createElement('div')
    handle.className = 'sfb-handle'
    handle.hidden = true
    document.body.appendChild(handle)
    let hovered: { kind: 'block' | 'column', node: HTMLElement, band: HTMLElement } | null = null
    let moving: { kind: 'block' | 'column', node: HTMLElement, band: HTMLElement, part: string, section: string, block: string, col: number } | null = null
    let drop: Record<string, unknown> | null = null
    let swallow = false
    const colOf = (node: Element | null): number => { const col = node?.closest('.sf-col'); return col ? Number(idOf(col, 'sf-col-')) || 0 : 0 }
    const partOf = (band: Element) => (band.closest('header') ? 'header' : band.closest('footer') ? 'footer' : 'page')
    const blocksIn = (box: Element, except: Element | null) => (Array.from(box.querySelectorAll('[class*="sf-b-"]')) as HTMLElement[]).filter(node => node !== except && !!idOf(node, 'sf-b-') && !node.parentElement?.closest('[class*="sf-b-"]') && (!except || !except.contains(node)))
    const showHandle = (target: typeof hovered) => {
      hovered = target
      if (!target || follow || editing || moving) { handle.hidden = true; return }
      const box = target.node.getBoundingClientRect()
      handle.textContent = target.kind === 'column' ? '⠿ Colonne ' + colOf(target.node) : '⠿'
      handle.title = target.kind === 'column' ? 'Glisser pour changer la colonne de place' : 'Glisser pour déplacer le bloc'
      handle.hidden = false
      handle.style.top = Math.max(0, box.top + (target.kind === 'column' ? 6 : -10)) + 'px'
      handle.style.left = (target.kind === 'column' ? box.left + box.width / 2 - handle.offsetWidth / 2 : Math.max(0, box.left - 12)) + 'px'
    }
    document.addEventListener('mousemove', (event) => {
      if (moving || event.target === handle) { return }
      const at = event.target as Element | null
      const band = at?.closest?.('[data-section]') as HTMLElement | null
      if (!band) { showHandle(null); return }
      const block = at?.closest?.('[class*="sf-b-"]') as HTMLElement | null
      if (block && band.contains(block) && idOf(block, 'sf-b-')) { showHandle({ kind: 'block', node: block, band }); return }
      const column = at?.closest?.('.sf-col') as HTMLElement | null
      showHandle(column && band.contains(column) && band.querySelectorAll('.sf-col').length > 1 ? { kind: 'column', node: column, band } : null)
    }, { passive: true })
    window.addEventListener('scroll', () => { if (!moving) { handle.hidden = true } }, { passive: true })
    const lineAt = (top: number, left: number, width: number, height: number) => {
      if (!line) { line = document.createElement('div'); line.className = 'sfb-drop'; document.body.appendChild(line); document.documentElement.classList.add('sf-builder-drag') }
      line.style.top = top + 'px'; line.style.left = left + 'px'; line.style.width = width + 'px'; line.style.height = height + 'px'
    }
    handle.addEventListener('pointerdown', (event) => {
      if (!hovered || follow) { return }
      event.preventDefault()
      const { kind, node, band } = hovered
      moving = { kind, node, band, part: partOf(band), section: idOf(band, 'sf-i-'), block: kind === 'block' ? idOf(node, 'sf-b-') : '', col: colOf(node) }
      handle.setPointerCapture(event.pointerId)
      node.style.opacity = '.45'
    })
    handle.addEventListener('pointermove', (event) => {
      if (!moving) { return }
      const x = event.clientX, y = event.clientY
      if (y < 60) { window.scrollBy(0, -16) } else if (y > window.innerHeight - 60) { window.scrollBy(0, 16) }
      drop = null
      if (moving.kind === 'column') {
        const columns = Array.from(moving.band.querySelectorAll('.sf-col')) as HTMLElement[]
        const stacked = columns.length > 1 && Math.abs(columns[0]!.getBoundingClientRect().left - columns[1]!.getBoundingClientRect().left) < 4
        let spot = columns.length + 1
        for (const column of columns) { const box = column.getBoundingClientRect(); if (stacked ? y < box.top + box.height / 2 : x < box.left + box.width / 2) { spot = colOf(column); break } }
        const from = moving.col, to = from < spot ? spot - 1 : spot
        const edge = columns.find(column => colOf(column) === spot) || columns[columns.length - 1]!
        const box = edge.getBoundingClientRect(), atEnd = spot > columns.length
        if (stacked) { lineAt(atEnd ? box.bottom - 1 : box.top - 1, box.left, box.width, 3) } else { lineAt(box.top, atEnd ? box.right - 1 : box.left - 2, 3, box.height) }
        if (to !== from) { drop = { type: 'moveColumn', part: moving.part, section: moving.section, from, to } }
        return
      }
      // a block: the column under the pointer (a section of columns) or the whole section, then the block it goes before
      const under = document.elementFromPoint(x, y)
      const column = moving.band.querySelectorAll('.sf-col').length ? (under?.closest('.sf-col') as HTMLElement | null) : null
      if (moving.band.querySelectorAll('.sf-col').length && (!column || !moving.band.contains(column))) { line?.remove(); line = null; return }
      const list = blocksIn(column || moving.band, moving.node)
      let before: HTMLElement | null = null
      for (const node of list) { const box = node.getBoundingClientRect(); if (y < box.top + box.height / 2 && !(y > box.top && x > box.right)) { before = node; break } }
      const last = list[list.length - 1]
      const box = (before || last || column || moving.band).getBoundingClientRect()
      lineAt(before ? box.top - 2 : (last ? box.bottom + 1 : box.top + 8), box.left, box.width, 3)
      drop = { type: 'moveBlock', part: moving.part, section: moving.section, block: moving.block, before: before ? idOf(before, 'sf-b-') : '', col: column ? colOf(column) : 0 }
    })
    const endDrag = (done: boolean) => {
      if (!moving) { return }
      moving.node.style.opacity = ''
      line?.remove(); line = null
      document.documentElement.classList.remove('sf-builder-drag')
      if (done && drop && !(drop.type === 'moveBlock' && drop.before === moving.block)) { tell(drop); swallow = true; setTimeout(() => { swallow = false }, 300) }
      moving = null; drop = null; handle.hidden = true
    }
    handle.addEventListener('pointerup', () => endDrag(true))
    handle.addEventListener('pointercancel', () => endDrag(false))
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && moving) { endDrag(false) } })
    document.addEventListener('click', (event) => { if (swallow) { event.preventDefault(); event.stopPropagation() } }, true)
    tell({ type: 'ready', path: window.location.pathname })
  })
  // each time the page is drawn again (a refresh after a save), the builder is told: it puts its outline back on the selected section
  nuxt.hook('page:finish', () => { tell({ type: 'drawn', path: window.location.pathname }) })
})
