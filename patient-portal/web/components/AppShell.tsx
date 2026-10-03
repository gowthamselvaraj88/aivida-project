"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  Home,
  Search,
  UserCheck,
} from "lucide-react";
import { api, Patient, initials, getStoredPatientId, setStoredPatientId } from "@/lib/api";

const navItems = [
  { label: "Home", href: "/", Icon: Home },
  { label: "Find Doctor", href: "/doctors", Icon: Search },
  { label: "My Appointments", href: "/appointments", Icon: CalendarDays },
];

export function AividaMark() {
  return <span className="aivida-mark" aria-hidden="true" />;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState<number>(() => getStoredPatientId());
  const [patient, setPatient] = useState<Patient | null>(null);

  // Load all patients from registry and active patient profile
  useEffect(() => {
    let cancelled = false;

    // Fetch all patients for switcher
    api<Patient[]>("/patients")
      .then((list) => {
        if (cancelled) return;
        setAllPatients(list);
        const active = list.find((p) => p.id === patientId) || list[0];
        if (active) setPatient(active);
      })
      .catch(() => {});

    // Also fetch specific active patient details
    api<Patient>(`/patient?id=${patientId}`)
      .then((p) => {
        if (!cancelled && p?.id) setPatient(p);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [patientId]);

  // Listen for patient change events across tabs or components
  useEffect(() => {
    const handlePatientChange = (e: Event) => {
      const custom = e as CustomEvent<{ id?: number }>;
      const newId = custom?.detail?.id ?? getStoredPatientId();
      if (newId && newId !== patientId) {
        setPatientId(newId);
      }
    };
    window.addEventListener("aivida_patient_change", handlePatientChange);
    return () => window.removeEventListener("aivida_patient_change", handlePatientChange);
  }, [patientId]);

  const handleSelectPatient = (newId: number) => {
    setPatientId(newId);
    setStoredPatientId(newId);
    const matched = allPatients.find((p) => p.id === newId);
    if (matched) {
      setPatient(matched);
    }
  };

  return (
    <div className="portal-shell">
      {/* Top Header Navigation (No Sidebar) */}
      <header className="portal-header" role="banner">
        <div className="portal-header-inner">
          <div className="header-left">
            {/* Logo & Brand */}
            <Link className="header-brand" href="/" aria-label="AIvida Patient Portal Home">
              <AividaMark />
              <div className="brand-text-block">
                <span className="brand-title">AIvida</span>
                <span className="brand-subtitle">Patient Care</span>
              </div>
            </Link>

            {/* Important Navigation Links */}
            <nav className="header-nav" aria-label="Main Navigation">
              {navItems.map(({ label, href, Icon }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={label}
                    href={href}
                    className={`header-nav-link${active ? " active" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={16} strokeWidth={2.2} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Corner: Patient Switcher & Profile */}
          <div className="header-right">
            {/* Patient Switcher Dropdown */}
            {allPatients.length > 1 && (
              <div className="patient-switcher-pill" title="Switch active patient profile">
                <label htmlFor="header-patient-select" className="patient-switcher-label">
                  PATIENT:
                </label>
                <select
                  id="header-patient-select"
                  value={patientId}
                  onChange={(e) => handleSelectPatient(Number(e.target.value))}
                  className="patient-switcher-select"
                  aria-label="Switch active patient"
                >
                  {allPatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.gender === "Female" ? "F" : "M"}, {p.age}y · Blood {p.blood_group || "—"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Patient Profile at Top Right Corner */}
            <section className="patient-header-profile" aria-label="Patient Profile">
              <div className="patient-pill-avatar" aria-hidden="true">
                {patient ? initials(patient.name) : "PT"}
              </div>
              <div className="patient-pill-info">
                <div className="patient-pill-name-row">
                  <strong className="patient-pill-name">
                    {patient?.name || "Patient"}
                  </strong>
                  <span className="status-indicator-dot" title="Online & Connected" />
                </div>
                <span className="patient-pill-meta">
                  {patient?.blood_group ? `Blood ${patient.blood_group}` : "Blood O+"} · Patient ID P-{patient ? String(patient.id).padStart(4, "0") : "0001"}
                </span>
              </div>
            </section>
          </div>
        </div>
      </header>

      {/* Main Page Content (Full width, Centered, No sidebar offset) */}
      <main className="portal-main">
        <div className="portal-content">
          {children}
        </div>
      </main>
    </div>
  );
}