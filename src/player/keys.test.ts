import { isShortcut, playerAction, type KeyLike } from './keys'

function key(k: string, target: Element | null = document.body, mods: Partial<KeyLike> = {}): KeyLike {
  return { key: k, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, target, ...mods }
}

describe('isShortcut', () => {
  it('ignores keys typed into fields (TAG-1)', () => {
    for (const tag of ['input', 'select', 'textarea']) {
      expect(isShortcut(key('b', document.createElement(tag)))).toBe(false)
    }
  })

  it('ignores Cmd, Ctrl and Alt combinations', () => {
    expect(isShortcut(key('c', document.body, { metaKey: true }))).toBe(false)
    expect(isShortcut(key('r', document.body, { ctrlKey: true }))).toBe(false)
  })

  it('lets a focused button handle Space and Enter, but not other keys', () => {
    const button = document.createElement('button')
    expect(isShortcut(key(' ', button))).toBe(false)
    expect(isShortcut(key('Enter', button))).toBe(false)
    expect(isShortcut(key('b', button))).toBe(true)
  })

  it('accepts keys on the page', () => {
    expect(isShortcut(key(' '))).toBe(true)
  })
})

describe('playerAction', () => {
  it.each([
    [' ', false, { kind: 'toggle' }],
    ['ArrowLeft', false, { kind: 'nudge', seconds: -1 }],
    ['ArrowLeft', true, { kind: 'nudge', seconds: -5 }],
    ['ArrowRight', false, { kind: 'nudge', seconds: 1 }],
    ['ArrowRight', true, { kind: 'nudge', seconds: 5 }],
    [',', false, { kind: 'frame', direction: -1 }],
    ['.', false, { kind: 'frame', direction: 1 }],
    ['<', true, { kind: 'frame', direction: -1 }],
    ['[', false, { kind: 'speed', direction: -1 }],
    [']', false, { kind: 'speed', direction: 1 }],
    ['x', false, null],
  ])('%j (shift %s)', (k, shiftKey, expected) => {
    expect(playerAction({ key: k, shiftKey })).toEqual(expected)
  })
})
