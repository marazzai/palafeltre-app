import { Navigate, Outlet } from 'react-router-dom'
import { getToken } from '../auth'
import { useToast } from './Toast'

export default function ProtectedRoute(){
  const toast = useToast()
  const t = getToken()
  if(!t){
    toast.push('Effettua il login per continuare')
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}
