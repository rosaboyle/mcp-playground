import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { FireworksModel, Tool } from 'airtrain/dist/integrations/fireworks';
import { EventEmitter } from 'events';
import { mainLogger as logger } from '../logger';

interface MCPToolCallResult {
    connectionId: string;
    toolCall: {
        toolName: string;
        toolArgs: Record<string, any>;
    };
    result: any;
}

interface MCPToolCallError {
    connectionId: string;
    toolCall: {
        toolName: string;
        toolArgs: Record<string, any>;
    };
    error: string;
}

/**
 * Service to manage integration between Fireworks LLM and MCP tool calls
 */
export class FireworksMCPService {
    private clients: Map<string, FireworksModel> = new Map();
    private activeConversations: Map<string, { model: FireworksModel, mcpClient: Client }> = new Map();
    private eventEmitter: EventEmitter = new EventEmitter();
    private connectionToConversation: Map<string, string> = new Map();
    private conversationToConnection: Map<string, string> = new Map();

    constructor() {
        logger.info('Initializing FireworksMCPService');
    }

    /**
     * Initialize Fireworks client with API key
     */
    public initializeClient(apiKey: string, modelId?: string): boolean {
        try {
            logger.info('Initializing Fireworks client for MCP integration');

            // Create a unique client ID
            const clientId = `fireworks-${Date.now()}`;

            // Initialize Fireworks model
            const model = new FireworksModel({
                apiKey,
                defaultModel: modelId || 'accounts/fireworks/models/llama-v3p1-70b-instruct'
            });

            // Store the client
            this.clients.set(clientId, model);

            logger.info('Fireworks client initialized successfully');
            return true;
        } catch (error) {
            logger.error('Failed to initialize Fireworks client:', error);
            return false;
        }
    }

    /**
     * Start a new conversation with MCP enabled
     */
    public startConversation(clientId: string, mcpConnectionId: string, mcpClient: Client, systemPrompt?: string): string {
        try {
            logger.info(`Starting new conversation with MCP connection ${mcpConnectionId}`);

            // Get the Fireworks model client
            const model = this.clients.get(clientId);
            if (!model) {
                throw new Error(`Fireworks client not found: ${clientId}`);
            }

            // Set system prompt if provided
            if (systemPrompt) {
                model.setSystemPrompt(systemPrompt);
            }

            // Create conversation ID
            const conversationId = `conv-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

            // Store the conversation with its MCP client
            this.activeConversations.set(conversationId, { model, mcpClient });

            // Map connection to conversation and vice versa
            this.connectionToConversation.set(mcpConnectionId, conversationId);
            this.conversationToConnection.set(conversationId, mcpConnectionId);

            logger.info(`Conversation ${conversationId} started with MCP connection ${mcpConnectionId}`);
            return conversationId;
        } catch (error) {
            logger.error('Failed to start conversation:', error);
            throw error;
        }
    }

    /**
     * Process a query with the Fireworks model and handle tool calls via MCP
     */
    public async processQuery(conversationId: string, query: string): Promise<string> {
        logger.info(`Processing query for conversation ${conversationId}`);

        try {
            // Get the conversation
            const conversation = this.activeConversations.get(conversationId);
            if (!conversation) {
                throw new Error(`Conversation not found: ${conversationId}`);
            }

            const { model, mcpClient } = conversation;

            // List available tools from MCP
            const toolsResult = await mcpClient.listTools();
            const mcpTools = toolsResult.tools || [];

            // Convert MCP tools to Fireworks format
            const fireworksTools: Tool[] = mcpTools.map(tool => ({
                type: 'function',
                function: {
                    name: tool.name,
                    description: tool.description || `Tool: ${tool.name}`,
                    parameters: tool.inputSchema || { type: 'object', properties: {} }
                }
            }));

            logger.info(`Found ${fireworksTools.length} tools from MCP`);

            // Generate response with tools
            const response = await model.generateWithTools(query, fireworksTools);

            // Check if the model wants to call a function
            const message = response.choices[0].message;

            if (message.tool_calls && message.tool_calls.length > 0) {
                logger.info(`Model requested ${message.tool_calls.length} tool calls`);

                let finalResponse = '';

                // Process each tool call
                for (const toolCall of message.tool_calls) {
                    if (toolCall.type === 'function') {
                        const toolName = toolCall.function.name;
                        const toolArgs = JSON.parse(toolCall.function.arguments);

                        logger.info(`Calling tool: ${toolName} with args:`, toolArgs);

                        try {
                            // Call the tool via MCP
                            const result = await mcpClient.callTool({
                                name: toolName,
                                arguments: toolArgs
                            });

                            logger.info(`Tool call successful:`, result);

                            // Emit tool call success event
                            this.eventEmitter.emit('tool-call-success', {
                                connectionId: this.conversationToConnection.get(conversationId),
                                toolCall: {
                                    toolName,
                                    toolArgs
                                },
                                result
                            });

                            // Add function result to the conversation
                            model.addFunctionResult(toolName, result.output || result);

                            // Get the model's final response with the function result
                            const functionResponse = await model.generate("Please provide a helpful response based on the tool's result.");

                            // Append to the final response
                            if (finalResponse) {
                                finalResponse += '\n\n';
                            }
                            finalResponse += functionResponse;
                        } catch (error) {
                            logger.error(`Error calling tool ${toolName}:`, error);

                            // Emit tool call error event
                            this.eventEmitter.emit('tool-call-error', {
                                connectionId: this.conversationToConnection.get(conversationId),
                                toolCall: {
                                    toolName,
                                    toolArgs
                                },
                                error: error instanceof Error ? error.message : String(error)
                            });

                            // Add error as function result
                            model.addFunctionResult(toolName, {
                                error: error instanceof Error ? error.message : String(error)
                            });

                            // Get the model's response to the error
                            const errorResponse = await model.generate("An error occurred with the tool. Please provide a helpful response.");

                            // Append to the final response
                            if (finalResponse) {
                                finalResponse += '\n\n';
                            }
                            finalResponse += errorResponse;
                        }
                    }
                }

                return finalResponse || 'Error processing tool calls';
            } else {
                // Model responded directly without using a tool
                return message.content || 'No response from model';
            }
        } catch (error) {
            logger.error(`Error processing query for conversation ${conversationId}:`, error);
            throw error;
        }
    }

    /**
     * Register a listener for successful tool calls
     */
    public onToolCallSuccess(callback: (data: MCPToolCallResult) => void): () => void {
        this.eventEmitter.on('tool-call-success', callback);
        return () => this.eventEmitter.off('tool-call-success', callback);
    }

    /**
     * Register a listener for tool call errors
     */
    public onToolCallError(callback: (data: MCPToolCallError) => void): () => void {
        this.eventEmitter.on('tool-call-error', callback);
        return () => this.eventEmitter.off('tool-call-error', callback);
    }

    /**
     * End a conversation and clean up resources
     */
    public endConversation(conversationId: string): boolean {
        try {
            logger.info(`Ending conversation ${conversationId}`);

            // Get the conversation
            const conversation = this.activeConversations.get(conversationId);
            if (!conversation) {
                logger.warn(`Conversation not found: ${conversationId}`);
                return false;
            }

            // Get the associated MCP connection ID
            const mcpConnectionId = this.conversationToConnection.get(conversationId);

            // Clean up mappings
            this.activeConversations.delete(conversationId);
            if (mcpConnectionId) {
                this.connectionToConversation.delete(mcpConnectionId);
                this.conversationToConnection.delete(conversationId);
            }

            logger.info(`Conversation ${conversationId} ended`);
            return true;
        } catch (error) {
            logger.error(`Error ending conversation ${conversationId}:`, error);
            return false;
        }
    }

    /**
     * Clean up all resources
     */
    public dispose(): void {
        logger.info('Disposing FireworksMCPService');

        // Clear all event listeners
        this.eventEmitter.removeAllListeners();

        // Clear all conversations
        this.activeConversations.clear();
        this.connectionToConversation.clear();
        this.conversationToConnection.clear();

        // Clear all clients
        this.clients.clear();

        logger.info('FireworksMCPService disposed');
    }
} 