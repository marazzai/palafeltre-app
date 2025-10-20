import React, { useEffect, useMemo, useState } from 'react'

type Folder = { id:number; name:string; parent_id:number|null }
type Doc = { id:number; name:string; folder_id:number|null; created_at:string; updated_at:string; latest_version:number|null }

type TreeNode = Folder & { children: TreeNode[] }

export function DocumentsPage(){
  const [token, setToken] = useState('')
  const [tree, setTree] = useState<TreeNode[]>([])
  const [current, setCurrent] = useState<number|null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [docs, setDocs] = useState<Doc[]>([])
  const [showUpload, setShowUpload] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [showVersions, setShowVersions] = useState<{ docId:number; list:any[] } | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<{ id:number; name:string; parent_id:number|null }[]>([])
  const [searchQ, setSearchQ] = useState('')
  const [searchRes, setSearchRes] = useState<any[]|null>(null)

  useEffect(() => { const t = getToken(); if(t) setToken(t) }, [])
  const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined

  async function loadTree(){
    const res = await fetch('/api/v1/documents/folders', { headers: authHeader }); const all: Folder[] = await res.json()
    // build tree
    const byParent: Record<string, TreeNode[]> = {}
    for(const f of all){
      const node: TreeNode = { ...f, children: [] }
      const key = String(f.parent_id ?? 'root')
      byParent[key] = byParent[key] || []
      byParent[key].push(node)
    }
    function build(parent: number|null): TreeNode[] {
      const arr = byParent[String(parent ?? 'root')] || []
      for(const n of arr){ n.children = build(n.id) }
      return arr
    }
    setTree(build(null))
  }

  async function openArchivioAutomatico(){
    // Try to find folder named 'Archivio Automatico' at root; if not present, just reload
    const res = await fetch('/api/v1/documents/folders', { headers: authHeader }); const all: Folder[] = await res.json()
    const rootChildren = all.filter(f=> f.parent_id === null)
    const arch = rootChildren.find(f=> f.name === 'Archivio Automatico')
    await loadTree()
    if(arch){ await loadFolder(arch.id) }
    else { await loadFolder(null) }
  }

  async function loadFolder(folderId: number|null){
  const q = folderId==null ? '' : `?folder_id=${folderId}`
  const res = await fetch(`/api/v1/documents/contents${q}`, { headers: authHeader })
    const data = await res.json()
    setFolders(data.folders); setDocs(data.documents); setCurrent(folderId); setBreadcrumb(data.breadcrumb||[]); setSearchRes(null)
  }

  useEffect(() => { if(token){ loadTree(); loadFolder(null) } }, [token])

  async function createFolder(){
    const name = prompt('Nome nuova cartella?'); if(!name) return
    await fetch('/api/v1/documents/folders', { method:'POST', headers:{ 'Content-Type':'application/json', ...(authHeader||{}) }, body: JSON.stringify({ name, parent_id: current }) })
    await loadTree(); await loadFolder(current)
  }

  async function upload(){
    if(!file) return
    const form = new FormData(); form.append('file', file)
  await fetch(`/api/v1/documents/upload${current==null?'':`?folder_id=${current}`}`, { method:'POST', headers: authHeader, body: form as any })
    setShowUpload(false); setFile(null); await loadFolder(current)
  }

  async function openVersions(docId: number){
    const res = await fetch(`/api/v1/documents/${docId}/versions`, { headers: authHeader })
    setShowVersions({ docId, list: await res.json() })
  }

  async function renameDoc(docId: number){
    const name = prompt('Nuovo nome documento?'); if(!name) return
    await fetch(`/api/v1/documents/${docId}/rename`, { method:'POST', headers:{ 'Content-Type':'application/json', ...(authHeader||{}) }, body: JSON.stringify({ name }) })
    await loadFolder(current)
  }

  async function deleteDoc(docId: number){
    if(!confirm('Eliminare il documento?')) return
    await fetch(`/api/v1/documents/${docId}`, { method:'DELETE', headers: authHeader })
    await loadFolder(current)
  }

  async function renameFolder(){
    if(current==null) return
    const name = prompt('Nuovo nome cartella?'); if(!name) return
    await fetch(`/api/v1/documents/folders/${current}/rename`, { method:'POST', headers:{ 'Content-Type':'application/json', ...(authHeader||{}) }, body: JSON.stringify({ name }) })
    await loadTree(); await loadFolder(current)
  }

  async function deleteFolder(){
    if(current==null) return
    if(!confirm('Eliminare la cartella (solo se vuota)?')) return
    const r = await fetch(`/api/v1/documents/folders/${current}`, { method:'DELETE', headers: authHeader })
    if(!r.ok){ alert('La cartella non è vuota'); return }
    await loadTree(); await loadFolder(null)
  }

  async function doSearch(){
    if(!searchQ.trim()){ setSearchRes(null); return }
    const r = await fetch(`/api/v1/documents/search?q=${encodeURIComponent(searchQ)}`, { headers: authHeader })
    const d = await r.json(); setSearchRes(d.items||[])
  }

  function SidebarNode({ n, depth=0 }:{ n: TreeNode; depth?: number }){
    return (
      <div>
        <div style={{paddingLeft: depth*8, cursor:'pointer'}} onClick={() => loadFolder(n.id)}>
          📁 {n.name}
        </div>
        {n.children.map(c => <SidebarNode key={c.id} n={c} depth={depth+1} />)}
      </div>
    )
  }

  return (
    <div className="container docs-layout">
      <div className="card" style={{height:'calc(100vh - 180px)', overflow:'auto'}}>
        <div className="card-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <strong>Cartelle</strong>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <input className="input" placeholder="Bearer token" value={token} onChange={e => setToken(e.target.value)} style={{width:140}} />
            <button className="btn btn-outline" onClick={() => localStorage.setItem('token', token)}>Salva</button>
          </div>
        </div>
        <div className="card-body">
          <div style={{marginBottom:8, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
            <input className="input" placeholder="Cerca documenti..." value={searchQ} onChange={e=> setSearchQ(e.target.value)} onKeyDown={e=> e.key==='Enter' && doSearch()} style={{width:'100%'}} />
            <button className="btn" onClick={doSearch}>Cerca</button>
          </div>
          {tree.map(n => <SidebarNode key={n.id} n={n} />)}
        </div>
      </div>

      <div>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
          <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
            <h3 style={{margin:0}}>{current===null ? 'Documenti' : `Cartella #${current}`}</h3>
            {breadcrumb.length>0 && (
              <div className="text-muted" style={{fontSize:12}}>
                {breadcrumb.map((b,i)=> (
                  <span key={b.id}>
                    {i>0 && ' / '}<a href="#" onClick={(e)=> { e.preventDefault(); loadFolder(b.id) }}>{b.name}</a>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={{display:'flex', gap:8}}>
            <button className="btn btn-outline" onClick={openArchivioAutomatico}>Archivio Automatico</button>
            <button className="btn" onClick={() => setShowUpload(true)}>Carica File</button>
            <button className="btn btn-outline" onClick={createFolder}>Crea Cartella</button>
            <button className="btn btn-outline" onClick={renameFolder} disabled={current==null}>Rinomina Cartella</button>
            <button className="btn btn-outline" onClick={deleteFolder} disabled={current==null}>Elimina Cartella</button>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            {searchRes ? (
              <div>
                <div style={{marginBottom:8}}><strong>Risultati ricerca</strong> ({searchRes.length})</div>
                {searchRes.map((it:any) => (
                  <div key={it.id} className="card" style={{marginBottom:8}}>
                    <div className="card-body" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <div>
                        <div style={{fontWeight:600}}>{it.name}</div>
                        <div className="text-muted" style={{fontSize:12}}>
                          {it.breadcrumb?.map((b:any,i:number)=> (<span key={b.id}>{i>0 && ' / '}{b.name}</span>))}
                        </div>
                      </div>
                      <div>
                        <button className="btn btn-outline" onClick={()=> { setSearchRes(null); loadFolder(it.folder_id) }}>Apri cartella</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:12}}>
              {docs.map(d => (
                <div key={d.id} className="card">
                  <div className="card-body" style={{display:'flex', flexDirection:'column', gap:6}}>
                    <div style={{fontSize:36}}>📄</div>
                    <div style={{fontWeight:600}}>{d.name}</div>
                    <div className="text-muted" style={{fontSize:12}}>{new Date(d.updated_at).toLocaleString()}</div>
                    <div className="text-muted" style={{fontSize:12}}>v{d.latest_version ?? 1}</div>
                    <div style={{display:'flex', gap:8, marginTop:8}}>
                      <button className="btn btn-outline" onClick={()=> openVersions(d.id)}>Versioni</button>
                      <button className="btn btn-outline" onClick={()=> renameDoc(d.id)}>Rinomina</button>
                      <button className="btn btn-outline" onClick={()=> deleteDoc(d.id)}>Elimina</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        </div>
      </div>

      {showUpload && (
        <div className="modal is-open" onClick={() => setShowUpload(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><strong>Carica File</strong></div>
            <div className="modal-body">
              <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
            <div className="modal-footer" style={{display:'flex', justifyContent:'flex-end', gap:8}}>
              <button className="btn btn-outline" onClick={() => setShowUpload(false)}>Annulla</button>
              <button className="btn" onClick={upload} disabled={!file}>Carica</button>
            </div>
          </div>
        </div>
      )}

      {showVersions && (
        <div className="modal is-open" onClick={() => setShowVersions(null)}>
          <div className="modal-content" style={{minWidth:560}} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><strong>Versioni Documento #{showVersions.docId}</strong></div>
            <div className="modal-body" style={{display:'flex', flexDirection:'column', gap:8}}>
              {showVersions.list.map((v:any) => (
                <div key={v.id} className="card">
                  <div className="card-body" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div>
                      <div><strong>v{v.version}</strong> — {v.file_name}</div>
                      <div className="text-muted" style={{fontSize:12}}>Autore #{v.author_id ?? '-'} • {new Date(v.created_at).toLocaleString()}</div>
                    </div>
                    <div style={{display:'flex', gap:8}}>
                      <a className="btn btn-outline" href={`/api/v1/documents/versions/${v.id}`} target="_blank" rel="noreferrer">Visualizza</a>
                      <a className="btn" href={`/api/v1/documents/versions/${v.id}`} download>Scarica</a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer" style={{display:'flex', justifyContent:'flex-end'}}>
              <button className="btn btn-outline" onClick={() => setShowVersions(null)}>Chiudi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
