import { fireEvent, render, screen } from '@testing-library/react'
import { PLAYER_STATE, PlayerController, type YTPlayerLike } from './controller'
import { SeekBar } from './SeekBar'

function setup(duration = 10800) {
  const calls: string[] = []
  const player: YTPlayerLike = {
    getCurrentTime: () => 0,
    getDuration: () => duration,
    getPlayerState: () => PLAYER_STATE.PAUSED,
    playVideo: () => {},
    pauseVideo: () => {},
    seekTo: (s, ahead) => void calls.push(`${ahead ? 'seek' : 'scrub'} ${Math.round(s)}`),
    setPlaybackRate: () => {},
    getPlaybackRate: () => 1,
    getAvailablePlaybackRates: () => [1],
  }
  const controller = new PlayerController()
  controller.attach(player)
  render(<SeekBar controller={controller} marks={[{ id: 'g1', start: 600, end: 1800, label: 'Game 1' }]} />)
  const bar = screen.getByRole('slider', { name: 'Seek in video' })
  bar.getBoundingClientRect = () => ({ left: 0, width: 1000, top: 0, height: 20, right: 1000, bottom: 20, x: 0, y: 0, toJSON: () => ({}) })
  return { bar, calls }
}

describe('SeekBar (ADR-0018)', () => {
  it('seeks to where it is clicked, without taking focus', () => {
    const { bar, calls } = setup()
    const down = fireEvent.pointerDown(bar, { clientX: 500, button: 0, pointerId: 1 })
    fireEvent.pointerUp(bar, { clientX: 500, pointerId: 1 })
    expect(down).toBe(false) // default prevented: focus stays put
    expect(calls).toEqual(['scrub 5400', 'seek 5400'])
    expect(bar).not.toHaveFocus()
  })

  it('ends a drag with a full seek where the pointer is released', () => {
    const { bar, calls } = setup()
    fireEvent.pointerDown(bar, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(bar, { clientX: 900, pointerId: 1 })
    fireEvent.pointerUp(bar, { clientX: 900, pointerId: 1 })
    expect(calls[0]).toBe('scrub 1080')
    expect(calls.at(-1)).toBe('seek 9720')
  })

  it('shows the time under the pointer', () => {
    const { bar } = setup()
    fireEvent.pointerMove(bar, { clientX: 250 })
    expect(screen.getByText('45:00')).toBeInTheDocument()
  })

  it('jumps a minute with Page Up / Page Down and to the ends with Home / End', () => {
    const { bar, calls } = setup()
    fireEvent.keyDown(bar, { key: 'PageUp' })
    fireEvent.keyDown(bar, { key: 'End' })
    fireEvent.keyDown(bar, { key: 'Home' })
    expect(calls).toEqual(['seek 60', 'seek 10800', 'seek 0'])
  })

  it('marks games on the bar', () => {
    const { bar } = setup()
    expect(bar.querySelector('.seekbar-mark')).toHaveAttribute('title', 'Game 1')
  })
})
