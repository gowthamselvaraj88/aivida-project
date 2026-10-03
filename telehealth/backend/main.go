package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type App struct {
	db  *pgxpool.Pool
	hub *Hub
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func main() {
	ctx := context.Background()
	dsn := getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/telehealth?sslmode=disable")
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("cannot reach postgres: %v", err)
	}

	app := &App{db: pool, hub: newHub()}
	mux := http.NewServeMux()

	// Doctors
	mux.HandleFunc("GET /api/doctors", app.listDoctors)
	mux.HandleFunc("GET /api/doctors/{id}", app.getDoctor)
	mux.HandleFunc("PATCH /api/doctors/{id}/status", app.updateDoctorStatus)
	mux.HandleFunc("GET /api/doctors/{id}/dashboard", app.getDoctorDashboard)
	mux.HandleFunc("POST /api/doctors/{id}/slots", app.createDoctorSlot)

	// Patients
	mux.HandleFunc("GET /api/patients", app.listPatients)
	mux.HandleFunc("GET /api/patient", app.getCurrentPatient)
	mux.HandleFunc("GET /api/patients/{id}", app.getPatientByID)
	mux.HandleFunc("GET /api/patients/{id}/details", app.getPatientDetails)
	mux.HandleFunc("GET /api/patients/{id}/history", app.getPatientHistory)
	mux.HandleFunc("GET /api/patients/{id}/records", app.getPatientRecords)
	mux.HandleFunc("GET /api/patients/{id}/prescriptions", app.getPatientPrescriptions)

	// Appointments & Consultations
	mux.HandleFunc("GET /api/appointments", app.listAppointments)
	mux.HandleFunc("POST /api/appointments", app.bookAppointment)
	mux.HandleFunc("GET /api/appointments/next", app.getNextAppointment)
	mux.HandleFunc("GET /api/appointments/{id}", app.getAppointment)
	mux.HandleFunc("POST /api/appointments/{id}/accept", app.acceptAppointment)
	mux.HandleFunc("POST /api/appointments/{id}/decline", app.declineAppointment)
	mux.HandleFunc("PATCH /api/appointments/{id}/status", app.updateAppointmentStatus)
	mux.HandleFunc("PUT /api/appointments/{id}/notes", app.saveNotes)
	mux.HandleFunc("PATCH /api/appointments/{id}/notes", app.saveNotes)
	mux.HandleFunc("GET /api/appointments/{id}/prescriptions", app.listAppointmentPrescriptions)
	mux.HandleFunc("POST /api/appointments/{id}/prescriptions", app.addAppointmentPrescription)
	mux.HandleFunc("POST /api/prescriptions", app.createPrescription)
	mux.HandleFunc("POST /api/appointments/{id}/end", app.endAppointment)

	// Backward-compatibility aliases
	mux.HandleFunc("GET /api/portal/appointments", app.listAppointments)
	mux.HandleFunc("GET /api/portal/appointments/{id}", app.getAppointment)
	mux.HandleFunc("POST /api/portal/appointments/{id}/accept", app.acceptAppointment)
	mux.HandleFunc("POST /api/portal/appointments/{id}/decline", app.declineAppointment)
	mux.HandleFunc("PATCH /api/portal/appointments/{id}/status", app.updateAppointmentStatus)

	// WebRTC signaling
	mux.HandleFunc("GET /ws/{room}", app.serveWS)

	addr := ":" + getenv("PORT", "8080")
	log.Printf("Aivida API listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, cors(mux)))
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if isAllowedFrontendOrigin(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func isAllowedFrontendOrigin(origin string) bool {
	if origin == "" {
		return false
	}
	configured := getenv("FRONTEND_ORIGINS", getenv("FRONTEND_ORIGIN", "http://localhost:3000,http://localhost:3001"))
	for _, allowed := range strings.Split(configured, ",") {
		if strings.TrimSpace(allowed) == origin {
			return true
		}
	}
	return false
}
