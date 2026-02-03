/**
 * Tool routing and dispatch
 * Routes tool calls to appropriate handlers
 */

import type { MemoryDatabase } from '../database/index.js';
import { handleMemorySaveSession, handleMemorySaveMessages } from './memory-save.js';
import { handleMemoryListSessions, handleMemoryGetSession } from './memory-query.js';
import { handleMemorySearch } from './memory-search.js';
import { handleMemorySummarizeSession } from './memory-summarize.js';
import { handleMemoryInject } from './memory-inject.js';
import { logger } from '../utils/logger.js';

/**
 * Route tool call to appropriate handler
 */
export async function handleToolCall(
    name: string,
    args: unknown,
    db: MemoryDatabase
): Promise<any> {
    logger.debug('Routing tool call', { tool: name });

    switch (name) {
        case 'memory_save_session':
            return await handleMemorySaveSession(args, db);

        case 'memory_save_messages':
            return await handleMemorySaveMessages(args, db);

        case 'memory_list_sessions':
            return await handleMemoryListSessions(args, db);

        case 'memory_get_session':
            return await handleMemoryGetSession(args, db);

        case 'memory_search':
            return await handleMemorySearch(args, db);

        case 'memory_summarize_session':
            return await handleMemorySummarizeSession(args, db);

        case 'memory_inject':
            return await handleMemoryInject(args, db);

        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}
