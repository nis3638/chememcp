/**
 * Type definitions for ChatMemory MCP Server
 */

// =====================
// Session Types
// =====================

export interface Session {
    id: string;
    title: string;
    tags: string[];                  // Parsed from JSON string
    meta: Record<string, unknown>;   // Parsed from JSON object
    created_at: number;              // Unix timestamp (seconds)
    updated_at?: number;             // Unix timestamp (seconds)
    summary_brief?: string;          // Cached brief summary
    summary_detailed?: string;       // Cached detailed summary
}

export interface SessionRow {
    id: string;
    title: string;
    tags: string | null;             // JSON string
    meta: string | null;             // JSON string
    created_at: number;
    updated_at: number | null;
    summary_brief: string | null;
    summary_detailed: string | null;
}

export interface CreateSessionInput {
    title: string;
    tags?: string[];
    meta?: Record<string, unknown>;
}

// =====================
// Message Types
// =====================

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
    id: string;
    session_id: string;
    role: MessageRole;
    content: string;
    created_at: number;              // Unix timestamp (seconds)
}

export interface CreateMessageInput {
    session_id: string;
    role: MessageRole;
    content: string;
    created_at?: number;             // Optional, defaults to current time
}

// =====================
// Search Types
// =====================

export interface SearchOptions {
    query: string;
    top_k?: number;
    time_range_days?: number;
    tags?: string[];
    session_id?: string;
}

export interface SearchHit {
    message_id: string;
    session_id: string;
    session_title: string;
    content: string;
    snippet: string;
    relevance_score: number;         // FTS5 rank (negative = better)
    created_at: number;
}

export interface SearchResult {
    hits: SearchHit[];
    total_hits: number;
    query_time_ms: number;
}

// =====================
// Summary Types
// =====================

export type SummaryStyle = 'brief' | 'detailed';

export interface SummaryOptions {
    session_id: string;
    style: SummaryStyle;
    force_refresh?: boolean;
}

export interface SummaryResult {
    session_id: string;
    style: SummaryStyle;
    summary: string;
    cached: boolean;
    generated_at: number;
}

// =====================
// Injection Types
// =====================

export interface InjectionContent {
    topic: string;
    facts: string[];
    decisions: string[];
    constraints_risks: string[];
    open_questions: string[];
    next_actions: string[];
    sources: {
        session_ids: string[];
        updated_at: string;
    };
}

export interface InjectionOptions {
    session_id?: string;
    query?: string;
    style: SummaryStyle;
    top_k?: number;
}

export interface InjectionBlock {
    injection_block: string;
    sources: string[];
    generated_at: number;
}

// =====================
// List/Query Types
// =====================

export interface ListSessionsOptions {
    limit?: number;
    offset?: number;
    tags?: string[];
}

export interface ListSessionsResult {
    sessions: Session[];
    total: number;
    has_more: boolean;
}

export interface GetSessionOptions {
    session_id: string;
    include_messages?: boolean;
    message_limit?: number;
}

export interface GetSessionResult {
    session: Session;
    messages?: Message[];
    message_count: number;
}
