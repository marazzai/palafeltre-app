import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Icon } from '../components/Icon'

export function AppLayout(){
  const [open, setOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  useEffect(()=>{
    const t = localStorage.getItem('token')||''
    if(!t){ setIsAdmin(false); return }
    fetch('/api/v1/me', { headers: { Authorization: `Bearer ${t}` } })
      .then(r=> r.ok ? r.json() : Promise.reject())
      .then(me => setIsAdmin(Array.isArray(me.roles) && me.roles.includes('admin')))
      .catch(()=> setIsAdmin(false))
  },[])
  return (
    <div className="app">
      <aside className={"sidebar " + (open ? 'open' : '')}>
        <div className="brand">
          <Icon name="skate" />
          <span>App Palafeltre</span>
        </div>
        <nav>
          <NavLink to="/" end className={({isActive}) => isActive ? 'active' : ''}><Icon name="home" /> Dashboard</NavLink>
          <NavLink to="/profile" className={({isActive}) => isActive ? 'active' : ''}><Icon name="users" /> Profilo</NavLink>
          <NavLink to="/roles" className={({isActive}) => isActive ? 'active' : ''}><Icon name="tasks" /> Ruoli</NavLink>
          <NavLink to="/users" className={({isActive}) => isActive ? 'active' : ''}><Icon name="users" /> Utenti</NavLink>
          <NavLink to="/maintenance" className={({isActive}) => isActive ? 'active' : ''}><Icon name="wrench" /> Manutenzioni</NavLink>
          <NavLink to="/tasks" className={({isActive}) => isActive ? 'active' : ''}><Icon name="checklist" /> Incarichi</NavLink>
          <NavLink to="/checklists" className={({isActive}) => isActive ? 'active' : ''}><Icon name="tasks" /> Checklist</NavLink>
          <NavLink to="/documents" className={({isActive}) => isActive ? 'active' : ''}><Icon name="files" /> Documenti</NavLink>
          <NavLink to="/shifts" className={({isActive}) => isActive ? 'active' : ''}><Icon name="tasks" /> Turni</NavLink>
          <NavLink to="/my-shifts" className={({isActive}) => isActive ? 'active' : ''}><Icon name="tasks" /> I miei turni</NavLink>
          <NavLink to="/availability" className={({isActive}) => isActive ? 'active' : ''}><Icon name="tasks" /> Disponibilità</NavLink>
            <NavLink to="/game" className={({isActive}) => isActive ? 'active' : ''}><Icon name="tasks" /> Partita</NavLink>
          <NavLink to="/lights" className={({isActive}) => isActive ? 'active' : ''}><Icon name="tasks" /> Controllo Luci</NavLink>
          <NavLink to="/skating" className={({isActive}) => isActive ? 'active' : ''}><Icon name="skate" /> Pattinaggio</NavLink>
          {isAdmin ? (
            <NavLink to="/admin" className={({isActive}) => isActive ? 'active' : ''}><Icon name="settings" /> Admin</NavLink>
          ) : null}
        </nav>
      </aside>
      <main>
        <header className="header">
          <button className="btn btn-outline" onClick={() => setOpen(!open)} aria-label="Apri menu"><Icon name="menu" /></button>
          <div style={{display:'flex', gap:12, alignItems:'center'}}>
            <span className="text-muted" style={{fontSize:14}}>Benvenuto</span>
          </div>
        </header>
        <section className="content">
          <Outlet />
        </section>
      </main>
    </div>
  )
}
