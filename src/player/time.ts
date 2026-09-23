/** Video time for display: "4:05.3", "1:02:03.0"; "–" when unknown. */
export function formatTime(t: number | null | undefined, decimals = 1): string {
  if (t == null || !Number.isFinite(t)) return '–'
  const sign = t < 0 ? '−' : ''
  const scale = 10 ** decimals
  const total = Math.round(Math.abs(t) * scale) / scale
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = (total % 60).toFixed(decimals).padStart(decimals > 0 ? 3 + decimals : 2, '0')
  return h > 0 ? `${sign}${h}:${String(m).padStart(2, '0')}:${s}` : `${sign}${m}:${s}`
}
