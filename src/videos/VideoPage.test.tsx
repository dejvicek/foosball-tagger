import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { deleteVideo, getVideo, updateVideo } from '../data/videos'
import { VideoPage } from './VideoPage'
import { summary } from './testData'

vi.mock('../data/videos', () => ({
  getVideo: vi.fn<typeof import('../data/videos').getVideo>(),
  updateVideo: vi.fn<typeof import('../data/videos').updateVideo>(),
  deleteVideo: vi.fn<typeof import('../data/videos').deleteVideo>(),
}))
vi.mock('../player/YouTubePlayer', () => ({ YouTubePlayer: () => <div>player</div> }))

function ListStub() {
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  return <p>List page {notice}</p>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/videos/v1']}>
      <Routes>
        <Route index element={<ListStub />} />
        <Route path="videos/:id" element={<VideoPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('VideoPage', () => {
  it('says when the video does not exist', async () => {
    vi.mocked(getVideo).mockResolvedValue(null)
    renderPage()
    expect(await screen.findByText('Video not found')).toBeInTheDocument()
  })

  it('edits details (VID-3)', async () => {
    const video = summary({ title: 'Practice' })
    vi.mocked(getVideo).mockResolvedValue(video)
    vi.mocked(updateVideo).mockImplementation(async (_id, patch) => ({ ...video, ...patch, updated_at: 'later' }))
    renderPage()
    const save = await screen.findByRole('button', { name: 'Save details' })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Recorded on'), { target: { value: '2026-09-23' } })
    fireEvent.change(screen.getByLabelText('Frame rate'), { target: { value: '60' } })
    fireEvent.click(save)
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(updateVideo).toHaveBeenCalledWith('v1', { title: 'Practice', recorded_on: '2026-09-23', fps: 60, notes: null })
  })

  it('confirms deletion with the counts, then returns to the list (VID-3)', async () => {
    vi.mocked(getVideo).mockResolvedValue(summary({ title: 'Tuesday', game_count: 2, possession_count: 30, confirmed_possession_count: 30 }))
    vi.mocked(deleteVideo).mockResolvedValue()
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete video…' }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent('This also removes 2 games and 30 possessions.')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(deleteVideo).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Delete video…' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete video' }))
    expect(await screen.findByText('List page Deleted “Tuesday”.')).toBeInTheDocument()
    expect(deleteVideo).toHaveBeenCalledWith('v1')
  })

  it('keeps the dialog open and explains a failed delete', async () => {
    vi.mocked(getVideo).mockResolvedValue(summary())
    vi.mocked(deleteVideo).mockRejectedValue(new Error('Could not delete the video: offline'))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete video…' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete video' }))
    expect(await within(screen.getByRole('alertdialog')).findByRole('alert')).toHaveTextContent('offline')
  })
})
