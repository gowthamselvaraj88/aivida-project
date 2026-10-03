# Patient Portal (Next.js + shared Go API + PostgreSQL)

```bash
docker compose -f patient-portal/docker-compose.yml up -d  # shared PostgreSQL + schema + seed data
```
From the workspace root, run the API and web app in separate terminals:

```bash
cd telehealth/backend && go run .
```

```bash
cd patient-portal/web && npm install && npm run dev
```

The portal API is part of `telehealth/backend`; both frontends use the same service and database. Next.js proxies `/api/*` to port `8080` (set `API_URL` to override). If the Postgres data volume was initialized before this migration, apply `telehealth/backend/schema.sql` to the existing `telehealth` database once; initialization scripts only run for a new data directory.

## Notes
- Portal demo patient is hard-coded (ID `1`); add auth before real use.
- Booking claims a slot atomically (`UPDATE ... WHERE NOT booked`); a double-booking returns 409.
- Portal records use `portal_*` tables to keep their integer-ID schema separate from telehealth's UUID-based tables.
- Before production: auth, TLS, audit logging, encrypted records, and healthcare-data compliance for your region.
