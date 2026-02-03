/**
 * Memory Save Tools
 * Implements memory_save_session and memory_save_messages
 */

import type { MemoryDatabase } from '../database/index.js';
import { MemoryRepository } from '../database/repository.js';
import {
    memorySaveSessionSchema,
    memorySaveMessagesSchema,
    type MemorySaveSessionInput,
    type MemorySaveMessagesInput,
} from '../schemas/tool-schemas.js';
import { logger } from '../utils/logger.js';

/**
 * Handle memory_save_session tool call
 */
export async function handleMemorySaveSession(
    args: unknown,
    db: MemoryDatabase
): Promise<any> {
    // Validate input
    const input = memorySaveSessionSchema.parse(args) as MemorySaveSessionInput;

    logger.debug('Handling memory_save_session', { title: input.title });

    try {
        const repository = new MemoryRepository(db.getDatabase());
        const session = repository.createSession(input);

        return {
            success: true,
            session_id: session.id,
            title: session.title,
            created_at: session.created_at,
            tags: session.tags,
            meta: session.meta,
        };
    } catch (error) {
        logger.error('Failed to save session', error);
        throw new Error(`Failed to create session: ${(error as Error).message}`);
    }
}

/**
 * Handle memory_save_messages tool call
 */
export async function handleMemorySaveMessages(
    args: unknown,
    db: MemoryDatabase
): Promise<any> {
    // Validate input
    const input = memorySaveMessagesSchema.parse(args) as MemorySaveMessagesInput;

    logger.debug('Handling memory_save_messages', {
        sessionId: input.session_id,
        messageCount: input.messages.length,
    });

    try {
        const repository = new MemoryRepository(db.getDatabase());

        // Check if session exists
        const session = repository.getSession(input.session_id);
        if (!session) {
            throw new Error(`Session not found: ${input.session_id}`);
        }

        // Save messages
        const messages = repository.saveMessages(
            input.messages.map(msg => ({
                session_id: input.session_id,
                role: msg.role,
                content: msg.content,
                created_at: msg.created_at,
            }))
        );

        return {
            success: true,
            session_id: input.session_id,
            saved_count: messages.length,
            message_ids: messages.map(m => m.id),
        };
    } catch (error) {
        logger.error('Failed to save messages', error);
        throw new Error(`Failed to save messages: ${(error as Error).message}`);
    }
}
