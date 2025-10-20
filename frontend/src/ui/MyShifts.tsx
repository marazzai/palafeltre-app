import React, { useEffect, useState } from 'react'
import { setToken, getToken } from '../auth'

type Shift = { id:number; user_id:number; role:string; start_time:string; end_time:string; created_by:number }

export function MyShifts(){
  const [token, setTokenState] = useState('')
  const [shifts, setShifts] = useState<Shift[]>([])

  useEffect(() => { const t = getToken(); if(t) setTokenState(t) }, [])
  const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined

  async function load(){
    const res = await fetch('/api/v1/my/shifts', { headers: authHeader })
    if(res.ok) setShifts(await res.json())
  }
  useEffect(() => { if(token) load() }, [token])

  return (
    <div className="container">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
        <h2 style={{margin:0}}>I miei turni</h2>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <input className="input" placeholder="Bearer token" value={token} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTokenState(e.target.value)} />
          <button className="btn btn-outline" onClick={() => setToken(token)}>Salva token</button>
        </div>
      </div>
      <div className="card">
        <div className="card-body">
          {shifts.length===0 ? <p className="text-muted">Nessun turno pianificato.</p> : (
            <ul>
              {shifts.map((s: Shift) => (
                <li key={s.id} style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--surface-3)'}}>
                  <div>
                    <div style={{fontWeight:600}}>{new Date(s.start_time).toLocaleDateString()} • {s.role}</div>
                    <div className="text-muted" style={{fontSize:12}}>{new Date(s.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {new Date(s.end_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
