"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, Clock, Video, ArrowRight, CheckCircle2, Hourglass, Plus } from "lucide-react";
import { api, Appointment, Patient, fmtDate, fmtTime, initials, getStoredPatientId } from "@/lib/api";

export default function AppointmentsPage() {
  const [patientId, setPatientId] = useState<number>(() => getStoredPatientId());
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "upcoming" | "pending" | "completed">("all");

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
    setLoading(true);

    Promise.all([
      api<Appointment[]>(`/appointments?patient_id=${patientId}`).catch(() => []),
      api<Patient>(`/patient?id=${patientId}`).catch(() => null),
    ])
      .then(([appts, p]) => {
        if (!cancelled) {
          setAppointments(appts);
          if (p) setPatient(p);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const filtered = appointments.filter((a) => {
    if (filter === "upcoming") return a.status === "scheduled" || a.status === "in_progress";
    if (filter === "pending") return a.status === "pending";
    if (filter === "completed") return a.status === "completed";
    return true;
  });

  return (
    <div style={{ display: "grid", gap: "1.8rem" }}>
      <header className="page-heading" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <p className="eyebrow">PATIENT SCHEDULE</p>
          <h1 style={{ fontSize: "2rem", margin: "0.2rem 0" }}>My Consultations</h1>
          <p className="muted" style={{ margin: 0 }}>
            Review all scheduled visits, pending requests, and consultation history for <strong>{patient?.name || "Patient"}</strong>.
          </p>
        </div>
        <Link href="/doctors" className="btn primary">
          <Plus size={16} />
          <span>Book New Consultation</span>
        </Link>
      </header>

      {/* Filter Chips */}
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        {[
          { key: "all", label: `All Visits (${appointments.length})` },
          { key: "upcoming", label: `Upcoming & Live (${appointments.filter(a => a.status === "scheduled" || a.status === "in_progress").length})` },
          { key: "pending", label: `Pending Approval (${appointments.filter(a => a.status === "pending").length})` },
          { key: "completed", label: `Past Consultations (${appointments.filter(a => a.status === "completed").length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`modal-filter-btn ${filter === tab.key ? "active" : ""}`}
            onClick={() => setFilter(tab.key as any)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="muted">Loading your consultations from database...</p>
      ) : filtered.length === 0 ? (
        <section className="detail-card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
          <h2>No consultations found</h2>
          <p className="muted" style={{ marginBottom: "1.2rem" }}>
            {filter === "all" ? "You haven't scheduled any consultations yet." : `No consultations found under "${filter}".`}
          </p>
          <Link className="btn primary" href="/doctors" style={{ width: "fit-content", margin: "0 auto" }}>
            Browse Doctors & Slots
          </Link>
        </section>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {filtered.map((appt) => {
            const isPending = appt.status === "pending";
            const isScheduled = appt.status === "scheduled" || appt.status === "in_progress";
            const isCompleted = appt.status === "completed";

            return (
              <article
                key={appt.id}
                style={{
                  background: "#ffffff",
                  border: "1px solid var(--line)",
                  borderRadius: "16px",
                  padding: "1.4rem 1.6rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1.5rem",
                  boxShadow: "var(--shadow-sm)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "1.2rem" }}>
                  <div
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "50%",
                      background: isScheduled ? "linear-gradient(135deg, #047857 0%, #10b981 100%)" : "#f1f5f9",
                      color: isScheduled ? "#ffffff" : "#475569",
                      fontFamily: "var(--font-display)",
                      fontSize: "1.2rem",
                      fontWeight: 800,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {initials(appt.doctor.name)}
                  </div>
                  <div>
                    <h2 style={{ fontSize: "1.15rem", margin: "0 0 0.2rem 0", color: "var(--ink)" }}>{appt.doctor.name}</h2>
                    <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--brand)", fontWeight: 600 }}>{appt.doctor.specialization}</p>
                    <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
                      {fmtDate(appt.starts_at)} at {fmtTime(appt.starts_at)} · {appt.reason || "General consultation"}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <span className={`status-pill ${appt.status}`}>
                    {isPending ? "Awaiting Approval" : appt.status.toUpperCase()}
                  </span>

                  {isScheduled ? (
                    <Link className="btn primary join-consultation-btn-pulse" href={`/appointments/${appt.id}`}>
                      <Video size={16} />
                      <span>Join Call</span>
                    </Link>
                  ) : (
                    <Link className="btn ghost" href={`/appointments/${appt.id}`}>
                      <span>View Details</span>
                      <ArrowRight size={15} />
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}