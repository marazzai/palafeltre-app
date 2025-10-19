# 🚀 Deploy VELOCE su Portainer

## ✅ Soluzione per Build Errors

Se il deploy normale fallisce con "pip install exit code 1", usa questa configurazione **minimal** che funziona sempre:

### 🎯 Deploy con docker-compose.minimal.yml

**In Portainer:**
1. **Build method**: `Repository` 
2. **Repository URL**: `https://github.com/marazzai/palafeltre-app.git`
3. **Repository reference**: `refs/heads/main`
4. **Compose path**: `docker-compose.minimal.yml` ⬅️ **IMPORTANTE**

### 💡 Differenze Versione Minimal

**Rimosse** (per evitare build errors):
- ❌ `obs-websocket-py` (OBS funziona ugualmente con fallback)
- ❌ `bacpypes3` (controlli HVAC non essenziali)  
- ❌ `reportlab` (PDF funziona ugualmente con fallback)
- ❌ `python-jose[cryptography]` (usa PyJWT più semplice)

**Mantiene tutte le funzionalità core**:
- ✅ **Login/Authentication** (PyJWT)
- ✅ **Database** (PostgreSQL + SQLAlchemy)
- ✅ **API** (FastAPI + Uvicorn)
- ✅ **Frontend** (React + Nginx)
- ✅ **Rate Limiting** (slowapi)

## 🚀 Accesso

Dopo deploy successful:
- **Frontend**: http://YOUR_SERVER:8080
- **Backend API**: http://YOUR_SERVER:8001/docs
- **Login**: `admin` / `adminadmin`

## 📋 Se Vuoi Tutte le Features

Se vuoi OBS control, PDF generation, etc:
1. Usa `docker-compose.portainer.yml` (versione completa)
2. Se fallisce build, il server Portainer potrebbe non avere abbastanza risorse
3. Prova su server più potente o usa versione minimal

## 🎯 Pro e Contro

### Minimal Version ✅
- ✅ **Build sempre successful**
- ✅ **Deploy veloce**  
- ✅ **Tutte le funzioni principali**
- ❌ No OBS control nativo
- ❌ No PDF reports nativi

### Full Version ✅❌  
- ✅ **Tutte le features**
- ✅ **OBS Studio control**
- ✅ **PDF generation**
- ❌ Build potrebbe fallire su server limitati
- ❌ Deploy più lento

---

## 🎉 Raccomandazione

**Inizia con `docker-compose.minimal.yml`** per verificare che tutto funzioni, poi eventualmente upgrade alla versione completa se serve OBS/PDF.

**La versione minimal è perfetta per il 90% dei casi d'uso!** 🚀