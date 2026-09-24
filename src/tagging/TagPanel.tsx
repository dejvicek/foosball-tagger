import { useEffect, useRef } from 'react'
import type { PlayerController } from '../player/controller'
import { formatTime } from '../player/time'
import { statusText, type Draft, type DraftEvent } from './draft'
import { TAG_GROUPS } from './keymap'
import { KEY } from './keyLabels'

interface Props {
  draft: Draft
  controller: PlayerController
  onEvent: (event: DraftEvent) => void
  onUndo: () => void
}

/** Large possession timer: live while running, frozen after F (TAG-3). */
function Timer({ draft, controller }: { draft: Draft; controller: PlayerController }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let frame = 0
    const render = () => {
      if (!ref.current) return
      const { start_s, shot_s } = draft
      const v = start_s == null ? null : (shot_s ?? controller.time()) - start_s
      ref.current.textContent = (v == null ? 0 : Math.max(0, v)).toFixed(1)
      ref.current.parentElement?.classList.toggle('idle', v == null)
    }
    const tick = () => {
      render()
      frame = requestAnimationFrame(tick)
    }
    if (draft.start_s != null && draft.shot_s == null) frame = requestAnimationFrame(tick)
    else render()
    return () => cancelAnimationFrame(frame)
  }, [draft, controller])

  return (
    <div className="big idle" aria-label="Possession length">
      <span ref={ref}>0.0</span>
      <small>s</small>
    </div>
  )
}

/** The tag panel (TAG-1..3). Every button is also a key; none takes focus. */
export function TagPanel({ draft, controller, onEvent, onUndo }: Props) {
  const noShot = draft.shot_type === 'No shot'
  return (
    <aside className="panel card" aria-label="Tag the possession">
      <div className="timer">
        <Timer draft={draft} controller={controller} />
        <div className="se">
          start {formatTime(draft.start_s)}
          <br />
          shot {formatTime(draft.shot_s)}
        </div>
        <p className="status" aria-live="polite">
          {statusText(draft)}
        </p>
      </div>
      <div className="markrow">
        <button className="btn nf" type="button" onClick={() => onEvent({ kind: 'ballSet' })}>
          Ball set <kbd>{KEY.ballSet}</kbd>
        </button>
        <button className="btn nf" type="button" onClick={() => onEvent({ kind: 'shot' })}>
          Shot <kbd>{KEY.shot}</kbd>
        </button>
        <button className="btn nf" type="button" onClick={() => onEvent({ kind: 'noShot' })} title="Possession ended without a shot">
          No shot <kbd>{KEY.noShot}</kbd>
        </button>
      </div>
      {TAG_GROUPS.map((g) => (
        <div className="group" key={g.field}>
          <h3 id={`grp-${g.field}`}>{g.label}</h3>
          <div className="seg-ctl" role="group" aria-labelledby={`grp-${g.field}`}>
            {g.options.map((o) => (
              <button
                key={o.key}
                type="button"
                className="opt nf"
                data-tone={o.negative ? 'neg' : undefined}
                aria-pressed={draft[g.field] === o.value}
                disabled={noShot && g.field !== 'shot_type' && g.field !== 'setup'}
                onClick={() => onEvent({ kind: 'tag', field: g.field, value: o.value } as DraftEvent)}
                title={o.value}
              >
                <span>{o.label}</span>
                <kbd>{o.key}</kbd>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="actions">
        <button className="btn primary nf" type="button" onClick={() => onEvent({ kind: 'save' })}>
          Save <kbd>{KEY.save}</kbd>
        </button>
        <button className="btn nf" type="button" onClick={() => onEvent({ kind: 'clear' })}>
          Clear <kbd>{KEY.clear}</kbd>
        </button>
        <button className="btn nf" type="button" onClick={onUndo} title="Delete the last possession saved on this page">
          Undo <kbd>{KEY.undo}</kbd>
        </button>
      </div>
    </aside>
  )
}
