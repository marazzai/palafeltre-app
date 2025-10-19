import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'

function token(){ return localStorage.getItem('token')||'' }

export default function ObsControl(){
  const [settings, setSettings] = useState<Record<string,string>>({})
  const [scenes, setScenes] = useState<string[]>([])
  const [status, setStatus] = useState<{connected?:boolean} | null>(null)
  const [mapping, setMapping] = useState<{ activate?:string; deactivate?:string}>({})

  useEffect(()=>{ (async()=>{
    try{
      const list = await fetch('/api/v1/admin/settings', { headers: { Authorization: `Bearer ${token()}` } }).then(r=>r.json())
      const map: Record<string,string> = {}
      list.forEach((it:any)=> map[it.key]=it.value)
      setSettings(map)
    }catch{}
  })() },[])

  const set = (k:string,v:string)=> setSettings(prev=> ({...prev, [k]: v}))

  const saveSettings = async ()=>{
    const keys = ['obs.host','obs.port','obs.password','obs.scene']
    const items = keys.filter(k=> settings[k]!==undefined).map(k=> ({ key:k, value: String(settings[k] ?? '') }))
    await fetch('/api/v1/admin/settings', { method:'PUT', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(items) })
    alert('Impostazioni salvate')
  }

  const scanScenes = async ()=>{
    try{
      const r = await fetch('/api/v1/admin/obs/scan', { headers: { Authorization: `Bearer ${token()}` } })
      if(!r.ok){ alert('Scan failed'); return }
      const d = await r.json(); setScenes(d.scenes||[])
    }catch{ alert('Scan error') }
  }

  const loadStatus = async ()=>{
    try{ const r = await fetch('/api/v1/admin/obs/status', { headers: { Authorization: `Bearer ${token()}` } }); if(!r.ok) return setStatus({connected:false}); setStatus(await r.json()) }catch{ setStatus({connected:false}) }
  }

  const disconnectObs = async ()=>{ await fetch('/api/v1/admin/obs/disconnect', { method:'POST', headers: { Authorization: `Bearer ${token()}` } }); await loadStatus() }

  const loadMapping = async ()=>{
    try{
      const r = await fetch('/api/v1/admin/obs/mapping', { headers: { Authorization: `Bearer ${token()}` } })
      if(!r.ok) return
      const d = await r.json(); let map: any = {}
      try{ map = typeof d.mapping === 'string' ? JSON.parse(d.mapping||'{}') : (d.mapping || {}) }catch{ map = d.mapping||{} }
      setMapping(map)
    }catch{}
  }

  const saveMapping = async ()=>{
    await fetch('/api/v1/admin/obs/mapping', { method:'PUT', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ mapping }) })
    alert('Mapping salvato')
  }

  useEffect(()=>{ loadStatus(); loadMapping() },[])

  return (
    <div>
      <h1>Controllo OBS</h1>
      <div className="card"><div className="card-body" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:12}}>
        <label>Host<input value={settings['obs.host']||''} onChange={e=> set('obs.host', e.target.value)} /></label>
        <label>Porta<input value={settings['obs.port']||''} onChange={e=> set('obs.port', e.target.value)} /></label>
        <label>Password<input type="password" value={settings['obs.password']||''} onChange={e=> set('obs.password', e.target.value)} /></label>
        <label>Scena predefinita<input value={settings['obs.scene']||''} onChange={e=> set('obs.scene', e.target.value)} /></label>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <button className="btn btn-outline" onClick={scanScenes}>Scansiona Scene</button>
          <select value={settings['obs.scene']||''} onChange={e=> set('obs.scene', e.target.value)}>
            <option value="">-- seleziona scena --</option>
            {scenes.map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <div>
            <div style={{fontSize:13}}>OBS connesso: <strong>{status?.connected? 'Sì' : 'No'}</strong></div>
            <div style={{marginTop:6}}>
              <button className="btn btn-outline" onClick={loadStatus}>Aggiorna stato</button>
              <button className="btn btn-outline" onClick={disconnectObs} style={{marginLeft:8}}>Disconnetti</button>
            </div>
          </div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
          <div>
            <div style={{fontSize:12, fontWeight:600}}>Scena da attivare</div>
            <select value={mapping.activate||''} onChange={e=> setMapping(prev=> ({...prev, activate: e.target.value}))}>
              <option value="">-- nessuna --</option>
              {scenes.map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:12, fontWeight:600}}>Scena da disattivare</div>
            <select value={mapping.deactivate||''} onChange={e=> setMapping(prev=> ({...prev, deactivate: e.target.value}))}>
              <option value="">-- nessuna --</option>
              {scenes.map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div></div>
      <div style={{marginTop:12, display:'flex', gap:8}}>
        <button className="btn" onClick={saveSettings}>Salva impostazioni</button>
        <button className="btn" onClick={saveMapping}>Salva mapping</button>
      </div>
    </div>
  )
}
