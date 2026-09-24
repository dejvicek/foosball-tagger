// Keys named in messages and on buttons, so text never drifts from the key map (ADR-0021).

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

export const KEY = {
  ballSet: 'R',
  shot: 'F',
  noShot: 'V',
  save: '4',
  clear: 'Esc',
  undo: isMac ? '⌘Z' : 'Ctrl+Z',
} as const
