import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import synthetic from '../../fixtures/synthetic-01.json'
import { fixtureItems, type Fixture } from '../stats/fixture'
import { loadStatItems } from '../data/stats'
import { listVideos } from '../data/videos'
import { loadGames } from '../data/games'
import { summary } from '../videos/testData'
import { StatsPage, filtersFromParams, scopeFromParams } from './StatsPage'

vi.mock('../data/stats', () => ({ loadStatItems: vi.fn<typeof import('../data/stats').loadStatItems>() }))
vi.mock('../data/videos', () => ({ listVideos: vi.fn<typeof import('../data/videos').listVideos>() }))
vi.mock('../data/games', () => ({ loadGames: vi.fn<typeof import('../data/games').loadGames>() }))
vi.mock('../app/QueueProvider', () => ({ useQueue: () => ({}) }))

const items = fixtureItems(synthetic as Fixture)

beforeEach(() => {
  vi.mocked(loadStatItems).mockResolvedValue(items)
  vi.mocked(listVideos).mockResolvedValue([summary({ id: 'v1', title: 'Synthetic practice' })])
  vi.mocked(loadGames).mockResolvedValue([])
})

function renderAt(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="stats" element={<StatsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('scope and filters from the URL (STA-4)', () => {
  it('reads each scope', () => {
    expect(scopeFromParams(new URLSearchParams('scope=game&video=v1&game=g1'))).toEqual({ kind: 'game', videoId: 'v1', gameId: 'g1' })
    expect(scopeFromParams(new URLSearchParams('scope=video&video=v1'))).toEqual({ kind: 'video', videoId: 'v1' })
    expect(scopeFromParams(new URLSearchParams('from=2026-09-01'))).toEqual({ kind: 'range', from: '2026-09-01', to: null })
  })

  it('reads filters and ignores unknown values', () => {
    expect(filtersFromParams(new URLSearchParams('shot=Pin,Bogus&format=doubles&opp=__none'))).toEqual({
      shotTypes: ['Pin'],
      format: 'doubles',
      opponent: '',
    })
  })
})

describe('StatsPage', () => {
  it('shows confirmed possessions only, all time by default', async () => {
    renderAt('/stats')
    expect(await screen.findByText(/13 of 13 confirmed possessions/)).toBeInTheDocument()
    expect(loadStatItems).toHaveBeenCalledWith({}, { kind: 'range', from: null, to: null })
  })

  it('filters by shot type and says how many match', async () => {
    renderAt('/stats')
    await screen.findByText(/13 of 13/)
    fireEvent.click(screen.getByLabelText('Pin'))
    expect(await screen.findByText(/5 of 13 confirmed possessions match the filters/)).toBeInTheDocument()
    expect(screen.getByText('conversion').closest('.kpi')).toHaveTextContent('80% (4/5)')
  })

  it('offers the opponents found in the scope', async () => {
    renderAt('/stats?scope=video&video=v1')
    await screen.findByText(/13 of 13/)
    expect(screen.getByRole('option', { name: 'Tomáš' })).toBeInTheDocument()
    expect(loadStatItems).toHaveBeenCalledWith({}, { kind: 'video', videoId: 'v1' })
  })

  it('asks for a game in game scope', async () => {
    renderAt('/stats?scope=game&video=v1')
    expect(await screen.findByText('Choose a game above.')).toBeInTheDocument()
  })
})
