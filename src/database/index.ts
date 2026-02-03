/**
 * Database manager for ChatMemory MCP Server
 * Handles SQLite database initialization and configuration
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class MemoryDatabase {
    private db: Database.Database;

    constructor(dbPath: string) {
        logger.info('Initializing database', { dbPath });

        try {
            // Open database connection
            this.db = new Database(dbPath);

            // Configure SQLite for optimal performance and safety
            this.configurePragmas();

            // Initialize schema
            this.initializeSchema();

            logger.info('Database initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize database', error);
            throw error;
        }
    }

    /**
     * Configure SQLite pragma settings for performance and safety
     */
    private configurePragmas(): void {
        // Enable WAL mode for better concurrent read/write performance
        this.db.pragma('journal_mode = WAL');

        // Enable foreign key constraints
        this.db.pragma('foreign_keys = ON');

        // Set synchronous mode to NORMAL (balance between safety and performance)
        this.db.pragma('synchronous = NORMAL');

        // Set cache size to 64MB (-64000 pages * 1KB)
        this.db.pragma('cache_size = -64000');

        // Store temporary tables in memory
        this.db.pragma('temp_store = MEMORY');

        // Enable memory-mapped I/O (256MB)
        this.db.pragma('mmap_size = 268435456');

        logger.debug('Database pragmas configured');
    }

    /**
     * Initialize database schema from schema.sql
     */
    private initializeSchema(): void {
        try {
            const schemaPath = join(__dirname, 'schema.sql');
            const schema = readFileSync(schemaPath, 'utf-8');

            // Execute schema SQL
            this.db.exec(schema);

            logger.debug('Database schema initialized');
        } catch (error) {
            logger.error('Failed to initialize schema', error);
            throw error;
        }
    }

    /**
     * Get the underlying Database instance
     */
    getDatabase(): Database.Database {
        return this.db;
    }

    /**
     * Close the database connection
     */
    close(): void {
        try {
            this.db.close();
            logger.info('Database connection closed');
        } catch (error) {
            logger.error('Error closing database', error);
            throw error;
        }
    }

    /**
     * Check if database is open
     */
    isOpen(): boolean {
        return this.db.open;
    }
}
