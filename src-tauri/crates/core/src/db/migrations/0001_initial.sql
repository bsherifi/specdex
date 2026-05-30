-- Specdex v1 initial schema. Implements SPECDEX-V1.md §11.1.
-- Forward-only; never edit this file after release. Future changes go in
-- subsequent migration files (0002_xxx.sql, ...).

PRAGMA foreign_keys = ON;

CREATE TABLE knowledge_bases (
    id                      TEXT PRIMARY KEY,
    name                    TEXT NOT NULL UNIQUE,
    description             TEXT,
    schema_json             TEXT NOT NULL,
    primary_field           TEXT NOT NULL,
    searchable_fields_json  TEXT NOT NULL,
    highlight_color         TEXT NOT NULL,
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL,
    edited_by               TEXT
) STRICT;

CREATE TABLE source_documents (
    id                  TEXT PRIMARY KEY,
    filename            TEXT NOT NULL,
    stored_path         TEXT NOT NULL,
    content_sha256      TEXT NOT NULL,
    mime_type           TEXT NOT NULL,
    page_count          INTEGER NOT NULL,
    parsed_text         TEXT NOT NULL,
    parsed_spans_json   TEXT NOT NULL,
    ocr_used            INTEGER NOT NULL DEFAULT 0,
    ingested_at         TEXT NOT NULL,
    ingested_by         TEXT
) STRICT;

CREATE INDEX idx_source_documents_ingested_at
    ON source_documents (ingested_at DESC);

CREATE TABLE entries (
    id                  TEXT PRIMARY KEY,
    kb_id               TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    primary_value       TEXT NOT NULL,
    data_json           TEXT NOT NULL,
    aliases_json        TEXT NOT NULL DEFAULT '[]',
    source_doc_id       TEXT REFERENCES source_documents(id) ON DELETE SET NULL,
    source_page         INTEGER,
    source_bbox_json    TEXT,
    source_text         TEXT,
    notes               TEXT,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    edited_by           TEXT
) STRICT;

CREATE INDEX idx_entries_kb_id          ON entries (kb_id);
CREATE INDEX idx_entries_kb_id_primary  ON entries (kb_id, primary_value);
CREATE INDEX idx_entries_source_doc_id  ON entries (source_doc_id);

CREATE TABLE identity (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    display_name    TEXT NOT NULL,
    created_at      TEXT NOT NULL
) STRICT;

CREATE TABLE app_meta (
    key     TEXT PRIMARY KEY,
    value   TEXT NOT NULL
) STRICT;

CREATE TABLE schema_history (
    id                          TEXT PRIMARY KEY,
    kb_id                       TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    previous_schema_json        TEXT NOT NULL,
    previous_primary_field      TEXT NOT NULL,
    diff_summary_json           TEXT NOT NULL,
    migrated_at                 TEXT NOT NULL,
    migrated_by                 TEXT
) STRICT;

CREATE INDEX idx_schema_history_kb_id ON schema_history (kb_id);
