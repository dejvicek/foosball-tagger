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

/**
 * Player keys shared by the video and tagging screens (TAG-1, ADR-0021). Besides
 * Space and the arrows, the right hand has video-editor keys: J / K / L for back,
 * play/pause, forward and U / O for frame steps.
 */
export function playerAction(e: Pick<KeyLike, 'key' | 'shiftKey'>): PlayerAction | null {
  switch (e.key.length === 1 ? e.key.toLowerCase() : e.key) {
    case ' ':
    case 'k':
      return { kind: 'toggle' }
    case 'ArrowLeft':
    case 'j':
      return { kind: 'nudge', seconds: e.shiftKey ? -5 : -1 }
    case 'ArrowRight':
    case 'l':
      return { kind: 'nudge', seconds: e.shiftKey ? 5 : 1 }
    case ',':
    case '<':
    case 'u':
      return { kind: 'frame', direction: -1 }
    case '.':
    case '>':
    case 'o':
      return { kind: 'frame', direction: 1 }
    case '[':
      return { kind: 'speed', direction: -1 }
    case ']':
      return { kind: 'speed', direction: 1 }
    default:
      return null
  }
}
