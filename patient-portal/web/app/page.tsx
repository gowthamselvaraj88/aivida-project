"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  FileText,
  Pill,
  Search,
  Video,
  X,
  Clock,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import {
  api,
  Appointment,
  Patient,
  Prescription,
  MedicalRecord,
  fmtDate,
  fmtTime,
  initials,
  getStoredPatientId,
} from "@/lib/api";

export default function PatientDashboard() {
  const [patientId, setPatientId] = useState<number>(() => getStoredPatientId());
  const [patient, setPatient] = useState<Patient | null>(null);
  const [nextAppt, setNextAppt] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);

  // Quick Action Modal states
  const [showRecordsModal, setShowRecordsModal] = useState(false);
  const [showRxModal, setShowRxModal] = useState(false);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);
  const [searchRecord, setSearchRecord] = useState("");
  const [searchRx, setSearchRx] = useState("");

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

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const [p, appt] = await Promise.all([
          api<Patient>(`/patient?id=${patientId}`),
          api<Appointment | null>(`/appointments/next?patient_id=${patientId}`).catch(() => null),
        ]);
        if (!cancelled) {
          setPatient(p);
          setNextAppt(appt);
        }
      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    const interval = window.setInterval(loadData, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [patientId]);

  async function openRecords() {
    setShowRecordsModal(true);
    if (!patient) return;
    setLoadingModal(true);
    try {
      const data = await api<MedicalRecord[]>(`/patients/${patient.id}/records`);
      setRecords(data);
    } catch {
      setRecords([]);
    } finally {
      setLoadingModal(false);
    }
  }

  async function openPrescriptions() {
    setShowRxModal(true);
    if (!patient) return;
    setLoadingModal(true);
    try {
      const data = await api<Prescription[]>(`/patients/${patient.id}/prescriptions`);
      setPrescriptions(data);
    } catch {
      setPrescriptions([]);
    } finally {
      setLoadingModal(false);
    }
  }

  return (
    <div className="dashboard-page">
      {/* Patient Profile Header */}
      <header className="patient-greeting">
        <div className="patient-avatar">
          {initials(patient?.name ?? "Sample Patient")}
        </div>
        <div>
          <p className="eyebrow">AIVIDA PATIENT PORTAL</p>
          <h1>Good day, {patient?.name ?? "Patient"}</h1>
          <p className="patient-meta">
            Patient ID {patient ? `P-${String(patient.id).padStart(4, "0")}` : "—"} · Blood group{" "}
            <strong>{patient?.blood_group || "—"}</strong> · {patient?.gender || "—"} · {patient?.phone || "—"}
          </p>
        </div>
      </header>

      {/* Upcoming Appointment Section */}
      <section aria-labelledby="upcoming-title">
        <div className="upcoming-banner">
          {loading ? (
            <p className="muted" style={{ color: "#e4f5f2" }}>
              Checking your consultation schedule...
            </p>
          ) : nextAppt ? (
            <>
              <div className="appointment-doctor">
                <div className="doctor-monogram">{initials(nextAppt.doctor.name)}</div>
                <div>
                  <p className="banner-label">Upcoming Appointment</p>
                  <h2 id="upcoming-title">{nextAppt.doctor.name}</h2>
                  <p className="banner-detail">
                    {nextAppt.doctor.specialization} · {fmtDate(nextAppt.starts_at)} at{" "}
                    {fmtTime(nextAppt.starts_at)}
                  </p>
                  <span className={`status-pill ${nextAppt.status}`} style={{ marginTop: "6px", display: "inline-block" }}>
                    {nextAppt.status === "pending"
                      ? "Awaiting Doctor Approval"
                      : nextAppt.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div>
                {nextAppt.status === "pending" ? (
                  <Link className="btn btn-light" href={`/appointments/${nextAppt.id}`}>
                    <Clock size={17} /> View Request Status
                  </Link>
                ) : (
                  <Link className="btn btn-light join-consultation-btn-pulse" href={`/appointments/${nextAppt.id}`}>
                    <Video size={18} /> Join Video Consultation
                  </Link>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="appointment-doctor">
                <div className="doctor-monogram">
                  <CalendarDays size={26} />
                </div>
                <div>
                  <p className="banner-label">Upcoming Appointment</p>
                  <h2 id="upcoming-title">No consultations scheduled</h2>
                  <p className="banner-detail">
                    Consult certified doctors online through secure HD video visit.
                  </p>
                </div>
              </div>
              <Link className="btn btn-light" href="/doctors">
                Book Appointment
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Quick Actions (All 4 Functional & DB-backed) */}
      <section aria-labelledby="quick-actions-title">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.8rem" }}>
          <h2 id="quick-actions-title" style={{ margin: 0 }}>Quick actions</h2>
          <span style={{ fontSize: "0.82rem", color: "var(--muted)", fontWeight: 600 }}>Interactive Healthcare Hub</span>
        </div>

        <div className="quick-actions">
          {/* Action 1: Find Doctor */}
          <Link className="action-card" href="/doctors">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Search className="action-icon" size={22} />
              <span style={{ fontSize: "0.72rem", background: "#d1fae5", color: "#065f46", padding: "0.2rem 0.55rem", borderRadius: "999px", fontWeight: 700 }}>Specialists</span>
            </div>
            <div>
              <span className="action-title">Find Doctor</span>
              <p className="small muted">Browse specialists in Chennai</p>
            </div>
          </Link>

          {/* Action 2: Book Appointment */}
          <Link className="action-card" href="/doctors">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <CalendarDays className="action-icon" size={22} />
              <span style={{ fontSize: "0.72rem", background: "#e0f2fe", color: "#0369a1", padding: "0.2rem 0.55rem", borderRadius: "999px", fontWeight: 700 }}>Instant Slots</span>
            </div>
            <div>
              <span className="action-title">Book Appointment</span>
              <p className="small muted">Reserve live time slots</p>
            </div>
          </Link>

          {/* Action 3: Medical Records (Database Modal) */}
          <button className="action-card action-btn" type="button" onClick={openRecords}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <FileText className="action-icon" size={22} />
              <span style={{ fontSize: "0.72rem", background: "#fef3c7", color: "#92400e", padding: "0.2rem 0.55rem", borderRadius: "999px", fontWeight: 700 }}>EHR Vault</span>
            </div>
            <div>
              <span className="action-title">Medical Records</span>
              <p className="small muted">Clinical diagnoses & history</p>
            </div>
          </button>

          {/* Action 4: Prescriptions (Database Modal) */}
          <button className="action-card action-btn" type="button" onClick={openPrescriptions}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Pill className="action-icon" size={22} />
              <span style={{ fontSize: "0.72rem", background: "#f5f3ff", color: "#6b21a8", padding: "0.2rem 0.55rem", borderRadius: "999px", fontWeight: 700 }}>Rx Records</span>
            </div>
            <div>
              <span className="action-title">Prescriptions</span>
              <p className="small muted">View medications & instructions</p>
            </div>
          </button>
        </div>
      </section>

      {/* Telehealth Preparation Guidance Card */}
      <section style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)", borderRadius: "18px", border: "1px solid #bbf7d0", padding: "1.4rem 1.6rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.2rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "#059669", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <strong style={{ display: "block", fontSize: "0.98rem", color: "#064e3b" }}>Preparing for your Video Consultation?</strong>
            <span style={{ fontSize: "0.85rem", color: "#047857" }}>Test your camera and microphone, sit in a well-lit quiet room, and keep previous medications ready.</span>
          </div>
        </div>
        <Link href="/doctors" className="btn primary small" style={{ whiteSpace: "nowrap" }}>
          Find Specialist →
        </Link>
      </section>

      {/* Medical Records Modal */}
      {showRecordsModal && (
        <div className="modal-backdrop" onClick={() => setShowRecordsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Your Medical Records & Past Diagnoses</h2>
                <p className="muted small">Persisted in Aivida clinical database</p>
              </div>
              <button className="close-btn" onClick={() => setShowRecordsModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Search Filter Bar */}
              <div style={{ marginBottom: "1rem" }}>
                <input
                  type="text"
                  placeholder="Filter records by diagnosis or title..."
                  value={searchRecord}
                  onChange={(e) => setSearchRecord(e.target.value)}
                  style={{ width: "100%", padding: "0.6rem 0.9rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.88rem", outline: "none" }}
                />
              </div>

              {loadingModal ? (
                <p className="muted">Loading records from database...</p>
              ) : records.length === 0 ? (
                <p className="muted">No medical records documented yet.</p>
              ) : (
                <ul className="modal-items-list">
                  {records
                    .filter((r) =>
                      r.title.toLowerCase().includes(searchRecord.toLowerCase()) ||
                      r.diagnosis.toLowerCase().includes(searchRecord.toLowerCase())
                    )
                    .map((rec) => (
                      <li key={rec.id} className="modal-record-card">
                        <div className="record-header">
                          <strong>{rec.title}</strong>
                          <span className="muted small">
                            {new Date(rec.record_date).toLocaleDateString("en-IN", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        <p className="record-diagnosis">
                          <strong>Diagnosis:</strong> {rec.diagnosis}
                        </p>
                        <p className="record-doctor small">Doctor: {rec.doctor_name}</p>
                        {rec.notes && <p className="record-notes small">{rec.notes}</p>}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Prescriptions Modal */}
      {showRxModal && (
        <div className="modal-backdrop" onClick={() => setShowRxModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Your Prescriptions</h2>
                <p className="muted small">All medications issued by your doctors</p>
              </div>
              <button className="close-btn" onClick={() => setShowRxModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Search Filter Bar */}
              <div style={{ marginBottom: "1rem" }}>
                <input
                  type="text"
                  placeholder="Search medication name or instructions..."
                  value={searchRx}
                  onChange={(e) => setSearchRx(e.target.value)}
                  style={{ width: "100%", padding: "0.6rem 0.9rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.88rem", outline: "none" }}
                />
              </div>

              {loadingModal ? (
                <p className="muted">Loading prescriptions from database...</p>
              ) : prescriptions.length === 0 ? (
                <p className="muted">No active or previous prescriptions found.</p>
              ) : (
                <ul className="modal-items-list">
                  {prescriptions
                    .filter((rx) =>
                      rx.medicine.toLowerCase().includes(searchRx.toLowerCase()) ||
                      (rx.instructions && rx.instructions.toLowerCase().includes(searchRx.toLowerCase()))
                    )
                    .map((rx) => (
                      <li key={rx.id} className="modal-rx-card">
                        <div className="rx-header">
                          <strong>{rx.medicine}</strong>
                          <span className="rx-dosage-badge">{rx.dosage}</span>
                        </div>
                        <p className="rx-details small muted">
                          {[rx.frequency, rx.duration].filter(Boolean).join(" · ")}
                          {rx.doctor_name ? ` · Prescribed by ${rx.doctor_name}` : ""}
                        </p>
                        {rx.instructions && (
                          <p className="rx-instructions small">
                            <em>Instructions: {rx.instructions}</em>
                          </p>
                        )}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
