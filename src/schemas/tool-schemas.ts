/**
 * Zod validation schemas for MCP Tool inputs
 */

import { z } from 'zod';

// =====================
// Tool 1: memory_save_session
// =====================

export const memorySaveSessionSchema = z.object({
    title: z.string().min(1, "Title cannot be empty").max(200),
    tags: z.array(z.string().max(50)).optional(),
    meta: z.record(z.unknown()).optional(),
});

export type MemorySaveSessionInput = z.infer<typeof memorySaveSessionSchema>;

// =====================
// Tool 2: memory_save_messages
// =====================

export const memorySaveMessagesSchema = z.object({
    session_id: z.string().min(1, "Session ID is required"),
    messages: z.array(
        z.object({
            role: z.enum(['user', 'assistant', 'system']),
            content: z.string().min(1, "Message content cannot be empty"),
            created_at: z.number().int().positive().optional(),
        })
    ).min(1, "At least one message is required"),
});

export type MemorySaveMessagesInput = z.infer<typeof memorySaveMessagesSchema>;

// =====================
// Tool 3: memory_list_sessions
// =====================

export const memoryListSessionsSchema = z.object({
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
    tags: z.array(z.string()).optional(),
});

export type MemoryListSessionsInput = z.infer<typeof memoryListSessionsSchema>;

// =====================
// Tool 4: memory_get_session
// =====================

export const memoryGetSessionSchema = z.object({
    session_id: z.string().min(1, "Session ID is required"),
    include_messages: z.boolean().default(true),
    message_limit: z.number().int().min(1).max(500).default(100),
});

export type MemoryGetSessionInput = z.infer<typeof memoryGetSessionSchema>;

// =====================
// Tool 5: memory_search
// =====================

export const memorySearchSchema = z.object({
    query: z.string().min(1, "Query cannot be empty"),
    top_k: z.number().int().min(1).max(50).default(5),
    time_range_days: z.number().int().min(1).default(180),
    tags: z.array(z.string()).optional(),
    session_id: z.string().optional(),
});

export type MemorySearchInput = z.infer<typeof memorySearchSchema>;

// =====================
// Tool 6: memory_summarize_session
// =====================

export const memorySummarizeSessionSchema = z.object({
    session_id: z.string().min(1, "Session ID is required"),
    style: z.enum(['brief', 'detailed']).default('brief'),
    force_refresh: z.boolean().default(false),
});

export type MemorySummarizeSessionInput = z.infer<typeof memorySummarizeSessionSchema>;

// =====================
// Tool 7: memory_inject
// =====================

export const memoryInjectSchema = z.object({
    session_id: z.string().optional(),
    query: z.string().optional(),
    style: z.enum(['brief', 'detailed']).default('brief'),
    top_k: z.number().int().min(1).max(10).default(5),
}).refine(
    (data) => data.session_id || data.query,
    { message: "Either session_id or query must be provided" }
);

export type MemoryInjectInput = z.infer<typeof memoryInjectSchema>;

// =====================
// Tool Definitions for MCP Server
// =====================

export const toolDefinitions = [
    {
        name: 'memory_save_session',
        description: 'Create a new memory session with optional metadata (tags and custom fields)',
        inputSchema: {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                    description: 'Session title',
                },
                tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional tags for categorization',
                },
                meta: {
                    type: 'object',
                    description: 'Optional metadata (e.g., project, client, phase)',
                },
            },
            required: ['title'],
        },
    },
    {
        name: 'memory_save_messages',
        description: 'Save messages to a session. Messages will be indexed for full-text search.',
        inputSchema: {
            type: 'object',
            properties: {
                session_id: {
                    type: 'string',
                    description: 'Session ID to save messages to',
                },
                messages: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            role: {
                                type: 'string',
                                enum: ['user', 'assistant', 'system'],
                                description: 'Message role',
                            },
                            content: {
                                type: 'string',
                                description: 'Message content',
                            },
                            created_at: {
                                type: 'number',
                                description: 'Optional Unix timestamp (defaults to current time)',
                            },
                        },
                        required: ['role', 'content'],
                    },
                    description: 'Array of messages to save',
                },
            },
            required: ['session_id', 'messages'],
        },
    },
    {
        name: 'memory_list_sessions',
        description: 'List recent sessions with pagination and optional tag filtering',
        inputSchema: {
            type: 'object',
            properties: {
                limit: {
                    type: 'number',
                    description: 'Number of sessions to return (default: 20, max: 100)',
                    default: 20,
                },
                offset: {
                    type: 'number',
                    description: 'Offset for pagination (default: 0)',
                    default: 0,
                },
                tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Filter by tags (AND logic)',
                },
            },
        },
    },
    {
        name: 'memory_get_session',
        description: 'Get session details with optional messages',
        inputSchema: {
            type: 'object',
            properties: {
                session_id: {
                    type: 'string',
                    description: 'Session ID',
                },
                include_messages: {
                    type: 'boolean',
                    description: 'Include messages in response (default: true)',
                    default: true,
                },
                message_limit: {
                    type: 'number',
                    description: 'Maximum number of messages to return (default: 100, max: 500)',
                    default: 100,
                },
            },
            required: ['session_id'],
        },
    },
    {
        name: 'memory_search',
        description: 'Search messages using full-text search (FTS5). Supports keyword matching across all message content.',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search query',
                },
                top_k: {
                    type: 'number',
                    description: 'Number of top results to return (default: 5, max: 50)',
                    default: 5,
                },
                time_range_days: {
                    type: 'number',
                    description: 'Search within last N days (default: 180)',
                    default: 180,
                },
                tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Filter by session tags',
                },
                session_id: {
                    type: 'string',
                    description: 'Filter by specific session',
                },
            },
            required: ['query'],
        },
    },
    {
        name: 'memory_summarize_session',
        description: 'Generate a summary of a session (brief or detailed). Results are cached to avoid repeated API calls.',
        inputSchema: {
            type: 'object',
            properties: {
                session_id: {
                    type: 'string',
                    description: 'Session ID to summarize',
                },
                style: {
                    type: 'string',
                    enum: ['brief', 'detailed'],
                    description: 'Summary style: brief (≤6 facts) or detailed (≤12 facts)',
                    default: 'brief',
                },
                force_refresh: {
                    type: 'boolean',
                    description: 'Force regenerate summary (ignore cache)',
                    default: false,
                },
            },
            required: ['session_id'],
        },
    },
    {
        name: 'memory_inject',
        description: 'Generate a structured memory injection block for context. Can work with a single session or aggregate multiple sessions via keyword search.',
        inputSchema: {
            type: 'object',
            properties: {
                session_id: {
                    type: 'string',
                    description: 'Session ID to inject (mutually exclusive with query)',
                },
                query: {
                    type: 'string',
                    description: 'Search query for cross-session aggregation (mutually exclusive with session_id)',
                },
                style: {
                    type: 'string',
                    enum: ['brief', 'detailed'],
                    description: 'Injection style',
                    default: 'brief',
                },
                top_k: {
                    type: 'number',
                    description: 'Number of top search results to aggregate (when using query)',
                    default: 5,
                },
            },
            oneOf: [
                { required: ['session_id'] },
                { required: ['query'] },
            ],
        },
    },
];
