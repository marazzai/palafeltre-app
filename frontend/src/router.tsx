import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './ui/AppLayout'
import AdminPanel from './ui/AdminPanel'
import { Dashboard } from './ui/Dashboard'
import { SkatingControl } from './ui/SkatingControl'
import { SkatingPlayer } from './ui/SkatingPlayer'
import { SkatingDisplay } from './ui/SkatingDisplay'
import { GameControl } from './ui/GameControl'
import { GameScoreboard } from './ui/GameScoreboard'
import { LightsControl } from './ui/LightsControl'
import { TasksPage } from './ui/TasksPage'
import { MaintenanceKanban } from './ui/MaintenanceKanban'
import { DocumentsPage } from './ui/DocumentsPage'
import { ShiftsCalendar } from './ui/ShiftsCalendar'
import { MyShifts } from './ui/MyShifts'
import { AvailabilityPage } from './ui/AvailabilityPage'

const Placeholder = ({ title }: { title: string }) => (
  <div className="container">
    <h2 style={{ marginBottom: 12 }}>{title}</h2>
    <p className="text-muted">Questa pagina verrà implementata a breve.</p>
  </div>
)

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'profile', element: <Placeholder title="Profilo Utente" /> },
      { path: 'roles', element: <Placeholder title="Gestione Ruoli" /> },
      { path: 'roles/:id', element: <Placeholder title="Modifica Ruolo" /> },
      { path: 'users', element: <Placeholder title="Gestione Utenti" /> },
  { path: 'maintenance', element: <MaintenanceKanban /> },
  { path: 'tasks', element: <TasksPage /> },
      { path: 'checklists', element: <Placeholder title="Checklist" /> },
  { path: 'documents', element: <DocumentsPage /> },
      { path: 'skating', element: <SkatingControl /> },
      { path: 'skating/control', element: <SkatingControl /> },
      { path: 'skating/player', element: <SkatingPlayer /> },
      { path: 'skating/display', element: <SkatingDisplay /> },
      { path: 'game', element: <GameControl /> },
      { path: 'scoreboard', element: <GameScoreboard /> },
      { path: 'lights', element: <LightsControl /> },
      { path: 'shifts', element: <ShiftsCalendar /> },
      { path: '/admin', element: <AdminPanel /> },
      { path: 'my-shifts', element: <MyShifts /> },
      { path: 'availability', element: <AvailabilityPage /> },
    ],
  },
])
