package main

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("writeJSON error: %v", err)
	}
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func decode(r *http.Request, v any) error {
	r.Body = http.MaxBytesReader(nil, r.Body, 1<<20)
	return json.NewDecoder(r.Body).Decode(v)
}

func dbErr(w http.ResponseWriter, err error) {
	log.Printf("database error: %v", err)
	var pg *pgconn.PgError
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		writeErr(w, http.StatusNotFound, "not found")
	case errors.As(err, &pg) && (pg.Code == "23505" || pg.Code == "23P01"):
		writeErr(w, http.StatusConflict, "time slot conflict or already booked")
	case errors.As(err, &pg) && pg.Code == "23503":
		writeErr(w, http.StatusBadRequest, "referenced record does not exist")
	default:
		writeErr(w, http.StatusInternalServerError, "database error")
	}
}

// -------------------------------------------------------------
// MODELS
// -------------------------------------------------------------

type Doctor struct {
	ID              int    `json:"id"`
	Name            string `json:"name"`
	Specialization  string `json:"specialization"`
	Qualification   string `json:"qualification"`
	ExperienceYears int    `json:"experience_years"`
	City            string `json:"city"`
	Fee             int    `json:"fee"`
	ImageURL        string `json:"image_url"`
	Availability    string `json:"availability"`
	IsOnline        bool   `json:"is_online"`
}

type Slot struct {
	ID       int       `json:"id"`
	DoctorID int       `json:"doctor_id"`
	StartsAt time.Time `json:"starts_at"`
	EndsAt   time.Time `json:"ends_at"`
	Booked   bool      `json:"booked"`
	Reason   string    `json:"reason"`
}

type Patient struct {
	ID         int       `json:"id"`
	Name       string    `json:"name"`
	Email      string    `json:"email"`
	Phone      string    `json:"phone"`
	Dob        time.Time `json:"dob"`
	Age        int       `json:"age"`
	Gender     string    `json:"gender"`
	BloodGroup string    `json:"blood_group"`
	Allergies  []string  `json:"allergies"`
	Conditions []string  `json:"conditions"`
}

type Appointment struct {
	ID        int       `json:"id"`
	DoctorID  int       `json:"doctor_id"`
	PatientID int       `json:"patient_id"`
	SlotID    *int      `json:"slot_id"`
	RoomID    string    `json:"room_id"`
	StartsAt  time.Time `json:"starts_at"`
	EndsAt    time.Time `json:"ends_at"`
	Reason    string    `json:"reason"`
	Status    string    `json:"status"`
	Notes     string    `json:"notes"`
	Doctor    Doctor    `json:"doctor"`
	Patient   Patient   `json:"patient"`
}

type Prescription struct {
	ID            int       `json:"id"`
	AppointmentID *int      `json:"appointment_id"`
	DoctorID      int       `json:"doctor_id"`
	PatientID     int       `json:"patient_id"`
	Medicine      string    `json:"medicine"`
	Dosage        string    `json:"dosage"`
	Frequency     string    `json:"frequency"`
	Duration      string    `json:"duration"`
	Instructions  string    `json:"instructions"`
	CreatedAt     time.Time `json:"created_at"`
	DoctorName    string    `json:"doctor_name,omitempty"`
}

type MedicalRecord struct {
	ID         int       `json:"id"`
	PatientID  int       `json:"patient_id"`
	DoctorID   int       `json:"doctor_id"`
	DoctorName string    `json:"doctor_name"`
	Title      string    `json:"title"`
	Diagnosis  string    `json:"diagnosis"`
	Notes      string    `json:"notes"`
	RecordDate time.Time `json:"record_date"`
}

type DoctorDashboard struct {
	Doctor               Doctor        `json:"doctor"`
	TodayAppointments    []Appointment `json:"today_appointments"`
	UpcomingAppointments []Appointment `json:"upcoming_appointments"`
	PendingRequests      []Appointment `json:"pending_requests"`
	AllPatients          []Patient     `json:"all_patients"`
	TotalPatients        int           `json:"total_patients"`
	TodayCount           int           `json:"today_count"`
	UpcomingCount        int           `json:"upcoming_count"`
	PendingCount         int           `json:"pending_count"`
}

type PatientDetailsResponse struct {
	Patient       Patient         `json:"patient"`
	Consultation  *Appointment    `json:"consultation,omitempty"`
	History       []Appointment   `json:"history"`
	Prescriptions []Prescription  `json:"prescriptions"`
	Records       []MedicalRecord `json:"records"`
}

// -------------------------------------------------------------
// SQL HELPERS
// -------------------------------------------------------------

const apptSelectSQL = `
	SELECT a.id, a.doctor_id, a.patient_id, a.slot_id, a.room_id::text,
	       a.starts_at, a.ends_at, a.reason, a.status, a.notes,
	       d.id, d.name, d.specialization, d.qualification, d.experience_years, d.city, d.fee, d.image_url, d.availability, d.is_online,
	       p.id, p.name, p.email, p.phone, p.dob, EXTRACT(YEAR FROM age(p.dob))::int, p.gender, p.blood_group, p.allergies, p.conditions
	FROM appointments a
	JOIN doctors d ON d.id = a.doctor_id
	JOIN patients p ON p.id = a.patient_id
`

func scanAppt(row pgx.Row) (Appointment, error) {
	var a Appointment
	err := row.Scan(
		&a.ID, &a.DoctorID, &a.PatientID, &a.SlotID, &a.RoomID,
		&a.StartsAt, &a.EndsAt, &a.Reason, &a.Status, &a.Notes,
		&a.Doctor.ID, &a.Doctor.Name, &a.Doctor.Specialization, &a.Doctor.Qualification,
		&a.Doctor.ExperienceYears, &a.Doctor.City, &a.Doctor.Fee, &a.Doctor.ImageURL, &a.Doctor.Availability, &a.Doctor.IsOnline,
		&a.Patient.ID, &a.Patient.Name, &a.Patient.Email, &a.Patient.Phone, &a.Patient.Dob,
		&a.Patient.Age, &a.Patient.Gender, &a.Patient.BloodGroup, &a.Patient.Allergies, &a.Patient.Conditions,
	)
	return a, err
}

// -------------------------------------------------------------
// DOCTOR HANDLERS
// -------------------------------------------------------------

func (a *App) listDoctors(w http.ResponseWriter, r *http.Request) {
	rows, err := a.db.Query(r.Context(), `
		SELECT id, name, specialization, qualification, experience_years, city, fee, image_url, availability, is_online
		FROM doctors ORDER BY id`)
	if err != nil {
		dbErr(w, err)
		return
	}
	defer rows.Close()

	list := []Doctor{}
	for rows.Next() {
		var d Doctor
		if err := rows.Scan(&d.ID, &d.Name, &d.Specialization, &d.Qualification, &d.ExperienceYears, &d.City, &d.Fee, &d.ImageURL, &d.Availability, &d.IsOnline); err != nil {
			dbErr(w, err)
			return
		}
		list = append(list, d)
	}
	writeJSON(w, http.StatusOK, list)
}

func (a *App) getDoctor(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid doctor id")
		return
	}

	var d Doctor
	err = a.db.QueryRow(r.Context(), `
		SELECT id, name, specialization, qualification, experience_years, city, fee, image_url, availability, is_online
		FROM doctors WHERE id = $1`, id).
		Scan(&d.ID, &d.Name, &d.Specialization, &d.Qualification, &d.ExperienceYears, &d.City, &d.Fee, &d.ImageURL, &d.Availability, &d.IsOnline)
	if err != nil {
		dbErr(w, err)
		return
	}

	slotRows, err := a.db.Query(r.Context(), `
		SELECT id, doctor_id, starts_at, ends_at, booked, reason
		FROM slots
		WHERE doctor_id = $1 AND NOT booked AND starts_at > now()
		ORDER BY starts_at LIMIT 150`, id)
	if err != nil {
		dbErr(w, err)
		return
	}
	defer slotRows.Close()

	slots := []Slot{}
	for slotRows.Next() {
		var s Slot
		if err := slotRows.Scan(&s.ID, &s.DoctorID, &s.StartsAt, &s.EndsAt, &s.Booked, &s.Reason); err != nil {
			dbErr(w, err)
			return
		}
		slots = append(slots, s)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"doctor": d,
		"slots":  slots,
	})
}

func (a *App) updateDoctorStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid doctor id")
		return
	}

	var in struct {
		IsOnline bool `json:"is_online"`
	}
	if err := decode(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}

	tag, err := a.db.Exec(r.Context(), `UPDATE doctors SET is_online = $1 WHERE id = $2`, in.IsOnline, id)
	if err != nil {
		dbErr(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, http.StatusNotFound, "doctor not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": id, "is_online": in.IsOnline})
}

func (a *App) getDoctorDashboard(w http.ResponseWriter, r *http.Request) {
	docID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid doctor id")
		return
	}

	ctx := r.Context()
	var d Doctor
	err = a.db.QueryRow(ctx, `
		SELECT id, name, specialization, qualification, experience_years, city, fee, image_url, availability, is_online
		FROM doctors WHERE id = $1`, docID).
		Scan(&d.ID, &d.Name, &d.Specialization, &d.Qualification, &d.ExperienceYears, &d.City, &d.Fee, &d.ImageURL, &d.Availability, &d.IsOnline)
	if err != nil {
		dbErr(w, err)
		return
	}

	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	tomorrowStart := todayStart.Add(24 * time.Hour)

	// Fetch all appointments for doctor
	rows, err := a.db.Query(ctx, apptSelectSQL+` WHERE a.doctor_id = $1 ORDER BY a.starts_at ASC`, docID)
	if err != nil {
		dbErr(w, err)
		return
	}
	defer rows.Close()

	dashboard := DoctorDashboard{
		Doctor:               d,
		TodayAppointments:    []Appointment{},
		UpcomingAppointments: []Appointment{},
		PendingRequests:      []Appointment{},
	}

	patientMap := make(map[int]Patient)

	for rows.Next() {
		appt, err := scanAppt(rows)
		if err != nil {
			dbErr(w, err)
			return
		}
		patientMap[appt.PatientID] = appt.Patient

		switch appt.Status {
		case "pending":
			dashboard.PendingRequests = append(dashboard.PendingRequests, appt)
		case "scheduled", "in_progress":
			if !appt.StartsAt.Before(todayStart) && appt.StartsAt.Before(tomorrowStart) {
				dashboard.TodayAppointments = append(dashboard.TodayAppointments, appt)
			} else if !appt.StartsAt.Before(tomorrowStart) {
				dashboard.UpcomingAppointments = append(dashboard.UpcomingAppointments, appt)
			}
		}
	}

	dashboard.AllPatients = make([]Patient, 0, len(patientMap))
	for _, p := range patientMap {
		dashboard.AllPatients = append(dashboard.AllPatients, p)
	}
	dashboard.TotalPatients = len(dashboard.AllPatients)
	dashboard.TodayCount = len(dashboard.TodayAppointments)
	dashboard.UpcomingCount = len(dashboard.UpcomingAppointments)
	dashboard.PendingCount = len(dashboard.PendingRequests)

	writeJSON(w, http.StatusOK, dashboard)
}

func (a *App) createDoctorSlot(w http.ResponseWriter, r *http.Request) {
	docID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid doctor id")
		return
	}

	var in struct {
		StartsAt    time.Time `json:"starts_at"`
		DurationMin int       `json:"duration_min"`
		Reason      string    `json:"reason"`
	}
	if err := decode(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid input")
		return
	}
	if in.DurationMin < 10 || in.DurationMin > 120 {
		in.DurationMin = 30
	}
	if strings.TrimSpace(in.Reason) == "" {
		in.Reason = "General consultation"
	}
	endsAt := in.StartsAt.Add(time.Duration(in.DurationMin) * time.Minute)

	var s Slot
	err = a.db.QueryRow(r.Context(), `
		INSERT INTO slots (doctor_id, starts_at, ends_at, reason)
		VALUES ($1, $2, $3, $4)
		RETURNING id, doctor_id, starts_at, ends_at, booked, reason`,
		docID, in.StartsAt, endsAt, in.Reason).
		Scan(&s.ID, &s.DoctorID, &s.StartsAt, &s.EndsAt, &s.Booked, &s.Reason)
	if err != nil {
		dbErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, s)
}

// -------------------------------------------------------------
// PATIENT HANDLERS
// -------------------------------------------------------------

func (a *App) listPatients(w http.ResponseWriter, r *http.Request) {
	rows, err := a.db.Query(r.Context(), `
		SELECT id, name, email, phone, dob, EXTRACT(YEAR FROM age(dob))::int, gender, blood_group, allergies, conditions
		FROM patients ORDER BY id`)
	if err != nil {
		dbErr(w, err)
		return
	}
	defer rows.Close()

	list := []Patient{}
	for rows.Next() {
		var p Patient
		if err := rows.Scan(&p.ID, &p.Name, &p.Email, &p.Phone, &p.Dob, &p.Age, &p.Gender, &p.BloodGroup, &p.Allergies, &p.Conditions); err != nil {
			dbErr(w, err)
			return
		}
		list = append(list, p)
	}
	writeJSON(w, http.StatusOK, list)
}

func (a *App) getCurrentPatient(w http.ResponseWriter, r *http.Request) {
	patientID := 1
	if p := r.URL.Query().Get("id"); p != "" {
		if val, err := strconv.Atoi(p); err == nil && val > 0 {
			patientID = val
		}
	} else if p := r.URL.Query().Get("patient_id"); p != "" {
		if val, err := strconv.Atoi(p); err == nil && val > 0 {
			patientID = val
		}
	}

	var p Patient
	err := a.db.QueryRow(r.Context(), `
		SELECT id, name, email, phone, dob, EXTRACT(YEAR FROM age(dob))::int, gender, blood_group, allergies, conditions
		FROM patients WHERE id = $1`, patientID).
		Scan(&p.ID, &p.Name, &p.Email, &p.Phone, &p.Dob, &p.Age, &p.Gender, &p.BloodGroup, &p.Allergies, &p.Conditions)
	if err != nil {
		dbErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (a *App) getPatientByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid patient id")
		return
	}
	var p Patient
	err = a.db.QueryRow(r.Context(), `
		SELECT id, name, email, phone, dob, EXTRACT(YEAR FROM age(dob))::int, gender, blood_group, allergies, conditions
		FROM patients WHERE id = $1`, id).
		Scan(&p.ID, &p.Name, &p.Email, &p.Phone, &p.Dob, &p.Age, &p.Gender, &p.BloodGroup, &p.Allergies, &p.Conditions)
	if err != nil {
		dbErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (a *App) getPatientDetails(w http.ResponseWriter, r *http.Request) {
	// The {id} param can be either an appointment ID or a patient ID
	param := r.PathValue("id")
	targetID, err := strconv.Atoi(param)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}

	ctx := r.Context()
	var currentAppt *Appointment
	var patientID int

	// First try resolving targetID as an Appointment ID
	row := a.db.QueryRow(ctx, apptSelectSQL+` WHERE a.id = $1`, targetID)
	appt, err := scanAppt(row)
	if err == nil {
		currentAppt = &appt
		patientID = appt.PatientID
	} else {
		// Fallback: targetID is patient_id
		patientID = targetID
	}

	// Fetch patient
	var p Patient
	err = a.db.QueryRow(ctx, `
		SELECT id, name, email, phone, dob, EXTRACT(YEAR FROM age(dob))::int, gender, blood_group, allergies, conditions
		FROM patients WHERE id = $1`, patientID).
		Scan(&p.ID, &p.Name, &p.Email, &p.Phone, &p.Dob, &p.Age, &p.Gender, &p.BloodGroup, &p.Allergies, &p.Conditions)
	if err != nil {
		dbErr(w, err)
		return
	}

	// Fetch past completed visits
	historyRows, err := a.db.Query(ctx, apptSelectSQL+`
		WHERE a.patient_id = $1 AND a.status = 'completed'
		ORDER BY a.starts_at DESC LIMIT 50`, patientID)
	history := []Appointment{}
	if err == nil {
		defer historyRows.Close()
		for historyRows.Next() {
			if h, err := scanAppt(historyRows); err == nil {
				history = append(history, h)
			}
		}
	}

	// Fetch prescriptions
	rxRows, err := a.db.Query(ctx, `
		SELECT p.id, p.appointment_id, p.doctor_id, p.patient_id, p.medicine, p.dosage,
		       p.frequency, p.duration, p.instructions, p.created_at, d.name
		FROM prescriptions p
		JOIN doctors d ON d.id = p.doctor_id
		WHERE p.patient_id = $1 ORDER BY p.created_at DESC LIMIT 50`, patientID)
	prescriptions := []Prescription{}
	if err == nil {
		defer rxRows.Close()
		for rxRows.Next() {
			var rx Prescription
			if err := rxRows.Scan(&rx.ID, &rx.AppointmentID, &rx.DoctorID, &rx.PatientID,
				&rx.Medicine, &rx.Dosage, &rx.Frequency, &rx.Duration, &rx.Instructions, &rx.CreatedAt, &rx.DoctorName); err == nil {
				prescriptions = append(prescriptions, rx)
			}
		}
	}

	// Fetch medical records
	recRows, err := a.db.Query(ctx, `
		SELECT m.id, m.patient_id, m.doctor_id, d.name, m.title, m.diagnosis, m.notes, m.record_date
		FROM medical_records m
		JOIN doctors d ON d.id = m.doctor_id
		WHERE m.patient_id = $1 ORDER BY m.record_date DESC LIMIT 50`, patientID)
	records := []MedicalRecord{}
	if err == nil {
		defer recRows.Close()
		for recRows.Next() {
			var rec MedicalRecord
			if err := recRows.Scan(&rec.ID, &rec.PatientID, &rec.DoctorID, &rec.DoctorName, &rec.Title, &rec.Diagnosis, &rec.Notes, &rec.RecordDate); err == nil {
				records = append(records, rec)
			}
		}
	}

	writeJSON(w, http.StatusOK, PatientDetailsResponse{
		Patient:       p,
		Consultation:  currentAppt,
		History:       history,
		Prescriptions: prescriptions,
		Records:       records,
	})
}

func (a *App) getPatientHistory(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}

	// Use getPatientDetails for complete response
	a.getPatientDetails(w, r)
	_ = id
}

func (a *App) getPatientRecords(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid patient id")
		return
	}

	rows, err := a.db.Query(r.Context(), `
		SELECT m.id, m.patient_id, m.doctor_id, d.name, m.title, m.diagnosis, m.notes, m.record_date
		FROM medical_records m
		JOIN doctors d ON d.id = m.doctor_id
		WHERE m.patient_id = $1 ORDER BY m.record_date DESC`, id)
	if err != nil {
		dbErr(w, err)
		return
	}
	defer rows.Close()

	records := []MedicalRecord{}
	for rows.Next() {
		var m MedicalRecord
		if err := rows.Scan(&m.ID, &m.PatientID, &m.DoctorID, &m.DoctorName, &m.Title, &m.Diagnosis, &m.Notes, &m.RecordDate); err != nil {
			dbErr(w, err)
			return
		}
		records = append(records, m)
	}
	writeJSON(w, http.StatusOK, records)
}

func (a *App) getPatientPrescriptions(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid patient id")
		return
	}

	rows, err := a.db.Query(r.Context(), `
		SELECT p.id, p.appointment_id, p.doctor_id, p.patient_id, p.medicine, p.dosage,
		       p.frequency, p.duration, p.instructions, p.created_at, d.name
		FROM prescriptions p
		JOIN doctors d ON d.id = p.doctor_id
		WHERE p.patient_id = $1 ORDER BY p.created_at DESC`, id)
	if err != nil {
		dbErr(w, err)
		return
	}
	defer rows.Close()

	list := []Prescription{}
	for rows.Next() {
		var p Prescription
		if err := rows.Scan(&p.ID, &p.AppointmentID, &p.DoctorID, &p.PatientID, &p.Medicine, &p.Dosage,
			&p.Frequency, &p.Duration, &p.Instructions, &p.CreatedAt, &p.DoctorName); err != nil {
			dbErr(w, err)
			return
		}
		list = append(list, p)
	}
	writeJSON(w, http.StatusOK, list)
}

// -------------------------------------------------------------
// APPOINTMENTS HANDLERS
// -------------------------------------------------------------

func (a *App) listAppointments(w http.ResponseWriter, r *http.Request) {
	docParam := r.URL.Query().Get("doctor_id")
	patParam := r.URL.Query().Get("patient_id")

	query := apptSelectSQL
	var args []any

	if docParam != "" {
		if docID, err := strconv.Atoi(docParam); err == nil {
			query += " WHERE a.doctor_id = $1"
			args = append(args, docID)
		}
	} else if patParam != "" {
		if patID, err := strconv.Atoi(patParam); err == nil {
			query += " WHERE a.patient_id = $1"
			args = append(args, patID)
		}
	}

	query += " ORDER BY a.starts_at DESC LIMIT 200"

	rows, err := a.db.Query(r.Context(), query, args...)
	if err != nil {
		dbErr(w, err)
		return
	}
	defer rows.Close()

	list := []Appointment{}
	for rows.Next() {
		appt, err := scanAppt(rows)
		if err != nil {
			dbErr(w, err)
			return
		}
		list = append(list, appt)
	}
	writeJSON(w, http.StatusOK, list)
}

func (a *App) getAppointment(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid appointment id")
		return
	}

	appt, err := scanAppt(a.db.QueryRow(r.Context(), apptSelectSQL+` WHERE a.id = $1`, id))
	if err != nil {
		dbErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, appt)
}

func (a *App) getNextAppointment(w http.ResponseWriter, r *http.Request) {
	patID := 1
	if p := r.URL.Query().Get("patient_id"); p != "" {
		if val, err := strconv.Atoi(p); err == nil {
			patID = val
		}
	}

	row := a.db.QueryRow(r.Context(), apptSelectSQL+`
		WHERE a.patient_id = $1 AND a.status IN ('pending','scheduled','in_progress')
		  AND a.starts_at > now() - interval '2 hour'
		ORDER BY a.starts_at ASC LIMIT 1`, patID)

	appt, err := scanAppt(row)
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, http.StatusOK, nil)
		return
	}
	if err != nil {
		dbErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, appt)
}

func (a *App) bookAppointment(w http.ResponseWriter, r *http.Request) {
	var in struct {
		SlotID    int    `json:"slot_id"`
		DoctorID  int    `json:"doctor_id"`
		PatientID int    `json:"patient_id"`
		Reason    string `json:"reason"`
	}
	if err := decode(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if in.SlotID < 1 {
		writeErr(w, http.StatusBadRequest, "slot_id is required")
		return
	}
	if in.PatientID < 1 {
		in.PatientID = 1 // Default demo patient
	}
	if strings.TrimSpace(in.Reason) == "" {
		in.Reason = "General consultation"
	}

	ctx := r.Context()
	tx, err := a.db.Begin(ctx)
	if err != nil {
		dbErr(w, err)
		return
	}
	defer tx.Rollback(ctx)

	// Claim slot atomically
	var docID int
	var startsAt, endsAt time.Time
	var slotReason string
	err = tx.QueryRow(ctx, `
		UPDATE slots SET booked = true
		WHERE id = $1 AND NOT booked
		RETURNING doctor_id, starts_at, ends_at, reason`, in.SlotID).
		Scan(&docID, &startsAt, &endsAt, &slotReason)
	if errors.Is(err, pgx.ErrNoRows) {
		writeErr(w, http.StatusConflict, "Slot is no longer available. Please select another time.")
		return
	}
	if err != nil {
		dbErr(w, err)
		return
	}

	reason := in.Reason
	if reason == "General consultation" && slotReason != "" {
		reason = slotReason
	}

	// Insert appointment
	var apptID int
	var roomID string
	err = tx.QueryRow(ctx, `
		INSERT INTO appointments (doctor_id, patient_id, slot_id, starts_at, ends_at, reason, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'pending')
		RETURNING id, room_id::text`,
		docID, in.PatientID, in.SlotID, startsAt, endsAt, reason).
		Scan(&apptID, &roomID)
	if err != nil {
		dbErr(w, err)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		dbErr(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"id":             apptID,
		"appointment_id": apptID,
		"room_id":        roomID,
		"status":         "pending",
	})
}

func (a *App) acceptAppointment(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid appointment id")
		return
	}

	tag, err := a.db.Exec(r.Context(), `
		UPDATE appointments SET status = 'scheduled', updated_at = now()
		WHERE id = $1 AND status = 'pending'`, id)
	if err != nil {
		dbErr(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, http.StatusConflict, "Request is no longer pending")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"accepted": true})
}

func (a *App) declineAppointment(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid appointment id")
		return
	}

	ctx := r.Context()
	tx, err := a.db.Begin(ctx)
	if err != nil {
		dbErr(w, err)
		return
	}
	defer tx.Rollback(ctx)

	var slotID *int
	err = tx.QueryRow(ctx, `
		UPDATE appointments SET status = 'cancelled', updated_at = now()
		WHERE id = $1 AND status = 'pending'
		RETURNING slot_id`, id).Scan(&slotID)
	if errors.Is(err, pgx.ErrNoRows) {
		writeErr(w, http.StatusConflict, "Request is no longer pending")
		return
	}
	if err != nil {
		dbErr(w, err)
		return
	}

	if slotID != nil {
		_, _ = tx.Exec(ctx, `UPDATE slots SET booked = false WHERE id = $1`, *slotID)
	}

	if err := tx.Commit(ctx); err != nil {
		dbErr(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"declined": true})
}

func (a *App) updateAppointmentStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid appointment id")
		return
	}

	var in struct {
		Status string `json:"status"`
	}
	if err := decode(r, &in); err != nil || (in.Status != "in_progress" && in.Status != "completed" && in.Status != "scheduled") {
		writeErr(w, http.StatusBadRequest, "invalid status")
		return
	}

	tag, err := a.db.Exec(r.Context(), `
		UPDATE appointments SET status = $1, updated_at = now()
		WHERE id = $2`, in.Status, id)
	if err != nil {
		dbErr(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, http.StatusNotFound, "appointment not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": in.Status})
}

func (a *App) saveNotes(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid appointment id")
		return
	}

	var in struct {
		Notes string `json:"notes"`
	}
	if err := decode(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}

	tag, err := a.db.Exec(r.Context(), `
		UPDATE appointments SET notes = $1, updated_at = now()
		WHERE id = $2`, in.Notes, id)
	if err != nil {
		dbErr(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, http.StatusNotFound, "appointment not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"saved": true})
}

func (a *App) listAppointmentPrescriptions(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid appointment id")
		return
	}

	rows, err := a.db.Query(r.Context(), `
		SELECT p.id, p.appointment_id, p.doctor_id, p.patient_id, p.medicine, p.dosage,
		       p.frequency, p.duration, p.instructions, p.created_at, d.name
		FROM prescriptions p
		JOIN doctors d ON d.id = p.doctor_id
		WHERE p.appointment_id = $1 ORDER BY p.created_at ASC`, id)
	if err != nil {
		dbErr(w, err)
		return
	}
	defer rows.Close()

	list := []Prescription{}
	for rows.Next() {
		var p Prescription
		if err := rows.Scan(&p.ID, &p.AppointmentID, &p.DoctorID, &p.PatientID, &p.Medicine, &p.Dosage,
			&p.Frequency, &p.Duration, &p.Instructions, &p.CreatedAt, &p.DoctorName); err != nil {
			dbErr(w, err)
			return
		}
		list = append(list, p)
	}
	writeJSON(w, http.StatusOK, list)
}

func (a *App) addAppointmentPrescription(w http.ResponseWriter, r *http.Request) {
	apptID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid appointment id")
		return
	}

	var in struct {
		Medicine     string `json:"medicine"`
		Dosage       string `json:"dosage"`
		Frequency    string `json:"frequency"`
		Duration     string `json:"duration"`
		Instructions string `json:"instructions"`
	}
	if err := decode(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	in.Medicine = strings.TrimSpace(in.Medicine)
	in.Dosage = strings.TrimSpace(in.Dosage)
	if in.Medicine == "" || in.Dosage == "" {
		writeErr(w, http.StatusBadRequest, "medicine and dosage are required")
		return
	}

	var docID, patID int
	err = a.db.QueryRow(r.Context(), `SELECT doctor_id, patient_id FROM appointments WHERE id = $1`, apptID).Scan(&docID, &patID)
	if err != nil {
		dbErr(w, err)
		return
	}

	var p Prescription
	p.AppointmentID = &apptID
	p.DoctorID = docID
	p.PatientID = patID
	p.Medicine = in.Medicine
	p.Dosage = in.Dosage
	p.Frequency = in.Frequency
	p.Duration = in.Duration
	p.Instructions = in.Instructions

	err = a.db.QueryRow(r.Context(), `
		INSERT INTO prescriptions (appointment_id, doctor_id, patient_id, medicine, dosage, frequency, duration, instructions)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at`,
		apptID, docID, patID, in.Medicine, in.Dosage, in.Frequency, in.Duration, in.Instructions).
		Scan(&p.ID, &p.CreatedAt)
	if err != nil {
		dbErr(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, p)
}

func (a *App) endAppointment(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid appointment id")
		return
	}

	tag, err := a.db.Exec(r.Context(), `
		UPDATE appointments SET status = 'completed', ended_at = now(), updated_at = now()
		WHERE id = $1`, id)
	if err != nil {
		dbErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ended": tag.RowsAffected() > 0})
}

func (a *App) createPrescription(w http.ResponseWriter, r *http.Request) {
	var in struct {
		AppointmentID *int   `json:"appointment_id"`
		DoctorID      int    `json:"doctor_id"`
		PatientID     int    `json:"patient_id"`
		Medicine      string `json:"medicine"`
		Dosage        string `json:"dosage"`
		Frequency     string `json:"frequency"`
		Duration      string `json:"duration"`
		Instructions  string `json:"instructions"`
	}
	if err := decode(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	in.Medicine = strings.TrimSpace(in.Medicine)
	in.Dosage = strings.TrimSpace(in.Dosage)
	if in.Medicine == "" || in.Dosage == "" {
		writeErr(w, http.StatusBadRequest, "medicine and dosage are required")
		return
	}
	if in.DoctorID < 1 {
		in.DoctorID = 1
	}
	if in.PatientID < 1 {
		in.PatientID = 1
	}

	var p Prescription
	p.AppointmentID = in.AppointmentID
	p.DoctorID = in.DoctorID
	p.PatientID = in.PatientID
	p.Medicine = in.Medicine
	p.Dosage = in.Dosage
	p.Frequency = in.Frequency
	p.Duration = in.Duration
	p.Instructions = in.Instructions

	err := a.db.QueryRow(r.Context(), `
		INSERT INTO prescriptions (appointment_id, doctor_id, patient_id, medicine, dosage, frequency, duration, instructions)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at`,
		in.AppointmentID, in.DoctorID, in.PatientID, in.Medicine, in.Dosage, in.Frequency, in.Duration, in.Instructions).
		Scan(&p.ID, &p.CreatedAt)
	if err != nil {
		dbErr(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, p)
}

