// Session-only auth: tokens live only for the browser session (sessionStorage)
export const getToken = () => {
  // prefer session-only token, but fallback to localStorage for older code
  const s = sessionStorage.getItem('token')
  if(s) return s
  const l = localStorage.getItem('token')
  if(l){
    // migrate to sessionStorage for current session
    try{ sessionStorage.setItem('token', l) }catch{}
    return l
  }
  return ''
}
export const setToken = (t: string) => {
  try{ sessionStorage.setItem('token', t) }catch{}
  try{ localStorage.setItem('token', t) }catch{}
}
export const clearToken = () => { try{ sessionStorage.removeItem('token') }catch{}; try{ localStorage.removeItem('token') }catch{} };

export async function fetchMe(token: string){
  const r = await fetch('/api/v1/me', { headers: { Authorization: `Bearer ${token}` } });
  if(!r.ok) throw new Error('unauthorized');
  return r.json();
}
