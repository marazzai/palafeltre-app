import React, { useEffect, useState } from 'react'
import { getToken } from '../../auth'

type UserOut = {
  id: number
  username?: string | null
  email: string
  full_name?: string | null
  is_active: boolean
  roles: string[]
  last_login?: string | null
  must_change_password?: boolean
}

export default function AdminUsers(){
  const [users, setUsers] = useState<UserOut[]>([])
  const [loading, setLoading] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newFullName, setNewFullName] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [generatedPwd, setGeneratedPwd] = useState<string | null>(null)
  const [rolesList, setRolesList] = useState<{id:number;name:string}[]>([])
  const [editingRolesFor, setEditingRolesFor] = useState<UserOut | null>(null)
  const [editingRoleIds, setEditingRoleIds] = useState<number[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  const load = async ()=>{
    setLoading(true)
    try{
      const res = await fetch('/api/v1/admin/users', { headers: { Authorization: `Bearer ${getToken()}` } })
      const data = await res.json()
      setUsers(data)
      // load roles catalog
      const rr = await fetch('/api/v1/roles', { headers: { Authorization: `Bearer ${getToken()}` } }).then(r=>r.json()).catch(()=>[])
      setRolesList(Array.isArray(rr)? rr : [])
    }catch(e){ console.error(e) }
    setLoading(false)
  }

  useEffect(()=>{ load() }, [])

  const createUser = async ()=>{
    setGeneratedPwd(null)
    setFormError(null)
    const payload: any = { email: newEmail, full_name: newFullName }
    if(newUsername) payload.username = newUsername
    // basic validation
    if(!payload.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email)){
      setFormError('Inserisci un indirizzo email valido')
      return
    }
    try{
      const res = await fetch('/api/v1/admin/users/create', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(payload) })
      if(!res.ok){
        const txt = await res.text().catch(()=>null)
        setFormError(txt || 'Errore creazione utente')
        return
      }
      const d = await res.json()
      setGeneratedPwd(d.password || null)
      setNewEmail(''); setNewFullName(''); setNewUsername('')
      load()
    }catch(e){ console.error(e); setFormError('Errore di rete') }
  }

  const resetPwd = async (id:number)=>{
    if(!confirm('Reimpostare la password e inviarla all\'amministratore?')) return
    try{
      const res = await fetch(`/api/v1/admin/users/${id}/reset_password`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } })
      if(!res.ok){ alert('Errore reset'); return }
      const d = await res.json()
      setGeneratedPwd(d.password || null)
      load()
    }catch(e){ console.error(e); alert('Errore') }
  }

  const openEditRoles = (u: UserOut)=>{
    setEditingRolesFor(u)
    // map user role names to ids
    const ids = rolesList.filter(r=> (u.roles||[]).includes(r.name)).map(r=> r.id)
    setEditingRoleIds(ids)
  }
  const toggleRole = (id:number)=> setEditingRoleIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id])
  const saveRoles = async ()=>{
    if(!editingRolesFor) return
    await fetch(`/api/v1/users/${editingRolesFor.id}/roles`, { method: 'PUT', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ role_ids: editingRoleIds }) })
    setEditingRolesFor(null); load()
  }

  return (
    <div style={{padding:20}}>
      <h2>Utenti</h2>
      <div style={{marginBottom:12, maxWidth:640}}>
        <h4>Crea utente</h4>
        <div style={{display:'flex', gap:8}}>
          <input placeholder="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} />
          <input placeholder="username (opzionale)" value={newUsername} onChange={e=>setNewUsername(e.target.value)} />
          <input placeholder="nome completo (opzionale)" value={newFullName} onChange={e=>setNewFullName(e.target.value)} />
          <button onClick={createUser} disabled={!newEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)}>Crea</button>
        </div>
        {formError && <div style={{color:'crimson', marginTop:8}}>{formError}</div>}
        {generatedPwd && (
          <div style={{marginTop:8}}>
            <strong>Password generata:</strong> <code>{generatedPwd}</code> <button onClick={()=>{navigator.clipboard && navigator.clipboard.writeText(generatedPwd)}}>Copia</button>
          </div>
        )}
      </div>

      <h4>Lista utenti</h4>
      {loading ? <div>Caricamento...</div> : (
        <table style={{width:'100%', borderCollapse:'collapse'}}>
          <thead><tr><th>ID</th><th>Email</th><th>Username</th><th>Nome</th><th>Ruoli</th><th>Last login</th><th>Must change</th><th></th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{borderTop:'1px solid #ddd'}}>
                <td>{u.id}</td>
                <td>{u.email}</td>
                <td>{u.username}</td>
                <td>{u.full_name}</td>
                <td>{u.roles.join(', ')}</td>
                <td>{u.last_login ? new Date(u.last_login).toLocaleString() : '-'}</td>
                <td>{u.must_change_password ? 'Sì' : 'No'}</td>
                <td style={{display:'flex', gap:6}}>
                  <button onClick={() => openEditRoles(u)}>Ruoli</button>
                  <button onClick={() => resetPwd(u.id)}>Reset pwd</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editingRolesFor && (
        <div className="modal is-open" onClick={()=> setEditingRolesFor(null)}>
          <div className="modal-content" onClick={e=> e.stopPropagation()}>
            <div className="modal-header"><strong>Ruoli per {editingRolesFor.username || editingRolesFor.email}</strong></div>
            <div className="modal-body" style={{display:'grid', gap:8}}>
              {rolesList.map(r=> (
                <label key={r.id} style={{display:'flex', gap:8, alignItems:'center'}}>
                  <input type="checkbox" checked={editingRoleIds.includes(r.id)} onChange={()=> toggleRole(r.id)} />
                  <span>{r.name}</span>
                </label>
              ))}
            </div>
            <div className="modal-footer" style={{display:'flex', justifyContent:'flex-end', gap:8}}>
              <button className="btn btn-outline" onClick={()=> setEditingRolesFor(null)}>Annulla</button>
              <button className="btn" onClick={saveRoles}>Salva</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
