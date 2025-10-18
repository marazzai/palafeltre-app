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
  inInterval?: boolean
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
  inInterval: Boolean((raw as any).inInterval ?? false),
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
  const [confirm, setConfirm] = useState<Record<string, number>>({})

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
  async function timerSet(seconds:number, running?: boolean){ try{ await post('/api/v1/game/timer/set', { seconds, running }); appendLog(`Tempo impostato a ${formatTime(seconds)}`) }catch(e){ console.error(e) } }
  async function periodNext(){ try{ await post('/api/v1/game/period/next'); appendLog('Periodo successivo') }catch(e){ console.error(e) } }
  async function intervalStart(){ try{ await post('/api/v1/game/interval/start'); appendLog('Intervallo avviato') }catch(e){ console.error(e) } }

  async function addPenalty(){
    try{
      await post('/api/v1/game/penalties', { team: penModal.team, player_number: pen.number, minutes: pen.minutes })
      appendLog(`Penalità ${teamLabel(penModal.team)} #${pen.number} (${pen.minutes}m)`)
      setPenModal({ ...penModal, open:false })
      setPen({ number:'', minutes:2 })
    }catch(e){ console.error(e) }
  }

  function formatTime(total: number){ const m = Math.floor(total/60).toString().padStart(2,'0'); const s = (total%60).toString().padStart(2,'0'); return `${m}:${s}` }

  function confirmOrRun(key: string, action: () => void){
    const now = Date.now()
    const until = confirm[key]
    if(until && now < until){
      // confirmed
      const next = { ...confirm }
      delete next[key]
      setConfirm(next)
      action()
    } else {
      setConfirm(prev => ({ ...prev, [key]: now + 5000 }))
      // auto clear after timeout
      setTimeout(() => setConfirm(prev => { const p = { ...prev }; if(p[key] && Date.now() >= p[key]) delete p[key]; return p }), 5200)
    }
  }

  const isIntervalPhase = Boolean(state.inInterval)

  return (
    <div className="container">
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12}}>
        <h2 style={{ marginBottom: 12 }}>Tabellone</h2>
        <button
          className={`btn ${state.obsVisible ? '' : 'btn-outline'}`}
          onClick={toggleObs}
          title={state.obsVisible ? 'Nasconde la grafica del tabellone nelle scene OBS' : 'Mostra la grafica del tabellone nelle scene OBS'}
        >{state.obsVisible ? 'Nascondi tabellone' : 'Mostra tabellone'}</button>
      </div>

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
        <div className="card-body" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12, alignItems:'start'}}>
          <div className="field">
            <label className="label">Nome squadra Casa</label>
            <input className="input" placeholder="Casa" value={setup.home} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, home: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">Nome squadra Ospiti</label>
            <input className="input" placeholder="Ospiti" value={setup.away} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, away: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">Colore Casa</label>
            <input className="input" type="color" aria-label="Colore Casa" value={setup.colorHome} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, colorHome: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">Colore Ospiti</label>
            <input className="input" type="color" aria-label="Colore Ospiti" value={setup.colorAway} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, colorAway: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">Durata periodo (MM:SS)</label>
            <input className="input" placeholder="MM:SS" value={setup.duration} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, duration: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">Intervallo (MM:SS)</label>
            <input className="input" placeholder="MM:SS" value={setup.interval} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, interval: e.target.value })} />
          </div>
          <label style={{display:'flex', alignItems:'center', gap:8}}>
            <input type="checkbox" checked={setup.sirenEveryMinute} onChange={(e)=> setSetup({ ...setup, sirenEveryMinute: e.target.checked })} />
            Sirena ogni minuto
          </label>
          <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
            <button className="btn" style={{minWidth:200}} onClick={() => confirmOrRun('applyConfig', startGame)} title="Imposta nomi squadre, colori e durate">{confirm['applyConfig'] && Date.now() < confirm['applyConfig'] ? 'Conferma applica' : 'Applica configurazione'}</button>
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

      {/* Rimosso: tiri in porta */}

      <div className="card" style={{marginTop:16}}>
        <div className="card-header"><strong>Cronometro</strong></div>
        <div className="card-body" style={{display:'grid', gridTemplateColumns:'1fr', gap:12}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap'}}>
            <div style={{fontSize:48, fontWeight:800, minWidth:160, textAlign:'center'}} aria-label="Tempo di gioco">{formatTime(state.timerRemaining)}</div>
            <button className={`btn ${state.timerRunning? '' : 'btn-outline'}`} style={{minWidth:220, padding:'18px 24px', fontSize:18}} onClick={() => state.timerRunning ? timerStop() : timerStart()} title="Avvia/Ferma il tempo di gioco">{state.timerRunning ? 'Stop' : 'Start'}</button>
          </div>
          <div className="text-muted" style={{fontSize:12}}>Periodo attuale: {state.period}</div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8}}>
            <button className="btn btn-outline" onClick={() => confirmOrRun('resetPeriod', timerReset)} title="Reimposta il tempo al valore iniziale del periodo">{confirm['resetPeriod'] && Date.now() < confirm['resetPeriod'] ? 'Conferma reset' : 'Reset periodo'}</button>
            <button className="btn btn-outline" onClick={() => confirmOrRun('nextPeriod', periodNext)} title="Passa al periodo successivo e reimposta il tempo">{confirm['nextPeriod'] && Date.now() < confirm['nextPeriod'] ? 'Conferma periodo+' : 'Periodo successivo'}</button>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:8, alignItems:'end'}}>
            <div className="field">
              <label className="label">Imposta tempo (MM:SS)</label>
              <input className="input" placeholder="MM:SS" aria-label="Tempo manuale" title="Imposta manualmente il tempo di gioco" onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if(e.key === 'Enter'){
                  const t = (e.target as HTMLInputElement).value.trim(); const [m,s] = t.split(':'); const val = Math.max(0, (parseInt(m||'0')||0)*60 + (parseInt(s||'0')||0)); timerSet(val)
                }
              }} />
            </div>
            <button className="btn" onClick={() => {
              const el = (document.querySelector('input[aria-label="Tempo manuale"]') as HTMLInputElement | null)
              const t = el?.value.trim() || ''
              const [m,s] = t.split(':')
              const val = Math.max(0, (parseInt(m||'0')||0)*60 + (parseInt(s||'0')||0))
              timerSet(val)
            }} title="Applica il tempo manuale">Imposta</button>
          </div>
        </div>
      </div>

      <div className="grid" style={{marginTop:16}}>
        <div className="card">
          <div className="card-header"><strong>Timeout</strong></div>
          <div className="card-body" style={{display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
            <div style={{fontSize:32, fontWeight:800, minWidth:140, textAlign:'center'}} title="Tempo di timeout">{state.timeoutRemaining > 0 ? `${state.timeoutRemaining}s` : '—'}</div>
            <button className="btn" style={{minWidth:160}} onClick={startTimeout} disabled={state.timeoutRemaining > 0} title="Avvia timeout di 30 secondi">Avvia 30s</button>
            <button className="btn btn-outline" style={{minWidth:160}} onClick={stopTimeout} disabled={state.timeoutRemaining === 0} title="Termina il timeout">Termina</button>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><strong>Intervallo</strong></div>
          <div className="card-body" style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center'}}>
            <div className="text-muted" style={{fontSize:12}}>Durata configurata: {formatTime(state.intervalDuration || 0)}</div>
            <button className="btn" onClick={intervalStart} disabled={!state.inInterval || state.timerRunning} title="Disponibile solo quando il periodo termina e l'intervallo è pronto">Avvia Intervallo</button>
            <button className="btn btn-outline" onClick={() => confirmOrRun('endInterval', async () => { await periodNext() })} disabled={!isIntervalPhase} title="Termina l'intervallo e passa al periodo successivo">{confirm['endInterval'] && Date.now() < confirm['endInterval'] ? 'Conferma termina intervallo' : 'Termina Intervallo'}</button>
          </div>
        </div>
      </div>

      <div className="grid" style={{marginTop:16}}>
        <div className="card">
          <div className="card-header"><strong>Penalità — {state.homeName}</strong></div>
          <div className="card-body">
            <button className="btn btn-outline" title="Aggiungi penalità alla squadra di casa" onClick={() => { setPenModal({ team:'home', open:true }); setPen({ number:'', minutes:2 }) }}>Aggiungi Penalità</button>
            <ul>
              {state.penalties.filter(p => p.team==='home').map(p => (
                <li key={p.id} style={{display:'flex', justifyContent:'space-between', padding:'4px 0'}}>
                  <span>#{p.player_number} — {Math.floor(p.remaining/60)}:{String(p.remaining%60).padStart(2,'0')}</span>
                  <button className="btn btn-outline" title="Rimuovi penalità" onClick={() => fetch(`/api/v1/game/penalties/${p.id}`, { method:'DELETE', headers: authHeader || undefined })}>Rimuovi</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><strong>Penalità — {state.awayName}</strong></div>
          <div className="card-body">
            <button className="btn btn-outline" title="Aggiungi penalità alla squadra ospite" onClick={() => { setPenModal({ team:'away', open:true }); setPen({ number:'', minutes:2 }) }}>Aggiungi Penalità</button>
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
                <option value={4}>2+2 (4 minuti)</option>
                <option value={5}>5 minuti</option>
              </select>
            </div>
            <div className="modal-footer" style={{display:'flex', justifyContent:'flex-end', gap:8, flexWrap:'wrap'}}>
              <button className="btn btn-outline" style={{minWidth:140}} onClick={() => setPenModal({ ...penModal, open:false })}>Annulla</button>
              <button className="btn" style={{minWidth:140}} onClick={addPenalty}>Aggiungi</button>
            </div>
          </div>
        </div>
      )}

      {/* Guida rapida */}
      <div className="card" style={{marginTop:16}}>
        <div className="card-header"><strong>Guida rapida</strong></div>
        <div className="card-body">
          <ul>
            <li>Start/Stop controlla il cronometro principale del periodo.</li>
            <li>“Reset periodo” e “Periodo successivo” richiedono doppio clic per conferma entro 5s.</li>
            <li>Imposta tempo: scrivi MM:SS e premi Invio o “Imposta”.</li>
            <li>Alla fine del periodo, “Avvia Intervallo” si abilita automaticamente.</li>
            <li>“Termina Intervallo” richiede doppio clic e passa al periodo successivo.</li>
            <li>La sirena suona allo scadere del periodo e ogni minuto se attivata.</li>
            <li>Il tabellone OBS può essere mostrato/nascosto dal pulsante in alto.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
