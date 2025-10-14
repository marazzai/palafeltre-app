import React, { useEffect, useMemo, useRef, useState } from 'react'

type GameState = {
  homeName: string
  awayName: string
  scoreHome: number
  scoreAway: number
  period: string
  periodIndex: number
  timerRunning: boolean
  timerRemaining: number
  periodDuration: number
  penalties: Array<{ id:number; team:'home'|'away'; player_number:string; remaining:number }>
}

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
  return { status, wsRef }
}

export function GameControl(){
  const { status, wsRef } = useWs('game')
  const [state, setState] = useState<GameState>({ homeName:'Casa', awayName:'Ospiti', scoreHome:0, scoreAway:0, period:'1°', periodIndex:1, timerRunning:false, timerRemaining:20*60, periodDuration:20*60, penalties: [] })
  const [token, setToken] = useState<string>('')
  const [setup, setSetup] = useState({ home:'Casa', away:'Ospiti', duration:'20:00' })
  const [penModal, setPenModal] = useState<{ team:'home'|'away'; open:boolean }>({ team:'home', open:false })
  const [pen, setPen] = useState<{ number:string; minutes:number }>({ number:'', minutes:2 })

  useEffect(() => { const t = localStorage.getItem('token'); if(t) setToken(t) }, [])
  useEffect(() => { fetch('/api/v1/game/state').then(r => r.json()).then(setState).catch(() => {}) }, [])
  useEffect(() => {
    const ws = wsRef.current
    if(!ws) return
    ws.onmessage = (ev) => {
      try{ const msg = JSON.parse(ev.data); if(msg.type === 'state' && msg.payload) setState(msg.payload) }catch{}
    }
  }, [wsRef])

  const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined

  async function post(url: string, body?: any){
    await fetch(url, { method:'POST', headers: { 'Content-Type':'application/json', ...(authHeader||{}) }, body: body ? JSON.stringify(body) : undefined })
  }

  function formatTime(total: number){ const m = Math.floor(total/60).toString().padStart(2,'0'); const s = (total%60).toString().padStart(2,'0'); return `${m}:${s}` }

  return (
    <div className="container">
      <h2 style={{ marginBottom: 12 }}>Pannello di Controllo Partita</h2>

      <div className="card" style={{marginBottom:16}}>
        <div className="card-body" style={{display:'flex', gap:8, alignItems:'center'}}>
          <input className="input" placeholder="Bearer token" value={token} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToken(e.target.value)} />
          <button className="btn btn-outline" onClick={() => localStorage.setItem('token', token)}>Salva token</button>
          <span className="text-muted" style={{fontSize:12}}>WS: {status}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><strong>Setup Partita</strong></div>
        <div className="card-body" style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
          <input className="input" placeholder="Casa" value={setup.home} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, home: e.target.value })} />
          <input className="input" placeholder="Ospiti" value={setup.away} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, away: e.target.value })} />
          <input className="input" placeholder="Durata (MM:SS)" value={setup.duration} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, duration: e.target.value })} />
          <button className="btn" onClick={() => post('/api/v1/game/setup', { home_name: setup.home, away_name: setup.away, period_duration: setup.duration })}>Inizia Partita</button>
          <a className="btn btn-outline" href="/scoreboard" target="_blank" rel="noreferrer">Apri Scoreboard</a>
        </div>
      </div>

      <div className="grid" style={{marginTop:16}}>
        <div className="card">
          <div className="card-header"><strong>{state.homeName}</strong></div>
          <div className="card-body" style={{display:'flex', alignItems:'center', gap:12}}>
            <button className="btn" onClick={() => post('/api/v1/game/score', { team:'home', delta:-1 })}>-</button>
            <div style={{fontSize:36, fontWeight:700, width:80, textAlign:'center'}}>{state.scoreHome}</div>
            <button className="btn" onClick={() => post('/api/v1/game/score', { team:'home', delta:1 })}>+</button>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><strong>{state.awayName}</strong></div>
          <div className="card-body" style={{display:'flex', alignItems:'center', gap:12}}>
            <button className="btn" onClick={() => post('/api/v1/game/score', { team:'away', delta:-1 })}>-</button>
            <div style={{fontSize:36, fontWeight:700, width:80, textAlign:'center'}}>{state.scoreAway}</div>
            <button className="btn" onClick={() => post('/api/v1/game/score', { team:'away', delta:1 })}>+</button>
          </div>
        </div>
      </div>

      <div className="card" style={{marginTop:16}}>
        <div className="card-header"><strong>Cronometro</strong></div>
        <div className="card-body" style={{display:'flex', alignItems:'center', gap:12}}>
          <div style={{fontSize:42, fontWeight:700, width:140, textAlign:'center'}}>{formatTime(state.timerRemaining)}</div>
          <button className="btn" onClick={() => post('/api/v1/game/timer/start')}>Start</button>
          <button className="btn btn-outline" onClick={() => post('/api/v1/game/timer/stop')}>Stop</button>
          <button className="btn btn-outline" onClick={() => post('/api/v1/game/timer/reset')}>Reset</button>
          <div className="text-muted" style={{fontSize:12}}>Periodo: {state.period}</div>
          <button className="btn btn-outline" onClick={() => post('/api/v1/game/period/next')}>Periodo Successivo</button>
        </div>
      </div>

      <div className="grid" style={{marginTop:16}}>
        <div className="card">
          <div className="card-header"><strong>Penalità — {state.homeName}</strong></div>
          <div className="card-body">
            <button className="btn btn-outline" onClick={() => { setPenModal({ team:'home', open:true }); setPen({ number:'', minutes:2 }) }}>Aggiungi Penalità</button>
            <ul>
              {state.penalties.filter(p => p.team==='home').map(p => (
                <li key={p.id} style={{display:'flex', justifyContent:'space-between', padding:'4px 0'}}>
                  <span>#{p.player_number} — {Math.floor(p.remaining/60)}:{String(p.remaining%60).padStart(2,'0')}</span>
                  <button className="btn btn-outline" onClick={() => fetch(`/api/v1/game/penalties/${p.id}`, { method:'DELETE', headers: authHeader || undefined })}>Rimuovi</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><strong>Penalità — {state.awayName}</strong></div>
          <div className="card-body">
            <button className="btn btn-outline" onClick={() => { setPenModal({ team:'away', open:true }); setPen({ number:'', minutes:2 }) }}>Aggiungi Penalità</button>
            <ul>
              {state.penalties.filter(p => p.team==='away').map(p => (
                <li key={p.id} style={{display:'flex', justifyContent:'space-between', padding:'4px 0'}}>
                  <span>#{p.player_number} — {Math.floor(p.remaining/60)}:{String(p.remaining%60).padStart(2,'0')}</span>
                  <button className="btn btn-outline" onClick={() => fetch(`/api/v1/game/penalties/${p.id}`, { method:'DELETE', headers: authHeader || undefined })}>Rimuovi</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {penModal.open && (
        <div className="modal is-open">
          <div className="modal-content" style={{minWidth:360}}>
            <div className="modal-header"><strong>Aggiungi Penalità — {penModal.team==='home'? state.homeName : state.awayName}</strong></div>
            <div className="modal-body" style={{display:'flex', flexDirection:'column', gap:8}}>
              <input className="input" placeholder="Numero giocatore" value={pen.number} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPen({ ...pen, number: e.target.value })} />
              <select className="input" value={pen.minutes} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPen({ ...pen, minutes: Number(e.target.value) })}>
                <option value={2}>2 minuti</option>
                <option value={5}>5 minuti</option>
              </select>
            </div>
            <div className="modal-footer" style={{display:'flex', justifyContent:'flex-end', gap:8}}>
              <button className="btn btn-outline" onClick={() => setPenModal({ ...penModal, open:false })}>Annulla</button>
              <button className="btn" onClick={async () => { await post('/api/v1/game/penalties', { team: penModal.team, player_number: pen.number, minutes: pen.minutes }); setPenModal({ ...penModal, open:false }) }}>Aggiungi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
