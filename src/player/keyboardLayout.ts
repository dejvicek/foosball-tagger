// Physical key positions and the labels printed on the user's keyboard (ADR-0022).
//
// Shortcuts are matched by KeyboardEvent.code (the key's position), so the grid
// stays in place on QWERTZ (Czech, Slovak, German…), AZERTY or Dvorak, and the
// Czech number row (which types + ě š č ř) still works. Labels shown on buttons
// come from, in order: what the user actually pressed, the Keyboard Map API
// (Chromium), a guess from the browser language, then the US layout.

type Listener = () => void

/** US-layout character → code, for events without `code` (tests, synthetic events). */
const US_CODE: Record<string, string> = { ',': 'Comma', '<': 'Comma', '.': 'Period', '>': 'Period', '[': 'BracketLeft', ']': 'BracketRight' }

/** The physical key of an event; falls back to the US position of its character. */
export function codeOf(e: { key: string; code?: string }): string {
  if (e.code) return e.code
  const k = e.key
  if (k.length === 1) {
    if (/^[a-z]$/i.test(k)) return `Key${k.toUpperCase()}`
    if (/^[0-9]$/.test(k)) return `Digit${k}`
    return US_CODE[k] ?? ''
  }
  return ''
}

/** Label of a key on a US keyboard. */
function usLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  return { Comma: ',', Period: '.', BracketLeft: '[', BracketRight: ']' }[code] ?? code
}

/** Languages whose usual layout is QWERTZ (Y and Z swapped). */
const QWERTZ = /^(cs|sk|de|hu|sl|hr|bs|sr-latn|lb|rm)\b/i
/** Languages whose usual layout is AZERTY. */
const AZERTY = /^(fr|nl-be)\b/i

function guessFromLanguage(languages: readonly string[]): Map<string, string> {
  const lang = languages[0] ?? ''
  if (QWERTZ.test(lang)) {
    return new Map([
      ['KeyZ', 'Y'],
      ['KeyY', 'Z'],
    ])
  }
  if (AZERTY.test(lang)) {
    return new Map([
      ['KeyQ', 'A'],
      ['KeyA', 'Q'],
      ['KeyW', 'Z'],
      ['KeyZ', 'W'],
      ['KeyM', ','],
      ['Semicolon', 'M'],
    ])
  }
  return new Map()
}

export class KeyboardLayout {
  private guessed: Map<string, string>
  private reported = new Map<string, string>()
  private learned = new Map<string, string>()
  private listeners = new Set<Listener>()
  private version = 0

  constructor(languages: readonly string[] = []) {
    this.guessed = guessFromLanguage(languages)
  }

  /** The label printed on the key at `code`. Digits always show their digit (it is printed on every layout). */
  label(code: string): string {
    if (code.startsWith('Digit')) return code.slice(5)
    return this.learned.get(code) ?? this.reported.get(code) ?? this.guessed.get(code) ?? usLabel(code)
  }

  /** Feed every key press here: the character it produced is the most reliable label. */
  learn(e: { key: string; code?: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }): void {
    if (e.altKey || e.ctrlKey || e.metaKey) return // AltGr and shortcuts type other characters
    if (!e.code || e.key.length !== 1 || e.code.startsWith('Digit')) return
    if (!/^\p{L}$/u.test(e.key) && !e.code.startsWith('Key')) return
    const label = e.key.toUpperCase()
    if (this.learned.get(e.code) === label) return
    this.learned.set(e.code, label)
    this.changed()
  }

  /** Labels from navigator.keyboard.getLayoutMap(), where available (Chromium). */
  report(map: Iterable<[string, string]>): void {
    for (const [code, key] of map) if (key.length === 1) this.reported.set(code, key.toUpperCase())
    this.changed()
  }

  /** Changes whenever a label may have changed (for useSyncExternalStore). */
  getVersion = (): number => this.version

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  private changed(): void {
    this.version++
    this.listeners.forEach((l) => l())
  }
}

interface NavigatorKeyboard {
  keyboard?: { getLayoutMap?: () => Promise<Iterable<[string, string]>> }
}

const nav = typeof navigator !== 'undefined' ? navigator : undefined

/** The app-wide layout. */
export const keyboardLayout = new KeyboardLayout(nav?.languages?.length ? nav.languages : nav?.language ? [nav.language] : [])

let started = false

/** Asks the browser for the layout and learns from every key press. Call once. */
export function startKeyboardLayout(): void {
  if (started || typeof window === 'undefined') return
  started = true
  const keyboard = (nav as NavigatorKeyboard | undefined)?.keyboard
  keyboard
    ?.getLayoutMap?.()
    .then((map) => keyboardLayout.report(map))
    .catch(() => {})
  window.addEventListener('keydown', (e) => keyboardLayout.learn(e), true)
}

/** Label of a key position, e.g. keyLabel('KeyZ') → 'Y' on a Czech keyboard. */
export const keyLabel = (code: string): string => keyboardLayout.label(code)
