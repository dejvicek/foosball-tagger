import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import synthetic from '../../fixtures/synthetic-01.json'
import type { Fixture } from '../stats/fixture'
import { loadScope, type ScopeData } from '../data/stats'
import type { Game, Match, Possession, Side } from '../data/types'
import { listVideos } from '../data/videos'
import { loadGames } from '../data/games'
import { loadMatches } from '../data/matches'
import { summary } from '../videos/testData'
import { StatsPage, exportFileName, filtersFromParams, scopeFromParams } from './StatsPage'

vi.mock('../data/stats', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/stats')>()),
  loadScope: vi.fn<typeof import('../data/stats').loadScope>(),
}))
vi.mock('../data/videos', () => ({ listVideos: vi.fn<typeof import('../data/videos').listVideos>() }))
vi.mock('../data/games', () => ({ loadGames: vi.fn<typeof import('../data/games').loadGames>() }))
vi.mock('../data/matches', () => ({ loadMatches: vi.fn<typeof import('../data/matches').loadMatches>() }))
vi.mock('../app/QueueProvider', () => ({ useQueue: () => ({}) }))

const f = synthetic as Fixture & {
  video: { youtube_id: string; title: string }
  game: { video_id: string; start_s: number; end_s: number | null; my_side: Side }
}
const fixtureMatch: Match = {
  id: 'm1',
  user_id: 'u1',
  video_id: f.game.video_id,
  best_of: null,
  format: f.game.format,
  teammate: null,
  opponent: f.game.opponent,
  opponent2: null,
  notes: null,
  created_at: '',
  updated_at: '',
}
const fixtureGame: Game = {
  id: f.game.id,
  user_id: 'u1',
  video_id: f.game.video_id,
  match_id: 'm1',
  start_s: f.game.start_s,
  end_s: f.game.end_s,
  my_side: f.game.my_side,
  my_score: null,
  opp_score: null,
  notes: null,
  created_at: '',
  updated_at: '',
}
const scopeData: ScopeData = {
  videos: [summary({ id: f.video.id, youtube_id: f.video.youtube_id, title: f.video.title, recorded_on: f.video.recorded_on })],
  matches: [fixtureMatch],
  games: [fixtureGame],
  possessions: f.possessions.map((p): Possession => ({ ...p, user_id: 'u1', created_at: '', updated_at: '' })),
}

beforeEach(() => {
  vi.mocked(loadScope).mockResolvedValue(scopeData)
  vi.mocked(listVideos).mockResolvedValue([summary({ id: 'v1', title: 'Synthetic practice' })])
  vi.mocked(loadGames).mockResolvedValue([])
  vi.mocked(loadMatches).mockResolvedValue([])
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

function matchRow(id: string): Match {
  return { ...fixtureMatch, id, video_id: 'v1' }
}
function gameRow(id: string, match_id: string, start_s: number): Game {
  return { ...fixtureGame, id, video_id: 'v1', match_id, start_s, end_s: null }
}

describe('scope and filters from the URL (STA-4)', () => {
  it('reads a match scope from the URL (STA-4, ADR-0040)', () => {
    expect(scopeFromParams(new URLSearchParams('scope=match&video=v1&match=m2'))).toEqual({ kind: 'match', videoId: 'v1', matchId: 'm2' })
    expect(scopeFromParams(new URLSearchParams('scope=match&video=v1'))).toEqual({ kind: 'video', videoId: 'v1' })
  })

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

  it('counts only the chosen match in match scope and marks the Match button', async () => {
    const mine = f.possessions.filter((p) => p.review_status === 'confirmed')
    const inFirst = mine.slice(0, 4)
    const data: ScopeData = {
      videos: scopeData.videos,
      matches: [matchRow('m1'), matchRow('m2')],
      games: [gameRow('g1', 'm1', 0), gameRow('g2', 'm2', 100)],
      possessions: [
        ...inFirst.map((p): Possession => ({ ...p, game_id: 'g1', user_id: 'u1', created_at: '', updated_at: '' })),
        ...mine.slice(4).map((p): Possession => ({ ...p, game_id: 'g2', user_id: 'u1', created_at: '', updated_at: '' })),
      ],
    }
    // loadScope is mocked, so honour the scope the way the real one does.
    vi.mocked(loadScope).mockImplementation((_q, scope) => {
      const ids = new Set(data.games.filter((g) => scope.kind === 'match' && g.match_id === scope.matchId).map((g) => g.id))
      return Promise.resolve({ ...data, possessions: data.possessions.filter((p) => ids.has(p.game_id)) })
    })
    renderAt('/stats?scope=match&video=v1&match=m1')
    expect(await screen.findByText(new RegExp(`${inFirst.length} of ${inFirst.length} confirmed possessions`))).toBeInTheDocument()
    expect(loadScope).toHaveBeenCalledWith({}, { kind: 'match', videoId: 'v1', matchId: 'm1' })
    expect(screen.getByRole('button', { name: 'Match' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('asks for a match in match scope', async () => {
    renderAt('/stats?scope=match&video=v1')
    expect(await screen.findByText('Choose a match above.')).toBeInTheDocument()
  })

  it('asks for a game in game scope', async () => {
    renderAt('/stats?scope=game&video=v1')
    expect(await screen.findByText('Choose a game above.')).toBeInTheDocument()
  })
})

describe('export (EXP-1..3)', () => {
  const twoMatches = {
    videos: [summary({ youtube_id: 'dQw4w9WgXcQ' })],
    matches: [matchRow('m1'), matchRow('m2')],
    games: [gameRow('g1', 'm1', 0), gameRow('g2', 'm2', 100)],
    possessions: [],
  }

  it('names a match export by its number', () => {
    expect(exportFileName({ kind: 'match', videoId: 'v1', matchId: 'm2' }, twoMatches)).toBe('foosball-dQw4w9WgXcQ-match-2.csv')
  })

  it('numbers a game within its own match when there are two matches', () => {
    expect(exportFileName({ kind: 'game', videoId: 'v1', gameId: 'g2' }, twoMatches)).toBe('foosball-dQw4w9WgXcQ-match-2-game-1.csv')
  })

  it('names the file after the scope', () => {
    expect(exportFileName({ kind: 'range', from: null, to: null }, scopeData)).toBe('foosball-all.csv')
    expect(exportFileName({ kind: 'range', from: '2026-09-01', to: '2026-09-30' }, scopeData)).toBe('foosball-2026-09-01-to-2026-09-30.csv')
    expect(exportFileName({ kind: 'video', videoId: 'v1' }, scopeData)).toBe('foosball-aaaaaaaaaaa.csv')
    expect(exportFileName({ kind: 'game', videoId: 'v1', gameId: 'g1' }, scopeData)).toBe('foosball-aaaaaaaaaaa-match-1-game-1.csv')
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
