import { HashRouter, Route, Routes } from 'react-router'
import { AuthGate } from './AuthGate'
import { Layout } from './Layout'
import { VideosPage } from '../videos/VideosPage'
import { VideoPage } from '../videos/VideoPage'
import { NotFound } from './NotFound'

export function App() {
  return (
    <AuthGate>
      {(session) => (
        <HashRouter>
          <Routes>
            <Route element={<Layout email={session.user.email ?? ''} />}>
              <Route index element={<VideosPage />} />
              <Route path="videos/:id" element={<VideoPage />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </HashRouter>
      )}
    </AuthGate>
  )
}
