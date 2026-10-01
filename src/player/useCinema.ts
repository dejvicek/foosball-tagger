import { useSyncExternalStore } from 'react'

// Cinema mode (ADR-0023): the player takes the full width and the side panel moves
// below it. A per-viewer preference shared by the video and tagging screens, so localStorage.
const KEY = 'fbtag:cinema:v1'
const listeners = new Set<() => void>()

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

let current = read()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setCinema(on: boolean): void {
  current = on
  try {
    if (on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    // Storage unavailable (private mode): the choice lasts until reload.
  }
  for (const l of listeners) l()
}

export function useCinema(): boolean {
  return useSyncExternalStore(subscribe, () => current)
}
