/**
 * Memory Query Tools
 * Implements memory_list_sessions and memory_get_session
 */

import type { MemoryDatabase } from '../database/index.js';
import { MemoryRepository } from '../database/repository.js';
import {
    memoryListSessionsSchema,
    memoryGetSessionSchema,
    type MemoryListSessionsInput,
    type MemoryGetSessionInput,
} from '../schemas/tool-schemas.js';
import { logger } from '../utils/logger.js';

/**
 * Handle memory_list_sessions tool call
 */
export async function handleMemoryListSessions(
    args: unknown,
    db: MemoryDatabase
): Promise<any> {
    // Validate input
    const input = memoryListSessionsSchema.parse(args) as MemoryListSessionsInput;

    logger.debug('Handling memory_list_sessions', {
        limit: input.limit,
        offset: input.offset,
    });

    try {
        const repository = new MemoryRepository(db.getDatabase());
        const { sessions, total } = repository.listSessions({
            limit: input.limit,
            offset: input.offset,
            tags: input.tags,
        });

        const hasMore = input.offset + sessions.length < total;

        return {
            sessions: sessions.map(s => ({
                id: s.id,
                title: s.title,
                tags: s.tags,
                created_at: s.created_at,
                updated_at: s.updated_at,
                summary_brief: s.summary_brief || null,
            })),
            total,
            has_more: hasMore,
            limit: input.limit,
            offset: input.offset,
        };
    } catch (error) {
        logger.error('Failed to list sessions', error);
        throw new Error(`Failed to list sessions: ${(error as Error).message}`);
    }
}

/**
 * Handle memory_get_session tool call
 */
export async function handleMemoryGetSession(
    args: unknown,
    db: MemoryDatabase
): Promise<any> {
    // Validate input
    const input = memoryGetSessionSchema.parse(args) as MemoryGetSessionInput;

    logger.debug('Handling memory_get_session', {
        sessionId: input.session_id,
        includeMessages: input.include_messages,
    });

    try {
        const repository = new MemoryRepository(db.getDatabase());

        // Get session
        const session = repository.getSession(input.session_id);
        if (!session) {
            throw new Error(`Session not found: ${input.session_id}`);
        }

        // Get messages if requested
        let messages = undefined;
        let messageCount = 0;

        if (input.include_messages) {
            messages = repository.getSessionMessages(
                input.session_id,
                input.message_limit,
                0
            );
            messageCount = repository.getMessageCount(input.session_id);
        } else {
            messageCount = repository.getMessageCount(input.session_id);
        }

        return {
            session: {
                id: session.id,
                title: session.title,
                tags: session.tags,
                meta: session.meta,
                created_at: session.created_at,
                updated_at: session.updated_at,
                summary_brief: session.summary_brief || null,
                summary_detailed: session.summary_detailed || null,
            },
            messages: messages || [],
            message_count: messageCount,
        };
    } catch (error) {
        logger.error('Failed to get session', error);
        throw new Error(`Failed to get session: ${(error as Error).message}`);
    }
}
