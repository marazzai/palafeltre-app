import React, { useEffect, useMemo, useState } from 'react'

type Block = { id:number; day_of_week:number; start_time:string; end_time:string }

function toHM(s: string){ return s.slice(0,5) }
const days = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom']

export function AvailabilityPage(){
  const [token, setToken] = useState('')
  const [blocks, setBlocks] = useState<Block[]>([])
  const [form, setForm] = useState<{ day:string; start:string; end:string }>({ day:'0', start:'09:00', end:'13:00' })

  useEffect(() => { const t = localStorage.getItem('token'); if(t) setToken(t) }, [])
  const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined

  async function load(){
    try{
      const res = await fetch('/api/v1/availability', { headers: authHeader })
      if(!res.ok) throw new Error('unauthorized')
      const data = await res.json()
      setBlocks(Array.isArray(data) ? data : [])
    }catch{
      setBlocks([])
    }
  }
  useEffect(() => { if(token) load() }, [token])

  function blocksByDay(i:number){ return blocks.filter((b: Block) => b.day_of_week===i) }

  function add(){
  const id = Math.max(0, ...blocks.map((b: Block) => (b.id||0))) + 1
    const [h1,m1] = form.start.split(':').map(Number)
    const [h2,m2] = form.end.split(':').map(Number)
    const start = `${String(h1).padStart(2,'0')}:${String(m1).padStart(2,'0')}:00`
    const end = `${String(h2).padStart(2,'0')}:${String(m2).padStart(2,'0')}:00`
    setBlocks([...blocks, { id, day_of_week: Number(form.day), start_time: start, end_time: end }])
  }

  function remove(b: Block){ setBlocks(blocks.filter((x: Block) => x!==b)) }

  async function save(){
    await fetch('/api/v1/availability', { method:'PUT', headers: { 'Content-Type':'application/json', ...(authHeader||{}) }, body: JSON.stringify(blocks.map((b: Block) => ({ weekday:b.day_of_week, start_minute: Number(b.start_time.slice(0,2))*60 + Number(b.start_time.slice(3,5)), end_minute: Number(b.end_time.slice(0,2))*60 + Number(b.end_time.slice(3,5)), available: true }))) })
    alert('Disponibilità salvata')
  }

  return (
    <div className="container">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
        <h2 style={{margin:0}}>Disponibilità settimanale</h2>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <input className="input" placeholder="Bearer token" value={token} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToken(e.target.value)} />
          <button className="btn btn-outline" onClick={() => localStorage.setItem('token', token)}>Salva token</button>
          <button className="btn" onClick={save}>Salva</button>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:8}}>
            {days.map((label, i) => (
              <div key={i}>
                <div style={{fontWeight:600, marginBottom:6}}>{label}</div>
                <div style={{display:'flex', flexDirection:'column', gap:6}}>
                  {blocksByDay(i).map(b => (
                    <div key={b.id} className="badge" style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8}}>
                      <span>{toHM(b.start_time)} - {toHM(b.end_time)}</span>
                      <button className="btn btn-outline" onClick={() => remove(b)}>Rimuovi</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{marginTop:12}}>
        <div className="card-body" style={{display:'flex', gap:8, alignItems:'center'}}>
          <select className="input" value={form.day} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({...form, day: e.target.value})}>
            {days.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
          <input className="input" type="time" value={form.start} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, start: e.target.value})} />
          <input className="input" type="time" value={form.end} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, end: e.target.value})} />
          <button className="btn" onClick={add}>Aggiungi fascia</button>
        </div>
      </div>
    </div>
  )
}
