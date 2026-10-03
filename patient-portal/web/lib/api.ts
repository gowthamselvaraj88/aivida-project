export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
export const WS_URL = API_BASE.replace(/^http/, "ws");

export type Doctor = {
  id: number;
  name: string;
  specialization: string;
  qualification: string;
  experience_years: number;
  city: string;
  fee: number;
  image_url: string;
  availability: string;
  is_online: boolean;
};

export type Slot = {
  id: number;
  doctor_id: number;
  starts_at: string;
  ends_at: string;
  booked: boolean;
  reason: string;
};

export type Patient = {
  id: number;
  name: string;
  email: string;
  phone: string;
  dob: string;
  age: number;
  gender: string;
  blood_group: string;
  allergies: string[];
  conditions: string[];
};

export type Appointment = {
  id: number;
  doctor_id: number;
  patient_id: number;
  slot_id: number | null;
  room_id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  status: "pending" | "scheduled" | "in_progress" | "completed" | "cancelled";
  notes: string;
  doctor: Doctor;
  patient: Patient;
};

export type Prescription = {
  id: number;
  appointment_id?: number | null;
  doctor_id: number;
  patient_id: number;
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  created_at: string;
  doctor_name?: string;
};

export type MedicalRecord = {
  id: number;
  patient_id: number;
  doctor_id: number;
  doctor_name: string;
  title: string;
  diagnosis: string;
  notes: string;
  record_date: string;
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("/api") ? path : `/api${path}`;
  const r = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(body.error || `Request failed (${r.status})`);
  }
  return body as T;
}

export const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

export const fmtTime = (s: string) =>
  new Date(s).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });

export const initials = (n: string) =>
  n
    .replace("Dr. ", "")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

export const DEFAULT_PATIENT_ID = 1;

export function getStoredPatientId(): number {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("aivida_patient_id");
    if (saved) {
      const val = Number(saved);
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return DEFAULT_PATIENT_ID;
}

export function setStoredPatientId(id: number) {
  if (typeof window !== "undefined") {
    localStorage.setItem("aivida_patient_id", String(id));
    window.dispatchEvent(new CustomEvent("aivida_patient_change", { detail: { id } }));
  }
}
