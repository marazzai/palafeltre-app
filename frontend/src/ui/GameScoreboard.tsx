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
  const prevTimeRef = useRef<number>(state.timerRemaining)
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false)
  const [viewport, setViewport] = useState<{ w?: number; h?: number; mt: number; mr: number; mb: number; ml: number }>(() => {
    const params = new URLSearchParams(window.location.search)
    const w = Number(params.get('w') || '')
    const h = Number(params.get('h') || '')
    const margin = Number(params.get('margin') || '')
    const mt = Number(params.get('mt') || (Number.isFinite(margin) ? margin : ''))
    const mr = Number(params.get('mr') || (Number.isFinite(margin) ? margin : ''))
    const mb = Number(params.get('mb') || (Number.isFinite(margin) ? margin : ''))
    const ml = Number(params.get('ml') || (Number.isFinite(margin) ? margin : ''))
    return {
      w: Number.isFinite(w) && w > 0 ? w : undefined,
      h: Number.isFinite(h) && h > 0 ? h : undefined,
      mt: Number.isFinite(mt) && mt >= 0 ? mt : 0,
      mr: Number.isFinite(mr) && mr >= 0 ? mr : 0,
      mb: Number.isFinite(mb) && mb >= 0 ? mb : 0,
      ml: Number.isFinite(ml) && ml >= 0 ? ml : 0,
    }
  })

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

  // Simple siren using WebAudio API (short dual-oscillator sweep)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    // Preload siren audio if available
    const audio = new Audio('/api/v1/scoreboard/siren')
    audio.preload = 'auto'
    audioRef.current = audio
    // Try silent autoplay to unlock if policy allows
    audio.muted = true
    audio.play().then(() => {
      audio.pause(); audio.currentTime = 0; audio.muted = false; setAudioUnlocked(true)
    }).catch(() => {
      setAudioUnlocked(false)
    })
  }, [])

  const playSiren = () => {
    // Try audio file first
    const a = audioRef.current
    if(a){ a.currentTime = 0; a.volume = 1.0; a.play().catch(() => {}) }
    // Fallback synth
    try{
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc1 = ctx.createOscillator(); const osc2 = ctx.createOscillator(); const gain = ctx.createGain()
      osc1.type = 'square'; osc2.type = 'sawtooth'; osc1.frequency.value = 650; osc2.frequency.value = 760
      gain.gain.value = 0.0001; osc1.connect(gain); osc2.connect(gain); gain.connect(ctx.destination)
      const now = ctx.currentTime
      gain.gain.exponentialRampToValueAtTime(0.4, now + 0.02)
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.5)
      osc2.frequency.exponentialRampToValueAtTime(990, now + 0.5)
      osc1.start(); osc2.start()
      setTimeout(() => { try { osc1.stop(); osc2.stop(); ctx.close() } catch{} }, 700)
    }catch{}
  }

  // React to sirenPulse messages and to timer hitting 0
  useEffect(() => {
    const ws = wsRef.current
    if(!ws) return
    const prevOnMsg = ws.onmessage
    ws.onmessage = (ev) => {
      try{
        const msg = JSON.parse(ev.data)
        if(msg.type === 'sirenPulse') { playSiren() }
        if(msg.type === 'state' && msg.payload) { setState(normalizeState(msg.payload)) }
      }catch{}
    }
    return () => { if(ws) ws.onmessage = prevOnMsg as any }
  }, [wsRef])

  useEffect(() => {
    const prev = prevTimeRef.current
    if(prev > 0 && state.timerRemaining === 0){ playSiren() }
    prevTimeRef.current = state.timerRemaining
  }, [state.timerRemaining])

  function formatTime(total: number){ const m = Math.floor(total/60).toString().padStart(2,'0'); const s = (total%60).toString().padStart(2,'0'); return `${m}:${s}` }

  // Helpers
  const sortAndPad = (items: Penalty[]) => {
    const arr = items.sort((a,b)=>a.remaining-b.remaining)
    return [arr[0] ?? null, arr[1] ?? null] as Array<Penalty | null>
  }
  const penaltiesHome = sortAndPad(state.penalties.filter(p => p.team==='home'))
  const penaltiesAway = sortAndPad(state.penalties.filter(p => p.team==='away'))

  return (
    <div className="scoreboard-root" style={{padding: `${viewport.mt}px ${viewport.mr}px ${viewport.mb}px ${viewport.ml}px`}}>
      {/* Local styles to avoid leaking to the rest of the app */}
      <style>{`
        .scoreboard-root { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #000014; color: #e8f1f8; overflow: hidden; }
        .sb-wrap { width: min(96vw, 1600px); aspect-ratio: 16/9; display: grid; grid-template-rows: 1fr auto; gap: 1.5vh; }
        .sb-main { display: grid; grid-template-columns: 1fr 1.1fr 1fr; gap: 1.2vw; align-items: stretch; }
        .team { display: grid; grid-template-rows: auto 1fr; background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.2)); border: 2px solid rgba(255,255,255,0.15); border-radius: 12px; overflow: hidden; }
        .team-name { font-family: 'Oswald', sans-serif; font-size: clamp(18px, 2.2vw, 42px); text-transform: uppercase; letter-spacing: 1px; text-align: center; padding: 0.6vw; color: #fff; }
        .score { display: flex; align-items: center; justify-content: center; font-family: 'Orbitron', 'Oswald', sans-serif; font-weight: 800; font-size: clamp(56px, 8vw, 180px); color: #fff; text-shadow: 0 0 18px rgba(255,255,255,0.25); }
        .center { display:flex; align-items:center; justify-content:center; flex-direction:column; background: radial-gradient(1200px 600px at 50% -20%, rgba(255,255,255,0.1), rgba(0,0,0,0.2)); border: 2px solid rgba(255,255,255,0.15); border-radius: 12px; }
        .timer { font-family: 'Orbitron', 'Oswald', sans-serif; font-weight: 800; font-size: clamp(54px, 7.6vw, 160px); letter-spacing: 2px; line-height: 1; }
        .period { margin-top: 0.6vh; font-family: 'Oswald', sans-serif; font-weight: 600; font-size: clamp(16px, 2vw, 36px); letter-spacing: 2px; opacity: 0.9; }
  .sb-bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2vw; }
  .pen-box { display: grid; grid-template-rows: repeat(2, auto); gap: 0.8vw; background: rgba(255,255,255,0.04); border: 2px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 0.8vw; }
  .pen-card { display:grid; grid-template-columns: 1fr auto; align-items:center; gap: 0.6vw; padding: 0.8vw 1vw; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; min-height: clamp(40px, 6vh, 90px); }
  .pen-number { font-family: 'Oswald', sans-serif; font-weight:800; font-size: clamp(18px, 2.6vw, 42px); justify-self: start; }
  .pen-time { font-family: 'Orbitron', sans-serif; font-weight:800; font-size: clamp(18px, 2.8vw, 46px); justify-self: end; }
        .badge { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); padding: 6px 10px; background: #f97316; color: #000; border-radius: 999px; font-family: 'Oswald', sans-serif; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; }
        .ws { position: fixed; bottom: 10px; right: 12px; font-size: 12px; opacity: .6; font-family: 'Oswald', sans-serif; }
        .unlock { position: fixed; inset: 0; display:flex; align-items:center; justify-content:center; background: rgba(0,0,0,0.6); }
        .unlock-card { background: rgba(15, 53, 84, 0.95); border: 2px solid rgba(255,255,255,0.2); border-radius: 12px; padding: 18px 22px; text-align:center; max-width: 520px; margin: 16px; }
        .unlock-title { font-family: 'Oswald', sans-serif; font-size: 22px; margin-bottom: 8px; }
        .unlock-text { font-size: 14px; opacity: .9; margin-bottom: 14px; }
        .unlock-btn { display:inline-block; padding: 10px 18px; border-radius: 8px; background: #f97316; color: #000; font-weight: 800; letter-spacing: .5px; cursor:pointer; border:none; }
        @media (max-width: 900px) { .sb-wrap { aspect-ratio: auto; } .sb-main { grid-template-columns: 1fr; } .sb-bottom { grid-template-columns: 1fr; } }
      `}</style>

      {!state.obsVisible && (<div className="badge">OBS nascosto</div>)}
      {!audioUnlocked && (
        <div className="unlock">
          <div className="unlock-card">
            <div className="unlock-title">Abilita audio</div>
            <div className="unlock-text">Per le policy del browser è necessario un clic per attivare i suoni del tabellone (sirena a fine periodo e ad ogni minuto).</div>
            <button className="unlock-btn" onClick={() => {
              const a = audioRef.current
              if(a){ a.muted = false; a.volume = 0.01; a.currentTime = 0; a.play().then(() => { setTimeout(() => { try { a.pause(); a.currentTime = 0 } catch{} }, 150); setAudioUnlocked(true) }).catch(() => {}) }
              // Also unlock WebAudio by creating/resuming a context in gesture
              try { const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext; const ctx = new Ctx(); ctx.resume && ctx.resume(); setTimeout(() => { try { ctx.close() } catch{} }, 200) } catch{}
            }}>Abilita audio</button>
          </div>
        </div>
      )}
      <div className="sb-wrap" style={{ width: viewport.w ? `${viewport.w}px` : undefined, height: viewport.h ? `${viewport.h}px` : undefined, aspectRatio: viewport.w && viewport.h ? 'auto' as any : undefined }}>
        <div className="sb-main">
          <div className="team" style={{borderColor: 'rgba(255,255,255,0.15)'}}>
            <div className="team-name" style={{background: state.colorHome}}>{state.homeName}</div>
            <div className="score" style={{background: 'rgba(0,0,0,0.25)'}}>{state.scoreHome}</div>
          </div>
          <div className="center">
            <div className="timer">{formatTime(state.timerRemaining)}</div>
            <div className="period">PER {state.period}</div>
            {state.timeoutRemaining > 0 && (
              <div style={{marginTop: '0.8vh', fontFamily: 'Oswald, sans-serif', fontWeight:800, color:'#f97316', fontSize: 'clamp(18px, 3.2vw, 48px)'}}>TIMEOUT · {state.timeoutRemaining}s</div>
            )}
          </div>
          <div className="team" style={{borderColor: 'rgba(255,255,255,0.15)'}}>
            <div className="team-name" style={{background: state.colorAway}}>{state.awayName}</div>
            <div className="score" style={{background: 'rgba(0,0,0,0.25)'}}>{state.scoreAway}</div>
          </div>
        </div>
        <div className="sb-bottom">
          <div className="pen-box" style={{borderColor: state.colorHome}}>
            {penaltiesHome.map((p, idx) => (
              <div className="pen-card" key={p ? p.id : `home-empty-${idx}`} style={!p ? {opacity:.5, justifyContent:'center'} : undefined}>
                {p ? (
                  <>
                    <div className="pen-number" style={{color: state.colorHome}}>#{p.player_number}</div>
                    <div className="pen-time">{Math.floor(p.remaining/60)}:{String(p.remaining%60).padStart(2,'0')}</div>
                  </>
                ) : (
                  <>
                    <div className="pen-number" style={{opacity:.7}}>—</div>
                    <div className="pen-time">—</div>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="pen-box" style={{borderColor: state.colorAway}}>
            {penaltiesAway.map((p, idx) => (
              <div className="pen-card" key={p ? p.id : `away-empty-${idx}`} style={!p ? {opacity:.5, justifyContent:'center'} : undefined}>
                {p ? (
                  <>
                    <div className="pen-number" style={{color: state.colorAway}}>#{p.player_number}</div>
                    <div className="pen-time">{Math.floor(p.remaining/60)}:{String(p.remaining%60).padStart(2,'0')}</div>
                  </>
                ) : (
                  <>
                    <div className="pen-number" style={{opacity:.7}}>—</div>
                    <div className="pen-time">—</div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ws">WS: {status}</div>
    </div>
  )
}
