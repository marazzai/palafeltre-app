
// Session-only auth: tokens live only for the browser session (sessionStorage)
export const getToken = () => sessionStorage.getItem('token') || '';
export const setToken = (t: string) => {
  sessionStorage.setItem('token', t);
};
export const clearToken = () => { sessionStorage.removeItem('token'); };

export async function fetchMe(token: string){
  const r = await fetch('/api/v1/me', { headers: { Authorization: `Bearer ${token}` } });
  if(!r.ok) throw new Error('unauthorized');
  return r.json();
}
