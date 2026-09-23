import { HashRouter, Route, Routes } from 'react-router'
import { AuthGate } from './AuthGate'
import { Layout } from './Layout'
import { Home } from './Home'
import { NotFound } from './NotFound'

export function App() {
  return (
    <AuthGate>
      {(session) => (
        <HashRouter>
          <Routes>
            <Route element={<Layout email={session.user.email ?? ''} />}>
              <Route index element={<Home />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </HashRouter>
      )}
    </AuthGate>
  )
}
