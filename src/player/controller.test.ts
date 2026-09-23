import { PLAYER_STATE, PlayerController, type YTPlayerLike } from './controller'

class FakePlayer implements YTPlayerLike {
  t = 0
  state: number = PLAYER_STATE.UNSTARTED
  rate = 1
  duration = 600
  rates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
  calls: string[] = []
  getCurrentTime = () => this.t
  getDuration = () => this.duration
  getPlayerState = () => this.state
  playVideo = () => void this.calls.push('play')
  pauseVideo = () => void this.calls.push('pause')
  seekTo = (s: number) => void this.calls.push(`seek ${s.toFixed(3)}`)
  setPlaybackRate = (r: number) => {
    this.rate = r
    this.calls.push(`rate ${r}`)
  }
  getPlaybackRate = () => this.rate
  getAvailablePlaybackRates = () => this.rates
}

function setup() {
  let now = 0
  const player = new FakePlayer()
  const c = new PlayerController(() => now)
  c.attach(player)
  return { c, player, advance: (ms: number) => (now += ms) }
}

describe('PlayerController', () => {
  it('offers the PRD speeds the video supports', () => {
    const { c } = setup()
    expect(c.getSnapshot().speeds).toEqual([0.25, 0.5, 0.75, 1, 1.5, 2])
  })

  it('steps speed with [ and ], stopping at the ends', () => {
    const { c } = setup()
    expect(c.stepRate(1)).toBe(1.5)
    expect(c.stepRate(1)).toBe(2)
    expect(c.stepRate(1)).toBe(2)
    for (let i = 0; i < 6; i++) c.stepRate(-1)
    expect(c.getSnapshot().rate).toBe(0.25)
  })

  it('moves from an unlisted speed to the next listed one', () => {
    const { c } = setup()
    c.onRateChange(1.25)
    expect(c.stepRate(1)).toBe(2)
    c.onRateChange(1.25)
    expect(c.stepRate(-1)).toBe(1)
  })

  it('reports the seek target until the player catches up', () => {
    const { c, player, advance } = setup()
    player.state = PLAYER_STATE.PAUSED
    player.t = 10
    c.seek(20)
    expect(c.time()).toBe(20)
    advance(300)
    expect(c.time()).toBe(20)
    player.t = 20.01
    expect(c.time()).toBeCloseTo(20.01)
  })

  it('stops overriding after a second even if the player lands elsewhere (keyframes)', () => {
    const { c, player, advance } = setup()
    player.state = PLAYER_STATE.PAUSED
    player.t = 10
    c.seek(20)
    player.t = 19.4
    advance(1100)
    expect(c.time()).toBe(19.4)
  })

  it('clamps seeks to the video', () => {
    const { c, player } = setup()
    player.state = PLAYER_STATE.PAUSED
    c.seek(-5)
    c.seek(9999)
    expect(player.calls).toEqual(['seek 0.000', 'seek 599.950'])
  })

  it('starts and pauses again when seeking before the first play', () => {
    const { c, player } = setup()
    c.seek(30)
    expect(player.calls).toEqual(['seek 30.000', 'play'])
    c.onStateChange(PLAYER_STATE.PLAYING)
    expect(player.calls.at(-1)).toBe('pause')
    expect(c.getSnapshot().playing).toBe(false)
  })

  it('frame-steps by 1/fps and pauses first', () => {
    const { c, player } = setup()
    player.state = PLAYER_STATE.PLAYING
    c.onStateChange(PLAYER_STATE.PLAYING)
    player.t = 10
    c.frameStep(1, 30)
    expect(player.calls).toEqual(['pause', `seek ${(10 + 1 / 30).toFixed(3)}`])
    player.state = PLAYER_STATE.PAUSED
    c.onStateChange(PLAYER_STATE.PAUSED)
    c.frameStep(-1, 60)
    expect(player.calls.at(-1)).toBe(`seek ${(10 + 1 / 30 - 1 / 60).toFixed(3)}`)
  })

  it('accumulates quick repeated frame steps before the player catches up', () => {
    const { c, player } = setup()
    player.state = PLAYER_STATE.PAUSED
    player.t = 10
    c.frameStep(1, 30)
    c.frameStep(1, 30)
    c.frameStep(1, 30)
    expect(player.calls.at(-1)).toBe('seek 10.100')
  })

  it('nudges relative to the current time', () => {
    const { c, player } = setup()
    player.state = PLAYER_STATE.PAUSED
    player.t = 42
    c.nudge(-5)
    expect(player.calls).toEqual(['seek 37.000'])
  })

  it('toggles play and pause from the reported state', () => {
    const { c, player } = setup()
    c.toggle()
    expect(player.calls).toEqual(['play'])
    c.onStateChange(PLAYER_STATE.PLAYING)
    c.toggle()
    expect(player.calls.at(-1)).toBe('pause')
  })

  it('treats buffering during playback as playing', () => {
    const { c } = setup()
    c.onStateChange(PLAYER_STATE.PLAYING)
    c.onStateChange(PLAYER_STATE.BUFFERING)
    expect(c.getSnapshot().playing).toBe(true)
  })
})
