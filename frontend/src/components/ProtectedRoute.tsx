import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getToken, fetchMe } from '../auth'
import { useToast } from './Toast'
import { useEffect, useState } from 'react'

export default function ProtectedRoute(){
  const toast = useToast()
  const location = useLocation()
  const t = getToken()
  const [checking, setChecking] = useState(true)
  const [mustChange, setMustChange] = useState(false)

  useEffect(()=>{
    if(!t){ setChecking(false); return }
    // fetch /me to determine if the user must change password
    fetchMe(t).then((me:any)=>{
      if(me && me.must_change_password){ setMustChange(true) }
    }).catch(()=>{
      // token invalid or network error - force re-login
      toast.push('Sessione scaduta, effettua il login')
    }).finally(()=> setChecking(false))
  }, [])

  if(!t){
    toast.push('Effettua il login per continuare')
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  if(checking) return <div style={{padding:20}}>Verifica sessione…</div>
  if(mustChange && location.pathname !== '/change-password'){
    return <Navigate to="/change-password" replace />
  }
  return <Outlet />
}
