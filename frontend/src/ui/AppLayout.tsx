import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { clearToken, getToken, getTokenExpiry, setToken } from '../auth'

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
            <span className="text-muted" style={{fontSize:14}}>Benvenuto{remaining!=null? ` · token ${Math.floor((remaining||0)/60)}:${String((remaining||0)%60).padStart(2,'0')}`:''}</span>
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
