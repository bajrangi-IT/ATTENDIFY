# CampusAttend OS - Troubleshooting & Diagnostics Guide

## 1. Fast Diagnostics Flowchart

```
Student Scans QR Code
       │
       ▼
Did Scan Succeed?
 ├── YES ──► Attendance Marked (Green Checkmark)
 └── NO
      ├── "Session Not Found / Inactive" ──► Verify Faculty started class
      ├── "Invalid QR / Expired" ──────────► Clock Drift or Old QR Snapshot
      ├── "Not Enrolled in Section" ───────► Student assigned to wrong cohort
      └── "Too Many Requests" ─────────────► Rate limit triggered (Wait 10s)
```

---

## 2. Common Scenarios & Solutions

### A. "Invalid QR Code. Please scan current classroom display"
- **Cause 1: Clock Drift:** The client phone or smart display has a system clock out of sync by > 15 seconds.
  - **Solution:** Enable "Set Time Automatically (NTP)" in the phone or smart display OS settings.
- **Cause 2: Photo Proxy Attempt:** A student attempted to scan a photo taken 30 seconds ago.
  - **Solution:** Working as designed. The dynamic HMAC token has expired.

### B. "Smart Board Display is Stuck on Pairing Screen"
- **Cause:** Display token expired or hardware unlinked by IT Admin.
  - **Solution:** An administrator must navigate to **Admin Portal** > **Classrooms** > Enter the pairing code displayed on screen to re-issue the token.

### C. "Student Cannot Scan (Camera Broken / Phone Dead)"
- **Emergency Procedure:**
  1. The student presents their college physical ID card to the faculty member.
  2. Faculty searches the student in the **Live Attendance Monitor** roster.
  3. Faculty taps **"Mark Present (Manual)"**.
  4. The record is permanently logged as `verification_method: manual_faculty`.

### D. "Redis Connection Failed"
- **Engine Behavior:** The attendance engine logs a warning and automatically activates **High-Performance In-Memory Mode**.
- **Action:** Check Redis container status (`docker-compose logs redis` or systemd service `systemctl status redis`).

---

## 3. Telemetry & Health Endpoints
Use these built-in HTTP endpoints for monitoring:

- **Basic Liveness:** `GET /api/health`
  - Returns `200 OK` with database ping status and cache mode.
- **Detailed System Telemetry:** `GET /api/health/detailed`
  - Returns PostgreSQL connection latency, cache latency, BullMQ worker queue sizes, and p50/p95/p99 response times.
