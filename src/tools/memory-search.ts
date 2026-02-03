/**
 * Memory Search Tool
 * Implements memory_search using FTS5 full-text search
 */

import type { MemoryDatabase } from '../database/index.js';
import { MemoryRepository } from '../database/repository.js';
import { FTS5QueryBuilder } from '../database/fts.js';
import {
    memorySearchSchema,
    type MemorySearchInput,
} from '../schemas/tool-schemas.js';
import { logger } from '../utils/logger.js';

/**
 * Handle memory_search tool call
 */
export async function handleMemorySearch(
    args: unknown,
    db: MemoryDatabase
): Promise<any> {
    // Validate input
    const input = memorySearchSchema.parse(args) as MemorySearchInput;

    logger.debug('Handling memory_search', {
        query: input.query,
        topK: input.top_k,
        timeRangeDays: input.time_range_days,
    });

    try {
        const repository = new MemoryRepository(db.getDatabase());

        // Build FTS5 query using smart search
        const fts5Query = FTS5QueryBuilder.smartSearch(input.query);

        // Perform search
        const startTime = Date.now();
        const hits = repository.searchMessages({
            query: fts5Query,
            top_k: input.top_k,
            time_range_days: input.time_range_days,
            tags: input.tags,
            session_id: input.session_id,
        });
        const queryTime = Date.now() - startTime;

        return {
            hits: hits.map(hit => ({
                message_id: hit.message_id,
                session_id: hit.session_id,
                session_title: hit.session_title,
                snippet: hit.snippet.substring(0, 200) + (hit.snippet.length > 200 ? '...' : ''),
                relevance_score: hit.relevance_score,
                created_at: hit.created_at,
            })),
            total_hits: hits.length,
            query_time_ms: queryTime,
            query: input.query,
            fts5_query: fts5Query,
        };
    } catch (error) {
        logger.error('Failed to search messages', error);
        throw new Error(`Failed to search messages: ${(error as Error).message}`);
    }
}
