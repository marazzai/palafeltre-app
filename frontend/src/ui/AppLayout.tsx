import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { clearToken, getToken } from '../auth'
import { menuItems as sharedMenu } from '../menu'
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

const menuItems: MenuItem[] = sharedMenu

export function AppLayout(){
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [rolePages, setRolePages] = useState<string[] | null>(null)
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
          // fetch pages allowed for this user (merged from roles)
          try{
            const rp = await fetch('/api/v1/me/role-pages', { headers: { Authorization: `Bearer ${t}` } }).then(r=> r.ok ? r.json() : { pages: [] })
            setRolePages(Array.isArray(rp.pages) ? rp.pages : [])
          }catch{ setRolePages([]) }
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
    // If rolePages has been loaded, only allow items present in that list (admins bypass)
    if(user.roles.includes('admin')) return true
    if(rolePages === null) return true // still loading pages -> optimistic show
    return rolePages.includes(item.path) || item.path === '/' // always allow dashboard
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
            <span className="text-muted" style={{fontSize:14}}>{user ? `Ciao, ${user.username}` : 'Benvenuto'}</span>
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
