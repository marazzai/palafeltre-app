import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'success' | 'warning' | 'error'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  children, 
  ...props 
}: ButtonProps) {
  const baseClass = 'btn'
  const variantClass = `btn-${variant}`
  const sizeClass = size !== 'md' ? `btn-${size}` : ''
  
  const classes = [baseClass, variantClass, sizeClass, className]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  )
}

interface CardProps {
  children: React.ReactNode
  className?: string
  header?: React.ReactNode
}

export function Card({ children, className = '', header }: CardProps) {
  return (
    <div className={`card ${className}`}>
      {header && <div className="card-header">{header}</div>}
      <div className="card-body">
        {children}
      </div>
    </div>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="form-group">
      {label && <label className="label">{label}</label>}
      <input className={`input ${className}`} {...props} />
      {error && <span className="text-error text-sm">{error}</span>}
    </div>
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  children: React.ReactNode
}

export function Select({ label, error, className = '', children, ...props }: SelectProps) {
  return (
    <div className="form-group">
      {label && <label className="label">{label}</label>}
      <select className={`select ${className}`} {...props}>
        {children}
      </select>
      {error && <span className="text-error text-sm">{error}</span>}
    </div>
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export function Textarea({ label, error, className = '', ...props }: TextareaProps) {
  return (
    <div className="form-group">
      {label && <label className="label">{label}</label>}
      <textarea className={`textarea ${className}`} {...props} />
      {error && <span className="text-error text-sm">{error}</span>}
    </div>
  )
}

interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
}

export function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps) {
  return (
    <div className="flex items-center gap-3">
      {label && <span className="text-sm font-medium">{label}</span>}
      <div
        className={`toggle-switch ${checked ? 'active' : ''}`}
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onChange(!checked)
          }
        }}
      />
    </div>
  )
}

interface AlertProps {
  type: 'info' | 'success' | 'warning' | 'error'
  children: React.ReactNode
  className?: string
}

export function Alert({ type, children, className = '' }: AlertProps) {
  return (
    <div className={`alert alert-${type} ${className}`}>
      {children}
    </div>
  )
}

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  maxWidth?: string
}

export function Modal({ isOpen, onClose, children, title, maxWidth }: ModalProps) {
  if (!isOpen) return null

  return (
    <div className={`modal ${isOpen ? 'is-open' : ''}`} onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ maxWidth: maxWidth || '500px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="modal-header">
            {title}
          </div>
        )}
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  )
}