import type { H3Event } from 'h3'

// The objects of the visitor for the code sections (Customer, Cart, Orders, Loyalty): never in a page kept for everyone, only in the answer of code-personal (no-store).
export const PERSONAL = /\b(Customer|Cart|Orders|Loyalty)\b/

const accountUrl = (lang: string, prefix: string) => prefix + (lang === 'fr' ? '/compte' : '/account')

/** What a visitor who is not signed in sees: the same shape, empty. */
export function guestObjects(): Record<string, unknown> {
  return {
    Customer: { LoggedIn: false, Firstname: '', Lastname: '', Name: '', Email: '', Company: '', Professional: false, Newsletter: false, AccountUrl: '' },
    Cart: { Count: 0, Lines: [], Products: 0, Discount: 0, Shipping: 0, Total: 0, Currency: 'EUR', FreeShippingFrom: null, FreeShippingLeft: null, Url: '' },
    Orders: [],
    Loyalty: { Member: false, Program: '', Points: 0, Tier: '', NextTier: '', PointsToNext: 0, Progress: 0, CardNumber: '' },
  }
}

/** The objects of this visitor, read only for what the template uses. */
export async function personalObjects(event: H3Event, template: string, lang: string, prefix: string): Promise<Record<string, unknown>> {
  const out = guestObjects() as any
  const uses = (name: string) => new RegExp('\\b' + name + '\\b').test(template)
  const me = uses('Customer') || uses('Orders') || uses('Loyalty') ? await profile(event) : null
  const signed = !!me && !me.Guest && loggedIn(event)
  const account = accountUrl(lang, prefix)
  const [cart, orders, loyalty] = await Promise.all([
    uses('Cart') ? readCart(event, lang, prefix).catch(() => null) : null,
    signed && uses('Orders') ? readOrders(event, lang, 1, me.Email, 5).catch(() => null) : null,
    signed && uses('Loyalty') ? readLoyalty(event, lang).catch(() => null) : null,
  ])
  if (signed) {
    out.Customer = { LoggedIn: true, Firstname: me.Firstname, Lastname: me.Lastname, Name: [me.Firstname, me.Lastname].filter(Boolean).join(' '), Email: me.Email, Company: me.Company, Professional: !!me.Business, Newsletter: !!me.Newsletter, AccountUrl: account }
  }
  if (cart) {
    const free = typeof cart.FreeFrom === 'number' ? cart.FreeFrom : null
    out.Cart = {
      Count: cart.Count, Currency: cart.Currency, Products: cart.Products, Discount: cart.Discount, Shipping: cart.Shipping, Total: cart.ToPay,
      FreeShippingFrom: free, FreeShippingLeft: free === null ? null : Math.max(0, Math.round((free - cart.Products) * 100) / 100), Url: prefix + (lang === 'fr' ? '/panier' : '/cart'),
      Lines: cart.Lines.map(line => ({ Name: line.Name, Variant: line.Variant, Reference: line.Reference, Image: line.Image, Url: line.Url, Quantity: line.Quantity, Price: line.Price, Total: line.Total })),
    }
  }
  if (orders) {
    const folder = account + (lang === 'fr' ? '/commandes/' : '/orders/')
    out.Orders = orders.Orders.map((o: any) => ({ Number: o.Id, Date: o.Date, State: o.State, Total: o.Total, Currency: orders.Currency, Count: o.Count, Images: o.Images, Url: folder + encodeURIComponent(o.Id) }))
  }
  if (loyalty) {
    out.Loyalty = { Member: true, Program: loyalty.Program, Points: loyalty.Points, Tier: loyalty.Tier, NextTier: loyalty.Next?.Name || '', PointsToNext: loyalty.Next?.Missing || 0, Progress: loyalty.Next ? loyalty.Next.Done : 100, CardNumber: loyalty.CardNumber }
  }
  return out
}

/** A made-up signed-in customer, for the plan view of the builder. */
export function sampleObjects(lang: string): Record<string, unknown> {
  const fr = lang === 'fr'
  return {
    Customer: { LoggedIn: true, Firstname: 'Camille', Lastname: 'Martin', Name: 'Camille Martin', Email: 'camille.martin@example.com', Company: '', Professional: false, Newsletter: true, AccountUrl: fr ? '/compte' : '/account' },
    Cart: { Count: 2, Currency: 'EUR', Products: 129.8, Discount: 0, Shipping: 0, Total: 129.8, FreeShippingFrom: 150, FreeShippingLeft: 20.2, Url: fr ? '/panier' : '/cart', Lines: [
      { Name: fr ? 'Chemise en lin' : 'Linen shirt', Variant: 'M / Blanc', Reference: 'CH-001', Image: '', Url: '#', Quantity: 1, Price: 79.9, Total: 79.9 },
      { Name: fr ? 'Ceinture cuir' : 'Leather belt', Variant: '90', Reference: 'CE-014', Image: '', Url: '#', Quantity: 1, Price: 49.9, Total: 49.9 },
    ] },
    Orders: [
      { Number: '1042', Date: '2026-11-02 10:12:00', State: fr ? 'Expédiée' : 'Shipped', Total: 89.9, Currency: 'EUR', Count: 2, Images: [], Url: '#' },
      { Number: '0987', Date: '2026-09-18 16:40:00', State: fr ? 'Livrée' : 'Delivered', Total: 145, Currency: 'EUR', Count: 3, Images: [], Url: '#' },
    ],
    Loyalty: { Member: true, Program: 'Club', Points: 320, Tier: 'Silver', NextTier: 'Gold', PointsToNext: 180, Progress: 64, CardNumber: '0000 1234' },
  }
}
