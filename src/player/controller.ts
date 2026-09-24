// Player controller around the YouTube IFrame API (PRD §4.4, ADR-0015).
// Pure TypeScript over a minimal player interface so it can be unit-tested.

/** The part of YT.Player the app uses. */
export interface YTPlayerLike {
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  setPlaybackRate(rate: number): void
  getPlaybackRate(): number
  getAvailablePlaybackRates(): number[]
}

export const PLAYER_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const

/** Speeds offered by [ and ] (TAG-1), limited to what the video supports. */
export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2] as const

export interface PlayerSnapshot {
  ready: boolean
  playing: boolean
  rate: number
  speeds: readonly number[]
  duration: number | null
}

/** After a seek, report the target until the player catches up (at most this long). */
const SEEK_SETTLE_MS = 1000

export class PlayerController {
  private player: YTPlayerLike | null = null
  private listeners = new Set<() => void>()
  private snapshot: PlayerSnapshot = { ready: false, playing: false, rate: 1, speeds: SPEEDS, duration: null }
  private seekTarget: { t: number; at: number; from: number } | null = null
  private pauseWhenPlaying = false

  constructor(private readonly clock: () => number = () => performance.now()) {}

  attach(player: YTPlayerLike): void {
    this.player = player
    const available = new Set(player.getAvailablePlaybackRates())
    const speeds = SPEEDS.filter((s) => available.size === 0 || available.has(s))
    const d = player.getDuration()
    this.set({ ready: true, speeds, rate: player.getPlaybackRate() || 1, duration: d > 0 ? d : null })
  }

  detach(): void {
    this.player = null
    this.set({ ready: false, playing: false })
  }

  /** Feed YT onStateChange events here. */
  onStateChange(state: number): void {
    if (state === PLAYER_STATE.PLAYING && this.pauseWhenPlaying) {
      this.pauseWhenPlaying = false
      this.player?.pauseVideo()
      return
    }
    const playing = state === PLAYER_STATE.PLAYING || (state === PLAYER_STATE.BUFFERING && this.snapshot.playing)
    const d = this.player?.getDuration() ?? 0
    this.set({ playing, duration: d > 0 ? d : this.snapshot.duration })
  }

  onRateChange(rate: number): void {
    this.set({ rate })
  }

  /** Current video time in seconds. getCurrentTime() updates every frame while playing (measured, ADR-0015). */
  time(): number {
    if (!this.player) return this.seekTarget?.t ?? 0
    const reported = this.player.getCurrentTime() || 0
    if (this.seekTarget) {
      // Settled once the player reports a new time near the target (frame steps are
      // smaller than any tolerance, so the old time must not count), or after a timeout.
      const { t, at, from } = this.seekTarget
      const settled = (reported !== from && Math.abs(reported - t) < 0.5) || this.clock() - at > SEEK_SETTLE_MS
      if (!settled) return this.seekTarget.t
      this.seekTarget = null
    }
    return reported
  }

  play(): void {
    this.pauseWhenPlaying = false
    this.player?.playVideo()
  }

  pause(): void {
    this.pauseWhenPlaying = false
    this.player?.pauseVideo()
  }

  toggle(): void {
    if (this.snapshot.playing) this.pause()
    else this.play()
  }

  /** Seeks, clamped to the video. Before the first play a bare seekTo is unreliable, so start and pause again. */
  seek(t: number): void {
    this.seekInternal(t, true)
  }

  /**
   * Seek while dragging the seek bar: `allowSeekAhead = false` avoids loading
   * every intermediate position; the final `seek` on release loads the frame.
   */
  scrub(t: number): void {
    this.seekInternal(t, false)
  }

  private seekInternal(t: number, allowSeekAhead: boolean): void {
    const p = this.player
    if (!p) return
    const d = this.snapshot.duration
    const target = Math.max(0, d != null ? Math.min(t, Math.max(0, d - 0.05)) : t)
    const state = p.getPlayerState()
    this.seekTarget = { t: target, at: this.clock(), from: p.getCurrentTime() || 0 }
    p.seekTo(target, allowSeekAhead)
    if (state === PLAYER_STATE.UNSTARTED || state === PLAYER_STATE.CUED) {
      this.pauseWhenPlaying = true
      p.playVideo()
    }
  }

  nudge(seconds: number): void {
    this.seek(this.time() + seconds)
  }

  /** Approximate frame step (PRD §4.4): pause, then seek by 1/fps. */
  frameStep(direction: 1 | -1, fps: number): void {
    if (this.snapshot.playing) this.pause()
    this.seek(this.time() + direction / fps)
  }

  setRate(rate: number): void {
    this.player?.setPlaybackRate(rate)
    this.set({ rate })
  }

  /** [ and ]: next slower or faster speed; returns the new speed. */
  stepRate(direction: 1 | -1): number {
    const speeds = this.snapshot.speeds
    const current = speeds.findIndex((s) => s >= this.snapshot.rate - 1e-6)
    const i = Math.max(0, Math.min(speeds.length - 1, (current === -1 ? speeds.length - 1 : current) + direction))
    const next = speeds[i] ?? 1
    this.setRate(next)
    return next
  }

  getSnapshot = (): PlayerSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private set(patch: Partial<PlayerSnapshot>): void {
    const next = { ...this.snapshot, ...patch }
    const changed = (Object.keys(patch) as (keyof PlayerSnapshot)[]).some((k) => next[k] !== this.snapshot[k])
    if (!changed) return
    this.snapshot = next
    this.listeners.forEach((l) => l())
  }
}
