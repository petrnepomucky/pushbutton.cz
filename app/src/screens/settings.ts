import { supabase } from '../supabase'
import type { Firm } from '../firm'
import { czIban } from '../iban'
import { enterAsTab, esc, setKeys, type Key } from '../ui'

export function showSettings(root: HTMLElement, firm: Firm, baseKeys: Key[]) {
  const a = firm.address ?? {}
  root.innerHTML = `
    <div class="title">Nastavení firmy</div>
    <form id="sf" class="box wide">
      <div class="field"><label>Název</label><input name="name" value="${esc(firm.name)}" required></div>
      <div class="field"><label>IČO</label><input name="ico" value="${esc(firm.ico)}"></div>
      <div class="field"><label>DIČ</label><input name="dic" value="${esc(firm.dic)}"></div>
      <div class="field"><label>Ulice</label><input name="street" value="${esc(a.street)}"></div>
      <div class="field"><label>PSČ</label><input name="zip" value="${esc(a.zip)}"></div>
      <div class="field"><label>Město</label><input name="city" value="${esc(a.city)}"></div>
      <div class="field"><label>Číslo účtu</label><input name="bank" value="${esc(a.bank_account)}" placeholder="123456789/0100 nebo IBAN"></div>
      <p class="hint">Číslo účtu se tiskne na fakturu a z něj se vytváří QR platba.</p>
      <div class="err" id="sm" role="alert"></div>
      <div class="field"><button type="submit">[ Enter ] Uložit</button></div>
    </form>`
  const f = root.querySelector<HTMLFormElement>('#sf')!
  const msg = root.querySelector<HTMLElement>('#sm')!
  f.addEventListener('submit', async (e) => {
    e.preventDefault()
    const v = Object.fromEntries(new FormData(f)) as Record<string, string>
    if (v.bank && !czIban(v.bank)) { msg.className = 'err'; msg.textContent = 'Číslo účtu nemá správný tvar (např. 19-2000145399/0800 nebo CZ65…).'; return }
    const address = { ...firm.address, street: v.street, zip: v.zip, city: v.city, bank_account: v.bank.trim() }
    const { error } = await supabase.from('firms').update({ name: v.name.trim(), ico: v.ico || null, dic: v.dic || null, address }).eq('id', firm.id)
    if (error) { msg.className = 'err'; msg.textContent = error.message; return }
    Object.assign(firm, { name: v.name.trim(), ico: v.ico || null, dic: v.dic || null, address })
    msg.className = 'ok'; msg.textContent = 'Uloženo.'
  })
  enterAsTab(f, () => f.requestSubmit())
  setKeys(baseKeys)
}
