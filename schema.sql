PRAGMA foreign_keys = ON;

DROP VIEW IF EXISTS position_submissions;
DROP VIEW IF EXISTS term_aliases;
DROP VIEW IF EXISTS position_variations;

DROP TABLE IF EXISTS benchmark_categories;
DROP TABLE IF EXISTS relationships;
DROP TABLE IF EXISTS aliases;
DROP TABLE IF EXISTS terms;
DROP TABLE IF EXISTS metadata;

CREATE TABLE metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE terms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  family TEXT NOT NULL,
  context TEXT NOT NULL CHECK (context IN ('both', 'gi', 'no_gi')),
  definition TEXT NOT NULL
);

CREATE TABLE aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term_id TEXT NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  language TEXT NOT NULL,
  type TEXT NOT NULL,
  notes TEXT,
  UNIQUE (term_id, alias)
);

CREATE TABLE relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  target_id TEXT NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  notes TEXT,
  UNIQUE (source_id, relationship_type, target_id)
);

CREATE TABLE benchmark_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  default_weight REAL NOT NULL CHECK (default_weight >= 0)
);

CREATE INDEX idx_terms_type ON terms(type);
CREATE INDEX idx_terms_family ON terms(family);
CREATE INDEX idx_terms_context ON terms(context);
CREATE INDEX idx_aliases_term_id ON aliases(term_id);
CREATE INDEX idx_aliases_alias ON aliases(alias);
CREATE INDEX idx_relationships_source ON relationships(source_id, relationship_type);
CREATE INDEX idx_relationships_target ON relationships(target_id, relationship_type);

CREATE VIEW term_aliases AS
SELECT
  t.id AS term_id,
  t.name AS canonical_name,
  a.alias,
  a.language,
  a.type AS alias_type
FROM terms t
JOIN aliases a ON a.term_id = t.id;

CREATE VIEW position_variations AS
SELECT
  parent.id AS parent_id,
  parent.name AS parent_name,
  child.id AS variation_id,
  child.name AS variation_name,
  child.context AS variation_context
FROM relationships r
JOIN terms child ON child.id = r.source_id
JOIN terms parent ON parent.id = r.target_id
WHERE r.relationship_type = 'variation_of';

CREATE VIEW position_submissions AS
SELECT
  position.id AS position_id,
  position.name AS position_name,
  submission.id AS submission_id,
  submission.name AS submission_name,
  submission.context AS submission_context,
  submission.family AS submission_family
FROM relationships r
JOIN terms position ON position.id = r.source_id
JOIN terms submission ON submission.id = r.target_id
WHERE r.relationship_type = 'has_common_submission'
  AND submission.type = 'submission';
