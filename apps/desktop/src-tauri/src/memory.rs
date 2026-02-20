//! Local persistent memory backed by an embedded SQLite database.
//!
//! All memory data lives on the user's machine — nothing is sent to any server.
//! The database file is stored in the Tauri app data directory:
//!   macOS  → ~/Library/Application Support/com.ai-super-app.desktop/memory.db
//!   Linux  → ~/.local/share/com.ai-super-app.desktop/memory.db
//!   Windows→ %APPDATA%\com.ai-super-app.desktop\memory.db
//!
//! # Memory types
//! - `fact`        — Remembered fact ("User's name is Hung")
//! - `preference`  — Stated preference ("Prefers Vietnamese responses")
//! - `instruction` — Standing instruction ("Always show code in TypeScript")
//! - `episode`     — Significant past event ("Discussed Project X on 2026-01-15")
//! - `summary`     — Rolling conversation summary (auto-generated)
//! - `workflow`    — Saved multi-step task definition
//!
//! # Conversation history
//! Full conversation turns are stored in `conversation_messages`.
//! The AI always receives the N most recent turns plus injected memories.

use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

// ── DB state ───────────────────────────────────────────────────────────────────

/// Thread-safe SQLite connection held in Tauri's managed state.
pub struct MemoryDb(pub Mutex<Connection>);

// ── Schema ─────────────────────────────────────────────────────────────────────

const SCHEMA: &str = r#"
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS memories (
    id           TEXT    NOT NULL PRIMARY KEY,
    type         TEXT    NOT NULL DEFAULT 'fact',
    scope        TEXT    NOT NULL DEFAULT '',
    title        TEXT    NOT NULL,
    content      TEXT    NOT NULL,
    source       TEXT    NOT NULL DEFAULT 'user',
    access_count INTEGER NOT NULL DEFAULT 0,
    archived     INTEGER NOT NULL DEFAULT 0,   -- SQLite bool
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL,
    accessed_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_memories_active
    ON memories (archived, access_count DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memories_scope
    ON memories (scope, archived);

CREATE INDEX IF NOT EXISTS idx_memories_type
    ON memories (type, archived);

CREATE TABLE IF NOT EXISTS conversation_messages (
    id         TEXT    NOT NULL PRIMARY KEY,
    session_id TEXT    NOT NULL,
    role       TEXT    NOT NULL,   -- 'user' | 'assistant' | 'system'
    content    TEXT    NOT NULL,
    created_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conv_session
    ON conversation_messages (session_id, created_at ASC);
"#;

// ── Response types ─────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct MemoryEntry {
    pub id: String,
    #[serde(rename = "type")]
    pub memory_type: String,
    pub scope: String,
    pub title: String,
    pub content: String,
    pub source: String,
    pub access_count: i64,
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
    pub accessed_at: Option<String>,
}

#[derive(Deserialize)]
pub struct UpsertMemoryInput {
    #[serde(rename = "type")]
    pub memory_type: Option<String>,
    pub scope: Option<String>,
    pub title: String,
    pub content: String,
    pub source: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct ConversationMessage {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
}

// ── Initialiser ────────────────────────────────────────────────────────────────

/// Open (or create) the local memory database, apply the schema, and return
/// a `MemoryDb` ready to be managed by Tauri.
pub fn open_db(app: &AppHandle) -> Result<MemoryDb, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir unavailable: {e}"))?;

    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("create data dir failed: {e}"))?;

    let db_path = data_dir.join("memory.db");
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("sqlite open failed: {e}"))?;

    conn.execute_batch(SCHEMA)
        .map_err(|e| format!("schema migration failed: {e}"))?;

    Ok(MemoryDb(Mutex::new(conn)))
}

// ── Memory commands ────────────────────────────────────────────────────────────

/// Upsert a memory entry.
/// If a memory with the same `title` already exists it is updated; otherwise
/// a new entry is inserted.
#[tauri::command]
pub fn memory_upsert(
    db: State<'_, MemoryDb>,
    input: UpsertMemoryInput,
) -> Result<MemoryEntry, String> {
    let conn = db.0.lock().map_err(|_| "db lock poisoned")?;
    let now = Utc::now().to_rfc3339();
    let memory_type = input.memory_type.unwrap_or_else(|| "fact".into());
    let scope = input.scope.unwrap_or_default();
    let source = input.source.unwrap_or_else(|| "user".into());

    // Try to find an existing entry by title (case-insensitive).
    let existing_id: Option<String> = conn
        .query_row(
            "SELECT id FROM memories WHERE lower(title) = lower(?1)",
            params![&input.title],
            |row| row.get(0),
        )
        .ok();

    let id = if let Some(eid) = existing_id {
        conn.execute(
            "UPDATE memories SET type=?1, scope=?2, content=?3, source=?4,
             archived=0, updated_at=?5 WHERE id=?6",
            params![memory_type, scope, input.content, source, now, eid],
        )
        .map_err(|e| format!("update failed: {e}"))?;
        eid
    } else {
        let new_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO memories (id,type,scope,title,content,source,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?7)",
            params![new_id, memory_type, scope, input.title, input.content, source, now],
        )
        .map_err(|e| format!("insert failed: {e}"))?;
        new_id
    };

    fetch_memory_by_id(&conn, &id)
}

/// List active (non-archived) memories, optionally filtered by scope and/or type.
/// Results are ordered by access_count DESC, created_at DESC.
#[tauri::command]
pub fn memory_list(
    db: State<'_, MemoryDb>,
    scope: Option<String>,
    memory_type: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<MemoryEntry>, String> {
    let conn = db.0.lock().map_err(|_| "db lock poisoned")?;

    let mut sql = String::from(
        "SELECT id,type,scope,title,content,source,access_count,archived,
                created_at,updated_at,accessed_at
         FROM memories WHERE archived=0",
    );
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    if let Some(ref s) = scope {
        sql.push_str(&format!(" AND (scope=?{} OR scope='')", params_vec.len() + 1));
        params_vec.push(Box::new(s.clone()));
    }
    if let Some(ref t) = memory_type {
        sql.push_str(&format!(" AND type=?{}", params_vec.len() + 1));
        params_vec.push(Box::new(t.clone()));
    }

    sql.push_str(" ORDER BY access_count DESC, created_at DESC");

    if let Some(n) = limit {
        sql.push_str(&format!(" LIMIT {n}"));
    }

    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

    let mut stmt = conn.prepare(&sql).map_err(|e| format!("prepare failed: {e}"))?;
    let rows = stmt
        .query_map(param_refs.as_slice(), row_to_memory)
        .map_err(|e| format!("query failed: {e}"))?;

    let mut entries = vec![];
    for row in rows {
        entries.push(row.map_err(|e| format!("row error: {e}"))?);
    }
    Ok(entries)
}

/// Get a single memory entry by ID.
#[tauri::command]
pub fn memory_get(db: State<'_, MemoryDb>, id: String) -> Result<MemoryEntry, String> {
    let conn = db.0.lock().map_err(|_| "db lock poisoned")?;
    fetch_memory_by_id(&conn, &id)
}

/// Soft-delete (archive) a memory entry.
#[tauri::command]
pub fn memory_delete(db: State<'_, MemoryDb>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|_| "db lock poisoned")?;
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE memories SET archived=1, updated_at=?1 WHERE id=?2",
        params![now, id],
    )
    .map_err(|e| format!("delete failed: {e}"))?;
    Ok(())
}

/// Permanently delete all archived memories (garbage-collect).
#[tauri::command]
pub fn memory_purge_archived(db: State<'_, MemoryDb>) -> Result<usize, String> {
    let conn = db.0.lock().map_err(|_| "db lock poisoned")?;
    let n = conn
        .execute("DELETE FROM memories WHERE archived=1", [])
        .map_err(|e| format!("purge failed: {e}"))?;
    Ok(n)
}

/// Build a system-prompt string from active memories, ready to be prepended
/// to any AI request. Increments access_count for returned entries.
#[tauri::command]
pub fn memory_build_context(
    db: State<'_, MemoryDb>,
    scope: Option<String>,
    max_entries: Option<i64>,
) -> Result<String, String> {
    let conn = db.0.lock().map_err(|_| "db lock poisoned")?;
    let limit = max_entries.unwrap_or(12);

    let mut sql = String::from(
        "SELECT id,type,scope,title,content,source,access_count,archived,
                created_at,updated_at,accessed_at
         FROM memories WHERE archived=0",
    );
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    if let Some(ref s) = scope {
        sql.push_str(&format!(" AND (scope=?{} OR scope='')", params_vec.len() + 1));
        params_vec.push(Box::new(s.clone()));
    }
    sql.push_str(&format!(
        " ORDER BY access_count DESC, created_at DESC LIMIT {limit}"
    ));

    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
    let mut stmt = conn.prepare(&sql).map_err(|e| format!("prepare: {e}"))?;
    let rows = stmt
        .query_map(param_refs.as_slice(), row_to_memory)
        .map_err(|e| format!("query: {e}"))?;

    let mut memories: Vec<MemoryEntry> = vec![];
    for row in rows {
        memories.push(row.map_err(|e| format!("row: {e}"))?);
    }

    if memories.is_empty() {
        return Ok(String::new());
    }

    // Touch access counts.
    let ids: Vec<String> = memories.iter().map(|m| format!("'{}'", m.id)).collect();
    let now = Utc::now().to_rfc3339();
    let _ = conn.execute_batch(&format!(
        "UPDATE memories SET access_count=access_count+1, accessed_at='{now}'
         WHERE id IN ({})",
        ids.join(",")
    ));

    // Build the system prompt block.
    let mut out = String::from(
        "## Persistent Memory\nThe following has been remembered from previous conversations.\n\n",
    );

    let type_order = ["instruction", "preference", "fact", "workflow", "episode", "summary"];
    for t in type_order {
        let group: Vec<&MemoryEntry> = memories.iter().filter(|m| m.memory_type == t).collect();
        if group.is_empty() {
            continue;
        }
        let label = t[..1].to_uppercase() + &t[1..];
        out.push_str(&format!("### {label}\n"));
        for m in group {
            out.push_str(&format!("- **{}**: {}\n", m.title, m.content));
        }
        out.push('\n');
    }

    Ok(out)
}

// ── Conversation history commands ──────────────────────────────────────────────

/// Append one or more messages to a conversation session.
#[tauri::command]
pub fn memory_append_messages(
    db: State<'_, MemoryDb>,
    session_id: String,
    messages: Vec<serde_json::Value>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|_| "db lock poisoned")?;
    let now = Utc::now().to_rfc3339();

    for msg in messages {
        let role = msg["role"].as_str().unwrap_or("user").to_string();
        let content = msg["content"].as_str().unwrap_or("").to_string();
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO conversation_messages (id,session_id,role,content,created_at)
             VALUES (?1,?2,?3,?4,?5)",
            params![id, session_id, role, content, now],
        )
        .map_err(|e| format!("insert message failed: {e}"))?;
    }
    Ok(())
}

/// Return the N most recent messages for a session, in chronological order.
#[tauri::command]
pub fn memory_get_history(
    db: State<'_, MemoryDb>,
    session_id: String,
    limit: Option<i64>,
) -> Result<Vec<ConversationMessage>, String> {
    let conn = db.0.lock().map_err(|_| "db lock poisoned")?;
    let n = limit.unwrap_or(40);

    // Fetch last N in descending order, then reverse.
    let mut stmt = conn
        .prepare(
            "SELECT id,session_id,role,content,created_at
             FROM (
                 SELECT id,session_id,role,content,created_at
                 FROM conversation_messages
                 WHERE session_id=?1
                 ORDER BY created_at DESC
                 LIMIT ?2
             ) ORDER BY created_at ASC",
        )
        .map_err(|e| format!("prepare: {e}"))?;

    let rows = stmt
        .query_map(params![session_id, n], |row| {
            Ok(ConversationMessage {
                id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| format!("query: {e}"))?;

    let mut msgs = vec![];
    for row in rows {
        msgs.push(row.map_err(|e| format!("row: {e}"))?);
    }
    Ok(msgs)
}

/// Clear all messages for a session (e.g. when the user starts a fresh chat).
#[tauri::command]
pub fn memory_clear_session(db: State<'_, MemoryDb>, session_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|_| "db lock poisoned")?;
    conn.execute(
        "DELETE FROM conversation_messages WHERE session_id=?1",
        params![session_id],
    )
    .map_err(|e| format!("clear session: {e}"))?;
    Ok(())
}

/// Return memory statistics (total count by type, total messages).
#[tauri::command]
pub fn memory_stats(db: State<'_, MemoryDb>) -> Result<serde_json::Value, String> {
    let conn = db.0.lock().map_err(|_| "db lock poisoned")?;

    let total_memories: i64 = conn
        .query_row("SELECT COUNT(*) FROM memories WHERE archived=0", [], |r| r.get(0))
        .unwrap_or(0);

    let total_messages: i64 = conn
        .query_row("SELECT COUNT(*) FROM conversation_messages", [], |r| r.get(0))
        .unwrap_or(0);

    let mut by_type = serde_json::Map::new();
    let mut stmt = conn
        .prepare("SELECT type, COUNT(*) FROM memories WHERE archived=0 GROUP BY type")
        .map_err(|e| format!("stats prepare: {e}"))?;
    let rows = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)))
        .map_err(|e| format!("stats query: {e}"))?;
    for row in rows.flatten() {
        by_type.insert(row.0, serde_json::Value::Number(row.1.into()));
    }

    Ok(serde_json::json!({
        "total_memories": total_memories,
        "total_messages": total_messages,
        "by_type": by_type
    }))
}

// ── Internal helpers ───────────────────────────────────────────────────────────

fn fetch_memory_by_id(conn: &Connection, id: &str) -> Result<MemoryEntry, String> {
    conn.query_row(
        "SELECT id,type,scope,title,content,source,access_count,archived,
                created_at,updated_at,accessed_at
         FROM memories WHERE id=?1",
        params![id],
        row_to_memory,
    )
    .map_err(|e| format!("fetch failed: {e}"))
}

fn row_to_memory(row: &rusqlite::Row<'_>) -> rusqlite::Result<MemoryEntry> {
    Ok(MemoryEntry {
        id: row.get(0)?,
        memory_type: row.get(1)?,
        scope: row.get(2)?,
        title: row.get(3)?,
        content: row.get(4)?,
        source: row.get(5)?,
        access_count: row.get(6)?,
        archived: row.get::<_, i64>(7)? != 0,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
        accessed_at: row.get(10)?,
    })
}
