// The site engine of Digipart Commerce. One engine, many shops: the shop it draws is the sales channel named in its environment (ID_MARKET_PLACE). Everything it shows comes from Digipart (api/storefront):
// the theme, the header, the footer, the pages of the site builder, the content pages. The key of the front (CLIENT_ID / CLIENT_SECRET) stays on this server: the browser never sees it.
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  css: ['~/assets/storefront.css'],
  runtimeConfig: {
    digipartUrl: process.env.DIGIPART_URL || '',            // the address of the Digipart back-office of the shop, e.g. https://app.example.com
    clientId: process.env.CLIENT_ID || '',                  // the key of the front (Configuration > Interface)
    clientSecret: process.env.CLIENT_SECRET || '',
    idMarketPlace: process.env.ID_MARKET_PLACE || '',       // the sales channel of this site
    cacheSeconds: Number(process.env.CACHE_SECONDS || 300), // how long an answer of Digipart is kept in memory (it is dropped at once when the shop publishes: server/utils/digipart.ts)
    localApp: process.env.DIGIPART_LOCAL_APP || '',         // development only: the folder of a Digipart installed on this machine; its own code answers instead of api/storefront (dev/bridge.php), no key needed
    localPhp: process.env.DIGIPART_LOCAL_PHP || 'php',
    localUrl: process.env.DIGIPART_LOCAL_URL || '',          // development only: the address of that local Digipart, for its public APIs (the menu) and the "Modifier le thème" link      // the PHP binary that runs it
    forcePro: process.env.FORCE_PRO || '',                  // development only: treat the site as a professional one (wholesale prices) whatever the channel says
    returnPortalUrl: process.env.RETURN_PORTAL_URL || '',   // optional: the return portal of the shop (https://return.digipart.fr/<brand>); the account then links an order to it when Digipart says it can be returned
    googlePlacesKey: process.env.GOOGLE_PLACES_KEY || '',   // optional: address suggestions on the order page (Google Places API, used from the server only)
    fixtures: process.env.DIGIPART_FIXTURES || '',          // development only: a folder of JSON answers read instead of calling Digipart
  },
  app: { head: { meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }] } },
  nitro: { compressPublicAssets: true },
  // no « manifest of the build » asked by the page: a tab left open across an update of the site used to ask for the file of the old build and show a 404 page. A piece of script
  // of an old build that is gone makes the page reload itself (Nuxt's own behaviour), which is all an update needs.
  experimental: { appManifest: false },
})
