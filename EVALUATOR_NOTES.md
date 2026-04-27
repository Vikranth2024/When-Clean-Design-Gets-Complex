# EVALUATOR_NOTES.md: PR Rubric Assessment Guide

## 1. Growth Projection Efficiency
- **Full Marks:** A submission that uses the README's 10M rows/day figure and calculates at least a 3-year projection (10.95B events). It should show clear arithmetic logic for each table. 
  - *Example:* "300M rows * 12 months = 3.6B + initial 45M = 3.645B."
- **Partial Credit Mistake:** Estimating only for 1 year or missing the initial 45M row starting count in the final projection.
- **Differentiator:** Check if the student accounts for `feature_usage` growth too, as it was in the `schema.sql`.

## 2. Partitioning Implementation
- **Full Marks:** The `events` table must use `PARTITION BY RANGE (created_at)` with at least 3-4 future partitions correctly defined with non-overlapping ranges.
  - *Example:* `CREATE TABLE events_2026_04 PARTITION OF events FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');`
- **Partial Credit Mistake:** Using `LIST` or `HASH` partitioning. These do not allow for the "time-based" partition pruning needed for the `/metrics/monthly` query.
- **Differentiator:** Grep for `PARTITION BY`. A surface-level "fix" might just add an index without implementing partitioning. Check if `id` is part of the Primary Key on the partitioned table (PostgreSQL requires the partition key to be part of all unique constraints).

## 3. Read Replica Routing
- **Full Marks:** Valid Node.js code that successfully exports two separate Pool instances (`primaryPool` for writes, `replicaPool` for reads) and uses them intentionally in the route handlers.
  - *Example:* `const result = await replicaPool.query(...)` used in `GET /metrics/monthly`.
- **Partial Credit Mistake:** Exporting the same `pool` twice with two names. This doesn't actually split traffic to separate database endpoints.
- **Differentiator:** Check `routes/metrics.js`. The expensive aggregation query MUST use `replicaPool`. If it uses `primaryPool`, the student has missed the goal of offloading analytic load.

## 4. Archiving Strategy
- **Full Marks:** A standalone JavaScript file (`archive.js`) that transactionally moves data older than 90 days following the "Delete then Insert" (or CTE) pattern, with clear logging of the result.
  - *Example:* `WITH moved_rows AS (DELETE FROM events WHERE created_at < NOW() - INTERVAL '90 days' RETURNING *) INSERT INTO events_archive SELECT * FROM moved_rows;`
- **Partial Credit Mistake:** Simply deleting data without moving it to an archive table first (data loss).
- **Differentiator:** Look for the `/events/archive` endpoint in the routes. A real implementation realizes that once data is moved, the application needs a way to fetch it if historical data is requested.
