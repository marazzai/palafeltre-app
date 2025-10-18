import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './ui/AppLayout'
import AdminPanel from './ui/AdminPanel'
import AdminUsers from './ui/admin/Users'
import AdminObs from './ui/admin/Obs'
import { Dashboard } from './ui/Dashboard'
import { SkatingControl } from './ui/SkatingControl'
import { SkatingPlayer } from './ui/SkatingPlayer'
import { SkatingDisplay } from './ui/SkatingDisplay'
import { LockerRoomMonitor } from './ui/LockerRoomMonitor'
import { GameControl } from './ui/GameControl'
import { GameScoreboard } from './ui/GameScoreboard'
import ChangePassword from './ui/ChangePassword'
import { LightsControl } from './ui/LightsControl'
import { TasksPage } from './ui/TasksPage'
import { MaintenanceKanban } from './ui/MaintenanceKanban'
import { DocumentsPage } from './ui/DocumentsPage'
import { ShiftsCalendar } from './ui/ShiftsCalendar'
import ShiftsPage from './ui/ShiftsPage'
import SkateRentalPage from './ui/SkateRentalPage'
import Profile from './ui/Profile'
import Login from './ui/Login'
import ProtectedRoute from './components/ProtectedRoute'

const Placeholder = ({ title }: { title: string }) => (
  <div className="container">
    <h2 style={{ marginBottom: 12 }}>{title}</h2>
    <p className="text-muted">Questa pagina verrà implementata a breve.</p>
  </div>
)

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/change-password', element: <ChangePassword /> },
  { path: '/scoreboard', element: <GameScoreboard /> },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'profile', element: <Profile /> },
          // All app pages are protected
          { path: 'maintenance', element: <MaintenanceKanban /> },
          { path: 'tasks', element: <TasksPage /> },
          { path: 'checklists', element: <Placeholder title="Checklist" /> },
          { path: 'documents', element: <DocumentsPage /> },
          { path: 'skating', element: <SkatingControl /> },
          { path: 'skating/player', element: <SkatingPlayer /> },
          { path: 'skating/display', element: <SkatingDisplay /> },
          { path: 'game', element: <GameControl /> },
          { path: 'lights', element: <LightsControl /> },
          { path: 'shifts', element: <ShiftsPage /> },
          { path: 'skate-rental', element: <SkateRentalPage /> },
          { path: 'admin', element: <AdminPanel /> },
          { path: 'admin/users', element: <AdminUsers /> },
          { path: 'admin/obs', element: <AdminObs /> },
        ],
      },
    ],
  },
])
