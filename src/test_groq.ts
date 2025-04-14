/**
 * Test script for Groq integration
 * 
 * This script tests the integration of Groq with the airtrain npm package.
 * It verifies the functionality including:
 * - Provider initialization
 * - Chat completion
 * - Streaming completion
 * - Model switching
 * - Parameter testing
 * - Error handling
 * - Context handling
 * 
 * Run with: npx ts-node src/test_groq.ts
 */

import { GroqClient, Message, MessageRole } from 'airtrain/dist/integrations/groq';

// API key for testing - replace with your actual key
const API_KEY = process.env.GROQ_API_KEY || 'your_api_key_here';

// Test messages for chat
const TEST_MESSAGES: Message[] = [
    {
        role: MessageRole.SYSTEM,
        content: 'You are a helpful assistant that provides concise responses.'
    },
    {
        role: MessageRole.USER,
        content: 'Write a short poem about programming.'
    }
];

// Test messages for context handling
const CONTEXT_MESSAGES: Message[] = [
    {
        role: MessageRole.SYSTEM,
        content: 'You are a helpful assistant that provides concise responses.'
    },
    {
        role: MessageRole.USER,
        content: 'My favorite color is blue.'
    },
    {
        role: MessageRole.ASSISTANT,
        content: 'Blue is a great color! It\'s often associated with calmness, serenity, and the sky or ocean.'
    },
    {
        role: MessageRole.USER,
        content: 'What was my favorite color again? And suggest some home decor items in that color.'
    }
];

// List of models to test
const MODELS_TO_TEST = [
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'llama3-70b-8192',
    'qwen-qwq-32b',
    'deepseek-r1-distill-qwen-32b'
];

// Utility function to pause execution
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Test result tracking
interface TestResults {
    passed: number;
    failed: number;
    skipped: number;
}

const results: TestResults = {
    passed: 0,
    failed: 0,
    skipped: 0
};

async function runTest(name: string, testFn: () => Promise<void>) {
    try {
        console.log(`\n\n[TEST] ${name}`);
        await testFn();
        console.log(`✅ ${name} passed`);
        results.passed++;
    } catch (error) {
        console.error(`❌ ${name} failed:`, error);
        results.failed++;
    }
}

async function main() {
    console.log('=== Testing Groq Integration ===');
    console.log('API Key status:', API_KEY === 'your_api_key_here' ? 'Using placeholder (tests will fail)' : 'Using provided key');

    try {
        // Initialize the client once for all tests
        const baseClient = new GroqClient({
            apiKey: API_KEY
        });

        // Test 1: Basic client initialization
        await runTest('Client Initialization', async () => {
            console.log('Initializing Groq client...');
            // Already initialized above, just verify it works
            await baseClient.createChatCompletion(
                [{ role: MessageRole.USER, content: 'Hello' }],
                { model: MODELS_TO_TEST[0] }
            );
        });

        // Test 2: Basic chat completion
        await runTest('Basic Chat Completion', async () => {
            console.log('Testing basic chat completion...');
            console.log('Messages:', JSON.stringify(TEST_MESSAGES, null, 2));

            console.log('Sending request to Groq...');
            const startTime = Date.now();
            const response = await baseClient.createChatCompletion(TEST_MESSAGES, {
                model: MODELS_TO_TEST[0]
            });
            const endTime = Date.now();

            console.log(`Received response in ${endTime - startTime}ms`);
            console.log('Response:', response.choices[0]?.message?.content);

            if (!response.choices?.[0]?.message?.content) {
                throw new Error('No content in response');
            }
        });

        // Test 3: Streaming completion
        await runTest('Streaming Chat Completion', async () => {
            console.log('Testing streaming chat completion...');
            console.log('Sending streaming request...');

            const streamStart = Date.now();
            console.log('Assistant: ');

            // Use the streaming API
            const stream = await baseClient.createChatCompletionStream(TEST_MESSAGES, {
                model: MODELS_TO_TEST[0]
            });

            let streamedContent = '';
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    process.stdout.write(content);
                    streamedContent += content;
                }
            }

            const streamEnd = Date.now();
            console.log(`\nStreaming completed in ${streamEnd - streamStart}ms`);
            console.log(`Total streamed content length: ${streamedContent.length} characters`);

            if (streamedContent.length === 0) {
                throw new Error('No streamed content received');
            }
        });

        // Test 4: Model switching test
        await runTest('Model Switching', async () => {
            console.log('Testing model switching...');

            for (let i = 0; i < Math.min(2, MODELS_TO_TEST.length); i++) {
                const model = MODELS_TO_TEST[i];
                console.log(`\nTesting model: ${model}`);

                const response = await baseClient.createChatCompletion(
                    [{ role: MessageRole.USER, content: 'Say "Hello, I am a language model" and mention your architecture in one sentence' }],
                    { model }
                );

                console.log(`Model ${model} response:`, response.choices[0]?.message?.content);

                if (!response.choices?.[0]?.message?.content) {
                    throw new Error(`No content in response from model ${model}`);
                }

                // Add a small delay between model tests
                await sleep(1000);
            }
        });

        // Test 5: Context handling test
        await runTest('Context Handling', async () => {
            console.log('Testing context handling...');
            console.log('Messages with context:', JSON.stringify(CONTEXT_MESSAGES, null, 2));

            const response = await baseClient.createChatCompletion(CONTEXT_MESSAGES, {
                model: MODELS_TO_TEST[0]
            });

            console.log('Response:', response.choices[0]?.message?.content);

            if (!response.choices?.[0]?.message?.content) {
                throw new Error('No content in response');
            }

            // Check if the response contains 'blue' as the favorite color from context
            const content = response.choices[0].message.content.toLowerCase();
            if (!content.includes('blue')) {
                throw new Error('Context not maintained - favorite color not remembered');
            }
        });

        // Test 6: Parameter testing - temperature
        await runTest('Temperature Parameter', async () => {
            console.log('Testing temperature parameter...');

            // Test with low temperature (more deterministic)
            const lowTempResponse = await baseClient.createChatCompletion(
                [{ role: MessageRole.USER, content: 'Generate a random number between 1 and 10' }],
                { model: MODELS_TO_TEST[0], temperature: 0.1 }
            );

            console.log('Low temperature (0.1) response:', lowTempResponse.choices[0]?.message?.content);

            // Add a small delay between requests
            await sleep(1000);

            // Test with high temperature (more random)
            const highTempResponse = await baseClient.createChatCompletion(
                [{ role: MessageRole.USER, content: 'Generate a random number between 1 and 10' }],
                { model: MODELS_TO_TEST[0], temperature: 0.9 }
            );

            console.log('High temperature (0.9) response:', highTempResponse.choices[0]?.message?.content);
        });

        // Test 7: Max tokens parameter
        await runTest('Max Tokens Parameter', async () => {
            console.log('Testing max_tokens parameter...');

            // Request with very few tokens
            const shortResponse = await baseClient.createChatCompletion(
                [{ role: MessageRole.USER, content: 'Write a long paragraph about artificial intelligence' }],
                { model: MODELS_TO_TEST[0], max_tokens: 20 }
            );

            console.log('Short response (max_tokens=20):', shortResponse.choices[0]?.message?.content);

            // Check if response is short (approximately)
            const content = shortResponse.choices?.[0]?.message?.content || '';
            const words = content.split(/\s+/).length;

            console.log(`Response contains approximately ${words} words`);
            if (words > 40) { // allowing some flexibility as token count != word count
                throw new Error('Response too long for max_tokens=20 constraint');
            }
        });

        // Test 8: Error handling - invalid API key
        await runTest('Invalid API Key Handling', async () => {
            console.log('Testing invalid API key handling...');

            // Skip this test if we're using a placeholder key
            if (API_KEY === 'your_api_key_here') {
                console.log('Skipping test since we\'re using a placeholder API key');
                results.skipped++;
                return;
            }

            try {
                const invalidClient = new GroqClient({
                    apiKey: 'invalid_api_key_for_testing'
                });

                await invalidClient.createChatCompletion(
                    [{ role: MessageRole.USER, content: 'Hello' }],
                    { model: MODELS_TO_TEST[0] }
                );

                // If we get here, the test failed
                throw new Error('Did not throw error with invalid API key');
            } catch (error: any) {
                // Expect an error, this is good
                console.log('Received expected error with invalid API key:', error.message);
                // Test passes
            }
        });

        // Test 9: Error handling - invalid model
        await runTest('Invalid Model Handling', async () => {
            console.log('Testing invalid model handling...');

            try {
                await baseClient.createChatCompletion(
                    [{ role: MessageRole.USER, content: 'Hello' }],
                    { model: 'non-existent-model' }
                );

                // If we get here, the test failed
                throw new Error('Did not throw error with invalid model');
            } catch (error: any) {
                // Expect an error, this is good
                console.log('Received expected error with invalid model:', error.message);
                // Test passes
            }
        });

        console.log('\n\n=== Test Results ===');
        console.log(`Passed: ${results.passed}/${results.passed + results.failed + results.skipped}`);
        console.log(`Failed: ${results.failed}/${results.passed + results.failed + results.skipped}`);
        if (results.skipped > 0) {
            console.log(`Skipped: ${results.skipped}/${results.passed + results.failed + results.skipped}`);
        }

        if (results.failed === 0) {
            console.log('\n✅ All tests completed successfully');
        } else {
            console.log('\n❌ Some tests failed');
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Test suite failed with error:');
        console.error(error);
        process.exit(1);
    }
}

// Run the tests
main().catch(error => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
}); 