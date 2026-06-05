/**
 * Migration 001 — Initial schema
 * Creates employees, face_embeddings, attendance, and settings tables.
 */

export const migration_001 = `
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  employee_code TEXT UNIQUE NOT NULL,
  department TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  enrolled_at INTEGER,
  synced_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS face_embeddings (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  angle TEXT NOT NULL,
  embedding_data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  type TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  liveness_score REAL NOT NULL,
  match_score REAL NOT NULL,
  status TEXT DEFAULT 'PENDING_SYNC',
  synced_at INTEGER,
  device_id TEXT NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_embeddings_employee ON face_embeddings(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance(timestamp);
`;

export const version_001 = 1;
