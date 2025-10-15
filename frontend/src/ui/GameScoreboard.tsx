import React, { useEffect, useRef, useState } from 'react'

type Penalty = { id:number; team:'home'|'away'; player_number:string; remaining:number }

type GameState = {
  homeName: string
  awayName: string
  scoreHome: number
  scoreAway: number
  shotsHome: number
  shotsAway: number
  period: string
  timerRemaining: number
  timeoutRemaining: number
  sirenOn: boolean
  obsVisible: boolean
  penalties: Penalty[]
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

function normalizeState(raw: Partial<GameState> & { penalties?: any }): GameState {
  return {
    homeName: raw.homeName ?? 'Casa',
    awayName: raw.awayName ?? 'Ospiti',
    scoreHome: Number(raw.scoreHome ?? 0),
    scoreAway: Number(raw.scoreAway ?? 0),
    shotsHome: Number(raw.shotsHome ?? 0),
    shotsAway: Number(raw.shotsAway ?? 0),
    period: raw.period ?? '1°',
    timerRemaining: Number(raw.timerRemaining ?? 20*60),
    timeoutRemaining: Math.max(0, Number(raw.timeoutRemaining ?? 0)),
    sirenOn: Boolean(raw.sirenOn),
    obsVisible: raw.obsVisible !== false,
    penalties: Array.isArray(raw.penalties)? raw.penalties as Penalty[] : [],
  }
}

export function GameScoreboard(){
  const { status, wsRef } = useWs('game')
  const [state, setState] = useState<GameState>(normalizeState({}))

  useEffect(() => { fetch('/api/v1/game/state').then(r => r.json()).then((s)=> setState(normalizeState(s))).catch(() => {}) }, [])
  useEffect(() => {
    const ws = wsRef.current
    if(!ws) return
    ws.onmessage = (ev) => {
      try{ const msg = JSON.parse(ev.data); if(msg.type === 'state' && msg.payload) { setState(normalizeState(msg.payload)) } }catch{}
    }
  }, [wsRef])

  function formatTime(total: number){ const m = Math.floor(total/60).toString().padStart(2,'0'); const s = (total%60).toString().padStart(2,'0'); return `${m}:${s}` }

  return (
    <div style={{minHeight:'100vh', background:'var(--scoreboard-bg)', color:'var(--scoreboard-text)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:24}}>
      <div style={{display:'flex', alignItems:'center', gap:24, position:'relative'}}>
        {!state.obsVisible && (
          <div style={{position:'absolute', top:-32, left:'50%', transform:'translateX(-50%)', fontSize:12, color:'#f97316', textTransform:'uppercase', letterSpacing:1}}>OBS nascosto</div>
        )}
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:28, opacity:.9}}>{state.homeName}</div>
          <div style={{fontSize:96, fontWeight:800}}>{state.scoreHome}</div>
        </div>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:72, letterSpacing:2}}>{formatTime(state.timerRemaining)}</div>
          <div style={{fontSize:20, opacity:.8}}>Periodo {state.period}</div>
        </div>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:28, opacity:.9}}>{state.awayName}</div>
          <div style={{fontSize:96, fontWeight:800}}>{state.scoreAway}</div>
        </div>
      </div>
      <div style={{display:'flex', gap:48, alignItems:'center'}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:14, opacity:.6, textTransform:'uppercase', letterSpacing:2}}>Tiri</div>
          <div style={{fontSize:32, fontWeight:700}}>{state.shotsHome}</div>
        </div>
        <div style={{width:1, height:40, background:'rgba(148,163,184,0.4)'}} />
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:14, opacity:.6, textTransform:'uppercase', letterSpacing:2}}>Tiri</div>
          <div style={{fontSize:32, fontWeight:700}}>{state.shotsAway}</div>
        </div>
      </div>
      {state.timeoutRemaining > 0 && (
        <div style={{fontSize:24, color:'#f97316', fontWeight:700}}>Timeout · {state.timeoutRemaining}s</div>
      )}
      {state.sirenOn && (
        <div style={{fontSize:18, color:'#22c55e', fontWeight:600}}>Sirena Attiva</div>
      )}
      <div style={{display:'flex', gap:48}}>
        <div>
          <div style={{fontSize:16, opacity:.8, marginBottom:8}}>Penalità {state.homeName}</div>
          <div style={{display:'flex', gap:12}}>
            {state.penalties.filter(p => p.team==='home').map(p => (
              <div key={p.id} style={{padding:8, background:'var(--scoreboard-panel)', borderRadius:8, minWidth:90, textAlign:'center'}}>
                <div style={{fontSize:14, opacity:.9}}>#{p.player_number}</div>
                <div style={{fontSize:20, fontWeight:700}}>{Math.floor(p.remaining/60)}:{String(p.remaining%60).padStart(2,'0')}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{fontSize:16, opacity:.8, marginBottom:8}}>Penalità {state.awayName}</div>
          <div style={{display:'flex', gap:12}}>
            {state.penalties.filter(p => p.team==='away').map(p => (
              <div key={p.id} style={{padding:8, background:'var(--scoreboard-panel)', borderRadius:8, minWidth:90, textAlign:'center'}}>
                <div style={{fontSize:14, opacity:.9}}>#{p.player_number}</div>
                <div style={{fontSize:20, fontWeight:700}}>{Math.floor(p.remaining/60)}:{String(p.remaining%60).padStart(2,'0')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="text-muted" style={{position:'fixed', bottom:12, right:12, fontSize:12}}>WS: {status}</div>
    </div>
  )
}
