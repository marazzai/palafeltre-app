import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Button } from '../components/ui'

interface User {
  id: number
  username: string
  email: string
  full_name?: string
  roles: Array<{
    name: string
    permissions: Array<{
      code: string
      description?: string
    }>
  }>
}

interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if user is already authenticated on app start
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setIsLoading(false)
        return
      }

      const response = await fetch('/api/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      } else {
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (username: string, password: string) => {
    const formData = new FormData()
    formData.append('username', username)
    formData.append('password', password)

    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Login failed')
    }

    const data = await response.json()
    
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('refreshToken', data.refresh_token)
    setUser(data.user)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    setUser(null)
  }

  const hasPermission = (permission: string): boolean => {
    if (!user) return false
    
    return user.roles.some(role => 
      role.permissions.some(p => p.code === permission)
    )
  }

  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!user) return false
    
    return permissions.some(permission => hasPermission(permission))
  }

  const value = {
    user,
    login,
    logout,
    isLoading,
    hasPermission,
    hasAnyPermission
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Protected Route component
export function ProtectedRoute({ 
  children, 
  requiredPermissions = [],
  requireAll = false 
}: { 
  children: ReactNode
  requiredPermissions?: string[]
  requireAll?: boolean
}) {
  const { user, isLoading, hasPermission, hasAnyPermission } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-secondary">Caricamento...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiredPermissions.length > 0) {
    const hasRequiredPermissions = requireAll 
      ? requiredPermissions.every(perm => hasPermission(perm))
      : hasAnyPermission(requiredPermissions)

    if (!hasRequiredPermissions) {
      return (
        <div className="min-h-screen bg-primary flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-primary mb-4">Accesso Negato</h1>
            <p className="text-secondary mb-6">Non hai i permessi necessari per accedere a questa pagina.</p>
            <Button onClick={() => window.history.back()}>
              Torna Indietro
            </Button>
          </div>
        </div>
      )
    }
  }

  return <>{children}</>
}