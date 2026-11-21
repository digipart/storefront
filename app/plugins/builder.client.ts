// The site inside the site builder of Digipart. The builder shows the real site in a frame (a preview link with `builder=1`) instead of a mock-up: here the site listens to it and answers.
//
// - only in a preview (`site.Preview`: a signed link of the back-office) opened with `builder` in its address, and only for messages that come from the back-office of this site
//   (`PreviewAdminUrl`, the address Digipart is at): anything else is ignored;
// - `refresh`: a draft was saved, the site and the page are read anew (no reload: the scroll stays where it is);
// - a click on a section or a block tells the builder which one (`select`: the design it belongs to, header, footer or page, and its ids) instead of following the link; with `follow` on
//   (the switch « Suivre les liens » of the builder) links work, and keep the preview and the builder in their address;
// - `select` from the builder: the section (or the block) is brought into view and outlined;
// - `design` / `theme`: what is being written in the builder, not saved yet, is drawn at once (the sections of the page, of the header or of the footer; the colours and sizes of the theme). The
//   HTML and the CSS a shop writes are NOT taken from these messages: they stay what Digipart last cleaned and gave (they follow at the next `refresh`, after the save);
// - a double click on a title, a text or a button writes it in place: each change is told to the builder (`text`), which keeps it; while a text is being written the page is not drawn anew
//   under the cursor (a `refresh` waits for the end);
// - the section selected in the builder carries the bar the plan of the builder draws (a tab at its top left: its name, up and down (`move`), duplicate, copy, save as a model, hide, delete
//   (`act`; not for the main section of a page)): the builder does it (it asks before a deletion) and sends the new sections back. No frame is drawn around a section; a selected block has a thin one.
export default defineNuxtPlugin((nuxt) => {
  const route = useRoute()
  if (route.query.builder === undefined || window.parent === window) { return }
  const fresh = useState<number>('sf-fresh', () => 0)
  const site = useNuxtData<any>('sf-site').data
  let follow = false
  let editing: { node: HTMLElement, part: string, section: string, block: string, first: boolean } | null = null   // the text being written in place
  let waiting = false                                                                                              // a refresh asked meanwhile
  let tools: HTMLElement | null = null
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
    const page = useNuxtData<any>('sf-view-' + route.fullPath).data
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
  let arrows: (can: { up: boolean, down: boolean, own: boolean, name: string } | null) => void = () => {}
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
      if (message.type === 'theme') { paint(message.variables, message.settings, message.schemes) }
      if (message.type === 'select') { last = { section: String(message.section || ''), block: String(message.block || '') }; missing = !mark(last.section, last.block) && !!last.section; arrows(last.section ? { up: !!message.up, down: !!message.down, own: !!message.own, name: typeof message.name === 'string' ? message.name : '' } : null) }
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
        return
      }
      if (editing && editing.node.contains(at)) { if (link) { event.preventDefault() } return }   // the cursor is placed in the text being written
      if (tools && at && tools.contains(at)) { return }
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
    // the bar of the selected section, as the plan of the builder draws it: a tab above its top left corner (inside it when there is no room above), with its name and what can be done to it
    place = () => {
      const band = last.section ? document.querySelector('.sf-i-' + CSS.escape(last.section)) : null
      if (!tools || !band) { if (tools) { tools.hidden = true } return }
      const box = band.getBoundingClientRect(), tall = tools.offsetHeight || 30
      tools.hidden = box.bottom < 40 || box.top > window.innerHeight - 40
      const above = box.top - tall >= 0
      tools.classList.toggle('is-inside', !above)
      tools.style.top = (above ? box.top - tall : Math.max(0, Math.min(window.innerHeight - tall, box.top))) + 'px'
      tools.style.left = Math.max(0, box.left) + 'px'
    }
    window.addEventListener('scroll', place, { passive: true })
    window.addEventListener('resize', place)
    const svg = (path: string) => '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>'
    const ACTS: [string, string, string][] = [   // fixed drawings of this file, nothing of the shop
      ['up', svg('<path d="M12 19V5M6 11l6-6 6 6"/>'), 'Monter'],
      ['down', svg('<path d="M12 5v14M6 13l6 6 6-6"/>'), 'Descendre'],
      ['duplicate', svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'), 'Dupliquer'],
      ['copy', svg('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h4"/>'), 'Copier (pour coller dans une autre page)'],
      ['savemodel', svg('<path d="M6 3h12v18l-6-4-6 4z"/>'), 'Enregistrer comme modèle (Mes sections)'],
      ['hide', svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'), 'Masquer'],
      ['remove', svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'), 'Supprimer'],
    ]
    arrows = (can) => {
      if (!can) { if (tools) { tools.remove(); tools = null } return }
      if (!tools) {
        tools = document.createElement('div')
        tools.className = 'sfb-tools'
        const name = document.createElement('span')
        name.className = 'sfb-tools-name'
        name.title = 'Glisser pour déplacer la section'
        tools.appendChild(name)
        // dragging the section by its name: a line shows where it would go among the sections around it; dropped, the builder is told before (or after) which one (`move`)
        let drag: { line: HTMLElement, before: string, after: string, moved: boolean } | null = null
        const around = (): HTMLElement[] => { const band = document.querySelector('.sf-i-' + CSS.escape(last.section)); return band?.parentElement ? Array.from(band.parentElement.children).filter(node => node.matches('[data-section]')) as HTMLElement[] : [] }
        name.addEventListener('pointerdown', (event) => {
          if (event.button !== 0 || around().length < 2) { return }
          event.preventDefault()
          const line = document.createElement('div')
          line.className = 'sfb-drop'; line.hidden = true
          document.body.appendChild(line)
          drag = { line, before: '', after: '', moved: false }
          name.setPointerCapture(event.pointerId)
          document.documentElement.classList.add('sf-builder-drag')
        })
        name.addEventListener('pointermove', (event) => {
          if (!drag) { return }
          const list = around(), y = event.clientY
          if (y < 70) { window.scrollBy(0, -18) } else if (y > window.innerHeight - 70) { window.scrollBy(0, 18) }
          let at = 0
          for (const band of list) { const box = band.getBoundingClientRect(); if (box.top + box.height / 2 < y) { at++ } }
          const next = list[at], previous = list[at - 1]
          drag.before = next ? idOf(next, 'sf-i-') : ''
          drag.after = !next && previous ? idOf(previous, 'sf-i-') : ''
          drag.moved = true
          const edge = next ? next.getBoundingClientRect().top : (previous ? previous.getBoundingClientRect().bottom : 0), wide = (next || previous)!.getBoundingClientRect()
          drag.line.hidden = false
          drag.line.style.top = Math.max(0, Math.min(window.innerHeight - 3, edge - 1)) + 'px'
          drag.line.style.left = wide.left + 'px'; drag.line.style.width = wide.width + 'px'
        })
        const drop = (event: PointerEvent, done: boolean) => {
          if (!drag) { return }
          const { before, after, moved, line } = drag
          line.remove(); drag = null
          try { name.releasePointerCapture(event.pointerId) } catch { /* already released */ }
          document.documentElement.classList.remove('sf-builder-drag')
          if (done && moved && before !== last.section && after !== last.section) { tell({ type: 'move', section: last.section, before, after }) }
        }
        name.addEventListener('pointerup', event => drop(event, true))
        name.addEventListener('pointercancel', event => drop(event, false))
        for (const [act, drawing, label] of ACTS) {
          const button = document.createElement('button')
          button.type = 'button'; button.innerHTML = drawing
          button.title = label; button.setAttribute('aria-label', label); button.dataset.dir = act
          button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); tell(act === 'up' || act === 'down' ? { type: 'move', section: last.section, dir: act } : { type: 'act', section: last.section, act }) })
          tools.appendChild(button)
        }
        document.body.appendChild(tools)
      }
      (tools.querySelector('.sfb-tools-name') as HTMLElement).textContent = String(can.name || '').slice(0, 60)
      for (const button of Array.from(tools.querySelectorAll('button')) as HTMLButtonElement[]) {
        const act = String(button.dataset.dir)
        button.hidden = act === 'up' ? !can.up : act === 'down' ? !can.down : !can.own   // as in the plan: what cannot be done is not shown
      }
      place()
      setTimeout(place, 200)
    }
    tell({ type: 'ready', path: window.location.pathname })
  })
  // each time the page is drawn again (a refresh after a save), the builder is told: it puts its outline back on the selected section
  nuxt.hook('page:finish', () => { tell({ type: 'drawn', path: window.location.pathname }) })
})
