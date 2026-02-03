#!/usr/bin/env node
/**
 * ChatMemory MCP Server - Main Entry Point
 * A memory management server for CherryStudio using Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { MemoryDatabase } from './database/index.js';
import { registerTools } from './server.js';
import { logger } from './utils/logger.js';

/**
 * Validate required environment variables
 */
function validateEnvironment(): void {
    const required = ['MEMORY_DB_PATH'];
    const missing: string[] = [];

    for (const key of required) {
        if (!process.env[key]) {
            missing.push(key);
        }
    }

    // Check for API key (warning only, not required for basic operations)
    if (!process.env.ANTHROPIC_API_KEY) {
        logger.warn('ANTHROPIC_API_KEY not set - summarization features will be unavailable');
        // Don't exit, allow basic CRUD operations without summarization
    }

    if (missing.length > 0) {
        logger.error('Missing required environment variables', {
            missing,
            help: 'Please set: ' + missing.join(', ')
        });

        // Write to stderr for user visibility
        process.stderr.write(`\nError: Missing required environment variables: ${missing.join(', ')}\n`);
        process.stderr.write('\nPlease configure:\n');
        process.stderr.write('  - MEMORY_DB_PATH: Path to SQLite database file\n');
        process.stderr.write('  - ANTHROPIC_API_KEY: Your Anthropic API key (optional, for summarization)\n\n');
        process.stderr.write('Example:\n');
        process.stderr.write('  export MEMORY_DB_PATH="$HOME/.chememcp/memory.db"\n');
        process.stderr.write('  export ANTHROPIC_API_KEY="sk-ant-api03-..."\n\n');

        process.exit(1);
    }

    // Validate database path directory exists
    const dbPath = process.env.MEMORY_DB_PATH!;
    const dbDir = dirname(dbPath);

    if (!existsSync(dbDir)) {
        logger.info('Creating database directory', { dbDir });
        try {
            mkdirSync(dbDir, { recursive: true });
        } catch (error) {
            logger.error('Failed to create database directory', error, { dbDir });
            process.stderr.write(`\nError: Cannot create directory: ${dbDir}\n`);
            process.stderr.write('Please check permissions or create it manually.\n\n');
            process.exit(1);
        }
    }

    logger.info('Environment validation passed', {
        dbPath,
        apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY,
    });
}

/**
 * Main server initialization
 */
async function main() {
    // Validate environment first
    validateEnvironment();

    const dbPath = process.env.MEMORY_DB_PATH!;

    try {
        // Initialize database
        logger.info('Starting ChatMemory MCP Server', { dbPath });
        const db = new MemoryDatabase(dbPath);

        // Create MCP Server
        const server = new Server(
            {
                name: 'memory-mcp-server',
                version: '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        // Register all tools
        registerTools(server, db);

        // Create STDIO transport
        const transport = new StdioServerTransport();

        // Connect server to transport
        await server.connect(transport);

        logger.info('ChatMemory MCP Server started successfully', {
            version: '1.0.0',
            toolCount: 7,
        });

        // Set up graceful shutdown handlers
        const cleanup = () => {
            logger.info('Shutting down gracefully');
            try {
                db.close();
                logger.info('Database closed');
            } catch (error) {
                logger.error('Error during cleanup', error);
            }
            process.exit(0);
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

    } catch (error) {
        logger.error('Failed to start server', error);
        process.stderr.write(`\nFatal error: ${(error as Error).message}\n\n`);
        process.exit(1);
    }
}

// Global error handlers
process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', err);
    process.stderr.write(`\nUncaught exception: ${err.message}\n`);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', new Error(String(reason)));
    process.stderr.write(`\nUnhandled rejection: ${reason}\n`);
    process.exit(1);
});

// Start the server
main().catch((error) => {
    logger.error('Server startup failed', error);
    process.stderr.write(`\nStartup failed: ${error.message}\n\n`);
    process.exit(1);
});
