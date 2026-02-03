/**
 * Memory Summarize Tool
 * Implements memory_summarize_session
 */

import type { MemoryDatabase } from '../database/index.js';
import { MemoryRepository } from '../database/repository.js';
import { SummarizerService } from '../services/summarizer.js';
import {
    memorySummarizeSessionSchema,
    type MemorySummarizeSessionInput,
} from '../schemas/tool-schemas.js';
import { logger } from '../utils/logger.js';

/**
 * Handle memory_summarize_session tool call
 */
export async function handleMemorySummarizeSession(
    args: unknown,
    db: MemoryDatabase
): Promise<any> {
    // Validate input
    const input = memorySummarizeSessionSchema.parse(args) as MemorySummarizeSessionInput;

    logger.debug('Handling memory_summarize_session', {
        sessionId: input.session_id,
        style: input.style,
        forceRefresh: input.force_refresh,
    });

    try {
        const repository = new MemoryRepository(db.getDatabase());
        const summarizer = new SummarizerService();

        // Get session
        const session = repository.getSession(input.session_id);
        if (!session) {
            throw new Error(`Session not found: ${input.session_id}`);
        }

        // Check cache (unless force_refresh)
        const cachedField = input.style === 'brief' ? 'summary_brief' : 'summary_detailed';
        const cachedSummary = input.style === 'brief' ? session.summary_brief : session.summary_detailed;

        if (!input.force_refresh && cachedSummary) {
            logger.debug('Returning cached summary');
            return {
                session_id: input.session_id,
                style: input.style,
                summary: cachedSummary,
                cached: true,
                generated_at: session.updated_at || session.created_at,
            };
        }

        // Generate new summary
        const messages = repository.getSessionMessages(input.session_id, 500);

        if (messages.length === 0) {
            throw new Error('Session has no messages to summarize');
        }

        const summary = await summarizer.summarizeMessages(messages, input.style);

        // Update cache
        repository.updateSessionSummary(input.session_id, {
            [cachedField]: summary,
        });

        const now = Math.floor(Date.now() / 1000);

        return {
            session_id: input.session_id,
            style: input.style,
            summary,
            cached: false,
            generated_at: now,
        };
    } catch (error) {
        logger.error('Failed to summarize session', error);
        throw new Error(`Failed to summarize session: ${(error as Error).message}`);
    }
}
