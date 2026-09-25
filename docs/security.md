# CampusAttend OS - Comprehensive Security & Cryptographic Specification

## 1. Dynamic QR Cryptographic Protocol
To eliminate proxy attendance (where students photograph a static QR code and text it to absent classmates), CampusAttend OS employs a time-synchronized HMAC-SHA256 token rotation protocol implemented in `@campusattend/attendance-sdk`.

### Token Generation Formula:
```
epoch_window = floor(Unix_Timestamp / 15)
message = Session_ID + ":" + Classroom_ID + ":" + epoch_window
token = HMAC_SHA256(message, Session_Secret_Seed)
```

### Verification & Drift Window:
- Tokens expire every **15 seconds**.
- The attendance engine accepts `current_window` as well as `current_window - 1` (allowing up to a 15-second network latency buffer for cellular data jitter), while strictly rejecting past or future tokens.
- Once a session ends, the `Session_Secret_Seed` is deleted from Redis and the database is locked, permanently invalidating all issued QR tokens.

---

## 2. Insecure Direct Object Reference (IDOR) Protection
All client requests must authenticate via Supabase Auth JWTs. The attendance engine never trusts client-supplied user IDs:

1. **Student Identity Resolution:** The server extracts the authenticated `user_id` from the verified JWT and queries the database to resolve the student's canonical `student_id`.
2. **Report Ownership Enforcement:** When a student requests an attendance report, the engine forces the query filter to `studentId = authenticated_student_id`, overriding any malicious payload.
3. **Private Document Protection:** Leave application uploads (medical notes, duty proofs) are stored in secure buckets. The file retrieval endpoint verifies that the requester is either the document owner, the assigned faculty, or an institutional administrator.

---

## 3. Rate Limiting & Denial of Service (DoS) Defense
CampusAttend OS implements a Redis-backed sliding window rate limiter:

- **Student Scan Endpoint:** Max **5 requests per 10 seconds** per student. Prevents brute-forcing QR tokens or flooding the database.
- **Display Poll Endpoint:** Max **60 requests per minute** per paired classroom.
- **Reporting Endpoint:** Max **10 requests per minute** per staff user.
- **Graceful Degradation:** If Redis becomes unavailable, the system safely falls back to a high-performance in-process memory cache without dropping legitimate attendance scans.

---

## 4. Frontend & Mobile Secret Audit Results
A complete static analysis of the frontend and mobile bundles confirmed **zero secret leakage**:

| Secret Category | Frontend (`college-web`) | Display (`smart-display`) | Mobile (`student-mobile`) |
| :--- | :--- | :--- | :--- |
| Database Password | **CLEAN** (Not found) | **CLEAN** (Not found) | **CLEAN** (Not found) |
| Supabase Service Role Key | **CLEAN** (Not found) | **CLEAN** (Not found) | **CLEAN** (Not found) |
| Redis Connection String | **CLEAN** (Not found) | **CLEAN** (Not found) | **CLEAN** (Not found) |
| JWT Master Secret | **CLEAN** (Not found) | **CLEAN** (Not found) | **CLEAN** (Not found) |
| Private Encryption Keys | **CLEAN** (Not found) | **CLEAN** (Not found) | **CLEAN** (Not found) |

All privileged operations are mediated exclusively through the backend `attendance-engine` microservice and protected PostgreSQL stored procedures.
