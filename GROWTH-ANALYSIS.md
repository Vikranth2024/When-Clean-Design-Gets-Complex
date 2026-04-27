# GROWTH-ANALYSIS.md: Large-Scale Growth Risk Assessment

## 1. Projected Row Count Growth (3-Year Forecast)

All projections use the following baseline metrics:
- **Active Users:** 50,000
- **Daily Event Growth:** 10,000,000 rows/day (200 events/user/day)
- **Daily session Growth:** 250,000 rows/day (5 sessions/user/day)
- **Daily feature_usage Growth:** 2,500,000 rows/day (50 usages/user/day)

| Table | Current Count | 12-Month Projection | 24-Month Projection | 36-Month Projection |
| :--- | :--- | :--- | :--- | :--- |
| `events` | 45,000,000 | 3,695,000,000 | 7,345,000,000 | 10,995,000,000 |
| `sessions` | ~1,000,000 | 92,250,000 | 183,500,000 | 274,750,000 |
| `feature_usage`| ~5,000,000 | 917,500,000 | 1,830,000,000 | 2,742,500,000 |

### Arithmetic Logic:
- **Events:** `Current (45M) + (10M/day * 365 days) = 3.695B` for 12 months.
- **Sessions:** `Baseline (1M) + (250k/day * 365 days) = 92.25M` for 12 months.
- **Feature Usage:** `Baseline (5M) + (2.5M/day * 365 days) = 917.5M` for 12 months.

---

## 2. Critical Scalability Risks

### Risk #1: Aggregate Metric Exhaustion
- **Target Query:**
```javascript
const result = await db.query(
  "SELECT COUNT(*), event_type FROM events WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY event_type"
);
```
- **Failure Mechanism:** **Unpartitioned Sequential Scan / Index Range Scan Aggregation.** On a single flat table, a "last 30 days" query requires scanning 300,000,000 rows. Without partitioning, PostgreSQL cannot perform "partition pruning" to skip the other 90% of the table. Even with an index on `created_at`, retrieving and aggregating 300M rows causes massive I/O wait and memory pressure.
- **Threshold for Failure (>500ms):** ~500,000 rows (at 1M rows/sec for sequential scans).
- **Consequence:** The `GET /metrics/monthly` endpoint will time out (504 Gateway Timeout). The analytics dashboard will fail to load, leaving users without visibility into recent activity.

### Risk #2: User Activity Stream Degradation
- **Target Query:**
```javascript
const result = await db.query(
  'SELECT * FROM events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
  [user_id]
);
```
- **Failure Mechanism:** **Index Bloat and B-Tree Depth.** As the `events` table reaches 3B+ rows, the index on `user_id` grows to hundreds of gigabytes, exceeding available RAM. A lookup for a single user's events results in multiple disk seeks to traverse the deep B-tree and fetch rows from scattered data pages. Without composite indexes, the `ORDER BY created_at DESC` requires a post-lookup sort.
- **Threshold for Failure (>500ms):** ~5,000,000 rows (at 10M rows/sec for index scans, but account for disk latency on cold cache).
- **Consequence:** `GET /events?user_id=X` becomes sluggish or times out. The real-time activity feed in the user dashboard shows a spinning loader or error message.

### Risk #3: Monitoring Visibility Blindness
- **Target Query:**
```javascript
const result = await db.query(
  'SELECT * FROM sessions WHERE ended_at IS NULL'
);
```
- **Failure Mechanism:** **Missing Index Sequential Scan.** There is no index on `ended_at`. Every time the admin dashboard checks for "active sessions," the database must scan EVERY session record EVER created to find those with a NULL `ended_at`. 
- **Threshold for Failure (>500ms):** ~500,000 rows (at 1M rows/sec for sequential scanning).
- **Consequence:** `GET /sessions/active` times out. Sysadmins cannot see how many users are currently online, making it impossible to diagnose real-time traffic spikes or outages.

### Risk #4: Write Head Saturation
- **Target Query:**
```javascript
const result = await db.query(
  'INSERT INTO events (user_id, session_id, event_type, properties) VALUES ($1, $2, $3, $4) RETURNING *',
  [user_id, session_id, event_type, properties]
);
```
- **Failure Mechanism:** **Index Maintenance Lock Contention.** Each event insert requires updating multiple massive B-tree indexes (`id`, `user_id`, `created_at`). On a 1B+ row table, these indexes are too large to fit in cache. Every write triggers random I/O for index leaf node updates, leading to IOPS saturation and high lock wait times.
- **Threshold for Failure:** Performance degrades continuously, becoming non-linear once index size > 50% of memory.
- **Consequence:** `POST /events` slows down. Inbound tracking events back up in application buffers, eventually leading to data loss and dropped events as the API cannot keep up with the 200 reqs/sec ingress.
