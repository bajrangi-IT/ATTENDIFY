# CampusAttend OS - Faculty Operations Guide

## 1. Faculty Dashboard & Daily Schedule
Faculty members can conduct classes and verify attendance using either the **College Web Portal** on a laptop/podium computer or the **CampusAttend Mobile App** on their smartphone.

- **Upcoming Lectures:** Displays today's scheduled offerings, assigned sections, and mapped lecture rooms.
- **Assigned Sections:** Real-time roster access with enrolled student counts and average attendance trends.

---

## 2. Launching an Attendance Session
When entering the assigned lecture hall:

1. Select today's lecture from your **Schedule** or tap **"Start Session"**.
2. The system verifies:
   - Your faculty assignment for the subject.
   - The assigned cohort section.
   - The paired smart board in the classroom.
3. Tap **"Launch Live Attendance"**:
   - The classroom's Smart Display immediately displays the dynamic, rotating HMAC QR code.
   - A 15-second countdown timer runs continuously on the display, refreshing tokens automatically.
   - Your device displays the **Live Attendance Monitor**.

---

## 3. Real-Time Headcount Monitoring
During the active scan window (typically 5 to 10 minutes at the start of class):

- **Live Counter:** Watch the registered attendance count increase in real time as students scan.
- **Roster View:** Displays the complete class roster divided into **Present**, **Late**, and **Unmarked**.
- **Manual Override:**
  - If a student cannot scan due to a dead phone battery or camera defect, tap their name in the roster and select **"Mark Present (Manual)"**.
  - All manual overrides are logged with your faculty actor ID for audit compliance.

---

## 4. Concluding the Session & Generating Reports
When attendance is complete:

1. Tap **"End Attendance & Lock Session"**:
   - The smart board immediately stops accepting scans and displays a lecture conclusion summary.
   - The dynamic QR secret seed is invalidated in the Redis cache.
2. **Automated Roll Finalization:**
   - Any student in the section who did not scan or receive an override is automatically recorded as **Absent**.
   - The canonical `attendance_session_reports` record is compiled with total enrolled, present, late, excused, and absent counts.
3. **Submission & Verification:**
   - Add optional lecture delivery remarks (e.g., *"Covered Chapter 4: Neural Attention Mechanisms"*).
   - Tap **"Submit Session Report"**. The report status transitions to `Pending Review` for HOD/Director oversight.

---

## 5. Reviewing Student Correction Requests
1. Navigate to the **Corrections** tab.
2. Review pending requests from students claiming attendance.
3. Review the student's timestamped reason.
4. Click **"Approve"** to convert the status to Present, or **"Reject"** with feedback.
