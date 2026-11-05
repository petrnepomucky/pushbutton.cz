import { supabase } from '../supabase'
import type { Firm } from '../firm'
import { enterAsTab, esc, money, setKeys, type Key } from '../ui'
import { lineGross, nextNumber, totals, type Item } from '../invoice-math'
import { dateCz, printInvoice } from '../print'

interface Row {
  id: string; number: string | null; status: string; issue_date: string | null; due_date: string | null
  total_gross: number | null; paid_at: string | null; contact_id: string | null; contacts: { name: string } | null
}
const iso = (d: Date) => d.toLocaleDateString('sv-SE')
const today = () => iso(new Date())
const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d) }

function state(r: Row): { label: string; cls: string } {
  if (r.status === 'paid') return { label: 'Zaplaceno', cls: 'ok' }
  if (r.due_date && r.due_date < today()) return { label: 'Po splatnosti', cls: 'err' }
  return { label: 'Čeká na úhradu', cls: 'hint' }
}

export async function showInvoices(root: HTMLElement, firm: Firm, baseKeys: Key[]) {
  let rows: Row[] = []
  let sel = 0
  let modal = false
  let alive = true

  async function reload() {
    const { data, error } = await supabase.from('documents')
      .select('id,number,status,issue_date,due_date,total_gross,paid_at,contact_id,contacts(name)')
      .eq('doc_type', 'issued_invoice').is('deleted_at', null)
      .order('issue_date', { ascending: false }).order('number', { ascending: false })
    if (!alive) return
    if (error) { root.innerHTML = `<div class="err">${esc(error.message)}</div>`; return }
    rows = data as unknown as Row[]
    sel = Math.min(sel, Math.max(rows.length - 1, 0))
    draw()
  }

  function draw() {
    if (!alive) return
    const open = rows.filter((r) => r.status !== 'paid')
    const overdue = open.filter((r) => r.due_date && r.due_date < today())
    const sum = (l: Row[]) => l.reduce((s, r) => s + +(r.total_gross ?? 0), 0)
    root.innerHTML = `
      <div class="title">Vydané faktury (${rows.length})</div>
      <div class="cards">
        <div class="card"><small>Neuhrazeno</small><b>${money(sum(open))} Kč</b><span>${open.length} faktur</span></div>
        <div class="card ${overdue.length ? 'bad' : ''}"><small>Po splatnosti</small><b>${money(sum(overdue))} Kč</b><span>${overdue.length} faktur</span></div>
      </div>
      ${rows.length ? `<table><thead><tr><th>Číslo</th><th>Odběratel</th><th>Vystaveno</th><th>Splatnost</th><th class="right">Částka</th><th>Stav</th></tr></thead><tbody>
        ${rows.map((r, i) => { const s = state(r); return `<tr class="${i === sel ? 'sel' : ''}" data-i="${i}"><td>${esc(r.number)}</td><td>${esc(r.contacts?.name)}</td><td>${dateCz(r.issue_date)}</td><td>${dateCz(r.due_date)}</td><td class="right">${money(r.total_gross)}</td><td class="${s.cls}">${s.label}</td></tr>` }).join('')}
      </tbody></table>` : '<p class="hint">Zatím žádná faktura. Stiskněte F2 a vystavte první.</p>'}`
    root.querySelectorAll<HTMLElement>('tr[data-i]').forEach((tr) => {
      tr.onclick = () => { sel = +tr.dataset.i!; draw() }
      tr.ondblclick = () => void edit(rows[+tr.dataset.i!])
    })
    keys()
  }

  const keys = () => setKeys([
    ...baseKeys,
    { key: 'F2', label: 'Nová', run: () => void edit(null) },
    { key: 'F4', label: 'Upravit', run: () => { const r = rows[sel]; if (r) void edit(r) } },
    { key: 'F5', label: 'Zaplaceno', run: () => void togglePaid() },
    { key: 'F6', label: 'Tisk / PDF', run: () => { const r = rows[sel]; if (r) void printInvoice(r.id, firm) } },
    { key: 'F8', label: 'Smazat', run: () => void remove() },
  ])

  const onKey = (e: KeyboardEvent) => {
    if (modal || (e.target as HTMLElement).closest('input,select,textarea')) return
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, rows.length - 1); draw() }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); draw() }
    else if (e.key === 'Enter' && rows[sel]) void edit(rows[sel])
  }
  document.addEventListener('keydown', onKey)
  ;(root as any)._cleanup = () => { alive = false; document.removeEventListener('keydown', onKey) }

  async function togglePaid() {
    const r = rows[sel]; if (!r) return
    const paid = r.status !== 'paid'
    const { error } = await supabase.from('documents').update({ status: paid ? 'paid' : 'approved', paid_at: paid ? today() : null }).eq('id', r.id)
    if (error) alert(error.message); else reload()
  }

  async function remove() {
    const r = rows[sel]
    if (!r || !confirm(`Smazat fakturu ${r.number}?`)) return
    const { error } = await supabase.from('documents').update({ deleted_at: new Date().toISOString() }).eq('id', r.id)
    if (error) alert(error.message); else reload()
  }

  async function edit(r: Row | null) {
    const [cs, existing, its] = await Promise.all([
      supabase.from('contacts').select('id,name').is('deleted_at', null).in('kind', ['customer', 'both']).order('name'),
      r ? Promise.resolve({ data: null }) : supabase.from('documents').select('number').eq('doc_type', 'issued_invoice'),
      r ? supabase.from('document_items').select('description,qty,unit,unit_price,vat_rate').eq('document_id', r.id).order('position') : Promise.resolve({ data: [] }),
    ])
    const full = r ? await supabase.from('documents').select('taxable_date,note').eq('id', r.id).single() : null
    const contacts = (cs.data ?? []) as { id: string; name: string }[]
    const number = r?.number ?? nextNumber(((existing.data ?? []) as { number: string | null }[]).map((x) => x.number), new Date().getFullYear())
    let items: Item[] = ((its.data ?? []) as Item[]).map((i) => ({ ...i, qty: +i.qty, unit_price: +i.unit_price, vat_rate: +i.vat_rate }))
    if (!items.length) items = [{ description: '', qty: 1, unit: 'ks', unit_price: 0, vat_rate: 21 }]
    let focusRow = 0
    modal = true

    const m = document.createElement('div')
    m.className = 'modal'
    m.innerHTML = `<div class="box wide"><div class="title">${r ? 'Úprava' : 'Nová'} faktura ${esc(number)}</div>
      <form id="iv">
        <div class="grid3">
          <div class="field"><label>Odběratel</label><select name="contact"><option value="">— vyberte —</option>${contacts.map((c) => `<option value="${c.id}" ${c.id === r?.contact_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Vystaveno</label><input type="date" name="issue" value="${r?.issue_date ?? today()}" required></div>
          <div class="field"><label>Splatnost</label><input type="date" name="due" value="${r?.due_date ?? plusDays(14)}" required></div>
        </div>
        ${contacts.length ? '' : '<p class="hint">Nejdřív přidejte odběratele v sekci Klienti (klávesa 2).</p>'}
        <table class="items"><thead><tr><th>Popis</th><th>Množ.</th><th>Jedn.</th><th>Cena/ks</th><th>DPH %</th><th class="right">Celkem</th></tr></thead><tbody></tbody></table>
        <div class="sumline" id="sum"></div>
        <div class="field"><label>Poznámka</label><input name="note" value="${esc(full?.data?.note)}"></div>
        <div class="err" id="im" role="alert"></div>
        <div class="field"><button type="submit">[ Enter ] Uložit fakturu</button><button type="button" id="ix">[ Esc ] Zrušit</button></div>
      </form></div>`
    document.body.appendChild(m)
    const f = m.querySelector<HTMLFormElement>('#iv')!
    const tbody = m.querySelector('tbody')!
    const num = (v: string) => +v.replace(',', '.') || 0

    const renderSum = () => {
      const t = totals(items)
      m.querySelector('#sum')!.innerHTML = `Základ <b>${money(t.net)}</b> · DPH <b>${money(t.vat)}</b> · Celkem <b class="big">${money(t.gross)} Kč</b>`
      items.forEach((i, n) => { const c = m.querySelector(`#t${n}`); if (c) c.textContent = money(lineGross(i)) })
    }
    const renderRows = (focus?: number) => {
      tbody.innerHTML = items.map((i, n) => `<tr>
        <td><input data-r="${n}" data-f="description" value="${esc(i.description)}" aria-label="Popis"></td>
        <td><input data-r="${n}" data-f="qty" value="${i.qty}" inputmode="decimal" size="5" aria-label="Množství"></td>
        <td><input data-r="${n}" data-f="unit" value="${esc(i.unit)}" size="4" aria-label="Jednotka"></td>
        <td><input data-r="${n}" data-f="unit_price" value="${i.unit_price}" inputmode="decimal" size="9" aria-label="Cena za kus"></td>
        <td><input data-r="${n}" data-f="vat_rate" value="${i.vat_rate}" inputmode="decimal" size="4" aria-label="DPH"></td>
        <td class="right" id="t${n}"></td></tr>`).join('')
      renderSum()
      if (focus !== undefined) tbody.querySelector<HTMLInputElement>(`[data-r="${focus}"][data-f=description]`)?.focus()
    }
    tbody.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement
      const n = +el.dataset.r!, k = el.dataset.f as keyof Item
      ;(items[n] as any)[k] = k === 'description' || k === 'unit' ? el.value : num(el.value)
      renderSum()
    })
    tbody.addEventListener('focusin', (e) => { focusRow = +((e.target as HTMLElement).dataset.r ?? focusRow) })

    const close = () => { modal = false; m.remove(); document.removeEventListener('keydown', onEsc); keys() }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onEsc)
    setKeys([
      { key: 'F3', label: 'Přidat řádek', run: () => { items.push({ description: '', qty: 1, unit: 'ks', unit_price: 0, vat_rate: items.at(-1)?.vat_rate ?? 21 }); renderRows(items.length - 1) } },
      { key: 'F7', label: 'Odebrat řádek', run: () => { if (items.length > 1) { items.splice(focusRow, 1); focusRow = Math.max(0, focusRow - 1); renderRows(focusRow) } } },
      { key: 'Esc', label: 'Zrušit', run: close },
    ])
    m.querySelector<HTMLElement>('#ix')!.onclick = close

    f.addEventListener('submit', async (e) => {
      e.preventDefault()
      const msg = m.querySelector<HTMLElement>('#im')!
      const v = Object.fromEntries(new FormData(f)) as Record<string, string>
      const valid = items.filter((i) => i.description.trim())
      if (!valid.length) { msg.textContent = 'Přidejte alespoň jednu položku s popisem.'; return }
      if (v.due < v.issue) { msg.textContent = 'Splatnost nemůže být před datem vystavení.'; return }
      const t = totals(valid)
      const head = { contact_id: v.contact || null, issue_date: v.issue, taxable_date: v.issue, due_date: v.due, note: v.note || null,
        total_net: t.net, total_vat: t.vat, total_gross: t.gross }
      msg.textContent = 'Ukládám…'
      let id = r?.id
      if (r) {
        const u = await supabase.from('documents').update(head).eq('id', r.id)
        if (u.error) { msg.textContent = u.error.message; return }
        const d = await supabase.from('document_items').delete().eq('document_id', r.id)
        if (d.error) { msg.textContent = d.error.message; return }
      } else {
        const ins = await supabase.from('documents').insert({ ...head, firm_id: firm.id, doc_type: 'issued_invoice', status: 'approved', number, variable_symbol: number }).select('id').single()
        if (ins.error) { msg.textContent = ins.error.message; return }
        id = ins.data.id
      }
      const ii = await supabase.from('document_items').insert(valid.map((i, n) => ({ ...i, firm_id: firm.id, document_id: id, position: n + 1 })))
      if (ii.error) { msg.textContent = ii.error.message; return }
      close(); reload()
    })
    enterAsTab(f, () => f.requestSubmit())
    renderRows(0)
  }

  await reload()
}
