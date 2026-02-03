/**
 * Data access layer (Repository pattern)
 * Encapsulates all database operations for sessions and messages
 */

import Database from 'better-sqlite3';
import { generateSessionId, generateMessageId } from '../utils/id-generator.js';
import { logger } from '../utils/logger.js';
import type {
    Session,
    SessionRow,
    CreateSessionInput,
    Message,
    CreateMessageInput,
    SearchOptions,
    SearchHit,
    ListSessionsOptions,
} from '../schemas/types.js';

export class MemoryRepository {
    private db: Database.Database;
    private preparedStatements: Map<string, Database.Statement> = new Map();

    constructor(db: Database.Database) {
        this.db = db;
    }

    // =====================
    // Session Operations
    // =====================

    /**
     * Create a new session
     */
    createSession(input: CreateSessionInput): Session {
        const sessionId = generateSessionId();
        const now = Math.floor(Date.now() / 1000);

        const stmt = this.getPreparedStatement(`
            INSERT INTO sessions (id, title, tags, meta, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            sessionId,
            input.title,
            input.tags ? JSON.stringify(input.tags) : null,
            input.meta ? JSON.stringify(input.meta) : null,
            now,
            now
        );

        logger.debug('Session created', { sessionId, title: input.title });

        return {
            id: sessionId,
            title: input.title,
            tags: input.tags || [],
            meta: input.meta || {},
            created_at: now,
            updated_at: now,
        };
    }

    /**
     * Get session by ID
     */
    getSession(sessionId: string): Session | null {
        const stmt = this.getPreparedStatement(`
            SELECT * FROM sessions WHERE id = ?
        `);

        const row = stmt.get(sessionId) as SessionRow | undefined;
        if (!row) return null;

        return this.parseSessionRow(row);
    }

    /**
     * List sessions with pagination and optional tag filtering
     */
    listSessions(options: ListSessionsOptions): { sessions: Session[]; total: number } {
        const { limit = 20, offset = 0, tags } = options;

        let query = 'SELECT * FROM sessions';
        let countQuery = 'SELECT COUNT(*) as total FROM sessions';
        const params: any[] = [];

        // Add tag filtering if provided
        if (tags && tags.length > 0) {
            // Simple JSON LIKE matching (can be improved with JSON1 extension)
            const tagConditions = tags.map(() => 'tags LIKE ?').join(' AND ');
            query += ` WHERE ${tagConditions}`;
            countQuery += ` WHERE ${tagConditions}`;

            tags.forEach(tag => {
                params.push(`%"${tag}"%`);
            });
        }

        // Add ordering and pagination
        query += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        // Get total count
        const countParams = tags ? tags.map(tag => `%"${tag}"%`) : [];
        const countStmt = this.db.prepare(countQuery);
        const { total } = countStmt.get(...countParams) as { total: number };

        // Get sessions
        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params) as SessionRow[];

        const sessions = rows.map(row => this.parseSessionRow(row));

        logger.debug('Sessions listed', { count: sessions.length, total });

        return { sessions, total };
    }

    /**
     * Update session timestamp (called when messages are added)
     */
    updateSessionTimestamp(sessionId: string): void {
        const now = Math.floor(Date.now() / 1000);
        const stmt = this.getPreparedStatement(`
            UPDATE sessions SET updated_at = ? WHERE id = ?
        `);
        stmt.run(now, sessionId);
    }

    /**
     * Update session summary cache
     */
    updateSessionSummary(
        sessionId: string,
        updates: { summary_brief?: string; summary_detailed?: string }
    ): void {
        const fields: string[] = [];
        const values: any[] = [];

        if (updates.summary_brief !== undefined) {
            fields.push('summary_brief = ?');
            values.push(updates.summary_brief);
        }

        if (updates.summary_detailed !== undefined) {
            fields.push('summary_detailed = ?');
            values.push(updates.summary_detailed);
        }

        if (fields.length === 0) return;

        values.push(sessionId);
        const query = `UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`;

        const stmt = this.db.prepare(query);
        stmt.run(...values);

        logger.debug('Session summary updated', { sessionId, fields: Object.keys(updates) });
    }

    // =====================
    // Message Operations
    // =====================

    /**
     * Save messages to a session (batch insert with transaction)
     */
    saveMessages(messages: CreateMessageInput[]): Message[] {
        const insertStmt = this.getPreparedStatement(`
            INSERT INTO messages (id, session_id, role, content, created_at)
            VALUES (?, ?, ?, ?, ?)
        `);

        const savedMessages: Message[] = [];

        // Use transaction for batch insert
        const transaction = this.db.transaction(() => {
            for (const msg of messages) {
                const messageId = generateMessageId();
                const createdAt = msg.created_at || Math.floor(Date.now() / 1000);

                insertStmt.run(
                    messageId,
                    msg.session_id,
                    msg.role,
                    msg.content,
                    createdAt
                );

                savedMessages.push({
                    id: messageId,
                    session_id: msg.session_id,
                    role: msg.role,
                    content: msg.content,
                    created_at: createdAt,
                });
            }

            // Update session timestamp
            if (messages.length > 0) {
                this.updateSessionTimestamp(messages[0].session_id);
            }
        });

        transaction();

        logger.debug('Messages saved', { count: savedMessages.length });

        return savedMessages;
    }

    /**
     * Get messages for a session
     */
    getSessionMessages(sessionId: string, limit = 100, offset = 0): Message[] {
        const stmt = this.getPreparedStatement(`
            SELECT * FROM messages
            WHERE session_id = ?
            ORDER BY created_at ASC
            LIMIT ? OFFSET ?
        `);

        const rows = stmt.all(sessionId, limit, offset) as Message[];

        logger.debug('Messages retrieved', { sessionId, count: rows.length });

        return rows;
    }

    /**
     * Get message count for a session
     */
    getMessageCount(sessionId: string): number {
        const stmt = this.getPreparedStatement(`
            SELECT COUNT(*) as count FROM messages WHERE session_id = ?
        `);

        const { count } = stmt.get(sessionId) as { count: number };
        return count;
    }

    // =====================
    // Search Operations (FTS5)
    // =====================

    /**
     * Search messages using FTS5
     */
    searchMessages(options: SearchOptions): SearchHit[] {
        const {
            query,
            top_k = 5,
            time_range_days = 180,
            tags,
            session_id,
        } = options;

        const timeThreshold = Math.floor(Date.now() / 1000) - (time_range_days * 86400);

        let sql = `
            SELECT
                m.id as message_id,
                m.session_id,
                s.title as session_title,
                m.content,
                m.content as snippet,
                rank as relevance_score,
                m.created_at
            FROM messages_fts
            JOIN messages m ON messages_fts.rowid = m.rowid
            JOIN sessions s ON m.session_id = s.id
            WHERE messages_fts MATCH ?
                AND m.created_at > ?
        `;

        const params: any[] = [query, timeThreshold];

        // Filter by session_id
        if (session_id) {
            sql += ' AND m.session_id = ?';
            params.push(session_id);
        }

        // Filter by tags (if provided)
        if (tags && tags.length > 0) {
            const tagConditions = tags.map(() => 's.tags LIKE ?').join(' AND ');
            sql += ` AND (${tagConditions})`;
            tags.forEach(tag => params.push(`%"${tag}"%`));
        }

        sql += ' ORDER BY rank LIMIT ?';
        params.push(top_k);

        const startTime = Date.now();
        const stmt = this.db.prepare(sql);
        const results = stmt.all(...params) as SearchHit[];
        const queryTime = Date.now() - startTime;

        logger.debug('Search completed', {
            query,
            resultCount: results.length,
            queryTimeMs: queryTime,
        });

        return results;
    }

    // =====================
    // Helper Methods
    // =====================

    /**
     * Parse SessionRow from database to Session object
     */
    private parseSessionRow(row: SessionRow): Session {
        return {
            id: row.id,
            title: row.title,
            tags: row.tags ? JSON.parse(row.tags) : [],
            meta: row.meta ? JSON.parse(row.meta) : {},
            created_at: row.created_at,
            updated_at: row.updated_at || undefined,
            summary_brief: row.summary_brief || undefined,
            summary_detailed: row.summary_detailed || undefined,
        };
    }

    /**
     * Get or create prepared statement (for performance)
     */
    private getPreparedStatement(sql: string): Database.Statement {
        if (!this.preparedStatements.has(sql)) {
            this.preparedStatements.set(sql, this.db.prepare(sql));
        }
        return this.preparedStatements.get(sql)!;
    }

    /**
     * Close all prepared statements
     */
    close(): void {
        // Better-sqlite3 v11+ doesn't need explicit finalization
        this.preparedStatements.clear();
    }
}
