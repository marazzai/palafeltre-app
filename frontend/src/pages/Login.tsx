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
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">Palafeltre</h1>
          <p className="text-secondary">Sistema di gestione del palaghiaccio</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-primary">Accedi</h2>
              <p className="text-secondary mt-2">Inserisci le tue credenziali per continuare</p>
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
              placeholder="username@example.com"
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

          <div className="mt-6 text-center">
            <p className="text-sm text-secondary">
              Credenziali di default: <code className="bg-tertiary px-2 py-1 rounded">admin / adminadmin</code>
            </p>
          </div>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-xs text-secondary">
            Palafeltre Management System v1.0
          </p>
        </div>
      </div>
    </div>
  )
}