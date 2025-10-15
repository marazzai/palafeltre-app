import React, { useEffect, useRef, useState } from 'react'

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

export function SkatingPlayer(){
  const { status, wsRef } = useWs('player')
  const [state, setState] = useState({ playing: false, volume: 70, track: 'N/A' })

  useEffect(() => {
    const ws = wsRef.current
    if(!ws) return
    ws.onmessage = (ev) => {
      try{
        const msg = JSON.parse(ev.data)
        if(msg.type === 'setVolume') setState(s => ({ ...s, volume: msg.payload?.value ?? s.volume }))
        if(msg.type === 'toggle') setState(s => ({ ...s, playing: !s.playing }))
        if(msg.type === 'prevTrack' || msg.type === 'nextTrack') setState(s => ({ ...s, track: msg.type }))
        if(msg.type === 'playJingle') setState(s => ({ ...s, track: 'Jingle', playing: true }))
      }catch{}
    }
  }, [wsRef])

  return (
    <div className="container" style={{maxWidth:680}}>
      <h2>Player Musicale</h2>
      <div className="card">
        <div className="card-body" style={{display:'flex', flexDirection:'column', gap:8}}>
          <div>WS: <span className="text-muted">{status}</span></div>
          <div>Traccia: <strong>{state.track}</strong></div>
          <div>Stato: {state.playing ? 'Riproduzione' : 'Pausa'}</div>
          <div>Volume: {state.volume}%</div>
          <p className="text-muted" style={{fontSize:12}}>Questa è una vista dimostrativa. Integrare in futuro un vero player.</p>
        </div>
      </div>
    </div>
  )
}
