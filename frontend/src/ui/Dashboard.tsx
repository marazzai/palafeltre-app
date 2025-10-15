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
    <div className="container" style={{display:'grid', gap:16}}>
      {/* Riepilogo personale */}
      <div className="card" style={{padding:16}}>
        <h2 style={{marginTop:0, marginBottom:8}}>{summary?.greeting ?? 'Ciao!'}</h2>
        {summary?.next_shift ? (
          <p className="text-muted">Prossimo turno: <strong>{summary.next_shift.date}, {summary.next_shift.time}, {summary.next_shift.role}</strong></p>
        ) : <p className="text-muted">Nessun turno pianificato.</p>}
      </div>

      {/* Griglia widgets */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:16}}>
        <a href="/" className="card" style={{padding:16, textDecoration:'none', color:'inherit'}} aria-label="Prossimo evento pubblico">
          <h3 style={{marginTop:0}}>Prossimo evento pubblico</h3>
          <p className="text-muted" style={{marginBottom:8}}>Inizio tra</p>
          <div style={{fontSize:24, fontWeight:700}}>{countdown ?? '—'}</div>
        </a>

        <a href={summary?.maintenance?.link ?? '/maintenance'} className="card" style={{padding:16, textDecoration:'none', color:'inherit'}}>
          <h3 style={{marginTop:0, display:'flex', alignItems:'center', gap:8}}><Icon name="wrench"/> Stato manutenzioni</h3>
          <p className="text-muted">Segnalazioni aperte</p>
          <div style={{display:'flex', gap:16}}>
            <div><strong style={{fontSize:22}}>{summary?.maintenance?.open ?? 0}</strong> totali</div>
            <div><strong style={{fontSize:22, color:'var(--color-danger)'}}>{summary?.maintenance?.high_priority ?? 0}</strong> alta priorità</div>
          </div>
        </a>

        <a href={summary?.my_tasks?.link ?? '/tasks'} className="card" style={{padding:16, textDecoration:'none', color:'inherit'}}>
          <h3 style={{marginTop:0}}>I miei incarichi</h3>
          <div style={{display:'flex', gap:16}}>
            <div><strong style={{fontSize:22}}>{summary?.my_tasks?.assigned ?? 0}</strong> assegnati</div>
            <div><strong style={{fontSize:22, color:'var(--color-warning)'}}>{summary?.my_tasks?.due_soon ?? 0}</strong> in scadenza</div>
          </div>
        </a>

        <a href={summary?.checklists?.link ?? '/checklists'} className="card" style={{padding:16, textDecoration:'none', color:'inherit'}}>
          <h3 style={{marginTop:0}}>Checklist da completare</h3>
          <p className="text-muted">Oggi</p>
          <div style={{fontSize:22, fontWeight:700}}>{summary?.checklists?.pending_today ?? 0}</div>
        </a>

        <div className="card" style={{padding:16}}>
          <h3 style={{marginTop:0}}>Ultimi documenti caricati</h3>
          <ul style={{margin:0, paddingLeft:18}}>
            {(summary?.recent_documents ?? []).slice(0,3).map((d,i) => (
              <li key={i}><a href={d.path}>{d.name}</a></li>
            ))}
          </ul>
        </div>
      </div>

      {/* Accesso rapido */}
      <div className="card" style={{padding:16}}>
        <h3 style={{marginTop:0}}>Accesso rapido</h3>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:12}}>
          <a href="/maintenance" className="btn btn-outline" style={{justifyContent:'flex-start'}}><Icon name="wrench"/> Manutenzioni</a>
          <a href="/tasks" className="btn btn-outline" style={{justifyContent:'flex-start'}}><Icon name="checklist"/> Incarichi</a>
          <a href="/checklists" className="btn btn-outline" style={{justifyContent:'flex-start'}}><Icon name="tasks"/> Checklist</a>
          <a href="/documents" className="btn btn-outline" style={{justifyContent:'flex-start'}}><Icon name="files"/> Documenti</a>
          <a href="/roles" className="btn btn-outline" style={{justifyContent:'flex-start'}}><Icon name="tasks"/> Ruoli</a>
          <a href="/users" className="btn btn-outline" style={{justifyContent:'flex-start'}}><Icon name="users"/> Utenti</a>
        </div>
      </div>
    </div>
  )
}
