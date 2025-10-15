import { useEffect, useState, useCallback, useRef } from 'react'

export type Notification = {
  id: string
  type: 'info' | 'success' | 'warning' | 'danger'
  message: string
  data?: any
  timestamp: string
}

export function useNotifications(userId: number | null) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!userId) return

    // Connect to user-specific notification room
    const ws = new WebSocket(`ws://${window.location.host}/api/v1/ws/notifications_user_${userId}`)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('Notifications WebSocket connected')
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'notification') {
          const notification: Notification = {
            id: `${Date.now()}_${Math.random()}`,
            type: data.notification_type || 'info',
            message: data.message,
            data: data.data,
            timestamp: data.timestamp || new Date().toISOString()
          }
          
          setNotifications(prev => [notification, ...prev].slice(0, 50)) // Keep last 50
          setUnreadCount(prev => prev + 1)
          
          // Show browser notification if permitted
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('App Palafeltre', {
              body: notification.message,
              icon: '/favicon.ico'
            })
          }
        }
      } catch (e) {
        console.error('Error parsing notification:', e)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    ws.onclose = () => {
      console.log('Notifications WebSocket closed')
    }

    return () => {
      ws.close()
    }
  }, [userId])

  // Also connect to broadcast channel for admin messages
  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/api/v1/ws/notifications_all`)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'notification') {
          const notification: Notification = {
            id: `${Date.now()}_${Math.random()}`,
            type: data.notification_type || 'info',
            message: data.message,
            data: data.data,
            timestamp: data.timestamp || new Date().toISOString()
          }
          
          setNotifications(prev => [notification, ...prev].slice(0, 50))
          setUnreadCount(prev => prev + 1)
        }
      } catch (e) {
        console.error('Error parsing broadcast notification:', e)
      }
    }

    return () => {
      ws.close()
    }
  }, [])

  const markAsRead = useCallback(() => {
    setUnreadCount(0)
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
    setUnreadCount(0)
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  return {
    notifications,
    unreadCount,
    markAsRead,
    clearAll,
    removeNotification
  }
}
