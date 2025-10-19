import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { getToken } from '../auth'

type Summary = {
  greeting: string
  next_shift: { date: string, time: string, role: string } | null
  next_public_event: string | null
  maintenance: { open: number, high_priority: number, link: string }
  my_tasks: { assigned: number, due_soon: number, link: string }
  checklists: { pending_today: number, link: string }
  recent_documents: { name: string, path: string }[]
}

export function Dashboard(){
  const [summary, setSummary] = useState<Summary | null>(null)
  const [now, setNow] = useState<Date>(new Date())

  useEffect(() => {
    const t = getToken()
    const headers = t ? { Authorization: `Bearer ${t}` } : undefined
    fetch('/api/v1/dashboard/summary', { headers })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then((data) => setSummary(data))
      .catch(() => setSummary(null))
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const countdown = useMemo(() => {
    if (!summary?.next_public_event) return null
    const start = new Date(summary.next_public_event)
    const diff = Math.max(0, start.getTime() - now.getTime())
    const s = Math.floor(diff / 1000)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${h}h ${m}m ${sec}s`
  }, [summary?.next_public_event, now])

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Panoramica delle attività e stato del palaghiaccio</p>
      </div>

      {/* Welcome card */}
      <div className="card" style={{marginBottom: 'var(--space-8)'}}>
        <div className="card-body">
          <h2 style={{marginTop: 0, marginBottom: 'var(--space-3)', fontSize: 'var(--text-3xl)'}}>
            {summary?.greeting ?? 'Benvenuto!'}
          </h2>
          {summary?.next_shift ? (
            <p className="text-secondary" style={{fontSize: 'var(--text-lg)', marginBottom: 0}}>
              Prossimo turno: <strong style={{color: 'var(--text-primary)'}}>{summary.next_shift.date}, {summary.next_shift.time} - {summary.next_shift.role}</strong>
            </p>
          ) : (
            <p className="text-secondary" style={{fontSize: 'var(--text-lg)', marginBottom: 0}}>
              Nessun turno pianificato
            </p>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-4" style={{marginBottom: 'var(--space-8)'}}>
        <div className="card">
          <div className="card-body" style={{textAlign: 'center'}}>
            <div style={{
              width: '48px', 
              height: '48px', 
              background: 'var(--accent-primary)', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-4)'
            }}>
              <Icon name="home" color="white" />
            </div>
            <h3 style={{margin: '0 0 var(--space-2)', fontSize: 'var(--text-xl)'}}>Prossimo evento</h3>
            <div style={{fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)'}}>
              {countdown ?? '—'}
            </div>
            <p className="text-tertiary" style={{fontSize: 'var(--text-sm)', margin: 0}}>
              tempo rimanente
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-body" style={{textAlign: 'center'}}>
            <div style={{
              width: '48px', 
              height: '48px', 
              background: 'var(--accent-warning)', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-4)'
            }}>
              <Icon name="wrench" color="white" />
            </div>
            <h3 style={{margin: '0 0 var(--space-2)', fontSize: 'var(--text-xl)'}}>Manutenzioni</h3>
            <div style={{fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)'}}>
              {summary?.maintenance?.open ?? 0}
            </div>
            <p className="text-tertiary" style={{fontSize: 'var(--text-sm)', margin: 0}}>
              aperte ({summary?.maintenance?.high_priority ?? 0} prioritarie)
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-body" style={{textAlign: 'center'}}>
            <div style={{
              width: '48px', 
              height: '48px', 
              background: 'var(--accent-success)', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-4)'
            }}>
              <Icon name="checklist" color="white" />
            </div>
            <h3 style={{margin: '0 0 var(--space-2)', fontSize: 'var(--text-xl)'}}>I miei incarichi</h3>
            <div style={{fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)'}}>
              {summary?.my_tasks?.assigned ?? 0}
            </div>
            <p className="text-tertiary" style={{fontSize: 'var(--text-sm)', margin: 0}}>
              assegnati ({summary?.my_tasks?.due_soon ?? 0} in scadenza)
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-body" style={{textAlign: 'center'}}>
            <div style={{
              width: '48px', 
              height: '48px', 
              background: 'var(--accent-info)', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-4)'
            }}>
              <Icon name="tasks" color="white" />
            </div>
            <h3 style={{margin: '0 0 var(--space-2)', fontSize: 'var(--text-xl)'}}>Checklist</h3>
            <div style={{fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)'}}>
              {summary?.checklists?.pending_today ?? 0}
            </div>
            <p className="text-tertiary" style={{fontSize: 'var(--text-sm)', margin: 0}}>
              da completare oggi
            </p>
          </div>
        </div>
      </div>

      {/* Quick actions and recent documents */}
      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h3 style={{margin: 0, fontSize: 'var(--text-xl)'}}>Azioni rapide</h3>
          </div>
          <div className="card-body">
            <div style={{display: 'grid', gap: 'var(--space-3)'}}>
              <a href="/maintenance" className="btn btn-outline" style={{justifyContent: 'flex-start'}}>
                <Icon name="wrench"/> 
                Gestione manutenzioni
              </a>
              <a href="/tasks" className="btn btn-outline" style={{justifyContent: 'flex-start'}}>
                <Icon name="checklist"/> 
                I miei incarichi
              </a>
              <a href="/shifts" className="btn btn-outline" style={{justifyContent: 'flex-start'}}>
                <Icon name="tasks"/> 
                Gestione turni
              </a>
              <a href="/documents" className="btn btn-outline" style={{justifyContent: 'flex-start'}}>
                <Icon name="files"/> 
                Documenti
              </a>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 style={{margin: 0, fontSize: 'var(--text-xl)'}}>Documenti recenti</h3>
          </div>
          <div className="card-body">
            {(Array.isArray(summary?.recent_documents) ? summary!.recent_documents : []).length > 0 ? (
              <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--space-3)'}}>
                {summary!.recent_documents.slice(0, 4).map((d, i) => (
                  <a 
                    key={i} 
                    href={d.path} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--surface-secondary)',
                      color: 'var(--text-primary)',
                      textDecoration: 'none',
                      transition: 'background 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-tertiary)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--surface-secondary)'}
                  >
                    <Icon name="files" size={18} />
                    <span style={{fontSize: 'var(--text-sm)'}}>{d.name}</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-tertiary" style={{textAlign: 'center', margin: 0}}>
                Nessun documento recente
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
