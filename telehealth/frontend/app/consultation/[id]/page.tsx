"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, Appointment, Prescription } from "@/lib/api";
import { useCall } from "@/lib/useCall";
import VideoTile from "@/components/VideoTile";
import PrescriptionDialog from "@/components/PrescriptionDialog";
import {
  Mic,
  MicOff,
  PhoneOff,
  Plus,
  Video,
  VideoOff,
  ShieldAlert,
  FileText,
  Pill,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export default function DoctorConsultationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [appt, setAppt] = useState<Appointment | null>(null);
  const [loadError, setLoadError] = useState("");
  const [notes, setNotes] = useState("");
  const [noteState, setNoteState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const skipFirstSave = useRef(true);
  const markedInProgress = useRef(false);

  // Load appointment and prescriptions from DB
  useEffect(() => {
    let cancelled = false;
    api
      .getAppointment(id)
      .then((a) => {
        if (!cancelled) {
          setAppt(a);
          setNotes(a.notes || "");
        }
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message);
      });

    api
      .getPrescriptions(id)
      .then((rx) => {
        if (!cancelled) setPrescriptions(rx);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Connect WebRTC call with appointment room_id
  const call = useCall(
    appt && ["scheduled", "in_progress"].includes(appt.status) ? appt.room_id : null
  );

  // Mark appointment in_progress in DB once live
  useEffect(() => {
    if (call.status !== "live" || markedInProgress.current || !appt) return;
    markedInProgress.current = true;
    api
      .setAppointmentStatus(id, "in_progress")
      .then(() => setAppt((prev) => (prev ? { ...prev, status: "in_progress" } : null)))
      .catch(() => {});
  }, [call.status, id, appt]);

  // Auto-save clinical notes to database with debounce
  useEffect(() => {
    if (!appt) return;
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    setNoteState("saving");
    const timer = setTimeout(() => {
      api
        .saveNotes(id, notes)
        .then(() => setNoteState("saved"))
        .catch(() => setNoteState("error"));
    }, 700);

    return () => clearTimeout(timer);
  }, [notes, id, appt]);

  // Track elapsed call time
  useEffect(() => {
    if (call.status !== "live") return;
    const timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [call.status]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  async function handleEndCall() {
    call.hangUp();
    try {
      await api.endAppointment(id);
    } catch {
      // Handled
    }
    router.push("/");
  }

  if (loadError) {
    return (
      <main className="consult-loading-page">
        <div className="alert error-alert">
          <AlertCircle size={20} />
          <span>{loadError}</span>
        </div>
        <button className="btn ghost" onClick={() => router.push("/")}>
          <ArrowLeft size={16} /> Return to Dashboard
        </button>
      </main>
    );
  }

  if (!appt) {
    return (
      <main className="consult-loading-page">
        <p className="muted">Establishing secure consultation session from database...</p>
      </main>
    );
  }

  const statusLabel = {
    connecting: "Initializing encrypted media stream...",
    waiting: "Waiting for patient to join consultation room",
    live: "Live Video Consultation",
    ended: "Consultation call ended",
    error: call.error ?? "Connection encountered an issue",
  }[call.status];

  return (
    <div className="consult-workspace">
      {/* Left Stage Column: Video Call & Controls */}
      <section className="stage-column">
        <header className="stage-header">
          <div className="stage-title-wrap">
            <button className="back-mini-btn" onClick={() => router.push("/")} title="Back to Dashboard">
              <ArrowLeft size={16} />
            </button>
            <div>
              <p className="eyebrow">AIVIDA ENCRYPTED TELEHEALTH SESSION</p>
              <h1>Consultation with {appt.patient.name}</h1>
            </div>
          </div>

          <div className="stage-status-bar" style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
            {call.status === "live" && (
              <span className="call-timer-badge">
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", animation: "pulse-ring 2s infinite" }} />
                <span>{formatTimer(elapsedSeconds)}</span>
              </span>
            )}
            <span className={`status-pill ${call.status}`} role="status">
              <span className="live-dot" />
              <span>{statusLabel}</span>
            </span>
          </div>
        </header>

        {/* Video Viewport Stage */}
        <div className="video-stage">
          {/* Doctor Video Tile (Local) */}
          <VideoTile
            stream={call.localStream}
            label={`${appt.doctor.name} (You)`}
            local={true}
            off={call.cameraOff}
            placeholder="Your camera is turned off"
          />

          {/* Patient Video Tile (Remote) */}
          <VideoTile
            stream={call.remoteStream}
            label={appt.patient.name}
            local={false}
            off={false}
            placeholder={
              call.status === "live"
                ? "Patient camera feed paused"
                : "Waiting for patient to join..."
            }
          />
        </div>

        {call.error && (
          <div className="call-error-alert" role="alert">
            <AlertCircle size={16} />
            <span>{call.error}</span>
          </div>
        )}

        {/* Media Call Controls */}
        <footer className="call-controls-bar" aria-label="Consultation call controls">
          <button
            className={`btn ctl-btn ${call.muted ? "ctl-active" : ""}`}
            onClick={call.toggleMute}
            aria-pressed={call.muted}
            title={call.muted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {call.muted ? <MicOff size={19} /> : <Mic size={19} />}
            <span>{call.muted ? "Unmute" : "Mute"}</span>
          </button>

          <button
            className={`btn ctl-btn ${call.cameraOff ? "ctl-active" : ""}`}
            onClick={call.toggleCamera}
            aria-pressed={call.cameraOff}
            title={call.cameraOff ? "Turn Camera On" : "Turn Camera Off"}
          >
            {call.cameraOff ? <VideoOff size={19} /> : <Video size={19} />}
            <span>{call.cameraOff ? "Start Video" : "Stop Video"}</span>
          </button>

          <button className="btn end-call-btn" onClick={handleEndCall} title="End Consultation">
            <PhoneOff size={18} />
            <span>End Call</span>
          </button>
        </footer>
      </section>

      {/* Right Sidebar: Patient Information, Live Notes, Add Prescription */}
      <aside className="consult-sidebar">
        {/* Patient Basic Information */}
        <section className="side-card consult-patient-card">
          <div className="side-card-header">
            <div className="patient-avatar-mini" aria-hidden="true">
              {appt.patient.name
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="patient-header-details">
              <h2>{appt.patient.name}</h2>
              <p className="patient-meta-row">
                <span>{appt.patient.age}y</span>
                <span>·</span>
                <span>{appt.patient.gender}</span>
                <span>·</span>
                <span className="blood-tag-mini">Blood {appt.patient.blood_group || "—"}</span>
              </p>
            </div>
          </div>

          <dl className="side-facts-list">
            <dt>Phone</dt>
            <dd>{appt.patient.phone}</dd>

            <dt>Email</dt>
            <dd className="ellipsis">{appt.patient.email}</dd>

            <dt>Allergies</dt>
            <dd>
              {appt.patient.allergies.length ? (
                appt.patient.allergies.map((a) => (
                  <span key={a} className="tag tag-warn small">
                    {a}
                  </span>
                ))
              ) : (
                <span className="muted small">None recorded</span>
              )}
            </dd>

            <dt>Conditions</dt>
            <dd>
              {appt.patient.conditions.length ? (
                appt.patient.conditions.map((c) => (
                  <span key={c} className="tag tag-info small">
                    {c}
                  </span>
                ))
              ) : (
                <span className="muted small">None recorded</span>
              )}
            </dd>
          </dl>
        </section>

        {/* Live Consultation Notes Section */}
        <section className="side-card notes-card">
          <div className="side-card-header between">
            <div className="card-title">
              <FileText size={17} />
              <h2>Consultation Notes</h2>
            </div>
            <span className="auto-save-indicator small">
              {noteState === "saving" && "Saving to DB..."}
              {noteState === "saved" && (
                <span className="saved-text">
                  <CheckCircle2 size={13} /> Saved
                </span>
              )}
              {noteState === "error" && <span className="error-text">Save failed</span>}
            </span>
          </div>

          <textarea
            id="consultation-notes"
            className="consult-notes-area"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Clinical notes: symptoms, exam observations, diagnosis, treatment recommendations..."
          />
        </section>

        {/* Add Prescription Option & Live DB List */}
        <section className="side-card prescriptions-card">
          <div className="side-card-header between">
            <div className="card-title">
              <Pill size={17} />
              <h2>Prescriptions ({prescriptions.length})</h2>
            </div>
            <button
              className="btn primary mini-btn"
              type="button"
              onClick={() => dialogRef.current?.showModal()}
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          </div>

          {prescriptions.length === 0 ? (
            <div className="empty-rx-box">
              <p className="muted small">No medications prescribed in this session yet.</p>
              <button
                className="btn ghost mini-btn"
                type="button"
                onClick={() => dialogRef.current?.showModal()}
              >
                + Add Medication
              </button>
            </div>
          ) : (
            <ul className="side-rx-list">
              {prescriptions.map((rx) => (
                <li key={rx.id} className="side-rx-item">
                  <div className="side-rx-main">
                    <strong>{rx.medicine}</strong>
                    <span className="rx-dosage-badge">{rx.dosage}</span>
                  </div>
                  <p className="small muted">
                    {[rx.frequency, rx.duration].filter(Boolean).join(" · ")}
                  </p>
                  {rx.instructions && (
                    <p className="small rx-instruction-text">{rx.instructions}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Prescription Dialog Modal */}
        <PrescriptionDialog
          ref={dialogRef}
          appointmentId={String(appt.id)}
          onAdded={(newRx) => setPrescriptions((prev) => [...prev, newRx])}
        />
      </aside>
    </div>
  );
}
