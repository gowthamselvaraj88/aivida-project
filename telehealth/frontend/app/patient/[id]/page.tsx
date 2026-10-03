"use client";

import { useEffect, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import DoctorShell from "@/components/DoctorShell";
import { api, PatientDetailsData } from "@/lib/api";
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Pill,
  Save,
  ShieldAlert,
  User,
  Video,
  CheckCircle2,
} from "lucide-react";

export default function PatientDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] = useState<PatientDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Doctor notes state
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSavedNotice, setNotesSavedNotice] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "history" | "notes" | "prescriptions">("all");
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.getPatientDetails(id);
        if (!cancelled) {
          setData(res);
          if (res.consultation?.notes) {
            setNotes(res.consultation.notes);
          }
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSaveNotes() {
    if (!data?.consultation?.id) return;
    setSavingNotes(true);
    try {
      await api.saveNotes(data.consultation.id, notes);
      setNotesSavedNotice(true);
      setTimeout(() => setNotesSavedNotice(false), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingNotes(false);
    }
  }

  const startVideo = () => {
    if (data?.consultation?.id) {
      router.push(`/consultation/${data.consultation.id}`);
    } else {
      router.push(`/consultation/${id}`);
    }
  };

  return (
    <DoctorShell>
      <main className="details-page">
        {/* Top Navigation */}
        <header className="details-topbar">
          <button className="btn ghost back-btn" onClick={() => startTransition(() => router.push("/"))}>
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </button>
          <span className="eyebrow">SCREEN 2 · PATIENT DETAILS & MEDICAL HISTORY</span>
        </header>

        {loading ? (
          <div className="empty-panel">
            <p className="muted">Loading patient details and medical history from database...</p>
          </div>
        ) : error ? (
          <div className="alert error-alert" role="alert">
            <p>{error}</p>
          </div>
        ) : !data ? (
          <div className="empty-panel">
            <p>Patient record not found.</p>
          </div>
        ) : (
          <>
            {/* Patient Header Banner */}
            <section className="patient-hero-banner">
              <div className="patient-avatar-large">
                {data.patient.name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")}
              </div>

              <div className="patient-hero-info">
                <div className="patient-tagline">
                  <span className="id-badge">ID: P-{String(data.patient.id).padStart(4, "0")}</span>
                  <span className="badge-tag">Blood {data.patient.blood_group || "Unknown"}</span>
                </div>
                <h1>{data.patient.name}</h1>
                <p className="patient-meta-line">
                  <span>{data.patient.age} years old</span> · <span>{data.patient.gender}</span> ·{" "}
                  <span>{data.patient.phone}</span> · <span>{data.patient.email}</span>
                </p>
              </div>

              <div className="patient-hero-action">
                <button className="btn primary start-call-btn" onClick={startVideo}>
                  <Video size={18} />
                  <span>Start Video Consultation</span>
                </button>
              </div>
            </section>

            {/* Current Consultation Reason Banner */}
            {data.consultation && (
              <section className="consultation-reason-banner">
                <div className="reason-label">
                  <Clock size={16} />
                  <span>Scheduled Consultation</span>
                </div>
                <div className="reason-content">
                  <h2>{data.consultation.reason || "General Medical Consultation"}</h2>
                  <p className="muted small">
                    Appointment #{data.consultation.id} · Scheduled for{" "}
                    {new Date(data.consultation.starts_at).toLocaleString("en-IN", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span className={`status-pill ${data.consultation.status}`}>
                  {data.consultation.status.replace("_", " ").toUpperCase()}
                </span>
              </section>
            )}

            {/* Segmented Dossier Tabs */}
            <nav className="dossier-tabs" aria-label="Patient dossier sections">
              <button
                type="button"
                className={`dossier-tab ${activeTab === "all" ? "active" : ""}`}
                onClick={() => setActiveTab("all")}
              >
                Overview / All Details
              </button>
              <button
                type="button"
                className={`dossier-tab ${activeTab === "history" ? "active" : ""}`}
                onClick={() => setActiveTab("history")}
              >
                Medical History & Allergies
              </button>
              <button
                type="button"
                className={`dossier-tab ${activeTab === "notes" ? "active" : ""}`}
                onClick={() => setActiveTab("notes")}
              >
                Clinical Notes {notes ? "•" : ""}
              </button>
              <button
                type="button"
                className={`dossier-tab ${activeTab === "prescriptions" ? "active" : ""}`}
                onClick={() => setActiveTab("prescriptions")}
              >
                Prescriptions ({data.prescriptions.length})
              </button>
            </nav>

            {/* Two-Column Clinical Grid */}
            <div className="clinical-grid">
              {/* Left Column: Medical History & Doctor Notes */}
              {(activeTab === "all" || activeTab === "history" || activeTab === "notes") && (
                <div className="clinical-col">
                  {/* Medical History */}
                  {(activeTab === "all" || activeTab === "history") && (
                    <section className="clinical-card">
                      <div className="card-header">
                        <div className="card-title">
                          <ShieldAlert size={18} className="icon-warn" />
                          <h2>Medical History & Clinical Background</h2>
                        </div>
                      </div>

                      <dl className="facts-grid">
                        <dt>Chronological Age</dt>
                        <dd>{data.patient.age} years</dd>

                        <dt>Biological Gender</dt>
                        <dd>{data.patient.gender}</dd>

                        <dt>Blood Group</dt>
                        <dd>
                          <strong className="blood-tag">{data.patient.blood_group || "Not recorded"}</strong>
                        </dd>

                        <dt>Known Allergies</dt>
                        <dd>
                          {data.patient.allergies.length ? (
                            <div className="tags-wrap">
                              {data.patient.allergies.map((a) => (
                                <span key={a} className="tag tag-warn">
                                  {a}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="muted">None recorded</span>
                          )}
                        </dd>

                        <dt>Chronic Conditions</dt>
                        <dd>
                          {data.patient.conditions.length ? (
                            <div className="tags-wrap">
                              {data.patient.conditions.map((c) => (
                                <span key={c} className="tag tag-info">
                                  {c}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="muted">None recorded</span>
                          )}
                        </dd>
                      </dl>
                    </section>
                  )}

                  {/* Doctor Notes Section (Persistent to DB) */}
                  {(activeTab === "all" || activeTab === "notes") && (
                    <section className="clinical-card doctor-notes-card">
                      <div className="card-header between">
                        <div className="card-title">
                          <FileText size={18} />
                          <h2>Clinical Doctor Notes</h2>
                        </div>
                        {notesSavedNotice && (
                          <span className="saved-badge">
                            <CheckCircle2 size={14} /> Saved to Database
                          </span>
                        )}
                      </div>

                      <p className="muted small">
                        Document observations, diagnostic rationale, or follow-up instructions for this patient.
                      </p>

                      {/* Quick Clinical Note Template Chips */}
                      <div className="note-template-chips">
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700, alignSelf: "center" }}>Quick Insert:</span>
                        {[
                          "Vitals stable, patient conscious and oriented.",
                          "Advised fasting blood glucose & lipid profile.",
                          "Reviewed medication response, continuing regimen.",
                          "Patient instructed on hydration & rest. Review in 14 days."
                        ].map((tmpl) => (
                          <button
                            key={tmpl}
                            type="button"
                            className="note-template-chip"
                            onClick={() => setNotes((prev) => (prev.trim() ? `${prev}\n${tmpl}` : tmpl))}
                          >
                            + {tmpl.split(",")[0].replace("Advised ", "").replace("Reviewed ", "").replace("Patient instructed on ", "")}
                          </button>
                        ))}
                      </div>

                      <textarea
                        className="doctor-notes-textarea"
                        rows={5}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Enter diagnostic impressions, exam findings, vitals, or clinical progression notes..."
                      />

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.6rem" }}>
                        <span className="muted small">
                          {notes.trim() ? notes.trim().split(/\s+/).length : 0} words · {notes.length} chars
                        </span>
                        <button
                          className="btn primary small save-notes-btn"
                          onClick={handleSaveNotes}
                          disabled={savingNotes}
                        >
                          <Save size={14} />
                          <span>{savingNotes ? "Saving..." : "Save Notes"}</span>
                        </button>
                      </div>
                    </section>
                  )}
                </div>
              )}

              {/* Right Column: Previous Consultations & Previous Prescriptions */}
              {(activeTab === "all" || activeTab === "history" || activeTab === "prescriptions") && (
                <div className="clinical-col">
                  {/* Previous Consultation Details */}
                  {(activeTab === "all" || activeTab === "history") && (
                    <section className="clinical-card">
                      <div className="card-header between">
                        <div className="card-title">
                          <Calendar size={18} />
                          <h2>Previous Consultation History</h2>
                    </div>
                    <span className="count-badge">{data.history.length}</span>
                  </div>

                  {data.history.length === 0 ? (
                    <p className="empty-state">No prior consultations recorded in practice database.</p>
                  ) : (
                    <ul className="history-timeline">
                      {data.history.map((item) => (
                        <li key={item.id} className="history-node">
                          <div className="history-header">
                            <strong>{item.reason || "Consultation"}</strong>
                            <span className="muted small">
                              {new Date(item.starts_at).toLocaleDateString("en-IN", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                          <p className="history-doctor small">Doctor: {item.doctor.name}</p>
                          {item.notes && <p className="history-notes">{item.notes}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

                  {/* Previous Prescriptions */}
                  {(activeTab === "all" || activeTab === "prescriptions") && (
                    <section className="clinical-card">
                      <div className="card-header between">
                        <div className="card-title">
                          <Pill size={18} />
                          <h2>Previous Prescriptions</h2>
                        </div>
                        <span className="count-badge">{data.prescriptions.length}</span>
                      </div>

                      {data.prescriptions.length === 0 ? (
                        <p className="empty-state">No previous medications recorded.</p>
                      ) : (
                        <ul className="prescription-list">
                          {data.prescriptions.map((rx) => (
                            <li key={rx.id} className="rx-item">
                              <div className="rx-main">
                                <strong>{rx.medicine}</strong>
                                <span className="rx-dosage">{rx.dosage}</span>
                              </div>
                              <p className="rx-timing small muted">
                                {[rx.frequency, rx.duration].filter(Boolean).join(" · ")}
                                {rx.doctor_name ? ` · Prescribed by ${rx.doctor_name}` : ""}
                              </p>
                              {rx.instructions && (
                                <p className="rx-inst small">
                                  <em>Instructions: {rx.instructions}</em>
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Footer Bar */}
            <footer className="details-bottom-bar">
              <div>
                <strong>Ready for consultation?</strong>
                <span className="muted small"> Connect instantly via encrypted WebRTC audio/video visit.</span>
              </div>
              <button className="btn primary start-call-btn" onClick={startVideo}>
                <Video size={18} />
                <span>Start Video Consultation</span>
              </button>
            </footer>
          </>
        )}
      </main>
    </DoctorShell>
  );
}