# Gestione Permessi - Controllo Partita

## 🎮 Sistema RBAC per Game Control

A partire da questo commit, il controllo partita (`/game`) **non richiede più il ruolo admin**.
Utilizza invece il permesso `game.control` che può essere assegnato a qualsiasi ruolo.

## 📋 Permessi Disponibili

| Codice Permesso | Descrizione | Funzionalità |
|-----------------|-------------|--------------|
| `game.control` | Controllo partita completo | Setup partita, timer, punteggi, penalità, OBS |

## 🔧 Setup Iniziale

### 1. Aggiungere il permesso al database

Se stai aggiornando da una versione precedente:

```bash
# Opzione A: Script automatico (raccomandato)
cd backend
python add_game_permission.py

# Opzione B: Manuale tramite API
curl -X POST http://localhost:8000/api/v1/permissions \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"code": "game.control", "description": "Controllo partita (scoreboard, timer, punteggi)"}'
```

### 2. Assegnare il permesso a un ruolo

#### Via Pannello Admin (UI):

1. Login come admin su `/login`
2. Vai su `/admin`
3. Sezione "Gestisci Ruoli"
4. Seleziona o crea un ruolo (es. "Operatore Partita")
5. Aggiungi permesso `game.control`
6. Salva

#### Via API:

```bash
# Assegna permesso al ruolo con ID 2
curl -X POST http://localhost:8000/api/v1/roles/2/permissions \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"permission_code": "game.control"}'
```

### 3. Assegnare il ruolo a un utente

```bash
# Assegna ruolo con ID 2 all'utente con ID 5
curl -X POST http://localhost:8000/api/v1/users/5/roles \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"role_name": "Operatore Partita"}'
```

## 🎯 Casi d'Uso

### Scenario 1: Operatore Tecnico
Crea un ruolo `operatore_tecnico` con permessi:
- `game.control` - Gestione partita
- `lights.control` - Controllo luci (se implementato)
- `obs.control` - Controllo streaming (se implementato)

### Scenario 2: Solo Scoreboard
Crea un ruolo `scoreboard_operator` con permessi:
- `game.control` - Per modificare punteggi e timer

### Scenario 3: Volontario
Ruolo minimo senza permessi speciali:
- Può visualizzare ma NON modificare

## 🔐 Gerarchia Permessi

```
admin (ruolo speciale)
  └─ Ha TUTTI i permessi automaticamente
  └─ Include game.control

operatore_tecnico (esempio)
  ├─ game.control ✅
  ├─ lights.control ✅
  └─ tasks.create ✅

scoreboard_operator (esempio)
  └─ game.control ✅

volontario (esempio)
  └─ Nessun permesso specifico
```

## 🚀 Endpoint Protetti

Tutti questi endpoint ora richiedono `game.control`:

- `POST /api/v1/game/setup` - Setup partita
- `POST /api/v1/game/score` - Modifica punteggio
- `POST /api/v1/game/shots` - Modifica tiri
- `POST /api/v1/game/timer/start` - Avvia cronometro
- `POST /api/v1/game/timer/stop` - Ferma cronometro
- `POST /api/v1/game/timer/reset` - Reset cronometro
- `POST /api/v1/game/timeout/start` - Avvia timeout
- `POST /api/v1/game/timeout/stop` - Ferma timeout
- `POST /api/v1/game/siren` - Attiva/disattiva sirena
- `POST /api/v1/game/obs` - Mostra/nascondi grafica OBS
- `POST /api/v1/game/period/next` - Periodo successivo
- `POST /api/v1/game/penalties` - Aggiungi penalità
- `DELETE /api/v1/game/penalties/{id}` - Rimuovi penalità

**Endpoint pubblici** (senza autenticazione):
- `GET /api/v1/game/state` - Stato partita (per scoreboard display)
- `WebSocket /ws/game` - Real-time updates

## 📝 Note Importanti

1. **Admin bypass**: Gli utenti con ruolo `admin` hanno automaticamente accesso a tutto
2. **WebSocket pubblici**: I WebSocket non richiedono autenticazione (per display esterni)
3. **Granularità**: Se in futuro servono permessi più granulari, puoi creare:
   - `game.score` - Solo punteggi
   - `game.timer` - Solo cronometro
   - `game.penalties` - Solo penalità
   - etc.

## 🔄 Migrazione da Versioni Precedenti

Se hai già utenti che usavano `/game`:

1. Esegui `python backend/add_game_permission.py`
2. Il permesso viene automaticamente assegnato al ruolo `admin`
3. Gli admin esistenti continuano a funzionare senza modifiche
4. Per dare accesso a non-admin, crea nuovi ruoli con `game.control`

## 🐛 Troubleshooting

**Errore: "Permesso 'game.control' richiesto"**
- L'utente non ha il permesso `game.control`
- Soluzione: Assegna il permesso tramite pannello admin

**Errore: "Non autenticato"**
- Token mancante o scaduto
- Soluzione: Rifare login

**WebSocket non connettono**
- Backend non in esecuzione
- Soluzione: `docker compose up -d` o verifica logs
