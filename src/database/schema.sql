-- =====================================================
-- ChatMemory MCP Server - Database Schema
-- =====================================================

-- =====================
-- 1. Sessions Table
-- =====================
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    tags TEXT,                       -- JSON array string: ["tag1", "tag2"]
    meta TEXT,                       -- JSON object string: {"key": "value"}
    created_at INTEGER NOT NULL,     -- Unix timestamp (seconds)
    updated_at INTEGER,              -- Unix timestamp (seconds)
    summary_brief TEXT,              -- Cached brief summary
    summary_detailed TEXT            -- Cached detailed summary
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);

-- =====================
-- 2. Messages Table
-- =====================
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,     -- Unix timestamp (seconds)
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- =====================
-- 3. FTS5 Full-Text Search Table
-- =====================
-- Create FTS5 virtual table for message content search
-- UNINDEXED columns are not searchable but can be used for filtering
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    content,                         -- Indexed field (searchable)
    session_id UNINDEXED,            -- Not searchable, only for filtering
    created_at UNINDEXED,            -- Not searchable, only for filtering
    content='messages',              -- Associated table
    content_rowid='rowid',           -- Row ID mapping
    tokenize='porter unicode61'      -- Tokenizer: porter (English stemming) + unicode61 (multilingual)
);

-- =====================
-- 4. FTS5 Synchronization Triggers
-- =====================
-- These triggers keep the FTS5 index in sync with the messages table

-- Trigger: Insert new message
CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, content, session_id, created_at)
    VALUES (new.rowid, new.content, new.session_id, new.created_at);
END;

-- Trigger: Delete message
CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, content)
    VALUES('delete', old.rowid, old.content);
END;

-- Trigger: Update message (before - delete old content)
CREATE TRIGGER IF NOT EXISTS messages_au_delete BEFORE UPDATE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, content)
    VALUES('delete', old.rowid, old.content);
END;

-- Trigger: Update message (after - insert new content)
CREATE TRIGGER IF NOT EXISTS messages_au_insert AFTER UPDATE ON messages BEGIN
    INSERT INTO messages_fts(rowid, content, session_id, created_at)
    VALUES (new.rowid, new.content, new.session_id, new.created_at);
END;
