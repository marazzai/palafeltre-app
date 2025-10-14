# App Palafeltre

Un'app gestionale containerizzata per il Palaghiaccio di Feltre.

## Servizi
- Backend: FastAPI su Python 3.11 (porta 8000)
- Frontend: React + Vite servito da Nginx (porta 8080)
- DB: PostgreSQL 16
- Storage: volume montato su `./storage`

## Requisiti
- Docker e Docker Compose

## Avvio rapido
1. Copia `.env` (già presente) e personalizza se necessario.
2. Avvia i servizi:

```powershell
# Nella root del progetto
docker compose pull ; docker compose build ; docker compose up -d
```

3. Apri:
- API: http://localhost:8000/health
- Frontend: http://localhost:8080

## Struttura
- `backend/`: codice FastAPI, SQLAlchemy, modelli RBAC di base
- `frontend/`: app React minimal che chiama `/api/v1/ping`
- `storage/`: file caricati e documenti (montato nel container backend)

## Note
- Le dipendenze Frontend vengono installate nel build stage Docker, non in locale.
- Nginx fa proxy di `/api/` verso il backend.
- Il DB è persistente nel volume `db_data`.

## Prossimi passi
- Implementare migrazioni DB (Alembic)
- Autenticazione JWT e gestione utenti/ruoli
- Struttura API per turni, ticket, checklist, archivio, sessioni pattinaggio
- Generazione PDF (es. WeasyPrint/ReportLab) lato backend
- CI/CD e test automatici
