// This file imports the OpenAI node shim for tests that need the Web Fetch API
import 'openai/shims/node';
import '@anthropic-ai/sdk/shims/node';

// Add a dummy test to satisfy Jest's requirement
describe('OpenAI and Anthropic shims', () => {
    it('should be loaded correctly', () => {
        // This is just a dummy test to pass Jest's validation
        expect(true).toBe(true);
    });
}); 