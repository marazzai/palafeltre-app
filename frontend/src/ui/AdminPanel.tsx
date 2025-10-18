import React, { useEffect, useState } from 'react'
import { getToken } from '../auth'

export default function AdminPanel(): JSX.Element {
  const token = getToken()
  const [host, setHost] = useState('')
  const [port, setPort] = useState<number>(4455)
  const [password, setPassword] = useState('')
  const [scenes, setScenes] = useState<string[]>([])
  const [activateScene, setActivateScene] = useState('')
  const [deactivateScene, setDeactivateScene] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { loadInfo() }, [])

  async function loadInfo() {
    try {
      const r = await fetch('/api/v1/admin/obs/info', { headers: { Authorization: `Bearer ${token}` } })
      if (!r.ok) return
      const d = await r.json()
      setHost(d.host || '')
      setPort(d.port || 4455)
      setActivateScene(d.activate_scene || '')
      setDeactivateScene(d.deactivate_scene || '')
    } catch (e) { /* ignore */ }
  }

  async function saveAll() {
    setBusy(true)
    setStatus('Salvataggio...')
    try {
      const cfg = { host, port: Number(port) || 4455, password }
      const r = await fetch('/api/v1/admin/obs/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(cfg)
      })
      if (!r.ok) {
        const t = await r.text().catch(() => null)
        setStatus('Salvataggio config fallito: ' + (t || r.status))
        return false
      }

      const items = [
        { key: 'obs.activate_scene', value: activateScene || '' },
        { key: 'obs.deactivate_scene', value: deactivateScene || '' },
      ]
      const s = await fetch('/api/v1/admin/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(items)
      })
      if (!s.ok) {
        const t = await s.text().catch(() => null)
        setStatus('Salvataggio scenes fallito: ' + (t || s.status))
        return false
      }

      setStatus('Configurazione OBS salvata')
      setTimeout(() => setStatus(null), 2000)
      return true
    } catch (e) {
      setStatus('Errore: ' + String(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function scan() {
    setBusy(true)
    setStatus('Scansione...')
    try {
      const r = await fetch('/api/v1/admin/obs/scan', { headers: { Authorization: `Bearer ${token}` } })
      if (!r.ok) {
        const t = await r.text().catch(() => null)
        setStatus('Scan failed: ' + (t || r.status))
        return
      }
      const d = await r.json()
  setScenes(d.scenes || [])
  if (d.warning) setStatus(d.warning)
  else setStatus(`Trovate ${(d.scenes || []).length} scene`)
    } catch (e) {
      setStatus('Scan error: ' + String(e))
    } finally {
      setBusy(false)
      setTimeout(() => setStatus(null), 2000)
    }
  }

  async function trigger(action: 'activate' | 'deactivate') {
    const scene = action === 'activate' ? activateScene : deactivateScene
    if (!scene) { setStatus('Seleziona prima una scena'); return }
    setBusy(true); setStatus('Invio trigger...')
    try {
      const r = await fetch('/api/v1/admin/obs/trigger', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, scene })
      })
      if (!r.ok) {
        const t = await r.text().catch(() => null)
        setStatus('Errore trigger: ' + (t || r.status))
        return
      }
      const j = await r.json().catch(() => null)
      if (j && typeof j.obs_changed !== 'undefined') {
        setStatus(j.obs_changed ? 'Trigger inviato (OBS cambiata)' : 'Trigger inviato (OBS non raggiunta)')
      } else {
        setStatus('Trigger inviato')
      }
    } catch (e) {
      setStatus('Errore: ' + String(e))
    } finally {
      setBusy(false)
      setTimeout(() => setStatus(null), 2000)
    }
  }

  return (
    <div className="container">
      <h2>Admin — OBS</h2>

      <div className="card"><div className="card-body">
        <h3>Connessione OBS</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <label>Host<input value={host} onChange={e => setHost(e.target.value)} /></label>
          <label>Porta<input type="number" value={port} onChange={e => setPort(Number(e.target.value || '4455'))} /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn" onClick={async () => { const ok = await saveAll(); if (ok) await scan() }} disabled={busy}>{busy ? 'In corso…' : 'Connetti + Scansiona'}</button>
          <button className="btn btn-outline" onClick={scan} disabled={busy}>Scansiona</button>
          <button className="btn btn-outline" onClick={saveAll} disabled={busy}>Salva</button>
        </div>
      </div></div>

      <div style={{ height: 12 }} />

      <div className="card"><div className="card-body">
        <h3>Assegna scene</h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <label>Scena per MOSTRA TABELLONE</label>
            <select value={activateScene} onChange={e => setActivateScene(e.target.value)}>
              <option value="">-- seleziona --</option>
              {scenes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>Scena per DISATTIVA TABELLONE</label>
            <select value={deactivateScene} onChange={e => setDeactivateScene(e.target.value)}>
              <option value="">-- seleziona --</option>
              {scenes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={saveAll} disabled={busy}>Salva mapping</button>
            <button className="btn btn-outline" onClick={() => trigger('activate')}>Test ATTIVA</button>
            <button className="btn btn-outline" onClick={() => trigger('deactivate')}>Test DISATTIVA</button>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>{status && <small className="text-muted">{status}</small>}</div>
      </div></div>
    </div>
  )
}
