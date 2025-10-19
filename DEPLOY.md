# 🚀 Deploy Guide - Palafeltre App

# 🚀 Deploy Guide - Palafeltre App

## ⚠️ Problema Database PostgreSQL risolto

Il problema `container palafeltre-db exited (1)` è comune con PostgreSQL in Portainer. Ecco le soluzioni:

## � Soluzione Rapida

### Usa docker-compose.simple.yml (Raccomandato)

Questo file ha configurazioni più compatibili per Portainer:

```yaml
# Usa PostgreSQL 15 invece di 16 (più stabile)
# Configurazione di autenticazione semplificata
# Healthcheck più permissivo
# Password di default se non specificata
```

### Variabili Minime Richieste per Portainer:

```bash
# ESSENZIALE - Senza questa il database non parte
POSTGRES_PASSWORD=password_sicura_db

# Raccomandato per produzione
ADMIN_PASSWORD=password_admin_sicura
JWT_SECRET=stringa_segreta_64_caratteri_minimo
CORS_ORIGINS=http://tuo-dominio:8080
```

## 🛠 Troubleshooting Database

### Problema 1: PostgreSQL non si avvia

**Sintomi**: `container palafeltre-db exited (1)`

**Soluzioni**:
1. **Password mancante**: Assicurati che `POSTGRES_PASSWORD` sia impostata
2. **Versione incompatibile**: Usa `docker-compose.simple.yml` (PostgreSQL 15)
3. **Volume corrotto**: Elimina il volume e ricrea:
   ```bash
   docker volume rm palafeltre-app_db_data
   ```

### Problema 2: "auth method scram-sha-256 failed"

**Soluzione**: Usa `docker-compose.simple.yml` che ha l'autenticazione configurata correttamente.

### Problema 3: Permessi volume

**Soluzione**: Il container PostgreSQL deve avere accesso al volume:
```bash
# Il volume viene creato automaticamente con i permessi corretti
```

## 📋 Deploy Steps per Portainer

### Metodo 1: Con docker-compose.simple.yml (Più Facile)

1. **In Portainer, crea nuovo Stack**
2. **Nome**: `palafeltre`
3. **Upload docker-compose.simple.yml** o copia il contenuto
4. **Environment Variables** (solo questa è obbligatoria):
   ```
   POSTGRES_PASSWORD=mia_password_db_sicura
   ```
5. **Deploy Stack**
6. **Aspetta 2-3 minuti** per l'inizializzazione
7. **Esegui init script**:
   ```bash
   docker exec palafeltre-backend python init_permissions.py
   ```
8. **Accedi**: `http://tuo-server:8080`
   - Username: `admin`
   - Password: `adminadmin`

### Metodo 2: Con docker-compose.portainer.yml (Completo)

Se preferisci più controllo, usa il file completo ma aggiungi più variabili:

```bash
# Database (OBBLIGATORIO)
POSTGRES_PASSWORD=password_db_sicura

# Security (RACCOMANDATO)
JWT_SECRET=stringa_segreta_lunga_e_sicura_64_caratteri_minimo
ADMIN_PASSWORD=password_admin_sicura

# Network (per accesso da altri host)
CORS_ORIGINS=http://192.168.1.100:8080,http://nas.local:8080
```

## 🚀 Test del Deploy

Dopo il deploy, verifica:

1. **Database**: `docker logs palafeltre-db` → dovrebbe dire "ready to accept connections"
2. **Backend**: `docker logs palafeltre-backend` → dovrebbe avviarsi senza errori
3. **Frontend**: `docker logs palafeltre-frontend` → nginx dovrebbe partire
4. **Web**: Vai su `http://tuo-server:8080` → dovrebbe aprire la pagina di login

## 🔐 Sicurezza per Produzione

**⚠️ IMPORTANTE - Cambia questi valori per la produzione:**

1. **POSTGRES_PASSWORD**: Password forte per il database
2. **JWT_SECRET**: Stringa casuale di almeno 64 caratteri
3. **ADMIN_PASSWORD**: Password forte per l'admin
4. **CORS_ORIGINS**: Solo i tuoi domini autorizzati

Esempio di configurazione sicura:
```bash
POSTGRES_PASSWORD=Db@SecureP4ssw0rd2024!
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6A7B8C9D0E1F2G3H4
ADMIN_PASSWORD=Admin@SecureP4ssw0rd2024!
CORS_ORIGINS=https://palafeltre.miodominio.com
```

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