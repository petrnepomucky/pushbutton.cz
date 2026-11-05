const mod97 = (s: string) => { let r = 0; for (const c of s) r = (r * 10 + +c) % 97; return r }

/** Převod českého čísla účtu (předčíslí-číslo/banka) na IBAN; hotový IBAN jen očistí. Neplatný vstup → null. */
export function czIban(acc: string): string | null {
  const a = acc.replace(/\s/g, '').toUpperCase()
  if (/^CZ\d{22}$/.test(a)) return a
  const m = /^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/.exec(a)
  if (!m) return null
  const bban = m[3] + (m[1] ?? '').padStart(6, '0') + m[2].padStart(10, '0')
  const check = String(98 - mod97(bban + '123500')).padStart(2, '0')
  return `CZ${check}${bban}`
}

const ascii = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .,\-/]/g, '')

/** Řetězec pro QR Platbu (SPAYD 1.0). */
export function spd(iban: string, amount: number, vs: string, msg: string): string {
  return `SPD*1.0*ACC:${iban}*AM:${amount.toFixed(2)}*CC:CZK*X-VS:${vs.replace(/\D/g, '').slice(0, 10)}*MSG:${ascii(msg).slice(0, 60)}`
}
