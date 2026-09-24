import { TAG_GROUPS, tagAction } from './keymap'
import { playerAction } from '../player/keys'
import { DIRECTIONS, EXECUTIONS, HOLES, RESULTS, SETUPS } from '../data/types'

describe('tagAction (ADR-0021)', () => {
  it.each([
    ['r', { kind: 'ballSet' }],
    ['F', { kind: 'shot' }],
    ['v', { kind: 'noShot' }],
    ['4', { kind: 'save' }],
    ['Enter', { kind: 'save' }],
    ['Escape', { kind: 'clear' }],
    ['Backspace', { kind: 'undo' }],
    ['1', { kind: 'tag', field: 'setup', value: 'Pull side' }],
    ['2', { kind: 'tag', field: 'setup', value: 'Middle' }],
    ['3', { kind: 'tag', field: 'setup', value: 'Push side' }],
    ['q', { kind: 'tag', field: 'direction', value: 'Pull' }],
    ['w', { kind: 'tag', field: 'direction', value: 'Straight' }],
    ['e', { kind: 'tag', field: 'direction', value: 'Push' }],
    ['a', { kind: 'tag', field: 'hole', value: 'Pull-side lane' }],
    ['s', { kind: 'tag', field: 'hole', value: 'Middle lane' }],
    ['d', { kind: 'tag', field: 'hole', value: 'Push-side lane' }],
    ['z', { kind: 'tag', field: 'shot_type', value: 'Pin' }],
    ['x', { kind: 'tag', field: 'shot_type', value: 'Pull' }],
    ['c', { kind: 'tag', field: 'shot_type', value: 'Other' }],
    ['5', { kind: 'tag', field: 'execution', value: 'Proper' }],
    ['t', { kind: 'tag', field: 'execution', value: 'Misexecuted' }],
    ['g', { kind: 'tag', field: 'result', value: 'Goal' }],
    ['b', { kind: 'tag', field: 'result', value: 'No goal' }],
    ['n', null],
    ['h', null],
  ])('%s', (key, action) => {
    expect(tagAction(key)).toEqual(action)
  })

  it('matches by key position on a Czech QWERTZ keyboard (ADR-0022)', () => {
    expect(tagAction({ key: 'y', code: 'KeyZ' })).toEqual({ kind: 'tag', field: 'shot_type', value: 'Pin' })
    expect(tagAction({ key: 'z', code: 'KeyY' })).toBeNull()
    expect(tagAction({ key: '+', code: 'Digit1' })).toEqual({ kind: 'tag', field: 'setup', value: 'Pull side' })
    expect(tagAction({ key: 'č', code: 'Digit4' })).toEqual({ kind: 'save' })
    expect(tagAction({ key: 'ř', code: 'Digit5' })).toEqual({ kind: 'tag', field: 'execution', value: 'Proper' })
    // Undo follows the letter, like the operating system: Czech ⌘Z is the key labelled Z.
    expect(tagAction({ key: 'z', code: 'KeyY', metaKey: true })).toEqual({ kind: 'undo' })
  })

  it('undoes with ⌘Z or Ctrl+Z, and ignores other chords', () => {
    expect(tagAction({ key: 'z', metaKey: true })).toEqual({ kind: 'undo' })
    expect(tagAction({ key: 'z', ctrlKey: true })).toEqual({ kind: 'undo' })
    expect(tagAction({ key: 'z', metaKey: true, shiftKey: true })).toBeNull()
    expect(tagAction({ key: 'r', metaKey: true })).toBeNull()
  })

  it('puts every tagging key under the left hand', () => {
    const left = new Set('12345qwertasdfgzxcvb'.split(''))
    for (const g of TAG_GROUPS) for (const o of g.options) expect(left.has(o.code.replace(/^(Key|Digit)/, '').toLowerCase())).toBe(true)
    for (const k of ['r', 'f', 'v', '4']) expect(left.has(k)).toBe(true)
  })

  it('runs the three-way fields pull → middle → push on the same columns', () => {
    const columns = (field: string) => TAG_GROUPS.find((g) => g.field === field)?.options.map((o) => o.value)
    expect(columns('setup')).toEqual(['Pull side', 'Middle', 'Push side'])
    expect(columns('direction')).toEqual(['Pull', 'Straight', 'Push'])
    expect(columns('hole')).toEqual(['Pull-side lane', 'Middle lane', 'Push-side lane'])
  })

  it('never collides with a player key', () => {
    const keys = ['r', 'f', 'v', '4', 'Enter', 'Escape', 'Backspace', ...TAG_GROUPS.flatMap((g) => g.options.map((o) => o.code.replace(/^(Key|Digit)/, '').toLowerCase()))]
    for (const k of keys) expect(playerAction({ key: k, shiftKey: false })).toBeNull()
  })

  it('uses exactly the category values of the schema', () => {
    const values = (field: string) => TAG_GROUPS.find((g) => g.field === field)?.options.map((o) => o.value).sort()
    expect(values('setup')).toEqual([...SETUPS].sort())
    expect(values('direction')).toEqual([...DIRECTIONS].sort())
    expect(values('hole')).toEqual([...HOLES].sort())
    expect(values('result')).toEqual([...RESULTS].sort())
    expect(values('execution')).toEqual([...EXECUTIONS].sort())
  })
})
