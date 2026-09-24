import { emptyDraft, reduce, statusText, type Draft, type DraftContext, type DraftEvent } from './draft'

const ctx = (t: number, extra: Partial<DraftContext> = {}): DraftContext => ({
  t,
  range: { start: 60, end: 300 },
  gameLabel: 'Game 2',
  ...extra,
})

/** Runs events at the given times; returns the final draft and everything saved. */
function run(steps: [DraftEvent, number][], from: Draft = emptyDraft()) {
  let draft = from
  const saved: Draft[] = []
  const errors: string[] = []
  for (const [event, t] of steps) {
    const out = reduce(draft, event, ctx(t))
    draft = out.draft
    if (out.save) saved.push(out.save)
    if (out.error) errors.push(out.error)
  }
  return { draft, saved, errors }
}

const S = { kind: 'ballSet' } as const
const F = { kind: 'shot' } as const
const N = { kind: 'noShot' } as const
const ENTER = { kind: 'save' } as const
const ESC = { kind: 'clear' } as const

describe('draft state machine', () => {
  it('S, tags, F, Enter saves one possession; Setup resets to Middle (TAG-1, TAG-2)', () => {
    const { draft, saved } = run([
      [S, 70],
      [{ kind: 'tag', field: 'setup', value: 'Pull side' }, 71],
      [{ kind: 'tag', field: 'shot_type', value: 'Pull' }, 72],
      [F, 75.5],
      [{ kind: 'tag', field: 'result', value: 'Goal' }, 76],
      [ENTER, 76],
    ])
    expect(saved).toEqual([
      { start_s: 70, shot_s: 75.5, setup: 'Pull side', shot_type: 'Pull', direction: null, hole: null, result: 'Goal', execution: null },
    ])
    expect(draft).toEqual(emptyDraft())
    expect(draft.setup).toBe('Middle')
  })

  it('S after F saves the tagged possession and starts the next one', () => {
    const { draft, saved } = run([
      [S, 70],
      [F, 80],
      [S, 90],
    ])
    expect(saved).toEqual([expect.objectContaining({ start_s: 70, shot_s: 80 })])
    expect(draft).toEqual({ ...emptyDraft(), start_s: 90 })
  })

  it('S again before F moves the start and keeps the tags', () => {
    const { draft, saved } = run([
      [S, 70],
      [{ kind: 'tag', field: 'setup', value: 'Push side' }, 71],
      [S, 73],
    ])
    expect(saved).toEqual([])
    expect(draft).toMatchObject({ start_s: 73, setup: 'Push side' })
  })

  it('N saves at once as No shot with the shot fields blank', () => {
    const { draft, saved } = run([
      [S, 70],
      [{ kind: 'tag', field: 'direction', value: 'Push' }, 71],
      [N, 78],
    ])
    expect(saved).toEqual([expect.objectContaining({ start_s: 70, shot_s: 78, shot_type: 'No shot', direction: null, hole: null })])
    expect(draft).toEqual(emptyDraft())
  })

  it('refuses F before the start, without swapping (TAG-4)', () => {
    const { draft, errors } = run([
      [S, 100],
      [F, 95],
    ])
    expect(errors[0]).toMatch(/can’t be before the start \(1:40.0\)/)
    expect(draft).toMatchObject({ start_s: 100, shot_s: null })
  })

  it('refuses times outside the game and suggests adjusting it (TAG-5)', () => {
    const { draft, errors } = run([
      [S, 30],
      [S, 70],
      [F, 301],
    ])
    expect(errors).toHaveLength(2)
    expect(errors[0]).toMatch(/0:30.0 is outside Game 2 \(1:00.0–5:00.0\).*adjust the game/)
    expect(draft).toMatchObject({ start_s: 70, shot_s: null })
  })

  it('accepts a press right at the game boundary', () => {
    expect(run([[S, 59.98]]).errors).toEqual([])
  })

  it('pressing a tag key again clears the field, including Setup (TAG-1, ADR-0002)', () => {
    const { draft } = run([
      [{ kind: 'tag', field: 'hole', value: 'Middle lane' }, 70],
      [{ kind: 'tag', field: 'hole', value: 'Middle lane' }, 70],
      [{ kind: 'tag', field: 'setup', value: 'Middle' }, 70],
    ])
    expect(draft.hole).toBeNull()
    expect(draft.setup).toBeNull()
  })

  it('switches a field to another value with its other key', () => {
    const { draft } = run([
      [{ kind: 'tag', field: 'result', value: 'Goal' }, 70],
      [{ kind: 'tag', field: 'result', value: 'No goal' }, 70],
    ])
    expect(draft.result).toBe('No goal')
  })

  it('Enter saves with missing fields left blank, but refuses an empty draft', () => {
    expect(run([[ENTER, 70]]).errors[0]).toMatch(/Nothing to save/)
    expect(run([[S, 70], [ENTER, 71]]).saved).toEqual([expect.objectContaining({ start_s: 70, shot_s: null, result: null })])
  })

  it('Esc clears the draft', () => {
    expect(run([[S, 70], [F, 75], [ESC, 76]]).draft).toEqual(emptyDraft())
  })
})

describe('statusText (TAG-3)', () => {
  it('guides through the steps', () => {
    expect(statusText(emptyDraft())).toBe('Press S when the ball is set.')
    expect(statusText({ ...emptyDraft(), start_s: 1 })).toMatch(/Press F at the shot/)
    expect(statusText({ ...emptyDraft(), start_s: 1, shot_s: 2, shot_type: 'Pin' })).toBe(
      'Tag the shot, then press Enter. Still blank: direction, hole, result, execution.',
    )
    expect(
      statusText({ start_s: 1, shot_s: 2, setup: 'Middle', shot_type: 'Pin', direction: 'Pull', hole: 'Middle lane', result: 'Goal', execution: 'Proper' }),
    ).toMatch(/All tagged/)
  })
})
