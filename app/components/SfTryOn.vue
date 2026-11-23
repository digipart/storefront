<script setup lang="ts">
// The virtual try-on window (opened by SfTryOnButton): the visitor gives a photo of themselves (a file, the webcam, or the camera of the phone), sees the garment worn in their own photo, picks a size
// and adds it to the cart without leaving. The photo is made smaller and turned into a JPEG here (which also drops what the camera wrote in it: place, device), then sent once to Digipart through the
// server of the site (server/api/storefront/try-on.post.ts). « Mémoriser ma photo » keeps it in this tab only (sessionStorage), never on a server.
const props = defineProps<{ product: any, framing: string, siteKey: string }>()
const emit = defineEmits<{ close: [] }>()
const w = useWords()
const { add, busy: adding } = useCart()

const MEMORY = 'sf-tryon-photo'
const LONG_SIDE = 1600
type Step = 'intro' | 'camera' | 'work' | 'result' | 'error'
const step = ref<Step>('intro')
const photo = ref('')            // the visitor's photo, as a data: address (shown, and sent)
const result = ref('')           // the picture made
const showing = ref<'with' | 'mine'>('with')
const reason = ref('')
const remember = ref(false)
const kept = ref('')             // a photo remembered earlier in this visit
const progress = ref(0)
const variant = ref(0)
const added = ref(false)
const panel = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const phoneInput = ref<HTMLInputElement | null>(null)
const video = ref<HTMLVideoElement | null>(null)
const guard = ref<HTMLElement | null>(null)
let stream: MediaStream | null = null
let timer: ReturnType<typeof setInterval> | null = null
let started = 0

const touch = ref(false)
const alert = ref('')            // a message on the first screen (the camera refused)
onMounted(() => {
  document.documentElement.style.overflow = 'hidden'
  touch.value = window.matchMedia('(pointer: coarse)').matches
  try { kept.value = sessionStorage.getItem(MEMORY) || '' } catch { kept.value = '' }
  remember.value = kept.value !== ''
  nextTick(() => panel.value?.focus())
})
onBeforeUnmount(() => { document.documentElement.style.overflow = ''; stopCamera(); stopClock() })

// the sizes that can be bought (the colour is the product of the page)
const sizes = computed(() => (props.product?.Variants || []).filter((v: any) => v.Available))
const oneColor = computed(() => new Set((props.product?.Variants || []).map((v: any) => v.Color || '')).size <= 1)
const sizeName = (v: any) => (oneColor.value && v.Size ? v.Size : v.Label)
watch(sizes, list => { if (list.length === 1) { variant.value = list[0].Id } }, { immediate: true })

const tips = computed(() => [
  { icon: 'camera', title: w('Prenez ou téléchargez votre photo'), text: ({ upper: w('Une seule personne, visible au moins jusqu\'à la taille.'), lower: w('Une seule personne, en pied : on doit voir vos jambes.'), full: w('Une seule personne, debout et en pied.') } as Record<string, string>)[props.framing] || w('Une seule personne, bien visible.') },
  { icon: 'sun', title: w('Choisissez une photo bien éclairée'), text: w('La lumière naturelle donne le résultat le plus juste.') },
  { icon: 'star', title: w('Découvrez le résultat'), text: w('En quelques instants, le vêtement est porté dans votre photo.') },
])
const stages = computed(() => [w('Analyse de la photo'), w('Silhouette'), w('Essayage'), w('Rendu final')])
const stageAt = computed(() => (progress.value < 15 ? 0 : progress.value < 35 ? 1 : progress.value < 88 ? 2 : 3))
const message = computed(() => ({
  photo: w('Cette photo ne peut pas être utilisée : envoyez une photo JPEG, PNG ou WebP d\'au moins 256 pixels.'),
  safety: w('Cette photo n\'a pas pu être utilisée. Essayez une photo d\'une seule personne, debout, habillée et bien éclairée.'),
  no_image: w('L\'essayage n\'a pas abouti avec cette photo. Essayez une photo plus nette et mieux éclairée.'),
  limit_visitor: w('Vous avez fait tous les essais du jour : revenez demain.'),
  limit_ip: w('Vous avez fait tous les essais du jour : revenez demain.'),
  product: w('L\'essayage n\'est pas proposé pour ce produit.'),
} as Record<string, string>)[reason.value] || (['limit_shop', 'unavailable', 'disabled'].includes(reason.value) ? w('L\'essayage virtuel n\'est pas disponible pour le moment.') : w('L\'essayage n\'a pas pu se terminer. Réessayez dans un instant.')))
const canRetry = computed(() => !['limit_visitor', 'limit_ip', 'limit_shop', 'unavailable', 'disabled', 'product'].includes(reason.value))

// ---- the photo: made smaller, a JPEG, upright (the browser applies the orientation the camera wrote) -----------------------------------------------
function shrink(source: CanvasImageSource, width: number, height: number): string {
  const scale = Math.min(1, LONG_SIDE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.9)
}
async function fromFile(file: File | undefined) {
  if (!file) { return }
  if (!/^image\//.test(file.type)) { fail('photo'); return }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    if (Math.min(img.naturalWidth, img.naturalHeight) < 256) { fail('photo'); return }
    use(shrink(img, img.naturalWidth, img.naturalHeight))
  } catch { fail('photo') } finally { URL.revokeObjectURL(url) }
}
function picked(event: Event) { const input = event.target as HTMLInputElement; fromFile(input.files?.[0]); input.value = '' }

// ---- the webcam (a computer); a phone opens its own camera through the file field -------------------------------------------------------------------
async function camera() {
  if (touch.value || !navigator.mediaDevices?.getUserMedia) { phoneInput.value?.click(); return }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
    step.value = 'camera'
    await nextTick()
    if (video.value) { video.value.srcObject = stream; await video.value.play().catch(() => {}) }
  } catch { step.value = 'intro'; alert.value = w('La caméra n\'est pas accessible : autorisez-la dans votre navigateur, ou téléchargez une photo.') }
}
function snap() {
  const v = video.value
  if (!v || !v.videoWidth) { return }
  const shot = shrink(v, v.videoWidth, v.videoHeight)
  stopCamera()
  use(shot)
}
function stopCamera() { stream?.getTracks().forEach(t => t.stop()); stream = null }
function cancelCamera() { stopCamera(); step.value = 'intro' }

// ---- Cloudflare Turnstile, when the shop protects the try-on (the token is asked right before the photo is sent) ---------------------------------------
let widget: string | null = null
function turnstile(): Promise<string> {
  if (!props.siteKey) { return Promise.resolve('') }
  const win = window as any
  const ready = win.turnstile ? Promise.resolve() : new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('turnstile'))
    document.head.appendChild(s)
  })
  return ready.then(() => new Promise<string>((resolve) => {
    const done = (token: string) => resolve(token || '')
    if (widget !== null) { win.turnstile.reset(widget); win.turnstile.execute(widget); return }
    widget = win.turnstile.render(guard.value, { sitekey: props.siteKey, appearance: 'interaction-only', callback: done, 'error-callback': () => done(''), 'expired-callback': () => done('') })
  })).catch(() => '')
}

// ---- the try-on ------------------------------------------------------------------------------------------------------------------------------------
function use(data: string) {
  photo.value = data
  try { if (remember.value) { sessionStorage.setItem(MEMORY, data) } else { sessionStorage.removeItem(MEMORY) } } catch { /* a private window: nothing kept */ }
  start()
}
function useKept() { use(kept.value) }
function fail(why: string) { stopClock(); reason.value = why; step.value = 'error' }
function stopClock() { if (timer) { clearInterval(timer); timer = null } }

async function start() {
  step.value = 'work'
  reason.value = ''
  alert.value = ''
  result.value = ''
  added.value = false
  showing.value = 'with'
  progress.value = 0
  started = Date.now()
  stopClock()
  timer = setInterval(() => { progress.value = Math.min(95, Math.round(100 * (1 - Math.exp(-(Date.now() - started) / 12000)))) }, 250)
  try {
    const blob = await (await fetch(photo.value)).blob()
    const form = new FormData()
    form.append('IdProduct', String(props.product.Id))
    form.append('Photo', blob, 'photo.jpg')
    form.append('TurnstileToken', await turnstile())
    form.append('Website', '')
    let answer = await $fetch<any>('/api/storefront/try-on', { method: 'POST', body: form })
    while (answer?.Status === 'running' && Date.now() - started < 300000) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      if (step.value !== 'work') { return }   // closed or started again
      answer = await $fetch<any>('/api/storefront/try-on', { query: { Id: answer.Id } })
    }
    if (answer?.Status === 'done' && answer.Image) {
      stopClock()
      progress.value = 100
      result.value = answer.Image
      step.value = 'result'
      return
    }
    fail(String(answer?.Reason || 'error'))
  } catch { fail('error') }
}
function again() { photo.value = ''; result.value = ''; step.value = 'intro'; try { kept.value = sessionStorage.getItem(MEMORY) || '' } catch { kept.value = '' } }

// ---- what the visitor does with the picture ---------------------------------------------------------------------------------------------------------
const mime = computed(() => (/^data:(image\/[a-z]+);/.exec(result.value)?.[1] || 'image/png'))
const fileName = computed(() => 'essayage-' + String(props.product?.Reference || props.product?.Id || 'produit').replace(/[^a-z0-9-]+/gi, '-').toLowerCase() + '.' + (mime.value === 'image/jpeg' ? 'jpg' : mime.value.split('/')[1]))
const canShare = ref(false)
watch(result, async (now) => {
  canShare.value = false
  if (!now || typeof navigator === 'undefined' || !navigator.canShare) { return }
  try { const file = new File([await (await fetch(now)).blob()], fileName.value, { type: mime.value }); canShare.value = navigator.canShare({ files: [file] }) } catch { canShare.value = false }
})
async function share() {
  try {
    const file = new File([await (await fetch(result.value)).blob()], fileName.value, { type: mime.value })
    await navigator.share({ files: [file], title: props.product?.Name || '' })
  } catch { /* the visitor closed the sharing sheet */ }
}
async function buy() {
  if (!variant.value || adding.value) { return }
  added.value = await add(props.product.Id, variant.value)
}
</script>

<template>
  <Teleport to="body">
    <div class="sf-tryon" @keydown.esc="emit('close')">
      <div class="sf-tryon-veil" @click="emit('close')" />
      <div ref="panel" class="sf-tryon-panel" :class="'is-' + step" role="dialog" aria-modal="true" :aria-label="w('Essayage virtuel')" tabindex="-1">
        <button type="button" class="sf-tryon-close" :aria-label="w('Fermer')" @click="emit('close')">✕</button>

        <!-- how it works, and the photo -->
        <div v-if="step === 'intro'" class="sf-tryon-intro">
          <h2>{{ w('Essayage virtuel') }}</h2>
          <ul class="sf-tryon-tips">
            <li v-for="tip in tips" :key="tip.icon"><span class="sf-tryon-tip-icon" :class="'is-' + tip.icon" aria-hidden="true" /><div><strong>{{ tip.title }}</strong><span>{{ tip.text }}</span></div></li>
          </ul>
          <div v-if="kept" class="sf-tryon-kept">
            <img :src="kept" alt="">
            <button type="button" class="sf-btn" @click="useKept">{{ w('Essayer avec ma photo') }}</button>
          </div>
          <div class="sf-tryon-actions">
            <button type="button" class="sf-btn" :class="{ 'is-outline': kept }" @click="fileInput?.click()">{{ w('Télécharger une photo') }}</button>
            <button type="button" class="sf-btn is-outline" @click="camera">{{ w('Prendre une photo') }}</button>
          </div>
          <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" class="sf-sr" tabindex="-1" @change="picked">
          <input ref="phoneInput" type="file" accept="image/*" capture="user" class="sf-sr" tabindex="-1" @change="picked">
          <p v-if="alert" class="sf-form-error" role="alert">{{ alert }}</p>
          <label class="sf-tryon-remember"><input v-model="remember" type="checkbox"><span><strong>{{ w('Mémoriser ma photo pour mes prochains essayages') }}</strong>{{ w('Elle reste uniquement sur cet appareil, pendant cette visite.') }}</span></label>
          <p class="sf-tryon-privacy">{{ w('Votre photo sert uniquement à créer l\'aperçu : elle n\'est pas conservée, et l\'aperçu est effacé de nos serveurs au bout d\'une heure.') }}</p>
        </div>

        <!-- the webcam -->
        <div v-else-if="step === 'camera'" class="sf-tryon-camera">
          <h2>{{ w('Prendre une photo') }}</h2>
          <video ref="video" playsinline muted />
          <div class="sf-tryon-actions">
            <button type="button" class="sf-btn" @click="snap">{{ w('Prendre la photo') }}</button>
            <button type="button" class="sf-btn is-outline" @click="cancelCamera">{{ w('Annuler') }}</button>
          </div>
        </div>

        <!-- the picture being made -->
        <div v-else-if="step === 'work'" class="sf-tryon-work" aria-live="polite">
          <img :src="photo" alt="" class="sf-tryon-thumb">
          <h2>{{ w('Essayage en cours') }}</h2>
          <div class="sf-tryon-bar"><span>{{ progress }} %</span><span class="sf-muted">{{ w('En général moins de 30 secondes') }}</span><i :style="{ width: progress + '%' }" /></div>
          <ol class="sf-tryon-stages">
            <li v-for="(stage, n) in stages" :key="stage" :class="{ 'is-done': n < stageAt, 'is-now': n === stageAt }">{{ stage }}</li>
          </ol>
        </div>

        <!-- the result -->
        <div v-else-if="step === 'result'" class="sf-tryon-result">
          <div class="sf-tryon-picture">
            <figure>
              <img :src="showing === 'with' ? result : photo" :alt="showing === 'with' ? w('Vous avec {a}', { a: product.Name }) : w('Votre photo')">
              <span v-if="showing === 'with'" class="sf-tryon-ai" :title="w('Image générée par IA : le rendu peut différer du vêtement réel.')">IA</span>
            </figure>
            <div class="sf-tryon-tools">
              <div class="sf-tryon-switch" role="group">
                <button type="button" :class="{ 'is-on': showing === 'with' }" :aria-pressed="showing === 'with'" @click="showing = 'with'">{{ w('Avec l\'article') }}</button>
                <button type="button" :class="{ 'is-on': showing === 'mine' }" :aria-pressed="showing === 'mine'" @click="showing = 'mine'">{{ w('Votre photo') }}</button>
              </div>
              <a :href="result" :download="fileName" class="sf-tryon-icon" :aria-label="w('Télécharger')" :title="w('Télécharger')"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg></a>
              <button v-if="canShare" type="button" class="sf-tryon-icon" :aria-label="w('Partager')" :title="w('Partager')" @click="share"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M8 8l4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" /></svg></button>
            </div>
            <p class="sf-tryon-note">{{ w('Image générée par IA : le rendu peut différer du vêtement réel.') }}</p>
          </div>
          <div class="sf-tryon-buy">
            <p class="sf-tryon-ask">{{ w('Comment le trouvez-vous ?') }}</p>
            <h2>{{ product.Name }}</h2>
            <div class="sf-card-price"><SfPrice :product="product" /></div>
            <template v-if="sizes.length">
              <p class="sf-tryon-label">{{ w('Sélectionnez la taille') }}</p>
              <div class="sf-tryon-sizes">
                <button v-for="v in sizes" :key="v.Id" type="button" :class="{ 'is-on': variant === v.Id }" :aria-pressed="variant === v.Id" @click="variant = v.Id; added = false">{{ sizeName(v) }}</button>
              </div>
              <button type="button" class="sf-btn sf-tryon-add" :disabled="!variant || adding" @click="buy">{{ added ? w('Produit ajouté') : w('Ajouter au panier') }}</button>
            </template>
            <p v-else class="sf-muted">{{ w('Ce produit n\'est plus disponible.') }}</p>
            <button type="button" class="sf-tryon-link" @click="again">{{ w('Essayer avec une autre photo') }}</button>
          </div>
        </div>

        <!-- a try-on that did not come out -->
        <div v-else class="sf-tryon-error">
          <img v-if="photo" :src="photo" alt="" class="sf-tryon-thumb">
          <h2>{{ w('Essayage virtuel') }}</h2>
          <p role="alert">{{ message }}</p>
          <div class="sf-tryon-actions">
            <button v-if="canRetry && photo" type="button" class="sf-btn" @click="start">{{ w('Réessayer') }}</button>
            <button type="button" class="sf-btn" :class="{ 'is-outline': canRetry && photo }" @click="again">{{ w('Essayer avec une autre photo') }}</button>
          </div>
        </div>

        <div ref="guard" class="sf-tryon-guard" />
      </div>
    </div>
  </Teleport>
</template>
