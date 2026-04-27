const express = require('express');
const { primaryPool, replicaPool } = require('../db');
const router = express.Router();

/**
 * Start a new user session.
 * ROUTING: Uses primaryPool — new session creation is a critical write.
 */
router.post('/start', async (req, res) => {
  const { user_id } = req.body;
  try {
    const result = await primaryPool.query(
      'INSERT INTO sessions (user_id, started_at) VALUES ($1, NOW()) RETURNING *',
      [user_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error starting session:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * List all currently active sessions (sessions that haven't ended).
 * ROUTING: Uses replicaPool — heavy dashboard aggregation of online users.
 */
router.get('/active', async (req, res) => {
  try {
    // Aggregation query on an indexed ended_at column, offloaded to replica.
    const result = await replicaPool.query(
      'SELECT * FROM sessions WHERE ended_at IS NULL'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching active sessions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
