import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { clearToken, getToken, getTokenExpiry, setToken } from '../auth'
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
  icon: 'home' | 'wrench' | 'checklist' | 'files' | 'tasks' | 'skate' | 'settings'
  requireAdmin?: boolean
  requirePermission?: string
}

const menuItems: MenuItem[] = [
  { path: '/', label: 'Dashboard', icon: 'home' },
  { path: '/maintenance', label: 'Manutenzioni', icon: 'wrench' },
  { path: '/tasks', label: 'Incarichi', icon: 'checklist' },
  { path: '/documents', label: 'Documenti', icon: 'files' },
  { path: '/shifts', label: 'Turni', icon: 'tasks' },
  { path: '/game', label: 'Partita', icon: 'tasks' },
  { path: '/lights', label: 'Controllo Luci', icon: 'tasks' },
  { path: '/skating', label: 'Pattinaggio', icon: 'skate' },
  { path: '/skate-rental', label: 'Noleggio Pattini', icon: 'skate' },
  { path: '/admin', label: 'Admin', icon: 'settings', requireAdmin: true },
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
      .then((me: UserInfo) => setUser(me))
      .catch(()=> setUser(null))
  },[])
  // token expiry and auto-refresh
  const [remaining, setRemaining] = useState<number | null>(null)
  useEffect(()=>{
    const tick = ()=>{
      const at = getTokenExpiry(); if(!at){ setRemaining(null); return }
      const sec = Math.max(0, Math.floor((at - Date.now())/1000))
      setRemaining(sec)
      if(sec > 0 && sec <= 60){
        // try background refresh once when under 60s
        fetch('/api/v1/auth/refresh', { method:'POST', headers:{ Authorization: `Bearer ${getToken()}` } })
          .then(r=> r.ok? r.json(): Promise.reject())
          .then(d=>{ if(d.access_token) setToken(d.access_token, d.expires_in) })
          .catch(()=>{})
      }
    }
    const id = setInterval(tick, 1000)
    tick()
    return ()=> clearInterval(id)
  },[])
  
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
          <span>App Palafeltre</span>
        </div>
        <nav>
          <NavLink to="/" end onClick={onClickLink} className={({isActive}) => isActive ? 'active' : ''}><Icon name="home" /> Dashboard</NavLink>
          {visibleItems.slice(1).map(item => (
            <NavLink 
              key={item.path} 
              to={item.path} 
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
          <button className="btn btn-outline" onClick={() => setOpen(!open)} aria-label="Apri menu"><Icon name="menu" /></button>
          <div style={{display:'flex', gap:12, alignItems:'center'}}>
            <span className="text-muted" style={{fontSize:14}}>
              {user ? `Ciao, ${user.username}` : 'Benvenuto'}
              {remaining!=null? ` · ${Math.floor((remaining||0)/60)}:${String((remaining||0)%60).padStart(2,'0')}` : ''}
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
              <button className="btn" onClick={()=>navigate('/login')}>Accedi</button>
            ) : (
              <button className="btn btn-outline" onClick={onLogout}>Esci</button>
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
