# Security Model & Row Level Security (RLS) Specification

## 1. Role-Based Access Control (RBAC) Matrix

CampusAttend OS defines 6 distinct roles with strict segregation of duties:

| Role | Profile & Identity | Classrooms & Devices | Attendance Sessions | Attendance Records | Leaves & Adjustments | System Config & Policies |
|---|---|---|---|---|---|---|
| **Student** | Read/Update own | View only | Read own section | Read own records only | Submit own | None |
| **Faculty** | Read dept colleagues | View only | Manage assigned | Full CRUD for taught sessions | Review/recommend | None |
| **HOD** | Read/Update department | View only | View department | View department | Approve department | Configure department policies |
| **Director** | Institution-wide read | View all | View all | View all | Final escalation | View all institution settings |
| **IT Admin** | Technical profile mgmt | Full CRUD on Kiosks/Pairing | None (Segregated) | **NO WRITE ACCESS** (Integrity) | None | Manage SIS Import Jobs |
| **Super Admin** | Full global admin | Full global admin | Full global admin | Full global admin | Full global admin | Full global admin |

---

## 2. Row Level Security Policies

### Student Isolation
```sql
CREATE POLICY "Students view own attendance records"
ON attendance_records FOR SELECT
TO authenticated
USING (
  student_id = get_current_student_id()
  OR get_current_user_role() IN ('faculty', 'hod', 'director', 'super_admin')
);
```

### Segregation of IT Admin from Academic Records
IT administrators can configure technical hardware (pairing codes, smart displays, server settings), but cannot arbitrarily alter attendance records, preventing unauthorized grade tampering or database spoofing.

### Edge Function Cryptographic Gate
Attendance check-ins are processed via the atomic Edge Function `verify-qr-attendance`. Even if a user attempts a direct Supabase REST insertion, RLS prevents students from directly inserting raw records without passing cryptographic token validation.
