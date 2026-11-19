import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactElement } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Detection from './pages/Detection'
import History from './pages/History'
import Detail from './pages/Detail'
import Settings from './pages/Settings'
import Users from './pages/Users'
import { getSession } from './lib/auth'

function Protected({ children }: { children: ReactElement }) {
  return getSession() ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />
      <Route
        path="/detection"
        element={
          <Protected>
            <Detection />
          </Protected>
        }
      />
      <Route
        path="/history"
        element={
          <Protected>
            <History />
          </Protected>
        }
      />
      <Route
        path="/history/:id"
        element={
          <Protected>
            <Detail />
          </Protected>
        }
      />
      <Route
        path="/settings"
        element={
          <Protected>
            <Settings />
          </Protected>
        }
      />
      <Route
        path="/users"
        element={
          <Protected>
            <Users />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to={getSession() ? '/dashboard' : '/login'} replace />} />
    </Routes>
  )
}
