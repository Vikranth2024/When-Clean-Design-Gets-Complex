const express = require('express');
const { primaryPool, replicaPool } = require('../db');
const router = express.Router();

/**
 * Generate a monthly summary of event types.
 * ROUTING: Uses replicaPool — scanning 300 million rows must NOT touch the primary instance.
 */
router.get('/monthly', async (req, res) => {
  try {
    // Partition pruning triggers here: query scans only the last 30 days of partitions.
    const result = await replicaPool.query(
      "SELECT COUNT(*), event_type FROM events WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY event_type"
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error calculating monthly metrics:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Tracks usage of specific features.
 * ROUTING: Uses primaryPool — feature logging is a mutation.
 */
router.post('/feature-usage', async (req, res) => {
  const { user_id, feature_name } = req.body;
  try {
    // Write-through to the partitioned feature_usage primary table.
    const result = await primaryPool.query(
      'INSERT INTO feature_usage (user_id, feature_name, used_at) VALUES ($1, $2, NOW()) RETURNING *',
      [user_id, feature_name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error recording feature usage:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
