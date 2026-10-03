"use client";
import { forwardRef, useState } from "react";
import { Pill, X, Check, AlertCircle } from "lucide-react";
import { api, Prescription } from "@/lib/api";

type Props = { appointmentId: string; onAdded: (p: Prescription) => void };

const PrescriptionDialog = forwardRef<HTMLDialogElement, Props>(({ appointmentId, onAdded }, ref) => {
  const empty = { medicine: "", dosage: "", frequency: "", duration: "", instructions: "" };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const close = () => (ref as React.RefObject<HTMLDialogElement>).current?.close();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const newRx = await api.addPrescription(appointmentId, form);
      onAdded(newRx);
      setForm(empty);
      close();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={ref}
      style={{
        border: "1px solid var(--card-border)",
        borderRadius: "18px",
        padding: "0",
        maxWidth: "520px",
        width: "92vw",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.25)",
        background: "#ffffff",
        outline: "none",
      }}
    >
      <form onSubmit={submit} style={{ padding: "1.8rem", display: "grid", gap: "1.2rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "var(--brand-light)", color: "var(--brand)", display: "grid", placeItems: "center" }}>
              <Pill size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.2rem", margin: 0, color: "var(--ink)" }}>Prescribe Medication</h2>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>Persists to patient electronic health record</p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            style={{ width: "32px", height: "32px", borderRadius: "50%", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", display: "grid", placeItems: "center", cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "grid", gap: "0.4rem" }}>
          <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ink)" }}>Medicine Name & Strength *</label>
          <input
            style={{ padding: "0.65rem 0.9rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.92rem", outline: "none" }}
            value={form.medicine}
            onChange={set("medicine")}
            placeholder="e.g. Amoxicillin 500mg, Paracetamol 650mg"
            required
          />
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "2px" }}>
            {["Paracetamol 650mg", "Amoxicillin 500mg", "Metformin 500mg", "Cetirizine 10mg", "Pantoprazole 40mg"].map((med) => (
              <button
                key={med}
                type="button"
                style={{ fontSize: "0.72rem", padding: "0.2rem 0.55rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#334155", cursor: "pointer" }}
                onClick={() => setForm((prev) => ({ ...prev, medicine: med }))}
              >
                + {med}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div style={{ display: "grid", gap: "0.4rem" }}>
            <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ink)" }}>Dosage *</label>
            <input
              style={{ padding: "0.65rem 0.9rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.92rem", outline: "none" }}
              value={form.dosage}
              onChange={set("dosage")}
              placeholder="e.g. 1 tablet, 5 ml"
              required
            />
          </div>

          <div style={{ display: "grid", gap: "0.4rem" }}>
            <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ink)" }}>Frequency</label>
            <input
              style={{ padding: "0.65rem 0.9rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.92rem", outline: "none" }}
              value={form.frequency}
              onChange={set("frequency")}
              placeholder="e.g. Twice daily, Once at night"
            />
            <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "2px" }}>
              {["1-0-1", "1-0-0", "0-0-1", "SOS"].map((freq) => (
                <button
                  key={freq}
                  type="button"
                  style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem", borderRadius: "4px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", cursor: "pointer" }}
                  onClick={() => setForm((prev) => ({ ...prev, frequency: freq }))}
                >
                  {freq}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: "0.4rem" }}>
          <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ink)" }}>Duration</label>
          <input
            style={{ padding: "0.65rem 0.9rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.92rem", outline: "none" }}
            value={form.duration}
            onChange={set("duration")}
            placeholder="e.g. 5 days, 2 weeks, 1 month"
          />
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "2px" }}>
            {["3 days", "5 days", "7 days", "14 days", "1 month"].map((dur) => (
              <button
                key={dur}
                type="button"
                style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem", borderRadius: "4px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", cursor: "pointer" }}
                onClick={() => setForm((prev) => ({ ...prev, duration: dur }))}
              >
                {dur}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: "0.4rem" }}>
          <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ink)" }}>Intake Instructions</label>
          <textarea
            rows={2}
            style={{ padding: "0.65rem 0.9rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.92rem", outline: "none", resize: "none" }}
            value={form.instructions}
            onChange={set("instructions")}
            placeholder="e.g. Take with warm water after food. Avoid dairy."
          />
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--danger)", fontSize: "0.85rem", background: "var(--danger-light)", padding: "0.5rem 0.8rem", borderRadius: "8px" }}>
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.8rem", paddingTop: "0.5rem", borderTop: "1px solid #f1f5f9" }}>
          <button type="button" className="btn ghost" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={saving}>
            <Check size={16} />
            <span>{saving ? "Saving to EHR…" : "Issue Prescription"}</span>
          </button>
        </div>
      </form>
    </dialog>
  );
});

PrescriptionDialog.displayName = "PrescriptionDialog";
export default PrescriptionDialog;
