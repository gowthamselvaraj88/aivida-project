"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Mic, MicOff, PhoneOff, Video, VideoOff, X } from "lucide-react";
import { api, PortalAppointment } from "@/lib/api";
import { useCall } from "@/lib/useCall";
import VideoTile from "@/components/VideoTile";

const PATIENT_PORTAL_URL = process.env.NEXT_PUBLIC_PATIENT_PORTAL_URL ?? "http://localhost:3001";

function PortalConsultation() {
  const { id } = useParams<{ id: string }>();
  const appointmentId = Number(id);
  const role = useSearchParams().get("role") === "patient" ? "patient" : "doctor";
  const router = useRouter();
  const [appointment, setAppointment] = useState<PortalAppointment | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const markedInProgress = useRef(false);

  useEffect(() => {
    if (!Number.isInteger(appointmentId) || appointmentId < 1) {
      setError("Invalid appointment link.");
      return;
    }
    api.portalAppointment(appointmentId).then(setAppointment).catch((reason) => setError((reason as Error).message));
  }, [appointmentId]);

  useEffect(() => {
    if (!appointment || ["completed", "cancelled"].includes(appointment.status)) return;
    const timer = window.setInterval(() => {
      api.portalAppointment(appointmentId).then(setAppointment).catch(() => {});
    }, 3000);
    return () => window.clearInterval(timer);
  }, [appointment?.status, appointmentId]);

  const canJoin = appointment && ["scheduled", "in_progress"].includes(appointment.status);
  const call = useCall(canJoin ? appointment.room_id : null);

  useEffect(() => {
    if (call.status !== "live" || markedInProgress.current) return;
    markedInProgress.current = true;
    api.setPortalAppointmentStatus(appointmentId, "in_progress")
      .then(() => setAppointment((current) => current && { ...current, status: "in_progress" }))
      .catch(() => {});
  }, [appointmentId, call.status]);

  async function review(decision: "accept" | "decline") {
    setBusy(true);
    setError("");
    try {
      if (decision === "accept") await api.acceptPortalAppointment(appointmentId);
      else await api.declinePortalAppointment(appointmentId);
      setAppointment(await api.portalAppointment(appointmentId));
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function leaveCall() {
    call.hangUp();
    if (role === "doctor") {
      await api.setPortalAppointmentStatus(appointmentId, "completed").catch(() => {});
      router.push("/");
    } else {
      window.location.href = `${PATIENT_PORTAL_URL}/appointments/${appointmentId}`;
    }
  }

  if (error && !appointment) return <main className="page"><p className="error" role="alert">{error}</p></main>;
  if (!appointment) return <main className="page"><p className="muted">Loading consultation...</p></main>;
  if (appointment.status === "pending") return (
    <main className="page portal-call-pending">
      <a className="btn ghost" href={role === "doctor" ? "/" : `${PATIENT_PORTAL_URL}/appointments/${appointmentId}`}><ArrowLeft size={17} />Back</a>
      <section className="panel">
        <p className="eyebrow">CONSULTATION REQUEST</p>
        <h1>{appointment.patient_name}</h1>
        <p className="muted">{appointment.doctor_name} · {appointment.specialization} · {new Date(appointment.starts_at).toLocaleString()}</p>
        {role === "doctor" ? (
          <div className="controls">
            <button className="btn primary" disabled={busy} onClick={() => review("accept")}><Check size={17} />Accept request</button>
            <button className="btn ghost" disabled={busy} onClick={() => review("decline")}><X size={17} />Decline</button>
          </div>
        ) : <p className="muted">Your request is waiting for the doctor to accept it.</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>
    </main>
  );
  if (appointment.status === "cancelled") return <main className="page"><p className="muted">This consultation request was declined.</p></main>;
  if (appointment.status === "completed") return <main className="page"><p className="muted">This consultation has ended.</p></main>;

  const statusText = {
    connecting: "Starting camera and microphone...",
    waiting: `Waiting for the ${role === "doctor" ? "patient" : "doctor"} to join`,
    live: "In consultation",
    ended: "Call ended",
    error: call.error ?? "Connection problem",
  }[call.status];

  return (
    <main className="portal-call-page">
      <header className="portal-call-header">
        <div><p className="eyebrow">AIVIDA SECURE VIDEO VISIT</p><h1>{appointment.doctor_name || appointment.doctor.name} and {appointment.patient_name || appointment.patient.name}</h1></div>
        <span className={`pill ${call.status}`} role="status">{statusText}</span>
      </header>
      <section className="portal-call-stage">
        <VideoTile stream={role === "doctor" ? call.localStream : call.remoteStream} label={appointment.doctor_name || appointment.doctor.name} local={role === "doctor"} off={role === "doctor" && call.cameraOff} placeholder={role === "doctor" ? "Your camera is off" : "Doctor is connecting"} />
        <VideoTile stream={role === "patient" ? call.localStream : call.remoteStream} label={appointment.patient_name || appointment.patient.name} local={role === "patient"} off={role === "patient" && call.cameraOff} placeholder={role === "patient" ? "Your camera is off" : "Patient is connecting"} />
      </section>
      {call.error && <p className="error" role="alert">{call.error}</p>}
      <footer className="portal-call-controls" aria-label="Call controls">
        <button className={`btn ctl ${call.muted ? "active" : ""}`} onClick={call.toggleMute} aria-label={call.muted ? "Unmute microphone" : "Mute microphone"} aria-pressed={call.muted}>{call.muted ? <MicOff size={19} /> : <Mic size={19} />}</button>
        <button className={`btn ctl ${call.cameraOff ? "active" : ""}`} onClick={call.toggleCamera} aria-label={call.cameraOff ? "Turn camera on" : "Turn camera off"} aria-pressed={call.cameraOff}>{call.cameraOff ? <VideoOff size={19} /> : <Video size={19} />}</button>
        <button className="btn end" onClick={leaveCall}><PhoneOff size={18} />{role === "doctor" ? "End consultation" : "Leave consultation"}</button>
      </footer>
    </main>
  );
}

export default function Page() {
  return <Suspense fallback={<main className="page"><p className="muted">Loading consultation...</p></main>}><PortalConsultation /></Suspense>;
}