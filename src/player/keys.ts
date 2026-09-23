export interface KeyLike {
  key: string
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

/** Player keys shared by the video and tagging screens (TAG-1). */
export function playerAction(e: Pick<KeyLike, 'key' | 'shiftKey'>): PlayerAction | null {
  switch (e.key) {
    case ' ':
      return { kind: 'toggle' }
    case 'ArrowLeft':
      return { kind: 'nudge', seconds: e.shiftKey ? -5 : -1 }
    case 'ArrowRight':
      return { kind: 'nudge', seconds: e.shiftKey ? 5 : 1 }
    case ',':
    case '<':
      return { kind: 'frame', direction: -1 }
    case '.':
    case '>':
      return { kind: 'frame', direction: 1 }
    case '[':
      return { kind: 'speed', direction: -1 }
    case ']':
      return { kind: 'speed', direction: 1 }
    default:
      return null
  }
}
