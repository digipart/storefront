// The signs the shop wrote for its currencies (Digipart > Devises: £ for GBP…), given by the site (app.vue); else the short sign of the language.
let SIGNS: Record<string, string> = {}
export function setCurrencySigns(signs: unknown) { if (signs && typeof signs === 'object') { SIGNS = signs as Record<string, string> } }

/** An amount as the visitor's language writes it (129,00 € / €129.00), with the shop's sign. */
export function money(value: number, currency = 'EUR', lang = 'fr', round = false): string {
  try {
    const format = new Intl.NumberFormat(lang, { style: 'currency', currencyDisplay: 'narrowSymbol', currency, ...(round ? { maximumFractionDigits: 0 } : {}) })
    const sign = SIGNS[String(currency).toUpperCase()]
    return sign ? format.formatToParts(value).map(part => (part.type === 'currency' ? sign : part.value)).join('') : format.format(value)
  } catch { return value.toFixed(2) + ' ' + currency }
}
