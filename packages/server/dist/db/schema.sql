-- ShowPulse Database Schema

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS shows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  fps INTEGER NOT NULL DEFAULT 30,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cue_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES cue_groups(id) ON DELETE SET NULL,
  cue_number TEXT NOT NULL,
  label TEXT NOT NULL,
  tc_trigger INTEGER NOT NULL,  -- total frames from 00:00:00:00
  warning_seconds INTEGER NOT NULL DEFAULT 10,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Many-to-many: a cue can target multiple departments
CREATE TABLE IF NOT EXISTS cue_departments (
  cue_id INTEGER NOT NULL REFERENCES cues(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  PRIMARY KEY (cue_id, department_id)
);

CREATE TABLE IF NOT EXISTS show_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  cue_id INTEGER REFERENCES cues(id) ON DELETE SET NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  payload TEXT,  -- JSON string
  tc_frames INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cues_show_trigger ON cues(show_id, tc_trigger);
CREATE INDEX IF NOT EXISTS idx_cue_departments_dept ON cue_departments(department_id);
CREATE INDEX IF NOT EXISTS idx_show_log_show ON show_log(show_id, created_at);
CREATE INDEX IF NOT EXISTS idx_departments_show ON departments(show_id);
CREATE INDEX IF NOT EXISTS idx_cue_groups_show ON cue_groups(show_id);
