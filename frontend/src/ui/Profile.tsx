import { useEffect, useMemo, useState } from 'react'
import { getToken, setToken } from '../auth'

export default function Profile(){
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [message, setMessage] = useState('')
  const [expiresIn, setExpiresIn] = useState<number | null>(null)

  async function refresh(){
    try{
      const r = await fetch('/api/v1/auth/refresh', { method:'POST', headers:{ Authorization: `Bearer ${getToken()}` } })
      if(!r.ok) throw new Error('refresh failed')
      const d = await r.json()
      if(d.access_token) setToken(d.access_token)
      if(typeof d.expires_in === 'number') setExpiresIn(d.expires_in)
    }catch{}
  }

  useEffect(()=>{
    let timer: any
    if(expiresIn && expiresIn>0){
      timer = setInterval(()=> setExpiresIn(v=> (v? Math.max(0, v-1): v)), 1000)
    }
    return ()=> timer && clearInterval(timer)
  },[expiresIn])

  const pretty = useMemo(()=>{
    if(expiresIn==null) return '—'
    const m = Math.floor(expiresIn/60); const s = expiresIn%60
    return `${m}:${String(s).padStart(2,'0')}`
  },[expiresIn])

  async function changePassword(e: React.FormEvent){
    e.preventDefault()
    setMessage('')
    const r = await fetch('/api/v1/auth/change_password', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ current_password: current, new_password: next }) })
    if(r.ok){ setMessage('Password aggiornata'); setCurrent(''); setNext('') }
    else{ setMessage('Errore cambio password') }
  }

  return (
    <div className="container" style={{maxWidth:560}}>
      <h2>Profilo</h2>
      <div className="card"><div className="card-body" style={{display:'grid', gap:12}}>
        <div>Scadenza token: <strong>{pretty}</strong> <button className="btn btn-outline" onClick={refresh}>Rinnova</button></div>
        <form onSubmit={changePassword} style={{display:'grid', gap:8}}>
          <label> Password attuale <input type="password" value={current} onChange={e=> setCurrent(e.target.value)} required /></label>
          <label> Nuova password <input type="password" value={next} onChange={e=> setNext(e.target.value)} required /></label>
          <button className="btn">Aggiorna password</button>
        </form>
        {message && <div className="text-muted">{message}</div>}
      </div></div>
    </div>
  )
}
