/**
 * MCP Server configuration and tool registration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { MemoryDatabase } from './database/index.js';
import { toolDefinitions } from './schemas/tool-schemas.js';
import { handleToolCall } from './tools/index.js';
import { logger } from './utils/logger.js';

/**
 * Register all MCP tools with the server
 */
export function registerTools(server: Server, db: MemoryDatabase): void {
    // Handle tools/list request
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        logger.debug('Handling tools/list request');

        return {
            tools: toolDefinitions.map(tool => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
            })),
        };
    });

    // Handle tools/call request
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        logger.info('Tool call received', { tool: name });

        try {
            const result = await handleToolCall(name, args || {}, db);

            logger.info('Tool call succeeded', { tool: name });

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        } catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : String(error);

            logger.error('Tool call failed', error, { tool: name });

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                error: errorMessage,
                                tool: name,
                            },
                            null,
                            2
                        ),
                    },
                ],
                isError: true,
            };
        }
    });

    logger.info('MCP tools registered', { count: toolDefinitions.length });
}
