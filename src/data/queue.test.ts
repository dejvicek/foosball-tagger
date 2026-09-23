import { WriteError, WriteQueue, type QueueEntry, type QueueRow, type QueueStorage, type QueueTable, type Timers } from './queue'

class FakeWriter {
  calls: string[] = []
  server = new Map<string, QueueRow>()
  failNext: (Error | null)[] = []
  offline = false

  async upsert(table: QueueTable, row: QueueRow) {
    this.calls.push(`upsert ${table} ${row.id}`)
    this.check()
    this.server.set(`${table}:${row.id}`, row)
  }

  async delete(table: QueueTable, id: string) {
    this.calls.push(`delete ${table} ${id}`)
    this.check()
    this.server.delete(`${table}:${id}`)
  }

  private check() {
    if (this.offline) throw new TypeError('Failed to fetch')
    const err = this.failNext.shift()
    if (err) throw err
  }
}

class MemoryStorage implements QueueStorage {
  saved: QueueEntry[] = []
  constructor(initial: QueueEntry[] = []) {
    this.saved = initial
  }
  load() {
    return structuredClone(this.saved)
  }
  save(entries: QueueEntry[]) {
    this.saved = structuredClone(entries)
  }
}

/** Timers that only run when told to. */
class ManualTimers implements Timers {
  pending = new Map<number, { fn: () => void; ms: number }>()
  private next = 1
  set(fn: () => void, ms: number) {
    const h = this.next++
    this.pending.set(h, { fn, ms })
    return h
  }
  clear(h: unknown) {
    this.pending.delete(h as number)
  }
  delays() {
    return [...this.pending.values()].map((t) => t.ms)
  }
  runAll() {
    const all = [...this.pending.values()]
    this.pending.clear()
    all.forEach((t) => t.fn())
  }
}

function setup(initial: QueueEntry[] = []) {
  const writer = new FakeWriter()
  const storage = new MemoryStorage(initial)
  const timers = new ManualTimers()
  const queue = new WriteQueue(writer, storage, timers)
  return { writer, storage, timers, queue }
}

const game = (id: string, extra: Record<string, unknown> = {}): QueueRow => ({ id, video_id: 'v1', start_s: 10, ...extra })
const poss = (id: string, gameId: string): QueueRow => ({ id, game_id: gameId, start_s: 12 })

describe('WriteQueue', () => {
  it('stores a write before sending it, and clears it once sent', async () => {
    const { queue, storage, writer } = setup()
    queue.upsert('games', game('g1'))
    expect(storage.saved).toHaveLength(1)
    expect(queue.getStatus().pending).toBe(1)
    await queue.flush()
    expect(writer.server.has('games:g1')).toBe(true)
    expect(storage.saved).toHaveLength(0)
    expect(queue.getStatus().pending).toBe(0)
  })

  it('keeps writes while offline and retries with growing backoff (SYN-2)', async () => {
    const { queue, writer, timers, storage } = setup()
    writer.offline = true
    queue.upsert('games', game('g1'))
    await queue.flush()
    expect(queue.getStatus().pending).toBe(1)
    expect(timers.delays()).toEqual([1000])
    await queue.flush()
    expect(timers.delays()).toEqual([2000])
    await queue.flush()
    expect(timers.delays()).toEqual([4000])
    expect(storage.saved).toHaveLength(1)

    writer.offline = false
    await queue.flush()
    expect(queue.getStatus().pending).toBe(0)
    expect(writer.server.has('games:g1')).toBe(true)
  })

  it('replays entries left in storage by an earlier page load (SYN-4)', async () => {
    const first = setup()
    first.writer.offline = true
    first.queue.upsert('games', game('g1'))
    await first.queue.flush()

    const writer = new FakeWriter()
    const queue = new WriteQueue(writer, first.storage, new ManualTimers())
    expect(queue.getStatus().pending).toBe(1)
    await queue.flush()
    expect(writer.calls).toEqual(['upsert games g1'])
  })

  it('sends parents before children, and deletes children before parents', async () => {
    const { queue, writer } = setup()
    queue.upsert('possessions', poss('p1', 'g1'))
    queue.upsert('games', game('g1'))
    queue.upsert('games', game('g2'))
    await queue.flush()
    expect(writer.calls).toEqual(['upsert games g1', 'upsert games g2', 'upsert possessions p1'])

    writer.calls = []
    queue.remove('games', 'g2')
    queue.remove('possessions', 'p1')
    await queue.flush()
    expect(writer.calls).toEqual(['delete possessions p1', 'delete games g2'])
  })

  it('coalesces repeated edits of one row into one write of the latest version', async () => {
    const { queue, writer } = setup()
    queue.upsert('games', game('g1', { notes: 'a' }))
    queue.upsert('games', game('g1', { notes: 'ab' }))
    queue.upsert('games', game('g1', { notes: 'abc' }))
    await queue.flush()
    expect(writer.calls).toEqual(['upsert games g1'])
    expect(writer.server.get('games:g1')?.notes).toBe('abc')
  })

  it('forgets a new row deleted before it was ever sent', async () => {
    const { queue, writer } = setup()
    queue.upsert('games', game('g1'))
    queue.remove('games', 'g1')
    expect(queue.getStatus().pending).toBe(0)
    await queue.flush()
    expect(writer.calls).toEqual([])
  })

  it('still sends the delete when the insert was attempted (it may have reached the server)', async () => {
    const { queue, writer } = setup()
    writer.offline = true
    queue.upsert('games', game('g1'))
    await queue.flush()
    queue.remove('games', 'g1')
    writer.offline = false
    await queue.flush()
    expect(writer.calls.at(-1)).toBe('delete games g1')
  })

  it('drops queued child writes when the parent is deleted', async () => {
    const { queue, writer } = setup()
    writer.offline = true
    queue.upsert('games', game('g1'))
    queue.upsert('possessions', poss('p1', 'g1'))
    queue.upsert('possessions', poss('p2', 'g2'))
    await queue.flush()
    writer.offline = false
    writer.calls = []
    queue.remove('games', 'g1', [{ table: 'possessions', fk: 'game_id' }])
    await queue.flush()
    expect(writer.calls).toEqual(['upsert possessions p2', 'delete games g1'])
  })

  it('keeps an edit made while its previous version was in flight', async () => {
    const { queue, writer } = setup()
    let release: () => void = () => {}
    writer.upsert = async (table, row) => {
      writer.calls.push(`upsert ${table} ${row.id} ${String(row.notes)}`)
      await new Promise<void>((r) => (release = r))
      writer.server.set(`${table}:${row.id}`, row)
    }
    queue.upsert('games', game('g1', { notes: 'old' }))
    const flushing = queue.flush()
    await Promise.resolve()
    queue.upsert('games', game('g1', { notes: 'new' }))
    release()
    await flushing
    expect(queue.getStatus().pending).toBe(1)
    const second = queue.flush()
    await Promise.resolve()
    release()
    await second
    expect(writer.server.get('games:g1')?.notes).toBe('new')
    expect(queue.getStatus().pending).toBe(0)
  })

  it('sets aside writes the server refuses, keeps sending the rest, and never drops them silently', async () => {
    const { queue, writer, storage } = setup()
    writer.failNext = [new WriteError('violates check constraint', true)]
    queue.upsert('games', game('bad'))
    queue.upsert('games', game('good'))
    await queue.flush()
    expect(writer.server.has('games:good')).toBe(true)
    const status = queue.getStatus()
    expect(status.pending).toBe(0)
    expect(status.rejected.map((e) => [e.id, e.rejected])).toEqual([['bad', 'violates check constraint']])
    expect(storage.saved).toHaveLength(1)

    await queue.flush()
    expect(writer.calls.filter((c) => c.includes('bad'))).toHaveLength(1)
    queue.discardRejected()
    expect(queue.getStatus().rejected).toEqual([])
    expect(storage.saved).toHaveLength(0)
  })

  it('overlays pending writes on fetched rows', () => {
    const { queue } = setup()
    queue.upsert('games', game('g2', { notes: 'local' }))
    queue.upsert('games', game('g9', { video_id: 'other' }))
    queue.remove('games', 'g3')
    const fetched = [
      { id: 'g1', video_id: 'v1', notes: 'server' },
      { id: 'g2', video_id: 'v1', notes: 'server' },
      { id: 'g3', video_id: 'v1', notes: 'server' },
    ]
    const merged = queue.overlay('games', fetched, (row) => row.video_id === 'v1')
    expect(merged.map((g) => [g.id, g.notes])).toEqual([
      ['g1', 'server'],
      ['g2', 'local'],
    ])
  })

  it('debounces flushes for edits (SYN-3)', () => {
    const { queue, timers } = setup()
    queue.upsert('games', game('g1'), 500)
    queue.upsert('games', game('g1'), 500)
    expect(timers.delays()).toEqual([500])
  })

  it('notifies subscribers when the pending count changes', async () => {
    const { queue } = setup()
    const seen: number[] = []
    queue.subscribe(() => seen.push(queue.getStatus().pending))
    queue.upsert('games', game('g1'))
    await queue.flush()
    expect(seen).toContain(1)
    expect(seen.at(-1)).toBe(0)
  })
})
