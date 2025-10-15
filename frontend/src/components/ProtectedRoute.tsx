import { Navigate, Outlet } from 'react-router-dom'
import { getToken } from '../auth'

export default function ProtectedRoute(){
  const t = getToken()
  if(!t){
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}
