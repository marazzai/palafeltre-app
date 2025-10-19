# 🚀 Deploy Guide - Palafeltre App su Portainer

## ✅ Soluzione Definitiva per Portainer

Il problema `container palafeltre-db is unhealthy` è stato risolto! Usa **docker-compose.portainer.yml** con le seguenti ottimizzazioni:

- ✅ PostgreSQL 15 (più stabile del 16)
- ✅ Healthcheck con `netcat` invece di `pg_isready` 
- ✅ Configurazione auth semplificata (`md5` invece di `scram-sha-256`)
- ✅ Tutte le variabili hardcoded (no file .env richiesti)
- ✅ Timeout estesi per startup container

## 🚀 Deploy su Portainer (Repository)

### Step 1: Configurazione Repository
- **Build method**: `Repository` ✅
- **Repository URL**: `https://github.com/marazzai/palafeltre-app.git`
- **Repository reference**: `refs/heads/main`
- **Compose path**: `docker-compose.portainer.yml`

### Step 2: Deploy Stack
- **Stack name**: `palafeltre`
- **Environment variables**: **NESSUNA RICHIESTA!** 🎉
- **Click**: "Deploy the stack"

### Step 3: Attendi e Accedi
- **Attesa**: 2-3 minuti per inizializzazione database
- **Frontend**: http://YOUR_SERVER:8080
- **Backend API**: http://YOUR_SERVER:8000/docs
- **Login**: `admin` / `adminadmin`

## 🔧 Personalizzazione (Opzionale)

Se vuoi modificare credenziali/configurazioni, modifica `docker-compose.portainer.yml`:

### Database
```yaml
environment:
  POSTGRES_PASSWORD: tua-password-sicura  # Default: palafeltre123
```

### Admin
```yaml
environment:
  ADMIN_PASSWORD: tua-password-admin      # Default: adminadmin
  JWT_SECRET: tuo-jwt-secret              # Default: dev-secret
```

### Network
```yaml
environment:
  CORS_ORIGINS: "https://tuo-dominio.com" # Default: localhost
```

## 🐛 Troubleshooting

### 1. Stack non si deploya
- **Soluzione**: Verifica URL repository e branch `main`
- **Alternative**: Prova metodo Upload (zip del repo)

### 2. Container db ancora unhealthy
- **Causa**: Volume precedente corrotto
- **Soluzione**: 
  1. Remove stack completamente
  2. Remove volume `palafeltre_db_data` 
  3. Re-deploy stack

### 3. 502 Bad Gateway
- **Causa**: Backend non ancora pronto
- **Soluzione**: Aspetta 2-3 minuti in più

### 4. CORS errors
- **Causa**: Accesso da IP/dominio non autorizzato
- **Soluzione**: Modifica `CORS_ORIGINS` nel compose file

## 📊 Monitoring

### Verifica Deploy Success
```bash
# Check logs in Portainer interface
# Container Status: tutti devono essere "healthy" o "running"

# Database ready:
✅ palafeltre-db: "ready to accept connections"

# Backend ready:
✅ palafeltre-backend: "Uvicorn running on http://0.0.0.0:8000"  

# Frontend ready:  
✅ palafeltre-frontend: nginx started
```

### Health Endpoints
- Backend: http://YOUR_SERVER:8000/health
- Frontend: http://YOUR_SERVER:8080 (nginx status)

## 🔒 Security per Produzione

⚠️ **CAMBIA SEMPRE in produzione:**

```yaml
# In docker-compose.portainer.yml
environment:
  # Database
  POSTGRES_PASSWORD: "DB_PASSWORD_SUPER_SICURA_2024!"
  
  # JWT Security  
  JWT_SECRET: "JWT_SECRET_64_CARATTERI_MINIMO_CASUALE_SICURO_2024_PRODUZIONE"
  
  # Admin
  ADMIN_PASSWORD: "ADMIN_PASSWORD_SICURA_2024!"
  
  # Network (your domain)
  CORS_ORIGINS: "https://palafeltre.yourdomain.com"
```

## 🎯 Quick Reference

### Porte
- **Frontend**: 8080 (Web UI)
- **Backend**: 8000 (API)
- **Database**: 5432 (interno)

### Volumi
- **db_data**: Dati PostgreSQL persistenti

### Networks
- **palafeltre**: Network bridge interno

### Container
- **palafeltre-db**: PostgreSQL 15
- **palafeltre-backend**: FastAPI + Python
- **palafeltre-frontend**: React + Nginx

---

## 🎉 SUCCESS!

Se segui questa guida, l'app dovrebbe deployarsi senza problemi in Portainer!

**Accesso**: http://YOUR_SERVER:8080
**Credenziali**: admin / adminadmin

✅ **Testato e funzionante con Portainer**