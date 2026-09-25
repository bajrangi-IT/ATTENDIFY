# CampusAttend OS - Database Architecture & Data Integrity

## 1. Relational Schema Architecture
The persistence layer of CampusAttend OS is built on **PostgreSQL 15** (via Supabase), enforcing strict referential integrity, domain constraints, custom ENUM types, and Row Level Security.

### Core Domain Entities
```
institutions (root tenant)
  ├── campuses
  │    └── classrooms (smart board tokens, IP, pairing codes)
  ├── academic_years
  │    └── semesters
  │         ├── sections (cohort groups, max capacity)
  │         └── subject_offerings (link subject to term)
  │              ├── faculty_assignments (faculty to section offering)
  │              ├── timetable_entries (day, start_time, end_time, room)
  │              └── attendance_sessions (live lecture instance, secret seed)
  │                   ├── attendance_records (canonical check-in records)
  │                   └── attendance_session_reports (finalized attendance tallies)
  ├── departments
  │    ├── programs (degree duration, level)
  │    └── subjects (course code, credits, theory/practical)
  ├── profiles (auth.users extension: student, faculty, hod, director, it_admin, super_admin)
  │    ├── students (roll number, registration number, section assignment)
  │    └── faculty (employee code, designation)
  ├── leave_applications (medical, academic, personal with document upload)
  ├── notifications (user-specific notification inbox)
  └── audit_logs (append-only immutable security ledger)
```

---

## 2. Partitioning Strategy (`attendance_records`)
To accommodate millions of attendance transactions across multiple academic terms without performance degradation, `attendance_records` is architected for range-partitioning:

```sql
-- Partition master table
CREATE TABLE attendance_records_master (
  id UUID DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status attendance_status NOT NULL DEFAULT 'present',
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verification_method verification_method NOT NULL DEFAULT 'dynamic_qr',
  is_finalized BOOLEAN NOT NULL DEFAULT false,
  device_fingerprint VARCHAR(100),
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Yearly Partition Example
CREATE TABLE attendance_records_2025_2026 PARTITION OF attendance_records_master
  FOR VALUES FROM ('2025-06-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');

CREATE TABLE attendance_records_2026_2027 PARTITION OF attendance_records_master
  FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2027-06-01 00:00:00+00');
```

---

## 3. High-Performance Composite & Covering Indexes
Queries are optimized to eliminate full-table scans during active lecture hours:

```sql
-- 1. Ultra-fast session check-in idempotency lookup
CREATE UNIQUE INDEX IF NOT EXISTS uq_session_student ON attendance_records(session_id, student_id);

-- 2. Student attendance history and aggregation covering index
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_session 
  ON attendance_records(student_id, session_id) 
  INCLUDE (status, marked_at);

-- 3. Faculty active session lookup by date
CREATE INDEX IF NOT EXISTS idx_sessions_faculty_date 
  ON attendance_sessions(faculty_id, session_date);

-- 4. Classroom smart display token lookup
CREATE INDEX IF NOT EXISTS idx_classrooms_display_token 
  ON classrooms(display_token);

-- 5. Timetable weekly lookup for real-time conflict detection
CREATE INDEX IF NOT EXISTS idx_timetable_lookup 
  ON timetable_entries(section_id, day_of_week);
```

---

## 4. Immutable Audit Ledger (Trigger-Enforced Protection)
To ensure compliance and prevent tampering with attendance audits, `audit_logs` has a trigger that strictly rejects `UPDATE` and `DELETE` operations, even from institutional administrators:

```sql
CREATE OR REPLACE FUNCTION trg_enforce_audit_immutability()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'CRITICAL: audit_logs records are strictly immutable. UPDATE and DELETE operations are forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION trg_enforce_audit_immutability();
```

---

## 5. Row-Level Security (RLS) Matrix
Every core table has RLS enabled with granular institutional isolation:

| Table | Student | Faculty | HOD | Director / IT Admin |
| :--- | :--- | :--- | :--- | :--- |
| `attendance_records` | SELECT own records | SELECT/INSERT for assigned sections | SELECT for department | SELECT across institution |
| `attendance_sessions`| SELECT active/assigned | FULL control on assigned lectures | FULL control for dept | FULL control institution-wide |
| `timetable_entries`  | SELECT enrolled section | SELECT assigned schedule | SELECT/UPDATE dept slots | FULL management |
| `leave_applications` | SELECT/INSERT own leaves| SELECT assigned students | APPROVE/REJECT dept | FULL institutional review |
| `audit_logs`         | No access | No access | SELECT dept events | SELECT institutional audit trail |
| `classrooms`         | SELECT basic room info | SELECT room schedule | SELECT room schedule | FULL hardware pairing management |
