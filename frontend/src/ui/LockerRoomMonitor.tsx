import React, { useEffect, useState } from 'react'

type MonitorData = {
  presets: Array<{ id: number; label: string; text: string }>
  custom: { home: string; away: string }
}

export function LockerRoomMonitor() {
  const [data, setData] = useState<MonitorData>({ presets: [], custom: { home: '', away: '' } })
  const [activePreset, setActivePreset] = useState<number | null>(null)
  const [side, setSide] = useState<'home' | 'away'>('home')

  useEffect(() => {
    // Determina il lato dallo URL param o localStorage
    const params = new URLSearchParams(window.location.search)
    const urlSide = params.get('side')
    if (urlSide === 'home' || urlSide === 'away') {
      setSide(urlSide)
      localStorage.setItem('monitor-side', urlSide)
    } else {
      const stored = localStorage.getItem('monitor-side')
      if (stored === 'home' || stored === 'away') setSide(stored)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000) // Refresh ogni 5 secondi
    return () => clearInterval(interval)
  }, [side])

  async function fetchData() {
    try {
      const [presetsRes, customRes] = await Promise.all([
        fetch('/api/v1/monitors/presets').then(r => r.json()),
        fetch(`/api/v1/monitors/${side}`).then(r => r.json()),
      ])
      setData({
        presets: presetsRes.items || [],
        custom: { ...data.custom, [side]: customRes.content || '' },
      })
    } catch (e) {
      console.error('Errore caricamento monitor:', e)
    }
  }

  // Determina cosa mostrare: custom text o preset
  const displayText = data.custom[side]
    ? data.custom[side]
    : activePreset !== null
    ? data.presets.find(p => p.id === activePreset)?.text || ''
    : 'Benvenuti'

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px',
      fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{
        background: 'rgba(0,0,0,0.3)',
        borderRadius: '24px',
        padding: '48px 64px',
        maxWidth: '90%',
        textAlign: 'center',
        boxShadow: '0 16px 64px rgba(0,0,0,0.4)',
      }}>
        <h1 style={{
          fontSize: '48px',
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '4px',
          marginBottom: '32px',
        }}>
          {side === 'home' ? 'Spogliatoio Casa' : 'Spogliatoio Ospiti'}
        </h1>
        <div style={{
          fontSize: '32px',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap',
          opacity: 0.95,
        }}>
          {displayText}
        </div>
      </div>
      <div style={{
        marginTop: '32px',
        fontSize: '18px',
        opacity: 0.7,
      }}>
        {new Date().toLocaleString('it-IT')}
      </div>
    </div>
  )
}
