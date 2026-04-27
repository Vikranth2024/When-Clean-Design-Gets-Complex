const express = require('express');
const { primaryPool, replicaPool } = require('../db'); // Destructure pools for explicit routing
const router = express.Router();

/**
 * Ingest a new event into the tracking system.
 * ROUTING: Uses primaryPool — all mutations must go to the writer node.
 */
router.post('/', async (req, res) => {
  const { user_id, session_id, event_type, properties } = req.body;
  
  try {
    // Write-through to the partitioned primary table
    const result = await primaryPool.query(
      'INSERT INTO events (user_id, session_id, event_type, properties) VALUES ($1, $2, $3, $4) RETURNING *',
      [user_id, session_id, event_type, properties]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error inserting event:', err);
    res.status(500).json({ error: 'Failed to record event' });
  }
});

/**
 * Retrieve the most recent events for a specific user.
 * ROUTING: Uses replicaPool — dashboards can tolerate slight replication lag (ms).
 */
router.get('/', async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  try {
    // Offload index-heavy user dashboard lookups to the read replica
    const result = await replicaPool.query(
      'SELECT * FROM events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
      [user_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Retrieve historical archived events for a specific user.
 * ROUTING: Uses replicaPool — historical analysis is long-running and read-only.
 */
router.get('/archive', async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  try {
    // Scan the unindexed/separate archive table for cold data
    const result = await replicaPool.query(
      'SELECT * FROM events_archive WHERE user_id = $1 ORDER BY created_at DESC',
      [user_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching archived events:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
