/**
 * Simple test script for Fireworks AI without MCP integration
 * 
 * This script tests basic functionality of the Fireworks AI integration
 * without the complexity of MCP.
 * 
 * Run with: npx ts-node src/test_fireworks_simple.ts
 */

import { FireworksModel, Tool } from 'airtrain/dist/integrations/fireworks';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// API key for Fireworks (replace with your own)
const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY;
if (!FIREWORKS_API_KEY) {
    throw new Error('FIREWORKS_API_KEY is not set in the environment variables');
}

/**
 * Simple example of using Fireworks AI
 */
async function testFireworksBasic() {
    console.log('=== Testing Basic Fireworks AI Integration ===');

    try {
        // Initialize Fireworks model
        console.log('\n[Step 1] Initializing Fireworks model...');
        const fireworksModel = new FireworksModel({
            apiKey: FIREWORKS_API_KEY as string,
            defaultModel: 'accounts/fireworks/models/llama-v3p1-70b-instruct'
        });
        console.log('✅ Fireworks model initialized');

        // Define a simple tool
        const temperatureConversionTool: Tool = {
            type: 'function',
            function: {
                name: 'convert_temperature',
                description: 'Convert temperature between Celsius and Fahrenheit',
                parameters: {
                    type: 'object',
                    properties: {
                        value: {
                            type: 'number',
                            description: 'The temperature value to convert'
                        },
                        from_unit: {
                            type: 'string',
                            description: 'The unit to convert from (celsius or fahrenheit)',
                            enum: ['celsius', 'fahrenheit']
                        },
                        to_unit: {
                            type: 'string',
                            description: 'The unit to convert to (celsius or fahrenheit)',
                            enum: ['celsius', 'fahrenheit']
                        }
                    },
                    required: ['value', 'from_unit', 'to_unit']
                }
            }
        };

        // Set up system prompt
        console.log('\n[Step 2] Setting up system prompt...');
        fireworksModel.setSystemPrompt('You are a helpful assistant that can convert temperatures using tools. You should always use the tools provided to you when appropriate.');
        console.log('✅ System prompt set');

        // Send query to Fireworks model
        console.log('\n[Step 3] Sending query to Fireworks model...');
        const query = 'Convert 25 degrees Celsius to Fahrenheit';
        console.log(`User query: "${query}"`);

        const response = await fireworksModel.generateWithTools(query, [temperatureConversionTool]);
        console.log('✅ Received response from Fireworks model');

        // Check response
        console.log('\n[Step 4] Checking response...');
        const message = response.choices[0].message;

        if (message.tool_calls && message.tool_calls.length > 0) {
            const toolCall = message.tool_calls[0];
            console.log(`✅ Model requested tool call: ${toolCall.function.name}`);
            console.log(`With arguments: ${toolCall.function.arguments}`);

            // Manually implement temperature conversion
            if (toolCall.type === 'function' && toolCall.function.name === 'convert_temperature') {
                // Parse arguments
                const args = JSON.parse(toolCall.function.arguments);

                // Manual conversion
                const { value, from_unit, to_unit } = args;
                let result;

                if (from_unit === 'celsius' && to_unit === 'fahrenheit') {
                    result = (value * 9 / 5) + 32;
                } else if (from_unit === 'fahrenheit' && to_unit === 'celsius') {
                    result = (value - 32) * 5 / 9;
                } else {
                    result = value; // Same unit, no conversion
                }

                const toolResult = {
                    value: result,
                    unit: to_unit,
                    original_value: value,
                    original_unit: from_unit
                };

                console.log('Tool call result:', JSON.stringify(toolResult, null, 2));

                // Add function result to Fireworks conversation
                console.log('\n[Step 5] Adding tool result to Fireworks conversation...');
                fireworksModel.addFunctionResult(toolCall.function.name, toolResult);

                // Get final response from Fireworks
                console.log('\n[Step 6] Getting final response from Fireworks...');
                const finalResponse = await fireworksModel.generate('Please provide a helpful response based on the temperature conversion result.');

                console.log('\n=== Final Assistant Response ===');
                console.log(finalResponse);
            }
        } else {
            console.log('❌ Model did not request any tool calls');
            console.log('\nModel responded directly:');
            console.log(message.content);
        }

        console.log('\n=== Test completed successfully ===');
    } catch (error) {
        console.error('❌ Test failed with error:');
        console.error(error);
    }
}

// Run the test
testFireworksBasic().catch(console.error); 