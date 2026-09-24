/** Video time under a pointer on a horizontal seek bar, clamped to the video. */
export function timeAtX(clientX: number, rect: { left: number; width: number }, duration: number): number {
  if (rect.width <= 0 || duration <= 0) return 0
  const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  return fraction * duration
}

/** Position of a time on the bar, as a percentage (0–100). */
export function percentAt(t: number, duration: number): number {
  if (duration <= 0) return 0
  return Math.min(100, Math.max(0, (t / duration) * 100))
}
