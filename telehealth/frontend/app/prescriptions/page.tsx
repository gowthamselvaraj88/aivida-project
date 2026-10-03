"use client";

import { useEffect, useState } from "react";
import DoctorShell from "@/components/DoctorShell";
import { api, CURRENT_DOCTOR_ID, Prescription } from "@/lib/api";
import { Pill, Clock, Calendar, FileText } from "lucide-react";

export default function PrescriptionsPage() {
  const [rows, setRows] = useState<Prescription[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get all completed/active appointments to fetch prescriptions
    api
      .getDoctorDashboard(CURRENT_DOCTOR_ID)
      .then(async (data) => {
        const apptIds = [
          1, // Past consultation seeded with prescriptions
          ...data.today_appointments.map((a) => a.id),
          ...data.upcoming_appointments.map((a) => a.id),
        ];
        const allRx = await Promise.all(
          apptIds.map((id) => api.getPrescriptions(id).catch(() => [] as Prescription[]))
        );
        setRows(allRx.flat());
      })
      .catch((reason) => setError((reason as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DoctorShell>
      <main className="dashboard">
        <header className="page-heading">
          <p className="eyebrow">MEDICATION REGISTRY</p>
          <h1>Prescriptions</h1>
          <p className="muted">Medications issued during completed and active consultations.</p>
        </header>

        {error && (
          <p className="alert error-alert" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <section className="dashboard-section">
            <p className="empty-state">Loading prescription records...</p>
          </section>
        ) : rows.length === 0 ? (
          <section className="dashboard-section">
            <p className="empty-state">No prescriptions have been issued yet.</p>
          </section>
        ) : (
          <div className="prescription-list">
            {rows.map((rx) => (
              <article key={rx.id} className="prescription-card">
                <div className="rx-icon-box" aria-hidden="true">
                  <Pill size={22} strokeWidth={2.2} />
                </div>

                <div className="rx-content">
                  <div className="rx-header">
                    <div className="rx-title-group">
                      <strong className="rx-medicine-name">{rx.medicine}</strong>
                      {rx.dosage && (
                        <span className="rx-dosage-badge">{rx.dosage}</span>
                      )}
                    </div>
                    <span className="rx-date-tag">
                      <Calendar size={13} />
                      <span>
                        Prescribed on{" "}
                        {new Date(rx.created_at).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </span>
                  </div>

                  <div className="rx-meta-row">
                    {rx.frequency && (
                      <span className="rx-meta-pill">
                        <Clock size={13} style={{ color: "var(--brand)" }} />
                        <span>{rx.frequency}</span>
                      </span>
                    )}
                    {rx.duration && (
                      <span className="rx-meta-pill">
                        <Calendar size={13} style={{ color: "#3b82f6" }} />
                        <span>{rx.duration}</span>
                      </span>
                    )}
                  </div>

                  {rx.instructions && (
                    <div className="rx-instructions-box">
                      <FileText size={14} style={{ color: "var(--brand)", flexShrink: 0, marginTop: "2px" }} />
                      <div>
                        <strong className="rx-instructions-label">Instructions: </strong>
                        <span>{rx.instructions}</span>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </DoctorShell>
  );
}