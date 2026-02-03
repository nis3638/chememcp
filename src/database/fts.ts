/**
 * FTS5 Query Builder
 * Utilities for constructing FTS5 queries with different search strategies
 */

/**
 * FTS5 query builder for advanced search patterns
 */
export class FTS5QueryBuilder {
    /**
     * Build basic AND query (all terms must match)
     * Example: "TCU 六统一" -> "TCU AND 六统一"
     */
    static basicSearch(query: string): string {
        const terms = query.trim().split(/\s+/).filter(term => term.length > 0);
        return terms.join(' AND ');
    }

    /**
     * Build phrase query (exact phrase match)
     * Example: "TCU 六统一" -> '"TCU 六统一"'
     */
    static phraseSearch(phrase: string): string {
        return `"${phrase}"`;
    }

    /**
     * Build prefix query (for autocomplete/fuzzy matching)
     * Example: "统一" -> "统一*"
     */
    static prefixSearch(term: string): string {
        return `${term}*`;
    }

    /**
     * Build OR query (any term can match)
     * Example: ["TCU", "六统一", "框架"] -> "TCU OR 六统一 OR 框架"
     */
    static orSearch(terms: string[]): string {
        return terms.filter(t => t.length > 0).join(' OR ');
    }

    /**
     * Build complex boolean query
     * Example: "TCU AND (六统一 OR 框架)"
     */
    static booleanSearch(expression: string): string {
        // Pass through as-is (user provides the boolean expression)
        return expression;
    }

    /**
     * Build proximity query (terms within N words of each other)
     * Example: NEAR("TCU" "六统一", 5) - TCU within 5 words of 六统一
     * Note: FTS5 NEAR syntax
     */
    static proximitySearch(term1: string, term2: string, distance = 10): string {
        return `NEAR("${term1}" "${term2}", ${distance})`;
    }

    /**
     * Escape special FTS5 characters in user input
     * FTS5 special chars: " * ( ) AND OR NOT NEAR
     */
    static escapeQuery(query: string): string {
        // Escape double quotes
        return query.replace(/"/g, '""');
    }

    /**
     * Smart search: Try to intelligently parse user query
     * - Quoted strings become phrase searches
     * - Multiple terms become AND search
     * - Single term becomes basic search
     */
    static smartSearch(query: string): string {
        const trimmed = query.trim();

        // Check if it's a quoted phrase
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
            return this.phraseSearch(trimmed.slice(1, -1));
        }

        // Check if it contains boolean operators (pass through)
        if (/\b(AND|OR|NOT|NEAR)\b/.test(trimmed)) {
            return trimmed;
        }

        // Default: AND search for multiple terms
        return this.basicSearch(trimmed);
    }
}

/**
 * Helper function to highlight search terms in content
 * (For future use in snippet generation)
 */
export function highlightSearchTerms(
    content: string,
    terms: string[],
    maxLength = 200
): string {
    // Simple implementation: find first match and extract surrounding context
    for (const term of terms) {
        const index = content.toLowerCase().indexOf(term.toLowerCase());
        if (index !== -1) {
            const start = Math.max(0, index - 50);
            const end = Math.min(content.length, index + term.length + 150);

            let snippet = content.substring(start, end);

            if (start > 0) snippet = '...' + snippet;
            if (end < content.length) snippet = snippet + '...';

            return snippet;
        }
    }

    // No match found, return beginning of content
    return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
}
