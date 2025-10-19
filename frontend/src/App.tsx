import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, ProtectedRoute, useAuth } from './hooks/useAuth'
import { AppLayout } from './components/AppLayout'

// Import pages
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { ObsControl } from './pages/ObsControl'
import { GameScoreboard } from './ui/GameScoreboard'
import { GameControl } from './ui/GameControl'

// Import design system styles
import './styles/design-system.css'

function AppRoutes() {
  const { user, logout } = useAuth()
  
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/scoreboard" element={<GameScoreboard />} />
      
      {/* Protected routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <AppLayout user={user || undefined} onLogout={logout}>
            <Dashboard />
          </AppLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/game" element={
        <ProtectedRoute requiredPermissions={['game.control']}>
          <AppLayout user={user || undefined} onLogout={logout}>
            <GameControl />
          </AppLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/obs" element={
        <ProtectedRoute requiredPermissions={['obs.view']}>
          <AppLayout user={user || undefined} onLogout={logout}>
            <ObsControl />
          </AppLayout>
        </ProtectedRoute>
      } />
      
      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <AppRoutes />
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App
