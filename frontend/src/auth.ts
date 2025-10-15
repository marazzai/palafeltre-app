export const getToken = () => localStorage.getItem('token') || '';
export const setToken = (t: string) => localStorage.setItem('token', t);
export const clearToken = () => localStorage.removeItem('token');

export async function fetchMe(token: string){
  const r = await fetch('/api/v1/me', { headers: { Authorization: `Bearer ${token}` } });
  if(!r.ok) throw new Error('unauthorized');
  return r.json();
}
