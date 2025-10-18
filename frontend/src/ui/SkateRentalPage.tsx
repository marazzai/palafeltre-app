import React, { useEffect, useState } from 'react'

type SkateInventory = {
  id: number
  size: string
  type: string
  qr_code?: string | null
  status: 'available' | 'rented' | 'maintenance' | 'retired'
  condition: 'excellent' | 'good' | 'fair' | 'poor'
  notes?: string | null
  created_at: string
}

type SkateRental = {
  id: number
  skate_id: number
  customer_name: string
  customer_phone?: string | null
  user_id?: number | null
  deposit_amount: number
  rental_price: number
  rented_at: string
  returned_at?: string | null
  notes?: string | null
  skate?: SkateInventory
}

type Stats = {
  total_skates: number
  available: number
  rented: number
  maintenance: number
  active_rentals: number
}

export default function SkateRentalPage() {
  const [token, setToken] = useState('')
  const [tab, setTab] = useState<'inventory' | 'rentals' | 'stats'>('inventory')
  const [inventory, setInventory] = useState<SkateInventory[]>([])
  const [rentals, setRentals] = useState<SkateRental[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [showAddSkate, setShowAddSkate] = useState(false)
  const [showRental, setShowRental] = useState<SkateInventory | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [activeOnly, setActiveOnly] = useState(true)

  useEffect(() => {
    const t = localStorage.getItem('token')
    if (t) setToken(t)
  }, [])

  const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined

  async function loadInventory() {
    const params = filterStatus ? `?status=${filterStatus}` : ''
    const res = await fetch(`/api/v1/skates/inventory${params}`, { headers: authHeader })
    if (res.ok) setInventory(await res.json())
  }

  async function loadRentals() {
    const params = activeOnly ? '?active=true' : ''
    const res = await fetch(`/api/v1/skates/rentals${params}`, { headers: authHeader })
    if (res.ok) setRentals(await res.json())
  }

  async function loadStats() {
    const res = await fetch('/api/v1/skates/stats', { headers: authHeader })
    if (res.ok) setStats(await res.json())
  }

  useEffect(() => {
    if (!token) return
    if (tab === 'inventory') loadInventory()
    if (tab === 'rentals') loadRentals()
    if (tab === 'stats') loadStats()
  }, [token, tab, filterStatus, activeOnly])

  async function addSkate(size: string, type: string) {
    const res = await fetch('/api/v1/skates/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authHeader || {}) },
      body: JSON.stringify({ size, type, condition: 'good' })
    })
    if (res.ok) {
      setShowAddSkate(false)
      await loadInventory()
    }
  }

  async function createRental(skateId: number, customerName: string, customerPhone: string, deposit: number, price: number) {
    const res = await fetch('/api/v1/skates/rentals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authHeader || {}) },
      body: JSON.stringify({
        skate_id: skateId,
        customer_name: customerName,
        customer_phone: customerPhone || null,
        deposit_amount: deposit,
        rental_price: price
      })
    })
    if (res.ok) {
      setShowRental(null)
      await loadInventory()
      await loadStats()
    } else {
      alert('Errore nel creare il noleggio')
    }
  }

  async function returnRental(rentalId: number) {
    if (!confirm('Confermare la restituzione?')) return
    const res = await fetch(`/api/v1/skates/rentals/${rentalId}/return`, {
      method: 'POST',
      headers: authHeader
    })
    if (res.ok) {
      await loadRentals()
      await loadStats()
    }
  }

  async function updateSkateStatus(skateId: number, status: string) {
    const res = await fetch(`/api/v1/skates/inventory/${skateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(authHeader || {}) },
      body: JSON.stringify({ status })
    })
    if (res.ok) await loadInventory()
  }

  function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
      available: 'var(--color-success)',
      rented: 'var(--color-warning)',
      maintenance: 'var(--color-danger)',
      retired: 'var(--text-muted)'
    }
    return (
      <span
        style={{
          padding: '4px 8px',
          borderRadius: 4,
          background: colors[status] || 'gray',
          color: 'white',
          fontSize: 12,
          fontWeight: 600
        }}
      >
        {status}
      </span>
    )
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Noleggio Pattini</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="input"
            placeholder="Bearer token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            style={{ width: 140 }}
          />
          <button className="btn btn-outline" onClick={() => localStorage.setItem('token', token)}>
            Salva
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className={tab === 'inventory' ? 'btn' : 'btn btn-outline'} onClick={() => setTab('inventory')}>
          Inventario
        </button>
        <button className={tab === 'rentals' ? 'btn' : 'btn btn-outline'} onClick={() => setTab('rentals')}>
          Noleggi
        </button>
        <button className={tab === 'stats' ? 'btn' : 'btn btn-outline'} onClick={() => setTab('stats')}>
          Statistiche
        </button>
      </div>

      {tab === 'inventory' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">Tutti gli stati</option>
              <option value="available">Disponibili</option>
              <option value="rented">Noleggiati</option>
              <option value="maintenance">In manutenzione</option>
              <option value="retired">Ritirati</option>
            </select>
            <button className="btn" onClick={() => setShowAddSkate(true)}>
              Aggiungi Pattino
            </button>
          </div>

          <div className="card">
            <div className="card-body">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: 8, textAlign: 'left' }}>Taglia</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Tipo</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Stato</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Condizione</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>QR Code</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((skate) => (
                    <tr key={skate.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: 8 }}><strong>{skate.size}</strong></td>
                      <td style={{ padding: 8 }}>{skate.type}</td>
                      <td style={{ padding: 8 }}>
                        <StatusBadge status={skate.status} />
                      </td>
                      <td style={{ padding: 8 }}>{skate.condition}</td>
                      <td style={{ padding: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                        {skate.qr_code || '-'}
                      </td>
                      <td style={{ padding: 8 }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {skate.status === 'available' && (
                            <button
                              className="btn btn-outline"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              onClick={() => setShowRental(skate)}
                            >
                              Noleggia
                            </button>
                          )}
                          {skate.status !== 'retired' && (
                            <select
                              className="input"
                              value={skate.status}
                              onChange={(e) => updateSkateStatus(skate.id, e.target.value)}
                              style={{ padding: '4px', fontSize: 12 }}
                            >
                              <option value="available">Disponibile</option>
                              <option value="maintenance">Manutenzione</option>
                              <option value="retired">Ritirato</option>
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'rentals' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
              />
              <span>Solo noleggi attivi</span>
            </label>
          </div>

          <div className="card">
            <div className="card-body">
              {rentals.length === 0 ? (
                <p className="text-muted">Nessun noleggio trovato</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rentals.map((rental) => (
                    <div key={rental.id} className="card">
                      <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {rental.customer_name} - Taglia {rental.skate?.size}
                          </div>
                          <div className="text-muted" style={{ fontSize: 12 }}>
                            Tel: {rental.customer_phone || '-'} • Deposito: €{rental.deposit_amount} • Prezzo: €{rental.rental_price}
                          </div>
                          <div className="text-muted" style={{ fontSize: 12 }}>
                            Noleggiato: {new Date(rental.rented_at).toLocaleString()}
                            {rental.returned_at && ` • Restituito: ${new Date(rental.returned_at).toLocaleString()}`}
                          </div>
                        </div>
                        {!rental.returned_at && (
                          <button
                            className="btn"
                            onClick={() => returnRental(rental.id)}
                          >
                            Restituisci
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'stats' && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 'bold', color: 'var(--color-primary)' }}>
                {stats.total_skates}
              </div>
              <div className="text-muted">Totale Pattini</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 'bold', color: 'var(--color-success)' }}>
                {stats.available}
              </div>
              <div className="text-muted">Disponibili</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 'bold', color: 'var(--color-warning)' }}>
                {stats.rented}
              </div>
              <div className="text-muted">Noleggiati</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 'bold', color: 'var(--color-danger)' }}>
                {stats.maintenance}
              </div>
              <div className="text-muted">In Manutenzione</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 'bold', color: 'var(--color-info)' }}>
                {stats.active_rentals}
              </div>
              <div className="text-muted">Noleggi Attivi</div>
            </div>
          </div>
        </div>
      )}

      {showAddSkate && (
        <AddSkateModal
          onClose={() => setShowAddSkate(false)}
          onSubmit={(size, type) => addSkate(size, type)}
        />
      )}

      {showRental && (
        <RentalModal
          skate={showRental}
          onClose={() => setShowRental(null)}
          onSubmit={(customerName, customerPhone, deposit, price) =>
            createRental(showRental.id, customerName, customerPhone, deposit, price)
          }
        />
      )}
    </div>
  )
}

function AddSkateModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (size: string, type: string) => void }) {
  const [size, setSize] = useState('')
  const [type, setType] = useState('standard')

  return (
    <div className="modal is-open" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <strong>Aggiungi Pattino</strong>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            className="input"
            placeholder="Taglia (es. 38, 42, M, L)"
            value={size}
            onChange={(e) => setSize(e.target.value)}
          />
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="standard">Standard</option>
            <option value="hockey">Hockey</option>
            <option value="artistic">Artistico</option>
          </select>
        </div>
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-outline" onClick={onClose}>
            Annulla
          </button>
          <button className="btn" onClick={() => onSubmit(size, type)} disabled={!size}>
            Aggiungi
          </button>
        </div>
      </div>
    </div>
  )
}

function RentalModal({
  skate,
  onClose,
  onSubmit
}: {
  skate: SkateInventory
  onClose: () => void
  onSubmit: (name: string, phone: string, deposit: number, price: number) => void
}) {
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [deposit, setDeposit] = useState(10)
  const [price, setPrice] = useState(5)

  return (
    <div className="modal is-open" onClick={onClose}>
      <div className="modal-content" style={{ minWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <strong>Noleggio Pattino - Taglia {skate.size}</strong>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            className="input"
            placeholder="Nome cliente *"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
          <input
            className="input"
            placeholder="Telefono (opzionale)"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label className="text-muted" style={{ fontSize: 12 }}>
                Deposito (€)
              </label>
              <input
                className="input"
                type="number"
                step="0.50"
                value={deposit}
                onChange={(e) => setDeposit(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="text-muted" style={{ fontSize: 12 }}>
                Prezzo noleggio (€)
              </label>
              <input
                className="input"
                type="number"
                step="0.50"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-outline" onClick={onClose}>
            Annulla
          </button>
          <button
            className="btn"
            onClick={() => onSubmit(customerName, customerPhone, deposit, price)}
            disabled={!customerName}
          >
            Conferma Noleggio
          </button>
        </div>
      </div>
    </div>
  )
}
