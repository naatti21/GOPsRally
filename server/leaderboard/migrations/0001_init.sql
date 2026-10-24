-- Isolated GOPs Rally STAGING D1 database. Do not apply to databases belonging to other apps.
CREATE TABLE IF NOT EXISTS players (
 player_id TEXT PRIMARY KEY NOT NULL,
 secret_hash TEXT NOT NULL UNIQUE,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
 run_id TEXT PRIMARY KEY NOT NULL,
 player_id TEXT NOT NULL REFERENCES players(player_id),
 secret_hash TEXT NOT NULL,
 board_key TEXT NOT NULL,
 started_at INTEGER NOT NULL,
 last_checkpoint_at INTEGER NOT NULL,
 checkpoint_count INTEGER NOT NULL DEFAULT 0 CHECK (checkpoint_count BETWEEN 0 AND 3),
 finished_at INTEGER,
 finished_lap_ms INTEGER,
 CHECK (finished_at IS NULL OR finished_lap_ms IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_runs_player_time ON runs (player_id, started_at);
CREATE TABLE IF NOT EXISTS records (
 board_key TEXT NOT NULL,
 player_id TEXT NOT NULL REFERENCES players(player_id),
 entry_id TEXT NOT NULL UNIQUE,
 nickname TEXT NOT NULL,
 lap_ms INTEGER NOT NULL CHECK (lap_ms > 0),
 achieved_at INTEGER NOT NULL,
 PRIMARY KEY (board_key,player_id)
);
CREATE INDEX IF NOT EXISTS idx_records_board_rank ON records (board_key, lap_ms ASC, achieved_at ASC, entry_id ASC);
CREATE TABLE IF NOT EXISTS rate_limits (
 player_id TEXT NOT NULL REFERENCES players(player_id),
 bucket INTEGER NOT NULL,
 hits INTEGER NOT NULL,
 PRIMARY KEY (player_id,bucket)
);