import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { clearToken, getToken } from '../auth'
import { useNotifications } from '../utils/useNotifications'
import { NotificationCenter } from '../components/NotificationCenter'

type UserInfo = {
  id: number
  username: string
  email: string
  roles: string[]
  permissions?: string[]
}

type MenuItem = {
  path: string
  label: string
  icon: 'home' | 'wrench' | 'checklist' | 'files' | 'tasks' | 'skate' | 'settings' | 'ok' | 'logout'
  requireAdmin?: boolean
  requirePermission?: string
}

const menuItems: MenuItem[] = [
  { path: '/', label: 'Dashboard', icon: 'home' },
  { path: '/maintenance', label: 'Manutenzioni', icon: 'wrench' },
  { path: '/tasks', label: 'Incarichi', icon: 'checklist' },
  { path: '/documents', label: 'Documenti', icon: 'files' },
  { path: '/shifts', label: 'Turni', icon: 'tasks' },
  { path: '/my-shifts', label: 'I Miei Turni', icon: 'tasks' },
  { path: '/availability', label: 'Disponibilità', icon: 'tasks' },
  { path: '/game', label: 'Partita', icon: 'tasks' },
  { path: '/scoreboard', label: 'Scoreboard', icon: 'ok' },
  { path: '/lights', label: 'Controllo Luci', icon: 'tasks' },
  { path: '/skating', label: 'Pattinaggio', icon: 'skate' },
  { path: '/skate-rental', label: 'Noleggio Pattini', icon: 'skate' },
  { path: '/admin', label: 'Amministrazione', icon: 'settings', requireAdmin: true },
]

export function AppLayout(){
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<UserInfo | null>(null)
  const navigate = useNavigate()
  
  // Notifications system
  const { notifications, unreadCount, markAsRead, clearAll, removeNotification } = useNotifications(user?.id || null)
  
  useEffect(()=>{
    const t = getToken()
    if(!t){ setUser(null); return }
    fetch('/api/v1/me', { headers: { Authorization: `Bearer ${t}` } })
      .then(r=> r.ok ? r.json() : Promise.reject())
      .then(async (me: UserInfo) => {
        // also fetch permissions
        try{
          const p = await fetch('/api/v1/me/permissions', { headers: { Authorization: `Bearer ${t}` } }).then(r=> r.ok ? r.json() : { permissions: [] })
          me.permissions = p.permissions || []
        }catch{}
        setUser(me)
      })
      .catch(()=> setUser(null))
  },[])
  // session-only auth: no refresh or countdown
  
  function onLogout(){
    clearToken()
    setUser(null)
    navigate('/login')
  }
  
  function onClickLink(){
    setOpen(false)
  }
  
  function canAccess(item: MenuItem): boolean {
    if (!user) return false
    if (item.requireAdmin) {
      return user.roles.includes('admin')
    }
    if (item.requirePermission) {
      return user.permissions?.includes(item.requirePermission) || user.roles.includes('admin')
    }
    return true
  }
  
  const visibleItems = menuItems.filter(canAccess)
  
  return (
    <div className="app">
      <aside className={"sidebar " + (open ? 'open' : '')}>
        <div className="brand">
          <Icon name="skate" />
          <span>Palafeltre</span>
        </div>
        <nav>
          {visibleItems.map(item => (
            <NavLink 
              key={item.path} 
              to={item.path} 
              end={item.path === '/'}
              onClick={onClickLink} 
              className={({isActive}) => isActive ? 'active' : ''}
            >
              <Icon name={item.icon} /> {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main>
        <header className="header">
          <div className="header-left">
            <button 
              className="btn btn-outline btn-sm" 
              onClick={() => setOpen(!open)} 
              aria-label="Apri menu"
            >
              <Icon name="menu" />
            </button>
          </div>
          <div className="header-right">
            <span className="text-secondary" style={{fontSize: 'var(--text-sm)'}}>
              {user ? `Ciao, ${user.username}` : 'Benvenuto'}
            </span>
            {getToken() && (
              <NotificationCenter
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkAsRead={markAsRead}
                onClearAll={clearAll}
                onRemove={removeNotification}
              />
            )}
            {!getToken() ? (
              <button className="btn btn-primary" onClick={()=>navigate('/login')}>
                Accedi
              </button>
            ) : (
              <button className="btn btn-outline btn-sm" onClick={onLogout}>
                <Icon name="logout" />
                Esci
              </button>
            )}
          </div>
        </header>
        <section className="content">
          <Outlet />
        </section>
      </main>
    </div>
  )
}
