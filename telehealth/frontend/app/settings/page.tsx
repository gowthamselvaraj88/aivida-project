"use client";

import { useEffect, useState } from "react";
import DoctorShell from "@/components/DoctorShell";
import { api, CURRENT_DOCTOR_ID } from "@/lib/api";
import { CheckCircle2 } from "lucide-react";

export default function SettingsPage() {
  const [online, setOnline] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    api.getDoctorDashboard(CURRENT_DOCTOR_ID).then((d) => setOnline(d.doctor.is_online));
  }, []);

  async function handleToggle(val: boolean) {
    setSaving(true);
    try {
      await api.updateDoctorStatus(CURRENT_DOCTOR_ID, val);
      setOnline(val);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } catch {
      // Handled
    } finally {
      setSaving(false);
    }
  }

  return (
    <DoctorShell>
      <main className="dashboard">
        <header className="page-heading">
          <p className="eyebrow">PRACTICE PREFERENCES</p>
          <h1>Settings</h1>
          <p className="muted">Manage your practice status and availability settings.</p>
        </header>

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>Doctor Availability Status (Database-backed)</h2>
            {savedNotice && (
              <span className="saved-badge">
                <CheckCircle2 size={16} /> Updated in Database
              </span>
            )}
          </div>
          <p className="muted small">
            This setting directly updates your status in the database so patients see your live online badge in the Patient Portal.
          </p>

          <div style={{ marginTop: "1rem", display: "flex", gap: "0.8rem" }}>
            <button
              className={`btn ${online ? "primary" : "ghost"}`}
              disabled={saving}
              onClick={() => handleToggle(true)}
            >
              ● Online (Available for Consultations)
            </button>
            <button
              className={`btn ${!online ? "primary" : "ghost"}`}
              disabled={saving}
              onClick={() => handleToggle(false)}
            >
              ○ Offline
            </button>
          </div>
        </section>
      </main>
    </DoctorShell>
  );
}