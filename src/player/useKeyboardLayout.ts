import { useSyncExternalStore } from 'react'
import { keyboardLayout } from './keyboardLayout'

/** Re-renders when a key label changes (the layout was reported or learned). */
export function useKeyboardLayout(): number {
  return useSyncExternalStore(keyboardLayout.subscribe, keyboardLayout.getVersion)
}
