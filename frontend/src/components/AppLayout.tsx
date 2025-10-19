import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ThemeToggle } from '../hooks/useTheme'
import { Button } from './ui'

interface NavigationItem {
  path: string
  label: string
  icon?: string
  requiredPermissions?: string[]
}

interface AppLayoutProps {
  children: React.ReactNode
  user?: {
    id: number
    username: string
    full_name?: string
    email: string
    roles: Array<{
      name: string
      permissions: Array<{
        code: string
        description?: string
      }>
    }>
  }
  onLogout: () => void
}

const navigationItems: NavigationItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: 'home'
  },
  {
    path: '/game',
    label: 'Tabellone',
    icon: 'play-circle',
    requiredPermissions: ['game.control']
  },
  {
    path: '/obs',
    label: 'OBS Control',
    icon: 'video',
    requiredPermissions: ['obs.control']
  },
  {
    path: '/admin',
    label: 'Amministrazione',
    icon: 'settings',
    requiredPermissions: ['admin.access']
  }
]

function hasPermission(user: AppLayoutProps['user'], permission: string): boolean {
  if (!user) return false
  
  return user.roles.some(role => 
    role.permissions.some(p => p.code === permission)
  )
}

function hasAnyPermission(user: AppLayoutProps['user'], permissions: string[]): boolean {
  if (!permissions.length) return true
  return permissions.some(permission => hasPermission(user, permission))
}

export function AppLayout({ children, user, onLogout }: AppLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const filteredNavigation = navigationItems.filter(item => 
    !item.requiredPermissions || hasAnyPermission(user, item.requiredPermissions)
  )

  const handleLogout = () => {
    onLogout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-primary">
      {/* Header */}
      <header className="nav">
        <div className="nav-content">
          <Link to="/dashboard" className="nav-brand">
            Palafeltre
          </Link>
          
          <nav className="nav-links">
            {filteredNavigation.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            
            {user && (
              <div className="flex items-center gap-3">
                <div className="text-sm">
                  <div className="font-medium text-primary">
                    {user.full_name || user.username}
                  </div>
                  <div className="text-secondary text-xs">
                    {user.roles.map(r => r.name).join(', ')}
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                >
                  Logout
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        {children}
      </main>
    </div>
  )
}

// Hook per verificare i permessi
export function usePermissions(user: AppLayoutProps['user']) {
  const checkPermission = (permission: string) => hasPermission(user, permission)
  const checkAnyPermission = (permissions: string[]) => hasAnyPermission(user, permissions)
  
  return { checkPermission, checkAnyPermission }
}