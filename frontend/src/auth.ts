export const getToken = () => localStorage.getItem('token') || '';
export const getTokenExpiry = () => Number(localStorage.getItem('token_expires_at') || '0');
export const setToken = (t: string, expiresInSec?: number) => {
  localStorage.setItem('token', t);
  if (typeof expiresInSec === 'number' && expiresInSec > 0) {
    const at = Date.now() + expiresInSec * 1000;
    localStorage.setItem('token_expires_at', String(at));
  }
};
export const clearToken = () => { localStorage.removeItem('token'); localStorage.removeItem('token_expires_at'); };

export async function fetchMe(token: string){
  const r = await fetch('/api/v1/me', { headers: { Authorization: `Bearer ${token}` } });
  if(!r.ok) throw new Error('unauthorized');
  return r.json();
}
