import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { localQueueStorage, WriteQueue } from '../data/queue'
import { supabaseWriter } from '../data/supabaseWriter'

const QueueContext = createContext<WriteQueue | null>(null)

/** One write queue per signed-in user, flushed on load and on the `online` event (SYN-2, SYN-4). */
export function QueueProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [queue] = useState(() => new WriteQueue(supabaseWriter, localQueueStorage(userId)))

  useEffect(() => {
    void queue.flush()
    const onOnline = () => void queue.flush()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [queue])

  return <QueueContext.Provider value={queue}>{children}</QueueContext.Provider>
}

export function useQueue(): WriteQueue {
  const queue = useContext(QueueContext)
  if (!queue) throw new Error('useQueue outside QueueProvider')
  return queue
}

export function useQueueStatus() {
  const queue = useQueue()
  return useSyncExternalStore(
    (cb) => queue.subscribe(cb),
    () => queue.getStatus(),
  )
}
