# Palafeltre - Deploy su NAS Asustor (Portainer)

Questa guida spiega come mettere in produzione l'app (frontend + backend + Postgres) su un NAS Asustor usando Portainer.

## Requisiti
- NAS Asustor con Docker + Portainer (o App Central: Container Manager/Portainer CE)
- Un utente admin per accedere a Portainer
- Accesso Git al repo oppure immagini già pubblicate in un registry

## Scelte di deploy
Hai due opzioni:
1. Portainer builda le immagini direttamente dal repo Git (compose stack con `build:`)
2. Usi immagini precompilate da un registry (compose stack con `image:`)

La repo contiene due compose:
- `docker-compose.yml`: dev/locale
- `docker-compose.prod.yml`: produzione, con volumi persistenti e restart policies

## Variabili ambiente
Crea un file `.env.prod` (è già incluso un esempio):
```
POSTGRES_DB=palafeltre
POSTGRES_USER=palafeltre
POSTGRES_PASSWORD=change_me_strong
CORS_ORIGINS=http://nas.local:8080
VITE_API_BASE_URL=/api
```
Suggerimenti:
- Cambia la password DB.
- Se esponi l'app su un dominio/host diverso (es. `https://pala.miodominio.it`), aggiorna CORS e porta 8080 → 80/443 secondo il reverse proxy davanti.

## Passi con Portainer (stack)
1. Login a Portainer → Stacks → Add stack
2. Nome stack: `palafeltre`
3. Source: Git repository (consigliato)
   - Repository URL: `https://<tuo_repo_git>`
   - Compose path: `docker-compose.prod.yml`
   - Authentication se il repo è privato
   - Environment variables: incolla il contenuto di `.env.prod` oppure carica come file (Portainer supporta i file env)
4. Deploy the stack

Portainer clonerà la repo e builda le immagini `backend` e `frontend`, poi lancerà i servizi `db`, `backend`, `frontend`.

## Porte e rete
- Frontend: porta 8080 → Nginx serve l'app React e fa da proxy al backend su `/api` e `/ws`
- Backend: porta 8000 (non serve esporla su Internet se il frontend fa da proxy)
- DB: non esposto, resta interno al network Docker

Per accedere all'app:
- `http://<IP_NAS>:8080/`

## Persistenza dati
- Postgres: volume `db_data`
- Storage backend: volume `storage_data` montato su `/app/storage`
  - È dove finiscono documenti/archivi PDF e file vari

Puoi mappare i volumi su una cartella del NAS se preferisci, modificando `docker-compose.prod.yml`:
```
volumes:
  db_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /volume1/docker/palafeltre/db
  storage_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /volume1/docker/palafeltre/storage
```
Assicurati che le cartelle esistano e i permessi siano corretti.

## Aggiornamenti
- Con build da Git: fai push su `main` (o il branch configurato) e in Portainer → Stack → `palafeltre` → **Re-deploy**; Portainer ricostruisce e riavvia.
- Con immagini da registry: aggiorna il tag (es. `:1.0.3`) in `docker-compose.prod.yml` e **Re-deploy**.

## Log e troubleshooting
- Stacks → palafeltre → Services → (frontend/backend/db) → Logs
- Se il backend non parte, verifica variabili DB e connessione
- Se il frontend non raggiunge il backend, verifica `VITE_API_BASE_URL` (di default `/api`) e la sezione proxy in `frontend/nginx/default.conf`

## Sicurezza e SSL
- Opzione A: Esporre solo la porta 8080 del frontend e mettere un reverse proxy esterno (es. Nginx/Traefik con TLS) davanti al NAS
- Opzione B: Usare il Proxy integrato del NAS (se disponibile) per terminare TLS e inoltrare a 8080
- Ricordati di aggiornare CORS con l'origin pubblico (https)

## Backup
- DB: usa `pg_dump` pianificato (puoi aggiungere un container di backup o usare uno script cron del NAS)
- Storage: includi il volume `storage_data` nel piano di backup del NAS

## Healthcheck e auto-restart
- `db` ha un healthcheck; `backend` dipende da `db: healthy`
- `restart: unless-stopped` mantiene i servizi attivi after reboot

## WebSocket
- `frontend/nginx/default.conf` gestisce `/ws/` verso `backend:8000/ws/` con headers `Upgrade`/`Connection`

## Variante: usare immagini prebuild
Se non vuoi buildare sul NAS:
1. Costruisci in locale e push delle immagini su un registry (Docker Hub, GHCR, ecc.):
   - `backend`: tag `your-registry/your-namespace/palafeltre-backend:latest`
   - `frontend`: tag `your-registry/your-namespace/palafeltre-frontend:latest`
2. In `docker-compose.prod.yml`, commenta `build:` e imposta `image:`
3. Portainer farà pull delle immagini e lancerà i servizi.

## Check finale
- `http://<IP_NAS>:8080/` carica l'app
- `http://<IP_NAS>:8080/health` risponde (proxy al backend)
- Login admin funziona e creazione elementi (Tasks/Tickets/Docs) persistono tra riavvii
