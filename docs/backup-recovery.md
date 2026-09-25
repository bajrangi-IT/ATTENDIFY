# CampusAttend OS - Backup & Disaster Recovery Guide

## 1. Backup Strategy & Recovery Point Objective (RPO)
Attendance records represent statutory academic documentation required for accreditation (e.g. NAAC, ABET) and legal compliance.

- **Target RPO (Recovery Point Objective):** < 5 Minutes.
- **Target RTO (Recovery Time Objective):** < 30 Minutes.

---

## 2. PostgreSQL Automated Backup Schedule
In managed Supabase / AWS RDS production environments:

1. **Continuous WAL Archiving & Point-In-Time Recovery (PITR):**
   - Write-Ahead Logging (WAL) captures every transaction continuously.
   - Retained for 30 days, allowing restoration to any exact second.
2. **Nightly Logical Dumps:**
   - Automated `pg_dump` exported at 02:00 UTC.
   - Compressed and encrypted with AES-256 before uploading to an isolated, immutable S3 bucket.

### Manual Database Snapshot Command:
```bash
# Dump complete schema and partitioned tables
pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --dbname="${DATABASE_URL}" \
  --file="campusattend_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### Restoration Command:
```bash
# Restore to a clean staging or recovery database
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --dbname="${DATABASE_URL}" \
  "campusattend_backup_20260925.dump"
```

---

## 3. Redis Persistence & Failover
- **AOF (Append Only File) Enabled:** Every write is logged to disk (`appendfsync everysec`).
- **RDB Snapshots:** Snapshot captured every 15 minutes if at least 1 key changed.
- **Failover Behavior:** If Redis experiences hardware failure, the attendance engine seamlessly operates in resilient in-memory mode while the container restarts.

---

## 4. Disaster Recovery Runbook
If primary infrastructure experiences an outage:

1. **Activate Standby Database:** Promote read-replica in secondary availability zone.
2. **DNS Failover:** Update Route 53 or Cloudflare DNS record for `api.campusattend.edu` to point to the backup cluster.
3. **Audit Log Verification:** Run audit integrity check to ensure trigger-enforced immutable logs match the last known state.
4. **Broadcast Notification:** Automated push notifications sent to students and faculty regarding temporary offline attendance contingency.
