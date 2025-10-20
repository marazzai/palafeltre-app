import React, { useEffect, useMemo, useState } from 'react'

type Task = { 
  id:number; title:string; description?:string; priority:'low'|'medium'|'high'; 
  due_date?:string|null; completed:boolean; assignees:number[]; creator_id:number; created_at:string;
  is_recurring?:boolean; recurrence_pattern?:string|null; recurrence_interval?:number|null; 
  recurrence_end_date?:string|null; parent_task_id?:number|null;
}
type Comment = { id:number; task_id:number; author_id:number; content:string; created_at:string }
type Attachment = { id:number; file_name:string; uploaded_at:string }

export function TasksPage(){
  const [token, setToken] = useState<string>('')
  const [view, setView] = useState<'mine'|'all'|'overdue'|'completed'>('mine')
  const [tasks, setTasks] = useState<Task[]>([])
  const [selected, setSelected] = useState<Task | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [newComment, setNewComment] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newTask, setNewTask] = useState<{ 
    title:string; description:string; priority:'low'|'medium'|'high'; due_date:string; assignees:string;
    is_recurring:boolean; recurrence_pattern:string; recurrence_interval:number; recurrence_end_date:string;
  }>({ 
    title:'', description:'', priority:'medium', due_date:'', assignees:'',
    is_recurring:false, recurrence_pattern:'daily', recurrence_interval:1, recurrence_end_date:''
  })

  useEffect(() => { const t = getToken(); if(t) setToken(t) }, [])

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
    const [commentsRes, attachmentsRes] = await Promise.all([
      fetch(`/api/v1/tasks/${t.id}/comments`, { headers: authHeader || undefined }),
      fetch(`/api/v1/tasks/${t.id}/attachments`, { headers: authHeader || undefined })
    ])
    setComments(await commentsRes.json())
    const attData = await attachmentsRes.json()
    setAttachments(attData.items || [])
  }

  async function addComment(){
    if(!selected || !newComment.trim()) return
    await fetch(`/api/v1/tasks/${selected.id}/comments`, { method:'POST', headers: { 'Content-Type':'application/json', ...(authHeader||{}) }, body: JSON.stringify({ content: newComment }) })
    setNewComment('')
    await openDetail(selected)
  }

  async function uploadAttachment(){
    if(!selected || !uploadFile) return
    const formData = new FormData()
    formData.append('file', uploadFile)
    await fetch(`/api/v1/tasks/${selected.id}/attachments`, { method:'POST', headers: authHeader || undefined, body: formData })
    setUploadFile(null)
    await openDetail(selected)
  }

  async function downloadAttachment(attId: number, fileName: string){
    const res = await fetch(`/api/v1/tasks/attachments/${attId}`, { headers: authHeader || undefined })
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    window.URL.revokeObjectURL(url)
  }

  async function deleteAttachment(attId: number){
    if(!confirm('Eliminare questo allegato?')) return
    await fetch(`/api/v1/tasks/attachments/${attId}`, { method:'DELETE', headers: authHeader || undefined })
    if(selected) await openDetail(selected)
  }

  async function createTask(){
  const assigneeIds = newTask.assignees.split(',').map((s: string) => s.trim()).filter(Boolean).map(Number)
    const due = newTask.due_date ? newTask.due_date : null
    const payload: any = { 
      title:newTask.title, 
      description:newTask.description, 
      priority:newTask.priority, 
      due_date: due, 
      assignee_ids: assigneeIds,
      is_recurring: newTask.is_recurring
    }
    if(newTask.is_recurring){
      payload.recurrence_pattern = newTask.recurrence_pattern
      payload.recurrence_interval = newTask.recurrence_interval
      payload.recurrence_end_date = newTask.recurrence_end_date || null
    }
    const res = await fetch('/api/v1/tasks', { method:'POST', headers: { 'Content-Type':'application/json', ...(authHeader||{}) }, body: JSON.stringify(payload) })
    if(res.ok){ 
      setShowNew(false); 
      setNewTask({ title:'', description:'', priority:'medium', due_date:'', assignees:'', is_recurring:false, recurrence_pattern:'daily', recurrence_interval:1, recurrence_end_date:'' }); 
      await load() 
    }
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
                <div style={{display:'flex', flexDirection:'column', gap:6, maxHeight:180, overflow:'auto'}}>
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

                <div style={{marginTop:12, fontWeight:600}}>Allegati</div>
                <div style={{display:'flex', flexDirection:'column', gap:6, maxHeight:120, overflow:'auto'}}>
                  {attachments.length === 0 ? (
                    <span className="text-muted" style={{fontSize:12}}>Nessun allegato</span>
                  ) : (
                    attachments.map(a => (
                      <div key={a.id} style={{display:'flex', alignItems:'center', gap:8, padding:6, background:'var(--surface-2)', borderRadius:6}}>
                        <span style={{flex:1, fontSize:13}}>{a.file_name}</span>
                        <button className="btn btn-outline" style={{padding:'4px 8px', fontSize:12}} onClick={() => downloadAttachment(a.id, a.file_name)}>Download</button>
                        <button className="btn btn-outline" style={{padding:'4px 8px', fontSize:12}} onClick={() => deleteAttachment(a.id)}>Elimina</button>
                      </div>
                    ))
                  )}
                </div>
                <div style={{display:'flex', gap:8, alignItems:'center'}}>
                  <input type="file" onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUploadFile(e.target.files?.[0] || null)} style={{flex:1, fontSize:13}} />
                  <button className="btn" onClick={uploadAttachment} disabled={!uploadFile}>Carica</button>
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
              
              <div style={{marginTop:8, padding:8, background:'var(--surface-1)', borderRadius:6}}>
                <label style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer'}}>
                  <input type="checkbox" checked={newTask.is_recurring} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTask({ ...newTask, is_recurring: e.target.checked })} />
                  <span>Incarico ricorrente</span>
                </label>
                {newTask.is_recurring && (
                  <div style={{marginTop:8, display:'flex', flexDirection:'column', gap:6}}>
                    <div style={{display:'flex', gap:8}}>
                      <select className="input" value={newTask.recurrence_pattern} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewTask({ ...newTask, recurrence_pattern: e.target.value })}>
                        <option value="daily">Giornaliero</option>
                        <option value="weekly">Settimanale</option>
                        <option value="monthly">Mensile</option>
                      </select>
                      <input className="input" type="number" min="1" placeholder="Ogni N" value={newTask.recurrence_interval} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTask({ ...newTask, recurrence_interval: parseInt(e.target.value) || 1 })} />
                    </div>
                    <input className="input" type="date" placeholder="Data fine ricorrenza (opzionale)" value={newTask.recurrence_end_date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTask({ ...newTask, recurrence_end_date: e.target.value })} />
                  </div>
                )}
              </div>
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
