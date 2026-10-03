export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
export const WS_URL = API.replace(/^http/, "ws");
export const CURRENT_DOCTOR_ID = 1;
export const DEMO_DOCTOR_ID = CURRENT_DOCTOR_ID;
export const DEMO_PORTAL_DOCTOR_ID = CURRENT_DOCTOR_ID;

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
  doctor_name?: string;
  patient_name?: string;
  specialization?: string;
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

export type DoctorDashboardData = {
  doctor: Doctor;
  today_appointments: Appointment[];
  upcoming_appointments: Appointment[];
  pending_requests: Appointment[];
  all_patients?: Patient[];
  total_patients: number;
  today_count: number;
  upcoming_count: number;
  pending_count: number;
};

export type PatientDetailsData = {
  patient: Patient;
  consultation?: Appointment;
  history: Appointment[];
  prescriptions: Prescription[];
  records: MedicalRecord[];
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }
  return body as T;
}

export const api = {
  listDoctors: () => req<Doctor[]>("/api/doctors"),

  getDoctorDashboard: (doctorId: number = CURRENT_DOCTOR_ID) =>
    req<DoctorDashboardData>(`/api/doctors/${doctorId}/dashboard`),

  updateDoctorStatus: (doctorId: number, isOnline: boolean) =>
    req<{ id: number; is_online: boolean }>(`/api/doctors/${doctorId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ is_online: isOnline }),
    }),

  createSlot: (doctorId: number, startsAt: string, durationMin: number, reason: string) =>
    req<{ id: number }>(`/api/doctors/${doctorId}/slots`, {
      method: "POST",
      body: JSON.stringify({ starts_at: startsAt, duration_min: durationMin, reason }),
    }),

  getPatientDetails: (id: string | number) =>
    req<PatientDetailsData>(`/api/patients/${id}/details`),

  getAppointment: (id: string | number) =>
    req<Appointment>(`/api/appointments/${id}`),

  acceptAppointment: (id: string | number) =>
    req<{ accepted: boolean }>(`/api/appointments/${id}/accept`, { method: "POST" }),

  declineAppointment: (id: string | number) =>
    req<{ declined: boolean }>(`/api/appointments/${id}/decline`, { method: "POST" }),

  setAppointmentStatus: (id: string | number, status: "scheduled" | "in_progress" | "completed") =>
    req<{ status: string }>(`/api/appointments/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  saveNotes: (id: string | number, notes: string) =>
    req<{ saved: boolean }>(`/api/appointments/${id}/notes`, {
      method: "PUT",
      body: JSON.stringify({ notes }),
    }),

  getPrescriptions: (appointmentId: string | number) =>
    req<Prescription[]>(`/api/appointments/${appointmentId}/prescriptions`),

  addPrescription: (
    appointmentId: string | number,
    data: { medicine: string; dosage: string; frequency?: string; duration?: string; instructions?: string }
  ) =>
    req<Prescription>(`/api/appointments/${appointmentId}/prescriptions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  endAppointment: (id: string | number) =>
    req<{ ended: boolean }>(`/api/appointments/${id}/end`, { method: "POST" }),

  portalAppointment: (id: string | number) => req<Appointment>(`/api/appointments/${id}`),
  setPortalAppointmentStatus: (id: string | number, status: string) =>
    req<{ status: string }>(`/api/appointments/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  acceptPortalAppointment: (id: string | number) =>
    req<{ accepted: boolean }>(`/api/appointments/${id}/accept`, { method: "POST" }),
  declinePortalAppointment: (id: string | number) =>
    req<{ declined: boolean }>(`/api/appointments/${id}/decline`, { method: "POST" }),
};

export type PortalAppointment = Appointment;

