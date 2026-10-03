"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DoctorShell from "@/components/DoctorShell";
import { api, CURRENT_DOCTOR_ID, Patient } from "@/lib/api";
import { Search, UserCheck, ShieldAlert, Phone, Mail, Droplet } from "lucide-react";

export default function PatientsPage() {
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

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  // Listen for doctor change events from DoctorShell header dropdown
  useEffect(() => {
    const handleDoctorChange = () => {
      const saved = localStorage.getItem("aivida_doctor_id");
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val > 0) setDoctorId(val);
      }
    };
    window.addEventListener("aivida_doctor_change", handleDoctorChange);
    return () => window.removeEventListener("aivida_doctor_change", handleDoctorChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    api
      .getDoctorDashboard(doctorId)
      .then((data) => {
        if (cancelled) return;
        // Use all_patients returned directly by backend dashboard
        if (data.all_patients && Array.isArray(data.all_patients)) {
          setPatients(data.all_patients);
        } else {
          // Fallback aggregation across all available appointment sets
          const uniqueMap = new Map<number, Patient>();
          for (const a of [
            ...(data.today_appointments || []),
            ...(data.upcoming_appointments || []),
            ...(data.pending_requests || []),
          ]) {
            if (a.patient?.id) {
              uniqueMap.set(a.patient.id, a.patient);
            }
          }
          setPatients(Array.from(uniqueMap.values()));
        }
      })
      .catch((reason) => {
        if (!cancelled) setError((reason as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [doctorId]);

  const filteredPatients = patients.filter((p) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.phone?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.blood_group?.toLowerCase().includes(q) ||
      p.conditions?.some((c) => c.toLowerCase().includes(q))
    );
  });

  return (
    <DoctorShell>
      <main className="dashboard">
        <header className="page-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1.2rem" }}>
          <div>
            <p className="eyebrow">PRACTICE REGISTRY</p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.25rem" }}>
              <h1 style={{ margin: 0 }}>Patients</h1>
              <span className="count-badge">
                {patients.length} total
              </span>
            </div>
            <p className="muted" style={{ marginTop: "0.35rem" }}>
              All patients with current, upcoming, or past consultations in your clinical workspace.
            </p>
          </div>

          {/* Quick search input */}
          <div className="patient-search-wrap">
            <Search size={16} className="patient-search-icon" />
            <input
              type="search"
              placeholder="Search by name, phone, blood..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="patient-search-input"
            />
          </div>
        </header>

        {error ? (
          <p className="alert error-alert" role="alert">
            {error}
          </p>
        ) : loading ? (
          <section className="dashboard-section">
            <p className="empty-state">Loading practice registry...</p>
          </section>
        ) : filteredPatients.length === 0 ? (
          <section className="dashboard-section" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
            <p className="empty-state">
              {query ? `No patients match "${query}"` : "No patients in practice registry yet."}
            </p>
          </section>
        ) : (
          <div className="patient-list">
            {filteredPatients.map((patient) => {
              const initials = patient.name
                ? patient.name
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                : "PT";

              return (
                <article key={patient.id} className="patient-card">
                  {/* Column 1: Identity */}
                  <div className="patient-col-identity">
                    <div className="patient-avatar-box" aria-hidden="true">
                      {initials}
                    </div>

                    <div className="patient-identity-details">
                      <strong className="patient-name-title">
                        {patient.name}
                      </strong>
                      <div className="patient-demographics-text">
                        <span>{patient.age}y · {patient.gender}</span>
                        <span className="patient-id-tag">P-{String(patient.id).padStart(4, "0")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Contact & Clinical Profile */}
                  <div className="patient-col-clinical">
                    <div className="patient-contact-row">
                      {patient.phone && (
                        <span className="patient-contact-item">
                          <Phone size={12} style={{ color: "var(--brand)" }} />
                          <span>{patient.phone}</span>
                        </span>
                      )}
                      {patient.email && (
                        <span className="patient-contact-item">
                          <Mail size={12} style={{ color: "var(--brand)" }} />
                          <span>{patient.email}</span>
                        </span>
                      )}
                    </div>

                    <div className="patient-clinical-tags-row">
                      {patient.blood_group && (
                        <span className="patient-blood-badge">
                          <Droplet size={11} /> Blood {patient.blood_group}
                        </span>
                      )}

                      {patient.conditions?.map((c, i) => (
                        <span key={i} className="patient-condition-chip">
                          {c}
                        </span>
                      ))}

                      {patient.allergies?.map((a, i) => (
                        <span key={i} className="patient-allergy-chip">
                          <ShieldAlert size={11} /> {a}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Column 3: Action */}
                  <div className="patient-col-action">
                    <Link
                      className="btn ghost small"
                      href={`/patient/${patient.id}`}
                      style={{
                        whiteSpace: "nowrap",
                        padding: "0.55rem 1.15rem",
                        borderRadius: "999px",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                      }}
                    >
                      Patient details
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </DoctorShell>
  );
}