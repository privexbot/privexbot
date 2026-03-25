/**
 * Toast Hook and Component
 */

import * as React from "react"

interface ToastMessage {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
  duration?: number
}

interface ToastContextType {
  toasts: ToastMessage[]
  toast: (message: Omit<ToastMessage, 'id'>) => void
  dismiss: (id: string) => void
}

const ToastContext = React.createContext<ToastContextType>({
  toasts: [],
  toast: () => {},
  dismiss: () => {}
})

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([])

  const toast = React.useCallback((message: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2)
    const newToast: ToastMessage = {
      id,
      duration: 5000,
      ...message
    }

    setToasts(prev => [...prev, newToast])

    // Auto dismiss after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, newToast.duration)
  }, [])

  const dismiss = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// Simple toast function for compatibility
export function toast(message: Omit<ToastMessage, 'id'>) {
  // Create a temporary div to render the toast message
  const div = document.createElement('div')
  div.style.position = 'fixed'
  div.style.top = '20px'
  div.style.right = '20px'
  div.style.background = message.variant === 'destructive' ? '#dc2626' : '#10b981'
  div.style.color = 'white'
  div.style.padding = '12px 16px'
  div.style.borderRadius = '6px'
  div.style.zIndex = '9999'
  div.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
  div.innerHTML = `
    <div style="font-weight: 600;">${message.title || ''}</div>
    ${message.description ? `<div style="font-size: 14px; margin-top: 4px;">${message.description}</div>` : ''}
  `

  document.body.appendChild(div)

  setTimeout(() => {
    if (div.parentNode) {
      div.parentNode.removeChild(div)
    }
  }, message.duration || 5000)
}

function ToastContainer() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            rounded-lg p-4 shadow-lg max-w-sm cursor-pointer transition-all
            ${toast.variant === 'destructive'
              ? 'bg-red-600 text-white'
              : 'bg-white border border-gray-200 text-gray-900'
            }
          `}
          onClick={() => dismiss(toast.id)}
        >
          {toast.title && (
            <div className="font-semibold">{toast.title}</div>
          )}
          {toast.description && (
            <div className={`text-sm mt-1 ${toast.variant === 'destructive' ? 'text-red-100' : 'text-gray-600'}`}>
              {toast.description}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}