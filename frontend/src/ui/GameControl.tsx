import React, { useEffect, useMemo, useRef, useState } from 'react'

type Penalty = { id:number; team:'home'|'away'; player_number:string; remaining:number }

type GameState = {
  homeName: string
  awayName: string
  colorHome?: string
  colorAway?: string
  scoreHome: number
  scoreAway: number
  shotsHome: number
  shotsAway: number
  period: string
  periodIndex: number
  timerRunning: boolean
  timerRemaining: number
  periodDuration: number
  intervalDuration?: number
  timeoutRemaining: number
  sirenOn: boolean
  sirenEveryMinute?: boolean
  obsVisible: boolean
  penalties: Penalty[]
}

function useWs(room: string){
  const [status, setStatus] = useState<'connecting'|'open'|'closed'>('connecting')
  const wsRef = useRef<WebSocket | null>(null)
  useEffect(() => {
    const base = `/api/v1/ws/${room}`
    const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + base
    const ws = new WebSocket(url)
    wsRef.current = ws
    ws.onopen = () => setStatus('open')
    ws.onclose = () => setStatus('closed')
    ws.onerror = () => setStatus('closed')
    return () => ws.close()
  }, [room])
  return { status, wsRef }
}

function normalizeState(raw: Partial<GameState> & { penalties?: any }): GameState {
  return {
    homeName: raw.homeName ?? 'Casa',
    awayName: raw.awayName ?? 'Ospiti',
    colorHome: raw.colorHome ?? '#ff4444',
    colorAway: raw.colorAway ?? '#44aaff',
    scoreHome: Number(raw.scoreHome ?? 0),
    scoreAway: Number(raw.scoreAway ?? 0),
    shotsHome: Number(raw.shotsHome ?? 0),
    shotsAway: Number(raw.shotsAway ?? 0),
    period: raw.period ?? '1°',
    periodIndex: Number(raw.periodIndex ?? 1),
    timerRunning: Boolean(raw.timerRunning),
    timerRemaining: Number(raw.timerRemaining ?? (20*60)),
    periodDuration: Number(raw.periodDuration ?? (20*60)),
    intervalDuration: Number(raw.intervalDuration ?? (15*60)),
    timeoutRemaining: Math.max(0, Number(raw.timeoutRemaining ?? 0)),
    sirenOn: Boolean(raw.sirenOn),
    sirenEveryMinute: Boolean(raw.sirenEveryMinute ?? false),
    obsVisible: raw.obsVisible !== false,
    penalties: Array.isArray(raw.penalties) ? (raw.penalties as Penalty[]) : [],
  }
}

export function GameControl(){
  const { status, wsRef } = useWs('game')
  const [state, setState] = useState<GameState>(normalizeState({}))
  const [setup, setSetup] = useState({ home:'Casa', away:'Ospiti', duration:'20:00', interval:'15:00', colorHome:'#ff4444', colorAway:'#44aaff', sirenEveryMinute:false })
  const [penModal, setPenModal] = useState<{ team:'home'|'away'; open:boolean }>({ team:'home', open:false })
  const [pen, setPen] = useState<{ number:string; minutes:number }>({ number:'', minutes:2 })
  const [log, setLog] = useState<Array<{ ts:number; text:string }>>([])

  const token = sessionStorage.getItem('token') || ''
  useEffect(() => {
    fetch('/api/v1/game/state').then(r => r.json()).then((s)=> setState(normalizeState(s))).catch(() => {})
  }, [])
  useEffect(() => {
    const ws = wsRef.current
    if(!ws) return
    ws.onmessage = (ev) => {
      try{
        const msg = JSON.parse(ev.data); if(msg.type === 'state' && msg.payload) { setState(normalizeState(msg.payload)) }
      }catch{}
    }
  }, [wsRef])

  const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined

  function appendLog(text: string){
    setLog(prev => [{ ts: Date.now(), text }, ...prev].slice(0, 20))
  }

  async function post(url: string, body?: any){
    const res = await fetch(url, { method:'POST', headers: { 'Content-Type':'application/json', ...(authHeader||{}) }, body: body ? JSON.stringify(body) : undefined })
    if(!res.ok) throw new Error(await res.text())
    return res
  }

  const teamLabel = (team:'home'|'away') => team === 'home' ? state.homeName : state.awayName

  async function startGame(){
    try{
      await post('/api/v1/game/setup', { 
        home_name: setup.home, 
        away_name: setup.away, 
        period_duration: setup.duration,
        interval_duration: setup.interval,
        color_home: setup.colorHome,
        color_away: setup.colorAway,
        siren_every_minute: setup.sirenEveryMinute
      })
      appendLog(`Partita avviata: ${setup.home} vs ${setup.away}`)
    }catch(e){ console.error(e) }
  }

  async function changeScore(team:'home'|'away', delta:number){
    try{
      await post('/api/v1/game/score', { team, delta })
      appendLog(`${teamLabel(team)} punteggio ${delta>0?'+1':'-1'}`)
    }catch(e){ console.error(e) }
  }

  async function changeShots(team:'home'|'away', delta:number){
    try{
      const current = team === 'home' ? state.shotsHome : state.shotsAway
      if(delta < 0 && current <= 0) return
      await post('/api/v1/game/shots', { team, delta })
      appendLog(`${teamLabel(team)} tiri ${delta>0?'+1':'-1'}`)
    }catch(e){ console.error(e) }
  }

  async function startTimeout(){
    try{
      await post('/api/v1/game/timeout/start')
      appendLog('Timeout avviato (30s)')
    }catch(e){ console.error(e) }
  }

  async function stopTimeout(){
    try{
      await post('/api/v1/game/timeout/stop')
      appendLog('Timeout terminato')
    }catch(e){ console.error(e) }
  }

  async function toggleSiren(){
    try{
      await post('/api/v1/game/siren', { on: !state.sirenOn })
      appendLog(`Sirena ${!state.sirenOn ? 'attivata' : 'disattivata'}`)
    }catch(e){ console.error(e) }
  }

  async function toggleObs(){
    try{
      await post('/api/v1/game/obs', { visible: !state.obsVisible })
      appendLog(`Grafica OBS ${!state.obsVisible ? 'mostrata' : 'nascosta'}`)
    }catch(e){ console.error(e) }
  }

  async function timerStart(){ try{ await post('/api/v1/game/timer/start'); appendLog('Cronometro avviato') }catch(e){ console.error(e) } }
  async function timerStop(){ try{ await post('/api/v1/game/timer/stop'); appendLog('Cronometro fermato') }catch(e){ console.error(e) } }
  async function timerReset(){ try{ await post('/api/v1/game/timer/reset'); appendLog('Cronometro resettato') }catch(e){ console.error(e) } }
  async function periodNext(){ try{ await post('/api/v1/game/period/next'); appendLog('Periodo successivo') }catch(e){ console.error(e) } }

  async function addPenalty(){
    try{
      await post('/api/v1/game/penalties', { team: penModal.team, player_number: pen.number, minutes: pen.minutes })
      appendLog(`Penalità ${teamLabel(penModal.team)} #${pen.number} (${pen.minutes}m)`)
      setPenModal({ ...penModal, open:false })
      setPen({ number:'', minutes:2 })
    }catch(e){ console.error(e) }
  }

  function formatTime(total: number){ const m = Math.floor(total/60).toString().padStart(2,'0'); const s = (total%60).toString().padStart(2,'0'); return `${m}:${s}` }

  return (
    <div className="container">
      <h2 style={{ marginBottom: 12 }}>Tabellone — Controllo</h2>

      {/* Riepilogo in alto */}
      <div className="card" style={{marginBottom:16}}>
        <div className="card-body" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12, alignItems:'center'}}>
          <div>
            <div className="text-muted" style={{fontSize:12, textTransform:'uppercase', letterSpacing:1}}>Tempo</div>
            <div style={{fontSize:28, fontWeight:700}}>{formatTime(state.timerRemaining)} {state.timerRunning? '•' : ''}</div>
          </div>
          <div>
            <div className="text-muted" style={{fontSize:12, textTransform:'uppercase', letterSpacing:1}}>Periodo</div>
            <div style={{fontSize:20, fontWeight:600}}>{state.period}</div>
          </div>
          <div>
            <div className="text-muted" style={{fontSize:12}}>Goal</div>
            <div style={{fontSize:20}}><strong style={{color:state.colorHome}}>{state.homeName}</strong> {state.scoreHome} - {state.scoreAway} <strong style={{color:state.colorAway}}>{state.awayName}</strong></div>
          </div>
          <div className="text-muted" style={{fontSize:12}}>WS: {status} · OBS: {state.obsVisible? 'Visibile' : 'Nascosta'} · Timeout: {state.timeoutRemaining>0? `${state.timeoutRemaining}s` : '—'}</div>
        </div>
      </div>

      {/* Configurazione */}
      <div className="card">
        <div className="card-header"><strong>Configurazione</strong></div>
        <div className="card-body" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12, alignItems:'center'}}>
          <input className="input" placeholder="Casa" value={setup.home} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, home: e.target.value })} />
          <input className="input" placeholder="Ospiti" value={setup.away} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, away: e.target.value })} />
          <input className="input" type="color" aria-label="Colore Casa" value={setup.colorHome} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, colorHome: e.target.value })} />
          <input className="input" type="color" aria-label="Colore Ospiti" value={setup.colorAway} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, colorAway: e.target.value })} />
          <input className="input" placeholder="Durata periodo (MM:SS)" value={setup.duration} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, duration: e.target.value })} />
          <input className="input" placeholder="Intervallo (MM:SS)" value={setup.interval} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, interval: e.target.value })} />
          <label style={{display:'flex', alignItems:'center', gap:8}}>
            <input type="checkbox" checked={setup.sirenEveryMinute} onChange={(e)=> setSetup({ ...setup, sirenEveryMinute: e.target.checked })} />
            Sirena ogni minuto
          </label>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <button className="btn" onClick={startGame}>Applica configurazione</button>
            <button className={`btn ${state.obsVisible ? '' : 'btn-outline'}`} onClick={toggleObs}>{state.obsVisible ? 'Disattiva scena' : 'Attiva scena'}</button>
            <a className="btn btn-outline" href="/scoreboard" target="_blank" rel="noreferrer">Apri Scoreboard</a>
          </div>
        </div>
      </div>

      <div className="grid" style={{marginTop:16}}>
        <div className="card">
          <div className="card-header"><strong>{state.homeName}</strong></div>
          <div className="card-body" style={{display:'flex', alignItems:'center', gap:12}}>
            <button className="btn" onClick={() => changeScore('home', -1)}>-</button>
            <div style={{fontSize:36, fontWeight:700, width:80, textAlign:'center'}}>{state.scoreHome}</div>
            <button className="btn" onClick={() => changeScore('home', 1)}>+</button>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><strong>{state.awayName}</strong></div>
          <div className="card-body" style={{display:'flex', alignItems:'center', gap:12}}>
            <button className="btn" onClick={() => changeScore('away', -1)}>-</button>
            <div style={{fontSize:36, fontWeight:700, width:80, textAlign:'center'}}>{state.scoreAway}</div>
            <button className="btn" onClick={() => changeScore('away', 1)}>+</button>
          </div>
        </div>
      </div>

      <div className="card" style={{marginTop:16}}>
        <div className="card-header"><strong>Tiri in porta</strong></div>
        <div className="card-body" style={{display:'flex', gap:24}}>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <span style={{width:120, fontWeight:600}}>{state.homeName}</span>
            <button className="btn btn-outline" onClick={() => changeShots('home', -1)} disabled={state.shotsHome === 0}>-</button>
            <span style={{fontSize:28, fontWeight:700, width:60, textAlign:'center'}}>{state.shotsHome}</span>
            <button className="btn" onClick={() => changeShots('home', 1)}>+</button>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <span style={{width:120, fontWeight:600}}>{state.awayName}</span>
            <button className="btn btn-outline" onClick={() => changeShots('away', -1)} disabled={state.shotsAway === 0}>-</button>
            <span style={{fontSize:28, fontWeight:700, width:60, textAlign:'center'}}>{state.shotsAway}</span>
            <button className="btn" onClick={() => changeShots('away', 1)}>+</button>
          </div>
        </div>
      </div>

      <div className="card" style={{marginTop:16}}>
        <div className="card-header"><strong>Cronometro</strong></div>
        <div className="card-body" style={{display:'flex', alignItems:'center', gap:12}}>
          <div style={{fontSize:42, fontWeight:700, width:140, textAlign:'center'}}>{formatTime(state.timerRemaining)}</div>
          <button className="btn" onClick={timerStart}>Start</button>
          <button className="btn btn-outline" onClick={timerStop}>Stop</button>
          <button className="btn btn-outline" onClick={timerReset}>Reset</button>
          <div className="text-muted" style={{fontSize:12}}>Periodo: {state.period}</div>
          <button className="btn btn-outline" onClick={periodNext}>Periodo Successivo</button>
        </div>
      </div>

      <div className="grid" style={{marginTop:16}}>
        <div className="card">
          <div className="card-header"><strong>Timeout</strong></div>
          <div className="card-body" style={{display:'flex', alignItems:'center', gap:12}}>
            <div style={{fontSize:28, fontWeight:700, width:100}}>{state.timeoutRemaining > 0 ? `${state.timeoutRemaining}s` : '—'}</div>
            <button className="btn" onClick={startTimeout} disabled={state.timeoutRemaining > 0}>Avvia 30s</button>
            <button className="btn btn-outline" onClick={stopTimeout} disabled={state.timeoutRemaining === 0}>Termina</button>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><strong>Controlli Rapidi</strong></div>
          <div className="card-body" style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            <button className={`btn ${state.sirenOn ? '' : 'btn-outline'}`} onClick={toggleSiren}>{state.sirenOn ? 'Sirena ON' : 'Sirena OFF'}</button>
            <button className={`btn ${state.obsVisible ? '' : 'btn-outline'}`} onClick={toggleObs}>{state.obsVisible ? 'OBS visibile' : 'OBS nascosto'}</button>
          </div>
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

      <div className="card" style={{marginTop:16}}>
        <div className="card-header"><strong>Log Partita</strong></div>
        <div className="card-body" style={{maxHeight:200, overflow:'auto', display:'flex', flexDirection:'column', gap:6}}>
          {log.length === 0 ? <span className="text-muted">Nessuna azione registrata.</span> : log.map(item => (
            <div key={item.ts} className="text-muted" style={{fontSize:12}}>
              {new Date(item.ts).toLocaleTimeString('it-IT', { hour12:false })} · {item.text}
            </div>
          ))}
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
              <button className="btn" onClick={addPenalty}>Aggiungi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
