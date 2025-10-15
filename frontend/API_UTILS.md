# API Utils - Gestione Centralizzata delle Chiamate HTTP

## Panoramica
Il modulo `utils/api.ts` fornisce wrapper per `fetch` con gestione automatica di:
- **Token JWT** iniettato automaticamente
- **401 Unauthorized** con toast + redirect a login
- **Serializzazione JSON** semplificata

## Import
```typescript
import { apiFetch, apiJson, apiPost, apiPut, apiDelete } from '../utils/api'
```

## Funzioni

### `apiFetch(url, options?)`
Wrapper base di `fetch` con token automatico e gestione 401.

**Esempio:**
```typescript
const response = await apiFetch('/api/v1/tasks')
const data = await response.json()
```

### `apiJson<T>(url, options?)`
Fetch + parsing JSON automatico.

**Esempio:**
```typescript
const tasks = await apiJson<Task[]>('/api/v1/tasks')
```

### `apiPost<T>(url, body?)`
POST con JSON body.

**Esempio:**
```typescript
await apiPost('/api/v1/tasks', { title: 'Nuovo task', priority: 'high' })
```

### `apiPut<T>(url, body?)`
PUT con JSON body.

**Esempio:**
```typescript
await apiPut(`/api/v1/tasks/${id}`, { completed: true })
```

### `apiDelete<T>(url)`
DELETE.

**Esempio:**
```typescript
await apiDelete(`/api/v1/tasks/${id}`)
```

## Gestione Errori
Tutte le funzioni propagano errori. Usa `try/catch`:

```typescript
try {
  const data = await apiJson('/api/v1/tasks')
  setTasks(data)
} catch (err) {
  console.error('Errore caricamento:', err)
}
```

## Toast Automatici
- **401**: mostra "Sessione scaduta" e redirect a `/login`
- Altri errori vanno gestiti manualmente con `useToast().push()`

## Migrazione Codice Esistente

### Prima:
```typescript
const token = localStorage.getItem('token')
const res = await fetch('/api/v1/tasks', {
  headers: { Authorization: `Bearer ${token}` }
})
if (!res.ok) throw new Error('Errore')
const data = await res.json()
```

### Dopo:
```typescript
const data = await apiJson('/api/v1/tasks')
```

## Note
- Il token viene letto da `localStorage.getItem('token')`
- Puoi sovrascrivere header passandoli in `options`
- Per upload file, usa ancora `fetch` nativo con `FormData`
