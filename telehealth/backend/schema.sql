CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. DOCTORS TABLE
DROP TABLE IF EXISTS medical_records CASCADE;
DROP TABLE IF EXISTS prescriptions CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS slots CASCADE;
DROP TABLE IF EXISTS portal_appointments CASCADE;
DROP TABLE IF EXISTS portal_slots CASCADE;
DROP TABLE IF EXISTS portal_doctors CASCADE;
DROP TABLE IF EXISTS portal_patients CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;

CREATE TABLE doctors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  specialization TEXT NOT NULL,
  qualification TEXT NOT NULL,
  experience_years INT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Chennai',
  fee INT NOT NULL DEFAULT 500,
  image_url TEXT NOT NULL DEFAULT '/doctors/hamsathvani.jpg',
  availability TEXT NOT NULL DEFAULT 'Mon-Fri, 9:00 AM - 5:00 PM',
  is_online BOOLEAN NOT NULL DEFAULT true
);

-- 2. PATIENTS TABLE
CREATE TABLE patients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  dob DATE NOT NULL,
  gender TEXT NOT NULL,
  blood_group TEXT NOT NULL DEFAULT '',
  allergies TEXT[] NOT NULL DEFAULT '{}',
  conditions TEXT[] NOT NULL DEFAULT '{}'
);

-- 3. SLOTS TABLE
CREATE TABLE slots (
  id SERIAL PRIMARY KEY,
  doctor_id INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  booked BOOLEAN NOT NULL DEFAULT false,
  reason TEXT NOT NULL DEFAULT 'General consultation',
  UNIQUE (doctor_id, starts_at)
);

CREATE INDEX idx_slots_lookup ON slots (doctor_id, booked, starts_at);

-- 4. APPOINTMENTS TABLE
CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  doctor_id INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  slot_id INT UNIQUE REFERENCES slots(id) ON DELETE SET NULL,
  room_id UUID NOT NULL DEFAULT gen_random_uuid(),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL DEFAULT 'General consultation',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','scheduled','in_progress','completed','cancelled')),
  notes TEXT NOT NULL DEFAULT '',
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointments_doctor ON appointments (doctor_id, status, starts_at);
CREATE INDEX idx_appointments_patient ON appointments (patient_id, status, starts_at);

-- 5. PRESCRIPTIONS TABLE
CREATE TABLE prescriptions (
  id SERIAL PRIMARY KEY,
  appointment_id INT REFERENCES appointments(id) ON DELETE CASCADE,
  doctor_id INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  medicine TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. MEDICAL RECORDS TABLE
CREATE TABLE medical_records (
  id SERIAL PRIMARY KEY,
  patient_id INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  diagnosis TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  record_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SEED DATA (Comprehensive & Realistic - All In Database)
-- ============================================================

-- Seed Doctors
INSERT INTO doctors (id, name, specialization, qualification, experience_years, city, fee, image_url, availability, is_online)
VALUES
  (1, 'Dr. Hamsathvani Ilango', 'Gynecology & Women''s Health', 'MBBS, MS (OBG), FMAS', 10, 'Chennai', 600, '/doctors/hamsathvani.jpg', 'Mon-Fri, 9:00 AM - 5:00 PM', true),
  (2, 'Dr. Dharmesh', 'Ayurvedic & Sports Therapy', 'BAMS, MD (Ayu), PGDST', 26, 'Chennai', 700, '/doctors/dharmesh.jpg', 'Mon-Sat, 10:00 AM - 6:00 PM', true),
  (3, 'Dr. Hariharan', 'Diabetology & Endocrinology', 'MBBS, MD (General Medicine), C.Diab', 10, 'Chennai', 500, '/doctors/hariharan.jpg', 'Daily, 8:00 AM - 2:00 PM', true),
  (4, 'Dr. Mohammed Raihaan', 'Dental & Oral Maxillofacial Surgery', 'BDS, MDS (Oral Surgery)', 7, 'Chennai', 300, '/doctors/raihaan.jpg', 'Mon-Sat, 11:00 AM - 7:00 PM', false);

SELECT setval(pg_get_serial_sequence('doctors', 'id'), 4);

-- Seed Patients
INSERT INTO patients (id, name, email, phone, dob, gender, blood_group, allergies, conditions)
VALUES
  (1, 'Ananya Raman', 'ananya.raman@example.com', '+91 98401 23456', '1991-04-12', 'Female', 'B+', ARRAY['Penicillin', 'Dust Mites'], ARRAY['Type 2 Diabetes', 'Mild Hypertension']),
  (2, 'Rahul Verma', 'rahul.verma@example.com', '+91 98450 78901', '1988-08-20', 'Male', 'O+', ARRAY['Sulfa Drugs'], ARRAY['Asthma', 'Seasonal Allergies']),
  (3, 'Priya Sundaram', 'priya.s@example.com', '+91 97910 54321', '1995-11-03', 'Female', 'A+', ARRAY[]::TEXT[], ARRAY['Migraine']),
  (4, 'Karthik Raja', 'karthik.r@example.com', '+91 98840 67890', '1982-01-15', 'Male', 'AB+', ARRAY['Aspirin'], ARRAY['Lower Back Pain']);

SELECT setval(pg_get_serial_sequence('patients', 'id'), 4);

-- Seed Bookable Slots for next 7 days for Doctors 1 to 4
INSERT INTO slots (doctor_id, starts_at, ends_at, booked, reason)
SELECT
  d.id,
  date_trunc('day', now()) + (n || ' day')::interval + (h || ' hour')::interval,
  date_trunc('day', now()) + (n || ' day')::interval + (h || ' hour')::interval + interval '30 minute',
  false,
  'General video consultation'
FROM doctors d, generate_series(0, 6) n, unnest(ARRAY[9, 10, 11, 14, 15, 16, 17]) h
ON CONFLICT (doctor_id, starts_at) DO NOTHING;

-- Seed Prior Completed Consultation (Visit 1: Past Month)
INSERT INTO appointments (id, doctor_id, patient_id, slot_id, room_id, starts_at, ends_at, reason, status, notes, ended_at, created_at)
VALUES
  (1, 1, 1, NULL, gen_random_uuid(), now() - interval '14 day', now() - interval '14 day' + interval '25 minute',
   'Routine gynecological checkup and wellness discussion', 'completed',
   'Patient reported mild fatigue and irregular cycle symptoms. Ultrasound showed normal pelvic findings. Advised dietary modifications, regular hydration, and prescribed iron and folic acid supplements. Follow-up scheduled in 4 weeks.',
   now() - interval '14 day' + interval '25 minute', now() - interval '15 day');

-- Seed Past Prescriptions for Appointment 1
INSERT INTO prescriptions (appointment_id, doctor_id, patient_id, medicine, dosage, frequency, duration, instructions)
VALUES
  (1, 1, 1, 'Ferrous Ascorbate + Folic Acid', '100 mg + 1.5 mg', 'Once daily', '30 days', 'Take at bedtime with water, avoid dairy for 1 hour'),
  (1, 1, 1, 'Vitamin D3 (Cholecalciferol)', '60,000 IU', 'Once weekly', '8 weeks', 'Take with breakfast or milk');

-- Seed Today's Confirmed Consultation (Doctor 1, Patient 1)
INSERT INTO appointments (id, doctor_id, patient_id, slot_id, room_id, starts_at, ends_at, reason, status, notes, created_at)
VALUES
  (2, 1, 1, NULL, '33333333-3333-3333-3333-333333333333',
   date_trunc('hour', now()) + interval '1 hour', date_trunc('hour', now()) + interval '1 hour 30 minute',
   'Follow-up on cycle regularity and vitality review', 'scheduled',
   'Patient checking in for follow-up progress review.', now() - interval '2 day');

-- Seed Pending Consultation Request (Doctor 1, Patient 2) - Shows in Screen 1 Inbox
INSERT INTO appointments (id, doctor_id, patient_id, slot_id, room_id, starts_at, ends_at, reason, status, notes, created_at)
VALUES
  (3, 1, 2, NULL, gen_random_uuid(),
   date_trunc('day', now()) + interval '1 day 10 hour', date_trunc('day', now()) + interval '1 day 10 hour 30 minute',
   'Consultation for recurrent allergies and joint stiffness', 'pending',
   'New patient consultation request.', now() - interval '3 hour');

-- Seed Upcoming Confirmed Appointment (Doctor 1, Patient 3)
INSERT INTO appointments (id, doctor_id, patient_id, slot_id, room_id, starts_at, ends_at, reason, status, notes, created_at)
VALUES
  (4, 1, 3, NULL, gen_random_uuid(),
   date_trunc('day', now()) + interval '2 day 11 hour', date_trunc('day', now()) + interval '2 day 11 hour 30 minute',
   'Consultation for migraine management', 'scheduled',
   'Pre-existing migraine symptoms with aura.', now() - interval '1 day');

-- Seed Another Pending Request (Doctor 1, Patient 4)
INSERT INTO appointments (id, doctor_id, patient_id, slot_id, room_id, starts_at, ends_at, reason, status, notes, created_at)
VALUES
  (5, 1, 4, NULL, gen_random_uuid(),
   date_trunc('day', now()) + interval '3 day 14 hour', date_trunc('day', now()) + interval '3 day 14 hour 30 minute',
   'Lower back strain and posture evaluation', 'pending',
   'Work-from-home ergonomic posture consultation.', now() - interval '5 hour');

SELECT setval(pg_get_serial_sequence('appointments', 'id'), 5);

-- Seed Medical Records for Patient 1
INSERT INTO medical_records (patient_id, doctor_id, title, diagnosis, notes, record_date)
VALUES
  (1, 1, 'Annual Preventive Health Assessment', 'Overall Healthy Vital Parameters', 'CBC, lipid profile and thyroid panels within normal ranges. Blood pressure 120/78 mmHg.', now() - interval '60 day'),
  (1, 3, 'Comprehensive Diabetes Review', 'Pre-diabetic Glycemic Control', 'HbA1c at 6.1%. Managed with lifestyle adjustments, brisk walking and low GI diet.', now() - interval '35 day'),
  (1, 1, 'Gynecological Ultrasound Screening', 'Normal Pelvic Anatomy', 'Bilateral ovaries and uterine morphology normal without cystic lesions.', now() - interval '14 day');
