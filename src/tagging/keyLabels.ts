// Keys named in messages and on buttons, so text never drifts from the key map
// (ADR-0021). Letter labels follow the user's keyboard layout (ADR-0022).
import { keyLabel } from '../player/keyboardLayout'
import { ACTION_CODE } from './keymap'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

export const KEY = {
  get ballSet() {
    return keyLabel(ACTION_CODE.ballSet)
  },
  get shot() {
    return keyLabel(ACTION_CODE.shot)
  },
  get noShot() {
    return keyLabel(ACTION_CODE.noShot)
  },
  get save() {
    return keyLabel(ACTION_CODE.save)
  },
  clear: 'Esc',
  undo: isMac ? '⌘Z' : 'Ctrl+Z',
}
