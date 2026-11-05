import { supabase } from './supabase'
import { enterAsTab, setKeys } from './ui'

export interface Firm { id: string; name: string; ico: string | null; dic: string | null; address: Record<string, string> }

export async function loadFirm(): Promise<Firm | null> {
  const { data, error } = await supabase.from('firm_members').select('firms(id,name,ico,dic,address)').limit(1)
  if (error) throw error
  const f = (data?.[0] as unknown as { firms: Firm } | undefined)?.firms
  return f ?? null
}

export function showFirmSetup(root: HTMLElement, userId: string, done: (f: Firm) => void) {
  root.innerHTML = `
    <div class="center"><div class="box">
      <div class="title"> Vaše firma </div>
      <p class="hint">Údaje se objeví na vystavených fakturách.</p>
      <form id="f">
        <div class="field"><label>Název</label><input name="name" required></div>
        <div class="field"><label>IČO</label><input name="ico" inputmode="numeric" pattern="\\d{8}" title="8 číslic"></div>
        <div class="field"><label>DIČ</label><input name="dic" placeholder="CZ12345678"></div>
        <div class="field"><label>Ulice</label><input name="street"></div>
        <div class="field"><label>PSČ</label><input name="zip"></div>
        <div class="field"><label>Město</label><input name="city"></div>
        <div class="err" id="msg" role="alert"></div>
        <div class="field"><button type="submit">[ Enter ] Založit firmu</button></div>
      </form>
    </div></div>`
  const f = root.querySelector<HTMLFormElement>('#f')!
  const msg = root.querySelector<HTMLElement>('#msg')!
  f.addEventListener('submit', async (e) => {
    e.preventDefault()
    const v = Object.fromEntries(new FormData(f)) as Record<string, string>
    msg.textContent = 'Ukládám…'
    const { data, error } = await supabase.from('firms')
      .insert({ name: v.name.trim(), ico: v.ico || null, dic: v.dic || null, created_by: userId,
        address: { street: v.street, zip: v.zip, city: v.city } })
      .select('id,name,ico,dic,address').single()
    if (error) { msg.textContent = error.message; return }
    done(data as Firm)
  })
  enterAsTab(f, () => f.requestSubmit())
  setKeys(import.meta.env.VITE_AUTH_DISABLED === '1' ? [] : [{ key: 'F10', label: 'Odhlásit', run: () => void supabase.auth.signOut() }])
  ;(f.querySelector('[name=name]') as HTMLInputElement).focus()
}
