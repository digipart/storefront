/** An amount as the visitor's language writes it (129,00 € / €129.00). */
export function money(value: number, currency = 'EUR', lang = 'fr'): string {
  try { return new Intl.NumberFormat(lang, { style: 'currency', currency }).format(value) } catch { return value.toFixed(2) + ' ' + currency }
}
