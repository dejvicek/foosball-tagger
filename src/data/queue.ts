// Pending write queue (SYN-1..4, ADR-0016).
//
// Every tagging write is recorded here first (localStorage), then sent. The UI
// updates optimistically; the queue retries with backoff and on the browser's
// `online` event, so no write is lost when the network drops.

export type QueueTable = 'games' | 'possessions'

/** Parents before children when inserting; the reverse when deleting. */
const RANK: Record<QueueTable, number> = { games: 0, possessions: 1 }

export type QueueRow = { id: string } & Record<string, unknown>

export type QueueOp = { kind: 'upsert'; row: QueueRow } | { kind: 'delete' }

export interface QueueEntry {
  table: QueueTable
  id: string
  op: QueueOp
  /** Order of the first change to this row. */
  seq: number
  /** Bumped on every change; a write only clears the entry if it is unchanged. */
  version: number
  /** False until a write of this row has been attempted; deleting an unattempted new row just drops it. */
  attempted: boolean
  /** Set when the server refused the write; the entry is no longer retried. */
  rejected?: string
}

export class WriteError extends Error {
  override name = 'WriteError'
  constructor(
    message: string,
    /** True when retrying cannot help (constraint violation, permission denied). */
    readonly permanent: boolean,
  ) {
    super(message)
  }
}

export interface QueueWriter {
  upsert(table: QueueTable, row: QueueRow): Promise<void>
  delete(table: QueueTable, id: string): Promise<void>
}

export interface QueueStorage {
  load(): QueueEntry[]
  save(entries: QueueEntry[]): void
}

export interface QueueStatus {
  pending: number
  rejected: QueueEntry[]
  flushing: boolean
}

export interface Timers {
  set(fn: () => void, ms: number): unknown
  clear(handle: unknown): void
}

const defaultTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
}

const MAX_BACKOFF_MS = 60_000

const key = (table: QueueTable, id: string) => `${table}:${id}`

export class WriteQueue {
  private entries = new Map<string, QueueEntry>()
  private seq = 0
  private listeners = new Set<() => void>()
  private flushing: Promise<void> | null = null
  private timer: unknown = null
  private failures = 0
  private status: QueueStatus = { pending: 0, rejected: [], flushing: false }

  constructor(
    private readonly writer: QueueWriter,
    private readonly storage: QueueStorage,
    private readonly timers: Timers = defaultTimers,
  ) {
    for (const e of storage.load()) {
      this.entries.set(key(e.table, e.id), e)
      this.seq = Math.max(this.seq, e.seq)
    }
    this.updateStatus()
  }

  /** Records an insert or update of a full row, then schedules a flush. */
  upsert(table: QueueTable, row: QueueRow, flushDelayMs = 0): void {
    const k = key(table, row.id)
    const prev = this.entries.get(k)
    this.entries.set(k, {
      table,
      id: row.id,
      op: { kind: 'upsert', row },
      seq: prev?.seq ?? ++this.seq,
      version: (prev?.version ?? 0) + 1,
      attempted: prev?.attempted ?? false,
    })
    this.changed(flushDelayMs)
  }

  /**
   * Records a delete. Queued writes of child rows (`cascade`) are dropped, as the
   * database cascade removes them. A new row that was never sent is simply forgotten.
   */
  remove(table: QueueTable, id: string, cascade: { table: QueueTable; fk: string }[] = []): void {
    const k = key(table, id)
    const prev = this.entries.get(k)
    for (const c of cascade) {
      for (const [ck, e] of this.entries) {
        if (e.table === c.table && e.op.kind === 'upsert' && e.op.row[c.fk] === id) this.entries.delete(ck)
      }
    }
    if (prev && prev.op.kind === 'upsert' && !prev.attempted) {
      this.entries.delete(k)
    } else {
      this.entries.set(k, {
        table,
        id,
        op: { kind: 'delete' },
        seq: prev?.seq ?? ++this.seq,
        version: (prev?.version ?? 0) + 1,
        attempted: prev?.attempted ?? false,
      })
    }
    this.changed(0)
  }

  /**
   * Applies pending writes on top of rows fetched from the server (SYN-4): fetched
   * data wins for anything not pending.
   */
  overlay<T extends { id: string }>(table: QueueTable, rows: T[], belongs: (row: QueueRow) => boolean): T[] {
    const byId = new Map(rows.map((r) => [r.id, r]))
    for (const e of this.entries.values()) {
      if (e.table !== table) continue
      if (e.op.kind === 'delete') byId.delete(e.id)
      else if (belongs(e.op.row)) byId.set(e.id, e.op.row as unknown as T)
    }
    return [...byId.values()]
  }

  /** Sends everything pending. Resolves when this attempt is over (success or not). */
  flush(): Promise<void> {
    if (this.flushing) return this.flushing
    if (this.timer !== null) {
      this.timers.clear(this.timer)
      this.timer = null
    }
    this.flushing = this.run().finally(() => {
      this.flushing = null
      this.updateStatus()
    })
    this.updateStatus()
    return this.flushing
  }

  /** Drops writes the server refused. */
  discardRejected(): void {
    for (const [k, e] of this.entries) if (e.rejected) this.entries.delete(k)
    this.changed(null)
  }

  getStatus(): QueueStatus {
    return this.status
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private async run(): Promise<void> {
    const live = [...this.entries.values()].filter((e) => !e.rejected)
    const upserts = live.filter((e) => e.op.kind === 'upsert').sort((a, b) => RANK[a.table] - RANK[b.table] || a.seq - b.seq)
    const deletes = live.filter((e) => e.op.kind === 'delete').sort((a, b) => RANK[b.table] - RANK[a.table] || a.seq - b.seq)

    for (const entry of [...upserts, ...deletes]) {
      const k = key(entry.table, entry.id)
      if (this.entries.get(k) !== entry) continue // changed meanwhile; the next flush sends the new version
      entry.attempted = true
      try {
        if (entry.op.kind === 'upsert') await this.writer.upsert(entry.table, entry.op.row)
        else await this.writer.delete(entry.table, entry.id)
        const now = this.entries.get(k)
        if (now && now.version === entry.version) this.entries.delete(k)
        this.failures = 0
      } catch (err) {
        if (err instanceof WriteError && err.permanent) {
          const now = this.entries.get(k)
          if (now && now.version === entry.version) now.rejected = err.message
          continue
        }
        this.failures++
        this.persist()
        this.schedule(Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (this.failures - 1)))
        return
      }
    }
    this.persist()
    // Changes made while flushing are sent right away.
    if ([...this.entries.values()].some((e) => !e.rejected && this.timer === null)) this.schedule(0)
  }

  private changed(flushDelayMs: number | null): void {
    this.persist()
    this.updateStatus()
    if (flushDelayMs !== null) this.schedule(flushDelayMs)
  }

  private schedule(ms: number): void {
    if (this.timer !== null) this.timers.clear(this.timer)
    this.timer = this.timers.set(() => {
      this.timer = null
      void this.flush()
    }, ms)
  }

  private persist(): void {
    this.storage.save([...this.entries.values()])
  }

  private updateStatus(): void {
    const all = [...this.entries.values()]
    const rejected = all.filter((e) => e.rejected)
    const next: QueueStatus = { pending: all.length - rejected.length, rejected, flushing: this.flushing !== null }
    const same =
      next.pending === this.status.pending &&
      next.flushing === this.status.flushing &&
      next.rejected.length === this.status.rejected.length &&
      next.rejected.every((e, i) => e === this.status.rejected[i])
    if (same) return
    this.status = next
    this.listeners.forEach((l) => l())
  }
}

/** localStorage-backed storage, namespaced per user. Falls back to memory if storage is unavailable. */
export function localQueueStorage(userId: string): QueueStorage {
  const storageKey = `fbtag:queue:v1:${userId}`
  let memory: QueueEntry[] = []
  return {
    load() {
      try {
        const raw = localStorage.getItem(storageKey)
        const parsed: unknown = raw ? JSON.parse(raw) : []
        return Array.isArray(parsed) ? (parsed as QueueEntry[]) : []
      } catch {
        return memory
      }
    },
    save(entries) {
      memory = entries
      try {
        if (entries.length === 0) localStorage.removeItem(storageKey)
        else localStorage.setItem(storageKey, JSON.stringify(entries))
      } catch (err) {
        console.warn('Could not store pending changes on this device', err)
      }
    },
  }
}
