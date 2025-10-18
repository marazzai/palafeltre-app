export type MenuItem = {
  path: string
  label: string
  icon: 'home' | 'wrench' | 'checklist' | 'files' | 'tasks' | 'skate' | 'settings'
  requireAdmin?: boolean
  requirePermission?: string
}

export const menuItems: MenuItem[] = [
  { path: '/', label: 'Dashboard', icon: 'home' },
  { path: '/maintenance', label: 'Manutenzioni', icon: 'wrench' },
  { path: '/tasks', label: 'Incarichi', icon: 'checklist' },
  { path: '/documents', label: 'Documenti', icon: 'files' },
  { path: '/shifts', label: 'Turni', icon: 'tasks' },
  { path: '/game', label: 'Partita', icon: 'tasks' },
  { path: '/lights', label: 'Controllo Luci', icon: 'tasks' },
  { path: '/skating', label: 'Pattinaggio', icon: 'skate' },
  { path: '/skate-rental', label: 'Noleggio Pattini', icon: 'skate' },
  { path: '/admin', label: 'Admin', icon: 'settings', requireAdmin: true },
]

export const availablePages = menuItems.map(m => ({ key: m.path, label: m.label }))
