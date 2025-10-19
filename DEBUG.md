# 🔍 Debug Guide - Palafeltre App

## Step-by-step troubleshooting per Portainer

### 1. Verifica che Portainer funzioni
- Vai su Portainer
- Prova a creare uno stack semplice con solo nginx per testare

### 2. Test con stack minimale
Crea un nuovo stack con questo contenuto per testare:

```yaml
version: '3.8'
services:
  test:
    image: nginx:alpine
    ports:
      - "8081:80"
```

Se questo funziona, il problema è nella nostra configurazione.

### 3. Log specifici da controllare
Dopo aver tentato il deploy, controlla:
- Logs dello stack in Portainer
- Events nel dashboard di Portainer
- Logs del singolo container che fallisce

### 4. Problemi comuni in Portainer

#### A. Errore "file not found"
- Portainer cerca file .env che non esiste
- Soluzione: Non usare `env_file` nel compose

#### B. Database non parte
- PostgreSQL ha problemi di permessi
- Soluzione: Usare MySQL o SQLite

#### C. Build fallisce
- Portainer non riesce a fare build dei Dockerfile
- Soluzione: Usare immagini pre-built

#### D. Network issues
- Container non comunicano tra loro
- Soluzione: Semplificare la configurazione di rete

## 5. Soluzioni alternative

### Opzione A: Stack senza build (immagini pre-built)
### Opzione B: Database SQLite invece di PostgreSQL
### Opzione C: Single container con tutto incluso
### Opzione D: Deploy manuale step-by-step

---

Quale di questi errori vedi? Mandami il messaggio di errore esatto!