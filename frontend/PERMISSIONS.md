# Sistema Permessi e Navigazione Dinamica

## Panoramica
Il sistema di navigazione di AppLayout filtra automaticamente le voci del menu in base ai ruoli e permessi dell'utente corrente.

## Come Funziona

### 1. Fetch Utente Corrente
Al caricamento, `AppLayout` chiama `/api/v1/me` per ottenere:
```typescript
{
  id: number
  username: string
  email: string
  roles: string[]        // es: ['admin', 'operator']
  permissions?: string[] // opzionale, per permessi granulari
}
```

### 2. Definizione Voci Menu
Ogni voce è definita in `menuItems`:
```typescript
{
  path: '/admin',
  label: 'Admin',
  icon: 'settings',
  requireAdmin: true  // visibile solo agli admin
}
```

**Opzioni di controllo accesso:**
- `requireAdmin: true` → solo utenti con ruolo `admin`
- `requirePermission: 'nome.permesso'` → solo utenti con permesso specifico
- Nessuna opzione → accessibile a tutti gli autenticati

### 3. Filtro Automatico
La funzione `canAccess(item)` verifica:
1. Se utente non autenticato → nasconde tutto
2. Se `requireAdmin` → verifica `user.roles.includes('admin')`
3. Se `requirePermission` → verifica permesso specifico (o admin)
4. Altrimenti → mostra

## Aggiungere Nuova Voce Menu

```typescript
const menuItems: MenuItem[] = [
  // ... voci esistenti
  { 
    path: '/reports', 
    label: 'Report', 
    icon: 'files',
    requirePermission: 'reports.view'  // opzionale
  },
]
```

## Ruoli Supportati Backend
- `admin` → accesso completo
- `operator` → operatore standard
- `viewer` → solo visualizzazione
- Altri ruoli custom configurabili in `AdminPanel → Permessi`

## Permessi Granulari (Opzionale)
Se il backend fornisce `permissions[]` nel response di `/me`, puoi usare:
```typescript
requirePermission: 'tasks.create'
requirePermission: 'tickets.assign'
requirePermission: 'documents.delete'
```

## Estensioni Future
- [ ] Nascondi pulsanti/sezioni in base a permessi specifici
- [ ] Sistema di feature flags per rollout graduale
- [ ] Permessi cached in localStorage per UX più rapida
- [ ] Audit log accessi negati

## Testing
1. Login come `admin` → vedrai tutte le voci (incluso Admin)
2. Login come utente normale → voci base (no Admin)
3. Logout → menu svuotato (solo Dashboard visibile dopo auth)
