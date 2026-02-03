/**
 * Logger utility for MCP Server
 * IMPORTANT: All logs MUST go to stderr, never stdout (which is reserved for JSON-RPC)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
    level: LogLevel;
    timestamp: string;
    message: string;
    [key: string]: unknown;
}

export class Logger {
    private enabled: boolean;

    constructor() {
        // Enable debug logging if DEBUG env var is set
        this.enabled = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
    }

    /**
     * Log debug message (only if DEBUG=1)
     */
    debug(message: string, meta?: Record<string, unknown>): void {
        if (this.enabled) {
            this.log('debug', message, meta);
        }
    }

    /**
     * Log info message
     */
    info(message: string, meta?: Record<string, unknown>): void {
        this.log('info', message, meta);
    }

    /**
     * Log warning message
     */
    warn(message: string, meta?: Record<string, unknown>): void {
        this.log('warn', message, meta);
    }

    /**
     * Log error message
     */
    error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
        const errorMeta: Record<string, unknown> = { ...meta };

        if (error instanceof Error) {
            errorMeta.error = error.message;
            errorMeta.stack = error.stack;
        } else if (error) {
            errorMeta.error = String(error);
        }

        this.log('error', message, errorMeta);
    }

    /**
     * Write structured log to stderr
     */
    private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
        const entry: LogEntry = {
            level,
            timestamp: new Date().toISOString(),
            message,
            ...meta,
        };

        // CRITICAL: Always write to stderr, NEVER stdout
        process.stderr.write(JSON.stringify(entry) + '\n');
    }
}

/**
 * Create a singleton logger instance
 */
export const logger = new Logger();
