// Keys named in messages and on buttons, so text never drifts from the key map
// (ADR-0021, ADR-0026). Letter labels follow the user's keyboard layout (ADR-0022).
import { keyLabel } from '../player/keyboardLayout'
import { ACTION_CODE } from './keymap'

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
  save: 'Enter',
  clear: '⌫',
}
