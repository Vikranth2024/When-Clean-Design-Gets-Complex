const { Pool } = require('pg');

// PRIMARY POOL: Used for all writes (INSERT, UPDATE, DELETE) and strong consistency reads.
// This pool targets the primary writer node in the RDS/PostgreSQL cluster.
const primaryPool = new Pool({
  connectionString: process.env.PRIMARY_DB_URL,
  max: 20, // Sufficient for high write ingress
  idleTimeoutMillis: 30000,
});

// REPLICA POOL: Used for all analytical/non-critical reads.
// This pool targets read-only replica(s) to offload load from the primary writer.
const replicaPool = new Pool({
  connectionString: process.env.REPLICA_DB_URL,
  max: 100, // Higher limit for dashboard-heavy read traffic
  idleTimeoutMillis: 30000,
});

// Export both pools to allow routers to make intent-based connection choices.
module.exports = {
  primaryPool,
  replicaPool,
};
