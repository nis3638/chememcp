/**
 * Memory Inject Tool
 * Implements memory_inject (CORE FEATURE)
 */

import type { MemoryDatabase } from '../database/index.js';
import { InjectorService } from '../services/injector.js';
import {
    memoryInjectSchema,
    type MemoryInjectInput,
} from '../schemas/tool-schemas.js';
import { logger } from '../utils/logger.js';

/**
 * Handle memory_inject tool call
 * This is the CORE tool that generates the injection block
 */
export async function handleMemoryInject(
    args: unknown,
    db: MemoryDatabase
): Promise<any> {
    // Validate input
    const input = memoryInjectSchema.parse(args) as MemoryInjectInput;

    logger.debug('Handling memory_inject', {
        sessionId: input.session_id,
        query: input.query,
        style: input.style,
        topK: input.top_k,
    });

    try {
        const injector = new InjectorService(db);

        const result = await injector.generateInjectionBlock({
            session_id: input.session_id,
            query: input.query,
            style: input.style,
            top_k: input.top_k,
        });

        return {
            injection_block: result.injection_block,
            sources: result.sources,
            generated_at: result.generated_at,
            style: input.style,
            method: input.session_id ? 'session' : 'query',
        };
    } catch (error) {
        logger.error('Failed to generate injection block', error);
        throw new Error(`Failed to generate injection block: ${(error as Error).message}`);
    }
}
