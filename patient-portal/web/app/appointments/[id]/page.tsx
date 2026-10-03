"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
  AlertCircle,
  CheckCircle2,
  Hourglass,
  Sparkles,
} from "lucide-react";
import { api, Appointment, fmtDate, fmtTime, initials } from "@/lib/api";
import { useCall } from "@/lib/useCall";
import VideoTile from "@/components/VideoTile";

export default function AppointmentConsultationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [appt, setAppt] = useState<Appointment | null>(null);
  const [error, setError] = useState("");
  const [inCall, setInCall] = useState(false);

  // Poll appointment state (especially when pending or scheduled)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api<Appointment>(`/appointments/${id}`);
        if (!cancelled) setAppt(data);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    }
    load();

    const interval = window.setInterval(load, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [id]);

  // Hook WebRTC connection once inCall is active
  const call = useCall(
    inCall && appt && ["scheduled", "in_progress"].includes(appt.status)
      ? appt.room_id
      : null
  );

  // Leave consultation
  const handleLeaveCall = () => {
    call.hangUp();
    setInCall(false);
  };

  if (error) {
    return (
      <div className="appointment-page-wrap">
        <div className="alert error-alert" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
        <Link className="btn ghost" href="/">
          <ArrowLeft size={16} /> Return to Dashboard
        </Link>
      </div>
    );
  }

  if (!appt) {
    return (
      <div className="appointment-page-wrap">
        <p className="muted">Loading appointment and consultation details from database...</p>
      </div>
    );
  }

  const isPending = appt.status === "pending";
  const isScheduled = appt.status === "scheduled" || appt.status === "in_progress";
  const isCompleted = appt.status === "completed";
  const isCancelled = appt.status === "cancelled";

  // If inCall is active, show the Video Call Interface
  if (inCall && isScheduled) {
    const statusText = {
      connecting: "Establishing video connection with server...",
      waiting: `Waiting for ${appt.doctor.name} to join consultation room`,
      live: "Live Video Consultation",
      ended: "Call ended",
      error: call.error ?? "Connection problem",
    }[call.status];

    return (
      <main className="video-consultation-screen">
        <header className="video-consultation-header">
          <div className="header-info">
            <p className="eyebrow">SCREEN 3 · LIVE VIDEO CONSULTATION</p>
            <h1>Consultation with {appt.doctor.name}</h1>
            <p className="small muted">
              {appt.doctor.specialization} · Appointment #{appt.id}
            </p>
          </div>
          <span className={`status-pill ${call.status}`}>
            <span className="live-dot" />
            <span>{statusText}</span>
          </span>
        </header>

        {/* Video Call Stage (Doctor + Patient) */}
        <div className="video-consultation-stage">
          {/* Doctor Video Feed (Remote) */}
          <VideoTile
            stream={call.remoteStream}
            label={`${appt.doctor.name}`}
            local={false}
            off={false}
            placeholder={
              call.status === "live"
                ? "Doctor video is paused"
                : `Waiting for ${appt.doctor.name} to enter room...`
            }
          />

          {/* Patient Video Feed (Local) */}
          <VideoTile
            stream={call.localStream}
            label={`${appt.patient.name} (You)`}
            local={true}
            off={call.cameraOff}
            placeholder="Your camera is turned off"
          />
        </div>

        {call.error && (
          <div className="alert error-alert" style={{ margin: "0.8rem 0" }}>
            <AlertCircle size={16} />
            <span>{call.error}</span>
          </div>
        )}

        {/* Video Controls: Mute / Camera / End Call */}
        <footer className="video-controls-bar">
          <button
            className={`btn ctl-btn ${call.muted ? "ctl-active" : ""}`}
            type="button"
            onClick={call.toggleMute}
            aria-pressed={call.muted}
          >
            {call.muted ? <MicOff size={18} /> : <Mic size={18} />}
            <span>{call.muted ? "Unmute" : "Mute"}</span>
          </button>

          <button
            className={`btn ctl-btn ${call.cameraOff ? "ctl-active" : ""}`}
            type="button"
            onClick={call.toggleCamera}
            aria-pressed={call.cameraOff}
          >
            {call.cameraOff ? <VideoOff size={18} /> : <Video size={18} />}
            <span>{call.cameraOff ? "Turn Video On" : "Turn Video Off"}</span>
          </button>

          <button
            className="btn end-btn"
            type="button"
            onClick={handleLeaveCall}
          >
            <PhoneOff size={18} />
            <span>End Call</span>
          </button>
        </footer>
      </main>
    );
  }

  // Pre-Call / Appointment Status View
  return (
    <div className="appointment-page-wrap">
      <button className="btn ghost back-btn" onClick={() => router.push("/")}>
        <ArrowLeft size={16} />
        <span>Back to Dashboard</span>
      </button>

      <section className="appointment-card-full">
        {/* Doctor Details Header */}
        <div className="appointment-doctor-header">
          <div className="doctor-avatar-medium">{initials(appt.doctor.name)}</div>
          <div className="doctor-header-copy">
            <p className="eyebrow">SCREEN 3 · APPOINTMENT & CONSULTATION</p>
            <h1>{appt.doctor.name}</h1>
            <p className="doctor-specialty-line">
              {appt.doctor.specialization} · {appt.doctor.qualification} · {appt.doctor.city}
            </p>
          </div>
          <div className="status-badge-wrap">
            <span className={`status-pill ${appt.status}`}>
              {appt.status === "pending"
                ? "Pending Doctor Approval"
                : appt.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Interactive 4-Step Consultation Stepper */}
        <div className="stepper-container" aria-label="Consultation Status Steps">
          <div className="step-connector">
            <div
              className="step-connector-progress"
              style={{
                width: isCompleted ? "100%" : isScheduled ? "70%" : isPending ? "35%" : "10%",
              }}
            />
          </div>

          <div className="step-item completed">
            <div className="step-circle">
              <CheckCircle2 size={18} />
            </div>
            <span className="step-label">1. Request Sent</span>
          </div>

          <div className={`step-item ${isScheduled || isCompleted ? "completed" : isPending ? "active" : ""}`}>
            <div className="step-circle">
              {isScheduled || isCompleted ? <CheckCircle2 size={18} /> : <Hourglass size={18} />}
            </div>
            <span className="step-label">2. Doctor Review</span>
          </div>

          <div className={`step-item ${isScheduled || isCompleted ? "completed" : ""}`}>
            <div className="step-circle">
              {isScheduled || isCompleted ? <CheckCircle2 size={18} /> : 3}
            </div>
            <span className="step-label">3. Confirmed</span>
          </div>

          <div className={`step-item ${inCall ? "active" : isCompleted ? "completed" : ""}`}>
            <div className="step-circle">
              <Video size={18} />
            </div>
            <span className="step-label">4. Video Visit</span>
          </div>
        </div>

        {/* Appointment Date & Time & Reason */}
        <div className="appointment-time-box">
          <div className="time-item">
            <Calendar size={18} className="time-icon" />
            <div>
              <span className="muted small">Consultation Date</span>
              <strong>{fmtDate(appt.starts_at)}</strong>
            </div>
          </div>

          <div className="time-item">
            <Clock size={18} className="time-icon" />
            <div>
              <span className="muted small">Scheduled Time</span>
              <strong>{fmtTime(appt.starts_at)}</strong>
            </div>
          </div>

          <div className="time-item">
            <Sparkles size={18} className="time-icon" />
            <div>
              <span className="muted small">Reason for Visit</span>
              <strong>{appt.reason || "General consultation"}</strong>
            </div>
          </div>
        </div>

        {/* Status Context Messages & Action Button */}
        {isPending && (
          <div className="status-notification-box pending-box">
            <Hourglass size={24} className="icon-pending" style={{ animation: "pulse-dot 2s infinite" }} />
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: "0 0 0.35rem 0", color: "#92400e" }}>Awaiting Doctor Review & Approval</h3>
              <p className="muted small" style={{ margin: "0 0 0.6rem 0" }}>
                Your request has been delivered to <strong>{appt.doctor.name}</strong>. Once the doctor accepts, this screen will automatically transition to Confirmed and unlock your secure HD video room.
              </p>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(245, 158, 11, 0.15)", padding: "0.35rem 0.75rem", borderRadius: "6px", fontSize: "0.8rem", color: "#b45309" }}>
                <span>Simulating Doctor? Open </span>
                <a href="http://localhost:3000" target="_blank" rel="noreferrer" style={{ fontWeight: 700, textDecoration: "underline", color: "#92400e" }}>
                  Doctor Portal (:3000)
                </a>
                <span> and switch view to {appt.doctor.name} to Accept.</span>
              </div>
            </div>
          </div>
        )}

        {isScheduled && (
          <div className="status-notification-box scheduled-box">
            <CheckCircle2 size={24} className="icon-scheduled" />
            <div className="scheduled-copy">
              <h3>Your appointment is confirmed!</h3>
              <p className="muted small">
                Click below to start your encrypted video consultation with {appt.doctor.name}.
              </p>
            </div>
            <button
              className="btn primary join-consultation-btn join-consultation-btn-pulse"
              type="button"
              onClick={() => setInCall(true)}
            >
              <Video size={18} />
              <span>Join Video Consultation</span>
            </button>
          </div>
        )}

        {isCompleted && (
          <div className="status-notification-box completed-box">
            <CheckCircle2 size={24} className="icon-completed" />
            <div>
              <h3>This consultation has concluded.</h3>
              <p className="muted small">
                Clinical notes and prescriptions issued by the doctor are recorded in your medical history.
              </p>
              <Link className="btn ghost small" href="/" style={{ marginTop: "0.8rem", display: "inline-block" }}>
                Return to Dashboard
              </Link>
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="status-notification-box cancelled-box">
            <AlertCircle size={24} className="icon-cancelled" />
            <div>
              <h3>This consultation request was declined.</h3>
              <p className="muted small">
                Please browse available slots to schedule another convenient time.
              </p>
              <Link className="btn primary small" href="/doctors" style={{ marginTop: "0.8rem", display: "inline-block" }}>
                Find Another Doctor / Slot
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
