import { supabase } from './supabase'
import { enterAsTab, setKeys } from './ui'

type Mode = 'login' | 'register' | 'reset'
const TITLES: Record<Mode, string> = { login: ' Přihlášení ', register: ' Nová registrace ', reset: ' Zapomenuté heslo ' }

function czError(msg: string): string {
  if (/invalid login/i.test(msg)) return 'Nesprávný e-mail nebo heslo.'
  if (/already registered/i.test(msg)) return 'Tento e-mail je už zaregistrovaný.'
  if (/password.*(at least|short)/i.test(msg)) return 'Heslo musí mít alespoň 8 znaků.'
  if (/email not confirmed/i.test(msg)) return 'Nejdřív potvrďte e-mail (odkaz vám přišel poštou).'
  if (/rate limit/i.test(msg)) return 'Příliš mnoho pokusů, zkuste to za chvíli.'
  return msg
}

export function showAuth(root: HTMLElement) {
  let mode: Mode = 'login'
  const draw = () => {
    root.innerHTML = `
      <div class="center"><div class="box">
        <div class="title">${TITLES[mode]}</div>
        <form id="f" autocomplete="on">
          <div class="field"><label for="email">E-mail</label><input id="email" type="email" autocomplete="username" required></div>
          ${mode !== 'reset' ? `<div class="field"><label for="pw">Heslo</label><input id="pw" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" minlength="8" required></div>` : ''}
          <div class="err" id="msg" role="alert"></div>
          <div class="field"><button type="submit">[ Enter ] ${mode === 'login' ? 'Přihlásit' : mode === 'register' ? 'Zaregistrovat' : 'Poslat odkaz'}</button></div>
        </form>
      </div></div>`
    const f = root.querySelector<HTMLFormElement>('#f')!
    const msg = root.querySelector<HTMLElement>('#msg')!
    f.addEventListener('submit', async (e) => {
      e.preventDefault()
      msg.className = 'err'; msg.textContent = 'Pracuji…'
      const email = (root.querySelector('#email') as HTMLInputElement).value.trim()
      const password = (root.querySelector('#pw') as HTMLInputElement | null)?.value ?? ''
      const r = mode === 'login' ? await supabase.auth.signInWithPassword({ email, password })
        : mode === 'register' ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } })
        : await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin })
      if (r.error) { msg.textContent = czError(r.error.message); return }
      if (mode === 'register' && !('session' in r.data && r.data.session)) { msg.className = 'ok'; msg.textContent = 'Hotovo. Potvrďte e-mail odkazem, který jsme vám poslali.' }
      else if (mode === 'reset') { msg.className = 'ok'; msg.textContent = 'Odkaz pro nové heslo je na cestě do schránky.' }
      else msg.textContent = ''
    })
    enterAsTab(f, () => f.requestSubmit())
    setKeys([
      { key: 'F2', label: mode === 'login' ? 'Nová registrace' : 'Přihlášení', run: () => { mode = mode === 'login' ? 'register' : 'login'; draw() } },
      { key: 'F3', label: 'Zapomenuté heslo', run: () => { mode = 'reset'; draw() } },
    ])
    ;(root.querySelector('#email') as HTMLInputElement).focus()
  }
  root.innerHTML = ''
  draw()
}

