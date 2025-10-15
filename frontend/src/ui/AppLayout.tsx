import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { clearToken, getToken } from '../auth'

export function AppLayout(){
  const [open, setOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const navigate = useNavigate()
  useEffect(()=>{
    const t = getToken()
    if(!t){ setIsAdmin(false); return }
    fetch('/api/v1/me', { headers: { Authorization: `Bearer ${t}` } })
      .then(r=> r.ok ? r.json() : Promise.reject())
      .then(me => setIsAdmin(Array.isArray(me.roles) && me.roles.includes('admin')))
      .catch(()=> setIsAdmin(false))
  },[])
  function onLogout(){
    clearToken();
    setIsAdmin(false);
    navigate('/login')
  }
  function onClickLink(){
    setOpen(false)
  }
  return (
    <div className="app">
      <aside className={"sidebar " + (open ? 'open' : '')}>
        <div className="brand">
          <Icon name="skate" />
          <span>App Palafeltre</span>
        </div>
        <nav>
          <NavLink to="/" end onClick={onClickLink} className={({isActive}) => isActive ? 'active' : ''}><Icon name="home" /> Dashboard</NavLink>
          <NavLink to="/maintenance" onClick={onClickLink} className={({isActive}) => isActive ? 'active' : ''}><Icon name="wrench" /> Manutenzioni</NavLink>
          <NavLink to="/tasks" onClick={onClickLink} className={({isActive}) => isActive ? 'active' : ''}><Icon name="checklist" /> Incarichi</NavLink>
          <NavLink to="/documents" onClick={onClickLink} className={({isActive}) => isActive ? 'active' : ''}><Icon name="files" /> Documenti</NavLink>
          <NavLink to="/shifts" onClick={onClickLink} className={({isActive}) => isActive ? 'active' : ''}><Icon name="tasks" /> Turni</NavLink>
          <NavLink to="/game" onClick={onClickLink} className={({isActive}) => isActive ? 'active' : ''}><Icon name="tasks" /> Partita</NavLink>
          <NavLink to="/lights" onClick={onClickLink} className={({isActive}) => isActive ? 'active' : ''}><Icon name="tasks" /> Controllo Luci</NavLink>
          <NavLink to="/skating" onClick={onClickLink} className={({isActive}) => isActive ? 'active' : ''}><Icon name="skate" /> Pattinaggio</NavLink>
          {isAdmin ? (
            <NavLink to="/admin" onClick={onClickLink} className={({isActive}) => isActive ? 'active' : ''}><Icon name="settings" /> Admin</NavLink>
          ) : null}
        </nav>
      </aside>
      <main>
        <header className="header">
          <button className="btn btn-outline" onClick={() => setOpen(!open)} aria-label="Apri menu"><Icon name="menu" /></button>
          <div style={{display:'flex', gap:12, alignItems:'center'}}>
            <span className="text-muted" style={{fontSize:14}}>Benvenuto</span>
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
