"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  LayoutDashboard,
  Pill,
  Users,
  Plus,
} from "lucide-react";
import { api, CURRENT_DOCTOR_ID, Doctor } from "@/lib/api";

const navigation = [
  { label: "Dashboard", href: "/", Icon: LayoutDashboard },
  { label: "Appointments", href: "/appointments", Icon: CalendarDays },
  { label: "Patients", href: "/patients", Icon: Users },
  { label: "Prescriptions", href: "/prescriptions", Icon: Pill },
];

export default function DoctorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [currentDoctor, setCurrentDoctor] = useState<Doctor | null>(null);

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

  // Load all doctors for quick selector and current doctor profile
  useEffect(() => {
    let cancelled = false;
    api.listDoctors()
      .then((docs) => {
        if (cancelled) return;
        setAllDoctors(docs);
        const active = docs.find((d) => d.id === doctorId) || docs[0];
        if (active) setCurrentDoctor(active);
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [doctorId]);

  // Listen for doctor change events
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

  const handleSelectDoctor = (newId: number) => {
    setDoctorId(newId);
    if (typeof window !== "undefined") {
      localStorage.setItem("aivida_doctor_id", String(newId));
      window.dispatchEvent(new Event("aivida_doctor_change"));
    }
    const matched = allDoctors.find((d) => d.id === newId);
    if (matched) setCurrentDoctor(matched);
  };

  const getInitials = (name: string) =>
    name
      .replace("Dr. ", "")
      .split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("");

  return (
    <div className="doctor-layout">
      {/* Top Sticky Navigation Header in AIvida Aesthetic */}
      <header className="doctor-header" role="banner">
        <div className="doctor-header-inner">
          <div className="doctor-header-left">
            {/* Logo & Brand with AIvida 4-Leaf Clover Emblem */}
            <Link className="doctor-brand" href="/" aria-label="AIvida Doctor Portal Home">
              <span className="doctor-aivida-clover" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="4" width="10" height="10" rx="5" fill="#00b074" />
                  <rect x="18" y="4" width="10" height="10" rx="5" fill="#00b074" opacity="0.82" />
                  <rect x="4" y="18" width="10" height="10" rx="5" fill="#00b074" opacity="0.88" />
                  <rect x="18" y="18" width="10" height="10" rx="5" fill="#00b074" />
                </svg>
              </span>
              <div className="doctor-brand-text-block">
                <span className="doctor-brand-title">AIvida</span>
                <span className="doctor-brand-subtitle">Clinical Portal</span>
              </div>
            </Link>

            {/* Navigation Links with Solid Emerald Active Pill */}
            <nav className="doctor-header-nav" aria-label="Main Doctor Navigation">
              {navigation.map(({ label, href, Icon }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`doctor-header-nav-link${active ? " active" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={16} strokeWidth={active ? 2.5 : 2.0} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Corner: Create Slot, Doctor Switcher & Doctor Profile */}
          <div className="doctor-header-right">
            {/* Action pill button */}
            <Link href="/#create-slot-section" className="header-action-pill-btn">
              <Plus size={15} strokeWidth={2.6} />
              <span>Create Slot</span>
            </Link>

            {/* Switch Doctor Dropdown */}
            {allDoctors.length > 1 && (
              <div className="doctor-switcher-pill">
                <label htmlFor="header-doctor-select" className="doctor-switcher-label">
                  Doctor:
                </label>
                <select
                  id="header-doctor-select"
                  value={doctorId}
                  onChange={(e) => handleSelectDoctor(Number(e.target.value))}
                  className="doctor-switcher-select"
                >
                  {allDoctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} ({doc.specialization.split("&")[0].trim()})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Doctor Profile Pill */}
            <section className="doctor-header-profile" aria-label="Doctor Profile">
              <div className="doctor-pill-avatar" aria-hidden="true">
                {currentDoctor ? getInitials(currentDoctor.name) : "DR"}
              </div>
              <div className="doctor-pill-info">
                <div className="doctor-pill-name-row">
                  <strong className="doctor-pill-name">
                    {currentDoctor?.name || "Dr. Hamsathvani Ilango"}
                  </strong>
                  <span
                    className="status-indicator-dot"
                    style={{
                      background: currentDoctor?.is_online ? "var(--brand)" : "#94a3b8",
                    }}
                    title={currentDoctor?.is_online ? "Online & Available" : "Offline"}
                  />
                </div>
                <span className="doctor-pill-meta">
                  {currentDoctor?.specialization?.split("&")[0]?.trim() || "Specialist"} · {currentDoctor?.is_online ? "Online" : "Offline"}
                </span>
              </div>
            </section>
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="doctor-main-content">
        <div className="doctor-content-wrap">
          {children}
        </div>
      </main>
    </div>
  );
}