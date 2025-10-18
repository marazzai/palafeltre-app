import React, { useEffect, useState } from 'react'
import { getToken } from '../../auth'

export default function AdminObs(){
  const [host, setHost] = useState('')
  const [port, setPort] = useState(4455)
  const [password, setPassword] = useState('')
  const [scene, setScene] = useState('')
  const [activateScene, setActivateScene] = useState('')
  const [deactivateScene, setDeactivateScene] = useState('')
  const [scenes, setScenes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const token = getToken()

  const loadInfo = async ()=>{
    setLoading(true)
    try{
      const r = await fetch('/api/v1/admin/obs/info', { headers: { Authorization: `Bearer ${token}` } })
      if(!r.ok) throw new Error('info failed')
      const d = await r.json()
      setHost(d.host||'')
      setPort(d.port||4455)
      setScene(d.scene||'')
      setActivateScene(d.activate_scene||'')
      setDeactivateScene(d.deactivate_scene||'')
    }catch(e){ console.error(e) }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ loadInfo() }, [])

  const scan = async ()=>{
    try{
      const r = await fetch('/api/v1/admin/obs/scan', { headers: { Authorization: `Bearer ${token}` } })
      if(!r.ok){ const txt = await r.text().catch(()=>null); alert('Scan failed: '+(txt||r.status)); return }
      const d = await r.json()
      setScenes(d.scenes || [])
      alert(`Trovate ${ (d.scenes||[]).length } scene`)
    }catch(e){ alert('Scan error') }
  }

  const saveConfig = async ()=>{
    const cfg = { host: host||'', port: Number(port)||4455, password: password || '' }
    const r = await fetch('/api/v1/admin/obs/config', { method: 'PUT', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(cfg) })
    if(!r.ok){ alert('Salvataggio config fallito'); return }
    // save activate/deactivate scenes via settings endpoint
    const items = [
      { key: 'obs.activate_scene', value: activateScene || '' },
      { key: 'obs.deactivate_scene', value: deactivateScene || '' },
    ]
    const s = await fetch('/api/v1/admin/settings', { method: 'PUT', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(items) })
    if(!s.ok){ alert('Salvataggio scene fallito'); return }
    alert('Configurazione OBS salvata')
  }

  if(loading) return <div className="container"><p className="text-muted">Caricamento OBS…</p></div>

  return (
    <div className="container">
      <h2>OBS Integration</h2>
      <div className="card"><div className="card-body" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:12}}>
        <label>Host<input value={host} onChange={e=> setHost(e.target.value)} /></label>
        <label>Porta<input type="number" value={port} onChange={e=> setPort(Number(e.target.value||'4455'))} /></label>
        <label>Password<input type="password" value={password} onChange={e=> setPassword(e.target.value)} /></label>
        <label>Scena predefinita<input value={scene} onChange={e=> setScene(e.target.value)} /></label>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <button className="btn" onClick={scan}>Scansiona scene</button>
          <select value={activateScene} onChange={e=> setActivateScene(e.target.value)}>
            <option value="">-- seleziona scena per ATTIVA --</option>
            {scenes.map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={deactivateScene} onChange={e=> setDeactivateScene(e.target.value)}>
            <option value="">-- seleziona scena per DISATTIVA --</option>
            {scenes.map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div></div>
      <div style={{marginTop:12, display:'flex', justifyContent:'flex-end'}}>
        <button className="btn" onClick={saveConfig}>Salva</button>
      </div>
    </div>
  )
}
