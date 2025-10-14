import React, { useEffect, useState } from 'react'

type Group = { id: number; name: string; level: number }
type Scene = { id: number; name: string }

export function LightsControl(){
  const [groups, setGroups] = useState<Group[]>([])
  const [scenes, setScenes] = useState<Scene[]>([])
  const [activeScene, setActiveScene] = useState<number | null>(null)
  const [token, setToken] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string>('')

  useEffect(() => { const t = localStorage.getItem('token'); if(t) setToken(t) }, [])
  async function load(){
    try{
      const res = await fetch('/api/v1/dali/groups', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      if(!res.ok) throw new Error('Errore caricamento gruppi')
      const data = await res.json()
      setGroups(data.groups); setActiveScene(data.active_scene); setScenes(data.scenes)
    }catch(err:any){ setMessage(err.message || 'Errore rete') }
  }
  useEffect(() => { load(); const id = setInterval(load, 3000); return () => clearInterval(id) }, [token])

  async function setLevel(groupId: number, level: number){
    setLoading(true)
    try{
      const res = await fetch(`/api/v1/dali/groups/${groupId}/level`, { method:'POST', headers: { 'Content-Type':'application/json', ...(token? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ level }) })
      if(!res.ok) throw new Error('Errore impostando livello')
      await load()
    }catch(err:any){ setMessage(err.message || 'Errore rete') } finally{ setLoading(false) }
  }

  async function recallScene(sceneId: number){
    setLoading(true)
    try{
      const res = await fetch(`/api/v1/dali/scenes/${sceneId}/recall`, { method:'POST', headers: { ...(token? { Authorization: `Bearer ${token}` } : {}) } })
      if(!res.ok) throw new Error('Errore richiamo scena')
      await load()
    }catch(err:any){ setMessage(err.message || 'Errore rete') } finally{ setLoading(false) }
  }

  return (
    <div className="container">
      <h2 style={{ marginBottom: 12 }}>Controllo Luci</h2>

      <div className="card" style={{marginBottom:16}}>
        <div className="card-body" style={{display:'flex', gap:8, alignItems:'center'}}>
          <input className="input" placeholder="Bearer token" value={token} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToken(e.target.value)} />
          <button className="btn btn-outline" onClick={() => localStorage.setItem('token', token)}>Salva token</button>
          {loading && <span className="text-muted" style={{fontSize:12}}>Caricamento…</span>}
          {message && <span className="text-muted" style={{fontSize:12}}>{message}</span>}
        </div>
      </div>

      <div className="grid" style={{marginTop:16}}>
        {groups.map(g => (
          <div key={g.id} className="card">
            <div className="card-header" style={{display:'flex', justifyContent:'space-between'}}><strong>{g.name}</strong><span className="text-muted">Stato: {g.level}%</span></div>
            <div className="card-body" style={{display:'flex', flexDirection:'column', gap:8}}>
              <input type="range" min={0} max={100} value={g.level} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLevel(g.id, Number(e.target.value))} />
              <div style={{display:'flex', gap:8}}>
                <button className="btn" onClick={() => setLevel(g.id, 100)}>ON</button>
                <button className="btn btn-outline" onClick={() => setLevel(g.id, 0)}>OFF</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{marginTop:16}}>
        <div className="card-header"><strong>Scene</strong></div>
        <div className="card-body" style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          {scenes.map(s => (
            <button key={s.id} className={"btn " + (activeScene === s.id ? '' : 'btn-outline')} onClick={() => recallScene(s.id)}>{s.name}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
