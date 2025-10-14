import React, { useEffect, useMemo, useState } from 'react'

type Task = { id:number; title:string; description?:string; priority:'low'|'medium'|'high'; due_date?:string|null; completed:boolean; assignees:number[]; creator_id:number; created_at:string }
type Comment = { id:number; task_id:number; author_id:number; content:string; created_at:string }

export function TasksPage(){
  const [token, setToken] = useState<string>('')
  const [view, setView] = useState<'mine'|'all'|'overdue'|'completed'>('mine')
  const [tasks, setTasks] = useState<Task[]>([])
  const [selected, setSelected] = useState<Task | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [newTask, setNewTask] = useState<{ title:string; description:string; priority:'low'|'medium'|'high'; due_date:string; assignees:string }>({ title:'', description:'', priority:'medium', due_date:'', assignees:'' })

  useEffect(() => { const t = localStorage.getItem('token'); if(t) setToken(t) }, [])

  const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined

  async function load(){
    const res = await fetch(`/api/v1/tasks?view=${view}`, { headers: authHeader || undefined })
    const data = await res.json()
    setTasks(data)
  }
  useEffect(() => { if(token) load() }, [view, token])

  async function toggleCompleted(t: Task){
    await fetch(`/api/v1/tasks/${t.id}`, { method:'PATCH', headers: { 'Content-Type':'application/json', ...(authHeader||{}) }, body: JSON.stringify({ completed: !t.completed }) })
    await load()
  }

  async function openDetail(t: Task){
    setSelected(t)
    const res = await fetch(`/api/v1/tasks/${t.id}/comments`, { headers: authHeader || undefined })
    setComments(await res.json())
  }

  async function addComment(){
    if(!selected || !newComment.trim()) return
    await fetch(`/api/v1/tasks/${selected.id}/comments`, { method:'POST', headers: { 'Content-Type':'application/json', ...(authHeader||{}) }, body: JSON.stringify({ content: newComment }) })
    setNewComment('')
    await openDetail(selected)
  }

  async function createTask(){
  const assigneeIds = newTask.assignees.split(',').map((s: string) => s.trim()).filter(Boolean).map(Number)
    const due = newTask.due_date ? newTask.due_date : null
    const res = await fetch('/api/v1/tasks', { method:'POST', headers: { 'Content-Type':'application/json', ...(authHeader||{}) }, body: JSON.stringify({ title:newTask.title, description:newTask.description, priority:newTask.priority, due_date: due, assignee_ids: assigneeIds }) })
    if(res.ok){ setShowNew(false); setNewTask({ title:'', description:'', priority:'medium', due_date:'', assignees:'' }); await load() }
  }

  function priorityColor(p: Task['priority']){ return p==='high' ? 'var(--color-danger)' : p==='low' ? 'var(--color-success)' : 'var(--color-warning)' }

  return (
    <div className="container">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
        <h2 style={{margin:0}}>Incarichi</h2>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <input className="input" placeholder="Bearer token" value={token} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToken(e.target.value)} />
          <button className="btn btn-outline" onClick={() => localStorage.setItem('token', token)}>Salva token</button>
          <button className="btn" onClick={() => setShowNew(true)}>Nuovo Incarico</button>
        </div>
      </div>
      <div style={{display:'flex', gap:8, marginBottom:12}}>
        {(['mine','all','overdue','completed'] as const).map(v => (
          <button key={v} className={"btn " + (view===v ? '' : 'btn-outline')} onClick={() => setView(v)}>{v==='mine'?'I Miei Incarichi': v==='all'?'Tutti':'overdue'===v?'Scaduti':'Completati'}</button>
        ))}
      </div>

      <div className="grid">
        <div className="card" style={{gridColumn:'span 2'}}>
          <div className="card-body">
            {tasks.length === 0 ? <p className="text-muted">Nessun incarico.</p> : (
              <ul>
                {tasks.map(t => (
                  <li key={t.id} style={{display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom:'1px solid var(--surface-3)'}}>
                    <input type="checkbox" checked={t.completed} onChange={() => toggleCompleted(t)} />
                    <a href="#" onClick={e => { e.preventDefault(); openDetail(t) }} style={{flex:1, color:'inherit', textDecoration:'none'}}>{t.title}</a>
                    <span style={{display:'inline-block', width:8, height:8, borderRadius:999, background: priorityColor(t.priority)}}></span>
                    {t.due_date && <span className="text-muted" style={{fontSize:12}}>{new Date(t.due_date).toLocaleDateString()}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><strong>Dettaglio</strong></div>
          <div className="card-body" style={{display:'flex', flexDirection:'column', gap:8}}>
            {!selected ? <p className="text-muted">Seleziona un incarico</p> : (
              <>
                <div style={{fontSize:18, fontWeight:600}}>{selected.title}</div>
                {selected.description && <div className="text-muted">{selected.description}</div>}
                <div className="text-muted" style={{fontSize:12}}>Priorità: {selected.priority.toUpperCase()} • Scadenza: {selected.due_date ? new Date(selected.due_date).toLocaleDateString() : '-'}</div>
                <div style={{marginTop:8, fontWeight:600}}>Commenti</div>
                <div style={{display:'flex', flexDirection:'column', gap:6, maxHeight:220, overflow:'auto'}}>
                  {comments.map(c => (
                    <div key={c.id} style={{padding:8, background:'var(--surface-2)', borderRadius:8}}>
                      <div style={{fontSize:12, opacity:.8}}>Utente #{c.author_id} • {new Date(c.created_at).toLocaleString()}</div>
                      <div>{c.content}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex', gap:8}}>
                  <input className="input" placeholder="Aggiungi un commento" value={newComment} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewComment(e.target.value)} />
                  <button className="btn" onClick={addComment}>Invia</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showNew && (
        <div className="modal is-open">
          <div className="modal-content" style={{minWidth:520}}>
            <div className="modal-header"><strong>Nuovo Incarico</strong></div>
            <div className="modal-body" style={{display:'flex', flexDirection:'column', gap:8}}>
              <input className="input" placeholder="Titolo" value={newTask.title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTask({ ...newTask, title: e.target.value })} />
              <textarea className="input" placeholder="Descrizione (HTML semplice)" rows={4} value={newTask.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewTask({ ...newTask, description: e.target.value })} />
              <div style={{display:'flex', gap:8}}>
                <select className="input" value={newTask.priority} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewTask({ ...newTask, priority: e.target.value as any })}>
                  <option value="low">Bassa</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </select>
                <input className="input" type="date" value={newTask.due_date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTask({ ...newTask, due_date: e.target.value })} />
              </div>
              <input className="input" placeholder="Assegnatari (ID separati da virgola)" value={newTask.assignees} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTask({ ...newTask, assignees: e.target.value })} />
            </div>
            <div className="modal-footer" style={{display:'flex', justifyContent:'flex-end', gap:8}}>
              <button className="btn btn-outline" onClick={() => setShowNew(false)}>Annulla</button>
              <button className="btn" onClick={createTask}>Crea</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
