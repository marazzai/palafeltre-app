import { ReactNode } from 'react'

type ButtonProps = {
  children: ReactNode
  variant?: 'primary' | 'outline' | 'success' | 'danger'
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
}

export function Button({ children, variant='primary', disabled=false, onClick, type='button' }: ButtonProps){
  const cls = ['btn']
  if(variant === 'primary') cls.push('btn-primary')
  if(variant === 'outline') cls.push('btn-outline')
  if(variant === 'success') cls.push('btn-primary') // reuse primary color; different intent
  if(variant === 'danger') cls.push('btn-outline') // outline styled; could extend later
  return (
    <button type={type} className={cls.join(' ')} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}
