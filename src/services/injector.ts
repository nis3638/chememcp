/**
 * Injector Service
 * Generates injection blocks by aggregating and formatting session summaries
 */

import type { MemoryDatabase } from '../database/index.js';
import { MemoryRepository } from '../database/repository.js';
import { SummarizerService } from './summarizer.js';
import { formatInjectionBlock, parseSummary } from '../utils/format.js';
import type {
    InjectionBlock,
    InjectionOptions,
    InjectionContent,
    SummaryStyle,
    Session,
} from '../schemas/types.js';
import { logger } from '../utils/logger.js';

export class InjectorService {
    private repository: MemoryRepository;
    private summarizer: SummarizerService;

    constructor(db: MemoryDatabase) {
        this.repository = new MemoryRepository(db.getDatabase());
        this.summarizer = new SummarizerService();
    }

    /**
     * Generate injection block from session(s)
     */
    async generateInjectionBlock(options: InjectionOptions): Promise<InjectionBlock> {
        const { session_id, query, style, top_k = 5 } = options;

        logger.debug('Generating injection block', { session_id, query, style });

        let sessions: Session[];
        let topic: string;

        // Mode A: Single session injection
        if (session_id) {
            const session = this.repository.getSession(session_id);
            if (!session) {
                throw new Error(`Session not found: ${session_id}`);
            }
            sessions = [session];
            topic = session.title;
        }
        // Mode B: Cross-session aggregation via query
        else if (query) {
            const searchHits = this.repository.searchMessages({
                query,
                top_k,
                time_range_days: 180,
            });

            if (searchHits.length === 0) {
                throw new Error(`No results found for query: ${query}`);
            }

            // Get unique sessions from search results
            const sessionIds = [...new Set(searchHits.map(hit => hit.session_id))];
            sessions = sessionIds
                .map(id => this.repository.getSession(id))
                .filter((s): s is Session => s !== null);

            topic = `${query}（跨 ${sessions.length} 个会话）`;
        } else {
            throw new Error('Either session_id or query must be provided');
        }

        // Generate summaries for all sessions
        const summaries = await this.getSummariesForSessions(sessions, style);

        // Aggregate summaries
        const aggregated = this.aggregateSummaries(summaries);

        // Format injection block
        const injectionBlock = formatInjectionBlock(
            {
                topic,
                facts: aggregated.facts,
                decisions: aggregated.decisions,
                constraints_risks: aggregated.constraints_risks,
                open_questions: aggregated.open_questions,
                next_actions: aggregated.next_actions,
                sources: {
                    session_ids: sessions.map(s => s.id),
                    updated_at: new Date().toISOString().split('T')[0],
                },
            },
            style
        );

        logger.info('Injection block generated', {
            sessionCount: sessions.length,
            style,
            blockLength: injectionBlock.length,
        });

        return {
            injection_block: injectionBlock,
            sources: sessions.map(s => s.id),
            generated_at: Math.floor(Date.now() / 1000),
        };
    }

    /**
     * Get or generate summaries for sessions
     */
    private async getSummariesForSessions(
        sessions: Session[],
        style: SummaryStyle
    ): Promise<string[]> {
        const summaries: string[] = [];

        for (const session of sessions) {
            // Check cache
            const cachedSummary = style === 'brief'
                ? session.summary_brief
                : session.summary_detailed;

            if (cachedSummary) {
                logger.debug('Using cached summary', { sessionId: session.id, style });
                summaries.push(cachedSummary);
                continue;
            }

            // Generate new summary
            logger.debug('Generating new summary', { sessionId: session.id, style });
            const messages = this.repository.getSessionMessages(session.id, 500);

            if (messages.length === 0) {
                logger.warn('Session has no messages', { sessionId: session.id });
                continue;
            }

            try {
                const summary = await this.summarizer.summarizeMessages(messages, style);

                // Cache the summary
                if (style === 'brief') {
                    this.repository.updateSessionSummary(session.id, {
                        summary_brief: summary,
                    });
                } else {
                    this.repository.updateSessionSummary(session.id, {
                        summary_detailed: summary,
                    });
                }

                summaries.push(summary);
            } catch (error) {
                logger.error('Failed to generate summary', error, {
                    sessionId: session.id,
                });
                // Continue with other sessions
            }
        }

        return summaries;
    }

    /**
     * Aggregate multiple summaries and deduplicate
     */
    private aggregateSummaries(
        summaries: string[]
    ): InjectionContent {
        const allFacts: string[] = [];
        const allDecisions: string[] = [];
        const allConstraintsRisks: string[] = [];
        const allOpenQuestions: string[] = [];
        const allNextActions: string[] = [];

        // Parse each summary
        for (const summary of summaries) {
            const parsed = parseSummary(summary);
            allFacts.push(...parsed.facts);
            allDecisions.push(...parsed.decisions);
            allConstraintsRisks.push(...parsed.constraints_risks);
            allOpenQuestions.push(...parsed.open_questions);
            allNextActions.push(...parsed.next_actions);
        }

        // Simple deduplication (case-insensitive, exact match)
        // For MVP, use Set-based deduplication
        // Future improvement: use semantic similarity
        const uniqueFacts = this.deduplicateStrings(allFacts);
        const uniqueDecisions = this.deduplicateStrings(allDecisions);
        const uniqueConstraintsRisks = this.deduplicateStrings(allConstraintsRisks);
        const uniqueOpenQuestions = this.deduplicateStrings(allOpenQuestions);
        const uniqueNextActions = this.deduplicateStrings(allNextActions);

        return {
            topic: '',
            facts: uniqueFacts,
            decisions: uniqueDecisions,
            constraints_risks: uniqueConstraintsRisks,
            open_questions: uniqueOpenQuestions,
            next_actions: uniqueNextActions,
            sources: { session_ids: [], updated_at: '' },
        };
    }

    /**
     * Deduplicate strings (case-insensitive, trim)
     */
    private deduplicateStrings(items: string[]): string[] {
        const seen = new Set<string>();
        const result: string[] = [];

        for (const item of items) {
            const normalized = item.trim().toLowerCase();
            if (normalized && !seen.has(normalized)) {
                seen.add(normalized);
                result.push(item.trim());
            }
        }

        return result;
    }
}
