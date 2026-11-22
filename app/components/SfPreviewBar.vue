<script setup lang="ts">
// The bar of a preview (only whoever holds a preview link sees it): the theme shown, the language, Digipart, and how fast the page is (panel « Performance », out of the bar).
const props = defineProps<{ site: any, here: string, langHref: (language: any) => string }>()
const adminLinks = useState<{ Label: string, Path: string }[]>('sf-admin-links', () => [])   // set by the page shown (SfView.vue)
const hidden = ref(false)
const open = ref<'' | 'lang' | 'admin' | 'perf'>('')
const box = ref<HTMLElement | null>(null)
const bar = ref<HTMLElement | null>(null)
const awake = ref(false)   // drawn in the browser: the page tells its links once it is drawn, after this bar on the server
const { state: perf, watch, measure } = usePagePerf()
const languages = computed<any[]>(() => props.site.Languages || [])
const current = computed(() => languages.value.find(l => l.LanguageIsoCode === props.site.Route?.LanguageIsoCode) || languages.value[0] || {})
const levels = computed(() => ({ lcp: perfLevel('lcp', perf.value.lcp?.ms), cls: perfLevel('cls', perf.value.cls), inp: perfLevel('inp', perf.value.inp), ttfb: perfLevel('ttfb', perf.value.ttfb) }))
const overall = computed(() => { const list = [levels.value.lcp, levels.value.cls, levels.value.inp].filter(Boolean); return list.includes('bad') ? 'bad' : list.includes('mid') ? 'mid' : list.length ? 'good' : '' })
const LEVEL_TEXT: Record<string, string> = { good: 'Bon', mid: 'À améliorer', bad: 'Lent', '': 'À mesurer' }
const heaviest = computed(() => Math.max(1, ...perf.value.groups.map(g => g.bytes)))
const pageSpeed = computed(() => (import.meta.client ? 'https://pagespeed.web.dev/analysis?url=' + encodeURIComponent(location.origin + props.here) : ''))

const time = perfTime, weight = perfBytes
const reload = () => { location.reload() }
function toggle(name: 'lang' | 'admin' | 'perf') {
  open.value = open.value === name ? '' : name
  if (open.value === 'perf') { measure() }
}
function hide() { open.value = ''; hidden.value = true }
const onClick = (event: MouseEvent) => { if (open.value && open.value !== 'perf' && !box.value?.contains(event.target as Node)) { open.value = '' } }
const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { open.value = '' } }
// the page keeps room for the bar at its bottom (the buy bar of a phone stands above it)
let sizer: ResizeObserver | null = null
const room = () => {
  const root = document.documentElement
  root.classList.toggle('sf-has-pbar', !hidden.value)
  root.style.setProperty('--sf-pbar-h', (hidden.value ? 0 : (bar.value?.offsetHeight || 0)) + 'px')
}
onMounted(() => {
  awake.value = true
  watch()
  document.addEventListener('click', onClick)
  document.addEventListener('keydown', onKey)
  if (typeof ResizeObserver !== 'undefined' && bar.value) { sizer = new ResizeObserver(room); sizer.observe(bar.value) }
  room()
  if (document.readyState === 'complete') { measure() } else { window.addEventListener('load', () => setTimeout(measure, 50), { once: true }) }
})
watchEffect(() => { if (import.meta.client) { void hidden.value; nextTick(room) } })
onBeforeUnmount(() => { document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); sizer?.disconnect() })
</script>

<template>
  <button v-if="hidden" type="button" class="sf-pbar-show" aria-label="Afficher la barre d'aperçu" @click="hidden = false"><span class="sf-pbar-dot" :class="'is-' + (overall || 'none')" />Aperçu</button>
  <aside v-else ref="box" class="sf-pbar" :class="{ 'is-perf': open === 'perf' }" aria-label="Aperçu du thème">
    <!-- the panel « Performance »: slides out of the bar, upwards -->
    <section class="sf-pperf" :aria-hidden="open !== 'perf'" aria-label="Performance de cette page">
      <header class="sf-pperf-head">
        <div><strong>Performance de cette page</strong><small>Mesurée par ce navigateur, sur cet ordinateur et cette connexion.</small></div>
        <div class="sf-pperf-tools">
          <button type="button" @click="measure()">Mettre à jour</button>
          <button type="button" @click="reload">Recharger et mesurer</button>
          <button type="button" class="sf-pperf-close" aria-label="Fermer le panneau" @click="open = ''">✕</button>
        </div>
      </header>
      <div class="sf-pperf-cards">
        <div class="sf-pperf-card" :class="'is-' + (levels.lcp || 'none')"><span>Affichage</span><b>{{ perf.lcp ? time(perf.lcp.ms) : '—' }}</b><em>{{ LEVEL_TEXT[levels.lcp] }}</em><small>Le plus grand élément du premier écran{{ perf.lcp?.what ? ' : ' + perf.lcp.what : '' }}. Bon sous 2,5 s.</small></div>
        <div class="sf-pperf-card" :class="'is-' + (levels.cls || 'none')"><span>Stabilité</span><b>{{ perf.ready ? perf.cls.toFixed(2).replace('.', ',') : '—' }}</b><em>{{ LEVEL_TEXT[levels.cls] }}</em><small>Ce qui bouge pendant le chargement. Bon sous 0,1.</small></div>
        <div class="sf-pperf-card" :class="'is-' + (levels.inp || 'none')"><span>Réactivité</span><b>{{ perf.inp !== null ? time(perf.inp) : '—' }}</b><em>{{ perf.inp !== null ? LEVEL_TEXT[levels.inp] : 'Cliquez dans la page' }}</em><small>Le délai le plus long après un clic. Bon sous 200 ms.</small></div>
        <div class="sf-pperf-card" :class="'is-' + (levels.ttfb || 'none')"><span>Réponse du serveur</span><b>{{ perf.ready ? time(perf.ttfb) : '—' }}</b><em>{{ LEVEL_TEXT[levels.ttfb] }}</em><small>Jusqu'au premier octet de la page. Bon sous 0,8 s.</small></div>
      </div>
      <div class="sf-pperf-cols">
        <div class="sf-pperf-block">
          <h3>Serveur</h3>
          <template v-if="perf.server">
            <p class="sf-pperf-big">{{ time(perf.server.total) }} <small>pour fabriquer la page</small></p>
            <ul class="sf-pperf-list">
              <li><span>Appels à Digipart</span><b>{{ perf.server.digipart.n }}</b><small>{{ perf.server.digipart.kept }} en mémoire · {{ time(perf.server.digipart.ms) }}</small></li>
              <li><span>Appels catalogue</span><b>{{ perf.server.shop.n }}</b><small>{{ perf.server.shop.kept }} en mémoire · {{ time(perf.server.shop.ms) }}</small></li>
            </ul>
            <template v-if="perf.server.slow.length"><h4>Les plus lents</h4><ol class="sf-pperf-slow"><li v-for="item in perf.server.slow" :key="item.path"><code>{{ item.path }}</code><b>{{ time(item.ms) }}</b></li></ol></template>
            <p class="sf-pperf-note">En aperçu, la page est toujours fabriquée. Un visiteur la reçoit en général déjà prête, en quelques millisecondes.</p>
          </template>
          <p v-else class="sf-pperf-note">Le serveur n'a pas donné son détail pour cette page. Rechargez-la pour le voir.</p>
        </div>
        <div class="sf-pperf-block">
          <h3>Poids de la page</h3>
          <p class="sf-pperf-big">{{ perf.ready ? weight(perf.total) : '—' }} <small>{{ perf.requests }} fichiers</small></p>
          <ul class="sf-pperf-bars">
            <li v-for="group in perf.groups" :key="group.label"><span>{{ group.label }}<small>{{ group.count }}</small></span><i><s :style="{ width: Math.max(2, Math.round(100 * group.bytes / heaviest)) + '%' }" /></i><b>{{ group.bytes ? weight(group.bytes) : (group.unknown ? 'inconnu' : '—') }}</b></li>
          </ul>
          <p v-if="perf.unknown" class="sf-pperf-note">{{ perf.unknown }} fichier{{ perf.unknown > 1 ? 's' : '' }} d'autres sites ne disent pas leur poids (vidéo, outils de mesure…).</p>
        </div>
      </div>
      <div class="sf-pperf-block">
        <h3>Conseils</h3>
        <ul v-if="perf.advice.length" class="sf-pperf-advice"><li v-for="line in perf.advice" :key="line">{{ line }}</li></ul>
        <p v-else class="sf-pperf-note">Rien à signaler sur cette page.</p>
        <p class="sf-pperf-note">Un téléphone en 4G est plus lent que cet ordinateur. Mesure de référence : <a :href="pageSpeed" target="_blank" rel="noopener">PageSpeed Insights de Google</a> (une fois la page publiée).</p>
      </div>
    </section>

    <div ref="bar" class="sf-pbar-main">
      <div class="sf-pbar-name"><strong>{{ site.Theme.Name }}</strong><span class="sf-pbar-badge" :class="{ 'is-live': site.Theme.Live }">{{ site.Theme.Live ? 'En ligne · modifications non publiées' : 'Brouillon' }}</span><small>Aperçu : les visiteurs ne voient pas cette version</small></div>
      <div class="sf-pbar-actions">
        <div v-if="languages.length > 1" class="sf-pbar-menu">
          <button type="button" :aria-expanded="open === 'lang'" aria-haspopup="true" @click="toggle('lang')"><span class="sf-pbar-iso">{{ String(current.LanguageIsoCode || '').toUpperCase() }}</span>{{ current.Name }}<span class="sf-pbar-caret" aria-hidden="true" /></button>
          <div v-show="open === 'lang'" class="sf-pbar-pop" role="menu" aria-label="Langue de l'aperçu">
            <a v-for="language in languages" :key="language.LanguageIsoCode" role="menuitem" :href="langHref(language)" :aria-current="language.LanguageIsoCode === site.Route.LanguageIsoCode ? 'true' : undefined"><span class="sf-pbar-iso">{{ String(language.LanguageIsoCode).toUpperCase() }}</span>{{ language.Name }}</a>
          </div>
        </div>
        <button type="button" class="sf-pbar-perf" :aria-expanded="open === 'perf'" @click="toggle('perf')"><span class="sf-pbar-dot" :class="'is-' + (overall || 'none')" />Performance<span v-if="perf.lcp" class="sf-pbar-val">{{ time(perf.lcp.ms) }}</span><span class="sf-pbar-caret is-up" aria-hidden="true" /></button>
        <div v-if="awake && site.PreviewAdminUrl && adminLinks.length" class="sf-pbar-menu">
          <button type="button" :aria-expanded="open === 'admin'" aria-haspopup="true" @click="toggle('admin')">Ouvrir dans Digipart<span class="sf-pbar-caret" aria-hidden="true" /></button>
          <div v-show="open === 'admin'" class="sf-pbar-pop" role="menu" aria-label="Ouvrir dans Digipart">
            <a v-for="link in adminLinks" :key="link.Path" role="menuitem" :href="site.PreviewAdminUrl + '?module=' + link.Path" target="_blank" rel="noopener">{{ link.Label }}</a>
          </div>
        </div>
        <a :href="here + '?preview=off'">Quitter l'aperçu</a>
        <a v-if="site.PreviewEditUrl" :href="site.PreviewEditUrl" class="is-main">Modifier le thème</a>
        <button type="button" class="sf-pbar-hide" aria-label="Masquer la barre" title="Masquer la barre" @click="hide">⌄</button>
      </div>
    </div>
  </aside>
</template>
