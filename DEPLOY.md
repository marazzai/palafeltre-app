# 🚀 Deploy Guide - Palafeltre App

## Problema Deploy risolto

Il problema `env file /data/compose/10/.env not found` è dovuto al fatto che Portainer/Docker Compose non trova il file di configurazione delle variabili d'ambiente.

## 📋 Soluzione per Portainer

### Opzione 1: Variabili d'Ambiente in Portainer

Invece di usare un file `.env`, configura le variabili direttamente nell'interfaccia di Portainer:

1. **Vai allo Stack in Portainer**
2. **Clicca su "Environment variables"**
3. **Aggiungi queste variabili essenziali**:

```bash
# Database
POSTGRES_DB=palafeltre
POSTGRES_USER=palafeltre
POSTGRES_PASSWORD=tua_password_sicura_db

# Security
JWT_SECRET=tuo_jwt_secret_molto_sicuro_64_caratteri_minimo
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@tuodominio.com
ADMIN_PASSWORD=tua_password_admin_sicura

# CORS (sostituisci con il tuo dominio)
CORS_ORIGINS=https://tuodominio.com,http://localhost:8080
VITE_API_BASE_URL=/api

# OBS (opzionale)
OBS_HOST=localhost
OBS_PORT=4455
OBS_PASSWORD=password_obs_opzionale
```

### Opzione 2: File .env nel Repository

Se preferisci usare un file `.env`:

1. **Crea file `.env` nella root del progetto** (stesso livello di docker-compose.yml)
2. **Copia il contenuto da `.env.prod.example`**
3. **Modifica i valori per la produzione**
4. **Carica tutto su Git** (il file .env sarà ignorato per sicurezza)

### Opzione 3: Docker Compose Modificato

Modifica il `docker-compose.yml` per non richiedere il file .env:

```yaml
# Rimuovi la riga "env_file: - .env" dai servizi
# Usa solo environment variables
```

## 🔧 Configurazione Minima Richiesta

Per far funzionare l'app, servono almeno queste variabili:

```bash
# Essenziali
POSTGRES_DB=palafeltre
POSTGRES_USER=palafeltre
POSTGRES_PASSWORD=password_sicura

# Sicurezza (CAMBIA QUESTI!)
JWT_SECRET=stringa_segreta_molto_lunga_e_sicura
ADMIN_PASSWORD=password_admin_sicura

# Network
CORS_ORIGINS=http://tuo-server:8080
```

## 🚀 Passi per Deploy Immediato

### Per Portainer:

1. **Copia il docker-compose.yml**
2. **Configura Environment Variables in Portainer** con i valori sopra
3. **Lancia lo stack**
4. **Aspetta che i container si avviino**
5. **Accedi su `http://tuo-server:8080`**
6. **Login con**: `admin` / `tua_password_admin_sicura`

### Inizializzazione Database:

Dopo il primo avvio, esegui:
```bash
docker exec palafeltre-backend python init_permissions.py
```

## 🔐 Sicurezza per Produzione

**⚠️ IMPORTANTE - Cambia questi valori per la produzione:**

1. **JWT_SECRET**: Stringa casuale di almeno 64 caratteri
2. **ADMIN_PASSWORD**: Password forte per l'admin
3. **POSTGRES_PASSWORD**: Password sicura per il database
4. **CORS_ORIGINS**: Solo i tuoi domini autorizzati

## 🛠 Troubleshooting

### Container non si avvia:
```bash
docker logs palafeltre-backend
docker logs palafeltre-frontend
```

### Database connection error:
- Verifica POSTGRES_* variables
- Controlla che il container `db` sia healthy

### 403 CORS errors:
- Aggiungi il tuo dominio a CORS_ORIGINS
- Controlla CORS_ORIGIN_REGEX

### Login non funziona:
- Esegui `init_permissions.py`
- Verifica ADMIN_USERNAME e ADMIN_PASSWORD
- Controlla JWT_SECRET

## 📞 Quick Help

Se hai ancora problemi:

1. **Controlla i log**: `docker logs container-name`
2. **Verifica le variabili**: sono tutte configurate?
3. **Test network**: il database è raggiungibile?
4. **Permissions**: hai eseguito l'init script?

L'app dovrebbe essere accessibile su `http://tuo-server:8080` dopo il deploy! 🎉