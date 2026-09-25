# CampusAttend OS - Smart Board & Classroom Display Kiosk Guide

## 1. Hardware Compatibility & Supported Devices
`apps/smart-display` is designed for zero-maintenance operation across all interactive classroom displays:
- **Promethean ActivPanel** (v7, v9, Elements Series)
- **ViewSonic ViewBoard** (IFP50, IFP70 Series)
- **Samsung Flip Pro & SMART Signage**
- **SMART Board GX & MX Series**
- **Android TV boxes, Chromeboxes, Raspberry Pi 4/5, and Intel NUCs** connected to standard HDMI lecture projectors.

---

## 2. Display Security & Hardware Token Authentication
Smart boards are located in unmonitored physical spaces where students or unauthorized visitors might inspect web developer tools or URLs.

To prevent credential leakage:
1. **Zero User Passwords:** Smart boards do not use email/password accounts.
2. **Zero Service Keys:** No Supabase service role keys or database credentials exist in the client bundle.
3. **Dedicated Display Token (`x-display-token`):** Smart boards authenticate using a hardware display token stored in browser `localStorage`.
4. **IP & Device Binding:** Each token is mapped to a specific classroom UUID in the database and periodically verified.

---

## 3. Hardware Pairing Workflow

### One-Time Classroom Commissioning:
1. Power on the smart display and open Chromium / Google Chrome.
2. Navigate to the institutional smart board URL:
   ```
   https://board.campusattend.edu
   ```
3. If unpaired, the screen presents a clean **Pairing Code** (e.g. `PAIR-9402`).
4. An IT Admin opens the **CampusAttend Web Portal** > **Classrooms & Devices**.
5. Select the physical lecture hall (e.g. `LH-101`) > Click **"Pair Display"**.
6. Enter `PAIR-9402` and submit:
   - The server generates a unique cryptographic display token and pairs the hardware.
   - The smart board immediately transitions into the **Classroom Kiosk Mode**.

---

## 4. Operating in Fullscreen Kiosk Mode

### Chromium / Chrome Flags for Dedicated Kiosks:
Launch the display browser using kiosk mode flags to hide browser navigation bars, tabs, and system menus:

```bash
# Linux / Raspberry Pi / Android TV terminal
google-chrome \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-translate \
  --check-for-update-interval=31536000 \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  https://board.campusattend.edu?classroomId=70000000-0000-0000-0000-000000000001
```

### Windows Kiosk Command:
```cmd
start chrome.exe --kiosk --incognito "https://board.campusattend.edu?classroomId=70000000-0000-0000-0000-000000000001"
```

---

## 5. Live Display Features During Class
- **Dynamic HMAC-SHA256 QR Code:** Displayed at 400x400 SVG resolution with high-contrast color scheme for clear scanning across large lecture halls.
- **15-Second Circular Progress Indicator:** Visual ring countdown informing students when the next cryptographic token rotation occurs.
- **Real-Time Live Headcount Indicator:** Displays current student attendance count alongside class details (Course, Faculty, Time remaining).
- **Session End Screen:** When faculty completes the class, the display cleanly returns to the classroom schedule view.
