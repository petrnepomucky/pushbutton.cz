export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export interface Key { key: string; label: string; run: () => void }

/** Globální klávesy aktivní obrazovky (F-klávesy se blokují, aby je nepřebral prohlížeč). */
let keys: Key[] = []
export function setKeys(k: Key[]) { keys = k; renderStatus() }

export function renderStatus() {
  const el = document.querySelector('.status')
  if (el) el.innerHTML = [...keys, { key: 'Ctrl+K', label: 'Příkazy' }, { key: 'F9', label: 'Vzhled' }]
    .map((k) => `<span><b>${esc(k.key)}</b> ${esc(k.label)}</span>`).join('')
}

window.addEventListener('keydown', (e) => {
  const k = keys.find((x) => x.key.toLowerCase() === e.key.toLowerCase() || x.key === 'Esc' && e.key === 'Escape')
  if (k && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); k.run() }
})

export const money = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Enter přeskakuje na další pole formuláře, v posledním poli odešle. */
export function enterAsTab(form: HTMLElement, submit: () => void) {
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || (e.target as HTMLElement).tagName === 'BUTTON') return
    e.preventDefault()
    const f = [...form.querySelectorAll<HTMLElement>('input,select,textarea')]
    const i = f.indexOf(e.target as HTMLElement)
    if (i >= 0 && i < f.length - 1) f[i + 1].focus(); else submit()
  })
}

/** Přepínač vzhledu Budoucnost / DOS, pamatuje si volbu v prohlížeči. */
export function toggleTheme(init = false) {
  let t = 'future'
  try { t = localStorage.getItem('theme') ?? 'future' } catch { /* bez úložiště */ }
  if (!init) t = t === 'future' ? 'dos' : 'future'
  document.documentElement.dataset.theme = t
  try { localStorage.setItem('theme', t) } catch { /* bez úložiště */ }
}
