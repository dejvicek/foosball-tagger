import { tagAction, tagGroups } from './keymap'
import { playerAction } from '../player/keys'
import { EXECUTIONS, HOLES, RESULTS, SETUPS, SHOT_DIRECTIONS, SHOT_TYPES } from '../data/types'

describe('tagAction (ADR-0026)', () => {
  it.each([
    ['r', { kind: 'ballSet' }],
    ['F', { kind: 'shot' }],
    ['v', { kind: 'noShot' }],
    ['Enter', { kind: 'save' }],
    ['Escape', { kind: 'clear' }],
    ['Backspace', { kind: 'clear' }],
    ['1', { kind: 'tag', field: 'hole', value: 'Pull long' }],
    ['2', { kind: 'tag', field: 'hole', value: 'Pull short' }],
    ['3', { kind: 'tag', field: 'hole', value: 'Middle' }],
    ['4', { kind: 'tag', field: 'hole', value: 'Push short' }],
    ['5', { kind: 'tag', field: 'hole', value: 'Push long' }],
    ['q', { kind: 'tag', field: 'shot_type', value: 'Pin' }],
    ['w', { kind: 'tag', field: 'shot_type', value: 'Pull' }],
    ['e', { kind: 'tag', field: 'shot_type', value: 'Other' }],
    ['a', { kind: 'tag', field: 'setup', value: 'Pull side' }],
    ['s', { kind: 'tag', field: 'setup', value: 'Middle' }],
    ['d', { kind: 'tag', field: 'setup', value: 'Push side' }],
    ['z', { kind: 'tag', field: 'execution', value: 'Proper' }],
    ['x', { kind: 'tag', field: 'execution', value: 'Misexecuted' }],
    ['g', { kind: 'tag', field: 'result', value: 'Goal' }],
    ['b', { kind: 'tag', field: 'result', value: 'No goal' }],
    ['c', { kind: 'toggleShotDirection' }],
    ['t', null],
    ['n', null],
    ['h', null],
  ])('%s', (key, action) => {
    expect(tagAction(key)).toEqual(action)
  })

  it('matches by key position on a Czech QWERTZ keyboard (ADR-0022)', () => {
    expect(tagAction({ key: 'y', code: 'KeyZ' })).toEqual({ kind: 'tag', field: 'execution', value: 'Proper' })
    expect(tagAction({ key: 'z', code: 'KeyY' })).toBeNull()
    expect(tagAction({ key: '+', code: 'Digit1' })).toEqual({ kind: 'tag', field: 'hole', value: 'Pull long' })
    expect(tagAction({ key: 'ř', code: 'Digit5' })).toEqual({ kind: 'tag', field: 'hole', value: 'Push long' })
  })

  it('reverses the hole and setup keys and buttons when I stand on the right (ADR-0031, ADR-0033)', () => {
    expect(tagAction('1', 'right')).toEqual({ kind: 'tag', field: 'hole', value: 'Push long' })
    expect(tagAction('2', 'right')).toEqual({ kind: 'tag', field: 'hole', value: 'Push short' })
    expect(tagAction('3', 'right')).toEqual({ kind: 'tag', field: 'hole', value: 'Middle' })
    expect(tagAction('5', 'right')).toEqual({ kind: 'tag', field: 'hole', value: 'Pull long' })
    expect(tagAction('a', 'right')).toEqual({ kind: 'tag', field: 'setup', value: 'Push side' })
    expect(tagAction('s', 'right')).toEqual({ kind: 'tag', field: 'setup', value: 'Middle' })
    expect(tagAction('d', 'right')).toEqual({ kind: 'tag', field: 'setup', value: 'Pull side' })
    expect(tagAction('q', 'right')).toEqual({ kind: 'tag', field: 'shot_type', value: 'Pin' })
    const holes = tagGroups('right').find((g) => g.field === 'hole')?.options
    expect(holes?.map((o) => [o.code, o.value])).toEqual([
      ['Digit1', 'Push long'],
      ['Digit2', 'Push short'],
      ['Digit3', 'Middle'],
      ['Digit4', 'Pull short'],
      ['Digit5', 'Pull long'],
    ])
  })

  it('ignores ⌘ / Ctrl chords, including ⌘Z (ADR-0033)', () => {
    expect(tagAction({ key: 'z', metaKey: true })).toBeNull()
    expect(tagAction({ key: 'z', ctrlKey: true })).toBeNull()
    expect(tagAction({ key: 'r', metaKey: true })).toBeNull()
  })

  it('puts every tagging key under the left hand', () => {
    const left = new Set('12345qwertasdfgzxcvb'.split(''))
    for (const g of tagGroups('left')) for (const o of g.options) expect(left.has(o.code.replace(/^(Key|Digit)/, '').toLowerCase())).toBe(true)
    for (const k of ['r', 'f', 'v']) expect(left.has(k)).toBe(true)
  })

  it('runs setup and hole pull → push from left to right', () => {
    const columns = (field: string) => tagGroups('left').find((g) => g.field === field)?.options.map((o) => o.value)
    expect(columns('setup')).toEqual(['Pull side', 'Middle', 'Push side'])
    expect(columns('hole')).toEqual(['Pull long', 'Pull short', 'Middle', 'Push short', 'Push long'])
  })

  it('lists the fields in tag panel order', () => {
    expect(tagGroups('left').map((g) => g.field)).toEqual(['shot_type', 'setup', 'hole', 'shot_direction', 'execution', 'result'])
  })

  it('never collides with a player key', () => {
    const keys = ['r', 'f', 'v', 'Enter', 'Escape', 'Backspace', ...tagGroups('left').flatMap((g) => g.options.map((o) => o.code.replace(/^(Key|Digit)/, '').toLowerCase()))]
    for (const k of keys) expect(playerAction({ key: k, shiftKey: false })).toBeNull()
  })

  it('uses exactly the category values of the schema', () => {
    const values = (field: string) => tagGroups('left').find((g) => g.field === field)?.options.map((o) => o.value).sort()
    expect(values('setup')).toEqual([...SETUPS].sort())
    expect(values('shot_type')).toEqual(SHOT_TYPES.filter((t) => t !== 'No shot').sort())
    expect(values('hole')).toEqual([...HOLES].sort())
    expect(values('shot_direction')).toEqual([...SHOT_DIRECTIONS].sort())
    expect(values('result')).toEqual([...RESULTS].sort())
    expect(values('execution')).toEqual([...EXECUTIONS].sort())
  })
})
