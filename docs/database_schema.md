# Database Data Dictionary & Entity Reference

CampusAttend OS uses a fully normalized PostgreSQL relational schema designed for scale, data integrity, and strict constraints.

## Entity Relational Hierarchy

1. **Institutions & Campuses**: Multi-tenant foundation with timezone and institutional settings.
2. **Departments & Programs**: Department of CSE, ECE, MECH hosting degree programs (B.Tech, M.Tech).
3. **Semesters & Sections**: Cohort grouping (e.g. 5th Semester Section A).
4. **Students & Enrollment History**: Canonical student identifiers, roll numbers, and historical section transfer records.
5. **Faculty & Assignments**: Teachers linked to subject offerings and section cohorts.
6. **Classrooms & Smart Displays**: Physical lecture halls paired with display hardware via rotating PIN tokens.
7. **Timetable Entries & Exceptions**: Weekly schedule matrix with holiday/cancellation exception overrides.
8. **Attendance Sessions & Records**: 
   - Canonical 1-to-1 unique constraint: `UNIQUE (session_id, student_id)`.
   - Distinct statuses: `present`, `absent`, `late`, `excused`.
   - Distinct verification methods: `dynamic_qr`, `manual_faculty`, `leave_override`.
9. **Adjustment Requests & Leaves**: Two-way workflow for excused medical absences and attendance disputes.
10. **Policies**: Institutional threshold parameters ($75\%$ minimum, $10\text{ min}$ grace period).
11. **Audit Logs & Import Jobs**: Immutable record of administrative operations and SIS CSV sync jobs.

## Canonical Aggregation View: `v_student_attendance_summary`

```sql
CREATE OR REPLACE VIEW v_student_attendance_summary AS
...
-- Excludes cancelled sessions
-- Automatically computes percentage and threshold status (good, warning, critical)
```
