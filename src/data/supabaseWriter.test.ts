import { isPermanent } from './supabaseWriter'

describe('isPermanent', () => {
  it.each(['23514', '23505', '23503', '22P02', '42501'])('gives up on %s', (code) => {
    expect(isPermanent(code)).toBe(true)
  })

  it.each([undefined, '', 'PGRST301', '08006', '57014'])('retries %s', (code) => {
    expect(isPermanent(code)).toBe(false)
  })
})
