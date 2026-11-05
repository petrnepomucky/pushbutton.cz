import { esc } from './ui'

export interface Cmd { label: string; hint?: string; run: () => void }

export function openPalette(cmds: Cmd[]) {
  if (document.querySelector('.palette')) return
  const m = document.createElement('div')
  m.className = 'modal'
  m.innerHTML = `<div class="palette"><input placeholder="Co chcete udělat?" aria-label="Příkaz"><ul></ul></div>`
  document.body.appendChild(m)
  const input = m.querySelector('input')!
  const ul = m.querySelector('ul')!
  let sel = 0
  const list = () => cmds.filter((c) => c.label.toLowerCase().includes(input.value.toLowerCase()))
  const draw = () => {
    const l = list(); sel = Math.min(sel, Math.max(l.length - 1, 0))
    ul.innerHTML = l.map((c, i) => `<li class="${i === sel ? 'sel' : ''}" data-i="${i}"><span>${esc(c.label)}</span><small>${esc(c.hint ?? '')}</small></li>`).join('')
    ul.querySelectorAll<HTMLElement>('li').forEach((li) => li.onclick = () => run(l[+li.dataset.i!]))
  }
  const close = () => { m.remove() }
  const run = (c?: Cmd) => { if (!c) return; close(); c.run() }
  input.addEventListener('input', () => { sel = 0; draw() })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, list().length - 1); draw() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); draw() }
    else if (e.key === 'Enter') { e.preventDefault(); run(list()[sel]) }
    else if (e.key === 'Escape') { e.stopPropagation(); close() }
  })
  m.addEventListener('mousedown', (e) => { if (e.target === m) close() })
  draw(); input.focus()
}
