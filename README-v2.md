# Palafeltre Management System - Versione 2.0

Sistema completo di gestione per il Palafeltre con nuovo design moderno e architettura migliorata.

## 🆕 Novità Versione 2.0

### Design System
- **Tema moderno**: Design ispirato ad Apple con supporto per tema chiaro/scuro
- **Interfaccia intuitiva**: Componenti UI standardizzati e responsive
- **Typography migliorata**: Font Inter per migliore leggibilità
- **Animazioni fluide**: Transizioni e feedback visivi migliorati

### Architettura Rinnovata
- **Sistema di autenticazione robusto**: JWT con refresh token
- **RBAC (Role-Based Access Control)**: Controllo granulare dei permessi
- **API modulari**: Endpoint organizzati per funzionalità
- **Sicurezza migliorata**: Validazione e autorizzazione a più livelli

### Funzionalità Principali
- **Dashboard centrale**: Panoramica completa del sistema
- **Controllo partite**: Gestione punteggi, cronometro, penalità
- **Tabellone live**: Display pubblico per il punteggio
- **Controllo OBS**: Gestione scene di streaming
- **Amministrazione**: Gestione utenti e permessi

## 🚀 Quick Start

### Prerequisiti
- Docker e Docker Compose
- OBS Studio (per streaming)

### Avvio del Sistema

1. **Clona il repository**
   ```bash
   git clone <repository-url>
   cd palafeltre-app
   ```

2. **Avvia con Docker Compose**
   ```bash
   docker-compose up -d
   ```

3. **Inizializza i permessi** (prima volta)
   ```bash
   docker-compose exec backend python init_permissions.py
   ```

4. **Accedi al sistema**
   - URL: http://localhost:8080
   - Username: `admin`
   - Password: `adminadmin`

## 🔑 Sistema di Permessi

### Ruoli Predefiniti

| Ruolo | Descrizione | Permessi |
|-------|-------------|----------|
| **admin** | Amministratore completo | Accesso a tutte le funzioni |
| **game_operator** | Operatore partita | Controllo tabellone e punteggi |
| **obs_operator** | Operatore streaming | Controllo OBS e visualizzazione partite |
| **viewer** | Visualizzatore | Solo visualizzazione |
| **basic_user** | Utente base | Accesso limitato |

### Permessi Disponibili

#### Amministrazione
- `admin.full_access` - Accesso completo al sistema
- `admin.users` - Gestione utenti
- `admin.config` - Configurazione sistema

#### Controllo Partita
- `game.control` - Controllo completo partita
- `game.view` - Visualizzazione stato partita
- `game.scoreboard` - Accesso al tabellone

#### Controllo OBS
- `obs.control` - Controllo OBS Studio
- `obs.view` - Visualizzazione stato OBS

#### Gestione Utenti
- `user.view_own` - Visualizza profilo personale
- `user.edit_own` - Modifica profilo personale
- `user.view_all` - Visualizza tutti gli utenti
- `user.edit_all` - Modifica tutti gli utenti

## 🎮 Utilizzo

### Dashboard
La dashboard principale fornisce:
- Panoramica del sistema
- Accesso rapido alle funzioni principali
- Statistiche utente
- Collegamenti diretti

### Controllo Partita
Funzionalità disponibili:
- **Configurazione**: Nome squadre, colori, durata periodi
- **Punteggi**: Gestione goal e statistiche
- **Cronometro**: Controllo tempo di gioco
- **Penalità**: Gestione infrazioni e tempi
- **Timeout**: Gestione pause

### Tabellone Live
- URL pubblico: `/scoreboard`
- Visualizzazione automatica di punteggi
- Supporto per OBS Browser Source
- Parametri URL personalizzabili:
  - `?w=1920&h=1080` - Dimensioni
  - `?margin=50` - Margini
  - `?mt=20&mr=30&mb=20&ml=30` - Margini specifici

### Controllo OBS
Setup e utilizzo:

1. **Configura OBS WebSocket**:
   - Strumenti → Plugin WebSocket
   - Abilita server sulla porta 4455
   - Imposta password (opzionale)

2. **Connetti dall'applicazione**:
   - Vai alla sezione OBS Control
   - Clicca "Auto Setup" o configura manualmente
   - Seleziona scene dalla lista

3. **Aggiunta Browser Source**:
   - Aggiungi Source → Browser
   - URL: `http://localhost:8080/scoreboard`
   - Dimensioni: 1920x1080

## 🔧 Configurazione

### Variabili d'Ambiente

| Variabile | Descrizione | Default |
|-----------|-------------|---------|
| `DATABASE_URL` | URL database PostgreSQL | `postgresql://...` |
| `JWT_SECRET` | Chiave per JWT | `change-me-in-prod` |
| `ADMIN_USERNAME` | Username amministratore | `admin` |
| `ADMIN_PASSWORD` | Password amministratore | `adminadmin` |
| `OBS_HOST` | Host OBS WebSocket | `localhost` |
| `OBS_PORT` | Porta OBS WebSocket | `4455` |
| `OBS_PASSWORD` | Password OBS WebSocket | `` |

### Database
Il sistema utilizza PostgreSQL con:
- Tabelle per utenti, ruoli e permessi
- Gestione automatica delle migrazioni
- Backup automatici (se configurati)

## 🛠 Sviluppo

### Struttura Frontend
```
frontend/src/
├── components/         # Componenti riutilizzabili
│   ├── ui/            # Sistema di design
│   └── AppLayout.tsx  # Layout principale
├── hooks/             # Hook React personalizzati
├── pages/             # Pagine dell'applicazione
├── styles/            # Fogli di stile
└── ui/               # Componenti specifici (tabellone)
```

### Struttura Backend
```
backend/app/
├── api/v1/           # Endpoint API
├── core/             # Configurazione e utilità
├── models/           # Modelli database
├── services/         # Servizi (OBS, etc.)
└── db/              # Gestione database
```

### Build e Deploy

1. **Build Frontend**:
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. **Build Backend**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. **Deploy con Docker**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

## 🚨 Sicurezza

### Impostazioni di Produzione
- Cambia `JWT_SECRET` e `ADMIN_PASSWORD`
- Usa HTTPS per connessioni esterne
- Configura CORS appropriatamente
- Abilita rate limiting
- Monitora i log di sicurezza

### Backup
- Database PostgreSQL con backup automatici
- Configurazione e impostazioni
- Log di sistema e audit

## 📝 API Reference

### Autenticazione
- `POST /api/v1/auth/login` - Login utente
- `POST /api/v1/auth/refresh` - Refresh token
- `GET /api/v1/auth/me` - Profilo utente
- `POST /api/v1/auth/change-password` - Cambio password

### OBS Control
- `GET /api/v1/obs/status` - Stato connessione
- `POST /api/v1/obs/connect` - Connetti a OBS
- `GET /api/v1/obs/scenes` - Lista scene
- `POST /api/v1/obs/scene` - Cambia scena

### Game Control
- Endpoint esistenti per controllo partita
- WebSocket per aggiornamenti real-time

## 🐛 Troubleshooting

### Problemi Comuni

1. **OBS non si connette**:
   - Verifica che OBS sia avviato
   - Controlla porta e password WebSocket
   - Verifica che il plugin sia attivo

2. **Login non funziona**:
   - Verifica credenziali admin di default
   - Controlla i log del backend
   - Esegui `init_permissions.py` se necessario

3. **Tabellone non si aggiorna**:
   - Controlla connessione WebSocket
   - Verifica CORS settings
   - Ricarica la pagina

4. **Permessi negati**:
   - Verifica ruoli utente
   - Controlla assegnazione permessi
   - Consulta sezione RBAC

## 📞 Supporto

Per problemi o domande:
1. Consulta la documentazione completa
2. Verifica i log del sistema
3. Controlla le configurazioni
4. Contatta il team di sviluppo

---

**Versione**: 2.0  
**Ultima modifica**: Ottobre 2025  
**Compatibilità**: Docker, OBS Studio 28+, Browser moderni