import { fireEvent, render, screen } from '@testing-library/react'
import { PLAYER_STATE, PlayerController, type YTPlayerLike } from '../player/controller'
import { emptyDraft } from './draft'
import { fromDraft } from './possessions'
import { Timeline } from './Timeline'

function setup() {
  const controller = new PlayerController()
  const player: YTPlayerLike = {
    getCurrentTime: () => 60,
    getDuration: () => 600,
    getPlayerState: () => PLAYER_STATE.PAUSED,
    playVideo: () => {},
    pauseVideo: () => {},
    seekTo: () => {},
    setPlaybackRate: () => {},
    getPlaybackRate: () => 1,
    getAvailablePlaybackRates: () => [1],
  }
  controller.attach(player)
  const seeks: number[] = []
  const p = { ...fromDraft({ ...emptyDraft(), start_s: 150, shot_s: 160 }, { id: 'p1', userId: 'u', gameId: 'g', now: '' }), result: 'Goal' as const }
  render(<Timeline range={{ start: 100, end: 200 }} possessions={[{ p, n: 1 }]} draft={emptyDraft()} controller={controller} onSeek={(t) => seeks.push(Math.round(t))} />)
  const strip = screen.getByRole('group', { name: /Game timeline/ })
  strip.getBoundingClientRect = () => ({ left: 0, width: 1000, top: 0, height: 34, right: 1000, bottom: 34, x: 0, y: 0, toJSON: () => ({}) })
  return { strip, seeks, segment: screen.getByRole('button', { name: /^#1/ }) }
}

describe('Timeline dragging (ADR-0022)', () => {
  it('drags to scrub within the game and lands where released', () => {
    const { strip, seeks } = setup()
    fireEvent.pointerDown(strip, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(strip, { clientX: 400, pointerId: 1 })
    fireEvent.pointerUp(strip, { clientX: 700, pointerId: 1 })
    fireEvent.click(strip, { clientX: 700 })
    expect(seeks[0]).toBe(140) // drag started
    expect(seeks.at(-1)).toBe(170) // released at 70 % of 100–200
  })

  it('clamps a drag past the ends to the game', () => {
    const { strip, seeks } = setup()
    fireEvent.pointerDown(strip, { clientX: 500, button: 0, pointerId: 1 })
    fireEvent.pointerMove(strip, { clientX: 520, pointerId: 1 })
    fireEvent.pointerUp(strip, { clientX: 5000, pointerId: 1 })
    expect(seeks.at(-1)).toBe(200)
  })

  it('a plain click on a segment still jumps one second before it', () => {
    const { segment, seeks } = setup()
    fireEvent.pointerDown(segment, { clientX: 550, button: 0, pointerId: 1 })
    fireEvent.pointerUp(segment, { clientX: 551, pointerId: 1 })
    fireEvent.click(segment)
    expect(seeks).toEqual([149])
  })

  it('a drag that starts on a segment does not also trigger its jump', () => {
    const { segment, seeks } = setup()
    fireEvent.pointerDown(segment, { clientX: 550, button: 0, pointerId: 1 })
    fireEvent.pointerMove(segment, { clientX: 600, pointerId: 1 })
    fireEvent.pointerUp(segment, { clientX: 800, pointerId: 1 })
    fireEvent.click(segment)
    expect(seeks).not.toContain(149)
    expect(seeks.at(-1)).toBe(180)
  })
})
