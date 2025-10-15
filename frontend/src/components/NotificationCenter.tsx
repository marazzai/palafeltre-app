import React, { useState } from 'react'
import type { Notification } from '../utils/useNotifications'

type Props = {
  notifications: Notification[]
  unreadCount: number
  onMarkAsRead: () => void
  onClearAll: () => void
  onRemove: (id: string) => void
}

export function NotificationCenter({ notifications, unreadCount, onMarkAsRead, onClearAll, onRemove }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  function getIconForType(type: Notification['type']) {
    switch (type) {
      case 'success': return '✓'
      case 'warning': return '⚠'
      case 'danger': return '✕'
      default: return 'ℹ'
    }
  }

  function getColorForType(type: Notification['type']) {
    switch (type) {
      case 'success': return 'var(--color-success)'
      case 'warning': return 'var(--color-warning)'
      case 'danger': return 'var(--color-danger)'
      default: return 'var(--color-primary)'
    }
  }

  function formatTimestamp(ts: string) {
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Adesso'
    if (diffMins < 60) return `${diffMins} min fa`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h fa`
    return d.toLocaleDateString()
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-outline"
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen && unreadCount > 0) {
            onMarkAsRead()
          }
        }}
        style={{ position: 'relative', padding: '8px 12px' }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: 'var(--color-danger)',
              color: 'white',
              borderRadius: '50%',
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 'bold'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 998
            }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: 400,
              maxHeight: 600,
              background: 'var(--surface-1)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 999,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div
              style={{
                padding: 12,
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <strong>Notifiche</strong>
              {notifications.length > 0 && (
                <button
                  className="btn btn-outline"
                  style={{ padding: '4px 8px', fontSize: 12 }}
                  onClick={onClearAll}
                >
                  Cancella tutto
                </button>
              )}
            </div>

            <div style={{ flex: 1, overflow: 'auto', maxHeight: 500 }}>
              {notifications.length === 0 ? (
                <div
                  style={{
                    padding: 32,
                    textAlign: 'center',
                    color: 'var(--text-muted)'
                  }}
                >
                  Nessuna notifica
                </div>
              ) : (
                notifications.map(notif => (
                  <div
                    key={notif.id}
                    style={{
                      padding: 12,
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                      background: 'var(--surface-2)',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--surface-3)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--surface-2)'
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: getColorForType(notif.type),
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        flexShrink: 0
                      }}
                    >
                      {getIconForType(notif.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, marginBottom: 4 }}>
                        {notif.message}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {formatTimestamp(notif.timestamp)}
                      </div>
                    </div>
                    <button
                      className="btn btn-outline"
                      style={{
                        padding: '4px 8px',
                        fontSize: 12,
                        flexShrink: 0
                      }}
                      onClick={() => onRemove(notif.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
