# CampusAttend OS - Student User Guide

## 1. Getting Started & Authentication
Students can access CampusAttend OS through both the **Student Mobile App** (Android & iOS) and the **Student Web Portal**.

- **Credentials:** Use your official college institutional email address (e.g. `aarav.patel@student.campusattend.edu`) and assigned password.
- **Biometric Login:** On mobile devices, Face ID or Fingerprint authentication can be enabled after your first login.

---

## 2. Dynamic QR Attendance Check-In (Core Feature)
CampusAttend OS uses time-bound dynamic QR codes displayed on classroom smart boards. Static photos or screenshots of QR codes will fail verification.

### Step-by-Step Scan Workflow:
1. When your lecture starts, open the **CampusAttend Mobile App**.
2. Tap the blue **"Scan Classroom QR"** floating action button or navigate to the **Active Class** banner.
3. Grant camera permissions if prompted.
4. Point your camera at the 86" interactive smart board at the front of the lecture hall.
5. Upon successful scan:
   - Your screen will show an instant green verification checkmark: **"Attendance Recorded: Present"**.
   - Your attendance record is cryptographically signed with the classroom's active session timestamp.
   - The smart board's live headcount indicator increments immediately.

> [!NOTE]
> If you attempt to scan the code a second time, the app safely returns **"Already Marked"** without error.

---

## 3. Daily & Weekly Timetable
- **Live Day View:** See today's scheduled lectures, assigned classrooms, faculty names, and real-time status (Scheduled, In Progress, Completed, or Rescheduled).
- **Weekly Schedule:** Browse your complete 5-day or 6-day academic calendar with subject codes and room locations.
- **Instant Reschedule Alerts:** If an administrator or director modifies a lecture room or timing, your schedule updates in real-time without requiring a manual refresh.

---

## 4. Attendance Statistics & Shortage Calculator
CampusAttend OS empowers students with predictive analytics to maintain institutional compliance:

- **Overall Attendance Percentage:** Live gauge tracking your percentage across all enrolled subjects against the college requirement (typically 75% or 85%).
- **Subject-Wise Breakdown:** See total classes conducted, lectures attended, excused leaves, and unexcused absences.
- **Bunk / Safe-to-Miss Calculator:**
  - Tells you exactly how many upcoming lectures you can safely miss while remaining above the 75% threshold.
  - Or, if you fall below the threshold, tells you how many consecutive lectures you must attend to recover.

---

## 5. Attendance Correction Requests & Leave Applications
If you were present but experienced technical issues (or if you need medical leave):

### Submitting a Correction Request:
1. Navigate to **Attendance History** > Select the specific lecture session.
2. Tap **"Request Attendance Correction"**.
3. Choose the requested status (`present`, `excused`) and provide a brief explanation.
4. Your request will be routed directly to the faculty member for one-click verification.

### Submitting a Leave Application:
1. Go to **Leave Management** > Tap **"Apply for Leave"**.
2. Select Leave Type (`Medical`, `Academic/Duty`, `Personal`).
3. Select start date and end date.
4. Upload supporting documents (e.g., Medical Certificate PDF or JPG) securely.
5. Track status: `Pending` → `Approved` or `Rejected` with administrative remarks.
