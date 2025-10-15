import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setToken } from '../auth'

export default function Login(){
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('admin')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function onSubmit(e: React.FormEvent){
    e.preventDefault()
    setError('')
    try{
      const r = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      if(!r.ok){ throw new Error('Credenziali non valide') }
      const data = await r.json()
      setToken(data.access_token)
      navigate('/')
    }catch(err: any){
      setError(err.message || 'Errore di login')
    }
  }

  return (
    <div className="container" style={{maxWidth: 420}}>
      <h2>Accedi</h2>
      <form onSubmit={onSubmit} className="card" style={{padding:16, display:'grid', gap:12}}>
        <label>
          Email
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        </label>
        {error && <div className="alert alert-danger">{error}</div>}
        <button className="btn" type="submit">Entra</button>
      </form>
    </div>
  )
}
