import { AirtrainService } from '../../../../main/services/airtrain-service';
import { EventEmitter } from 'events';
import { FireworksClient } from 'airtrain/dist/integrations/fireworks';

// Mock airtrain/dist/integrations/fireworks
jest.mock('airtrain/dist/integrations/fireworks', () => ({
    FireworksClient: jest.fn().mockImplementation(() => ({
        createChatCompletion: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Mock response' } }]
        }),
        streamChatCompletion: jest.fn().mockResolvedValue({
            streamId: 'mock-stream-id',
            read: jest.fn().mockImplementation(callback => {
                callback(null, { choices: [{ delta: { content: 'chunk' } }] });
                callback(null, { choices: [{ delta: { content: '' } }] });
                return Promise.resolve();
            })
        }),
        cancelStream: jest.fn().mockResolvedValue(true)
    }))
}));

// Mock logger
jest.mock('../../../../main/logger', () => ({
    mainLogger: {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

describe('AirtrainService', () => {
    let airtrainService: AirtrainService;

    beforeEach(() => {
        jest.clearAllMocks();
        airtrainService = new AirtrainService();
    });

    describe('initializeProvider', () => {
        it('should initialize a Fireworks provider', async () => {
            const result = await airtrainService.initializeProvider('fireworks', 'dummy-api-key');

            expect(FireworksClient).toHaveBeenCalledWith({
                apiKey: 'dummy-api-key',
                defaultModel: 'accounts/fireworks/models/deepseek-r1'
            });
            expect(result).toBe(true);
        });

        it('should return false for unsupported provider', async () => {
            const result = await airtrainService.initializeProvider('unsupported', 'dummy-api-key');
            expect(result).toBe(false);
        });

        it('should handle initialization errors', async () => {
            // Make the FireworksClient constructor throw an error
            (FireworksClient as jest.Mock).mockImplementationOnce(() => {
                throw new Error('API key invalid');
            });

            const result = await airtrainService.initializeProvider('fireworks', 'invalid-key');
            expect(result).toBe(false);
        });
    });

    describe('isProviderInitialized', () => {
        it('should return true when provider is initialized', async () => {
            await airtrainService.initializeProvider('fireworks', 'dummy-api-key');
            expect(airtrainService.isProviderInitialized('fireworks')).toBe(true);
        });

        it('should return false when provider is not initialized', () => {
            expect(airtrainService.isProviderInitialized('fireworks')).toBe(false);
        });
    });

    describe('listModels', () => {
        it('should list Fireworks models when initialized', async () => {
            await airtrainService.initializeProvider('fireworks', 'dummy-api-key');
            const models = await airtrainService.listModels('fireworks');

            // Verify deepseek-r1 is included in the models list
            expect(models).toContain('accounts/fireworks/models/deepseek-r1');
            // Verify we get multiple models
            expect(models.length).toBeGreaterThan(1);
        });

        it('should throw error when provider not initialized', async () => {
            await expect(airtrainService.listModels('fireworks')).rejects.toThrow();
        });
    });

    describe('chatCompletion', () => {
        it('should call createChatCompletion on client', async () => {
            // Initialize provider first
            await airtrainService.initializeProvider('fireworks', 'dummy-api-key');

            // Get reference to the mocked client
            const mockClient = (FireworksClient as jest.Mock).mock.results[0].value;

            const messages = [{ role: 'user', content: 'Hello' }];
            const options = { temperature: 0.7 };

            const result = await airtrainService.chatCompletion(
                'fireworks',
                'accounts/fireworks/models/deepseek-r1',
                messages,
                options
            );

            expect(mockClient.createChatCompletion).toHaveBeenCalledWith(
                messages,
                {
                    model: 'accounts/fireworks/models/deepseek-r1',
                    temperature: 0.7
                }
            );

            expect(result).toEqual({
                choices: [{ message: { content: 'Mock response' } }]
            });
        });

        it('should throw error when provider not initialized', async () => {
            const messages = [{ role: 'user', content: 'Hello' }];

            await expect(airtrainService.chatCompletion(
                'fireworks',
                'accounts/fireworks/models/deepseek-r1',
                messages
            )).rejects.toThrow();
        });
    });

    describe('Stream events', () => {
        it('should register and remove stream event handlers', () => {
            // Create spy for EventEmitter methods
            const onSpy = jest.spyOn(airtrainService.eventEmitter, 'on');
            const offSpy = jest.spyOn(airtrainService.eventEmitter, 'off');

            const callback = jest.fn();

            // Register callback
            const removeListener = airtrainService.onStreamResponse(callback);

            expect(onSpy).toHaveBeenCalledWith('stream-response', callback);

            // Remove callback
            removeListener();

            expect(offSpy).toHaveBeenCalledWith('stream-response', callback);
        });
    });
}); 