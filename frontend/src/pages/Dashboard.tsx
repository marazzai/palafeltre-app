import React from 'react'
import { Link } from 'react-router-dom'
import { Card, Button } from '../components/ui'
import { useAuth } from '../hooks/useAuth'

interface DashboardCardProps {
  title: string
  description: string
  icon: string
  link: string
  permission?: string
  variant?: 'primary' | 'secondary' | 'accent'
}

function DashboardCard({ title, description, icon, link, permission, variant = 'primary' }: DashboardCardProps) {
  const { hasPermission } = useAuth()

  if (permission && !hasPermission(permission)) {
    return null
  }

  const cardClass = variant === 'accent' ? 'bg-accent text-white' : ''
  const buttonVariant = variant === 'accent' ? 'secondary' : 'primary'

  return (
    <Card className={`hover:scale-105 transition-transform duration-200 ${cardClass}`}>
      <div className="text-center space-y-4">
        <div className="text-4xl">{icon}</div>
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className={`text-sm ${variant === 'accent' ? 'text-gray-200' : 'text-secondary'}`}>
          {description}
        </p>
        <Link to={link}>
          <Button variant={buttonVariant} className="w-full">
            Apri
          </Button>
        </Link>
      </div>
    </Card>
  )
}

export function Dashboard() {
  const { user } = useAuth()

  const dashboardCards: DashboardCardProps[] = [
    {
      title: 'Controllo Partita',
      description: 'Gestisci punteggi, cronometro e penalità',
      icon: '🏒',
      link: '/game',
      permission: 'game.control'
    },
    {
      title: 'Tabellone Live',
      description: 'Visualizza il tabellone per il pubblico',
      icon: '📺',
      link: '/scoreboard',
      variant: 'accent'
    },
    {
      title: 'OBS Control',
      description: 'Controlla le scene di OBS Studio',
      icon: '🎥',
      link: '/obs',
      permission: 'obs.control'
    },
    {
      title: 'Amministrazione',
      description: 'Gestisci utenti, ruoli e impostazioni',
      icon: '⚙️',
      link: '/admin',
      permission: 'admin.access'
    }
  ]

  const visibleCards = dashboardCards.filter(card => 
    !card.permission || (user && hasPermission(card.permission))
  )

  const hasPermission = (permission: string) => {
    if (!user) return false
    return user.roles.some(role => 
      role.permissions.some(p => p.code === permission)
    )
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-primary">
          Benvenuto{user?.full_name ? `, ${user.full_name}` : ''}
        </h1>
        <p className="text-lg text-secondary max-w-2xl mx-auto">
          Sistema di gestione completo per il Palafeltre. 
          Controlla partite, tabelloni digitali e streaming in tempo reale.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="text-center">
          <div className="space-y-2">
            <div className="text-2xl font-bold text-accent">🟢</div>
            <h3 className="font-semibold">Sistema Attivo</h3>
            <p className="text-sm text-secondary">Tutti i servizi operativi</p>
          </div>
        </Card>
        <Card className="text-center">
          <div className="space-y-2">
            <div className="text-2xl font-bold text-accent">{user?.roles.length || 0}</div>
            <h3 className="font-semibold">Ruoli Assegnati</h3>
            <p className="text-sm text-secondary">
              {user?.roles.map(r => r.name).join(', ') || 'Nessun ruolo'}
            </p>
          </div>
        </Card>
        <Card className="text-center">
          <div className="space-y-2">
            <div className="text-2xl font-bold text-accent">
              {user?.roles.reduce((acc, role) => acc + role.permissions.length, 0) || 0}
            </div>
            <h3 className="font-semibold">Permessi Totali</h3>
            <p className="text-sm text-secondary">Funzioni disponibili</p>
          </div>
        </Card>
      </div>

      {/* Main Actions */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-primary">Azioni Principali</h2>
        
        {visibleCards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {visibleCards.map((card, index) => (
              <DashboardCard key={index} {...card} />
            ))}
          </div>
        ) : (
          <Card>
            <div className="text-center space-y-4">
              <div className="text-4xl">🔒</div>
              <h3 className="text-xl font-semibold">Accesso Limitato</h3>
              <p className="text-secondary">
                Non hai i permessi necessari per accedere alle funzioni principali. 
                Contatta l'amministratore per richiedere l'accesso.
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Recent Activity */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-primary">Attività Recente</h2>
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-color">
              <div>
                <p className="font-medium">Login effettuato</p>
                <p className="text-sm text-secondary">Ultimo accesso al sistema</p>
              </div>
              <span className="text-sm text-secondary">Ora</span>
            </div>
            <div className="text-center text-secondary">
              <p>Cronologia delle attività sarà disponibile nelle prossime versioni</p>
            </div>
          </div>
        </Card>
      </div>

      {/* System Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card header="Informazioni Sistema">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-secondary">Versione:</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Ambiente:</span>
              <span className="font-medium">Produzione</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Utente:</span>
              <span className="font-medium">{user?.username}</span>
            </div>
          </div>
        </Card>

        <Card header="Collegamenti Rapidi">
          <div className="space-y-3">
            <Link 
              to="/scoreboard" 
              className="block w-full p-2 text-center bg-tertiary rounded-lg hover:bg-accent hover:text-white transition-colors"
            >
              Tabellone Pubblico
            </Link>
            {hasPermission('game.control') && (
              <Link 
                to="/game" 
                className="block w-full p-2 text-center bg-tertiary rounded-lg hover:bg-accent hover:text-white transition-colors"
              >
                Controllo Partita
              </Link>
            )}
            {hasPermission('obs.control') && (
              <Link 
                to="/obs" 
                className="block w-full p-2 text-center bg-tertiary rounded-lg hover:bg-accent hover:text-white transition-colors"
              >
                OBS Studio
              </Link>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}