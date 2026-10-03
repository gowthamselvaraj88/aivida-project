"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DoctorShell from "@/components/DoctorShell";
import { api, Appointment, CURRENT_DOCTOR_ID } from "@/lib/api";
import { Video, Clock, Check, X } from "lucide-react";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  async function load() {
    try {
      const data = await api.getDoctorDashboard(CURRENT_DOCTOR_ID);
      const all = [
        ...data.pending_requests,
        ...data.today_appointments,
        ...data.upcoming_appointments,
      ];
      setAppointments(all);
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function decide(id: number, accept: boolean) {
    setBusy(id);
    try {
      if (accept) await api.acceptAppointment(id);
      else await api.declineAppointment(id);
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const pending = appointments.filter((item) => item.status === "pending");
  const confirmed = appointments.filter(
    (item) => item.status === "scheduled" || item.status === "in_progress"
  );

  return (
    <DoctorShell>
      <main className="dashboard">
        <header className="page-heading">
          <p className="eyebrow">CONSULTATION SCHEDULE</p>
          <h1>Appointments</h1>
          <p className="muted">Review pending consultation requests and manage confirmed visits.</p>
        </header>

        {error && <p className="alert error-alert" role="alert">{error}</p>}

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>Pending Consultation Requests</h2>
            <span className="count-badge alert-badge">{pending.length}</span>
          </div>
          <ul className="appointment-list">
            {pending.map((item) => (
              <li key={item.id} className="pending-card">
                <div className="appointment-info pending-info">
                  <div className="patient-headline">
                    <strong className="pending-patient-name">{item.patient.name}</strong>
                    {item.patient.age && item.patient.gender && (
                      <span className="patient-demographics">
                        {item.patient.age}y · {item.patient.gender} · Blood {item.patient.blood_group || "—"}
                      </span>
                    )}
                  </div>
                  <span className="pending-meta">
                    <Clock size={13} />
                    <span className="pending-time">{fmtDate(item.starts_at)} at {fmtTime(item.starts_at)}</span>
                    <span className="pending-sep">·</span>
                    <span className="pending-reason">{item.reason || "General consultation"}</span>
                  </span>
                </div>
                <div className="appointment-actions pending-actions">
                  <button
                    className="btn primary small accept-btn"
                    disabled={busy === item.id}
                    onClick={() => decide(item.id, true)}
                  >
                    <Check size={14} />
                    <span>Accept</span>
                  </button>
                  <button
                    className="btn ghost small decline-btn"
                    disabled={busy === item.id}
                    onClick={() => decide(item.id, false)}
                  >
                    <X size={14} />
                    <span>Decline</span>
                  </button>
                </div>
              </li>
            ))}
            {pending.length === 0 && (
              <li className="empty-state">No requests are waiting for review.</li>
            )}
          </ul>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>Confirmed Consultations</h2>
            <span className="count-badge">{confirmed.length}</span>
          </div>
          <ul className="appointment-list">
            {confirmed.map((item) => (
              <li key={item.id} className="appointment-card">
                <div className="appointment-time-badge">
                  <Clock size={14} />
                  <span>{fmtTime(item.starts_at)}</span>
                </div>

                <div className="appointment-info">
                  <div className="patient-headline">
                    <strong>{item.patient.name}</strong>
                    {item.patient.age && item.patient.gender && (
                      <span className="patient-demographics">
                        {item.patient.age}y · {item.patient.gender} · Blood {item.patient.blood_group || "—"}
                      </span>
                    )}
                  </div>
                  <p className="appointment-reason">
                    <span className="appointment-date-tag">{fmtDate(item.starts_at)}</span>
                    <span className="pending-sep">·</span>
                    <span>{item.reason || "General consultation"}</span>
                  </p>
                </div>

                <div className="appointment-actions">
                  <Link className="btn ghost small" href={`/patient/${item.id}`}>
                    Patient details
                  </Link>
                  <Link className="btn primary small join-btn" href={`/consultation/${item.id}`}>
                    <Video size={14} />
                    <span>Join Video</span>
                  </Link>
                </div>
              </li>
            ))}
            {confirmed.length === 0 && (
              <li className="empty-state">No confirmed consultations scheduled.</li>
            )}
          </ul>
        </section>
      </main>
    </DoctorShell>
  );
}