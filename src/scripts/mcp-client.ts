import * as fs from 'fs/promises';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface MCPServer {
    command: string;
    args: string[];
    env: Record<string, string>;
}

interface MCPConfig {
    mcpServers: Record<string, MCPServer>;
}

async function loadConfig(): Promise<MCPConfig> {
    try {
        const configPath = path.join(__dirname, 'mcp.json');
        const configContent = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configContent);

        // Replace placeholder API key with real one from environment
        const perplexityServer = config.mcpServers['perplexity-ask'];
        if (perplexityServer && process.env.PERPLEXITY_API_KEY) {
            perplexityServer.env.PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
        }

        return config;
    } catch (error) {
        console.error('Error loading MCP configuration:', error);
        throw error;
    }
}

class MCPExplorer {
    private mcp: Client;
    private transport: StdioClientTransport | null = null;

    constructor() {
        this.mcp = new Client({ name: 'mcp-explorer', version: '1.0.0' });
    }

    async connectToServer(serverConfig: MCPServer): Promise<void> {
        try {
            console.log(`Connecting to MCP server using command: ${serverConfig.command}`);
            console.log(`Arguments: ${serverConfig.args.join(' ')}`);

            // Merge process environment with server-specific environment
            // Filter out undefined values from process.env
            const processEnv: Record<string, string> = {};
            Object.entries(process.env).forEach(([key, value]) => {
                if (value !== undefined) {
                    processEnv[key] = value;
                }
            });

            const env = { ...processEnv, ...serverConfig.env };
            console.log(`Using API key: ${serverConfig.env.PERPLEXITY_API_KEY.substring(0, 10)}...`);

            // Initialize transport with merged environment
            this.transport = new StdioClientTransport({
                command: serverConfig.command,
                args: serverConfig.args,
                env: env
            });

            // Connect to the server
            this.mcp.connect(this.transport);
            console.log('Successfully connected to MCP server');
        } catch (error) {
            console.error('Failed to connect to MCP server:', error);
            throw error;
        }
    }

    async listTools(): Promise<any> {
        try {
            console.log('\n--- LISTING TOOLS ---');
            const result = await this.mcp.listTools();
            console.log(JSON.stringify(result, null, 2));
            return result;
        } catch (error) {
            console.error('Error listing tools:', error);
            console.log('This MCP server does not support the listTools method.');
            return null;
        }
    }

    async listResources(): Promise<any> {
        try {
            console.log('\n--- LISTING RESOURCES ---');
            const result = await this.mcp.listResources();
            console.log(JSON.stringify(result, null, 2));
            return result;
        } catch (error: any) {
            if (error.code === -32601) {
                console.log('This MCP server does not support the listResources method.');
            } else {
                console.error('Error listing resources:', error);
            }
            return null;
        }
    }

    async listPrompts(): Promise<any> {
        try {
            console.log('\n--- LISTING PROMPTS ---');
            const result = await this.mcp.listPrompts();
            console.log(JSON.stringify(result, null, 2));
            return result;
        } catch (error: any) {
            if (error.code === -32601) {
                console.log('This MCP server does not support the listPrompts method.');
            } else {
                console.error('Error listing prompts:', error);
            }
            return null;
        }
    }

    async explore(): Promise<void> {
        console.log('\n========== MCP SERVER EXPLORATION ==========\n');

        // List tools (most important)
        const tools = await this.listTools();
        if (tools === null) {
            console.log('\nWARNING: Could not retrieve tools information from the server.');
            console.log('This may indicate that the server is not properly implementing the MCP protocol.');
        }

        // Try to list resources (optional)
        await this.listResources();

        // Try to list prompts (optional)
        await this.listPrompts();

        console.log('\n========== EXPLORATION COMPLETE ==========\n');
    }

    async cleanup(): Promise<void> {
        if (this.transport) {
            console.log('Closing MCP connection...');
            await this.mcp.close();
            console.log('MCP connection closed');
        }
    }
}

async function main() {
    const explorer = new MCPExplorer();

    try {
        const config = await loadConfig();
        const serverName = 'perplexity-ask'; // Use the first server by default
        const serverConfig = config.mcpServers[serverName];

        if (!serverConfig) {
            throw new Error(`Server "${serverName}" not found in configuration`);
        }

        await explorer.connectToServer(serverConfig);
        await explorer.explore();
    } catch (error) {
        console.error('Error in MCP Explorer:', error);
    } finally {
        await explorer.cleanup();
    }
}

main(); 