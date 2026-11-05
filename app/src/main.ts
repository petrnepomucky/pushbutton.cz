import './style.css'
import { supabase } from './supabase'
import { showAuth } from './auth'
import { loadFirm, showFirmSetup, type Firm } from './firm'
import { showContacts } from './screens/contacts'
import { showInvoices } from './screens/invoices'
import { showSettings } from './screens/settings'
import { esc, renderStatus, toggleTheme, type Key } from './ui'
import { openPalette } from './palette'

const app = document.getElementById('app')!
const AUTH_OFF = import.meta.env.VITE_AUTH_DISABLED === '1'
toggleTheme(true)
let paletteCmds: () => { label: string; hint?: string; run: () => void }[] = () => []
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(paletteCmds()) }
  else if (e.key === 'F9') { e.preventDefault(); toggleTheme() }
})

interface Section { id: string; label: string; show: (root: HTMLElement, firm: Firm, base: Key[]) => void }
const placeholder = (t: string) => (root: HTMLElement) => { root.innerHTML = `<div class="title">${t}</div><p class="hint">Připravujeme v dalším kroku.</p>` }
const SECTIONS: Section[] = [
  { id: '1', label: 'Faktury', show: (r, f, b) => void showInvoices(r, f, b) },
  { id: '2', label: 'Klienti', show: (r, f, b) => void showContacts(r, f, b) },
  { id: '3', label: 'Přijaté', show: placeholder('Přijaté faktury a výdaje') },
  { id: '4', label: 'Přehledy', show: placeholder('Přehledy, DPH a export pro účetní') },
  { id: '5', label: 'Nastavení', show: (r, f, b) => showSettings(r, f, b) },
]

function shell(firm: Firm) {
  app.innerHTML = `<div class="menu" id="menu"></div><div class="main" id="main"></div><div class="status"></div>`
  const main = document.getElementById('main')!
  let cur = 1
  const base: Key[] = AUTH_OFF ? [] : [{ key: 'F10', label: 'Odhlásit', run: () => void supabase.auth.signOut() }]
  const go = (i: number) => {
    cur = i
    ;(main as any)._cleanup?.(); (main as any)._cleanup = undefined
    document.getElementById('menu')!.innerHTML =
      SECTIONS.map((s, n) => `<span class="${n === cur ? 'on' : ''}"><b>${s.id}</b> ${esc(s.label)}</span>`).join('') +
      `<span style="margin-left:auto">${esc(firm.name)}</span>`
    SECTIONS[i].show(main, firm, base)
    renderStatus()
  }
  paletteCmds = () => [
    ...SECTIONS.map((s, i) => ({ label: `Přejít na: ${s.label}`, hint: s.id, run: () => go(i) })),
    { label: 'Přepnout vzhled (Budoucnost / DOS)', hint: 'F9', run: () => toggleTheme() },
    ...(AUTH_OFF ? [] : [{ label: 'Odhlásit se', hint: 'F10', run: () => void supabase.auth.signOut() }]),
  ]
  document.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('input,select,textarea') || document.querySelector('.modal') || e.ctrlKey || e.altKey || e.metaKey) return
    const i = SECTIONS.findIndex((s) => s.id === e.key)
    if (i >= 0) go(i)
  })
  go(0)
}

function plain(): HTMLElement {
  app.innerHTML = `<div class="main" id="screen"></div><div class="status"></div>`
  return document.getElementById('screen')!
}

async function route(userId: string | null) {
  if (!userId) { showAuth(plain()); return }
  try {
    const firm = await loadFirm()
    if (firm) shell(firm); else showFirmSetup(plain(), userId, shell)
  } catch (e) { app.innerHTML = `<div class="main err">${esc((e as Error).message)}</div>` }
}

let last: string | null | undefined
supabase.auth.onAuthStateChange((_ev, session) => {
  const id = session?.user.id ?? null
  if (id === last) return
  last = id
  if (!id && AUTH_OFF) {
    // Přihlášení je vypnuté: tiše se založí anonymní účet (data chrání RLS).
    app.innerHTML = '<div class="main hint">Připojuji…</div>'
    void supabase.auth.signInAnonymously().then(({ error }) => {
      if (error) app.innerHTML = `<div class="main err">Anonymní přístup není v Supabase zapnutý (Auth → Sign In / Providers → Allow anonymous sign-ins). ${esc(error.message)}</div>`
    })
    return
  }
  setTimeout(() => void route(id))
})
