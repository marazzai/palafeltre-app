import { useEffect, useState, useRef } from 'react'
import { Icon } from '../components/Icon'

function token(){ return localStorage.getItem('token')||'' }

export default function ObsControl(){
  const [settings, setSettings] = useState<Record<string,string>>({})
  const [scenes, setScenes] = useState<string[]>([])
  const [status, setStatus] = useState<{connected?:boolean} | null>(null)
  const [mapping, setMapping] = useState<{ activate?:string; deactivate?:string}>({})
  const polling = useRef<number | null>(null)

  useEffect(()=>{ (async()=>{
    try{
      const list = await fetch('/api/v1/admin/settings', { headers: { Authorization: `Bearer ${token()}` } }).then(r=>r.json())
      const map: Record<string,string> = {}
      list.forEach((it:any)=> map[it.key]=it.value)
      setSettings(map)
    }catch{}
  })() },[])

  useEffect(()=>{ // start status polling
    loadStatus()
    polling.current = window.setInterval(()=> loadStatus().catch(()=>{}), 5000)
    return ()=> { if(polling.current) window.clearInterval(polling.current) }
  },[])

  const set = (k:string,v:string)=> setSettings(prev=> ({...prev, [k]: v}))

  async function saveSettings(){
    const keys = ['obs.host','obs.port','obs.password','obs.scene']
    const items = keys.filter(k=> settings[k]!==undefined).map(k=> ({ key:k, value: String(settings[k] ?? '') }))
    const r = await fetch('/api/v1/admin/settings', { method:'PUT', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(items) })
    if(!r.ok) alert('Errore salvataggio impostazioni')
    else alert('Impostazioni salvate')
  }

  async function connectObs(){
    // post config to backend which will store settings and attempt to start the manager
    const body = { host: settings['obs.host']||'', port: Number(settings['obs.port']||4455), password: settings['obs.password']||'' }
    const r = await fetch('/api/v1/admin/obs/config', { method: 'PUT', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(body) })
    if(!r.ok){ alert('Connessione fallita'); return }
    await loadStatus()
  }

  async function scanScenes(){
    try{
      const r = await fetch('/api/v1/admin/obs/scan', { headers: { Authorization: `Bearer ${token()}` } })
      if(!r.ok){ const txt = await r.text().catch(()=>null); alert('Scan failed: ' + (txt||r.status)); return }
      const d = await r.json(); setScenes(d.scenes||[])
    }catch(e){ alert('Scan error') }
  }

  async function loadStatus(){
    try{ const r = await fetch('/api/v1/admin/obs/status', { headers: { Authorization: `Bearer ${token()}` } }); if(!r.ok) return setStatus({connected:false}); setStatus(await r.json()) }catch{ setStatus({connected:false}) }
  }

  async function disconnectObs(){ await fetch('/api/v1/admin/obs/disconnect', { method:'POST', headers: { Authorization: `Bearer ${token()}` } }); await loadStatus() }

  async function loadMapping(){
    try{
      const r = await fetch('/api/v1/admin/obs/mapping', { headers: { Authorization: `Bearer ${token()}` } })
      if(!r.ok) return
      const d = await r.json(); let map: any = {}
      try{ map = typeof d.mapping === 'string' ? JSON.parse(d.mapping||'{}') : (d.mapping || {}) }catch{ map = d.mapping||{} }
      setMapping(map)
    }catch{}
  }

  async function saveMapping(){
    const r = await fetch('/api/v1/admin/obs/mapping', { method:'PUT', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ mapping }) })
    if(!r.ok) alert('Errore salvataggio mapping')
    else alert('Mapping salvato')
  }

  useEffect(()=>{ loadMapping() },[])

  return (
    <div>
      <h1>Controllo OBS</h1>

      <div className="card"><div className="card-body">
        <div style={{display:'flex', gap:12, alignItems:'flex-start', flexWrap:'wrap'}}>
          <div style={{flex:1, minWidth:280}}>
            <h3>Configurazione connessione</h3>
            <label>Host<input value={settings['obs.host']||''} onChange={e=> set('obs.host', e.target.value)} /></label>
            <label>Porta<input value={settings['obs.port']||''} onChange={e=> set('obs.port', e.target.value)} /></label>
            <label>Password<input type="password" value={settings['obs.password']||''} onChange={e=> set('obs.password', e.target.value)} /></label>
            <div style={{display:'flex', gap:8, marginTop:8}}>
              <button className="btn" onClick={connectObs}><Icon name="play" /> Connetti</button>
              <button className="btn btn-outline" onClick={disconnectObs}><Icon name="logout" /> Disconnetti</button>
              <button className="btn btn-outline" onClick={saveSettings}><Icon name="ok" /> Salva impostazioni</button>
            </div>
            <div style={{marginTop:8, fontSize:13}}>Stato connessione: <strong>{status?.connected? 'Connesso' : 'Non connesso'}</strong></div>
          </div>

          <div style={{flex:1, minWidth:320}}>
            <h3>Scansione Scene</h3>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              <button className="btn btn-outline" onClick={scanScenes}>Scansiona</button>
              <button className="btn" onClick={()=> setScenes([])}>Pulisci</button>
            </div>
            <div style={{marginTop:8}}>
              <select value={settings['obs.scene']||''} onChange={e=> set('obs.scene', e.target.value)} style={{width:'100%'}}>
                <option value="">-- seleziona scena predefinita --</option>
                {scenes.map(s=> <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{marginTop:8}}>
              <strong>Scene trovate:</strong>
              <div style={{maxHeight:140, overflow:'auto', marginTop:6}}>
                {scenes.length === 0 ? <div className="text-muted">Nessuna scena</div> : scenes.map(s=> <div key={s} style={{padding:6, borderBottom:'1px solid #eee'}}>{s}</div>)}
              </div>
            </div>
          </div>
        </div>
      </div></div>

      <div style={{marginTop:12}} className="card"><div className="card-body">
        <h3>Mapping</h3>
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
        <div style={{marginTop:8}}>
          <button className="btn" onClick={saveMapping}>Salva mapping</button>
        </div>
      </div></div>
    </div>
  )
}
