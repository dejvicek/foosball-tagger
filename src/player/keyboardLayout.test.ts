import { KeyboardLayout, codeOf } from './keyboardLayout'

describe('codeOf', () => {
  it('prefers the physical key', () => {
    expect(codeOf({ key: 'y', code: 'KeyZ' })).toBe('KeyZ') // Czech: the bottom-left letter types y
    expect(codeOf({ key: '+', code: 'Digit1' })).toBe('Digit1') // Czech number row
  })

  it('falls back to the US position of the character', () => {
    expect(codeOf({ key: 'r' })).toBe('KeyR')
    expect(codeOf({ key: '4' })).toBe('Digit4')
    expect(codeOf({ key: '[' })).toBe('BracketLeft')
    expect(codeOf({ key: 'Enter' })).toBe('')
  })
})

describe('KeyboardLayout labels', () => {
  it('uses US labels by default', () => {
    const l = new KeyboardLayout(['en-US'])
    expect(l.label('KeyZ')).toBe('Z')
    expect(l.label('Digit1')).toBe('1')
    expect(l.label('Comma')).toBe(',')
  })

  it('guesses QWERTZ for Czech and Slovak', () => {
    for (const lang of ['cs-CZ', 'sk', 'de-AT']) {
      const l = new KeyboardLayout([lang])
      expect(l.label('KeyZ')).toBe('Y')
      expect(l.label('KeyY')).toBe('Z')
      expect(l.label('KeyR')).toBe('R')
    }
  })

  it('keeps digits on the number row whatever the layout types there', () => {
    const l = new KeyboardLayout(['cs'])
    l.report([['Digit1', '+']])
    l.learn({ key: 'ě', code: 'Digit2' })
    expect(l.label('Digit1')).toBe('1')
    expect(l.label('Digit2')).toBe('2')
  })

  it('prefers the browser-reported layout over the guess, and what was pressed over both', () => {
    const l = new KeyboardLayout(['cs'])
    l.report([['KeyZ', 'z']]) // e.g. a Czech user on a QWERTY layout
    expect(l.label('KeyZ')).toBe('Z')
    l.learn({ key: 'y', code: 'KeyZ' })
    expect(l.label('KeyZ')).toBe('Y')
  })

  it('learns from presses and notifies', () => {
    const l = new KeyboardLayout(['en'])
    const seen: number[] = []
    l.subscribe(() => seen.push(l.getVersion()))
    l.learn({ key: 'y', code: 'KeyZ' })
    l.learn({ key: 'y', code: 'KeyZ' }) // no change, no notification
    l.learn({ key: 'Shift', code: 'ShiftLeft' }) // ignored
    expect(l.label('KeyZ')).toBe('Y')
    expect(seen).toHaveLength(1)
  })
})
