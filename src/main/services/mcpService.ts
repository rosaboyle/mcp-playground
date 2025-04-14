import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ipcMain } from 'electron';
import { MCPConfig, loadMCPConfig, saveMCPConfig } from '../../shared/mcp-config';
import { mainLogger as logger } from '../logger';
import { FireworksMCPService } from './fireworks-mcp-service';

// Track active connections
const connections: Record<string, {
    client: Client;
    transport: StdioClientTransport;
    serverId: string;
}> = {};

// Track active MCP-LLM conversations
const mcpLlmConversations: Record<string, {
    conversationId: string;
    connectionId: string;
}> = {};

// MCP configuration
let mcpConfig: MCPConfig | null = null;
let configDir: string = '';

// Fireworks MCP service
let fireworksMCPService: FireworksMCPService | null = null;

// Setup IPC handlers
export function setupMCPService(appConfigDir: string) {
    configDir = appConfigDir;
    logger.info('[MCP Service] Setting up MCP service handlers');

    // Initialize FireworksMCPService
    fireworksMCPService = new FireworksMCPService();

    // Load MCP configuration
    try {
        mcpConfig = loadMCPConfig(configDir);
        logger.info(`[MCP Service] Loaded MCP configuration with ${Object.keys(mcpConfig.mcpServers).length} servers`);
    } catch (error) {
        logger.error('[MCP Service] Error loading MCP configuration', error);
        return;
    }

    // Register all handlers
    const handlers = [
        {
            name: 'mcp-get-servers', handler: () => {
                logger.debug('[MCP Service] Handling mcp-get-servers');

                if (!mcpConfig) {
                    return [];
                }

                return Object.keys(mcpConfig.mcpServers).map(id => ({
                    id,
                    label: id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
                }));
            }
        },

        {
            name: 'mcp-connect', handler: async (event: any, serverId: string, connectionId: string) => {
                logger.info(`[MCP Service] Connecting to server ${serverId} with connection ID ${connectionId}`);

                try {
                    if (!mcpConfig) {
                        throw new Error('MCP configuration not loaded');
                    }

                    const serverConfig = mcpConfig.mcpServers[serverId];
                    if (!serverConfig) {
                        throw new Error(`Server configuration for ${serverId} not found`);
                    }

                    // Create client and transport
                    const client = new Client({ name: 'mcp-explorer', version: '1.0.0' });

                    // Create environment variables object with only string values
                    const processEnv: Record<string, string> = {};
                    Object.entries(process.env).forEach(([key, value]) => {
                        if (value !== undefined) {
                            processEnv[key] = value;
                        }
                    });

                    const transport = new StdioClientTransport({
                        command: serverConfig.command,
                        args: serverConfig.args,
                        env: { ...processEnv, ...serverConfig.env }
                    });

                    // Connect to server
                    client.connect(transport);
                    logger.info(`[MCP Service] Connected to ${serverId}`);

                    // Store connection
                    connections[connectionId] = { client, transport, serverId };

                    return { success: true };
                } catch (error) {
                    logger.error(`[MCP Service] Connection error: ${error}`);
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            }
        },

        // Initialize Fireworks for MCP tool calls
        {
            name: 'mcp-fireworks-init', handler: async (event: any, apiKey: string, modelId?: string) => {
                logger.info('[MCP Service] Initializing Fireworks for MCP tool calls');

                try {
                    if (!fireworksMCPService) {
                        throw new Error('FireworksMCPService not initialized');
                    }

                    const success = fireworksMCPService.initializeClient(apiKey, modelId);

                    return {
                        success,
                        clientId: success ? `fireworks-${Date.now()}` : undefined
                    };
                } catch (error) {
                    logger.error('[MCP Service] Error initializing Fireworks for MCP:', error);
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            }
        },

        // Start a conversation with Fireworks and MCP
        {
            name: 'mcp-fireworks-start-conversation', handler: async (event: any, clientId: string, connectionId: string, systemPrompt?: string) => {
                logger.info(`[MCP Service] Starting Fireworks-MCP conversation with connection ${connectionId}`);

                try {
                    if (!fireworksMCPService) {
                        throw new Error('FireworksMCPService not initialized');
                    }

                    const connection = connections[connectionId];
                    if (!connection) {
                        throw new Error('MCP connection not found');
                    }

                    const conversationId = fireworksMCPService.startConversation(
                        clientId,
                        connectionId,
                        connection.client,
                        systemPrompt
                    );

                    // Store the conversation mapping
                    mcpLlmConversations[conversationId] = {
                        conversationId,
                        connectionId
                    };

                    return {
                        success: true,
                        conversationId
                    };
                } catch (error) {
                    logger.error('[MCP Service] Error starting Fireworks-MCP conversation:', error);
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            }
        },

        // Process a query with Fireworks and MCP tools
        {
            name: 'mcp-fireworks-process-query', handler: async (event: any, conversationId: string, query: string) => {
                logger.info(`[MCP Service] Processing query with Fireworks-MCP for conversation ${conversationId}`);

                try {
                    if (!fireworksMCPService) {
                        throw new Error('FireworksMCPService not initialized');
                    }

                    const conversation = mcpLlmConversations[conversationId];
                    if (!conversation) {
                        throw new Error('Conversation not found');
                    }

                    const response = await fireworksMCPService.processQuery(conversationId, query);

                    return {
                        success: true,
                        response
                    };
                } catch (error) {
                    logger.error('[MCP Service] Error processing query with Fireworks-MCP:', error);
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            }
        },

        // End a Fireworks-MCP conversation
        {
            name: 'mcp-fireworks-end-conversation', handler: async (event: any, conversationId: string) => {
                logger.info(`[MCP Service] Ending Fireworks-MCP conversation ${conversationId}`);

                try {
                    if (!fireworksMCPService) {
                        throw new Error('FireworksMCPService not initialized');
                    }

                    const success = fireworksMCPService.endConversation(conversationId);
                    if (success) {
                        delete mcpLlmConversations[conversationId];
                    }

                    return { success };
                } catch (error) {
                    logger.error('[MCP Service] Error ending Fireworks-MCP conversation:', error);
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            }
        },

        // Get MCP configuration
        {
            name: 'mcp-get-config', handler: async () => {
                logger.info('[MCP Service] Getting MCP configuration');

                try {
                    if (!mcpConfig) {
                        mcpConfig = loadMCPConfig(configDir);
                    }

                    return {
                        success: true,
                        data: mcpConfig
                    };
                } catch (error) {
                    logger.error('[MCP Service] Error getting MCP configuration', error);
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            }
        },

        // Save MCP configuration
        {
            name: 'mcp-save-config', handler: async (event: any, newConfig: MCPConfig) => {
                logger.info('[MCP Service] Saving MCP configuration');

                try {
                    const success = saveMCPConfig(newConfig, configDir);

                    if (success) {
                        mcpConfig = newConfig;
                        logger.info('[MCP Service] MCP configuration saved successfully');
                        return { success: true };
                    } else {
                        throw new Error('Failed to save MCP configuration');
                    }
                } catch (error) {
                    logger.error('[MCP Service] Error saving MCP configuration', error);
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            }
        },

        {
            name: 'mcp-get-active-connections', handler: (event: any) => {
                logger.info('[MCP Service] Getting active connections');

                // Group connections by serverId for the frontend
                const activeConnectionsByServer: Record<string, string[]> = {};

                for (const connId in connections) {
                    const connection = connections[connId];
                    if (!activeConnectionsByServer[connection.serverId]) {
                        activeConnectionsByServer[connection.serverId] = [];
                    }
                    activeConnectionsByServer[connection.serverId].push(connId);
                }

                return {
                    success: true,
                    connections: activeConnectionsByServer
                };
            }
        },

        {
            name: 'mcp-disconnect', handler: async (event: any, connectionId: string) => {
                logger.info(`[MCP Service] Disconnecting from connection ID ${connectionId}`);

                try {
                    const connection = connections[connectionId];
                    if (!connection) {
                        return { success: true }; // Already disconnected
                    }

                    // Close connection
                    await connection.client.close();
                    delete connections[connectionId];

                    return { success: true };
                } catch (error) {
                    logger.error(`[MCP Service] Disconnection error: ${error}`);
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            }
        },

        {
            name: 'mcp-list-tools', handler: async (event: any, connectionId: string) => {
                logger.info(`[MCP Service] Listing tools for connection ID ${connectionId}`);

                try {
                    const connection = connections[connectionId];
                    if (!connection) {
                        throw new Error('Not connected to a server');
                    }

                    const result = await connection.client.listTools();
                    return { success: true, data: result };
                } catch (error) {
                    logger.error(`[MCP Service] Error listing tools: ${error}`);
                    if (error instanceof Error && 'code' in error && error.code === -32601) {
                        return {
                            success: true,
                            data: { tools: [] },
                            warning: 'This MCP server does not support the listTools method'
                        };
                    }
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            }
        },

        {
            name: 'mcp-list-resources', handler: async (event: any, connectionId: string) => {
                logger.info(`[MCP Service] Listing resources for connection ID ${connectionId}`);

                try {
                    const connection = connections[connectionId];
                    if (!connection) {
                        throw new Error('Not connected to a server');
                    }

                    const result = await connection.client.listResources();
                    return { success: true, data: result };
                } catch (error) {
                    logger.error(`[MCP Service] Error listing resources: ${error}`);
                    if (error instanceof Error && 'code' in error && error.code === -32601) {
                        return {
                            success: true,
                            data: { resources: [] },
                            warning: 'This MCP server does not support the listResources method'
                        };
                    }
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            }
        },

        {
            name: 'mcp-list-prompts', handler: async (event: any, connectionId: string) => {
                logger.info(`[MCP Service] Listing prompts for connection ID ${connectionId}`);

                try {
                    const connection = connections[connectionId];
                    if (!connection) {
                        throw new Error('Not connected to a server');
                    }

                    const result = await connection.client.listPrompts();
                    return { success: true, data: result };
                } catch (error) {
                    logger.error(`[MCP Service] Error listing prompts: ${error}`);
                    if (error instanceof Error && 'code' in error && error.code === -32601) {
                        return {
                            success: true,
                            data: { prompts: [] },
                            warning: 'This MCP server does not support the listPrompts method'
                        };
                    }
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            }
        },

        {
            name: 'mcp-call-tool', handler: async (event: any, connectionId: string, toolName: string, toolArguments: any) => {
                logger.info(`[MCP Service] Calling tool ${toolName} for connection ID ${connectionId}`);

                try {
                    const connection = connections[connectionId];
                    if (!connection) {
                        throw new Error('Not connected to a server');
                    }

                    const result = await connection.client.callTool({
                        name: toolName,
                        arguments: toolArguments
                    });

                    return { success: true, data: result };
                } catch (error) {
                    logger.error(`[MCP Service] Error calling tool ${toolName}: ${error}`);
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            }
        },

        {
            name: 'mcp-access-resource', handler: async (event: any, connectionId: string, resourceName: string) => {
                logger.info(`[MCP Service] Accessing resource ${resourceName} for connection ID ${connectionId}`);

                try {
                    const connection = connections[connectionId];
                    if (!connection) {
                        throw new Error('Not connected to a server');
                    }

                    const result = await connection.client.accessResource({
                        name: resourceName
                    });

                    return { success: true, data: result };
                } catch (error) {
                    logger.error(`[MCP Service] Error accessing resource ${resourceName}: ${error}`);
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            }
        },

        {
            name: 'mcp-render-prompt', handler: async (event: any, connectionId: string, promptName: string, promptArguments: any) => {
                logger.info(`[MCP Service] Rendering prompt ${promptName} for connection ID ${connectionId}`);

                try {
                    const connection = connections[connectionId];
                    if (!connection) {
                        throw new Error('Not connected to a server');
                    }

                    const result = await connection.client.renderPrompt({
                        name: promptName,
                        arguments: promptArguments
                    });

                    return { success: true, data: result };
                } catch (error) {
                    logger.error(`[MCP Service] Error rendering prompt ${promptName}: ${error}`);
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            }
        }
    ];

    // Register all handlers
    handlers.forEach(handler => {
        ipcMain.handle(handler.name, handler.handler);
    });

    // Setup event forwarders for Fireworks MCP
    if (fireworksMCPService) {
        // Forward tool call success events
        fireworksMCPService.onToolCallSuccess((data) => {
            logger.info(`[MCP Service] Forwarding tool call success event for connection ${data.connectionId}`);
            const webContents = event?.sender?.webContents;
            if (webContents && !webContents.isDestroyed()) {
                webContents.send('mcp-tool-call-success', data);
            }
        });

        // Forward tool call error events
        fireworksMCPService.onToolCallError((data) => {
            logger.info(`[MCP Service] Forwarding tool call error event for connection ${data.connectionId}`);
            const webContents = event?.sender?.webContents;
            if (webContents && !webContents.isDestroyed()) {
                webContents.send('mcp-tool-call-error', data);
            }
        });
    }

    // Cleanup function for app exit
    const cleanupConnections = async () => {
        logger.info('[MCP Service] Cleaning up connections');

        // Close all MCP connections
        for (const connId in connections) {
            try {
                const connection = connections[connId];
                await connection.client.close();
                logger.info(`[MCP Service] Closed connection: ${connId}`);
            } catch (error) {
                logger.error(`[MCP Service] Error closing connection ${connId}: ${error}`);
            }
        }

        // Dispose Fireworks MCP service
        if (fireworksMCPService) {
            fireworksMCPService.dispose();
            fireworksMCPService = null;
        }

        logger.info('[MCP Service] All connections cleaned up');
    };

    return {
        cleanup: cleanupConnections
    };
} 