import React, { useState, useEffect } from 'react'
import { Card, Button, Input, Alert, ToggleSwitch } from '../components/ui'
import { useAuth } from '../hooks/useAuth'

interface ObsStatus {
  connected: boolean
  host?: string
  port?: number
}

interface ObsScene {
  name: string
}

export function ObsControl() {
  const { hasPermission } = useAuth()
  const [status, setStatus] = useState<ObsStatus>({ connected: false })
  const [scenes, setScenes] = useState<string[]>([])
  const [currentScene, setCurrentScene] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [config, setConfig] = useState({
    host: 'localhost',
    port: 4455,
    password: ''
  })
  const [autoConnect, setAutoConnect] = useState(false)

  useEffect(() => {
    loadStatus()
    if (autoConnect) {
      const interval = setInterval(loadStatus, 5000) // Poll every 5 seconds
      return () => clearInterval(interval)
    }
  }, [autoConnect])

  const loadStatus = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/v1/obs/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setStatus(data)
        
        if (data.connected) {
          loadScenes()
        }
      }
    } catch (err) {
      console.error('Failed to load OBS status:', err)
    }
  }

  const loadScenes = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/v1/obs/scenes', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setScenes(data.scenes)
        setCurrentScene(data.current_scene || '')
      }
    } catch (err) {
      console.error('Failed to load scenes:', err)
    }
  }

  const connectObs = async () => {
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/v1/obs/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(config)
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('Connesso a OBS con successo!')
        await loadStatus()
      } else {
        setError(data.detail || 'Errore nella connessione a OBS')
      }
    } catch (err) {
      setError('Errore di rete nella connessione a OBS')
    } finally {
      setIsLoading(false)
    }
  }

  const disconnectObs = async () => {
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/v1/obs/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        setSuccess('Disconnesso da OBS')
        setScenes([])
        setCurrentScene('')
        setStatus({ connected: false })
      } else {
        const data = await response.json()
        setError(data.detail || 'Errore nella disconnessione')
      }
    } catch (err) {
      setError('Errore di rete nella disconnessione')
    } finally {
      setIsLoading(false)
    }
  }

  const initializeObs = async () => {
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/v1/obs/init', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(data.message)
        if (data.connected) {
          await loadStatus()
        } else {
          setError('OBS configurato ma non connesso. Verificare che OBS sia avviato.')
        }
      } else {
        setError(data.detail || 'Errore nell\'inizializzazione di OBS')
      }
    } catch (err) {
      setError('Errore di rete nell\'inizializzazione')
    } finally {
      setIsLoading(false)
    }
  }

  const changeScene = async (sceneName: string) => {
    if (!hasPermission('obs.control')) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/v1/obs/scene', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ scene_name: sceneName })
      })

      if (response.ok) {
        setCurrentScene(sceneName)
        setSuccess(`Scena cambiata a "${sceneName}"`)
      } else {
        const data = await response.json()
        setError(data.detail || 'Errore nel cambio scena')
      }
    } catch (err) {
      setError('Errore di rete nel cambio scena')
    }
  }

  if (!hasPermission('obs.view')) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-primary mb-4">Accesso Negato</h1>
        <p className="text-secondary">Non hai i permessi per visualizzare il controllo OBS.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-primary">Controllo OBS Studio</h1>
        <div className="flex items-center gap-4">
          <ToggleSwitch
            checked={autoConnect}
            onChange={setAutoConnect}
            label="Auto-refresh"
          />
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            status.connected 
              ? 'bg-success-color text-white' 
              : 'bg-error-color text-white'
          }`}>
            {status.connected ? 'Connesso' : 'Disconnesso'}
          </div>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Connection Control */}
        <Card header="Connessione">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Host"
                value={config.host}
                onChange={(e) => setConfig({ ...config, host: e.target.value })}
                placeholder="localhost"
                disabled={status.connected}
              />
              <Input
                label="Porta"
                type="number"
                value={config.port.toString()}
                onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 4455 })}
                placeholder="4455"
                disabled={status.connected}
              />
            </div>
            
            <Input
              label="Password"
              type="password"
              value={config.password}
              onChange={(e) => setConfig({ ...config, password: e.target.value })}
              placeholder="Password OBS WebSocket"
              disabled={status.connected}
            />

            <div className="flex gap-3">
              {!status.connected ? (
                <>
                  <Button
                    variant="primary"
                    onClick={connectObs}
                    disabled={isLoading || !hasPermission('obs.control')}
                    className="flex-1"
                  >
                    {isLoading ? 'Connessione...' : 'Connetti'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={initializeObs}
                    disabled={isLoading || !hasPermission('obs.control')}
                  >
                    Auto Setup
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={disconnectObs}
                  disabled={isLoading || !hasPermission('obs.control')}
                  className="flex-1"
                >
                  {isLoading ? 'Disconnessione...' : 'Disconnetti'}
                </Button>
              )}
            </div>

            {status.connected && (
              <div className="text-sm text-secondary space-y-1">
                <p>📡 Connesso a: <strong>{status.host}:{status.port}</strong></p>
                <p>🎬 Scene disponibili: <strong>{scenes.length}</strong></p>
              </div>
            )}
          </div>
        </Card>

        {/* Scene Control */}
        <Card header="Controllo Scene">
          {status.connected ? (
            <div className="space-y-4">
              {scenes.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-secondary mb-3">
                    Clicca su una scena per attivarla:
                  </p>
                  {scenes.map((scene) => (
                    <Button
                      key={scene}
                      variant={currentScene === scene ? "primary" : "outline"}
                      onClick={() => changeScene(scene)}
                      disabled={!hasPermission('obs.control')}
                      className="w-full justify-start"
                    >
                      🎬 {scene}
                      {currentScene === scene && (
                        <span className="ml-auto text-xs">● ATTIVA</span>
                      )}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="text-center text-secondary">
                  <p>Nessuna scena trovata in OBS</p>
                  <Button
                    variant="outline"
                    onClick={loadScenes}
                    className="mt-3"
                  >
                    Ricarica Scene
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-secondary">
              <div className="text-4xl mb-4">🔌</div>
              <p>Connetti a OBS per controllare le scene</p>
            </div>
          )}
        </Card>
      </div>

      {/* Instructions */}
      <Card header="Guida Rapida">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Setup OBS WebSocket:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-secondary">
              <li>Apri OBS Studio</li>
              <li>Vai su Strumenti → Plugin WebSocket</li>
              <li>Abilita il server WebSocket</li>
              <li>Imposta porta 4455 (o personalizza)</li>
              <li>Imposta una password (opzionale)</li>
              <li>Clicca "Auto Setup" o inserisci manualmente le credenziali</li>
            </ol>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">Utilizzo:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-secondary">
              <li>Le scene vengono caricate automaticamente quando connesso</li>
              <li>Clicca su una scena per attivarla istantaneamente</li>
              <li>L'auto-refresh monitora lo stato della connessione</li>
              <li>Usa "Auto Setup" per connetterti con le impostazioni predefinite</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}