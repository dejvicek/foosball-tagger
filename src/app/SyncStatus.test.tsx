import { fireEvent, render, screen } from '@testing-library/react'
import { SyncStatus } from './SyncStatus'
import type { QueueEntry } from '../data/queue'

const rejected: QueueEntry[] = (['matches', 'games', 'possessions'] as const).map((table) => ({
  table,
  id: table,
  op: { kind: 'upsert', row: { id: table } },
  seq: 1,
  version: 1,
  attempted: true,
  rejected: 'nope',
}))

vi.mock('./QueueProvider', () => ({
  useQueue: () => ({ discardRejected: vi.fn<() => void>() }),
  useQueueStatus: () => ({ pending: 0, rejected, flushing: false }),
}))

describe('SyncStatus', () => {
  it('names the table of each refused change', () => {
    render(<SyncStatus />)
    fireEvent.click(screen.getByRole('button', { name: /refused/ }))
    const items = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(items).toEqual(['Save match: nope', 'Save game: nope', 'Save possession: nope'])
  })
})
