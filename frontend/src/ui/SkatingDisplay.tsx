import React, { useEffect, useMemo, useRef, useState } from 'react'

type View = 'logo' | 'timer' | 'nextEvent' | 'message'

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

export function SkatingDisplay(){
  const { status, wsRef } = useWs('display')
  const [view, setView] = useState<View>('logo')
  const [seconds, setSeconds] = useState(0)
  const [text, setText] = useState('')

  useEffect(() => {
    const ws = wsRef.current
    if(!ws) return
    ws.onmessage = (ev) => {
      try{
        const msg = JSON.parse(ev.data)
        if(msg.type === 'showView'){
          const v = msg.payload?.view as View
          setView(v)
          if(v === 'timer') setSeconds(msg.payload?.seconds ?? 0)
          if(v === 'message') setText(msg.payload?.text ?? '')
        }
      }catch{}
    }
  }, [wsRef])

  useEffect(() => {
    if(view !== 'timer' || seconds <= 0) return
    const id = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [view, seconds])

  return (
    <div style={{minHeight:'100vh', background:'#0b253d', color:'#e8f1f8', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16}}>
      {view === 'logo' && (
        <h1 style={{fontSize:64, margin:0}}>Palafeltre</h1>
      )}
      {view === 'nextEvent' && (
        <div>
          <h2 style={{fontSize:48, margin:0}}>Prossimo Evento</h2>
          <p className="text-muted" style={{textAlign:'center'}}>Vedi pannello di controllo per dettagli</p>
        </div>
      )}
      {view === 'message' && (
        <h2 style={{fontSize:48, margin:0}}>{text}</h2>
      )}
      {view === 'timer' && (
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:120, fontWeight:700, letterSpacing:2}}>{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</div>
          <div className="text-muted">Inizio tra</div>
        </div>
      )}
      <div className="text-muted" style={{position:'fixed', bottom:12, right:12, fontSize:12}}>WS: {status}</div>
    </div>
  )
}
