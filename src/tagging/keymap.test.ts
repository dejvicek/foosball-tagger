import { TAG_GROUPS, tagAction } from './keymap'
import { playerAction } from '../player/keys'
import { HOLES, SETUPS } from '../data/types'

describe('tagAction (TAG-1)', () => {
  it.each([
    ['s', { kind: 'ballSet' }],
    ['F', { kind: 'shot' }],
    ['n', { kind: 'noShot' }],
    ['u', { kind: 'undo' }],
    ['Enter', { kind: 'save' }],
    ['Escape', { kind: 'clear' }],
    ['z', { kind: 'tag', field: 'setup', value: 'Pull side' }],
    ['x', { kind: 'tag', field: 'setup', value: 'Middle' }],
    ['c', { kind: 'tag', field: 'setup', value: 'Push side' }],
    ['1', { kind: 'tag', field: 'shot_type', value: 'Pin' }],
    ['3', { kind: 'tag', field: 'shot_type', value: 'Other' }],
    ['q', { kind: 'tag', field: 'direction', value: 'Pull' }],
    ['e', { kind: 'tag', field: 'direction', value: 'Straight' }],
    ['a', { kind: 'tag', field: 'hole', value: 'Pull-side lane' }],
    ['m', { kind: 'tag', field: 'hole', value: 'Middle lane' }],
    ['d', { kind: 'tag', field: 'hole', value: 'Push-side lane' }],
    ['g', { kind: 'tag', field: 'result', value: 'Goal' }],
    ['h', { kind: 'tag', field: 'result', value: 'No goal' }],
    ['j', { kind: 'tag', field: 'execution', value: 'Proper' }],
    ['k', { kind: 'tag', field: 'execution', value: 'Misexecuted' }],
    ['b', null],
    ['y', null],
  ])('%s', (key, action) => {
    expect(tagAction(key)).toEqual(action)
  })

  it('never collides with a player key', () => {
    for (const k of ['s', 'f', 'n', 'u', 'Enter', 'Escape', ...TAG_GROUPS.flatMap((g) => g.options.map((o) => o.key))]) {
      expect(playerAction({ key: k, shiftKey: false })).toBeNull()
    }
  })

  it('uses exactly the category values of the schema', () => {
    expect(TAG_GROUPS.find((g) => g.field === 'setup')?.options.map((o) => o.value).sort()).toEqual([...SETUPS].sort())
    expect(TAG_GROUPS.find((g) => g.field === 'hole')?.options.map((o) => o.value).sort()).toEqual([...HOLES].sort())
  })
})
