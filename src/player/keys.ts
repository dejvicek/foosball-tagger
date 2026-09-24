import { codeOf } from './keyboardLayout'

export interface KeyLike {
  key: string
  /** Physical key (KeyboardEvent.code); shortcuts match by position (ADR-0022). */
  code?: string
  shiftKey: boolean
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  target: EventTarget | null
}

/**
 * Whether a key press may be treated as a shortcut (TAG-1): not while typing in a
 * field, not with Cmd/Ctrl/Alt, and not Space/Enter on a focused button (keyboard
 * users activating it).
 */
export function isShortcut(e: KeyLike): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return false
  const el = e.target instanceof Element ? e.target : null
  if (el?.closest('input, select, textarea, [contenteditable="true"]')) return false
  if (el?.closest('button, a[href]') && (e.key === ' ' || e.key === 'Enter')) return false
  return true
}

export type PlayerAction =
  | { kind: 'toggle' }
  | { kind: 'nudge'; seconds: number }
  | { kind: 'frame'; direction: 1 | -1 }
  | { kind: 'speed'; direction: 1 | -1 }

/**
 * Player keys shared by the video and tagging screens (TAG-1, ADR-0021). Besides
 * Space and the arrows, the right hand has video-editor keys: J / K / L for back,
 * play/pause, forward and U / O for frame steps. Matched by key position (ADR-0022).
 */
export function playerAction(e: Pick<KeyLike, 'key' | 'shiftKey' | 'code'>): PlayerAction | null {
  switch (e.key) {
    case ' ':
      return { kind: 'toggle' }
    case 'ArrowLeft':
      return { kind: 'nudge', seconds: e.shiftKey ? -5 : -1 }
    case 'ArrowRight':
      return { kind: 'nudge', seconds: e.shiftKey ? 5 : 1 }
  }
  switch (codeOf(e)) {
    case 'KeyK':
      return { kind: 'toggle' }
    case 'KeyJ':
      return { kind: 'nudge', seconds: e.shiftKey ? -5 : -1 }
    case 'KeyL':
      return { kind: 'nudge', seconds: e.shiftKey ? 5 : 1 }
    case 'Comma':
    case 'KeyU':
      return { kind: 'frame', direction: -1 }
    case 'Period':
    case 'KeyO':
      return { kind: 'frame', direction: 1 }
    case 'BracketLeft':
      return { kind: 'speed', direction: -1 }
    case 'BracketRight':
      return { kind: 'speed', direction: 1 }
    default:
      return null
  }
}
