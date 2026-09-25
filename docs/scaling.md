# CampusAttend OS - Scaling & Enterprise Concurrency Guide

## 1. Concurrency Bottlenecks & Architectural Solutions

### The 10:00 AM Rush Scenario:
In a university with 10,000 students and 150 simultaneous lectures starting at 10:00 AM:
- Approximately **7,000 students** scan dynamic QR codes within a narrow **3-minute window**.
- Peak load can reach **400 to 800 scans per second**.

Traditional monolithic applications crash due to:
1. **Connection Exhaustion:** PostgreSQL max connections exceeded.
2. **Lock Contention:** Row locks on global attendance tables.
3. **CPU Spike from Heavy Queries:** Analytics dashboards competing with transactional check-ins.

---

## 2. Zero-Lock Architecture & Connection Pooling

### Supabase PgBouncer / Supavisor Integration:
- All database connections from the attendance engine utilize transaction-mode connection pooling (PgBouncer on port `6543`).
- Reusable connection pool size: 50 connections handle over 2,000 concurrent web requests with minimal RAM overhead.

### Zero-Lock Transactions:
- Student scans execute `INSERT INTO attendance_records (...) ON CONFLICT (session_id, student_id) DO NOTHING`.
- Because transactions insert distinct rows rather than updating shared counter rows, there are **zero row-level or table-level locks**.
- Live headcounts are incremented in Redis (`INCR session:<session_id>:count`) in sub-millisecond memory time.

---

## 3. High-Capacity Redis Caching Strategy
Redis handles read-intensive state during the active class window:

| Cache Key Pattern | TTL | Purpose |
| :--- | :--- | :--- |
| `session:<session_id>:meta` | 2 Hours | Session metadata (seed, section ID, classroom ID, active status) |
| `session:<session_id>:count` | 2 Hours | Atomic in-memory live attendance headcount |
| `ratelimit:<type>:<id>` | 10 Sec | Sliding window counter for brute-force and DoS defense |
| `display:<classroomId>:feed` | 2 Sec | Pre-rendered QR code and schedule payload for smart boards |

---

## 4. Asynchronous Queue Processing with BullMQ
To maintain sub-50ms API response times for student check-ins, CPU-intensive tasks are decoupled into background queues:

- **Report Compilation Queue:** Institutional PDF, Excel, and CSV generation are processed asynchronously by dedicated worker threads.
- **Notification Queue:** Push notifications, SMS alerts, and low-attendance warnings are queued and batched to prevent network blocking.
- **Failover In-Memory Queue:** If Redis is down, the engine activates an internal worker queue with zero message drops.
