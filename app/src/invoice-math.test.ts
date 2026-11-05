import { describe, expect, it } from 'vitest'
import { lineGross, nextNumber, totals } from './invoice-math'
import { czIban, spd } from './iban'

describe('invoice-math', () => {
  it('počítá řádek s DPH jako databáze', () => { expect(lineGross({ qty: 3, unit_price: 99.99, vat_rate: 21 })).toBe(362.96) })
  it('sčítá doklad', () => { expect(totals([{ description: 'a', qty: 2, unit: 'ks', unit_price: 100, vat_rate: 21 }, { description: 'b', qty: 1, unit: 'h', unit_price: 50, vat_rate: 12 }])).toEqual({ net: 250, vat: 48, gross: 298 }) })
  it('další číslo', () => {
    expect(nextNumber([], 2026)).toBe('20260001')
    expect(nextNumber(['20260007', '20250099', null, 'x'], 2026)).toBe('20260008')
  })
})
describe('iban', () => {
  it('převede číslo účtu', () => { expect(czIban('19-2000145399/0800')).toBe('CZ6508000000192000145399') })
  it('přijme IBAN a odmítne nesmysl', () => { expect(czIban('CZ65 0800 0000 1920 0014 5399')).toBe('CZ6508000000192000145399'); expect(czIban('abc')).toBeNull() })
  it('QR platba', () => { expect(spd('CZ6508000000192000145399', 1210, '20260001', 'Faktura č. 20260001 – příliš')).toBe('SPD*1.0*ACC:CZ6508000000192000145399*AM:1210.00*CC:CZK*X-VS:20260001*MSG:Faktura c. 20260001  prilis') })
})
