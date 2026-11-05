export interface Item { description: string; qty: number; unit: string; unit_price: number; vat_rate: number }

export const round2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100
/** Stejné vzorce jako generované sloupce v databázi (document_items). */
export const lineNet = (i: Pick<Item, 'qty' | 'unit_price'>) => round2(i.qty * i.unit_price)
export const lineGross = (i: Pick<Item, 'qty' | 'unit_price' | 'vat_rate'>) => round2(i.qty * i.unit_price * (1 + i.vat_rate / 100))

export function totals(items: Item[]) {
  const net = round2(items.reduce((s, i) => s + lineNet(i), 0))
  const gross = round2(items.reduce((s, i) => s + lineGross(i), 0))
  return { net, vat: round2(gross - net), gross }
}

/** Další číslo faktury ve tvaru RRRRNNNN podle již existujících čísel. */
export function nextNumber(existing: (string | null)[], year: number): string {
  const re = new RegExp(`^${year}(\\d{4})$`)
  const max = existing.reduce((m, n) => { const x = n && re.exec(n); return x ? Math.max(m, +x[1]) : m }, 0)
  return `${year}${String(max + 1).padStart(4, '0')}`
}
