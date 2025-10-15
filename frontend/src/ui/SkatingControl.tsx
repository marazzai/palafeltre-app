import React, { useEffect, useMemo, useRef, useState } from 'react'

function useWs(room: string){
  const [status, setStatus] = useState<'connecting'|'open'|'closed'>('connecting')
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + `/ws/${room}`
    const ws = new WebSocket(url)
    wsRef.current = ws
    ws.onopen = () => setStatus('open')
    ws.onclose = () => setStatus('closed')
    ws.onerror = () => setStatus('closed')
    return () => ws.close()
  }, [room])

  const send = useMemo(() => (data: any) => {
    if(wsRef.current && wsRef.current.readyState === WebSocket.OPEN){
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { status, send }
}

export function SkatingControl(){
  const control = useWs('control')
  const [events, setEvents] = useState<Array<{id:number; title:string; start_time:string; end_time:string}>>([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [token, setToken] = useState<string>('')

  useEffect(() => {
    const t = localStorage.getItem('token')
    if(t) setToken(t)
  }, [])

  async function refreshEvents(){
    try{
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined
      const res = await fetch('/api/v1/skating/events', { headers })
      if(!res.ok) throw new Error('unauthorized')
      const data = await res.json()
      setEvents(Array.isArray(data) ? data : [])
    }catch{
      setEvents([])
    }
  }

  useEffect(() => { refreshEvents() }, [token])

  async function onUpload(file: File){
    setUploading(true)
    try{
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/v1/skating/calendar/upload', { method: 'POST', body: form, headers: token ? { 'Authorization': `Bearer ${token}` } : undefined })
      if(!res.ok) throw new Error('Upload fallito')
      await refreshEvents()
    } finally {
      setUploading(false)
    }
  }

  async function clearCalendar(){
    if(!confirm('Sicuro di svuotare il calendario?')) return
    const res = await fetch('/api/v1/skating/calendar', { method: 'DELETE', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined })
    if(res.ok) refreshEvents()
  }

  async function sendDisplay(type: string, payload: any = {}){
    await fetch('/api/v1/skating/command/display', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ type, payload })
    })
  }

  async function sendPlayer(type: string, payload: any = {}){
    await fetch('/api/v1/skating/command/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ type, payload })
    })
  }

  return (
    <div className="container">
      <h2 style={{ marginBottom: 12 }}>Pattinaggio Pubblico — Pannello di Controllo</h2>
      <div className="card" style={{marginBottom:16}}>
        <div className="card-body" style={{display:'flex', gap:8, alignItems:'center'}}>
          <input className="input" placeholder="Bearer token" value={token} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToken(e.target.value)} />
          <button className="btn btn-outline" onClick={() => localStorage.setItem('token', token)}>Salva token</button>
          <span className="text-muted" style={{fontSize:12}}>Richiesto per azioni protette (admin)</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <strong>Calendario eventi (.ics)</strong>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <input type="file" accept=".ics" onChange={(e: React.ChangeEvent<HTMLInputElement>) => e.target.files && onUpload(e.target.files[0])} disabled={uploading} />
            <button className="btn btn-outline" onClick={clearCalendar}>Svuota</button>
          </div>
        </div>
        <div className="card-body">
          {events.length === 0 ? (
            <p className="text-muted">Nessun evento caricato.</p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Titolo</th>
                    <th>Inizio</th>
                    <th>Fine</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(ev => (
                    <tr key={ev.id}>
                      <td>{ev.title}</td>
                      <td>{new Date(ev.start_time).toLocaleString()}</td>
                      <td>{new Date(ev.end_time).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid" style={{marginTop:16}}>
        <div className="card">
          <div className="card-header"><strong>Display Pubblico</strong></div>
          <div className="card-body" style={{display:'flex', flexDirection:'column', gap:8}}>
            <div style={{display:'flex', gap:8}}>
              <button className="btn" onClick={() => sendDisplay('showView', { view: 'logo' })}>Logo</button>
              <button className="btn" onClick={() => sendDisplay('showView', { view: 'nextEvent' })}>Prossimo Evento</button>
              <button className="btn" onClick={() => sendDisplay('showView', { view: 'timer', seconds: 15*60 })}>Timer 15:00</button>
            </div>
            <div style={{display:'flex', gap:8}}>
              <input className="input" placeholder="Messaggio personalizzato" value={message} onChange={e => setMessage(e.target.value)} />
              <button className="btn btn-outline" onClick={() => sendDisplay('showView', { view: 'message', text: message })}>Invia</button>
            </div>
            <div className="text-muted" style={{fontSize:12}}>WS: {control.status}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><strong>Player Musicale</strong></div>
          <div className="card-body" style={{display:'flex', flexDirection:'column', gap:8}}>
            <div style={{display:'flex', gap:8}}>
              <button className="btn" onClick={() => sendPlayer('prevTrack')}>Prev</button>
              <button className="btn" onClick={() => sendPlayer('toggle')}>Play/Pause</button>
              <button className="btn" onClick={() => sendPlayer('nextTrack')}>Next</button>
              <button className="btn btn-outline" onClick={() => sendPlayer('playJingle')}>Jingle</button>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <label className="text-muted" style={{fontSize:12}}>Volume</label>
              <input type="range" min={0} max={100} defaultValue={70} onChange={e => sendPlayer('setVolume', { value: Number((e.target as HTMLInputElement).value) })} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
