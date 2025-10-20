import React, { useEffect, useState } from 'react'

type Ticket = { id:number; title:string; description?:string|null; category:string; priority:'low'|'medium'|'high'; status:'open'|'in_progress'|'resolved'; creator_id:number; assignee_id?:number|null; created_at:string; updated_at:string }
type Category = { id:number; name:string; color?:string|null; sort_order:number }

type Column = 'open'|'in_progress'|'resolved'

const statusLabel: Record<Column,string> = { open:'Aperto', in_progress:'In Lavorazione', resolved:'Risolto' }

function priorityColor(p: Ticket['priority']){
  if(p==='high') return 'var(--color-danger)'
  if(p==='low') return 'var(--color-success)'
  return 'var(--color-warning)'
}

export function MaintenanceKanban(){
  const [token, setToken] = useState('')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [dragging, setDragging] = useState<Ticket | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<{ title:string; description:string; category:string; priority:'low'|'medium'|'high'; assignee_id:string }>(
    { title:'', description:'', category:'Generale', priority:'medium', assignee_id:'' }
  )
  const [detail, setDetail] = useState<Ticket | null>(null)
  const [cats, setCats] = useState<Category[]>([])
  const [filterCat, setFilterCat] = useState<string>('')
  const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined

  useEffect(() => { const t = getToken(); if(t) setToken(t) }, [])

  async function load(){
    try{
      const params = new URLSearchParams(); if(filterCat) params.set('category', filterCat)
      const res = await fetch(`/api/v1/tickets${params.toString()?`?${params.toString()}`:''}`, { headers: authHeader })
      if(!res.ok) throw new Error('Errore caricamento tickets')
      setTickets(await res.json())
    }catch(err){ console.error(err); setTickets([]) }
  }
  useEffect(() => { if(token) load() }, [token, filterCat])
  useEffect(()=> { (async ()=>{ if(!token) return; try{ const r = await fetch('/api/v1/tickets/categories', { headers: authHeader }); if(r.ok) setCats(await r.json()) }catch(e){ console.error(e) } })() }, [token])

  function byStatus(s: Column){ return tickets.filter((t: Ticket) => t.status === s) }

  async function onDrop(target: Column){
    if(!dragging) return
    if(dragging.status === target) return
    try{
      const r = await fetch(`/api/v1/tickets/${dragging.id}/move`, { method:'POST', headers: { 'Content-Type':'application/json', ...(authHeader||{}) }, body: JSON.stringify({ status: target }) })
      if(!r.ok) throw new Error('Errore spostamento ticket')
      await load()
    }catch(e){ console.error(e); alert('Impossibile spostare il ticket') }
  }

  function card(t: Ticket){
    const cat = cats.find(x => x.name === t.category)
    return (
      <div key={t.id}
        draggable
        onDragStart={() => setDragging(t)}
        className="card"
        style={{ borderLeft: `4px solid ${priorityColor(t.priority)}`, cursor:'grab' }}
        onClick={() => setDetail(t)}
      >
        <div className="card-body" style={{display:'flex', flexDirection:'column', gap:6}}>
          <div style={{display:'flex', justifyContent:'space-between'}}>
            <div><strong>#{t.id}</strong> {t.title}</div>
            {t.assignee_id && <div className="avatar" title={`Utente #${t.assignee_id}`}>{t.assignee_id}</div>}
          </div>
          <div className="text-muted" style={{fontSize:12}}>
            {cat ? (
              <span style={{display:'inline-flex', alignItems:'center', gap:6}}>
                <span style={{width:10, height:10, background: cat.color || '#777', borderRadius: 10, display:'inline-block'}} />
                {cat.name}
              </span>
            ) : t.category}
          </div>
        </div>
      </div>
    )
  }

  async function createTicket(){
    try{
      const body = { title: form.title, description: form.description, category: form.category, priority: form.priority, assignee_id: form.assignee_id ? Number(form.assignee_id) : null }
      const res = await fetch('/api/v1/tickets', { method:'POST', headers:{ 'Content-Type':'application/json', ...(authHeader||{}) }, body: JSON.stringify(body) })
      if(!res.ok) throw new Error('Errore creazione ticket')
      setShowNew(false); setStep(1); setForm({ title:'', description:'', category:'Generale', priority:'medium', assignee_id:'' }); await load()
    }catch(e){ console.error(e); alert('Impossibile creare il ticket') }
  }

  return (
    <div className="container">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
        <h2 style={{margin:0}}>Segnalazioni e Manutenzioni</h2>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <input className="input" placeholder="Bearer token" value={token} onChange={e => setToken(e.target.value)} />
          <button className="btn btn-outline" onClick={() => localStorage.setItem('token', token)}>Salva token</button>
          <select className="input" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">Tutte le categorie</option>
            {cats.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <button className="btn" onClick={() => setShowNew(true)}>Nuova Segnalazione</button>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12}}>
        {(['open','in_progress','resolved'] as Column[]).map(col => (
          <div key={col} onDragOver={e => e.preventDefault()} onDrop={() => onDrop(col)}>
            <div className="card">
              <div className="card-header"><strong>{statusLabel[col]}</strong></div>
              <div className="card-body" style={{display:'flex', flexDirection:'column', gap:8, minHeight:300}}>
                {byStatus(col).map(card)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showNew && (
        <div className="modal is-open">
          <div className="modal-content" style={{minWidth:560}}>
            <div className="modal-header"><strong>Nuova Segnalazione</strong></div>
            <div className="modal-body" style={{display:'flex', flexDirection:'column', gap:12}}>
              {step===1 && (
                <>
                  <input className="input" placeholder="Titolo" value={form.title} onChange={e => setForm({...form, title:e.target.value})} />
                  <textarea className="input" rows={5} placeholder="Descrizione" value={form.description} onChange={e => setForm({...form, description:e.target.value})} />
                </>
              )}
              {step===2 && (
                <div style={{display:'flex', gap:8}}>
                  <select className="input" value={form.category} onChange={e => setForm({...form, category:e.target.value})}>
                    <option value="Generale">Generale</option>
                    {cats.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <select className="input" value={form.priority} onChange={e => setForm({...form, priority: e.target.value as any})}>
                    <option value="low">Bassa</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                  </select>
                </div>
              )}
              {step===3 && (
                <>
                  <div className="text-muted" style={{fontSize:12}}>Foto (facoltativo) — per ora puoi allegare dopo la creazione.</div>
                </>
              )}
              {step===4 && (
                <>
                  <input className="input" placeholder="Assegnatario (ID utente)" value={form.assignee_id} onChange={e => setForm({...form, assignee_id:e.target.value})} />
                </>
              )}
            </div>
            <div className="modal-footer" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div className="text-muted" style={{fontSize:12}}>Step {step} di 4</div>
              <div style={{display:'flex', gap:8}}>
                <button className="btn btn-outline" onClick={() => setShowNew(false)}>Annulla</button>
                {step>1 && <button className="btn btn-outline" onClick={() => setStep(step-1)}>Indietro</button>}
                {step<4 ? (
                  <button className="btn" onClick={() => setStep(step+1)}>Avanti</button>
                ) : (
                  <button className="btn" onClick={createTicket}>Crea</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="modal is-open" onClick={() => setDetail(null)}>
          <div className="modal-content" style={{minWidth:920}} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><strong>Ticket #{detail.id}</strong></div>
            <div className="modal-body" style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:16}}>
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                <div style={{fontSize:18, fontWeight:600}}>{detail.title}</div>
                <div className="text-muted">{detail.description || ''}</div>
                <div className="text-muted" style={{fontSize:12}}>Creato da #{detail.creator_id} — {new Date(detail.created_at).toLocaleString()}</div>
                <div className="text-muted" style={{fontSize:12}}>Categoria: {detail.category}</div>
                <div className="text-muted" style={{fontSize:12}}>Priorità: {detail.priority.toUpperCase()}</div>
                <div className="text-muted" style={{fontSize:12}}>Allegati: nessuno (stub)</div>
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                <div className="card">
                  <div className="card-header"><strong>Assegnazione</strong></div>
                  <div className="card-body" style={{display:'flex', gap:8, alignItems:'center'}}>
                    <div className="avatar" title={`Utente #${detail.assignee_id||'-'}`}>{detail.assignee_id||'-'}</div>
                    <input className="input" placeholder="Cambia assegnatario (ID)" onKeyDown={async e => {
                      if(e.key === 'Enter'){
                        const v = (e.target as HTMLInputElement).value.trim();
                        await fetch(`/api/v1/tickets/${detail.id}`, { method:'PATCH', headers: { 'Content-Type':'application/json', ...(authHeader||{}) }, body: JSON.stringify({ assignee_id: v? Number(v): null }) })
                        await load()
                      }
                    }} />
                  </div>
                </div>
                <div className="card">
                  <div className="card-header"><strong>Storico Stati</strong></div>
                  <div className="card-body text-muted">Aggiornamenti verranno mostrati qui (todo).</div>
                </div>
                <div className="card">
                  <div className="card-header"><strong>Commenti</strong></div>
                  <div className="card-body" id="comments-box">
                    <Comments ticketId={detail.id} authHeader={authHeader} />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{display:'flex', justifyContent:'flex-end'}}>
              <button className="btn btn-outline" onClick={() => setDetail(null)}>Chiudi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Comments({ ticketId, authHeader }: { ticketId: number; authHeader?: Record<string,string> }){
  const [items, setItems] = useState<{ id:number; author_id:number; content:string; created_at:string }[]>([])
  const [txt, setTxt] = useState('')
  useEffect(() => { (async () => { const r = await fetch(`/api/v1/tickets/${ticketId}/comments`, { headers: authHeader }); setItems(await r.json()) })() }, [ticketId])
  async function add(){
    if(!txt.trim()) return
    await fetch(`/api/v1/tickets/${ticketId}/comments`, { method:'POST', headers: { 'Content-Type':'application/json', ...(authHeader||{}) }, body: JSON.stringify({ content: txt }) })
    setTxt('')
    const r = await fetch(`/api/v1/tickets/${ticketId}/comments`, { headers: authHeader }); setItems(await r.json())
  }
  return (
    <div style={{display:'flex', flexDirection:'column', gap:8}}>
      <div style={{display:'flex', flexDirection:'column', gap:6, maxHeight:180, overflow:'auto'}}>
        {items.map(c => (
          <div key={c.id} style={{padding:8, background:'var(--surface-2)', borderRadius:8}}>
            <div style={{fontSize:12, opacity:.8}}>Utente #{c.author_id} • {new Date(c.created_at).toLocaleString()}</div>
            <div>{c.content}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex', gap:8}}>
        <input className="input" placeholder="Aggiungi commento" value={txt} onChange={e => setTxt(e.target.value)} />
        <button className="btn" onClick={add}>Invia</button>
      </div>
    </div>
  )
}
