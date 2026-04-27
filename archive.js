const { primaryPool } = require('./db');

/**
 * ARCHIVE JOB: Periodic Maintenance Script
 * This script moves "cold" data (older than 90 days) out of the main partitioning set
 * and into the events_archive table. This minimizes the active table size and keeps
 * indices compact, while maintaining historical data for compliance/audits.
 * 
 * CRON SUGGESTION: Run this nightly at 02:00 AM (e.g., 0 2 * * *).
 */
async function archiveOldEvents() {
  const startTime = new Date();
  console.log(`[ARCHIVE] Starting job at ${startTime.toISOString()}...`);

  try {
    // 1. Transactionally Move Data: Insert into archive then delete from main
    // We use a CTE (Common Table Expression) to ensure atomic movement of rows.
    const moveQuery = `
      WITH moved_rows AS (
        DELETE FROM events 
        WHERE created_at < NOW() - INTERVAL '90 days'
        RETURNING *
      )
      INSERT INTO events_archive (id, user_id, session_id, event_type, properties, created_at)
      SELECT id, user_id, session_id, event_type, properties, created_at 
      FROM moved_rows;
    `;

    const result = await primaryPool.query(moveQuery);
    
    // Note: rowCount will return the number of rows inserted into the archive
    console.log(`[ARCHIVE] Success: Successfully moved ${result.rowCount} events to the archive.`);
    
    // 2. (Optional Advanced maintenance) Cleanup partitions that are now empty
    // In a production environment, you would also use 'DROP TABLE' for old partitions
    // after they've been detaching and verified for archiving.

  } catch (err) {
    console.error('[ARCHIVE] CRITICAL ERROR during archiving job:', err);
    process.exit(1);
  } finally {
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    console.log(`[ARCHIVE] Job completed in ${duration} seconds.`);
    await primaryPool.end();
    process.exit(0);
  }
}

// Run the task
archiveOldEvents();
