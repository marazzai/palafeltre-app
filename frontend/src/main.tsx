import React from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import './styles.css'
import { ToastProvider, setGlobalToast, useToast } from './components/Toast'

function AppWithToast() {
  const toast = useToast()
  
  // Registra toast globale per uso in api.ts
  React.useEffect(() => {
    setGlobalToast(toast.push)
  }, [toast])
  
  return <RouterProvider router={router} />
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <AppWithToast />
    </ToastProvider>
  </React.StrictMode>
)
