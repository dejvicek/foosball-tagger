import { useState } from 'react'
import { useQueue, useQueueStatus } from './QueueProvider'

/** "Unsynced changes: n" (SYN-2), plus writes the server refused, which are never dropped silently. */
export function SyncStatus() {
  const queue = useQueue()
  const { pending, rejected } = useQueueStatus()
  const [open, setOpen] = useState(false)

  return (
    <span className="sync" aria-live="polite">
      {pending > 0 && (
        <span className="sync-pending" title="Saved on this device; sending to the server when possible.">
          Unsynced changes: {pending}
        </span>
      )}
      {rejected.length > 0 && (
        <>
          <button className="btn danger" type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {rejected.length} change{rejected.length === 1 ? '' : 's'} refused
          </button>
          {open && (
            <div className="sync-panel card" role="region" aria-label="Refused changes">
              <p>The server refused these changes. They are kept on this device until you discard them.</p>
              <ul>
                {rejected.map((e) => (
                  <li key={`${e.table}:${e.id}`}>
                    {e.op.kind === 'delete' ? 'Delete' : 'Save'} {e.table === 'games' ? 'game' : 'possession'}: {e.rejected}
                  </li>
                ))}
              </ul>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  queue.discardRejected()
                  setOpen(false)
                }}
              >
                Discard refused changes
              </button>
            </div>
          )}
        </>
      )}
    </span>
  )
}
