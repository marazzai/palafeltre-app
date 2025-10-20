import { showToast } from '../components/Toast'
import { getToken, clearToken } from '../auth'

// Wrapper fetch che gestisce automaticamente 401 e mostra toast
export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const token = getToken()

  const headers: Record<string, string> = {
    ...((options?.headers as Record<string, string>) || {}),
  }
  
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  })
  
  // Gestione 401 - Sessione scaduta
  if (response.status === 401) {
    clearToken()
    try{ localStorage.removeItem('user') }catch(e){}
    showToast('Sessione scaduta. Effettua nuovamente il login.', 'error')
    
    // Redirect dopo un breve delay
    setTimeout(() => {
      window.location.href = '/login'
    }, 1500)
    
    throw new Error('Unauthorized')
  }
  
  return response
}

// Helper per chiamate JSON
export async function apiJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(url, options)
  
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `HTTP ${response.status}`)
  }
  
  return response.json()
}

// Helper per POST JSON
export async function apiPost<T = any>(url: string, body?: any): Promise<T> {
  return apiJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// Helper per PUT JSON
export async function apiPut<T = any>(url: string, body?: any): Promise<T> {
  return apiJson(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// Helper per DELETE
export async function apiDelete<T = any>(url: string): Promise<T> {
  return apiJson(url, { method: 'DELETE' })
}
