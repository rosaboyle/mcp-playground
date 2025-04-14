import { v4 as uuidv4 } from 'uuid';

class MCPClient {
    private serverId: string;
    private connectionId: string;
    private isConnected: boolean = false;

    constructor(serverId: string, existingConnectionId?: string) {
        this.serverId = serverId;
        // Use existing connection ID if provided, otherwise generate a new one
        this.connectionId = existingConnectionId || uuidv4();
        // If we're reusing an existing connection, set isConnected to true
        this.isConnected = !!existingConnectionId;
    }

    /**
     * Connect to the MCP server
     */
    async connect(): Promise<void> {
        // If already connected (using existing connection), return early
        if (this.isConnected) {
            console.log(`Already connected to MCP server ${this.serverId} with connection ID ${this.connectionId}`);
            return;
        }

        try {
            console.log(`Connecting to MCP server ${this.serverId}`);
            const response = await window.electron.mcp.connect(this.serverId, this.connectionId);

            if (!response.success) {
                throw new Error(response.error || 'Failed to connect to MCP server');
            }

            this.isConnected = true;
            console.log('Successfully connected to MCP server');
        } catch (error) {
            console.error('Failed to connect to MCP server:', error);
            throw error;
        }
    }

    /**
     * Returns the connection ID
     */
    getConnectionId(): string {
        return this.connectionId;
    }

    /**
     * List tools from the MCP server
     */
    async listTools(): Promise<any> {
        try {
            console.log('Listing tools from MCP server');
            const response = await window.electron.mcp.listTools(this.connectionId);

            if (!response.success) {
                throw new Error(response.error || 'Failed to list tools');
            }

            console.log('Tools listed successfully');

            if (response.warning) {
                console.warn(response.warning);
            }

            return response.data;
        } catch (error) {
            console.error('Error listing tools:', error);
            return { tools: [] };
        }
    }

    /**
     * List resources from the MCP server
     */
    async listResources(): Promise<any> {
        try {
            console.log('Listing resources from MCP server');
            const response = await window.electron.mcp.listResources(this.connectionId);

            if (!response.success) {
                throw new Error(response.error || 'Failed to list resources');
            }

            console.log('Resources listed successfully');

            if (response.warning) {
                console.warn(response.warning);
            }

            return response.data;
        } catch (error) {
            console.error('Error listing resources:', error);
            return { resources: [] };
        }
    }

    /**
     * List prompts from the MCP server
     */
    async listPrompts(): Promise<any> {
        try {
            console.log('Listing prompts from MCP server');
            const response = await window.electron.mcp.listPrompts(this.connectionId);

            if (!response.success) {
                throw new Error(response.error || 'Failed to list prompts');
            }

            console.log('Prompts listed successfully');

            if (response.warning) {
                console.warn(response.warning);
            }

            return response.data;
        } catch (error) {
            console.error('Error listing prompts:', error);
            return { prompts: [] };
        }
    }

    /**
     * Clean up resources
     */
    async cleanup(): Promise<void> {
        if (this.isConnected) {
            console.log('Disconnecting from MCP server');
            try {
                await window.electron.mcp.disconnect(this.connectionId);
                this.isConnected = false;
                console.log('MCP connection closed');
            } catch (error) {
                console.error('Error disconnecting from MCP server:', error);
            }
        }
    }
}

export default MCPClient; 