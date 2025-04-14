/**
 * Test script for Fireworks AI integration
 * 
 * This script tests the integration of Fireworks AI with the airtrain npm package.
 * It verifies the basic functionality including:
 * - Provider initialization
 * - Chat completion
 * - Streaming completion
 * 
 * Run with: npx ts-node src/test_fireworks.ts
 */

import { FireworksClient, Message, MessageRole } from 'airtrain/dist/integrations/fireworks';

// API key for testing - replace with your actual key
const API_KEY = ''; // Enter your API key here from https://platform.airtrain.dev/settings/api-keys

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

async function main() {
    console.log('=== Testing Fireworks AI Integration ===');

    try {
        // Test 1: Initialize client
        console.log('\n\n[TEST 1] Initializing Fireworks Client');
        const client = new FireworksClient({
            apiKey: API_KEY,
            defaultModel: 'accounts/fireworks/models/deepseek-r1'
        });
        console.log('✅ Client initialized successfully');

        // Test 2: Chat completion
        console.log('\n\n[TEST 2] Testing Chat Completion');
        console.log('Messages:', JSON.stringify(TEST_MESSAGES, null, 2));

        console.log('Sending request to Fireworks AI...');
        const startTime = Date.now();
        const response = await client.createChatCompletion(TEST_MESSAGES);
        const endTime = Date.now();

        console.log(`✅ Received response in ${endTime - startTime}ms`);
        console.log('Response:', response.choices[0]?.message?.content);

        // Test 3: Streaming completion
        console.log('\n\n[TEST 3] Testing Streaming Chat Completion');

        console.log('Sending streaming request...');

        // Create a stream and process the chunks
        const streamStart = Date.now();
        console.log('Assistant: ');

        // Use the streaming API
        const stream = await client.createChatCompletionStream(TEST_MESSAGES);

        let streamedContent = '';

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                process.stdout.write(content);
                streamedContent += content;
            }
        }

        const streamEnd = Date.now();
        console.log(`\n\n✅ Streaming completed in ${streamEnd - streamStart}ms`);
        console.log(`Total streamed content length: ${streamedContent.length} characters`);

        console.log('\n\n=== All tests completed successfully ===');
    } catch (error) {
        console.error('❌ Test failed with error:');
        console.error(error);
    }
}

// Run the tests
main().catch(console.error); 