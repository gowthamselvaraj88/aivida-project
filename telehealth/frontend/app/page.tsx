"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DoctorShell from "@/components/DoctorShell";
import { api, CURRENT_DOCTOR_ID, Doctor, DoctorDashboardData } from "@/lib/api";
import {
  CalendarDays,
  Check,
  Clock,
  Plus,
  Users,
  Video,
  X,
  AlertCircle,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });

export default function DoctorDashboardPage() {
  const router = useRouter();
  const [doctorId, setDoctorId] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aivida_doctor_id");
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val > 0) return val;
      }
    }
    return CURRENT_DOCTOR_ID;
  });
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [data, setData] = useState<DoctorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" } | null>(null);

  // New slot form state
  const [when, setWhen] = useState("");
  const [duration, setDuration] = useState(30);
  const [reason, setReason] = useState("");
  const [slotSuccess, setSlotSuccess] = useState(false);

  const showToast = (message: string, type: "success" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const applyPreset = (offsetHours: number, targetHour?: number) => {
    const d = new Date();
    if (targetHour !== undefined) {
      if (offsetHours >= 24) d.setDate(d.getDate() + 1);
      d.setHours(targetHour, 0, 0, 0);
    } else {
      d.setHours(d.getHours() + offsetHours);
      d.setMinutes(0, 0, 0);
    }
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setWhen(local);
  };

  // Fetch all registered doctors for quick switching
  useEffect(() => {
    api.listDoctors().then(setAllDoctors).catch(() => {});
  }, []);

  // Listen for doctor change events from the top navigation bar
  useEffect(() => {
    const handleDoctorChange = () => {
      const saved = localStorage.getItem("aivida_doctor_id");
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val > 0 && val !== doctorId) {
          setDoctorId(val);
        }
      }
    };
    window.addEventListener("aivida_doctor_change", handleDoctorChange);
    return () => window.removeEventListener("aivida_doctor_change", handleDoctorChange);
  }, [doctorId]);

  const loadDashboard = useCallback(async () => {
    try {
      const dashboard = await api.getDoctorDashboard(doctorId);
      setData(dashboard);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    loadDashboard();
    const interval = window.setInterval(loadDashboard, 5000);
    return () => window.clearInterval(interval);
  }, [loadDashboard]);

  async function toggleStatus() {
    if (!data) return;
    setTogglingOnline(true);
    try {
      const nextStatus = !data.doctor.is_online;
      await api.updateDoctorStatus(data.doctor.id, nextStatus);
      setData((prev) =>
        prev ? { ...prev, doctor: { ...prev.doctor, is_online: nextStatus } } : null
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("aivida_doctor_change"));
      }
      showToast(`Doctor status updated to ${nextStatus ? "Active & Online" : "Offline"} in database`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTogglingOnline(false);
    }
  }

  async function handleRequest(apptId: number, decision: "accept" | "decline") {
    setBusyAction(`${decision}-${apptId}`);
    try {
      if (decision === "accept") {
        await api.acceptAppointment(apptId);
        showToast("Consultation request accepted! Scheduled in database.");
      } else {
        await api.declineAppointment(apptId);
        showToast("Consultation request declined.", "info");
      }
      await loadDashboard();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!when) return;
    setError("");
    try {
      await api.createSlot(
        doctorId,
        new Date(when).toISOString(),
        duration,
        reason.trim() || "General consultation"
      );
      setSlotSuccess(true);
      showToast("Consultation slot published to patient booking directory!");
      setTimeout(() => setSlotSuccess(false), 4000);
      setWhen("");
      setReason("");
      loadDashboard();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <DoctorShell>
      <main className="dashboard">
        {/* Doctor Greeting Banner (AIvida Aesthetics) */}
        <header className="doctor-greeting-banner">
          <div className="doctor-greeting-left">
            <div className="doctor-greeting-avatar" aria-hidden="true">
              {data ? data.doctor.name.replace("Dr. ", "").split(" ").map((p) => p[0]).slice(0, 2).join("") : "DR"}
            </div>
            <div className="doctor-greeting-text">
              <div className="eyebrow-row">
                <span className="eyebrow">AIVIDA CLINICAL WORKSPACE · PRACTICE PORTAL</span>
                {data && <span className="doctor-qual-tag">{data.doctor.qualification}</span>}
              </div>
              <h1>{data ? `Good day, ${data.doctor.name}` : "Doctor Workspace"}</h1>
              <p className="doctor-greeting-meta">
                <strong>{data?.doctor.specialization}</strong> · Practice ID <strong>DOC-{String(data?.doctor.id ?? 1).padStart(4, "0")}</strong> · Today: {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          </div>

          <div className="doctor-greeting-actions">
            <button
              className={`availability-toggle-btn ${data?.doctor.is_online ? "online" : "offline"}`}
              type="button"
              onClick={toggleStatus}
              disabled={togglingOnline}
              title="Click to toggle status (persisted in DB)"
              aria-pressed={data?.doctor.is_online}
            >
              <span className="status-dot-pulse" />
              <span>{data?.doctor.is_online ? "Active & Online" : "Set to Online"}</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="alert error-alert" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* 4 Metric Cards - With AIvida Tags and Positive Indicators */}
        <section className="metric-grid" aria-label="Practice statistics">
          <a
            href="#today-section"
            className="metric-card"
            title="Jump to today's appointments schedule"
          >
            <div className="metric-card-top">
              <div className="metric-icon-wrap today-icon">
                <Clock size={19} strokeWidth={2.4} />
              </div>
              <span className="metric-tag positive-badge">+3.78%</span>
            </div>
            <div className="metric-card-middle">
              <strong className="metric-number">{data?.today_count ?? 0}</strong>
              <span className="metric-title">Today's visits</span>
            </div>
            <div className="metric-card-bottom">
              <span className="metric-subtitle">Scheduled for today</span>
              <span className="tile-action-hint">View visits &darr;</span>
            </div>
          </a>

          <a
            href="#upcoming-section"
            className="metric-card"
            title="Jump to upcoming appointments"
          >
            <div className="metric-card-top">
              <div className="metric-icon-wrap upcoming-icon">
                <CalendarDays size={19} strokeWidth={2.4} />
              </div>
              <span className="metric-tag">Future</span>
            </div>
            <div className="metric-card-middle">
              <strong className="metric-number">{data?.upcoming_count ?? 0}</strong>
              <span className="metric-title">Upcoming visits</span>
            </div>
            <div className="metric-card-bottom">
              <span className="metric-subtitle">Future scheduled visits</span>
              <span className="tile-action-hint">View schedule &darr;</span>
            </div>
          </a>

          <Link
            href="/patients"
            className="metric-card"
            title="Open practice patient directory"
          >
            <div className="metric-card-top">
              <div className="metric-icon-wrap patients-icon">
                <Users size={19} strokeWidth={2.4} />
              </div>
              <span className="metric-tag">Directory</span>
            </div>
            <div className="metric-card-middle">
              <strong className="metric-number">{data?.total_patients ?? 0}</strong>
              <span className="metric-title">Total patients</span>
            </div>
            <div className="metric-card-bottom">
              <span className="metric-subtitle">In practice database</span>
              <span className="tile-action-hint">Open list &rarr;</span>
            </div>
          </Link>

          <a
            href="#pending-section"
            className="metric-card"
            title="Jump to pending consultation requests"
          >
            <div className="metric-card-top">
              <div className="metric-icon-wrap pending-icon">
                <Sparkles size={19} strokeWidth={2.4} />
              </div>
              <span className="metric-tag">Inbox</span>
            </div>
            <div className="metric-card-middle">
              <strong className="metric-number">{data?.pending_count ?? 0}</strong>
              <span className="metric-title">Pending requests</span>
            </div>
            <div className="metric-card-bottom">
              <span className="metric-subtitle">Awaiting confirmation</span>
              <span className="tile-action-hint">Review inbox &darr;</span>
            </div>
          </a>
        </section>

        {/* Main Dashboard 2-Column Grid */}
        <div className="dashboard-columns">
          {/* Left Column: Today's Appointments & Upcoming Visits */}
          <div className="dashboard-column-left">
            {/* Today's Appointments with Join Consultation CTA */}
            <section id="today-section" className="dashboard-section today-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">TODAY'S VISITS</p>
                  <h2>Today's Appointments</h2>
                </div>
                <span className="count-badge">{data?.today_count ?? 0}</span>
              </div>

              {loading ? (
                <p className="empty-state">Loading appointments from database...</p>
              ) : (data?.today_appointments.length ?? 0) === 0 ? (
                <div className="empty-state-box">
                  <CalendarDays size={32} className="muted" />
                  <p>No consultations scheduled for today.</p>
                  <small className="muted">Pending patient requests can be accepted on the right.</small>
                </div>
              ) : (
                <ul className="appointment-list">
                  {data?.today_appointments.map((appt) => (
                    <li key={appt.id} className="appointment-card">
                      <div className="appointment-time-badge">
                        <Clock size={14} />
                        <span>{fmtTime(appt.starts_at)}</span>
                      </div>

                      <div className="appointment-info">
                        <div className="patient-headline">
                          <strong>{appt.patient.name}</strong>
                          <span className="patient-demographics">
                            {appt.patient.age}y · {appt.patient.gender} · Blood {appt.patient.blood_group || "—"}
                          </span>
                        </div>
                        <p className="appointment-reason">{appt.reason || "General consultation"}</p>
                      </div>

                      <div className="appointment-actions">
                        <button
                          className="btn ghost small"
                          type="button"
                          onClick={() => router.push(`/patient/${appt.id}`)}
                        >
                          Patient details
                        </button>
                        <button
                          className="btn primary join-btn join-btn-pulsing"
                          type="button"
                          onClick={() => router.push(`/consultation/${appt.id}`)}
                        >
                          <Video size={16} />
                          <span>Join Consultation</span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Upcoming Appointments */}
            <section id="upcoming-section" className="dashboard-section upcoming-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">FUTURE SCHEDULE</p>
                  <h2>Upcoming Appointments</h2>
                </div>
                <span className="count-badge">{data?.upcoming_count ?? 0}</span>
              </div>

              {(data?.upcoming_appointments.length ?? 0) === 0 ? (
                <div className="empty-state-box compact">
                  <p>No upcoming appointments scheduled yet.</p>
                </div>
              ) : (
                <ul className="appointment-list compact">
                  {data?.upcoming_appointments.map((appt) => (
                    <li key={appt.id} className="upcoming-item">
                      <div className="appointment-info upcoming-info">
                        <strong className="upcoming-patient-name">{appt.patient.name}</strong>
                        <span className="upcoming-meta">
                          <span className="upcoming-time">{fmt(appt.starts_at)}</span>
                          <span className="upcoming-sep">·</span>
                          <span className="upcoming-reason">{appt.reason || "General consultation"}</span>
                        </span>
                      </div>
                      <div className="appointment-actions">
                        <button
                          className="btn ghost small"
                          type="button"
                          onClick={() => router.push(`/patient/${appt.id}`)}
                        >
                          Patient details
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Right Column: Pending Requests Inbox & Practice Slot Creator */}
          <div className="dashboard-column-right">
            {/* Pending Requests Inbox */}
            <section id="pending-section" className="dashboard-section pending-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">INBOX</p>
                  <h2>Pending Consultation Requests</h2>
                </div>
                <span className="count-badge alert-badge">{data?.pending_count ?? 0}</span>
              </div>

              {(data?.pending_requests.length ?? 0) === 0 ? (
                <div className="empty-state-box compact">
                  <p>No requests waiting for review.</p>
                </div>
              ) : (
                <ul className="appointment-list compact">
                  {data?.pending_requests.map((appt) => (
                    <li key={appt.id} className="pending-card">
                      <div className="appointment-info pending-info">
                        <strong className="pending-patient-name">{appt.patient.name}</strong>
                        <span className="pending-meta">
                          <span className="pending-time">{fmt(appt.starts_at)}</span>
                          <span className="pending-sep">·</span>
                          <span className="pending-reason">{appt.reason || "General consultation"}</span>
                        </span>
                      </div>
                      <div className="appointment-actions pending-actions">
                        <button
                          className="btn primary small accept-btn"
                          disabled={busyAction === `accept-${appt.id}`}
                          onClick={() => handleRequest(appt.id, "accept")}
                          title="Accept request"
                        >
                          <Check size={14} />
                          <span>Accept</span>
                        </button>
                        <button
                          className="btn ghost small decline-btn"
                          disabled={busyAction === `decline-${appt.id}`}
                          onClick={() => handleRequest(appt.id, "decline")}
                          title="Decline request"
                        >
                          <X size={14} />
                          <span>Decline</span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Create Consultation Slot with Presets & Pills */}
            <section id="create-slot-section" className="dashboard-section create-slot-section">
              <div className="section-heading slot-card-heading">
                <div>
                  <p className="eyebrow">PRACTICE AVAILABILITY</p>
                  <h2>Create Consultation Slot</h2>
                </div>
              </div>

              {slotSuccess && (
                <div className="slot-success-banner">
                  <CheckCircle2 size={18} className="slot-success-icon" />
                  <span>New consultation slot successfully published to patient directory!</span>
                </div>
              )}

              <form className="slot-form-structured" onSubmit={handleCreateSlot}>
                {/* Field 1: Starts at */}
                <div className="slot-form-field">
                  <div className="slot-field-header">
                    <label htmlFor="slot-datetime-input" className="slot-field-label">
                      <Clock size={14} className="slot-field-icon" />
                      <span>Starts at</span>
                    </label>
                    <span className="slot-badge-required">Required</span>
                  </div>

                  <input
                    id="slot-datetime-input"
                    type="datetime-local"
                    className="slot-custom-input"
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                    required
                  />

                  {/* Quick Presets */}
                  <div className="slot-quick-presets">
                    <span className="slot-quick-label">Quick:</span>
                    <div className="slot-quick-chips">
                      <button type="button" className="slot-preset-pill" onClick={() => applyPreset(1)}>In 1 hour</button>
                      <button type="button" className="slot-preset-pill" onClick={() => applyPreset(24, 10)}>Tomorrow 10 AM</button>
                      <button type="button" className="slot-preset-pill" onClick={() => applyPreset(24, 14)}>Tomorrow 2 PM</button>
                      <button type="button" className="slot-preset-pill" onClick={() => applyPreset(24, 17)}>Tomorrow 5 PM</button>
                    </div>
                  </div>
                </div>

                {/* Field 2: Duration */}
                <div className="slot-form-field">
                  <div className="slot-field-header">
                    <label className="slot-field-label">
                      <span>Length / Duration</span>
                    </label>
                    <span className="slot-duration-tag">{duration} mins</span>
                  </div>

                  <div className="slot-duration-grid">
                    {[15, 20, 30, 45, 60].map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`slot-duration-btn ${duration === d ? "active" : ""}`}
                        onClick={() => setDuration(d)}
                      >
                        {d} mins
                      </button>
                    ))}
                  </div>
                </div>

                {/* Field 3: Reason / Session Type */}
                <div className="slot-form-field">
                  <div className="slot-field-header">
                    <label htmlFor="slot-reason-input" className="slot-field-label">
                      <Sparkles size={14} className="slot-field-icon" />
                      <span>Reason / Session type</span>
                    </label>
                    <span className="slot-field-optional">Optional</span>
                  </div>

                  <input
                    id="slot-reason-input"
                    className="slot-custom-input"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Follow-up consultation"
                  />

                  <div className="slot-reason-chips">
                    {["General Consultation", "Follow-up Review", "Diagnostic Follow-up", "Lab Report Review"].map((r) => (
                      <button
                        key={r}
                        type="button"
                        className="slot-reason-pill"
                        onClick={() => setReason(r)}
                      >
                        + {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Action */}
                <button className="slot-submit-cta" type="submit">
                  <Plus size={18} strokeWidth={2.6} />
                  <span>Publish Slot to Patient Directory</span>
                </button>
              </form>
            </section>
          </div>
        </div>

        {/* Live Interactive Toast Notification */}
        {toast && (
          <div className="toast-notification" role="status">
            <CheckCircle2 size={18} style={{ color: "var(--brand)" }} />
            <span>{toast.message}</span>
          </div>
        )}
      </main>
    </DoctorShell>
  );
}
