import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import synthetic from '../../fixtures/synthetic-01.json'
import type { Fixture } from '../stats/fixture'
import { loadScope, type ScopeData } from '../data/stats'
import type { Game, Possession } from '../data/types'
import { listVideos } from '../data/videos'
import { loadGames } from '../data/games'
import { summary } from '../videos/testData'
import { StatsPage, exportFileName, filtersFromParams, scopeFromParams } from './StatsPage'

vi.mock('../data/stats', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/stats')>()),
  loadScope: vi.fn<typeof import('../data/stats').loadScope>(),
}))
vi.mock('../data/videos', () => ({ listVideos: vi.fn<typeof import('../data/videos').listVideos>() }))
vi.mock('../data/games', () => ({ loadGames: vi.fn<typeof import('../data/games').loadGames>() }))
vi.mock('../app/QueueProvider', () => ({ useQueue: () => ({}) }))

const f = synthetic as Fixture & { video: { youtube_id: string; title: string }; game: Partial<Game> }
const scopeData: ScopeData = {
  videos: [summary({ id: f.video.id, youtube_id: f.video.youtube_id, title: f.video.title, recorded_on: f.video.recorded_on })],
  games: [{ ...(f.game as Game), user_id: 'u1', teammate: null, opponent2: null, my_score: null, opp_score: null, notes: null, created_at: '', updated_at: '' }],
  possessions: f.possessions.map((p): Possession => ({ ...p, user_id: 'u1', created_at: '', updated_at: '' })),
}

beforeEach(() => {
  vi.mocked(loadScope).mockResolvedValue(scopeData)
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
    expect(loadScope).toHaveBeenCalledWith({}, { kind: 'range', from: null, to: null })
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
    expect(loadScope).toHaveBeenCalledWith({}, { kind: 'video', videoId: 'v1' })
  })

  it('asks for a game in game scope', async () => {
    renderAt('/stats?scope=game&video=v1')
    expect(await screen.findByText('Choose a game above.')).toBeInTheDocument()
  })
})

describe('export (EXP-1..3)', () => {
  it('names the file after the scope', () => {
    expect(exportFileName({ kind: 'range', from: null, to: null }, scopeData)).toBe('foosball-all.csv')
    expect(exportFileName({ kind: 'range', from: '2026-09-01', to: '2026-09-30' }, scopeData)).toBe('foosball-2026-09-01-to-2026-09-30.csv')
    expect(exportFileName({ kind: 'video', videoId: 'v1' }, scopeData)).toBe('foosball-aaaaaaaaaaa.csv')
    expect(exportFileName({ kind: 'game', videoId: 'v1', gameId: 'g1' }, scopeData)).toBe('foosball-aaaaaaaaaaa-game-1.csv')
  })

  it('counts confirmed possessions, adds candidates when ticked, follows the filters', async () => {
    renderAt('/stats')
    await screen.findByText(/13 of 13/)
    const card = within(screen.getByRole('region', { name: 'Export CSV' }))
    expect(card.getByText('13 possessions')).toBeInTheDocument()
    fireEvent.click(card.getByLabelText(/Include unreviewed candidates/))
    const withCandidates = Number(card.getByText(/possessions$/).textContent?.split(' ')[0])
    expect(withCandidates).toBe(13 + f.possessions.filter((p) => p.review_status === 'unreviewed').length)
    fireEvent.click(card.getByLabelText(/Include unreviewed candidates/))
    fireEvent.click(screen.getByLabelText('Pin'))
    expect(await card.findByText('5 possessions')).toBeInTheDocument()
  })

  it('copies the CSV, or shows it selected when the clipboard is blocked (EXP-2)', async () => {
    const writeText = vi.fn<(t: string) => Promise<void>>().mockResolvedValue()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderAt('/stats')
    await screen.findByText(/13 of 13/)
    fireEvent.click(screen.getByRole('button', { name: 'Copy CSV' }))
    expect(await screen.findByText('Copied 13 possessions.')).toBeInTheDocument()
    expect(writeText.mock.calls[0]?.[0]).toMatch(/^video_title,recorded_on,/)
    expect(writeText.mock.calls[0]?.[0].split('\r\n')).toHaveLength(15)

    writeText.mockRejectedValue(new Error('NotAllowedError'))
    fireEvent.click(screen.getByRole('button', { name: 'Copy CSV' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/blocked the clipboard/)
    expect((screen.getByLabelText('CSV') as HTMLTextAreaElement).value).toMatch(/^video_title,/)
  })
})
