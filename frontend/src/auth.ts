
// Session-only auth: tokens live only for the browser session (sessionStorage)
export const getToken = () => {
  // Prefer sessionStorage (session-only), but fall back to localStorage for compatibility with older pages.
  return sessionStorage.getItem('token') || localStorage.getItem('token') || '';
};
export const setToken = (t: string) => {
  // Save in both storages to remain compatible with components that still read localStorage.
  try{ sessionStorage.setItem('token', t) }catch(e){}
  try{ localStorage.setItem('token', t) }catch(e){}
};
export const clearToken = () => {
  try{ sessionStorage.removeItem('token') }catch(e){}
  try{ localStorage.removeItem('token') }catch(e){}
};

export async function fetchMe(token: string){
  const r = await fetch('/api/v1/me', { headers: { Authorization: `Bearer ${token}` } });
  if(!r.ok) throw new Error('unauthorized');
  return r.json();
}
