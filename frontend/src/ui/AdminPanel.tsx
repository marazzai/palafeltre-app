import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getToken } from '../auth'

type User = { id:number; username?:string; full_name?:string|null; email:string; roles:string[]; is_active:boolean }
type Role = { id:number; name:string; permissions:string[] }

export default function AdminPanel(){
  const navigate = useNavigate()
  const [tab, setTab] = useState<'users'|'roles'|'modules'|'branding'|'security'>('users')
  // client-side guard: redirect non-admin
  useEffect(()=>{
    const t = localStorage.getItem('token')||''
    if(!t){ navigate('/') ; return }
    fetch('/api/v1/me', { headers: { Authorization: `Bearer ${t}` } })
      .then(r=> r.ok ? r.json() : Promise.reject())
      .then(me => { if(!Array.isArray(me.roles) || !me.roles.includes('admin')) navigate('/') })
      .catch(()=> navigate('/'))
  },[])
  return (
    <div>
      <h1>Amministrazione</h1>
      <div style={{marginBottom:8}}>
        <button className="btn btn-outline" onClick={()=> navigate('/admin/users')}>Apri gestione Utenti (pagina dedicata)</button>
      </div>
      <div style={{display:'flex', gap:8, marginBottom:12}}>
        <button className={tab==='users'?'btn':'btn btn-outline'} onClick={()=>setTab('users')}>Utenti & Ruoli</button>
        <button className={tab==='roles'?'btn':'btn btn-outline'} onClick={()=>setTab('roles')}>Permessi</button>
        <button className={tab==='modules'?'btn':'btn btn-outline'} onClick={()=>setTab('modules')}>Moduli</button>
        <button className={tab==='branding'?'btn':'btn btn-outline'} onClick={()=>setTab('branding')}>Branding & PDF</button>
        <button className={tab==='security'?'btn':'btn btn-outline'} onClick={()=>setTab('security')}>Sicurezza</button>
      </div>
      {tab==='users' && <UsersSection/>}
      {tab==='roles' && <RolesSection/>}
      {tab==='modules' && <ModulesSection/>}
      {tab==='branding' && <BrandingSection/>}
      {tab==='security' && <SecuritySection/>}
      <hr/>
      <AnalyticsBackupSection/>
    </div>
  )
}

function token(){
  return getToken()
}

function UsersSection(){
  const [q, setQ] = useState('')
  const [items, setItems] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const reload = async ()=>{
    const list = await fetch(`/api/v1/users?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r=>r.json()).catch(()=>[])
    setItems(Array.isArray(list)? list: [])
  }
  useEffect(()=>{ reload() },[q])
  useEffect(()=>{ fetch(`/api/v1/roles`, { headers: { Authorization: `Bearer ${token()}` } }).then(r=>r.json()).then(setRoles).catch(()=>{}) },[])

  // Create user modal
  const [showCreate, setShowCreate] = useState(false)
  const [nu, setNu] = useState({ username:'', email:'', full_name:'', password:'' })
  const [generatedPwd, setGeneratedPwd] = useState<string | null>(null)
  const createUser = async ()=>{
    // Use admin endpoint which returns generated password when omitted
    if(!nu.email.trim()) return
    setGeneratedPwd(null)
    const payload: any = { email: nu.email.trim(), full_name: nu.full_name.trim() || undefined }
    if(nu.username.trim()) payload.username = nu.username.trim()
    if(nu.password.trim()) payload.password = nu.password.trim()
    const res = await fetch('/api/v1/admin/users/create', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(payload) })
    if(!res.ok){ const txt = await res.text().catch(()=>null); alert('Errore: '+ (txt||res.status)); return }
    const d = await res.json()
    setGeneratedPwd(d.password || null)
    setNu({ username:'', email:'', full_name:'', password:'' })
    reload()
  }

  // Roles modal
  const [rolesFor, setRolesFor] = useState<User|null>(null)
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([])
  const openRoles = (u: User)=>{
    setRolesFor(u)
    const ids = roles.filter(r=> (u.roles||[]).includes(r.name)).map(r=> r.id)
    setSelectedRoleIds(ids)
  }
  const toggleRole = (id:number)=> setSelectedRoleIds(prev=> prev.includes(id)? prev.filter(x=>x!==id): [...prev,id])
  const saveRoles = async ()=>{
    if(!rolesFor) return
    await fetch(`/api/v1/users/${rolesFor.id}/roles`, { method:'PUT', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ role_ids: selectedRoleIds }) })
    setRolesFor(null); reload()
  }

  // Actions
  const toggleActive = async (u: User)=>{
    await fetch(`/api/v1/users/${u.id}`, { method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ is_active: !u.is_active }) })
    reload()
  }
  const resetPw = async (u: User)=>{
    const npw = prompt(`Nuova password per ${u.username||u.email}?`); if(!npw) return
    await fetch(`/api/v1/admin/users/${u.id}/reset_password`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ new_password: npw }) })
    alert('Password aggiornata')
  }
  return (
    <div>
      <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:8}}>
        <input placeholder="Cerca utente..." value={q} onChange={e=>setQ(e.target.value)} />
        <button className="btn" onClick={()=> setShowCreate(true)}>Aggiungi Utente</button>
      </div>
      <div className="table">
        <div className="thead"><div>Username</div><div>Nome</div><div>Email</div><div>Ruoli</div><div>Stato</div><div>Azioni</div></div>
        {items.map(u=> (
          <div className="tr" key={u.id}>
            <div>{u.username||'-'}</div>
            <div>{u.full_name||'-'}</div>
            <div>{u.email}</div>
            <div>{u.roles.join(', ')}</div>
            <div>{u.is_active? 'Attivo':'Disattivo'}</div>
            <div style={{display:'flex', gap:6}}>
              <button className="btn btn-outline" onClick={()=> openRoles(u)}>Ruoli</button>
              <button className="btn btn-outline" onClick={()=> resetPw(u)}>Reset PW</button>
              <button className="btn btn-outline" onClick={()=> toggleActive(u)}>{u.is_active? 'Disattiva':'Attiva'}</button>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="modal is-open" onClick={()=> setShowCreate(false)}>
          <div className="modal-content" onClick={e=> e.stopPropagation()}>
            <div className="modal-header"><strong>Crea utente</strong></div>
            <div className="modal-body" style={{display:'grid', gap:8}}>
              <label>Username<input className="input" value={nu.username} onChange={e=> setNu({...nu, username: e.target.value})} /></label>
              <label>Email<input className="input" value={nu.email} onChange={e=> setNu({...nu, email: e.target.value})} /></label>
              <label>Nome completo<input className="input" value={nu.full_name} onChange={e=> setNu({...nu, full_name: e.target.value})} /></label>
              <label>Password (opzionale, se vuota verrà generata)<input className="input" type="password" value={nu.password} onChange={e=> setNu({...nu, password: e.target.value})} /></label>
              {generatedPwd && (
                <div style={{background:'#f3f4f6', padding:8, borderRadius:6}}>
                  <div style={{fontSize:13}}>Password generata: <strong style={{fontFamily:'monospace'}}>{generatedPwd}</strong></div>
                  <div style={{marginTop:6}}><button className="btn" onClick={()=> navigator.clipboard?.writeText(generatedPwd || '')}>Copia</button></div>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{display:'flex', justifyContent:'flex-end', gap:8}}>
              <button className="btn btn-outline" onClick={()=> setShowCreate(false)}>Annulla</button>
              <button className="btn" onClick={createUser} disabled={!nu.email.trim()}>Crea</button>
            </div>
          </div>
        </div>
      )}

      {rolesFor && (
        <div className="modal is-open" onClick={()=> setRolesFor(null)}>
          <div className="modal-content" onClick={e=> e.stopPropagation()}>
            <div className="modal-header"><strong>Ruoli per {rolesFor.username||rolesFor.email}</strong></div>
            <div className="modal-body" style={{display:'grid', gap:6}}>
              {roles.map(r=> (
                <label key={r.id} style={{display:'flex', alignItems:'center', gap:8}}>
                  <input type="checkbox" checked={selectedRoleIds.includes(r.id)} onChange={()=> toggleRole(r.id)} />
                  <span>{r.name}</span>
                </label>
              ))}
            </div>
            <div className="modal-footer" style={{display:'flex', justifyContent:'flex-end', gap:8}}>
              <button className="btn btn-outline" onClick={()=> setRolesFor(null)}>Annulla</button>
              <button className="btn" onClick={saveRoles}>Salva</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RolesSection(){
  const [roles, setRoles] = useState<Role[]>([])
  const [perms, setPerms] = useState<{id:number; code:string; description?:string}[]>([])
  const [roleId, setRoleId] = useState<number|undefined>(undefined)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [showCreate, setShowCreate] = useState(false)
  const [newRole, setNewRole] = useState('')
  const [renameTo, setRenameTo] = useState('')
  useEffect(()=>{
    fetch(`/api/v1/roles`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r=>r.json()).then(setRoles).catch(()=>{})
    fetch(`/api/v1/permissions`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r=>r.json()).then(setPerms).catch(()=>{})
  },[])
  useEffect(()=>{
    const cur = roles.find(r=> r.id===roleId)
    if(cur){
      const map: Record<string, boolean> = {}
      cur.permissions.forEach(c=> map[c]=true)
      setChecked(map)
    } else {
      setChecked({})
    }
  },[roleId, roles])
  const grouped = useMemo(()=>{
    const g: Record<string, {code:string; description?:string}[]> = {}
    perms.forEach(p=>{
      const mod = p.code.includes('.') ? p.code.split('.')[0] : 'varie'
      g[mod] = g[mod] || []
      g[mod].push({ code: p.code, description: p.description })
    })
    return g
  },[perms])
  const toggle = (code:string)=> setChecked(prev=> ({...prev, [code]: !prev[code]}))
  const save = async ()=>{
    if(!roleId) return
    const list = Object.keys(checked).filter(c=> checked[c])
    await fetch(`/api/v1/roles/${roleId}/permissions`, { method:'PUT', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ permissions: list }) })
    // refresh roles to reflect changes
    const rs = await fetch(`/api/v1/roles`, { headers: { Authorization: `Bearer ${token()}` } }).then(r=>r.json())
    setRoles(rs)
  }
  const reloadRoles = async ()=> setRoles(await fetch(`/api/v1/roles`, { headers: { Authorization: `Bearer ${token()}` } }).then(r=>r.json()))
  const createRole = async ()=>{
    if(!newRole.trim()) return
    await fetch('/api/v1/roles', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ name: newRole.trim() }) })
    setShowCreate(false); setNewRole(''); reloadRoles()
  }
  const deleteRole = async ()=>{
    if(!roleId) return
    if(!confirm('Eliminare questo ruolo?')) return
    await fetch(`/api/v1/roles/${roleId}`, { method:'DELETE', headers:{ Authorization: `Bearer ${token()}` } })
    setRoleId(undefined); reloadRoles()
  }
  const renameRole = async ()=>{
    if(!roleId || !renameTo.trim()) return
    await fetch(`/api/v1/roles/${roleId}`, { method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ name: renameTo.trim() }) })
    setRenameTo(''); reloadRoles()
  }
  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
        <h3>Permessi</h3>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <select value={roleId ?? ''} onChange={e=> setRoleId(e.target.value? Number(e.target.value): undefined)}>
            <option value="">Seleziona ruolo…</option>
            {roles.map(r=> <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button className="btn btn-outline" onClick={()=> setShowCreate(true)}>Nuovo ruolo</button>
          <button className="btn btn-outline" onClick={deleteRole} disabled={!roleId}>Elimina</button>
          <div style={{display:'flex', gap:6, alignItems:'center'}}>
            <input placeholder="Rinomina ruolo…" value={renameTo} onChange={e=> setRenameTo(e.target.value)} style={{width:160}} />
            <button className="btn btn-outline" onClick={renameRole} disabled={!roleId || !renameTo.trim()}>Rinomina</button>
          </div>
          <button className="btn" onClick={save} disabled={!roleId}>Salva permessi</button>
        </div>
      </div>
      {!roleId ? <p className="text-muted">Seleziona un ruolo per gestire i permessi.</p> : (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:12}}>
          {Object.entries(grouped).map(([mod, list])=> (
            <div key={mod} className="card"><div className="card-body">
              <div style={{fontWeight:600, marginBottom:8}}>{mod}</div>
              <div style={{display:'flex', flexDirection:'column', gap:6}}>
                {list.map(p=> (
                  <label key={p.code} style={{display:'flex', gap:8, alignItems:'center'}}>
                    <input type="checkbox" checked={!!checked[p.code]} onChange={()=> toggle(p.code)} />
                    <span>{p.code}</span>
                  </label>
                ))}
              </div>
            </div></div>
          ))}
        </div>
      )}
      {showCreate && (
        <div className="modal is-open" onClick={()=> setShowCreate(false)}>
          <div className="modal-content" onClick={e=> e.stopPropagation()}>
            <div className="modal-header"><strong>Crea nuovo ruolo</strong></div>
            <div className="modal-body">
              <input className="input" placeholder="Nome ruolo" value={newRole} onChange={e=> setNewRole(e.target.value)} />
            </div>
            <div className="modal-footer" style={{display:'flex', justifyContent:'flex-end', gap:8}}>
              <button className="btn btn-outline" onClick={()=> setShowCreate(false)}>Annulla</button>
              <button className="btn" onClick={createRole} disabled={!newRole.trim()}>Crea</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ModulesSection(){
  // Settings
  const [settings, setSettings] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(true)
  useEffect(()=>{ (async()=>{
    try{
      const list = await fetch('/api/v1/admin/settings', { headers: { Authorization: `Bearer ${token()}` } }).then(r=>r.json())
      const map: Record<string,string> = {}
      list.forEach((it:any)=> map[it.key]=it.value)
      setSettings(map)
    } finally{ setLoading(false) }
  })() },[])
  const set = (k:string,v:string)=> setSettings(prev=> ({...prev, [k]: v}))
  const save = async ()=>{
    const keys = ['obs.host','obs.port','obs.password','obs.scene','skating.jingle_lead_minutes','dali.gateway_ip','scoreboard.home_name','scoreboard.away_name','scoreboard.home_color','scoreboard.away_color']
    const items = keys.filter(k=> settings[k]!==undefined).map(k=> ({ key:k, value: String(settings[k] ?? '') }))
    await fetch('/api/v1/admin/settings', { method:'PUT', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(items) })
    alert('Impostazioni salvate')
  }
  // Audio manager
  const [audio, setAudio] = useState<{name:string,size:number}[]>([])
  const reloadAudio = async ()=>{
    const d = await fetch('/api/v1/admin/skating/audio', { headers: { Authorization: `Bearer ${token()}` } }).then(r=>r.json()).catch(()=>({items:[]}))
    setAudio(d.items||[])
  }
  useEffect(()=>{ reloadAudio() },[])
  const [file, setFile] = useState<File|null>(null)
  const upload = async ()=>{
    if(!file) return
    const form = new FormData(); form.append('file', file)
    await fetch('/api/v1/admin/skating/audio/upload', { method:'POST', headers: { Authorization: `Bearer ${token()}` }, body: form as any })
    setFile(null); reloadAudio()
  }
  const rename = async (name:string)=>{
    const nn = prompt('Nuovo nome file', name); if(!nn || nn===name) return
    await fetch(`/api/v1/admin/skating/audio/${encodeURIComponent(name)}/rename`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ new_name: nn }) })
    reloadAudio()
  }
  const del = async (name:string)=>{
    if(!confirm(`Eliminare ${name}?`)) return
    await fetch(`/api/v1/admin/skating/audio/${encodeURIComponent(name)}`, { method:'DELETE', headers: { Authorization: `Bearer ${token()}` } })
    reloadAudio()
  }
  // DALI mapping editor
      // DALI mapping editor (tabular)
      type DaliRow = { id:number; name:string }
      const [daliRows, setDaliRows] = useState<DaliRow[]>([])
      const loadDali = async ()=>{
        const r = await fetch('/api/v1/admin/dali/mapping', { headers: { Authorization: `Bearer ${token()}` } }).then(r=>r.json()).catch(()=>({mapping:'[]'}))
        let arr: any = []
        try{ arr = typeof r.mapping === 'string' ? JSON.parse(r.mapping||'[]') : (r.mapping||[]) }catch{ arr = [] }
        if(Array.isArray(arr)) setDaliRows(arr)
      }
      const saveDali = async ()=>{
        await fetch('/api/v1/admin/dali/mapping', { method:'PUT', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ mapping: daliRows }) })
        alert('Mapping DALI salvato')
      }
      useEffect(()=>{ loadDali() },[])
      const addDaliRow = ()=> setDaliRows(prev=> [...prev, { id: (prev[prev.length-1]?.id ?? 0)+1, name:'' }])
      const delDaliRow = (id:number)=> setDaliRows(prev=> prev.filter(r=> r.id!==id))
      const setDaliCell = (id:number, key:'id'|'name', val:string)=> setDaliRows(prev=> prev.map(r=> r.id===id? { ...r, [key]: key==='id'? Number(val): val }: r))

  // Scoreboard logos
  const [logoHome, setLogoHome] = useState<File|null>(null)
  const [logoAway, setLogoAway] = useState<File|null>(null)
      const [logoHomeUrl, setLogoHomeUrl] = useState<string>('')
      const [logoAwayUrl, setLogoAwayUrl] = useState<string>('')
      const loadLogo = async (side:'home'|'away')=>{
        try{
          const r = await fetch(`/api/v1/admin/scoreboard/logo/${side}`, { headers: { Authorization: `Bearer ${token()}` } })
          if(!r.ok) return
          const blob = await r.blob(); const url = URL.createObjectURL(blob)
          if(side==='home') setLogoHomeUrl(url); else setLogoAwayUrl(url)
        }catch{}
      }
  const uploadLogo = async (side:'home'|'away')=>{
    const f = side==='home' ? logoHome : logoAway; if(!f) return
    const form = new FormData(); form.append('file', f)
    await fetch(`/api/v1/admin/scoreboard/logo/${side}`, { method:'POST', headers:{ Authorization: `Bearer ${token()}` }, body: form as any })
        await loadLogo(side)
        alert(`Logo ${side} aggiornato`)
  }
      useEffect(()=>{ loadLogo('home'); loadLogo('away'); return ()=>{ try{ if(logoHomeUrl) URL.revokeObjectURL(logoHomeUrl); if(logoAwayUrl) URL.revokeObjectURL(logoAwayUrl) }catch{} } },[])

      // OBS scan
      const [obsScenes, setObsScenes] = useState<string[]>([])
          const [obsInfo, setObsInfo] = useState<{has_library:boolean; host:string; port:number; scene:string}|null>(null)
          const scanObs = async ()=>{
            try{
              if(obsInfo && !obsInfo.has_library){ alert('OBS client library not installed on server'); return }
              const r = await fetch('/api/v1/admin/obs/scan', { headers: { Authorization: `Bearer ${token()}` } })
              if(!r.ok){ const txt = await r.text(); alert('Scan failed: ' + txt); return }
              const d = await r.json()
              setObsScenes(d.scenes || [])
            }catch(e){ alert('Scan error') }
          }
          const loadObsInfo = async ()=>{
            try{
              const r = await fetch('/api/v1/admin/obs/info', { headers: { Authorization: `Bearer ${token()}` } })
              if(!r.ok) return
              const d = await r.json()
              setObsInfo(d)
            }catch(e){}
          }
          useEffect(()=>{ loadObsInfo() },[])

  // Ticket categories
  type Cat = { id:number; name:string; color?:string; sort_order:number }
  const [cats, setCats] = useState<Cat[]>([])
  const loadCats = async ()=>{
    const list = await fetch('/api/v1/admin/tickets/categories', { headers:{ Authorization: `Bearer ${token()}` } }).then(r=>r.json()).catch(()=>[])
    setCats(list)
  }
  useEffect(()=>{ loadCats() },[])
  const addCat = async ()=>{
    const name = prompt('Nome categoria?'); if(!name) return
    const color = prompt('Colore (es. #ff6600)?')||''
    await fetch('/api/v1/admin/tickets/categories', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ name, color, sort_order: (cats[cats.length-1]?.sort_order ?? 0)+1 }) })
    loadCats()
  }
  const editCat = async (c:Cat)=>{
    const name = prompt('Nome categoria', c.name) || c.name
    const color = prompt('Colore', c.color||'') || c.color
    const sort = Number(prompt('Ordinamento', String(c.sort_order)))||c.sort_order
    await fetch(`/api/v1/admin/tickets/categories/${c.id}`, { method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ name, color, sort_order: sort }) })
    loadCats()
  }
  const delCat = async (c:Cat)=>{
    if(!confirm(`Eliminare categoria ${c.name}?`)) return
    await fetch(`/api/v1/admin/tickets/categories/${c.id}`, { method:'DELETE', headers:{ Authorization: `Bearer ${token()}` } })
    loadCats()
  }

  if(loading) return <p className="text-muted">Caricamento impostazioni…</p>
  return (
    <div>
      <h3>Pattinaggio Pubblico</h3>
      <div className="card"><div className="card-body" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12}}>
        <label>OBS Host<input value={settings['obs.host']||''} onChange={e=> set('obs.host', e.target.value)} /></label>
        <label>OBS Porta<input value={settings['obs.port']||''} onChange={e=> set('obs.port', e.target.value)} /></label>
        <label>OBS Password<input type="password" value={settings['obs.password']||''} onChange={e=> set('obs.password', e.target.value)} /></label>
        <label>Scena OBS<input value={settings['obs.scene']||''} onChange={e=> set('obs.scene', e.target.value)} /></label>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <button className="btn btn-outline" onClick={scanObs}>Scansiona Scene OBS</button>
          <select value={settings['obs.scene']||''} onChange={e=> set('obs.scene', e.target.value)}>
            <option value="">-- seleziona scena --</option>
            {obsScenes.map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <label>Minuti anticipo jingle<input value={settings['skating.jingle_lead_minutes']||''} onChange={e=> set('skating.jingle_lead_minutes', e.target.value)} /></label>
      </div></div>
      <h4 style={{marginTop:12}}>File Audio</h4>
      <div className="card"><div className="card-body">
        <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:8}}>
          <input type="file" onChange={e=> setFile(e.target.files?.[0]||null)} />
          <button className="btn" onClick={upload} disabled={!file}>Carica</button>
        </div>
        <div className="table">
          <div className="thead"><div>Nome</div><div>Dimensione</div><div>Azioni</div></div>
          {audio.map(a=> (
            <div className="tr" key={a.name}>
              <div>{a.name}</div>
              <div>{(a.size/1024).toFixed(1)} KB</div>
              <div style={{display:'flex', gap:8}}>
                <button className="btn btn-outline" onClick={()=> rename(a.name)}>Rinomina</button>
                <button className="btn btn-outline" onClick={()=> del(a.name)}>Elimina</button>
              </div>
            </div>
          ))}
        </div>
      </div></div>

      <h3 style={{marginTop:16}}>Controllo Luci DALI</h3>
      <div className="card"><div className="card-body" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12}}>
        <label>Gateway IP<input value={settings['dali.gateway_ip']||''} onChange={e=> set('dali.gateway_ip', e.target.value)} /></label>
      </div></div>
      <div className="card" style={{marginTop:8}}><div className="card-body">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
          <strong>Mapping Oggetti DALI</strong>
          <div style={{display:'flex', gap:8}}>
            <button className="btn btn-outline" onClick={addDaliRow}>Aggiungi riga</button>
            <button className="btn" onClick={saveDali}>Salva Mapping</button>
          </div>
        </div>
        <div className="table">
          <div className="thead"><div>ID</div><div>Nome</div><div>Azioni</div></div>
          {daliRows.map(r=> (
            <div className="tr" key={r.id}>
              <div><input value={r.id} onChange={e=> setDaliCell(r.id,'id', e.target.value)} style={{width:80}} /></div>
              <div><input value={r.name} onChange={e=> setDaliCell(r.id,'name', e.target.value)} /></div>
              <div><button className="btn btn-outline" onClick={()=> delDaliRow(r.id)}>Elimina</button></div>
            </div>
          ))}
        </div>
      </div></div>

      <h3 style={{marginTop:16}}>Scoreboard</h3>
      <div className="card"><div className="card-body" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12}}>
        <label>Casa - Nome<input value={settings['scoreboard.home_name']||''} onChange={e=> set('scoreboard.home_name', e.target.value)} /></label>
        <label>Ospiti - Nome<input value={settings['scoreboard.away_name']||''} onChange={e=> set('scoreboard.away_name', e.target.value)} /></label>
        <label>Casa - Colore<input type="color" value={settings['scoreboard.home_color']||'#ffffff'} onChange={e=> set('scoreboard.home_color', e.target.value)} /></label>
        <label>Ospiti - Colore<input type="color" value={settings['scoreboard.away_color']||'#ffffff'} onChange={e=> set('scoreboard.away_color', e.target.value)} /></label>
      </div></div>
      <div className="card" style={{marginTop:8}}><div className="card-body" style={{display:'flex', gap:12, alignItems:'center'}}>
        <div>
          <div><strong>Logo Casa</strong></div>
          <input type="file" accept="image/*" onChange={e=> setLogoHome(e.target.files?.[0]||null)} />
          <button className="btn" onClick={()=> uploadLogo('home')} disabled={!logoHome}>Carica</button>
          {logoHomeUrl && <div style={{marginTop:8}}><img src={logoHomeUrl} alt="Logo Casa" style={{height:60, objectFit:'contain', background:'#fff', padding:4, borderRadius:6}} /></div>}
        </div>
        <div>
          <div><strong>Logo Ospiti</strong></div>
          <input type="file" accept="image/*" onChange={e=> setLogoAway(e.target.files?.[0]||null)} />
          <button className="btn" onClick={()=> uploadLogo('away')} disabled={!logoAway}>Carica</button>
          {logoAwayUrl && <div style={{marginTop:8}}><img src={logoAwayUrl} alt="Logo Ospiti" style={{height:60, objectFit:'contain', background:'#fff', padding:4, borderRadius:6}} /></div>}
        </div>
      </div></div>

      <h3 style={{marginTop:16}}>Segnalazioni e Manutenzioni - Categorie</h3>
      <div className="card"><div className="card-body">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
          <strong>Categorie</strong>
          <button className="btn" onClick={addCat}>Aggiungi Categoria</button>
        </div>
        <div className="table">
          <div className="thead"><div>Nome</div><div>Colore</div><div>Ordine</div><div>Azioni</div></div>
          {cats.map(c=> (
            <div className="tr" key={c.id}>
              <div>{c.name}</div>
              <div><span style={{display:'inline-block', width:14, height:14, background:c.color||'#ccc', border:'1px solid #999', verticalAlign:'middle', marginRight:6}}></span>{c.color||'-'}</div>
              <div>{c.sort_order}</div>
              <div style={{display:'flex', gap:8}}>
                <button className="btn btn-outline" onClick={()=> editCat(c)}>Modifica</button>
                <button className="btn btn-outline" onClick={()=> delCat(c)}>Elimina</button>
              </div>
            </div>
          ))}
        </div>
      </div></div>

      <div style={{marginTop:12, display:'flex', justifyContent:'flex-end'}}>
        <button className="btn" onClick={save}>Salva Impostazioni</button>
      </div>
    </div>
  )
}

function BrandingSection(){
  const [footer, setFooter] = useState('')
  const save = ()=>{
    fetch('/api/v1/admin/branding', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ pdf_footer_text: footer })})
  }
  return (
    <div>
      <h3>Branding & PDF</h3>
      <label>Piè di pagina PDF</label>
      <input value={footer} onChange={e=>setFooter(e.target.value)} placeholder="Testo footer" />
      <button className="btn" onClick={save}>Salva</button>
    </div>
  )
}

function SecuritySection(){
  const [items, setItems] = useState<any[]>([])
  useEffect(()=>{
    fetch('/api/v1/admin/audit', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r=>r.json()).then(setItems).catch(()=>{})
  },[])
  return (
    <div>
      <h3>Audit Log</h3>
      <div className="table">
        <div className="thead"><div>Timestamp</div><div>Utente</div><div>Azione</div><div>Dettagli</div></div>
        {items.map((a,i)=> (
          <div className="tr" key={i}>
            <div>{new Date(a.timestamp).toLocaleString()}</div>
            <div>{a.user_id ?? '-'}</div>
            <div>{a.action}</div>
            <div>{a.details||''}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AnalyticsBackupSection(){
  const [summary, setSummary] = useState<any>({})
  const [busy, setBusy] = useState(false)
  const [backups, setBackups] = useState<any[]>([])
  useEffect(()=>{
    fetch('/api/v1/admin/analytics/summary', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r=>r.json()).then(setSummary).catch(()=>{})
    fetch('/api/v1/admin/backup/list', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r=>r.json()).then(setBackups).catch(()=>{})
  },[])
  const backup = async ()=>{
    setBusy(true)
    try{
      const r = await fetch('/api/v1/admin/backup/create', { method:'POST', headers: { Authorization: `Bearer ${token()}` }})
      const d = await r.json()
      alert(`Backup creato: ${d.file_name} (${(d.size/1024/1024).toFixed(2)} MB)`)
      const list = await fetch('/api/v1/admin/backup/list', { headers: { Authorization: `Bearer ${token()}` } }).then(r=>r.json())
      setBackups(list)
    } finally{
      setBusy(false)
    }
  }
  return (
    <div style={{marginTop:16}}>
      <h3>Analytics & Backup</h3>
      <div className="card"><div className="card-body" style={{display:'flex', gap:16}}>
        <div><strong>Tickets:</strong> {summary.tickets ?? '-'}</div>
        <div><strong>Open:</strong> {summary.tickets_open ?? '-'}</div>
        <div><strong>Tasks:</strong> {summary.tasks ?? '-'}</div>
        <div><strong>Documenti:</strong> {summary.documents ?? '-'}</div>
        <div><strong>Utenti:</strong> {summary.users ?? '-'}</div>
      </div></div>
      <div style={{marginTop:8}}>
        <button className="btn" onClick={backup} disabled={busy}>{busy? 'Backup in corso...' : 'Crea Backup Database'}</button>
      </div>
      <div className="card" style={{marginTop:12}}><div className="card-body">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <strong>Backup disponibili</strong>
          <button className="btn btn-outline" onClick={async()=> setBackups(await fetch('/api/v1/admin/backup/list', { headers: { Authorization: `Bearer ${token()}` } }).then(r=>r.json()))}>Aggiorna</button>
        </div>
        <div className="table">
          <div className="thead"><div>File</div><div>Creato</div><div>Dimensione</div><div>Azioni</div></div>
          {backups.map((b,i)=> (
            <div className="tr" key={i}>
              <div>{b.name}</div>
              <div>{new Date(b.created_at).toLocaleString()}</div>
              <div>{(b.size/1024/1024).toFixed(2)} MB</div>
              <div><a className="btn btn-outline" href={`/api/v1/admin/backup/download/${encodeURIComponent(b.name)}`} target="_blank" rel="noreferrer">Scarica</a></div>
            </div>
          ))}
        </div>
      </div></div>
    </div>
  )
}
