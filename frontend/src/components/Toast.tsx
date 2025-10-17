import { createContext, useContext, useState } from 'react'

type ToastType = 'info' | 'success' | 'error' | 'warning'
type Toast = { id:number; text:string; type:ToastType }
const Ctx = createContext<{ push:(t:string, type?:ToastType)=>void }|null>(null)

export function ToastProvider({ children }: { children: any }){
  const [items, setItems] = useState<Toast[]>([])
  function push(text: string, type: ToastType = 'info'){
    const id = Date.now()
    setItems(prev=> [...prev, { id, text, type }])
    setTimeout(()=> setItems(prev=> prev.filter(i=> i.id!==id)), 4000)
  }
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div style={{position:'fixed', right:16, bottom:16, display:'flex', flexDirection:'column', gap:8, zIndex:9999}}>
        {items.map(i=> {
          const bgColor = i.type === 'error'
            ? 'var(--color-danger)'
            : i.type === 'success'
            ? 'var(--color-success)'
            : i.type === 'warning'
            ? 'var(--color-warning)'
            : 'var(--color-info)'
          return (
            <div
              key={i.id}
              className="card"
              style={{
                padding:'12px 16px',
                background:bgColor,
                color:'#fff',
                boxShadow:'0 12px 32px rgba(0, 0, 0, 0.4)',
                borderColor:'transparent'
              }}
            >
              {i.text}
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}

export function useToast(){
  const ctx = useContext(Ctx)
  if(!ctx) throw new Error('ToastProvider missing')
  return ctx
}

// Singleton per uso fuori dai componenti React
let globalPush: ((text: string, type?: ToastType) => void) | null = null

export function setGlobalToast(push: (text: string, type?: ToastType) => void) {
  globalPush = push
}

export function showToast(text: string, type: ToastType = 'info') {
  if (globalPush) {
    globalPush(text, type)
  } else {
    console.warn('[Toast] globalPush not initialized:', text)
  }
}

