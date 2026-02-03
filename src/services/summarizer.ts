/**
 * Summarizer Service
 * Generates session summaries using Claude API (Anthropic)
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Message, SummaryStyle } from '../schemas/types.js';
import { logger } from '../utils/logger.js';

export class SummarizerService {
    private client: Anthropic | null = null;

    constructor() {
        // Initialize Anthropic client if API key is available
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (apiKey) {
            this.client = new Anthropic({ apiKey });
            logger.debug('Anthropic client initialized');
        } else {
            logger.warn('ANTHROPIC_API_KEY not set, summarization will fail');
        }
    }

    /**
     * Generate summary for messages
     */
    async summarizeMessages(
        messages: Message[],
        style: SummaryStyle
    ): Promise<string> {
        if (!this.client) {
            throw new Error('Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.');
        }

        if (messages.length === 0) {
            throw new Error('No messages to summarize');
        }

        const systemPrompt = this.getSummaryPrompt(style);
        const conversationText = this.formatMessages(messages);

        logger.debug('Generating summary', {
            style,
            messageCount: messages.length,
            totalChars: conversationText.length,
        });

        try {
            const maxTokens = style === 'brief' ? 1024 : 2048;

            const response = await this.client.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: maxTokens,
                temperature: 0.3,
                messages: [
                    {
                        role: 'user',
                        content: `${systemPrompt}\n\n对话内容：\n${conversationText}`,
                    },
                ],
            });

            const summary = response.content[0].type === 'text'
                ? response.content[0].text
                : '';

            logger.info('Summary generated', {
                style,
                summaryLength: summary.length,
                tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
            });

            return summary;
        } catch (error) {
            logger.error('Failed to generate summary', error);
            throw new Error(`Failed to generate summary: ${(error as Error).message}`);
        }
    }

    /**
     * Get summary prompt template based on style
     */
    private getSummaryPrompt(style: SummaryStyle): string {
        const limits = style === 'brief'
            ? { facts: 6, decisions: 3, actions: 5 }
            : { facts: 12, decisions: 6, risks: 6, questions: 6, actions: 10 };

        if (style === 'brief') {
            return `你是一个专业的对话总结助手。请分析以下对话内容，提取关键信息。

要求：
1. 提取关键事实（Facts）：客观陈述，不超过 ${limits.facts} 条
2. 提取关键决策（Decisions）：已做出的决定，不超过 ${limits.decisions} 条
3. 提取下一步行动（Next Actions）：待办事项和建议，不超过 ${limits.actions} 条

注意：
- 每条信息保持简洁，≤ 100 字
- 不要包含指令句（如"请你..."、"帮我..."）
- 只保留事实和结论
- 避免复述对话内容

输出格式：
关键事实 Facts:
- <事实1>
- <事实2>

关键决策 Decisions:
- <决策1>

下一步建议 Next Actions:
- <行动1>`;
        } else {
            return `你是一个专业的对话总结助手。请分析以下对话内容，提取关键信息。

要求：
1. 提取关键事实（Facts）：客观陈述，不超过 ${limits.facts} 条
2. 提取关键决策（Decisions）：已做出的决定，不超过 ${limits.decisions} 条
3. 提取约束和风险（Constraints & Risks）：限制条件、潜在问题，不超过 ${limits.risks} 条
4. 提取未解决问题（Open Questions）：待明确的问题，不超过 ${limits.questions} 条
5. 提取下一步行动（Next Actions）：待办事项和建议，不超过 ${limits.actions} 条

注意：
- 每条信息保持简洁，≤ 100 字
- 不要包含指令句（如"请你..."、"帮我..."）
- 只保留事实和结论
- 避免复述对话内容

输出格式：
关键事实 Facts:
- <事实1>
- <事实2>

关键决策 Decisions:
- <决策1>

约束/风险 Constraints & Risks:
- <约束1>

未解决问题 Open Questions:
- <问题1>

下一步建议 Next Actions:
- <行动1>`;
        }
    }

    /**
     * Format messages for Claude API
     */
    private formatMessages(messages: Message[]): string {
        return messages
            .map(msg => {
                const roleLabel = {
                    user: '用户',
                    assistant: '助手',
                    system: '系统',
                }[msg.role];

                return `[${roleLabel}]: ${msg.content}`;
            })
            .join('\n\n');
    }
}
