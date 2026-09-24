import { emptyDraft, type Draft } from './draft'

// The unsaved draft survives a reload or a closed tab (ADR-0019). Per-viewer, so localStorage.
const key = (gameId: string) => `fbtag:draft:v1:${gameId}`

export function loadDraft(gameId: string): Draft {
  try {
    const raw = localStorage.getItem(key(gameId))
    if (!raw) return emptyDraft()
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return emptyDraft()
    return { ...emptyDraft(), ...(parsed as Partial<Draft>) }
  } catch {
    return emptyDraft()
  }
}

export function storeDraft(gameId: string, draft: Draft): void {
  try {
    const d = emptyDraft()
    const isEmpty = (Object.keys(d) as (keyof Draft)[]).every((k) => draft[k] === d[k])
    if (isEmpty) localStorage.removeItem(key(gameId))
    else localStorage.setItem(key(gameId), JSON.stringify(draft))
  } catch {
    // Storage unavailable (private mode): the draft just isn't kept across reloads.
  }
}
