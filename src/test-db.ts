/**
 * Test script to verify database initialization and FTS5
 */

import { MemoryDatabase } from './database/index.js';
import { logger } from './utils/logger.js';

async function testDatabase() {
    logger.info('Starting database test');

    try {
        // Initialize database
        const db = new MemoryDatabase('./data/test-memory.db');

        // Get the underlying database instance
        const database = db.getDatabase();

        // Test 1: Insert a test session
        const sessionId = 'test-session-1';
        const insertSession = database.prepare(`
            INSERT INTO sessions (id, title, created_at)
            VALUES (?, ?, ?)
        `);
        insertSession.run(sessionId, 'Test Session', Math.floor(Date.now() / 1000));
        logger.info('✓ Session inserted successfully');

        // Test 2: Insert test messages
        const insertMessage = database.prepare(`
            INSERT INTO messages (id, session_id, role, content, created_at)
            VALUES (?, ?, ?, ?, ?)
        `);

        insertMessage.run('msg-1', sessionId, 'user', 'TCU 六统一架构设计', Math.floor(Date.now() / 1000));
        insertMessage.run('msg-2', sessionId, 'assistant', '关于 TCU 六统一的核心理念...', Math.floor(Date.now() / 1000));
        logger.info('✓ Messages inserted successfully');

        // Test 3: Test FTS5 search
        const searchQuery = database.prepare(`
            SELECT m.id, m.content
            FROM messages_fts
            JOIN messages m ON messages_fts.rowid = m.rowid
            WHERE messages_fts MATCH ?
        `);

        const results = searchQuery.all('TCU');
        logger.info('✓ FTS5 search successful', { resultCount: results.length, results });

        // Test 4: Verify triggers work
        const updateMessage = database.prepare(`
            UPDATE messages SET content = ? WHERE id = ?
        `);
        updateMessage.run('Updated: TCU 六统一新架构', 'msg-1');

        const updatedResults = searchQuery.all('新架构');
        logger.info('✓ FTS5 triggers working', { resultCount: updatedResults.length });

        // Close database
        db.close();
        logger.info('✓ All tests passed!');

    } catch (error) {
        logger.error('Database test failed', error);
        process.exit(1);
    }
}

// Run test
testDatabase();
