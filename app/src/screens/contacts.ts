import { supabase } from '../supabase'
import type { Firm } from '../firm'
import { enterAsTab, esc, setKeys, type Key } from '../ui'

interface Contact {
  id: string; kind: 'customer' | 'supplier' | 'both'; name: string; ico: string | null; dic: string | null
  email: string | null; phone: string | null; address: Record<string, string>; note: string | null
}
const KIND: Record<Contact['kind'], string> = { customer: 'Odběratel', supplier: 'Dodavatel', both: 'Obojí' }

export async function showContacts(root: HTMLElement, firm: Firm, baseKeys: Key[]) {
  let rows: Contact[] = []
  let sel = 0
  let filter = ''
  let modal = false

  const visible = () => {
    const q = filter.toLowerCase()
    return rows.filter((r) => !q || [r.name, r.ico, r.email].some((x) => x?.toLowerCase().includes(q)))
  }

  async function reload() {
    const { data, error } = await supabase.from('contacts').select('id,kind,name,ico,dic,email,phone,address,note')
      .is('deleted_at', null).order('name')
    if (error) { root.innerHTML = `<div class="err">${esc(error.message)}</div>`; return }
    rows = data as Contact[]
    sel = Math.min(sel, Math.max(visible().length - 1, 0))
    draw()
  }

  function draw() {
    const v = visible()
    root.innerHTML = `
      <div class="title">Klienti a dodavatelé (${v.length})</div>
      <div class="field"><label for="flt">Hledat (/)</label><input id="flt" value="${esc(filter)}" placeholder="název, IČO, e-mail"></div>
      ${v.length ? `<table><thead><tr><th>Název</th><th>Typ</th><th>IČO</th><th>E-mail</th><th>Telefon</th></tr></thead><tbody>
        ${v.map((r, i) => `<tr class="${i === sel ? 'sel' : ''}" data-i="${i}"><td>${esc(r.name)}</td><td>${KIND[r.kind]}</td><td>${esc(r.ico)}</td><td>${esc(r.email)}</td><td>${esc(r.phone)}</td></tr>`).join('')}
      </tbody></table>` : '<p class="hint">Zatím tu nikdo není. Stiskněte F2 a přidejte prvního klienta.</p>'}`
    const flt = root.querySelector<HTMLInputElement>('#flt')!
    flt.addEventListener('input', () => { filter = flt.value; sel = 0; const p = flt.selectionStart; draw(); const n = root.querySelector<HTMLInputElement>('#flt')!; n.focus(); n.setSelectionRange(p, p) })
    flt.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); flt.blur() } })
    root.querySelectorAll<HTMLElement>('tr[data-i]').forEach((tr) => {
      tr.onclick = () => { sel = +tr.dataset.i!; draw() }
      tr.ondblclick = () => edit(v[+tr.dataset.i!])
    })
    keys()
  }

  const keys = () => setKeys([
    ...baseKeys,
    { key: 'F2', label: 'Nový', run: () => edit(null) },
    { key: 'F4', label: 'Upravit', run: () => { const c = visible()[sel]; if (c) edit(c) } },
    { key: 'F8', label: 'Smazat', run: () => void remove() },
  ])

  function onKey(e: KeyboardEvent) {
    if (modal || (e.target as HTMLElement).tagName === 'INPUT') return
    const n = visible().length
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, n - 1); draw() }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); draw() }
    else if (e.key === 'Enter') { const c = visible()[sel]; if (c) edit(c) }
    else if (e.key === '/') { e.preventDefault(); root.querySelector<HTMLInputElement>('#flt')!.focus() }
  }
  document.addEventListener('keydown', onKey)
  ;(root as any)._cleanup = () => document.removeEventListener('keydown', onKey)

  async function remove() {
    const c = visible()[sel]
    if (!c || !confirm(`Smazat „${c.name}“?`)) return
    const { error } = await supabase.from('contacts').update({ deleted_at: new Date().toISOString() }).eq('id', c.id)
    if (error) alert(error.message); else reload()
  }

  function edit(c: Contact | null) {
    modal = true
    const a = c?.address ?? {}
    const m = document.createElement('div')
    m.className = 'modal'
    m.innerHTML = `<div class="box"><div class="title"> ${c ? 'Úprava' : 'Nový'} kontakt </div>
      <form id="cf">
        <div class="field"><label>Název</label><input name="name" value="${esc(c?.name)}" required></div>
        <div class="field"><label>Typ</label><select name="kind">${Object.entries(KIND).map(([k, l]) => `<option value="${k}" ${(c?.kind ?? 'customer') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label>IČO</label><input name="ico" value="${esc(c?.ico)}"></div>
        <div class="field"><label>DIČ</label><input name="dic" value="${esc(c?.dic)}"></div>
        <div class="field"><label>E-mail</label><input name="email" type="email" value="${esc(c?.email)}"></div>
        <div class="field"><label>Telefon</label><input name="phone" value="${esc(c?.phone)}"></div>
        <div class="field"><label>Ulice</label><input name="street" value="${esc(a.street)}"></div>
        <div class="field"><label>PSČ</label><input name="zip" value="${esc(a.zip)}"></div>
        <div class="field"><label>Město</label><input name="city" value="${esc(a.city)}"></div>
        <div class="field"><label>Poznámka</label><input name="note" value="${esc(c?.note)}"></div>
        <div class="err" id="cm" role="alert"></div>
        <div class="field"><button type="submit">[ Enter ] Uložit</button><button type="button" id="cx">[ Esc ] Zrušit</button></div>
      </form></div>`
    document.body.appendChild(m)
    const f = m.querySelector<HTMLFormElement>('#cf')!
    const close = () => { modal = false; m.remove(); document.removeEventListener('keydown', esc_); keys() }
    const esc_ = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', esc_)
    setKeys([{ key: 'Esc', label: 'Zrušit', run: close }])
    m.querySelector<HTMLElement>('#cx')!.onclick = close
    f.addEventListener('submit', async (e) => {
      e.preventDefault()
      const v = Object.fromEntries(new FormData(f)) as Record<string, string>
      const row = { name: v.name.trim(), kind: v.kind, ico: v.ico || null, dic: v.dic || null, email: v.email || null,
        phone: v.phone || null, note: v.note || null, address: { street: v.street, zip: v.zip, city: v.city } }
      const q = c ? supabase.from('contacts').update(row).eq('id', c.id) : supabase.from('contacts').insert({ ...row, firm_id: firm.id })
      const { error } = await q
      if (error) { m.querySelector('#cm')!.textContent = error.message; return }
      close(); reload()
    })
    enterAsTab(f, () => f.requestSubmit())
    f.querySelector<HTMLInputElement>('[name=name]')!.focus()
  }

  await reload()
}
