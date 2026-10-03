-- ========================================================
-- Aivida Telehealth - View All Tables Data
-- Database: telehealth | User: postgres | Port: 5432
-- ========================================================

\echo '---------------------------------------------------------'
\echo '1. DOCTORS TABLE'
\echo '---------------------------------------------------------'
SELECT 
    id, 
    name, 
    specialization, 
    experience_years || ' yrs' AS experience, 
    city, 
    '₹' || fee AS fee, 
    CASE WHEN is_online THEN 'ONLINE' ELSE 'OFFLINE' END AS status,
    availability
FROM doctors 
ORDER BY id;

\echo '---------------------------------------------------------'
\echo '2. PATIENTS TABLE'
\echo '---------------------------------------------------------'
SELECT 
    id, 
    name, 
    email, 
    phone, 
    EXTRACT(YEAR FROM age(dob))::int AS age, 
    gender, 
    blood_group, 
    allergies, 
    conditions
FROM patients 
ORDER BY id;

\echo '---------------------------------------------------------'
\echo '3. APPOINTMENTS (WITH DOCTOR & PATIENT NAMES)'
\echo '---------------------------------------------------------'
SELECT 
    a.id, 
    d.name AS doctor_name, 
    p.name AS patient_name, 
    to_char(a.starts_at, 'YYYY-MM-DD HH12:MI AM') AS scheduled_time, 
    UPPER(a.status) AS status, 
    a.reason,
    a.notes
FROM appointments a
JOIN doctors d ON d.id = a.doctor_id
JOIN patients p ON p.id = a.patient_id
ORDER BY a.starts_at DESC;

\echo '---------------------------------------------------------'
\echo '4. PRESCRIPTIONS'
\echo '---------------------------------------------------------'
SELECT 
    pr.id, 
    d.name AS doctor_name, 
    p.name AS patient_name, 
    pr.medicine, 
    pr.dosage, 
    pr.frequency, 
    pr.duration, 
    pr.instructions,
    to_char(pr.created_at, 'YYYY-MM-DD HH12:MI AM') AS prescribed_at
FROM prescriptions pr
JOIN doctors d ON d.id = pr.doctor_id
JOIN patients p ON p.id = pr.patient_id
ORDER BY pr.id ASC;

\echo '---------------------------------------------------------'
\echo '5. MEDICAL RECORDS'
\echo '---------------------------------------------------------'
SELECT 
    m.id, 
    p.name AS patient_name, 
    d.name AS doctor_name, 
    m.title, 
    m.diagnosis, 
    m.notes,
    to_char(m.record_date, 'YYYY-MM-DD') AS record_date
FROM medical_records m
JOIN patients p ON p.id = m.patient_id
JOIN doctors d ON d.id = m.doctor_id
ORDER BY m.record_date DESC;

\echo '---------------------------------------------------------'
\echo '6. AVAILABLE SLOTS (NEXT 10 SLOTS)'
\echo '---------------------------------------------------------'
SELECT 
    s.id, 
    d.name AS doctor_name, 
    to_char(s.starts_at, 'YYYY-MM-DD HH12:MI AM') AS slot_start, 
    to_char(s.ends_at, 'HH12:MI AM') AS slot_end, 
    CASE WHEN s.booked THEN 'BOOKED' ELSE 'AVAILABLE' END AS booking_status, 
    s.reason
FROM slots s
JOIN doctors d ON d.id = s.doctor_id
WHERE s.starts_at > now()
ORDER BY s.starts_at ASC
LIMIT 10;
