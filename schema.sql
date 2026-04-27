-- TrackFlow Scalability Schema
-- Improved for Large-Scale Data Growth with Partitioning and Archiving

-- 1. Core Users (Remains unpartitioned as lookups are primary-key based)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    plan VARCHAR(20) DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Sessions (Added index on ended_at for real-time dashboard query)
CREATE TABLE sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER
);

-- Optimization: Fixes sequential scan on 'SELECT * FROM sessions WHERE ended_at IS NULL'
CREATE INDEX idx_sessions_active ON sessions(ended_at) WHERE (ended_at IS NULL);

-- 3. Partitioned Events Table
-- Partitioned by RANGE (created_at) for efficient time-series queries and archiving
CREATE TABLE events (
    id BIGINT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    session_id BIGINT,
    event_type VARCHAR(50) NOT NULL,
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at) -- Partition key MUST be in the primary key
) PARTITION BY RANGE (created_at);

-- Composite Index: Optimizes 'SELECT ... WHERE user_id = X ORDER BY created_at DESC'
CREATE INDEX idx_events_user_time ON events(user_id, created_at DESC);

-- Current Month Partition
CREATE TABLE events_2026_03 PARTITION OF events
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
-- Future Partition 1
CREATE TABLE events_2026_04 PARTITION OF events
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
-- Future Partition 2
CREATE TABLE events_2026_05 PARTITION OF events
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
-- Future Partition 3
CREATE TABLE events_2026_06 PARTITION OF events
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- 4. Events Archive Table (Identical structure, but unpartitioned for historical cold storage)
CREATE TABLE events_archive (
    id BIGINT,
    user_id INTEGER,
    session_id BIGINT,
    event_type VARCHAR(50),
    properties JSONB,
    created_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_events_archive_user ON events_archive(user_id);

-- 5. Partitioned Feature Usage Table
CREATE TABLE feature_usage (
    id BIGINT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    feature_name VARCHAR(100) NOT NULL,
    used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    count INTEGER DEFAULT 1,
    PRIMARY KEY (id, used_at)
) PARTITION BY RANGE (used_at);

-- Composite Index: Optimizes user feature reports
CREATE INDEX idx_usage_user_time ON feature_usage(user_id, used_at DESC);

-- Current Month Partition
CREATE TABLE usage_2026_03 PARTITION OF feature_usage
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
-- Future Partition 1
CREATE TABLE usage_2026_04 PARTITION OF feature_usage
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
-- Future Partition 2
CREATE TABLE usage_2026_05 PARTITION OF feature_usage
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- EXPLANATION COMMENTS:
-- Partitioning by RANGE(created_at) enables 'Partition Pruning'. 
-- PostgreSQL will only scan the partition containing relevant data for queries like 'WHERE created_at > NOW() - INTERVAL '30 days''.
-- For a 300 million row/month dataset, this reduces scan volume by 90%+ compared to a flat table.
-- Composite indexes on (user_id, created_at) prevent expensive sorts on activity stream lookups.
