import '../openai-shim'; // Import the OpenAI shim for Web Fetch API
import { FireworksClient, Message, MessageRole } from 'airtrain/dist/integrations/fireworks';

// Mock the FireworksClient
jest.mock('airtrain/dist/integrations/fireworks', () => {
    const mockStream = {
        [Symbol.asyncIterator]: jest.fn().mockImplementation(function* () {
            yield { choices: [{ delta: { content: 'Test' } }] };
            yield { choices: [{ delta: { content: ' content' } }] };
            yield { choices: [{ delta: { content: '' } }] };
        })
    };

    return {
        FireworksClient: jest.fn().mockImplementation(() => ({
            createChatCompletion: jest.fn().mockResolvedValue({
                choices: [{ message: { content: 'Mock response' } }]
            }),
            createChatCompletionStream: jest.fn().mockResolvedValue(mockStream)
        })),
        Message: jest.requireActual('airtrain/dist/integrations/fireworks').Message,
        MessageRole: {
            SYSTEM: 'system',
            USER: 'user',
            ASSISTANT: 'assistant'
        }
    };
});

// Mock console methods
const originalConsole = { ...console };
const mockConsole = {
    log: jest.fn(),
    error: jest.fn(),
    stdout: {
        write: jest.fn()
    }
};

// Mock process.stdout
jest.spyOn(process.stdout, 'write').mockImplementation(mockConsole.stdout.write);

describe('test_fireworks.ts', () => {
    // Store the original module.exports
    const originalExports = { ...module.exports };

    beforeAll(() => {
        // Replace console methods with mocks
        global.console = { ...originalConsole, ...mockConsole };
    });

    afterAll(() => {
        // Restore console methods
        global.console = originalConsole;
        // Restore module.exports
        module.exports = originalExports;
    });

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    // Test the main function
    describe('main function', () => {
        it('should run all tests successfully', async () => {
            // We need to import the module dynamically to test it
            // This is because the module immediately invokes main() when loaded
            jest.isolateModules(() => {
                // Import the module to test its behavior
                require('../../test_fireworks');
            });

            // Wait for all promises to resolve
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify client initialization
            expect(FireworksClient).toHaveBeenCalledWith({
                apiKey: expect.any(String),
                defaultModel: 'accounts/fireworks/models/deepseek-r1'
            });

            // Verify chat completion
            const clientInstance = (FireworksClient as jest.Mock).mock.results[0].value;
            expect(clientInstance.createChatCompletion).toHaveBeenCalled();

            // Verify streaming completion
            expect(clientInstance.createChatCompletionStream).toHaveBeenCalled();

            // Verify logging
            expect(mockConsole.log).toHaveBeenCalledWith(
                expect.stringContaining('=== Testing Fireworks AI Integration ===')
            );
            expect(mockConsole.log).toHaveBeenCalledWith(
                expect.stringContaining('[TEST 1] Initializing Fireworks Client')
            );
            expect(mockConsole.log).toHaveBeenCalledWith(
                expect.stringContaining('[TEST 2] Testing Chat Completion')
            );
            expect(mockConsole.log).toHaveBeenCalledWith(
                expect.stringContaining('[TEST 3] Testing Streaming Chat Completion')
            );
            expect(mockConsole.log).toHaveBeenCalledWith(
                expect.stringContaining('=== All tests completed successfully ===')
            );
        });

        it('should handle errors gracefully', async () => {
            // Mock createChatCompletion to throw an error
            const mockError = new Error('API Error');
            (FireworksClient as jest.Mock).mockImplementationOnce(() => ({
                createChatCompletion: jest.fn().mockRejectedValue(mockError),
                createChatCompletionStream: jest.fn().mockResolvedValue({
                    [Symbol.asyncIterator]: jest.fn().mockImplementation(function* () {
                        yield { choices: [{ delta: { content: 'Error test' } }] };
                    })
                })
            }));

            jest.isolateModules(() => {
                require('../../test_fireworks');
            });

            // Wait for promises to resolve
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify error handling
            expect(mockConsole.error).toHaveBeenCalledWith(
                expect.stringContaining('❌ Test failed with error:')
            );
            expect(mockConsole.error).toHaveBeenCalledWith(mockError);
        });
    });
}); 