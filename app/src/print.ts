import QRCode from 'qrcode'
import { supabase } from './supabase'
import type { Firm } from './firm'
import { esc, money } from './ui'
import { czIban, spd } from './iban'
import { lineGross, totals, type Item } from './invoice-math'

export const dateCz = (d: string | null) => (d ? `${d.slice(8, 10)}. ${d.slice(5, 7)}. ${d.slice(0, 4)}` : '')
const addr = (a: Record<string, string> | null | undefined) => [a?.street, [a?.zip, a?.city].filter(Boolean).join(' ')].filter(Boolean).map(esc).join('<br>')

/** Otevře fakturu v novém okně k tisku / uložení do PDF (včetně QR platby). */
export async function printInvoice(id: string, firm: Firm) {
  const w = window.open('', '_blank')
  if (!w) { alert('Prohlížeč zablokoval nové okno. Povolte vyskakovací okna pro tuto stránku.'); return }
  w.document.write('<p style="font:16px sans-serif">Připravuji fakturu…</p>')
  const [d, it] = await Promise.all([
    supabase.from('documents').select('number,variable_symbol,issue_date,due_date,taxable_date,note,total_gross,currency,contacts(name,ico,dic,address)').eq('id', id).single(),
    supabase.from('document_items').select('description,qty,unit,unit_price,vat_rate').eq('document_id', id).order('position'),
  ])
  if (d.error || it.error) { w.document.body.textContent = (d.error ?? it.error)!.message; return }
  const doc = d.data as unknown as { number: string; variable_symbol: string | null; issue_date: string; due_date: string; taxable_date: string | null; note: string | null; contacts: { name: string; ico: string | null; dic: string | null; address: Record<string, string> } | null }
  const items = (it.data as unknown as Item[]).map((i) => ({ ...i, qty: +i.qty, unit_price: +i.unit_price, vat_rate: +i.vat_rate }))
  const t = totals(items)
  const account = firm.address.bank_account ?? ''
  const iban = czIban(account)
  const qr = iban ? await QRCode.toDataURL(spd(iban, t.gross, doc.variable_symbol ?? doc.number, `Faktura ${doc.number}`), { margin: 1, width: 220 }) : ''
  const c = doc.contacts
  w.document.open()
  w.document.write(`<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>Faktura ${esc(doc.number)}</title><style>
  @page{size:A4;margin:14mm} body{font:13px/1.45 Arial,sans-serif;color:#232a34;margin:0;padding:18px;max-width:780px;margin:auto}
  h1{margin:0;color:#15233c;font-size:26px} .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #b0894e;padding-bottom:10px}
  .cols{display:flex;gap:28px;margin:16px 0}.cols>div{flex:1;border:1px solid #e6e0d3;padding:10px 12px;border-radius:6px}
  h3{margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9a742a}
  table{width:100%;border-collapse:collapse;margin-top:6px} th{background:#15233c;color:#fff;text-align:left;padding:6px 8px;font-size:12px}
  td{padding:6px 8px;border-bottom:1px solid #eef0f3} .r{text-align:right}
  .sum{margin-left:auto;width:280px;margin-top:10px} .sum div{display:flex;justify-content:space-between;padding:3px 0}
  .tot{font-size:18px;font-weight:700;border-top:2px solid #15233c;margin-top:4px;padding-top:6px!important}
  .pay{display:flex;gap:18px;align-items:center;margin-top:18px;border:1px solid #e6e0d3;border-radius:6px;padding:10px 14px}
  button{position:fixed;right:14px;top:14px;font:600 14px Arial;padding:8px 14px;background:#15233c;color:#fff;border:0;border-radius:6px;cursor:pointer}
  @media print{button{display:none}}</style></head><body>
  <button onclick="print()">Tisk / uložit jako PDF</button>
  <div class="top"><div><h1>Faktura č. ${esc(doc.number)}</h1><div>Daňový doklad</div></div><div style="text-align:right"><b>${esc(firm.name)}</b></div></div>
  <div class="cols">
    <div><h3>Dodavatel</h3><b>${esc(firm.name)}</b><br>${addr(firm.address)}${firm.ico ? `<br>IČO: ${esc(firm.ico)}` : ''}${firm.dic ? `<br>DIČ: ${esc(firm.dic)}` : ''}</div>
    <div><h3>Odběratel</h3>${c ? `<b>${esc(c.name)}</b><br>${addr(c.address)}${c.ico ? `<br>IČO: ${esc(c.ico)}` : ''}${c.dic ? `<br>DIČ: ${esc(c.dic)}` : ''}` : '—'}</div>
    <div><h3>Údaje</h3>Vystaveno: ${dateCz(doc.issue_date)}<br>DUZP: ${dateCz(doc.taxable_date ?? doc.issue_date)}<br>Splatnost: <b>${dateCz(doc.due_date)}</b><br>Variabilní symbol: ${esc(doc.variable_symbol ?? doc.number)}</div>
  </div>
  <table><thead><tr><th>Popis</th><th class="r">Množství</th><th class="r">Cena/ks</th><th class="r">DPH</th><th class="r">Celkem s DPH</th></tr></thead><tbody>
  ${items.map((i) => `<tr><td>${esc(i.description)}</td><td class="r">${i.qty} ${esc(i.unit)}</td><td class="r">${money(i.unit_price)}</td><td class="r">${i.vat_rate} %</td><td class="r">${money(lineGross(i))}</td></tr>`).join('')}
  </tbody></table>
  <div class="sum"><div><span>Základ</span><span>${money(t.net)}</span></div><div><span>DPH</span><span>${money(t.vat)}</span></div><div class="tot"><span>K úhradě</span><span>${money(t.gross)} Kč</span></div></div>
  <div class="pay">${qr ? `<img src="${qr}" width="120" height="120" alt="QR platba">` : ''}<div><b>Platební údaje</b><br>${account ? `Účet: ${esc(account)}${iban ? `<br>IBAN: ${iban}` : ''}` : '<i>Číslo účtu doplňte v Nastavení, objeví se zde včetně QR platby.</i>'}<br>VS: ${esc(doc.variable_symbol ?? doc.number)}</div></div>
  ${doc.note ? `<p>${esc(doc.note)}</p>` : ''}
  </body></html>`)
  w.document.close()
}
