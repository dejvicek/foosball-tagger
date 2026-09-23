import { getSupabase } from './supabase'
import { WriteError, type QueueRow, type QueueTable, type QueueWriter } from './queue'

/** Columns the server fills; never sent from the client. */
const SERVER_FILLED = ['user_id', 'created_at', 'updated_at'] as const

/**
 * Postgres errors retrying cannot fix: data exceptions (22), integrity violations (23),
 * insufficient privilege / RLS (42501) and other syntax/access errors (42).
 */
export function isPermanent(code: string | undefined): boolean {
  return !!code && /^(22|23|42)/.test(code)
}

function toWriteError(error: { message: string; code?: string }): WriteError {
  return new WriteError(error.message, isPermanent(error.code))
}

export const supabaseWriter: QueueWriter = {
  async upsert(table: QueueTable, row: QueueRow) {
    const body: Record<string, unknown> = { ...row }
    for (const col of SERVER_FILLED) delete body[col]
    // The queue is generic over tables; the row shape was checked where it was enqueued.
    const { error } = await getSupabase()
      .from(table)
      .upsert(body as never, { onConflict: 'id' })
    if (error) throw toWriteError(error)
  },
  async delete(table: QueueTable, id: string) {
    const { error } = await getSupabase().from(table).delete().eq('id', id)
    if (error) throw toWriteError(error)
  },
}
