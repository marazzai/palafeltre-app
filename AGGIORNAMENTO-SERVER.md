# 🔄 Aggiornamento Server - Game Control RBAC

**Data**: 2025-10-15  
**Commit**: `61c45d6`  
**Modifiche principali**: Sistema RBAC per controllo partita + fix vari

---

## 📋 Cosa è Cambiato

### 1. **Sistema Permessi per Game Control** ✨
- Gli endpoint `/game/*` non richiedono più ruolo `admin`
- Nuovo permesso: `game.control` 
- Puoi assegnare il controllo partita a qualsiasi ruolo
- Admin continua ad avere accesso automatico

### 2. **Fix Scoreboard**
- Endpoint `/api/v1/game/state` ora pubblico (senza auth)
- WebSocket `/ws/game` pubblici per display esterni

### 3. **Fix GameControl Frontend**
- Token letto automaticamente da localStorage (login)
- Rimossa UI manuale per token

### 4. **Fix CategoryOut Schema**
- Risolto errore 422 su `/tickets/categories`
- `sort_order` ora ha default value 0

---

## 🚀 Procedura di Aggiornamento

### Opzione A: Portainer Stack (Git)

1. **Accedi a Portainer** → Stacks → `palafeltre`
2. **Pull and redeploy** (pulsante)
3. **Attendi completamento build** (2-3 minuti)
4. **Continua al passo "Setup Permessi"** sotto

### Opzione B: SSH/Console Manuale

```bash
# 1. Accedi al server
ssh user@192.168.1.58

# 2. Naviga nella cartella del progetto
cd /path/to/palafeltre-app

# 3. Pull ultimo codice
git pull origin main

# 4. Rebuild e restart backend
docker compose -f docker-compose.prod.yml up -d --build backend

# 5. Rebuild frontend (opzionale, ma raccomandato)
docker compose -f docker-compose.prod.yml up -d --build frontend

# 6. Verifica che tutto sia running
docker ps | grep palafeltre

# 7. Continua al passo "Setup Permessi"
```

---

## 🔐 Setup Permessi (OBBLIGATORIO)

Dopo l'aggiornamento, devi aggiungere il permesso `game.control` al database:

```bash
# Trova il nome esatto del container backend
docker ps | grep backend

# Esegui lo script (sostituisci <container_name> con il nome reale)
docker exec -it <container_name> python add_game_permission.py

# Esempio:
docker exec -it palafeltre-backend-1 python add_game_permission.py
```

**Output atteso**:
```
✅ Creato permesso: game.control
✅ Permesso assegnato al ruolo 'admin'
✅ Operazione completata!
```

---

## 👥 Assegnare Permessi agli Utenti

### Via Pannello Web (Raccomandato)

1. **Login come admin** su `http://192.168.1.58:8080`
2. Vai su **Dashboard** → `/admin`
3. **Gestisci Ruoli**:
   - **Opzione A**: Crea nuovo ruolo (es. "Operatore Partita")
     - Nome: `operatore_partita`
     - Aggiungi permesso: `game.control`
     - Salva
   - **Opzione B**: Modifica ruolo esistente
     - Seleziona ruolo
     - Aggiungi permesso `game.control`
     - Salva
4. **Assegna ruolo agli utenti**:
   - Vai su "Gestisci Utenti"
   - Seleziona utente
   - Aggiungi ruolo creato/modificato
   - Salva

### Via API (Avanzato)

```bash
# 1. Crea ruolo
curl -X POST http://192.168.1.58:8080/api/v1/roles \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name": "operatore_partita"}'

# 2. Assegna permesso al ruolo (ID ruolo ottenuto dalla risposta precedente)
curl -X POST http://192.168.1.58:8080/api/v1/roles/<ROLE_ID>/permissions \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"permission_code": "game.control"}'

# 3. Assegna ruolo a utente
curl -X POST http://192.168.1.58:8080/api/v1/users/<USER_ID>/roles \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"role_name": "operatore_partita"}'
```

---

## ✅ Verifica Funzionamento

### 1. **Test Base**

```bash
# Health check
curl http://192.168.1.58:8080/health

# Game state (pubblico, senza auth)
curl http://192.168.1.58:8080/api/v1/game/state
```

### 2. **Test Frontend**

1. Apri `http://192.168.1.58:8080`
2. **Login** con utente che ha `game.control`
3. Vai su **Dashboard** → `/game`
4. Verifica indicatore: `Token: ✓` (in alto)
5. **Test controlli**:
   - [ ] Setup partita (nomi, durata) → `Inizia Partita`
   - [ ] Modifica punteggio (+/-)
   - [ ] Start/Stop cronometro
   - [ ] Aggiungi penalità
   - [ ] Apri Scoreboard (pulsante) → nuova tab

### 3. **Test WebSocket**

1. Console browser (F12) → Tab "Network" → WS filter
2. Dovresti vedere connessioni:
   - `ws://192.168.1.58:8080/ws/game` - **status: 101 (OK)**
   - `ws://192.168.1.58:8080/api/v1/ws/notifications_user_X` - **status: 101 (OK)**
   - `ws://192.168.1.58:8080/api/v1/ws/notifications_all` - **status: 101 (OK)**

---

## 🐛 Troubleshooting

### Problema: "Permesso 'game.control' richiesto"

**Causa**: Utente non ha il permesso  
**Soluzione**: 
1. Verifica che lo script `add_game_permission.py` sia stato eseguito
2. Assegna il permesso al ruolo dell'utente (vedi sezione "Assegnare Permessi")

### Problema: WebSocket falliscono (ancora)

**Causa**: Nginx proxy non aggiornato o backend non running  
**Soluzione**:
```bash
# Verifica container running
docker ps | grep palafeltre

# Restart tutti i servizi
docker compose -f docker-compose.prod.yml restart

# Verifica logs
docker logs palafeltre-backend-1 --tail 50
docker logs palafeltre-frontend-1 --tail 50
```

### Problema: Errore 422 su `/tickets/categories`

**Causa**: Database ha categorie con `sort_order = NULL`  
**Soluzione**: Già fixato nel commit `61c45d6`. Se persiste:
```bash
# Accedi al DB
docker exec -it palafeltre-db-1 psql -U palafeltre -d palafeltre

# Update NULL values
UPDATE ticket_categories SET sort_order = 0 WHERE sort_order IS NULL;

# Exit
\q
```

### Problema: "Token: ✗" su `/game`

**Causa**: Token non salvato in localStorage  
**Soluzione**:
1. Logout
2. Login nuovamente
3. Ricarica `/game`

---

## 📚 Documentazione Aggiuntiva

- **Permessi dettagliati**: Vedi `GAME_PERMISSIONS.md`
- **Deploy generale**: Vedi `README-deploy.md`
- **Status progetto**: Vedi `STATUS.md`

---

## 📝 Checklist Post-Aggiornamento

- [ ] Pull codice da Git / Re-deploy Portainer
- [ ] Backend rebuilded e running
- [ ] Frontend rebuilded e running
- [ ] Script `add_game_permission.py` eseguito
- [ ] Permesso `game.control` visibile in `/admin`
- [ ] Permesso assegnato a ruoli necessari
- [ ] Test login + game control funzionante
- [ ] WebSocket connessi (check console)
- [ ] Scoreboard display funzionante

---

**Versione aggiornata**: `61c45d6`  
**Data aggiornamento**: 2025-10-15  
**Breaking changes**: ❌ Nessuno (backward compatible)  
**Azioni richieste**: ✅ Eseguire `add_game_permission.py` una volta
