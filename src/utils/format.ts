/**
 * Injection block formatter
 * Formats memory injection blocks according to the strict specification
 */

import type { InjectionContent, SummaryStyle } from '../schemas/types.js';

/**
 * Format injection content into the standard injection block format
 *
 * Format spec:
 * [MEMORY INJECTION]
 * 主题：<topic>
 *
 * 关键事实 Facts:
 * - <fact1>
 * - <fact2>
 *
 * 关键决策 Decisions:
 * - <decision1>
 *
 * 约束/风险 Constraints & Risks: (detailed only)
 * - <constraint1>
 *
 * 未解决问题 Open Questions: (detailed only)
 * - <question1>
 *
 * 下一步建议 Next Actions:
 * - <action1>
 *
 * 来源 Sources:
 * - session_id: xxx (or sessions_used: [xxx, yyy])
 * - updated_at: 2026-01-20
 *
 * [/MEMORY INJECTION]
 */
export function formatInjectionBlock(
    content: InjectionContent,
    style: SummaryStyle
): string {
    const lines: string[] = [];

    // Header
    lines.push('[MEMORY INJECTION]');
    lines.push(`主题：${content.topic}`);
    lines.push('');

    // Facts (brief: ≤6, detailed: ≤12)
    lines.push('关键事实 Facts:');
    const maxFacts = style === 'brief' ? 6 : 12;
    const facts = content.facts.slice(0, maxFacts);
    if (facts.length > 0) {
        facts.forEach(fact => lines.push(`- ${fact}`));
    } else {
        lines.push('- (无)');
    }
    lines.push('');

    // Decisions (brief: ≤3, detailed: ≤6)
    lines.push('关键决策 Decisions:');
    const maxDecisions = style === 'brief' ? 3 : 6;
    const decisions = content.decisions.slice(0, maxDecisions);
    if (decisions.length > 0) {
        decisions.forEach(decision => lines.push(`- ${decision}`));
    } else {
        lines.push('- (无)');
    }
    lines.push('');

    // Constraints & Risks (detailed only, ≤6)
    if (style === 'detailed') {
        lines.push('约束/风险 Constraints & Risks:');
        const constraints = content.constraints_risks.slice(0, 6);
        if (constraints.length > 0) {
            constraints.forEach(item => lines.push(`- ${item}`));
        } else {
            lines.push('- (无)');
        }
        lines.push('');
    }

    // Open Questions (detailed only, ≤6)
    if (style === 'detailed') {
        lines.push('未解决问题 Open Questions:');
        const questions = content.open_questions.slice(0, 6);
        if (questions.length > 0) {
            questions.forEach(question => lines.push(`- ${question}`));
        } else {
            lines.push('- (无)');
        }
        lines.push('');
    }

    // Next Actions (brief: ≤5, detailed: ≤10)
    lines.push('下一步建议 Next Actions:');
    const maxActions = style === 'brief' ? 5 : 10;
    const actions = content.next_actions.slice(0, maxActions);
    if (actions.length > 0) {
        actions.forEach(action => lines.push(`- ${action}`));
    } else {
        lines.push('- (无)');
    }
    lines.push('');

    // Sources
    lines.push('来源 Sources:');
    if (content.sources.session_ids.length === 1) {
        lines.push(`- session_id: ${content.sources.session_ids[0]}`);
    } else if (content.sources.session_ids.length > 1) {
        lines.push(`- sessions_used: [${content.sources.session_ids.join(', ')}]`);
    }
    lines.push(`- updated_at: ${content.sources.updated_at}`);
    lines.push('');

    // Footer
    lines.push('[/MEMORY INJECTION]');

    return lines.join('\n');
}

/**
 * Parse a summary text into structured components
 * This is a simple parser that extracts sections based on headers
 */
export function parseSummary(summaryText: string): {
    facts: string[];
    decisions: string[];
    constraints_risks: string[];
    open_questions: string[];
    next_actions: string[];
} {
    const result = {
        facts: [] as string[],
        decisions: [] as string[],
        constraints_risks: [] as string[],
        open_questions: [] as string[],
        next_actions: [] as string[],
    };

    // Split by lines
    const lines = summaryText.split('\n');
    let currentSection = '';

    for (const line of lines) {
        const trimmed = line.trim();

        // Detect section headers
        if (trimmed.startsWith('关键事实') || trimmed.includes('Facts:')) {
            currentSection = 'facts';
            continue;
        } else if (trimmed.startsWith('关键决策') || trimmed.includes('Decisions:')) {
            currentSection = 'decisions';
            continue;
        } else if (trimmed.startsWith('约束') || trimmed.startsWith('风险') || trimmed.includes('Constraints') || trimmed.includes('Risks')) {
            currentSection = 'constraints_risks';
            continue;
        } else if (trimmed.startsWith('未解决') || trimmed.includes('Open Questions')) {
            currentSection = 'open_questions';
            continue;
        } else if (trimmed.startsWith('下一步') || trimmed.includes('Next Actions')) {
            currentSection = 'next_actions';
            continue;
        }

        // Extract bullet points
        if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
            const content = trimmed.substring(1).trim();
            if (content && content !== '(无)' && content.length > 0) {
                switch (currentSection) {
                    case 'facts':
                        result.facts.push(content);
                        break;
                    case 'decisions':
                        result.decisions.push(content);
                        break;
                    case 'constraints_risks':
                        result.constraints_risks.push(content);
                        break;
                    case 'open_questions':
                        result.open_questions.push(content);
                        break;
                    case 'next_actions':
                        result.next_actions.push(content);
                        break;
                }
            }
        }
    }

    return result;
}

/**
 * Truncate text to max length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength - 3) + '...';
}
