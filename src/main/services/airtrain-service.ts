import { FireworksClient } from 'airtrain/dist/integrations/fireworks';
// Import Groq dynamically to handle case when it's not available
let GroqClient: any = null;
try {
    // Try to dynamically import the Groq client
    const groqModule = require('airtrain/dist/integrations/groq');
    GroqClient = groqModule.GroqClient;
} catch (error) {
    console.warn('Groq client not available, will use mock implementation');
    // Create a mock Groq client for when the real one isn't available
    GroqClient = class MockGroqClient {
        constructor(options: any) {
            console.log('Creating mock Groq client with options:', options);
        }

        async createChatCompletion(messages: any[], options?: any) {
            console.log('Mock Groq createChatCompletion called with messages:', messages);
            return {
                choices: [{
                    message: {
                        role: 'assistant',
                        content: 'This is a mock response from Groq. The real Groq client is not available. Please make sure the airtrain npm package includes Groq support.'
                    }
                }]
            };
        }

        async createChatCompletionStream(messages: any[], options?: any) {
            console.log('Mock Groq createChatCompletionStream called with messages:', messages);
            // Return a mock async iterator
            return {
                [Symbol.asyncIterator]() {
                    let chunks = [
                        { choices: [{ delta: { content: 'This is a mock response from Groq. ' } }] },
                        { choices: [{ delta: { content: 'The real Groq client is not available. ' } }] },
                        { choices: [{ delta: { content: 'Please make sure the airtrain npm package includes Groq support.' } }] }
                    ];
                    let index = 0;
                    return {
                        async next() {
                            if (index < chunks.length) {
                                return { value: chunks[index++], done: false };
                            }
                            return { value: undefined, done: true };
                        }
                    };
                }
            };
        }
    };
}
import { EventEmitter } from 'events';
import { mainLogger as logger } from '../logger';

// Map of supported providers to their module paths
// Only Fireworks is enabled now, others can be added later
const PROVIDER_MODULES: Record<string, string> = {
    fireworks: 'airtrain/dist/integrations/fireworks',
    groq: 'airtrain/dist/integrations/groq'
    // Add more providers here when needed:
    // openai: 'airtrain/dist/integrations/openai',
    // anthropic: 'airtrain/dist/integrations/anthropic',
    // together: 'airtrain/dist/integrations/together',
    // cerebras: 'airtrain/dist/integrations/cerebras',
    // google: 'airtrain/dist/integrations/google',
};

// Client interfaces
interface CompletionOptions {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    stop?: string[];
    [key: string]: any;
}

interface Message {
    role: string;
    content: string;
    [key: string]: any;
}

interface StreamResponseData {
    streamId: string;
    chunk: {
        content: string;
        done: boolean;
    };
}

interface StreamErrorData {
    streamId: string;
    error: string;
}

interface StreamEndData {
    streamId: string;
}

// Streaming response event emitter
class ResponseStream extends EventEmitter {
    constructor() {
        super();
    }
}

export class AirtrainService {
    private clients: Map<string, any> = new Map();
    private activeStreams: Map<string, ResponseStream> = new Map();
    private isInitialized: Map<string, boolean> = new Map();
    public eventEmitter: EventEmitter = new EventEmitter();

    constructor() {
        logger.info('Initializing AirtrainService');
    }

    /**
     * Initialize a provider client with API key
     */
    public async initializeProvider(provider: string, apiKey: string): Promise<boolean> {
        logger.info(`Initializing provider: ${provider}`);

        if (!PROVIDER_MODULES[provider]) {
            logger.error(`Unsupported provider: ${provider}`);
            return false;
        }

        try {
            // For Fireworks, directly use the imported client
            if (provider === 'fireworks') {
                logger.debug(`Creating Fireworks client with API key`);
                const client = new FireworksClient({
                    apiKey,
                    defaultModel: 'accounts/fireworks/models/deepseek-r1'
                });

                this.clients.set(provider, client);
                this.isInitialized.set(provider, true);

                logger.info(`Successfully initialized provider: ${provider}`);
                return true;
            }
            // For Groq, use the imported client
            else if (provider === 'groq') {
                logger.debug(`Creating Groq client with API key`);
                // Don't set a defaultModel to allow flexibility with model selection
                console.log(`[GROQ MODEL DEBUG] Initializing Groq client without hardcoded default model`);
                const client = new GroqClient({
                    apiKey
                    // Removed defaultModel to allow runtime model selection
                });

                this.clients.set(provider, client);
                this.isInitialized.set(provider, true);

                logger.info(`Successfully initialized provider: ${provider}`);
                return true;
            } else {
                logger.error(`Provider ${provider} is not yet supported in this version.`);
                return false;
            }
        } catch (error) {
            logger.error(`Failed to initialize provider: ${provider}`, error);
            this.isInitialized.set(provider, false);
            return false;
        }
    }

    /**
     * Check if a provider is initialized
     */
    public isProviderInitialized(provider: string): boolean {
        return this.isInitialized.get(provider) || false;
    }

    /**
     * Get available models for a provider
     */
    public async listModels(provider: string): Promise<string[]> {
        logger.info(`Listing models for provider: ${provider}`);

        if (!this.isProviderInitialized(provider)) {
            logger.error(`Provider not initialized: ${provider}`);
            throw new Error(`Provider not initialized: ${provider}`);
        }

        try {
            const client = this.clients.get(provider);

            if (!client) {
                logger.error(`Client not found for provider: ${provider}`);
                return [];
            }

            // Return default model list for Fireworks
            if (provider === 'fireworks') {
                // Return a list of available Fireworks models
                return [
                    'accounts/fireworks/models/deepseek-r1',
                    'accounts/fireworks/models/llama-v3p1-405b-instruct', // Supports MCP
                    'accounts/fireworks/models/llama-v3p1-70b-instruct',  // Supports MCP
                    'accounts/fireworks/models/qwen2p5-72b-instruct',     // Supports MCP
                    'accounts/fireworks/models/llama4-maverick-instruct-basic',
                    'accounts/fireworks/models/llama4-scout-instruct-basic'
                ];
            }
            // Return default model list for Groq
            else if (provider === 'groq') {
                return [
                    'meta-llama/llama-4-scout-17b-16e-instruct',
                    'llama3-70b-8192',
                    'llama3-8b-8192',
                    'qwen-qwq-32b',
                    'qwen-2.5-32b',
                    'deepseek-r1-distill-qwen-32b',
                    'deepseek-r1-distill-llama-70b'
                ];
            }

            return [];
        } catch (error) {
            logger.error(`Error listing models for provider ${provider}:`, error);
            return [];
        }
    }

    /**
     * Send a chat completion request
     */
    public async chatCompletion(
        provider: string,
        model: string,
        messages: Message[],
        options: CompletionOptions = {}
    ): Promise<any> {
        logger.info(`Chat completion request: ${provider}/${model}`);
        logger.debug(`Messages: ${messages.length}, Options:`, options);
        console.log(`[MODEL DEBUG] Chat completion with provider: ${provider}, model: ${model}`);

        if (!this.isProviderInitialized(provider)) {
            logger.error(`Provider not initialized: ${provider}`);
            throw new Error(`Provider ${provider} is not initialized`);
        }

        const client = this.clients.get(provider);

        if (!client) {
            logger.error(`Client not found for provider: ${provider}`);
            throw new Error(`Client not found for provider: ${provider}`);
        }

        try {
            // Track performance
            const startTime = Date.now();

            // Call the appropriate client method
            const response = await client.createChatCompletion(messages, {
                model,
                ...options
            });

            const endTime = Date.now();
            logger.debug(`Chat completion completed in ${endTime - startTime}ms`);
            console.log(`[MODEL DEBUG] Chat completion completed with model: ${model}`);

            return response;
        } catch (error) {
            logger.error(`Error in chat completion with ${provider}/${model}:`, error);
            throw error;
        }
    }

    /**
     * Register a listener for stream response events
     */
    public onStreamResponse(callback: (data: StreamResponseData) => void): () => void {
        this.eventEmitter.on('stream-response', callback);
        return () => this.eventEmitter.off('stream-response', callback);
    }

    /**
     * Register a listener for stream error events
     */
    public onStreamError(callback: (data: StreamErrorData) => void): () => void {
        this.eventEmitter.on('stream-error', callback);
        return () => this.eventEmitter.off('stream-error', callback);
    }

    /**
     * Register a listener for stream end events
     */
    public onStreamEnd(callback: (data: StreamEndData) => void): () => void {
        this.eventEmitter.on('stream-end', callback);
        return () => this.eventEmitter.off('stream-end', callback);
    }

    /**
     * Remove all stream event listeners
     */
    public removeStreamListeners(): void {
        this.eventEmitter.removeAllListeners('stream-response');
        this.eventEmitter.removeAllListeners('stream-error');
        this.eventEmitter.removeAllListeners('stream-end');
    }

    /**
     * Send a streaming chat completion request
     * Returns a streamId that can be used to cancel the stream
     */
    public streamChatCompletion(
        provider: string,
        model: string,
        messages: Message[],
        options: CompletionOptions = {}
    ): string {
        logger.info(`Streaming chat completion request: ${provider}/${model}`);
        console.log(`[MODEL DEBUG] Stream request with provider: ${provider}, model: ${model}`);

        // Log messages for debugging
        logger.debug(`Messages: ${messages.length}, Options:`, options);

        // Check provider initialization
        if (!this.isProviderInitialized(provider)) {
            logger.error(`Provider ${provider} is not initialized`);
            throw new Error(`Provider ${provider} is not initialized`);
        }

        // Get client
        const client = this.clients.get(provider);
        if (!client) {
            logger.error(`Client not found for provider: ${provider}`);
            throw new Error(`Client not found for provider: ${provider}`);
        }

        // Create a stream ID
        const streamId = `stream-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

        // Create a response stream and track it
        const responseStream = new ResponseStream();
        this.activeStreams.set(streamId, responseStream);

        // Get the appropriate model based on provider
        let mappedModel = model;

        console.log(`[MODEL DEBUG] Using model for stream: ${mappedModel}`);

        // Process the stream in the background
        const processStream = async () => {
            try {
                // Format messages for the provider
                const formattedMessages = messages.map(m => ({
                    role: m.role,
                    content: m.content
                }));

                // Create a request object with the model and options
                const streamOptions = {
                    model: mappedModel,
                    stream: true,
                    ...options
                };

                logger.debug(`Starting stream chat completion with options:`, streamOptions);
                console.log(`[MODEL DEBUG] Stream options: ${JSON.stringify({ model: streamOptions.model, stream: streamOptions.stream })}`);

                // Use the client's createChatCompletionStream method
                try {
                    const stream = await client.createChatCompletionStream(formattedMessages, streamOptions);
                    console.log(`[MODEL DEBUG] Stream successfully created for model: ${mappedModel}`);

                    // Set up event listeners for the stream
                    for await (const chunk of stream) {
                        // Process each chunk from the stream
                        const content = chunk.choices?.[0]?.delta?.content || '';

                        console.log(`[DEBUG-BACKEND] Stream chunk received for ${streamId}:`,
                            content.substring(0, 20) + (content.length > 20 ? '...' : ''));

                        // Emit the data to our event system
                        this.eventEmitter.emit('stream-response', {
                            streamId,
                            chunk: {
                                content,
                                done: false
                            }
                        });
                    }

                    // Stream is complete, emit end event
                    console.log(`[DEBUG-BACKEND] Stream ${streamId} completed, emitting end event`);
                    this.eventEmitter.emit('stream-end', { streamId });
                    this.activeStreams.delete(streamId);

                    logger.debug(`Stream ${streamId} completed successfully`);
                } catch (error: any) {
                    logger.error(`Error in stream processing for ${streamId}:`, error);
                    console.log(`[DEBUG-BACKEND] Error in stream ${streamId}: ${error.stack || error}`);

                    // Add detailed Groq-specific error logging
                    if (provider === 'groq') {
                        console.log(`[GROQ ERROR] Provider: ${provider}, Model: ${mappedModel}`);
                        console.log(`[GROQ ERROR] Error details:`, error);
                        if (error.response) {
                            console.log(`[GROQ ERROR] Response status:`, error.response.status);
                            console.log(`[GROQ ERROR] Response data:`, error.response.data);
                        }
                    }

                    this.eventEmitter.emit('stream-error', {
                        streamId,
                        error: error.message || String(error)
                    });

                    this.activeStreams.delete(streamId);
                }
            } catch (error: any) {
                logger.error(`Error processing stream:`, error);

                // Add detailed Groq-specific error logging
                if (provider === 'groq') {
                    console.log(`[GROQ ERROR] Provider: ${provider}, Model: ${mappedModel}`);
                    console.log(`[GROQ ERROR] Error details:`, error);
                    if (error.response) {
                        console.log(`[GROQ ERROR] Response status:`, error.response.status);
                        console.log(`[GROQ ERROR] Response data:`, error.response.data);
                    }
                }

                this.eventEmitter.emit('stream-error', {
                    streamId,
                    error: error.message || String(error)
                });

                this.activeStreams.delete(streamId);
            }
        };

        // Start processing in the background
        processStream();

        // Return the stream ID so the client can reference it later
        return streamId;
    }

    /**
     * Cancel an active stream
     */
    public cancelStream(streamId: string): boolean {
        logger.info(`Cancelling stream: ${streamId}`);

        if (!this.activeStreams.has(streamId)) {
            logger.warn(`Stream not found: ${streamId}`);
            return false;
        }

        const stream = this.activeStreams.get(streamId);
        stream?.emit('cancel');
        this.activeStreams.delete(streamId);

        logger.debug(`Stream cancelled: ${streamId}`);
        return true;
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        logger.info('Disposing AirtrainService');

        // Cancel all active streams
        for (const streamId of this.activeStreams.keys()) {
            this.cancelStream(streamId);
        }

        // Clear all clients
        this.clients.clear();
        this.isInitialized.clear();
    }
}

// Export singleton instance
export const airtrainService = new AirtrainService(); 