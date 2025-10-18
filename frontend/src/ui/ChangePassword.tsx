import React, { useState } from 'react'
import { getToken, clearToken, fetchMe } from '../auth'
import { useNavigate } from 'react-router-dom'

export default function ChangePassword(){
  const [current, setCurrent] = useState('')
  const [n1, setN1] = useState('')
  const [n2, setN2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function submit(e: React.FormEvent){
    e.preventDefault()
    setError(null)
    if(n1 !== n2){ setError('Le password non coincidono'); return }
    if(n1.length < 8){ setError('La password deve avere almeno 8 caratteri'); return }
    try{
      const r = await fetch('/api/v1/auth/change_password', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ current_password: current, new_password: n1 }) })
      if(!r.ok){ const txt = await r.text(); throw new Error(txt || 'Errore') }
      // reload /me and navigate to home
      navigate('/')
    }catch(err:any){
      setError(err.message || 'Errore')
    }
  }

  return (
    <div className="container" style={{maxWidth:420}}>
      <h2>Cambia password</h2>
      <form onSubmit={submit} className="card" style={{padding:16, display:'grid', gap:12}}>
        <label>Password attuale<input type="password" value={current} onChange={e=>setCurrent(e.target.value)} required /></label>
        <label>Nuova password<input type="password" value={n1} onChange={e=>setN1(e.target.value)} required /></label>
        <label>Conferma nuova password<input type="password" value={n2} onChange={e=>setN2(e.target.value)} required /></label>
        {error && <div className="alert alert-danger">{error}</div>}
        <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
          <button className="btn btn-outline" onClick={()=>{ clearToken(); navigate('/login') }} type="button">Logout</button>
          <button className="btn" type="submit">Aggiorna</button>
        </div>
      </form>
    </div>
  )
}
