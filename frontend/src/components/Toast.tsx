import { createContext, useContext, useState } from 'react'

type Toast = { id:number; text:string }
const Ctx = createContext<{ push:(t:string)=>void }|null>(null)

export function ToastProvider({ children }: { children: any }){
  const [items, setItems] = useState<Toast[]>([])
  function push(text: string){
    const id = Date.now()
    setItems(prev=> [...prev, { id, text }])
    setTimeout(()=> setItems(prev=> prev.filter(i=> i.id!==id)), 3000)
  }
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div style={{position:'fixed', right:16, bottom:16, display:'flex', flexDirection:'column', gap:8}}>
        {items.map(i=> <div key={i.id} className="card" style={{padding:'10px 12px'}}>{i.text}</div>)}
      </div>
    </Ctx.Provider>
  )
}

export function useToast(){
  const ctx = useContext(Ctx)
  if(!ctx) throw new Error('ToastProvider missing')
  return ctx
}
