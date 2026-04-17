CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed', 'deleted')),
  category TEXT CHECK (category IN ('bug', 'suggestion', 'question', 'other')),
  comment TEXT NOT NULL CHECK (length(comment) <= 2000),
  selector TEXT,
  url TEXT,
  viewport_width INTEGER,
  viewport_height INTEGER,
  user_agent TEXT,
  created_by TEXT NOT NULL DEFAULT 'anonymous',
  capture_method TEXT NOT NULL DEFAULT 'html2canvas' CHECK (capture_method IN ('html2canvas', 'native')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_feedback_project_id ON feedback(project_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_project_status ON feedback(project_id, status);