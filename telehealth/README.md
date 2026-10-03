# Telehealth video consultation

## Requirements
- Go 1.22 or later
- Docker Desktop
- Node.js and npm

## Start PostgreSQL
From the workspace root:
```powershell
docker run --name telehealth-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=telehealth -p 5432:5432 -d postgres:16-alpine
Get-Content .\backend\schema.sql | docker exec -i telehealth-postgres psql -U postgres -d telehealth
```

If the database container already exists, start it with `docker start telehealth-postgres` and apply the schema again with the second command.

## Start the API
In another terminal:
```powershell
cd backend
go run .
```

The API listens on `http://localhost:8080`. Set `DATABASE_URL` to override the default PostgreSQL connection, or `PORT` to change the listen port.

## Start the frontend
In another terminal:
```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:3001 for the doctor workspace. The separate patient portal runs at http://localhost:3000. Patient bookings enter the doctor's pending inbox; after acceptance, both participants join the same WebRTC room from the doctor workspace. The backend allows both local origins by default. For other frontend origins, set `FRONTEND_ORIGINS` on the backend to a comma-separated allowlist and `NEXT_PUBLIC_API_URL` in the frontend before starting either app. `FRONTEND_ORIGIN` remains supported for a single origin.

Camera access works on localhost or HTTPS. STUN is configured by default; networks that block direct peer connections need a TURN server. Set `NEXT_PUBLIC_TURN_URLS`, `NEXT_PUBLIC_TURN_USERNAME`, and `NEXT_PUBLIC_TURN_CREDENTIAL` in the frontend environment to use one. These values are delivered to the browser, so production should use short-lived TURN credentials.

## API routes
- `GET/POST /api/slots`, `GET /api/slots/{id}`, `POST /api/slots/{id}/book`
- `GET /api/appointments`, `GET /api/appointments/{id}`
- `GET /api/patients/{id}/history`
- `PUT /api/appointments/{id}/notes`
- `GET/POST /api/appointments/{id}/prescriptions`
- `POST /api/appointments/{id}/end`
- `GET /ws/{room}` for WebRTC signaling
