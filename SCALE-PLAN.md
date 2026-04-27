# SCALE-PLAN.md: Multi-Phase Scaling Architecture

## 1. Growth Projections
Based on the current baseline of 50,000 active users and a daily ingestion rate of 10 million events, we anticipate the following database growth:

| Table | Current Count (Existing) | 12-Month Projection | 24-Month Projection | 36-Month Projection |
| :--- | :--- | :--- | :--- | :--- |
| `events` | 45,000,000 | 3,695,000,000 | 7,345,000,000 | 10,995,000,000 |
| `sessions` | ~1,000,000 | 92,250,000 | 183,500,000 | 274,750,000 |
| `feature_usage`| ~5,000,000 | 917,500,000 | 1,830,000,000 | 2,742,500,000 |

*Assumptions: Daily sessions = 250k (5/user), Daily feature usage = 2.5M (50/user).*

---

## 2. Scaling Strategy Summary

### Strategy A: Time-Based Table Partitioning
The `events` and `feature_usage` tables are now partitioned by `RANGE(created_at/used_at)`. This allows PostgreSQL to perform **Partition Pruning**, effectively ignoring historical data for recent dashboard queries. 
- **Query Fixed:** `GET /metrics/monthly` (monthly event categorization).
- **Improvement:** Partition pruning reduces a 30-day aggregation from scanning 300M rows in a flat table to scanning ~10M rows in the current month's partition—resulting in a **30x improvement** in query speed and significantly reduced I/O overhead.

### Strategy B: Cold Storage Archiving
Data older than 90 days is moved into a separate `events_archive` table via the `archive.js` job. This ensures that the indices on the "hot" partitioned table remain compact and fit within the database's available Memory (RAM), preventing slow disk lookups.
- **Query Fixed:** `POST /events` (ingestion performance) and overall database maintenance.
- **Improvement:** Keeping indices under 100GB ensures that write operations maintain a constant performance profile, as B-Trees remain shallow (4-5 levels deep) and index nodes stay in the Buffer Cache, avoiding costly random I/O during B-tree updates.

### Strategy C: Read Replica Offloading
We have separated `primaryPool` (for writes) from `replicaPool` (for reads). Analytical dashboard traffic is routed to read-only replicas, isolating critical write operations on the primary node from heavy SELECT queries.
- **Query Fixed:** `GET /events?user_id=X` (activity feed lookup).
- **Improvement:** Offloading analytics queries prevent them from "starving" write locks or saturating the primary CPU. This expands read throughput horizontally by a factor equal to the number of replicas, keeping the primary node reserved for high-frequency ingestion events.

---

## 3. Implementation Order & Urgency

1. **Immediate (Archiving):**
   Archiving should be implemented first. It can be applied to the existing unpartitioned table immediately to reduce its "hot" size and clean up bloat. This provides instant relief to the single flat table's index depth and memory pressure without requiring a complex schema migration or downtime.
   
2. **Intermediate (Partitioning):**
   Partitioning requires a structural schema change (creating a new partitioned table and moving existing data into partitions). This must be planned carefully with a maintenance window or a "dual-write" migration strategy. It is essential before the table crosses the ~1B row mark where partition pruning becomes a necessity for performance.

3. **Strategic (Read Replica Routing):**
   Read replica routing requires infrastructure provisioning (setting up a replica cluster). Once the infrastructure is ready, code changes are simple (routing SELECTs to the new pool). This is best deployed last, as it allows for horizontal read horizontal scaling once partitioning and indexing alone no longer suffice for handle dashboard load.

---

## 4. Trade-offs and Risks

- **Partitioning Maintenance Complexity:** Managing monthly partitions (creating future partitions and dropping old ones) adds operational overhead.
  - *Mitigation:* Automate partition creation using `pg_partman` or an equivalent custom cron script to ensure future partitions always exist.
  
- **Archiving Data Context Loss:** Archiving introduces complexity for queries that need to span both hot and cold data (e.g., "Show me everything from 2 years ago").
  - *Mitigation:* Implement a dedicated `/archive` endpoint or a "Union View" for historical queries, so the application knows exactly where to look for data older than 90 days.

- **Replica Stale Reads (Replication Lag):** Reads from the `replicaPool` may return data that is several seconds out of date compared to the primary writer. 
  - *Deep Mitigation:* We implement **Session-Based Consistency**. When a write occurs, the system tags the user's session. For the next 10 seconds, all reads from that specific user are forced to the **Primary DB**. This ensures 'Read-After-Write' consistency for the user who made the change, while the rest of the globally distributed read traffic remains offloaded to the replicas. We also implement a monitor that fails back to the primary if replication lag exceeds a 5-second threshold.



