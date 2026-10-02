import { useEffect, useMemo, useRef, useState } from 'react'
import type { ScopeData } from '../data/stats'
import { exportCsv, exportRows } from '../export'
import { plural } from '../videos/format'

interface Props {
  data: ScopeData
  /** The possessions the statistics filters pass (ADR-0035). */
  keep: (possessionId: string) => boolean
  fileName: string
}

/** Copy or download the scope as CSV (EXP-1..3). */
export function ExportCard({ data, keep, fileName }: Props) {
  const [includeUnreviewed, setIncludeUnreviewed] = useState(false)
  // Tied to the CSV it was about, so changing scope, filters or the checkbox clears it.
  const [shown, setShown] = useState<{ csv: string; text: string; tone: 'info' | 'error'; fallback: boolean } | null>(null)
  const area = useRef<HTMLTextAreaElement>(null)

  const rows = useMemo(() => exportRows(data, { includeUnreviewed, keep }), [data, includeUnreviewed, keep])
  const csv = useMemo(() => exportCsv(rows), [rows])

  const status = shown?.csv === csv ? shown : null
  const fallback = status?.fallback ?? false

  useEffect(() => {
    if (fallback) area.current?.select()
  }, [fallback])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(csv)
      setShown({ csv, text: `Copied ${plural(rows.length, 'possession')}.`, tone: 'info', fallback: false })
    } catch {
      // EXP-2: the clipboard API is missing or blocked; let the user copy by hand.
      setShown({ csv, text: 'The browser blocked the clipboard. The CSV is selected below: press ⌘C / Ctrl+C.', tone: 'error', fallback: true })
    }
  }

  const download = () => {
    // The BOM lets Excel read the file as UTF-8 (names with accents).
    const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
    setShown({ csv, text: `Downloaded ${fileName}.`, tone: 'info', fallback: false })
  }

  return (
    <section className="card export-card" aria-labelledby="export-heading">
      <h3 id="export-heading">Export CSV</h3>
      <div className="control">
        <label className="chip">
          <input type="checkbox" checked={includeUnreviewed} onChange={(e) => setIncludeUnreviewed(e.target.checked)} /> Include unreviewed
          candidates
        </label>
        <span className="muted">{plural(rows.length, 'possession')}</span>
        <button className="btn" type="button" onClick={() => void copy()}>
          Copy CSV
        </button>
        <button className="btn" type="button" onClick={download}>
          Download CSV
        </button>
        <p className="hint muted">Same scope and filters as the statistics above. Rejected candidates are never exported.</p>
      </div>
      {status && (
        <p className={status.tone === 'error' ? 'error' : 'muted'} role={status.tone === 'error' ? 'alert' : 'status'}>
          {status.text}
        </p>
      )}
      {fallback && <textarea ref={area} className="export-text" readOnly value={csv} aria-label="CSV" rows={8} onFocus={(e) => e.target.select()} />}
    </section>
  )
}
