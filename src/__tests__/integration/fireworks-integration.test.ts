import { FireworksClient } from 'airtrain/dist/integrations/fireworks';
import { mainLogger } from '../../main/logger';

// Mock the logger
jest.mock('../../main/logger', () => ({
    mainLogger: {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

// Mock the client's response methods
const mockCreateChatCompletion = jest.fn().mockResolvedValue({
    choices: [{ message: { content: 'Mock response' } }]
});

const mockStreamChatCompletion = jest.fn().mockResolvedValue({
    streamId: 'mock-stream-id',
    read: jest.fn().mockImplementation(callback => {
        callback(null, { choices: [{ delta: { content: 'chunk' } }] });
        callback(null, { choices: [{ delta: { content: '' } }] });
        return Promise.resolve();
    })
});

// Mock constructor
jest.mock('airtrain/dist/integrations/fireworks', () => ({
    FireworksClient: jest.fn().mockImplementation(() => ({
        createChatCompletion: mockCreateChatCompletion,
        streamChatCompletion: mockStreamChatCompletion
    }))
}));

describe('Fireworks Integration', () => {
    let client: any;

    beforeEach(() => {
        jest.clearAllMocks();
        client = new FireworksClient({
            apiKey: 'test-key',
            baseURL: 'https://api.fireworks.ai/inference/v1',
            defaultModel: 'accounts/fireworks/models/llama-v3p1-70b-instruct'
        });
    });

    it('should initialize the FireworksClient with API key', () => {
        expect(FireworksClient).toHaveBeenCalledWith({
            apiKey: 'test-key',
            baseURL: 'https://api.fireworks.ai/inference/v1',
            defaultModel: 'accounts/fireworks/models/llama-v3p1-70b-instruct'
        });
    });

    it('should send chat completion requests with correct parameters', async () => {
        const messages = [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Hello' }
        ];

        const options = {
            temperature: 0.7,
            max_tokens: 1000
        };

        await client.createChatCompletion(messages, {
            model: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
            ...options
        });

        expect(mockCreateChatCompletion).toHaveBeenCalledWith(messages, {
            model: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
            temperature: 0.7,
            max_tokens: 1000
        });
    });

    it('should handle streaming chat completions', async () => {
        const messages = [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Tell me a story' }
        ];

        const options = {
            temperature: 0.8,
            max_tokens: 2000
        };

        const callbackSpy = jest.fn();

        await client.streamChatCompletion(messages, {
            model: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
            ...options
        });

        expect(mockStreamChatCompletion).toHaveBeenCalledWith(messages, {
            model: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
            temperature: 0.8,
            max_tokens: 2000
        });
    });

    it('should handle API errors gracefully', async () => {
        // Mock a failure
        mockCreateChatCompletion.mockRejectedValueOnce(new Error('API Error'));

        const messages = [{ role: 'user', content: 'Hello' }];

        try {
            await client.createChatCompletion(messages, {
                model: 'accounts/fireworks/models/llama-v3p1-70b-instruct'
            });
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toBe('API Error');
        }

        expect.assertions(2); // Ensure the catch block is executed
    });
}); 