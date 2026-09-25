# CampusAttend OS API Specifications

## Edge Functions

### 1. `POST /functions/v1/verify-qr-attendance`
Submits student check-in payload from mobile camera scanner for cryptographic verification and atomic database insertion.

#### Request Headers:
- `Authorization: Bearer <Student_JWT_Token>`
- `Content-Type: application/json`

#### Request Body:
```json
{
  "session_id": "C0000000-0000-0000-0000-000000000099",
  "classroom_id": "70000000-0000-0000-0000-000000000001",
  "epoch_window": 1172654,
  "qr_token": "a1b2c3d4e5f6...32_byte_hmac",
  "device_fingerprint": "iPhone14,2_iOS17.4",
  "geo_lat": 12.9716,
  "geo_lng": 77.5946
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "status": "present",
  "message": "Attendance recorded successfully!",
  "record_id": "a98dfb01-...",
  "marked_at": "2026-09-25T04:20:00Z"
}
```

---

### 2. `GET /functions/v1/session-qr-token?session_id=<UUID>`
Used by classroom smart displays in server-assisted mode to receive fresh rotating dynamic QR tokens.

#### Response (200 OK):
```json
{
  "session_id": "C0000000-0000-0000-0000-000000000099",
  "classroom_id": "70000000-0000-0000-0000-000000000001",
  "timestamp": 1758763800000,
  "epoch_window": 1172654,
  "token": "4a7f29b...",
  "expires_in_seconds": 12
}
```
