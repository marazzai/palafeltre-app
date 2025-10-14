import { useEffect, useState } from 'react'

export default function App() {
  const [msg, setMsg] = useState('Loading...')
  useEffect(() => {
    fetch(`/api/v1/ping`)
      .then(r => r.json())
      .then(d => setMsg(`Backend says: ${d.message}`))
      .catch(() => setMsg('Failed to reach backend'))
  }, [])

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>App Palafeltre</h1>
      <p>{msg}</p>
    </div>
  )
}
