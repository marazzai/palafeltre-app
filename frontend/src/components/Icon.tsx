import React from 'react'

type IconName = 'home' | 'users' | 'tasks' | 'wrench' | 'checklist' | 'files' | 'skate' | 'menu' | 'close' | 'alert' | 'ok' | 'settings'

const paths: Record<IconName, JSX.Element> = {
  home: (<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z"/>),
  users: (<path d="M7 14a4 4 0 1 1 2.9-6.8M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m18-7a4 4 0 1 0-6-3.5"/>),
  tasks: (<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>),
  wrench: (<path d="M14.7 6.3a4 4 0 0 0-5.66 5.66l7.07 7.07a2 2 0 0 0 2.83-2.83l-7.07-7.07a4 4 0 0 0 2.83-2.83Z"/>),
  checklist: (<path d="M9 7h11M9 13h11M9 19h11M4 7l1.5 1.5L8 6M4 13l1.5 1.5L8 12M4 19l1.5 1.5L8 18"/>),
  files: (<path d="M14 2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8m0-18 4 4m-4-4v4h4"/>),
  skate: (<path d="M3 17h18l-1 3H6l-1-3ZM7 13h6a4 4 0 0 0 4-4V5H7v8Z"/>),
  menu: (<path d="M3 6h18M3 12h18M3 18h18"/>),
  close: (<path d="M6 6l12 12M6 18L18 6"/>),
  alert: (<path d="M12 9v4m0 4h.01M10.3 3.9l-8 13.86A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.24l-8-13.86a2 2 0 0 0-3.4 0Z"/>),
  ok: (<path d="M20 6 9 17l-5-5"/>),
  settings: (<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-3.5a7.4 7.4 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7.6 7.6 0 0 0-1.7-1l-.3-2.6H9.1l-.3 2.6c-.6.2-1.2.6-1.7 1l-2.4-1-2 3.5 2 1.5a7.4 7.4 0 0 0 0 2l-2 1.5 2 3.5 2.4-1c.5.4 1.1.8 1.7 1l.3 2.6h5.4l.3-2.6c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1Z"/>)
}

export function Icon({ name, size=20, color='currentColor', strokeWidth=1.6 }: { name: IconName, size?: number, color?: string, strokeWidth?: number }){
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  )
}
