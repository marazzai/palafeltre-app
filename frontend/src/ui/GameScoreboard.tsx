import React, { useEffect, useRef, useState } from 'react'

type Penalty = { id:number; team:'home'|'away'; player_number:string; remaining:number }

type GameState = {
  homeName: string
  awayName: string
  scoreHome: number
  scoreAway: number
  period: string
  timerRemaining: number
  timeoutRemaining: number
  sirenOn: boolean
  obsVisible: boolean
  penalties: Penalty[]
  colorHome?: string
  colorAway?: string
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
    scoreHome: Number(raw.scoreHome ?? 0),
    scoreAway: Number(raw.scoreAway ?? 0),
    period: raw.period ?? '1°',
    timerRemaining: Number(raw.timerRemaining ?? 20*60),
    timeoutRemaining: Math.max(0, Number(raw.timeoutRemaining ?? 0)),
    sirenOn: Boolean(raw.sirenOn),
    obsVisible: raw.obsVisible !== false,
    penalties: Array.isArray(raw.penalties)? raw.penalties as Penalty[] : [],
    colorHome: raw.colorHome ?? '#ff4444',
    colorAway: raw.colorAway ?? '#44aaff',
  }
}

export function GameScoreboard(){
  const { status, wsRef } = useWs('game')
  const [state, setState] = useState<GameState>(normalizeState({}))

  // Load scoreboard fonts (Orbitron for digits, Oswald for labels)
  useEffect(() => {
    const link1 = document.createElement('link')
    link1.rel = 'preconnect'
    link1.href = 'https://fonts.googleapis.com'
    const link2 = document.createElement('link')
    link2.rel = 'preconnect'
    link2.href = 'https://fonts.gstatic.com'
    link2.crossOrigin = 'anonymous'
    const link3 = document.createElement('link')
    link3.rel = 'stylesheet'
    link3.href = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;800&family=Oswald:wght@400;600;700&display=swap'
    document.head.appendChild(link1)
    document.head.appendChild(link2)
    document.head.appendChild(link3)
    return () => {
      try { document.head.removeChild(link1) } catch{}
      try { document.head.removeChild(link2) } catch{}
      try { document.head.removeChild(link3) } catch{}
    }
  }, [])

  useEffect(() => { fetch('/api/v1/game/state').then(r => r.json()).then((s)=> setState(normalizeState(s))).catch(() => {}) }, [])
  useEffect(() => {
    const ws = wsRef.current
    if(!ws) return
    ws.onmessage = (ev) => {
      try{ const msg = JSON.parse(ev.data); if(msg.type === 'state' && msg.payload) { setState(normalizeState(msg.payload)) } }catch{}
    }
  }, [wsRef])

  function formatTime(total: number){ const m = Math.floor(total/60).toString().padStart(2,'0'); const s = (total%60).toString().padStart(2,'0'); return `${m}:${s}` }

  // Helpers
  const penaltiesHome = state.penalties.filter(p => p.team==='home').sort((a,b)=>a.remaining-b.remaining).slice(0,2)
  const penaltiesAway = state.penalties.filter(p => p.team==='away').sort((a,b)=>a.remaining-b.remaining).slice(0,2)

  return (
    <div className="scoreboard-root">
      {/* Local styles to avoid leaking to the rest of the app */}
      <style>{`
        .scoreboard-root { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #000014; color: #e8f1f8; }
        .sb-wrap { width: min(96vw, 1600px); aspect-ratio: 16/9; display: grid; grid-template-rows: 1fr auto; gap: 1.5vh; }
        .sb-main { display: grid; grid-template-columns: 1fr 1.1fr 1fr; gap: 1.2vw; align-items: stretch; }
        .team { display: grid; grid-template-rows: auto 1fr; background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.2)); border: 2px solid rgba(255,255,255,0.15); border-radius: 12px; overflow: hidden; }
        .team-name { font-family: 'Oswald', sans-serif; font-size: clamp(18px, 2.2vw, 42px); text-transform: uppercase; letter-spacing: 1px; text-align: center; padding: 0.6vw; color: #fff; }
        .score { display: flex; align-items: center; justify-content: center; font-family: 'Orbitron', 'Oswald', sans-serif; font-weight: 800; font-size: clamp(56px, 8vw, 180px); color: #fff; text-shadow: 0 0 18px rgba(255,255,255,0.25); }
        .center { display:flex; align-items:center; justify-content:center; flex-direction:column; background: radial-gradient(1200px 600px at 50% -20%, rgba(255,255,255,0.1), rgba(0,0,0,0.2)); border: 2px solid rgba(255,255,255,0.15); border-radius: 12px; }
        .timer { font-family: 'Orbitron', 'Oswald', sans-serif; font-weight: 800; font-size: clamp(54px, 7.6vw, 160px); letter-spacing: 2px; line-height: 1; }
        .period { margin-top: 0.6vh; font-family: 'Oswald', sans-serif; font-weight: 600; font-size: clamp(16px, 2vw, 36px); letter-spacing: 2px; opacity: 0.9; }
        .sb-bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2vw; }
        .pen-box { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8vw; background: rgba(255,255,255,0.04); border: 2px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 0.8vw; }
        .pen-card { display:flex; align-items:center; justify-content:space-between; gap: 0.6vw; padding: 0.6vw 0.8vw; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; }
        .pen-number { font-family: 'Oswald', sans-serif; font-weight:700; font-size: clamp(16px, 2.2vw, 36px); }
        .pen-time { font-family: 'Orbitron', sans-serif; font-weight:700; font-size: clamp(16px, 2.4vw, 40px); }
        .badge { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); padding: 6px 10px; background: #f97316; color: #000; border-radius: 999px; font-family: 'Oswald', sans-serif; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; }
        .ws { position: fixed; bottom: 10px; right: 12px; font-size: 12px; opacity: .6; font-family: 'Oswald', sans-serif; }
        @media (max-width: 900px) { .sb-wrap { aspect-ratio: auto; } .sb-main { grid-template-columns: 1fr; } .sb-bottom { grid-template-columns: 1fr; } }
      `}</style>

      {!state.obsVisible && (<div className="badge">OBS nascosto</div>)}
      <div className="sb-wrap">
        <div className="sb-main">
          <div className="team" style={{borderColor: 'rgba(255,255,255,0.15)'}}>
            <div className="team-name" style={{background: state.colorHome}}>{state.homeName}</div>
            <div className="score" style={{background: 'rgba(0,0,0,0.25)'}}>{state.scoreHome}</div>
          </div>
          <div className="center">
            <div className="timer">{formatTime(state.timerRemaining)}</div>
            <div className="period">PER {state.period}</div>
            {state.timeoutRemaining > 0 && (
              <div style={{marginTop: '0.8vh', fontFamily: 'Oswald, sans-serif', fontWeight:700, color:'#f97316'}}>TIMEOUT · {state.timeoutRemaining}s</div>
            )}
            {state.sirenOn && (
              <div style={{marginTop: '0.4vh', fontFamily: 'Oswald, sans-serif', fontWeight:600, color:'#22c55e'}}>SIRENA ATTIVA</div>
            )}
          </div>
          <div className="team" style={{borderColor: 'rgba(255,255,255,0.15)'}}>
            <div className="team-name" style={{background: state.colorAway}}>{state.awayName}</div>
            <div className="score" style={{background: 'rgba(0,0,0,0.25)'}}>{state.scoreAway}</div>
          </div>
        </div>
        <div className="sb-bottom">
          <div className="pen-box" style={{borderColor: state.colorHome}}>
            {penaltiesHome.length === 0 ? (
              <div className="pen-card" style={{gridColumn: '1 / span 2', justifyContent:'center', opacity:.7}}>Nessuna penalità</div>
            ) : (
              penaltiesHome.map(p => (
                <div className="pen-card" key={p.id}>
                  <div className="pen-number" style={{color: state.colorHome}}>#{p.player_number}</div>
                  <div className="pen-time">{Math.floor(p.remaining/60)}:{String(p.remaining%60).padStart(2,'0')}</div>
                </div>
              ))
            )}
          </div>
          <div className="pen-box" style={{borderColor: state.colorAway}}>
            {penaltiesAway.length === 0 ? (
              <div className="pen-card" style={{gridColumn: '1 / span 2', justifyContent:'center', opacity:.7}}>Nessuna penalità</div>
            ) : (
              penaltiesAway.map(p => (
                <div className="pen-card" key={p.id}>
                  <div className="pen-number" style={{color: state.colorAway}}>#{p.player_number}</div>
                  <div className="pen-time">{Math.floor(p.remaining/60)}:{String(p.remaining%60).padStart(2,'0')}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <div className="ws">WS: {status}</div>
    </div>
  )
}
