/**
 * ID generator for sessions and messages
 * Using UUID v4 for globally unique identifiers
 */

import { randomUUID } from 'crypto';

/**
 * Generate a unique ID for sessions
 */
export function generateSessionId(): string {
    return randomUUID();
}

/**
 * Generate a unique ID for messages
 */
export function generateMessageId(): string {
    return randomUUID();
}

/**
 * Generate a generic unique ID
 */
export function generateId(): string {
    return randomUUID();
}
