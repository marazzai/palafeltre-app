import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Button, Input, Card, Alert } from '../components/ui'
import { useAuth } from '../hooks/useAuth'

export function Login() {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  const { login, user } = useAuth()
  const navigate = useNavigate()

  // Redirect if already authenticated
  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login(formData.username, formData.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login fallito')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)', background: 'var(--bg-gradient)'}}>
      <div style={{width: '100%', maxWidth: 480}}>
        <div style={{textAlign: 'center', marginBottom: 'var(--space-6)'}}>
          <div style={{display:'inline-flex', alignItems:'center', gap:12, padding:12}}>
            <div style={{width:64, height:64, borderRadius:14, background:'linear-gradient(135deg,var(--accent-primary),var(--accent-secondary))', display:'flex', alignItems:'center', justifyContent:'center'}}>
              <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 17h18l-1 3H4l-1-3ZM8 13h8a4 4 0 0 0 4-4V5H4v4a4 4 0 0 0 4 4Z" />
              </svg>
            </div>
          </div>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="" style={{display:'grid', gap: 'var(--space-4)'}}>
            <div style={{textAlign:'center', marginBottom: 'var(--space-2)'}}>
              <h2 style={{margin:0, fontSize:'var(--text-2xl)', fontWeight:700}}>Accedi</h2>
              <p style={{margin: '6px 0 0 0', color:'var(--text-secondary)'}}>Benvenuto — accedi per continuare</p>
            </div>

            {error && (
              <Alert type="error">
                {error}
              </Alert>
            )}

            <Input
              label="Username o Email"
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="admin"
              required
              autoComplete="username"
              autoFocus
            />

            <Input
              label="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Accesso in corso...' : 'Accedi'}
            </Button>
          </form>

          <div style={{marginTop: 'var(--space-4)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div style={{fontSize:12, color:'var(--text-tertiary)'}}>Credenziali: <strong>admin / adminadmin</strong></div>
            <a href="/" style={{fontSize:12, color:'var(--accent-primary)'}}>Guida</a>
          </div>
        </Card>

        <div style={{marginTop: 'var(--space-6)', textAlign:'center', color:'var(--text-tertiary)', fontSize:12}}>
          Palafeltre Management System • v1.0
        </div>
      </div>
    </div>
  )
}