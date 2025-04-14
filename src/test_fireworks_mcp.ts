/**
 * Test script for Fireworks AI and MCP integration
 * 
 * This script tests the integration of Fireworks AI with MCP (Model Context Protocol),
 * demonstrating how tool calls from Fireworks LLM can be handled through MCP.
 * 
 * Run with: npx ts-node src/test_fireworks_mcp.ts
 * 
 * Note on TypeScript issues:
 * - The 'scriptPath' property of SimpleMCPServer is now accessed via a getter
 * - The FIREWORKS_API_KEY is type-casted to string to satisfy TypeScript
 * - For a simpler test without MCP complexity, see test_fireworks_simple.ts
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { FireworksModel, Tool } from 'airtrain/dist/integrations/fireworks';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Load environment variables
dotenv.config();

// API key for Fireworks (replace with your own)
const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY;
if (!FIREWORKS_API_KEY) {
    throw new Error('FIREWORKS_API_KEY is not set in the environment variables');
}

/**
 * Simple temperature conversion tool server for MCP
 */
class SimpleMCPServer {
    private proc: any = null;
    private _scriptPath: string;

    constructor() {
        // Create a temporary script file
        this._scriptPath = path.join(__dirname, 'temp_mcp_server.js');

        // Simple MCP-like server script for temperature conversion
        const scriptContent = `
// Temperature conversion tool
const celsiusToFahrenheit = (celsius) => {
    return (celsius * 9/5) + 32;
};

const fahrenheitToCelsius = (fahrenheit) => {
    return (fahrenheit - 32) * 5/9;
};

// Simple JSON-RPC over stdio
process.stdin.on('data', (buffer) => {
    const line = buffer.toString().trim();
    if (!line) return;
    
    try {
        const request = JSON.parse(line);
        handleRequest(request);
    } catch (error) {
        sendResponse({
            jsonrpc: '2.0',
            id: null,
            error: {
                code: -32700,
                message: 'Parse error',
                data: error.message
            }
        });
    }
});

function sendResponse(response) {
    process.stdout.write(JSON.stringify(response) + '\\n');
}

function handleRequest(request) {
    if (request.method === 'mcp/list_tools') {
        sendResponse({
            jsonrpc: '2.0',
            id: request.id,
            result: {
                tools: [
                    {
                        name: 'convert_temperature',
                        description: 'Convert temperature between Celsius and Fahrenheit',
                        inputSchema: {
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
                ]
            }
        });
    } else if (request.method === 'mcp/call_tool') {
        const toolName = request.params.name;
        const args = request.params.arguments;
        
        if (toolName === 'convert_temperature') {
            const { value, from_unit, to_unit } = args;
            
            // If units are the same, return the input value
            if (from_unit === to_unit) {
                sendResponse({
                    jsonrpc: '2.0',
                    id: request.id,
                    result: {
                        output: {
                            value,
                            unit: to_unit
                        }
                    }
                });
                return;
            }
            
            // Convert from Celsius to Fahrenheit
            if (from_unit === 'celsius' && to_unit === 'fahrenheit') {
                const result = celsiusToFahrenheit(value);
                sendResponse({
                    jsonrpc: '2.0',
                    id: request.id,
                    result: {
                        output: {
                            value: result,
                            unit: 'fahrenheit',
                            original_value: value,
                            original_unit: 'celsius'
                        }
                    }
                });
                return;
            }
            
            // Convert from Fahrenheit to Celsius
            if (from_unit === 'fahrenheit' && to_unit === 'celsius') {
                const result = fahrenheitToCelsius(value);
                sendResponse({
                    jsonrpc: '2.0',
                    id: request.id,
                    result: {
                        output: {
                            value: result,
                            unit: 'celsius',
                            original_value: value,
                            original_unit: 'fahrenheit'
                        }
                    }
                });
                return;
            }
            
            // If we get here, something went wrong
            sendResponse({
                jsonrpc: '2.0',
                id: request.id,
                error: {
                    code: -32000,
                    message: 'Invalid temperature conversion parameters'
                }
            });
        } else {
            sendResponse({
                jsonrpc: '2.0',
                id: request.id,
                error: {
                    code: -32601,
                    message: \`Tool not found: \${toolName}\`
                }
            });
        }
    } else {
        sendResponse({
            jsonrpc: '2.0',
            id: request.id,
            error: {
                code: -32601,
                message: \`Method not found: \${request.method}\`
            }
        });
    }
}

// Handle cleanup
process.on('SIGINT', () => {
    console.log('Shutting down MCP server...');
    process.exit(0);
});

// Signal ready
console.log('Temperature conversion server ready');
`;

        // Write script to file
        fs.writeFileSync(this._scriptPath, scriptContent);
    }

    // Add getter for scriptPath
    get scriptPath(): string {
        return this._scriptPath;
    }

    start() {
        // Start the server process
        this.proc = spawn('node', [this._scriptPath]);

        // Log output for debugging
        this.proc.stdout.on('data', (data: Buffer) => {
            console.log(`[MCP Server] ${data.toString().trim()}`);
        });

        this.proc.stderr.on('data', (data: Buffer) => {
            console.error(`[MCP Server Error] ${data.toString().trim()}`);
        });

        // Give the server a moment to start up
        return new Promise(resolve => setTimeout(resolve, 1000));
    }

    stop() {
        if (this.proc) {
            this.proc.kill();
            this.proc = null;
        }

        // Clean up temporary script
        if (fs.existsSync(this._scriptPath)) {
            fs.unlinkSync(this._scriptPath);
        }
    }
}

/**
 * Main test function for Fireworks MCP integration
 */
async function testFireworksMCP() {
    console.log('=== Testing Fireworks AI + MCP Integration ===');

    let mcpServer: SimpleMCPServer | null = null;
    let mcpClient: Client | null = null;
    let transport: StdioClientTransport | null = null;
    let fireworksModel: FireworksModel | null = null;

    try {
        // Step 1: Start MCP server
        console.log('\n[Step 1] Starting MCP temperature conversion server...');
        mcpServer = new SimpleMCPServer();
        await mcpServer.start();
        console.log('✅ MCP server started');

        // Step 2: Connect MCP client to server
        console.log('\n[Step 2] Connecting MCP client to server...');
        mcpClient = new Client({
            name: 'test-mcp-client',
            version: '1.0.0'
        });

        transport = new StdioClientTransport({
            command: 'node',
            args: [mcpServer.scriptPath]
        });

        mcpClient.connect(transport);
        console.log('✅ MCP client connected to server');

        // Step 3: List available tools
        console.log('\n[Step 3] Listing available tools from MCP server...');
        const toolsResult = await mcpClient.listTools();
        const mcpTools = toolsResult.tools || [];
        console.log(`Found ${mcpTools.length} tools: ${mcpTools.map(t => t.name).join(', ')}`);

        // Step 4: Initialize Fireworks model
        console.log('\n[Step 4] Initializing Fireworks model...');
        fireworksModel = new FireworksModel({
            apiKey: FIREWORKS_API_KEY as string,
            defaultModel: 'accounts/fireworks/models/llama-v3p1-70b-instruct'
        });
        console.log('✅ Fireworks model initialized');

        // Step 5: Convert MCP tools to Fireworks format
        console.log('\n[Step 5] Converting MCP tools to Fireworks format...');
        const fireworksTools: Tool[] = mcpTools.map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description || `Tool: ${tool.name}`,
                parameters: tool.inputSchema || { type: 'object', properties: {} }
            }
        }));
        console.log('✅ Tools converted to Fireworks format');

        // Step 6: Set up system prompt for Fireworks
        console.log('\n[Step 6] Setting up system prompt for Fireworks...');
        fireworksModel.setSystemPrompt('You are a helpful assistant that can convert temperatures using tools. You should always use the tools provided to you when appropriate.');
        console.log('✅ System prompt set');

        // Step 7: Send query to Fireworks model that should trigger tool use
        console.log('\n[Step 7] Sending query to Fireworks model...');
        const query = 'Convert 25 degrees Celsius to Fahrenheit';
        console.log(`User query: "${query}"`);

        const response = await fireworksModel.generateWithTools(query, fireworksTools);
        console.log('✅ Received response from Fireworks model');

        // Step 8: Check if the model wants to call a function
        console.log('\n[Step 8] Checking if model requested tool call...');
        const message = response.choices[0].message;

        if (message.tool_calls && message.tool_calls.length > 0) {
            const toolCall = message.tool_calls[0];
            console.log(`✅ Model requested tool call: ${toolCall.function.name}`);
            console.log(`With arguments: ${toolCall.function.arguments}`);

            if (toolCall.type === 'function' && toolCall.function.name === 'convert_temperature') {
                // Step 9: Execute the tool call via MCP
                console.log('\n[Step 9] Executing tool call via MCP...');

                // Parse arguments
                const args = JSON.parse(toolCall.function.arguments);

                // Call the MCP tool
                const result = await mcpClient.callTool({
                    name: toolCall.function.name,
                    arguments: args
                });

                console.log('Tool call result:', JSON.stringify(result, null, 2));

                // Step 10: Add function result to Fireworks conversation
                console.log('\n[Step 10] Adding tool result to Fireworks conversation...');
                fireworksModel.addFunctionResult(toolCall.function.name, result.output || result);

                // Step 11: Get final response from Fireworks
                console.log('\n[Step 11] Getting final response from Fireworks...');
                const finalResponse = await fireworksModel.generate('Please provide a helpful response based on the temperature conversion result.');

                console.log('\n=== Final Assistant Response ===');
                console.log(finalResponse);
            } else {
                console.log('❌ Model did not request the expected tool');
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
    } finally {
        // Clean up resources
        console.log('\nCleaning up resources...');

        if (mcpServer) {
            mcpServer.stop();
        }

        if (mcpClient && transport) {
            try {
                await mcpClient.close();
            } catch (error) {
                console.error('Error closing MCP client:', error);
            }
        }

        console.log('✅ Cleanup completed');
    }
}

/**
 * Interactive mode for manual testing
 */
async function runInteractiveMode() {
    console.log('=== Fireworks MCP Interactive Mode ===');

    let mcpServer: SimpleMCPServer | null = null;
    let mcpClient: Client | null = null;
    let transport: StdioClientTransport | null = null;
    let fireworksModel: FireworksModel | null = null;
    let fireworksTools: Tool[] = [];

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        // Step 1: Start MCP server
        console.log('\n[Step 1] Starting MCP temperature conversion server...');
        mcpServer = new SimpleMCPServer();
        await mcpServer.start();
        console.log('✅ MCP server started');

        // Step 2: Connect MCP client to server
        console.log('\n[Step 2] Connecting MCP client to server...');
        mcpClient = new Client({
            name: 'test-mcp-client',
            version: '1.0.0'
        });

        transport = new StdioClientTransport({
            command: 'node',
            args: [mcpServer.scriptPath]
        });

        mcpClient.connect(transport);
        console.log('✅ MCP client connected to server');

        // Step 3: List available tools
        console.log('\n[Step 3] Listing available tools from MCP server...');
        const toolsResult = await mcpClient.listTools();
        const mcpTools = toolsResult.tools || [];
        console.log(`Found ${mcpTools.length} tools: ${mcpTools.map(t => t.name).join(', ')}`);

        // Step 4: Initialize Fireworks model
        console.log('\n[Step 4] Initializing Fireworks model...');
        fireworksModel = new FireworksModel({
            apiKey: FIREWORKS_API_KEY as string,
            defaultModel: 'accounts/fireworks/models/llama-v3p1-70b-instruct'
        });
        console.log('✅ Fireworks model initialized');

        // Step 5: Convert MCP tools to Fireworks format
        console.log('\n[Step 5] Converting MCP tools to Fireworks format...');
        fireworksTools = mcpTools.map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description || `Tool: ${tool.name}`,
                parameters: tool.inputSchema || { type: 'object', properties: {} }
            }
        }));
        console.log('✅ Tools converted to Fireworks format');

        // Step 6: Set up system prompt for Fireworks
        console.log('\n[Step 6] Setting up system prompt for Fireworks...');
        fireworksModel.setSystemPrompt('You are a helpful assistant that can convert temperatures using tools. You should always use the tools provided to you when appropriate.');
        console.log('✅ System prompt set');

        console.log('\n=== Interactive Chat Session Started ===');
        console.log('Type your messages or "quit" to exit');

        const promptUser = async () => {
            rl.question('\nYou: ', async (input) => {
                if (input.toLowerCase() === 'quit') {
                    console.log('Ending chat session...');
                    rl.close();
                    return;
                }

                try {
                    console.log('Generating response...');

                    // Send query to Fireworks model
                    const response = await fireworksModel!.generateWithTools(input, fireworksTools);

                    // Check if model wants to call a tool
                    const message = response.choices[0].message;

                    if (message.tool_calls && message.tool_calls.length > 0) {
                        console.log('Assistant is using tools to help answer...');

                        let finalResponse = '';

                        // Process each tool call
                        for (const toolCall of message.tool_calls) {
                            if (toolCall.type === 'function') {
                                console.log(`[Tool Call] ${toolCall.function.name} with args: ${toolCall.function.arguments}`);

                                // Parse arguments
                                const args = JSON.parse(toolCall.function.arguments);

                                // Call the MCP tool
                                const result = await mcpClient!.callTool({
                                    name: toolCall.function.name,
                                    arguments: args
                                });

                                console.log('[Tool Result]', JSON.stringify(result, null, 2));

                                // Add result to conversation
                                fireworksModel!.addFunctionResult(toolCall.function.name, result.output || result);

                                // Get response with the tool result
                                const toolResponse = await fireworksModel!.generate('Please provide a helpful response based on the tool result.');

                                // Add to final response
                                if (finalResponse) finalResponse += '\n\n';
                                finalResponse += toolResponse;
                            }
                        }

                        console.log(`\nAssistant: ${finalResponse || 'No response'}`);
                    } else {
                        // Direct response without tool call
                        console.log(`\nAssistant: ${message.content || 'No response'}`);
                    }

                    // Prompt for next input
                    promptUser();
                } catch (error) {
                    console.error('Error processing message:', error);
                    promptUser();
                }
            });
        };

        // Start the prompt loop
        promptUser();

        // Handle cleanup when user closes with Ctrl+C
        rl.on('SIGINT', () => {
            console.log('\nEnding chat session...');
            rl.close();
        });

        // Wait for readline to close
        await new Promise(resolve => rl.on('close', resolve));
    } catch (error) {
        console.error('Error in interactive mode:', error);
    } finally {
        // Clean up resources
        console.log('\nCleaning up resources...');

        if (mcpServer) {
            mcpServer.stop();
        }

        if (mcpClient && transport) {
            try {
                await mcpClient.close();
            } catch (error) {
                console.error('Error closing MCP client:', error);
            }
        }

        console.log('✅ Cleanup completed');
    }
}

// Main execution
async function main() {
    // Parse command line args
    const args = process.argv.slice(2);
    const interactive = args.includes('--interactive') || args.includes('-i');

    if (interactive) {
        await runInteractiveMode();
    } else {
        await testFireworksMCP();
    }
}

// Run the main function
main().catch(console.error); 