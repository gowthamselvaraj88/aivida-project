"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Calendar,
  Clock,
  MapPin,
  Award,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { api, Doctor, Patient, Slot, fmtDate, fmtTime, getStoredPatientId } from "@/lib/api";

type DoctorResponse = {
  doctor: Doctor;
  slots: Slot[];
};

export default function DoctorProfileBookingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [patientId, setPatientId] = useState<number>(() => getStoredPatientId());
  const [patient, setPatient] = useState<Patient | null>(null);
  const [docData, setDocData] = useState<DoctorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>();
  const [selectedSlotId, setSelectedSlotId] = useState<number>();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [booking, setBooking] = useState(false);

  // Listen to patient switch events
  useEffect(() => {
    const handlePatientChange = (e: Event) => {
      const custom = e as CustomEvent<{ id?: number }>;
      const newId = custom?.detail?.id ?? getStoredPatientId();
      if (newId) setPatientId(newId);
    };
    window.addEventListener("aivida_patient_change", handlePatientChange);
    return () => window.removeEventListener("aivida_patient_change", handlePatientChange);
  }, []);

  // Fetch active patient info
  useEffect(() => {
    let cancelled = false;
    api<Patient>(`/patient?id=${patientId}`)
      .then((p) => {
        if (!cancelled && p?.id) setPatient(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  useEffect(() => {
    async function loadDoctor() {
      try {
        const res = await api<DoctorResponse>(`/doctors/${id}`);
        setDocData(res);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    loadDoctor();
  }, [id]);

  if (loading) {
    return <p className="muted">Loading doctor profile and available slots from database...</p>;
  }

  if (error || !docData) {
    return (
      <div className="alert error-alert" role="alert">
        <AlertCircle size={18} />
        <span>{error || "Doctor profile not found."}</span>
      </div>
    );
  }

  const { doctor, slots } = docData;

  // Group slots by calendar day
  const days = Array.from(
    new Set(slots.map((s) => new Date(s.starts_at).toDateString()))
  );
  const activeDay = selectedDay ?? days[0];
  const daySlots = slots.filter(
    (s) => new Date(s.starts_at).toDateString() === activeDay
  );

  async function handleBook() {
    if (!selectedSlotId) return;
    setBooking(true);
    setError("");
    try {
      const res = await api<{ id: number }>("/appointments", {
        method: "POST",
        body: JSON.stringify({
          slot_id: selectedSlotId,
          doctor_id: doctor.id,
          patient_id: patientId,
          reason: reason.trim() || "General consultation",
        }),
      });
      // Redirect to Screen 3: Appointment / Video Consultation
      router.push(`/appointments/${res.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBooking(false);
    }
  }

  return (
    <div className="doctor-profile-page">
      <button className="btn ghost back-btn" onClick={() => router.push("/doctors")}>
        <ArrowLeft size={16} />
        <span>Back to Doctors</span>
      </button>

      {/* Screen 2: Doctor Profile Hero */}
      <section className="doctor-detail-hero">
        <div className="doctor-detail-photo">
          <img
            src={doctor.image_url || "/doctors/hamsathvani.jpg"}
            alt={`Portrait of ${doctor.name}`}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/doctors/hamsathvani.jpg";
            }}
          />
          <span className={`doctor-status-badge ${doctor.is_online ? "online" : "offline"}`}>
            <span className="dot" />
            <span>{doctor.is_online ? "Online" : "Offline"}</span>
          </span>
        </div>

        <div className="doctor-detail-copy">
          <p className="eyebrow">SCREEN 2 · DOCTOR PROFILE & BOOKING</p>
          <h1>
            {doctor.name}{" "}
            <BadgeCheck size={22} className="verified-check" aria-label="Aivida Certified" />
          </h1>
          <p className="doctor-specialty">{doctor.specialization}</p>

          <div className="doctor-detail-stats">
            <span>
              <Award size={15} className="icon-inline" /> {doctor.experience_years} years experience
            </span>
            <span>{doctor.qualification}</span>
            <span>
              <MapPin size={15} className="icon-inline" /> {doctor.city}
            </span>
          </div>

          <p className="doctor-detail-price">
            ₹{doctor.fee} <span className="muted small">per video consultation</span>
          </p>
        </div>
      </section>

      {/* Consultation Availability Schedule */}
      <section className="detail-card availability-card">
        <div className="card-title">
          <Clock size={18} />
          <strong>Consultation Availability Schedule</strong>
        </div>
        <p className="muted">{doctor.availability}</p>
      </section>

      {/* Slot Booking Interface */}
      <section className="detail-card booking-card">
        <h2>Choose Consultation Date</h2>
        {days.length === 0 ? (
          <p className="empty-state">No open consultation slots available for this doctor right now.</p>
        ) : (
          <>
            <div className="days-row">
              {days.map((d) => {
                const count = slots.filter((s) => new Date(s.starts_at).toDateString() === d).length;
                return (
                  <button
                    key={d}
                    type="button"
                    className={`day-btn ${activeDay === d ? "active" : ""}`}
                    onClick={() => {
                      setSelectedDay(d);
                      setSelectedSlotId(undefined);
                    }}
                  >
                    <Calendar size={15} />
                    <span>{fmtDate(new Date(d).toISOString())}</span>
                    <span style={{ fontSize: "0.72rem", background: activeDay === d ? "rgba(4, 120, 87, 0.15)" : "#e2e8f0", padding: "0.1rem 0.45rem", borderRadius: "999px", marginLeft: "4px" }}>
                      {count} {count === 1 ? "slot" : "slots"}
                    </span>
                  </button>
                );
              })}
            </div>

            <h2>Available Time Slots</h2>
            <div className="slots-grid">
              {daySlots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`slot-btn ${selectedSlotId === s.id ? "active" : ""}`}
                  onClick={() => setSelectedSlotId(s.id)}
                >
                  {selectedSlotId === s.id ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                  <span>{fmtTime(s.starts_at)}</span>
                </button>
              ))}
            </div>

            <div className="reason-field-wrap">
              <label>
                <strong>Reason for Visit (optional)</strong>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Regular follow-up, symptom review, general health advice..."
                />
              </label>

              {/* Quick Reason Suggestion Chips */}
              <div className="quick-reason-chips">
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700, alignSelf: "center" }}>Quick Pick:</span>
                {["General Consultation", "Follow-up Visit", "Fever & Cold Symptoms", "Skin Consultation", "Prescription Review"].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="quick-reason-chip"
                    onClick={() => setReason(r)}
                  >
                    + {r}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="alert error-alert" role="alert">
                {error}
              </p>
            )}

            <div className="booking-action-bar">
              <button
                className="btn primary book-consultation-btn"
                disabled={!selectedSlotId || booking}
                onClick={handleBook}
              >
                {booking ? "Reserving Slot..." : `Book Consultation for ${patient?.name?.split(" ")[0] || "Patient"}`}
              </button>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                {selectedSlotId && (
                  <span className="selected-summary muted small">
                    Slot: {fmtTime(slots.find((s) => s.id === selectedSlotId)?.starts_at || "")} on {activeDay}
                  </span>
                )}
                <span className="muted small">
                  Patient: <strong>{patient?.name || "Patient"}</strong> (ID: P-{patient ? String(patient.id).padStart(4, "0") : "0001"})
                </span>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
