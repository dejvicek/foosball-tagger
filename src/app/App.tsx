import { HashRouter, Route, Routes } from 'react-router'
import { AuthGate } from './AuthGate'
import { Layout } from './Layout'
import { NotFound } from './NotFound'
import { QueueProvider } from './QueueProvider'
import { VideosPage } from '../videos/VideosPage'
import { VideoPage } from '../videos/VideoPage'
import { TaggingPage } from '../tagging/TaggingPage'
import { StatsPage } from '../statsView/StatsPage'

export function App() {
  return (
    <AuthGate>
      {(session) => (
        <QueueProvider key={session.user.id} userId={session.user.id}>
          <HashRouter>
            <Routes>
              <Route element={<Layout email={session.user.email ?? ''} />}>
                <Route index element={<VideosPage />} />
                <Route path="videos/:id" element={<VideoPage userId={session.user.id} />} />
                <Route path="videos/:id/games/:gameId" element={<TaggingPage userId={session.user.id} />} />
                <Route path="stats" element={<StatsPage />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </HashRouter>
        </QueueProvider>
      )}
    </AuthGate>
  )
}
